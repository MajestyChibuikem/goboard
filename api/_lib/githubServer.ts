import { GitHubProfileData, GitHubRepoSummary, GitHubLanguageStat, GitHubRecentCommit } from '../../types';

const GITHUB_API_BASE = 'https://api.github.com';

function buildHeaders(serverToken?: string, userAccessToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'GoBoard-Academic-Platform',
  };
  const token = userAccessToken || serverToken || process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }
  return headers;
}

export async function fetchServerGitHubBundle(params: {
  githubNumericId?: string;
  knownUsername?: string;
  userAccessToken?: string;
  previousRewardedDate?: string | null;
}): Promise<GitHubProfileData> {
  const headers = buildHeaders(process.env.GITHUB_TOKEN, params.userAccessToken);

  let login = params.knownUsername;
  let userData: any = null;

  // 1. If numeric GitHub ID is provided from Firebase Auth, verify and resolve login
  if (params.githubNumericId) {
    const userRes = await fetch(`${GITHUB_API_BASE}/user/${encodeURIComponent(params.githubNumericId)}`, { headers });
    if (userRes.ok) {
      userData = await userRes.json();
      login = userData.login;
    }
  }

  // 2. Fallback to username if ID lookup was omitted or not found
  if (!userData && login) {
    const userRes = await fetch(`${GITHUB_API_BASE}/users/${encodeURIComponent(login)}`, { headers });
    if (!userRes.ok) {
      if (userRes.status === 404) throw new Error('GitHub account not found.');
      if (userRes.status === 403) throw new Error('GitHub API rate limit exceeded.');
      throw new Error(`GitHub user fetch failed with status ${userRes.status}`);
    }
    userData = await userRes.json();
    login = userData.login;
  }

  if (!userData || !login) {
    throw new Error('Unable to resolve GitHub profile for this user.');
  }

  // 3. Fetch public repositories and public events in parallel
  const [reposRes, eventsRes] = await Promise.all([
    fetch(
      `${GITHUB_API_BASE}/users/${encodeURIComponent(login)}/repos?sort=pushed&direction=desc&per_page=60&type=owner`,
      { headers }
    ),
    fetch(`${GITHUB_API_BASE}/users/${encodeURIComponent(login)}/events/public?per_page=100`, { headers }),
  ]);

  const rawRepos: any[] = reposRes.ok ? await reposRes.json() : [];
  const rawEvents: any[] = eventsRes.ok ? await eventsRes.json() : [];

  // 4. Compute stars, language breakdown, repositories
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
        pushedAt: r.pushed_at || r.updated_at || new Date().toISOString(),
        isPinned: false,
        homepage: r.homepage ? String(r.homepage).trim() : null,
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

  const topRepos = [...mappedRepos]
    .sort((a, b) => new Date(b.pushedAt || b.updatedAt).getTime() - new Date(a.pushedAt || a.updatedAt).getTime())
    .slice(0, 8);

  // 5. Fetch recent commits on active repositories
  const recentCommitsList: GitHubRecentCommit[] = [];
  const reposToInspect = mappedRepos.slice(0, 4);

  if (reposToInspect.length > 0) {
    try {
      const commitPromises = reposToInspect.map(async (repo) => {
        try {
          const commitRes = await fetch(
            `${GITHUB_API_BASE}/repos/${encodeURIComponent(login)}/${encodeURIComponent(repo.name)}/commits?author=${encodeURIComponent(login)}&per_page=4`,
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
                date: c.commit?.author?.date || c.commit?.committer?.date || new Date().toISOString(),
                url: c.html_url || `https://github.com/${login}/${repo.name}/commit/${c.sha}`,
              }));
            }
          }
        } catch {
          // ignore individual repo commit failures
        }
        return [];
      });

      const commitResults = await Promise.allSettled(commitPromises);
      for (const res of commitResults) {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          recentCommitsList.push(...res.value);
        }
      }

      recentCommitsList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch {
      // ignore commit aggregation error
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
    lastRewardedCodingDate: params.previousRewardedDate || null,
    isVerifiedOAuth: true,
    topRepos,
    recentCommitsList: recentCommitsList.slice(0, 6),
    customPinnedRepoNames: [],
    lastSyncedAt: new Date().toISOString(),
  };
}
