import {
  GitHubProfileData,
  GitHubRepoSummary,
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
  params: { username?: string; accessToken?: string },
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

  // 2. Fetch public repositories (up to 60 most recently updated) and recent public events in parallel
  const [reposRes, eventsRes] = await Promise.all([
    fetch(`${GITHUB_API_BASE}/users/${encodeURIComponent(login)}/repos?sort=updated&per_page=60&type=owner`, {
      headers,
    }),
    fetch(`${GITHUB_API_BASE}/users/${encodeURIComponent(login)}/events/public?per_page=100`, {
      headers,
    }),
  ]);

  const rawRepos: any[] = reposRes.ok ? await reposRes.json() : [];
  const rawEvents: any[] = eventsRes.ok ? await eventsRes.json() : [];

  // 3. Compute total stars, language breakdown, and top repositories
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

  // Sort repos by stars then recency, keep up to 8 for quick import & profile display
  const topRepos = [...mappedRepos]
    .sort((a, b) => {
      if (b.stargazersCount !== a.stargazersCount) {
        return b.stargazersCount - a.stargazersCount;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    })
    .slice(0, 8);

  // 4. Calculate 30-day coding activity from public events
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
