export interface QuestTaskSpec {
  id: string;
  number: string;
  title: string;
  filePath: string;
  instructions: string;
  codeHint?: string;
}

export interface QuestResourceLink {
  title: string;
  url: string;
  tag: string;
}

export interface ActiveQuestConfig {
  id: 'quest_1_baby_steps' | 'quest_2_shell_basics';
  numberLabel: string;
  title: string;
  subtitle: string;
  xpReward: number;
  prerequisiteQuestId: string | null;
  deadlineIso: string | null;
  targetRepoName: string;
  fogOfWarTeaser: string;
  overview: string;
  learningResources?: QuestResourceLink[];
  tasks: QuestTaskSpec[];
}

export interface QuestTaskCheckResult {
  taskId: string;
  title: string;
  filePath: string;
  passed: boolean;
  reason: string;
}

export interface QuestCheckResponse {
  success: boolean;
  questId: string;
  allPassed: boolean;
  alreadyCompleted: boolean;
  xpAwarded: number;
  repoUrl?: string;
  results: QuestTaskCheckResult[];
  error?: string;
}

export const ACTIVE_QUESTS: ActiveQuestConfig[] = [
  {
    id: 'quest_1_baby_steps',
    numberLabel: 'Quest 01',
    title: 'Baby Steps',
    subtitle: 'Create your first public GitHub repository and initialize your README.',
    xpReward: 25,
    prerequisiteQuestId: null,
    deadlineIso: null,
    targetRepoName: 'GoQuests',
    fogOfWarTeaser: 'Initialize your GitHub journey with your very first repository.',
    overview:
      'Every builder starts with a single repository. Before you can tackle terminal automation or campus challenges, you need a home on GitHub for your quest solutions.',
    learningResources: [
      {
        title: 'GitHub Docs: Create a repo',
        url: 'https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository',
        tag: 'Official Guide',
      },
      {
        title: 'Markdown Basic Syntax',
        url: 'https://www.markdownguide.org/basic-syntax/',
        tag: 'Quick Reference',
      },
    ],
    tasks: [
      {
        id: 'repo_exists',
        number: 'Task 0',
        title: 'Public Repository "GoQuests"',
        filePath: 'GoQuests/',
        instructions:
          'Create a public, non-forked repository on your linked GitHub account named exactly GoQuests.',
      },
      {
        id: 'readme_baby_steps',
        number: 'Task 1',
        title: 'Initialize README.md with "Baby Steps"',
        filePath: 'README.md',
        instructions:
          'Create a root README.md file inside your GoQuests repository (at least 15 characters long) that contains the phrase "Baby Steps" (case-insensitive) and a short note on why you are joining GoBoard Quests.',
        codeHint: '# GoQuests - Baby Steps\nMy journey learning Linux & Git on GoBoard.',
      },
    ],
  },
  {
    id: 'quest_2_shell_basics',
    numberLabel: 'Quest 02',
    title: '0x00. Shell Basics',
    subtitle: 'Master essential Bash navigation and file creation commands.',
    xpReward: 50,
    prerequisiteQuestId: 'quest_1_baby_steps',
    deadlineIso: null,
    targetRepoName: 'GoQuests',
    fogOfWarTeaser: 'Complete "Quest 01: Baby Steps" to declassify the 0x00. Shell Basics terminal tasks.',
    overview:
      'In this ALX-style technical quest, you will write 3 concise two-line Bash scripts inside the 0x00-shell_basics/ directory of your GoQuests repository. Every script must start with #!/bin/bash on Line 1 followed by your command on Line 2.',
    learningResources: [
      {
        title: 'Linux Journey — Command Line (The Shell)',
        url: 'https://linuxjourney.com/lesson/the-shell',
        tag: '10-Min Interactive Lesson',
      },
      {
        title: 'Devhints — Bash Scripting Cheat Sheet',
        url: 'https://devhints.io/bash',
        tag: '1-Page Cheat Sheet',
      },
    ],
    tasks: [
      {
        id: 'dir_readme',
        number: 'Task 0',
        title: 'Directory README',
        filePath: '0x00-shell_basics/README.md',
        instructions:
          'Create a non-empty README.md (at least 10 characters) inside the 0x00-shell_basics/ directory describing what these scripts do.',
      },
      {
        id: 'task_0_pwd',
        number: 'Task 1',
        title: 'Where am I?',
        filePath: '0x00-shell_basics/0-current_working_directory',
        instructions:
          'Write a 2-line Bash script that prints the absolute path name of the current working directory.',
        codeHint: '#!/bin/bash\npwd',
      },
      {
        id: 'task_1_listit',
        number: 'Task 2',
        title: 'What’s in there?',
        filePath: '0x00-shell_basics/1-listit',
        instructions:
          'Write a 2-line Bash script that lists all files in the current directory in long format, including hidden files starting with a dot (.).',
        codeHint: '#!/bin/bash\nls -la',
      },
      {
        id: 'task_2_gouni_lab',
        number: 'Task 3',
        title: 'The GoUni Lab',
        filePath: '0x00-shell_basics/2-gouni_lab',
        instructions:
          'Write a 2-line Bash script that creates the directory /tmp/gouni_lab (using mkdir) and then creates an empty file /tmp/gouni_lab/ready.txt inside it on a single chained line using && and touch.',
        codeHint: '#!/bin/bash\nmkdir -p /tmp/gouni_lab && touch /tmp/gouni_lab/ready.txt',
      },
    ],
  },
];
