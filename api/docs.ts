import fs from 'fs';
import path from 'path';

export const config = {
  runtime: 'nodejs',
};

const CANONICAL_RANKS = [
  { rank: 'Freshman Coder', min: 0, max: 99, emoji: '🎓' },
  { rank: 'Rising Dev', min: 100, max: 299, emoji: '🚀' },
  { rank: 'Code Ninja', min: 300, max: 599, emoji: '🥷' },
  { rank: 'Campus Builder', min: 600, max: 999, emoji: '🏗️' },
  { rank: 'Campus Legend', min: 1000, max: 1999, emoji: '🌟' },
  { rank: 'Hall of Fame', min: 2000, max: null, emoji: '🏆' },
];

const CANONICAL_XP = {
  SUBMIT_PROJECT: 50,
  FIRST_PROJECT_BONUS: 100,
  PROJECT_APPROVED: 50,
  SUBMIT_WRITING: 50,
  WRITING_APPROVED: 50,
  RECEIVE_VOTE: 3,
  VOTE_MILESTONE_10: 25,
  VOTE_MILESTONE_50: 75,
  LEAVE_COMMENT: 3,
  RECEIVE_COMMENT: 5,
  LOGIN_STREAK: 10,
  GITHUB_CONNECT: 15,
  GITHUB_ACTIVE_DAY: 15,
  ONBOARDING_COMPLETE: 25,
  QUEST_1_BABY_STEPS: 25,
  QUEST_2_SHELL_BASICS: 50,
  CAMPAIGN_SUBMISSION_APPROVED: 50,
};

const CANONICAL_QUESTS = [
  {
    id: 'quest_1_baby_steps',
    title: 'Baby Steps',
    xpReward: 25,
    targetRepoName: 'GoQuests',
    checkType: 'GitHub API automated inspection',
    requirements: [
      'Public original repository named GoQuests',
      'Root README.md of at least 15 characters containing the phrase "Baby Steps"',
    ],
  },
  {
    id: 'quest_2_shell_basics',
    title: '0x00. Shell Basics',
    xpReward: 50,
    targetRepoName: 'GoQuests',
    prerequisiteQuestId: 'quest_1_baby_steps',
    checkType: 'GitHub API automated inspection',
    requirements: [
      'Directory 0x00-shell_basics/ with descriptive README.md',
      '0-current_working_directory: 2-line Bash script (Line 1: #!/bin/bash, Line 2: pwd)',
      '1-listit: 2-line Bash script (Line 1: #!/bin/bash, Line 2: ls -la)',
      '2-gouni_lab: 2-line Bash script (Line 1: #!/bin/bash, Line 2: mkdir -p /tmp/gouni_lab && touch /tmp/gouni_lab/ready.txt)',
      'All scripts must be executable (chmod +x)',
    ],
  },
];

const ACTIVE_CAMPAIGN = {
  id: 'prayer_book_s1',
  seasonNumber: 1,
  title: 'Season 1: GoUni Prayer Book Redesign Campaign',
  unlockThresholdXp: 100,
  teamSizesAllowed: ['solo', 'duo'],
  requirements: [
    'Public GitHub repository with README.md pitch of at least 80 words',
    'Figma prototype link or accessible Google Drive link',
    'Minimum 4 core screens (Smart Home, Prayer Reader, Search/Bookmarks, Chapel/Chant)',
  ],
  rubric100Points: {
    uxProblemSolvingAndNavigation: 35,
    visualCraftTypographyAccessibility: 25,
    figmaPrototypeAndReadmePitch: 20,
    verifiedCommunityVotes: 20,
  },
};

export default async function handler(req: any, res: any) {
  // Global CORS headers for AI agents and LLM crawlers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const format = (req.query?.format || '').toLowerCase();
  const acceptHeader = (req.headers?.accept || '').toLowerCase();
  const wantsMarkdown =
    format === 'markdown' ||
    format === 'text' ||
    format === 'txt' ||
    (!format && (acceptHeader.includes('text/markdown') || acceptHeader.includes('text/plain')));

  if (wantsMarkdown) {
    try {
      const candidates = [
        path.join(process.cwd(), 'public', 'llms-full.txt'),
        path.join(process.cwd(), 'dist', 'llms-full.txt'),
        path.join(__dirname, '..', 'public', 'llms-full.txt'),
      ];

      for (const p of candidates) {
        if (fs.existsSync(p)) {
          const content = fs.readFileSync(p, 'utf-8');
          res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
          return res.status(200).send(content);
        }
      }
    } catch (err) {
      console.warn('Could not read llms-full.txt from disk:', err);
    }

    // Fallback markdown summary if file system read is restricted
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    return res.status(200).send(
      `# GoBoard Documentation (Agent Fallback)\n\n` +
      `Explore complete documentation at https://goboard-psi.vercel.app/docs or fetch https://goboard-psi.vercel.app/llms-full.txt directly.\n\n` +
      `## Ranks\n` +
      CANONICAL_RANKS.map((r) => `- ${r.rank} (${r.min}+ XP)`).join('\n') +
      `\n\n## Quests\n` +
      CANONICAL_QUESTS.map((q) => `- ${q.title} (+${q.xpReward} XP)`).join('\n')
    );
  }

  // Return structured machine-readable JSON representation
  return res.status(200).json({
    app: 'GoBoard',
    version: '2.4.0',
    university: 'Godfrey Okoye University (GoUni), Enugu, Nigeria',
    faculty: 'Faculty of Computing',
    description:
      'Verified student software showcase, learning curriculum, and developer network powered by GitHub and Cloud Firestore.',
    links: {
      site: 'https://goboard-psi.vercel.app',
      docs: 'https://goboard-psi.vercel.app/docs',
      llmsTxt: 'https://goboard-psi.vercel.app/llms.txt',
      llmsFullTxt: 'https://goboard-psi.vercel.app/llms-full.txt',
      repository: 'https://github.com/MajestyChibuikem/goboard',
    },
    ranks: CANONICAL_RANKS,
    xpRules: CANONICAL_XP,
    quests: CANONICAL_QUESTS,
    activeCampaign: ACTIVE_CAMPAIGN,
    endpoints: [
      { path: '/api/docs', method: 'GET', description: 'Machine-readable documentation (JSON or Markdown)' },
      { path: '/api/xp-event', method: 'POST', description: 'Server-authoritative idempotent XP event reporter' },
      { path: '/api/quest-check', method: 'POST', description: 'Automated GitHub test grader for Genesis Quests' },
      { path: '/api/insight', method: 'POST', description: 'Google Gemini 2.5 Flash architectural project analyzer' },
      { path: '/api/project-availability', method: 'POST', description: 'Unique project title and slug validation' },
    ],
  });
}
