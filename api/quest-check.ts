import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb, verifyAuth, hasServiceAccountCredentials } from './_lib/admin.js';
import { XP_VALUES } from './_lib/xpRules.js';
import {
  getTodayString,
  readXpGrantState,
  applyXpGrantInTransaction,
  XpTransactionAccumulator,
} from './_lib/ledger.js';

interface TaskCheckResult {
  taskId: string;
  title: string;
  filePath: string;
  passed: boolean;
  reason: string;
}

function getGitHubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'GoBoard-Quest-Checker/1.0',
  };
  const token = process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function fetchGitHubJson(path: string): Promise<{ status: number; data: any }> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: getGitHubHeaders(),
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

async function fetchRepoFileDecoded(
  owner: string,
  repo: string,
  filePath: string
): Promise<{ exists: boolean; content: string; status: number }> {
  const encodedPath = filePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const { status, data } = await fetchGitHubJson(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`
  );
  if (status !== 200 || !data || Array.isArray(data) || typeof data.content !== 'string') {
    return { exists: false, content: '', status };
  }
  const decoded = Buffer.from(data.content.replace(/\s/g, ''), 'base64')
    .toString('utf-8')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  return { exists: true, content: decoded, status: 200 };
}

async function gradeQuest1BabySteps(username: string): Promise<{
  results: TaskCheckResult[];
  repoUrl: string;
}> {
  const repoName = 'GoQuests';
  const results: TaskCheckResult[] = [];

  // 1. Check repository GoQuests exists, is public, and is not a fork
  const repoRes = await fetchGitHubJson(
    `/repos/${encodeURIComponent(username)}/${encodeURIComponent(repoName)}`
  );

  const repoExistsAndValid =
    repoRes.status === 200 &&
    repoRes.data &&
    repoRes.data.private === false &&
    repoRes.data.fork === false;

  if (!repoExistsAndValid) {
    let reason = `Repository "${username}/${repoName}" was not found. Make sure it is named "GoQuests" and is set to Public.`;
    if (repoRes.status === 200 && repoRes.data?.fork) {
      reason = `Repository "${username}/${repoName}" is a fork. You must create your own original repository.`;
    } else if (repoRes.status === 200 && repoRes.data?.private) {
      reason = `Repository "${username}/${repoName}" is private. Please change its visibility to Public.`;
    }

    results.push({
      taskId: 'repo_exists',
      title: 'Public Repository "GoQuests"',
      filePath: 'GoQuests/',
      passed: false,
      reason,
    });
    results.push({
      taskId: 'readme_baby_steps',
      title: 'Initialize README.md with "Baby Steps"',
      filePath: 'README.md',
      passed: false,
      reason: 'Waiting for public GoQuests repository to be created first.',
    });

    return {
      results,
      repoUrl: `https://github.com/${username}/${repoName}`,
    };
  }

  const actualRepoName = repoRes.data.name || repoName;
  results.push({
    taskId: 'repo_exists',
    title: 'Public Repository "GoQuests"',
    filePath: 'GoQuests/',
    passed: true,
    reason: `Found public, original repository ${username}/${actualRepoName}.`,
  });

  // 2. Check README.md exists, >= 15 chars, contains "Baby Steps" (case-insensitive)
  let readme = await fetchRepoFileDecoded(username, actualRepoName, 'README.md');
  if (!readme.exists) {
    readme = await fetchRepoFileDecoded(username, actualRepoName, 'readme.md');
  }

  if (!readme.exists) {
    results.push({
      taskId: 'readme_baby_steps',
      title: 'Initialize README.md with "Baby Steps"',
      filePath: 'README.md',
      passed: false,
      reason: 'README.md not found in the root of GoQuests.',
    });
  } else {
    const trimmed = readme.content.trim();
    const hasBabySteps = /baby\s+steps/i.test(trimmed);
    const hasMinLength = trimmed.length >= 15;

    if (!hasMinLength) {
      results.push({
        taskId: 'readme_baby_steps',
        title: 'Initialize README.md with "Baby Steps"',
        filePath: 'README.md',
        passed: false,
        reason: `README.md is too short (${trimmed.length} chars). Write at least 15 characters including "Baby Steps".`,
      });
    } else if (!hasBabySteps) {
      results.push({
        taskId: 'readme_baby_steps',
        title: 'Initialize README.md with "Baby Steps"',
        filePath: 'README.md',
        passed: false,
        reason: 'README.md was found, but does not contain the phrase "Baby Steps".',
      });
    } else {
      results.push({
        taskId: 'readme_baby_steps',
        title: 'Initialize README.md with "Baby Steps"',
        filePath: 'README.md',
        passed: true,
        reason: `Verified README.md (${trimmed.length} chars) containing "Baby Steps".`,
      });
    }
  }

  return {
    results,
    repoUrl: repoRes.data.html_url || `https://github.com/${username}/${actualRepoName}`,
  };
}

async function gradeQuest2ShellBasics(username: string): Promise<{
  results: TaskCheckResult[];
  repoUrl: string;
}> {
  const repoName = 'GoQuests';
  const results: TaskCheckResult[] = [];

  const repoRes = await fetchGitHubJson(
    `/repos/${encodeURIComponent(username)}/${encodeURIComponent(repoName)}`
  );

  if (repoRes.status !== 200 || !repoRes.data || repoRes.data.private || repoRes.data.fork) {
    const failReason = `Public repository "${username}/GoQuests" not found. Complete Quest 01 first.`;
    return {
      repoUrl: `https://github.com/${username}/${repoName}`,
      results: [
        {
          taskId: 'dir_readme',
          title: 'Directory README',
          filePath: '0x00-shell_basics/README.md',
          passed: false,
          reason: failReason,
        },
        {
          taskId: 'task_0_pwd',
          title: 'Where am I?',
          filePath: '0x00-shell_basics/0-current_working_directory',
          passed: false,
          reason: failReason,
        },
        {
          taskId: 'task_1_listit',
          title: 'What’s in there?',
          filePath: '0x00-shell_basics/1-listit',
          passed: false,
          reason: failReason,
        },
        {
          taskId: 'task_2_gouni_lab',
          title: 'The GoUni Lab',
          filePath: '0x00-shell_basics/2-gouni_lab',
          passed: false,
          reason: failReason,
        },
      ],
    };
  }

  const actualRepoName = repoRes.data.name || repoName;

  // Fetch all 4 files in parallel
  const [dirReadme, file0, file1, file2] = await Promise.all([
    fetchRepoFileDecoded(username, actualRepoName, '0x00-shell_basics/README.md'),
    fetchRepoFileDecoded(
      username,
      actualRepoName,
      '0x00-shell_basics/0-current_working_directory'
    ),
    fetchRepoFileDecoded(username, actualRepoName, '0x00-shell_basics/1-listit'),
    fetchRepoFileDecoded(username, actualRepoName, '0x00-shell_basics/2-gouni_lab'),
  ]);

  // Task 0: 0x00-shell_basics/README.md
  if (!dirReadme.exists) {
    results.push({
      taskId: 'dir_readme',
      title: 'Directory README',
      filePath: '0x00-shell_basics/README.md',
      passed: false,
      reason: 'File 0x00-shell_basics/README.md was not found.',
    });
  } else if (dirReadme.content.trim().length < 10) {
    results.push({
      taskId: 'dir_readme',
      title: 'Directory README',
      filePath: '0x00-shell_basics/README.md',
      passed: false,
      reason: `0x00-shell_basics/README.md is too short (${dirReadme.content.trim().length} chars, minimum 10).`,
    });
  } else {
    results.push({
      taskId: 'dir_readme',
      title: 'Directory README',
      filePath: '0x00-shell_basics/README.md',
      passed: true,
      reason: '0x00-shell_basics/README.md exists and is non-empty.',
    });
  }

  // Helper to parse 2-line bash scripts
  const checkTwoLineScript = (
    file: { exists: boolean; content: string },
    filePath: string
  ): { ok: boolean; line2: string; error?: string } => {
    if (!file.exists) {
      return { ok: false, line2: '', error: `File ${filePath} was not found.` };
    }
    const nonEmptyLines = file.content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (nonEmptyLines.length === 0) {
      return { ok: false, line2: '', error: `File ${filePath} is empty.` };
    }
    if (nonEmptyLines[0] !== '#!/bin/bash') {
      return {
        ok: false,
        line2: '',
        error: `Line 1 of ${filePath} must be exactly "#!/bin/bash" (found "${nonEmptyLines[0]}").`,
      };
    }
    if (nonEmptyLines.length < 2) {
      return {
        ok: false,
        line2: '',
        error: `File ${filePath} only has the shebang line. Add your command on Line 2.`,
      };
    }
    if (nonEmptyLines.length > 2) {
      return {
        ok: false,
        line2: '',
        error: `File ${filePath} must be at most 2 non-empty lines (found ${nonEmptyLines.length} lines).`,
      };
    }
    return { ok: true, line2: nonEmptyLines[1] };
  };

  // Task 1: 0-current_working_directory
  const check0 = checkTwoLineScript(file0, '0x00-shell_basics/0-current_working_directory');
  if (!check0.ok) {
    results.push({
      taskId: 'task_0_pwd',
      title: 'Where am I?',
      filePath: '0x00-shell_basics/0-current_working_directory',
      passed: false,
      reason: check0.error!,
    });
  } else if (!/^pwd\s*$/.test(check0.line2)) {
    results.push({
      taskId: 'task_0_pwd',
      title: 'Where am I?',
      filePath: '0x00-shell_basics/0-current_working_directory',
      passed: false,
      reason: 'Line 2 must use the exact command to print the current working directory.',
    });
  } else {
    results.push({
      taskId: 'task_0_pwd',
      title: 'Where am I?',
      filePath: '0x00-shell_basics/0-current_working_directory',
      passed: true,
      reason: 'Shebang #!/bin/bash and pwd command verified.',
    });
  }

  // Task 2: 1-listit
  const check1 = checkTwoLineScript(file1, '0x00-shell_basics/1-listit');
  if (!check1.ok) {
    results.push({
      taskId: 'task_1_listit',
      title: 'What’s in there?',
      filePath: '0x00-shell_basics/1-listit',
      passed: false,
      reason: check1.error!,
    });
  } else if (!/^ls\s+(-la|-al|-a\s+-l|-l\s+-a)\s*$/.test(check1.line2)) {
    results.push({
      taskId: 'task_1_listit',
      title: 'What’s in there?',
      filePath: '0x00-shell_basics/1-listit',
      passed: false,
      reason:
        'Line 2 must list all files (including hidden "." files) in long format using ls flags.',
    });
  } else {
    results.push({
      taskId: 'task_1_listit',
      title: 'What’s in there?',
      filePath: '0x00-shell_basics/1-listit',
      passed: true,
      reason: 'Shebang #!/bin/bash and ls hidden + long format flags verified.',
    });
  }

  // Task 3: 2-gouni_lab
  const check2 = checkTwoLineScript(file2, '0x00-shell_basics/2-gouni_lab');
  if (!check2.ok) {
    results.push({
      taskId: 'task_2_gouni_lab',
      title: 'The GoUni Lab',
      filePath: '0x00-shell_basics/2-gouni_lab',
      passed: false,
      reason: check2.error!,
    });
  } else {
    const cmd = check2.line2;
    const hasMkdir = /\bmkdir\b/.test(cmd);
    const hasDir = cmd.includes('/tmp/gouni_lab');
    const hasChain = cmd.includes('&&');
    const hasTouch = /\btouch\b/.test(cmd);
    const hasFile = cmd.includes('/tmp/gouni_lab/ready.txt');

    if (!hasMkdir || !hasDir || !hasChain || !hasTouch || !hasFile) {
      results.push({
        taskId: 'task_2_gouni_lab',
        title: 'The GoUni Lab',
        filePath: '0x00-shell_basics/2-gouni_lab',
        passed: false,
        reason:
          'Line 2 must chain directory creation (mkdir /tmp/gouni_lab) and file creation (touch /tmp/gouni_lab/ready.txt) with &&.',
      });
    } else {
      results.push({
        taskId: 'task_2_gouni_lab',
        title: 'The GoUni Lab',
        filePath: '0x00-shell_basics/2-gouni_lab',
        passed: true,
        reason: 'Shebang #!/bin/bash and chained mkdir && touch command verified.',
      });
    }
  }

  return {
    results,
    repoUrl: repoRes.data.html_url || `https://github.com/${username}/${actualRepoName}`,
  };
}

function parseGitHubOwnerRepo(urlStr: string): { owner: string; repo: string } | null {
  try {
    const cleaned = urlStr.trim().replace(/\.git$/, '').replace(/\/+$/, '');
    const match = cleaned.match(/github\.com\/([^/]+)\/([^/?#]+)/i);
    if (!match) return null;
    return { owner: match[1], repo: match[2] };
  } catch {
    return null;
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let uid: string;
  try {
    const authRes = await verifyAuth(req);
    uid = authRes.uid;
  } catch (err: any) {
    return res.status(401).json({ error: err?.message || 'Unauthorized: Invalid or missing token' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const action = body.action || 'check_quest';
  const canUseAdminDb = hasServiceAccountCredentials();

  try {
    let userData: Record<string, any> | null = null;
    if (canUseAdminDb) {
      try {
        const adminDb = getAdminDb();
        const userRef = adminDb.collection('users').doc(uid);
        const userSnap = await userRef.get();
        if (userSnap.exists) {
          userData = userSnap.data() || null;
        }
      } catch (dbErr) {
        console.warn('[quest-check] Admin DB read failed, using client fallback context:', dbErr);
      }
    }

    // ── Action 3: Admin Approve Campaign Submission (+50 XP) ──
    if (action === 'approve_campaign_submission') {
      if (!canUseAdminDb || !userData) {
        return res.status(200).json({
          success: true,
          awarded: 0,
          fallbackToClient: true,
        });
      }

      if (userData.isAdmin !== true) {
        return res.status(403).json({
          success: false,
          error: 'Only administrators can approve campaign submissions.',
        });
      }

      const submissionId = String(body.submissionId || '').trim();
      if (!submissionId) {
        return res.status(400).json({ success: false, error: 'submissionId is required.' });
      }

      const adminDb = getAdminDb();
      const subRef = adminDb.collection('campaignSubmissions').doc(submissionId);
      const subSnap = await subRef.get();
      if (!subSnap.exists) {
        return res.status(404).json({ success: false, error: 'Campaign submission not found.' });
      }

      const subData = subSnap.data()!;
      const authorUid = subData.authorUid;
      const partnerUid = subData.partnerUid || null;
      const today = getTodayString();

      let totalAwarded = 0;
      await adminDb.runTransaction(async (tx) => {
        const authorRead = await readXpGrantState(
          tx,
          adminDb,
          `campaign_approve_${submissionId}_${authorUid}`,
          authorUid,
          XP_VALUES.CAMPAIGN_SUBMISSION_APPROVED,
          today,
          true
        );

        let partnerRead: any = null;
        if (partnerUid && partnerUid !== authorUid) {
          partnerRead = await readXpGrantState(
            tx,
            adminDb,
            `campaign_approve_${submissionId}_${partnerUid}`,
            partnerUid,
            XP_VALUES.CAMPAIGN_SUBMISSION_APPROVED,
            today,
            true
          );
        }

        const acc = new XpTransactionAccumulator();
        const awardedAuthor = acc.addGrant(
          adminDb,
          `campaign_approve_${submissionId}_${authorUid}`,
          authorUid,
          authorRead,
          'CAMPAIGN_SUBMISSION_APPROVED',
          today,
          { submissionId }
        );

        let awardedPartner = 0;
        if (partnerRead && partnerUid) {
          awardedPartner = acc.addGrant(
            adminDb,
            `campaign_approve_${submissionId}_${partnerUid}`,
            partnerUid,
            partnerRead,
            'CAMPAIGN_SUBMISSION_APPROVED',
            today,
            { submissionId, role: 'partner' }
          );
        }

        tx.update(subRef, {
          status: 'approved',
          reviewedAt: new Date().toISOString(),
          reviewedBy: uid,
        });

        acc.apply(tx, adminDb);
        totalAwarded = awardedAuthor + awardedPartner;
      });

      return res.status(200).json({
        success: true,
        awarded: totalAwarded,
      });
    }

    // ── Action 2: Validate Campaign Submission Repo ──
    if (action === 'validate_campaign_repo') {
      if (userData) {
        const userXp = userData.xp || 0;
        if (userXp < 100 && !userData.isAdmin) {
          return res.status(403).json({
            success: false,
            error: `You need at least 100 XP to submit to the GoUni Prayer Book Redesign Campaign (current: ${userXp} XP).`,
          });
        }
      }

      const repoUrl = String(body.repoUrl || '').trim();
      const figmaUrl = String(body.figmaUrl || '').trim();
      const parsed = parseGitHubOwnerRepo(repoUrl);

      if (!parsed) {
        return res.status(400).json({
          success: false,
          error: 'Please enter a valid public GitHub repository URL (e.g. https://github.com/username/gouni-prayer-book).',
        });
      }

      if (!/^https:\/\/(www\.)?figma\.com\/.+/i.test(figmaUrl)) {
        return res.status(400).json({
          success: false,
          error: 'Please enter a valid Figma design or prototype URL (https://www.figma.com/...).',
        });
      }

      const repoCheck = await fetchGitHubJson(
        `/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`
      );

      if (repoCheck.status !== 200 || !repoCheck.data || repoCheck.data.private || repoCheck.data.fork) {
        return res.status(400).json({
          success: false,
          error:
            repoCheck.data?.fork
              ? 'Your submission repository cannot be a fork. Please create an original public repository.'
              : 'Could not access that GitHub repository. Make sure it exists and is set to Public.',
        });
      }

      // Check README.md for pitch (>= 80 words)
      const readmeRes = await fetchGitHubJson(
        `/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/readme`
      );

      if (readmeRes.status !== 200 || !readmeRes.data?.content) {
        return res.status(400).json({
          success: false,
          error:
            'Your GitHub repository must include a README.md containing your redesign pitch (at least 80 words) and your Figma link.',
        });
      }

      const readmeText = Buffer.from(readmeRes.data.content.replace(/\s/g, ''), 'base64')
        .toString('utf-8')
        .trim();
      const words = readmeText.split(/\s+/).filter(Boolean);
      if (words.length < 80) {
        return res.status(400).json({
          success: false,
          error: `Your repository README.md pitch currently has ${words.length} words. Please write at least 80 words explaining the UX problems you solved in the GoUni Prayer Book redesign.`,
          wordCount: words.length,
        });
      }

      return res.status(200).json({
        success: true,
        valid: true,
        wordCount: words.length,
        repoFullName: repoCheck.data.full_name,
        repoHtmlUrl: repoCheck.data.html_url,
      });
    }

    // ── Action 1: Check Active Technical Quest ──
    const questId = String(body.questId || '');
    if (questId !== 'quest_1_baby_steps' && questId !== 'quest_2_shell_basics') {
      return res.status(400).json({ error: `Unknown questId: ${questId}` });
    }

    const githubUsername = String(
      userData?.githubProfile?.username ||
        userData?.githubUsernameLower ||
        body.githubUsername ||
        ''
    ).trim();
    if (!githubUsername) {
      return res.status(400).json({
        success: false,
        error: 'Please link your GitHub account on GoBoard before running the Quest Checker.',
      });
    }

    const completedQuests: string[] = Array.isArray(userData?.completedQuests)
      ? userData!.completedQuests
      : Array.isArray(body.completedQuests)
      ? body.completedQuests
      : [];

    if (
      questId === 'quest_2_shell_basics' &&
      !completedQuests.includes('quest_1_baby_steps')
    ) {
      return res.status(403).json({
        success: false,
        error: 'Locked: Complete "Quest 01: Baby Steps" first to unlock 0x00. Shell Basics.',
      });
    }

    const grade =
      questId === 'quest_1_baby_steps'
        ? await gradeQuest1BabySteps(githubUsername)
        : await gradeQuest2ShellBasics(githubUsername);

    const allPassed = grade.results.every((r) => r.passed);
    const alreadyCompleted = completedQuests.includes(questId);
    const rewardAmount =
      questId === 'quest_1_baby_steps'
        ? XP_VALUES.QUEST_1_BABY_STEPS
        : XP_VALUES.QUEST_2_SHELL_BASICS;

    let xpAwarded = 0;
    let clientShouldAwardXp = false;

    if (allPassed) {
      if (canUseAdminDb && userData) {
        try {
          const adminDb = getAdminDb();
          const today = getTodayString();
          const ledgerId = `quest_${questId}_${uid}`;

          xpAwarded = await adminDb.runTransaction(async (tx) => {
            const readState = await readXpGrantState(
              tx,
              adminDb,
              ledgerId,
              uid,
              rewardAmount,
              today,
              true // Bypass daily cap for one-time quest curriculum milestones
            );

            return applyXpGrantInTransaction(
              tx,
              adminDb,
              ledgerId,
              uid,
              readState,
              `QUEST_COMPLETED:${questId}`,
              today,
              { questId, githubUsername },
              {
                completedQuests: FieldValue.arrayUnion(questId),
              }
            );
          });
        } catch (txErr) {
          console.warn('[quest-check] Admin DB transaction failed, delegating XP grant to client:', txErr);
          clientShouldAwardXp = true;
        }
      } else {
        clientShouldAwardXp = true;
      }
    }

    return res.status(200).json({
      success: true,
      questId,
      allPassed,
      alreadyCompleted,
      xpAwarded,
      clientShouldAwardXp,
      rewardAmount,
      repoUrl: grade.repoUrl,
      results: grade.results,
    });
  } catch (err: any) {
    console.error('[quest-check] Error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Internal server error while checking quest.',
    });
  }
}
