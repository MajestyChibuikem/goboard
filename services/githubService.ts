import {
  GitHubProfileData,
  GitHubRepoSummary,
  GitHubRecentCommit,
  GitHubLanguageStat,
  ProjectGitHubMeta,
  ProjectContributor,
} from '../types';

const GITHUB_API_BASE = 'https://api.github.com';

function buildHeaders(accessToken?: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

/**
 * Parses a GitHub repository URL or "owner/repo" string into { owner, repo }.
 */
export function parseGitHubRepoUrl(input: string): { owner: string; repo: string } | null {
  if (!input) return null;
  const trimmed = input.trim().replace(/\/+$/, '').replace(/\.git$/i, '');

  // Match full URL: https://github.com/owner/repo/...
  const urlMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s/#?]+)/i);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2] };
  }

  // Match shorthand: owner/repo
  const shortMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2] };
  }

  return null;
}

/**
 * Fetches a user's GitHub profile, public repositories, language breakdown,
 * and 30-day coding activity (commits & active coding days).
 */
export async function fetchGitHubUserBundle(
  params: { username?: string; accessToken?: string; customPinnedRepoNames?: string[] },
  isVerifiedOAuth = false,
  previousRewardedDate?: string | null
): Promise<GitHubProfileData> {
  const headers = buildHeaders(params.accessToken);

  // 1. Fetch user profile
  const userEndpoint =
    params.accessToken && !params.username
      ? `${GITHUB_API_BASE}/user`
      : `${GITHUB_API_BASE}/users/${encodeURIComponent((params.username || '').trim())}`;

  const userRes = await fetch(userEndpoint, { headers });
  if (!userRes.ok) {
    if (userRes.status === 404) {
      throw new Error('GitHub user not found. Please check the username.');
    }
    if (userRes.status === 403) {
      throw new Error('GitHub API rate limit reached. Please try again in a few minutes.');
    }
    throw new Error(`Failed to fetch GitHub profile (${userRes.status})`);
  }

  const userData = await userRes.json();
  const login: string = userData.login;

  // 2. Fetch public repositories sorted strictly by latest push date (so active work is always prioritized)
  // and recent public events in parallel
  const [reposRes, eventsRes] = await Promise.all([
    fetch(
      `${GITHUB_API_BASE}/users/${encodeURIComponent(login)}/repos?sort=pushed&direction=desc&per_page=60&type=owner`,
      { headers }
    ),
    fetch(`${GITHUB_API_BASE}/users/${encodeURIComponent(login)}/events/public?per_page=100`, {
      headers,
    }),
  ]);

  const rawRepos: any[] = reposRes.ok ? await reposRes.json() : [];
  const rawEvents: any[] = eventsRes.ok ? await eventsRes.json() : [];

  // 3. Detect pinned repositories
  const pinnedNamesSet = new Set<string>();

  // If user previously pinned repos manually or passed them in params
  if (Array.isArray(params.customPinnedRepoNames)) {
    params.customPinnedRepoNames.forEach((n) => {
      if (n) pinnedNamesSet.add(n.toLowerCase().trim());
    });
  }

  // If an OAuth access token is available, query GitHub GraphQL for user's official pinned repositories
  if (params.accessToken) {
    try {
      const gqlRes = await fetch(`${GITHUB_API_BASE}/graphql`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `query($login: String!) {
            user(login: $login) {
              pinnedItems(first: 6, types: REPOSITORY) {
                nodes {
                  ... on Repository {
                    name
                  }
                }
              }
            }
          }`,
          variables: { login },
        }),
      });
      if (gqlRes.ok) {
        const gqlData = await gqlRes.json();
        const nodes = gqlData?.data?.user?.pinnedItems?.nodes;
        if (Array.isArray(nodes)) {
          nodes.forEach((n: any) => {
            if (n?.name) pinnedNamesSet.add(String(n.name).toLowerCase().trim());
          });
        }
      }
    } catch (gqlErr) {
      console.warn('Could not query pinned repositories via GraphQL:', gqlErr);
    }
  }

  // 4. Compute total stars, language breakdown, and map repositories
  let totalStars = 0;
  const langCountMap: Record<string, number> = {};

  const mappedRepos: GitHubRepoSummary[] = rawRepos
    .filter((r) => !r.fork)
    .map((r) => {
      const stars = Number(r.stargazers_count) || 0;
      totalStars += stars;
      if (r.language) {
        langCountMap[r.language] = (langCountMap[r.language] || 0) + 1;
      }
      const repoNameLower = String(r.name || '').toLowerCase().trim();
      const isPinned = pinnedNamesSet.has(repoNameLower);
      const pushedAt = r.pushed_at || r.updated_at || new Date().toISOString();

      return {
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        htmlUrl: r.html_url,
        description: r.description || null,
        language: r.language || null,
        stargazersCount: stars,
        forksCount: Number(r.forks_count) || 0,
        openIssuesCount: Number(r.open_issues_count) || 0,
        topics: Array.isArray(r.topics) ? r.topics.slice(0, 6) : [],
        updatedAt: r.updated_at || new Date().toISOString(),
        pushedAt,
        isPinned,
      };
    });

  const totalLangRepos = Object.values(langCountMap).reduce((sum, n) => sum + n, 0) || 1;
  const topLanguages: GitHubLanguageStat[] = Object.entries(langCountMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / totalLangRepos) * 100),
    }));

  // Sort repos: Pinned repositories ALWAYS come first, then sort by most recent push date!
  // No older star-heavy repositories can push actively developed repos off the display.
  const topRepos = [...mappedRepos]
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const timeA = new Date(a.pushedAt || a.updatedAt).getTime();
      const timeB = new Date(b.pushedAt || b.updatedAt).getTime();
      return timeB - timeA;
    })
    .slice(0, 8);

  // 5. Fetch recent commits across the top active repositories
  const recentCommitsList: GitHubRecentCommit[] = [];
  const reposToInspect = mappedRepos.slice(0, 4);

  if (reposToInspect.length > 0) {
    try {
      const commitPromises = reposToInspect.map(async (repo) => {
        try {
          const commitRes = await fetch(
            `${GITHUB_API_BASE}/repos/${encodeURIComponent(login)}/${encodeURIComponent(
              repo.name
            )}/commits?author=${encodeURIComponent(login)}&per_page=4`,
            { headers }
          );
          if (commitRes.ok) {
            const commitData: any[] = await commitRes.json();
            if (Array.isArray(commitData)) {
              return commitData.map((c) => ({
                repoName: repo.name,
                sha: c.sha ? String(c.sha).slice(0, 7) : '',
                message: c.commit?.message
                  ? String(c.commit.message).split('\n')[0].slice(0, 100)
                  : 'Update',
                date:
                  c.commit?.author?.date ||
                  c.commit?.committer?.date ||
                  new Date().toISOString(),
                url:
                  c.html_url ||
                  `https://github.com/${login}/${repo.name}/commit/${c.sha}`,
              }));
            }
          }
        } catch (e) {
          // Ignore individual repo commit fetch errors
        }
        return [];
      });

      const commitResults = await Promise.allSettled(commitPromises);
      for (const res of commitResults) {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          recentCommitsList.push(...res.value);
        }
      }

      // Sort commits descending by date and keep up to 6
      recentCommitsList.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    } catch (err) {
      console.warn('Error aggregating recent commits:', err);
    }
  }

  // 6. Calculate 30-day coding activity from public events
  const thirtyDaysAgoMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let recentCommits30d = 0;
  const activeDaySet = new Set<string>();
  let lastActiveDate: string | null = null;

  for (const ev of rawEvents) {
    if (!ev?.created_at) continue;
    const createdMs = new Date(ev.created_at).getTime();
    const dateKey = ev.created_at.split('T')[0];

    const isCodingEvent =
      ev.type === 'PushEvent' ||
      ev.type === 'PullRequestEvent' ||
      ev.type === 'CreateEvent' ||
      ev.type === 'IssuesEvent' ||
      ev.type === 'ReleaseEvent';

    if (isCodingEvent && (!lastActiveDate || dateKey > lastActiveDate)) {
      lastActiveDate = dateKey;
    }

    if (createdMs >= thirtyDaysAgoMs && isCodingEvent) {
      activeDaySet.add(dateKey);
      if (ev.type === 'PushEvent') {
        const commitCount =
          typeof ev.payload?.size === 'number'
            ? ev.payload.size
            : Array.isArray(ev.payload?.commits)
            ? ev.payload.commits.length
            : 1;
        recentCommits30d += Math.max(1, commitCount);
      } else if (ev.type === 'PullRequestEvent' && ev.payload?.action === 'opened') {
        recentCommits30d += 1;
      }
    }
  }

  return {
    username: login.toLowerCase(),
    displayUsername: login,
    githubId: userData.id,
    avatarUrl: userData.avatar_url || '',
    profileUrl: userData.html_url || `https://github.com/${login}`,
    bio: userData.bio || null,
    publicRepos: Number(userData.public_repos) || mappedRepos.length,
    followers: Number(userData.followers) || 0,
    totalStars,
    topLanguages,
    recentCommits30d,
    activeCodingDays30d: activeDaySet.size,
    lastActiveDate,
    lastRewardedCodingDate: previousRewardedDate || null,
    isVerifiedOAuth,
    topRepos,
    recentCommitsList: recentCommitsList.slice(0, 6),
    customPinnedRepoNames: Array.from(pinnedNamesSet),
    lastSyncedAt: new Date().toISOString(),
  };
}

/**
 * Fetches live metadata, languages, latest commit, and contributors for a GitHub repository.
 */
export async function fetchGitHubRepoMetadata(
  repoUrlOrFullName: string,
  accessToken?: string
): Promise<{ repoSummary: GitHubRepoSummary; meta: ProjectGitHubMeta }> {
  const parsed = parseGitHubRepoUrl(repoUrlOrFullName);
  if (!parsed) {
    throw new Error('Invalid GitHub repository URL. Expected format: https://github.com/owner/repo');
  }

  const { owner, repo } = parsed;
  const headers = buildHeaders(accessToken);
  const baseRepoUrl = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  const [repoRes, langsRes, commitsRes, contributorsRes] = await Promise.all([
    fetch(baseRepoUrl, { headers }),
    fetch(`${baseRepoUrl}/languages`, { headers }),
    fetch(`${baseRepoUrl}/commits?per_page=1`, { headers }),
    fetch(`${baseRepoUrl}/contributors?per_page=25`, { headers }),
  ]);

  if (!repoRes.ok) {
    if (repoRes.status === 404) {
      throw new Error('GitHub repository not found or is private.');
    }
    if (repoRes.status === 403) {
      throw new Error('GitHub API rate limit reached. Please try again shortly.');
    }
    throw new Error(`Failed to fetch repository details (${repoRes.status})`);
  }

  const repoData = await repoRes.json();
  const langsData: Record<string, number> = langsRes.ok ? await langsRes.json() : {};
  const commitsData: any[] = commitsRes.ok ? await commitsRes.json() : [];
  const contributorsData: any[] = contributorsRes.ok ? await contributorsRes.json() : [];

  const languages = Object.keys(langsData).slice(0, 6);
  const latestCommit = Array.isArray(commitsData) && commitsData.length > 0 ? commitsData[0] : null;

  const contributors: ProjectContributor[] = Array.isArray(contributorsData)
    ? contributorsData
        .filter((c) => c && c.login && c.type !== 'Bot')
        .slice(0, 20)
        .map((c) => ({
          githubUsername: String(c.login),
          githubAvatarUrl: c.avatar_url || '',
          githubProfileUrl: c.html_url || `https://github.com/${c.login}`,
          contributions: Number(c.contributions) || 1,
        }))
    : [];

  const repoSummary: GitHubRepoSummary = {
    id: repoData.id,
    name: repoData.name,
    fullName: repoData.full_name,
    htmlUrl: repoData.html_url,
    description: repoData.description || null,
    language: repoData.language || null,
    stargazersCount: Number(repoData.stargazers_count) || 0,
    forksCount: Number(repoData.forks_count) || 0,
    openIssuesCount: Number(repoData.open_issues_count) || 0,
    topics: Array.isArray(repoData.topics) ? repoData.topics : [],
    updatedAt: repoData.updated_at || new Date().toISOString(),
  };

  const meta: ProjectGitHubMeta = {
    owner: repoData.owner?.login || owner,
    repo: repoData.name || repo,
    fullName: repoData.full_name || `${owner}/${repo}`,
    htmlUrl: repoData.html_url || `https://github.com/${owner}/${repo}`,
    stars: repoSummary.stargazersCount,
    forks: repoSummary.forksCount,
    openIssues: repoSummary.openIssuesCount,
    language: repoSummary.language,
    languages: languages.length > 0 ? languages : repoSummary.language ? [repoSummary.language] : [],
    lastCommitDate: latestCommit?.commit?.committer?.date || repoData.pushed_at || null,
    lastCommitMessage: latestCommit?.commit?.message
      ? String(latestCommit.commit.message).split('\n')[0].slice(0, 120)
      : null,
    contributors,
    lastSyncedAt: new Date().toISOString(),
  };

  return { repoSummary, meta };
}

/**
 * Fetches the complete list of a user's repositories from GitHub.
 * Returns up to 200 repositories sorted by latest push date (covers users with 60+ repos).
 * Includes personal repos, collaborator repos, organization repos, and forks.
 */
export async function fetchAllUserRepositories(
  username: string,
  accessToken?: string
): Promise<GitHubRepoSummary[]> {
  if (!username && !accessToken) return [];
  const headers = buildHeaders(accessToken);

  const fetchPage = async (page: number): Promise<any[]> => {
    const endpoint = accessToken
      ? `${GITHUB_API_BASE}/user/repos?sort=pushed&direction=desc&per_page=100&page=${page}&affiliation=owner,collaborator,organization_member`
      : `${GITHUB_API_BASE}/users/${encodeURIComponent(username.trim())}/repos?sort=pushed&direction=desc&per_page=100&page=${page}&type=all`;

    const res = await fetch(endpoint, { headers });
    if (!res.ok) {
      if (res.status === 404 || res.status === 403) return [];
      throw new Error(`Failed to fetch repositories (${res.status})`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  };

  try {
    const page1 = await fetchPage(1);
    let allRaw = page1;
    // If first page has 100 items, fetch second page to cover 100+ repos
    if (page1.length === 100) {
      try {
        const page2 = await fetchPage(2);
        allRaw = [...page1, ...page2];
      } catch (err) {
        console.warn('Page 2 repo fetch skipped:', err);
      }
    }

    return allRaw.map((r: any) => {
      const stars = Number(r.stargazers_count) || 0;
      const pushedAt = r.pushed_at || r.updated_at || new Date().toISOString();
      return {
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        htmlUrl: r.html_url,
        description: r.description || null,
        language: r.language || null,
        stargazersCount: stars,
        forksCount: Number(r.forks_count) || 0,
        openIssuesCount: Number(r.open_issues_count) || 0,
        topics: Array.isArray(r.topics) ? r.topics.slice(0, 6) : [],
        updatedAt: r.updated_at || new Date().toISOString(),
        pushedAt,
        isPinned: false,
      };
    });
  } catch (err) {
    console.error('Failed to fetch user repositories:', err);
    return [];
  }
}
