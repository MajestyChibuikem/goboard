import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  runTransaction,
  serverTimestamp,
  increment,
  arrayUnion,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { GitHubProfileData } from '../types';

export type XpEventType =
  | 'PROJECT_SUBMITTED'
  | 'PROJECT_APPROVED'
  | 'VOTE_CAST'
  | 'COMMENT_POSTED'
  | 'WRITING_SUBMITTED'
  | 'WRITING_APPROVED'
  | 'WRITING_VOTE_CAST'
  | 'DAILY_LOGIN'
  | 'GITHUB_SYNC'
  | 'ONBOARDING_COMPLETED'
  | 'ONBOARDING_SKIPPED';

export interface XpEventPayload {
  type: XpEventType;
  projectId?: string;
  writingId?: string;
  targetType?: 'project' | 'writing';
  targetId?: string;
  commentId?: string;
  displayName?: string;
  department?: string;
  academicLevel?: string;
  interests?: string[];
  profile?: GitHubProfileData;
}

export interface XpEventResponse {
  success: boolean;
  awarded: number;
  streakDays?: number;
  reason?: string;
  error?: string;
  profile?: any;
  onboardingCompletedAt?: string;
  fallbackToClient?: boolean;
}

const CLIENT_XP_VALUES = {
  SUBMIT_PROJECT: 50,
  FIRST_PROJECT: 100,
  PROJECT_APPROVED: 50,
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
} as const;

function getTodayIsoDate(): string {
  return new Date().toISOString().split('T')[0];
}

function getYesterdayIsoDate(): string {
  return new Date(Date.now() - 86400000).toISOString().split('T')[0];
}

/**
 * Ledger-backed client Firestore transaction fallback.
 * Used when the serverless environment does not have FIREBASE_SERVICE_ACCOUNT configured.
 * Every XP grant creates an immutable /xpLedger/{ledgerId} document inside a Firestore transaction,
 * guaranteeing strict idempotency so no event can ever award XP more than once.
 */
async function executeClientXpFallback(
  callerUid: string,
  payload: XpEventPayload
): Promise<XpEventResponse> {
  const today = getTodayIsoDate();
  const userRef = doc(db, 'users', callerUid);

  try {
    switch (payload.type) {
      case 'ONBOARDING_COMPLETED': {
        const ledgerRef = doc(db, 'xpLedger', `onboarding_${callerUid}`);
        const completedIso = new Date().toISOString();
        let awarded = 0;

        await runTransaction(db, async (tx) => {
          const [ledgerSnap, userSnap] = await Promise.all([
            tx.get(ledgerRef),
            tx.get(userRef),
          ]);
          if (!userSnap.exists()) return;

          const updates: Record<string, any> = {
            onboardingCompletedAt: serverTimestamp(),
          };
          if (payload.displayName?.trim()) updates.displayName = payload.displayName.trim();
          if (payload.department?.trim()) updates.department = payload.department.trim();
          if (payload.academicLevel) updates.academicLevel = payload.academicLevel;
          if (Array.isArray(payload.interests)) {
            updates.interests = payload.interests.slice(0, 5);
          }

          if (!ledgerSnap.exists()) {
            awarded = CLIENT_XP_VALUES.ONBOARDING_COMPLETE;
            tx.set(ledgerRef, {
              userId: callerUid,
              amount: awarded,
              reason: 'ONBOARDING_COMPLETE',
              meta: {},
              createdAt: serverTimestamp(),
            });
            updates.xp = increment(awarded);
            updates.seasonXp = increment(awarded);
          }

          tx.update(userRef, updates);
        });

        return {
          success: true,
          awarded,
          onboardingCompletedAt: completedIso,
        };
      }

      case 'ONBOARDING_SKIPPED': {
        const completedIso = new Date().toISOString();
        const updates: Record<string, any> = {
          onboardingCompletedAt: serverTimestamp(),
        };
        if (payload.displayName?.trim()) updates.displayName = payload.displayName.trim();
        if (payload.department?.trim()) updates.department = payload.department.trim();
        if (payload.academicLevel) updates.academicLevel = payload.academicLevel;
        if (Array.isArray(payload.interests)) {
          updates.interests = payload.interests.slice(0, 5);
        }
        await updateDoc(userRef, updates);
        return {
          success: true,
          awarded: 0,
          onboardingCompletedAt: completedIso,
        };
      }

      case 'GITHUB_SYNC': {
        const ghProfile = payload.profile;
        const connectLedgerRef = doc(db, 'xpLedger', `github_connect_${callerUid}`);
        const activeDate = ghProfile?.lastActiveDate || null;
        const activeLedgerRef = activeDate
          ? doc(db, 'xpLedger', `github_${callerUid}_${activeDate}`)
          : null;

        let awarded = 0;

        await runTransaction(db, async (tx) => {
          const userSnap = await tx.get(userRef);
          if (!userSnap.exists()) return;
          const userData = userSnap.data() || {};

          const connectSnap = await tx.get(connectLedgerRef);
          const activeSnap = activeLedgerRef ? await tx.get(activeLedgerRef) : null;

          if (!connectSnap.exists()) {
            awarded += CLIENT_XP_VALUES.GITHUB_CONNECT;
            tx.set(connectLedgerRef, {
              userId: callerUid,
              amount: CLIENT_XP_VALUES.GITHUB_CONNECT,
              reason: 'GITHUB_CONNECT',
              meta: { username: ghProfile?.username || '' },
              createdAt: serverTimestamp(),
            });
          } else if (activeDate && activeSnap && !activeSnap.exists()) {
            const activeMs = new Date(activeDate).getTime();
            const sevenDaysAgo = Date.now() - 7 * 86400000;
            const lastRewarded = userData.lastRewardedCodingDate;
            if (activeMs >= sevenDaysAgo && (!lastRewarded || activeDate > lastRewarded)) {
              awarded += CLIENT_XP_VALUES.GITHUB_ACTIVE_DAY;
              tx.set(activeLedgerRef!, {
                userId: callerUid,
                amount: CLIENT_XP_VALUES.GITHUB_ACTIVE_DAY,
                reason: 'GITHUB_ACTIVE_DAY',
                meta: { activeDate },
                createdAt: serverTimestamp(),
              });
            }
          }

          const updates: Record<string, any> = {
            githubSyncedAt: serverTimestamp(),
          };
          if (ghProfile) {
            const updatedGh = {
              ...ghProfile,
              ...(awarded > 0 && activeDate ? { lastRewardedCodingDate: activeDate } : {}),
            };
            updates.githubProfile = updatedGh;
            updates.githubUsernameLower = ghProfile.username.toLowerCase();
          }
          if (awarded > 0) {
            updates.xp = increment(awarded);
            updates.seasonXp = increment(awarded);
            if (activeDate) {
              updates.lastRewardedCodingDate = activeDate;
            }
          }

          tx.update(userRef, updates);
        });

        return {
          success: true,
          awarded,
          profile: ghProfile,
        };
      }

      case 'PROJECT_SUBMITTED': {
        const projectId = payload.projectId;
        if (!projectId) {
          return { success: false, awarded: 0, error: 'projectId is required' };
        }

        const submitLedgerRef = doc(db, 'xpLedger', `submit_${projectId}`);
        const firstLedgerRef = doc(db, 'xpLedger', `first_${callerUid}`);
        let totalAwarded = 0;

        await runTransaction(db, async (tx) => {
          const [submitSnap, firstSnap, userSnap] = await Promise.all([
            tx.get(submitLedgerRef),
            tx.get(firstLedgerRef),
            tx.get(userRef),
          ]);
          if (!userSnap.exists()) return;

          if (!submitSnap.exists()) {
            totalAwarded += CLIENT_XP_VALUES.SUBMIT_PROJECT;
            tx.set(submitLedgerRef, {
              userId: callerUid,
              amount: CLIENT_XP_VALUES.SUBMIT_PROJECT,
              reason: 'SUBMIT_PROJECT',
              meta: { projectId },
              createdAt: serverTimestamp(),
            });
          }

          if (!firstSnap.exists()) {
            totalAwarded += CLIENT_XP_VALUES.FIRST_PROJECT;
            tx.set(firstLedgerRef, {
              userId: callerUid,
              amount: CLIENT_XP_VALUES.FIRST_PROJECT,
              reason: 'FIRST_PROJECT',
              meta: { projectId },
              createdAt: serverTimestamp(),
            });
          }

          if (totalAwarded > 0) {
            tx.update(userRef, {
              xp: increment(totalAwarded),
              seasonXp: increment(totalAwarded),
            });
          }
        });

        return { success: true, awarded: totalAwarded };
      }

      case 'PROJECT_APPROVED': {
        const projectId = payload.projectId;
        if (!projectId) {
          return { success: false, awarded: 0, error: 'projectId is required' };
        }

        const projectRef = doc(db, 'projects', projectId);
        const projectSnap = await getDoc(projectRef);
        if (!projectSnap.exists()) {
          return { success: false, awarded: 0, error: 'Project not found' };
        }

        const authorUid = projectSnap.data()?.authorUid;
        if (!authorUid) {
          return { success: false, awarded: 0, error: 'Project has no authorUid' };
        }

        const approveLedgerRef = doc(db, 'xpLedger', `approve_${projectId}`);
        const authorRef = doc(db, 'users', authorUid);
        let awarded = 0;

        await runTransaction(db, async (tx) => {
          const [ledgerSnap, authorSnap] = await Promise.all([
            tx.get(approveLedgerRef),
            tx.get(authorRef),
          ]);
          if (!authorSnap.exists() || ledgerSnap.exists()) return;

          awarded = CLIENT_XP_VALUES.PROJECT_APPROVED;
          tx.set(approveLedgerRef, {
            userId: authorUid,
            amount: awarded,
            reason: 'PROJECT_APPROVED',
            meta: { projectId, approvedBy: callerUid },
            createdAt: serverTimestamp(),
          });
          tx.update(authorRef, {
            xp: increment(awarded),
            seasonXp: increment(awarded),
          });
        });

        return { success: true, awarded };
      }

      case 'DAILY_LOGIN': {
        const yesterday = getYesterdayIsoDate();
        const streakLedgerRef = doc(db, 'xpLedger', `streak_${callerUid}_${today}`);
        let awarded = 0;
        let finalStreak = 1;

        await runTransaction(db, async (tx) => {
          const [userSnap, streakSnap] = await Promise.all([
            tx.get(userRef),
            tx.get(streakLedgerRef),
          ]);
          if (!userSnap.exists()) return;

          const data = userSnap.data() || {};
          if (data.lastLoginDate === today) {
            finalStreak = data.streakDays || 1;
            return;
          }

          let newStreak = 1;
          if (data.lastLoginDate === yesterday) {
            newStreak = (data.streakDays || 1) + 1;
          }
          finalStreak = newStreak;

          const updates: Record<string, any> = {
            lastLoginDate: today,
            streakDays: newStreak,
          };

          if (newStreak % 3 === 0 && !streakSnap.exists()) {
            awarded = CLIENT_XP_VALUES.LOGIN_STREAK;
            tx.set(streakLedgerRef, {
              userId: callerUid,
              amount: awarded,
              reason: 'LOGIN_STREAK',
              meta: { streakDays: newStreak },
              createdAt: serverTimestamp(),
            });
            updates.xp = increment(awarded);
            updates.seasonXp = increment(awarded);
          }

          tx.update(userRef, updates);
        });

        return { success: true, awarded, streakDays: finalStreak };
      }

      case 'VOTE_CAST': {
        const projectId = payload.projectId;
        if (!projectId) return { success: false, awarded: 0 };

        const projectRef = doc(db, 'projects', projectId);
        const projectSnap = await getDoc(projectRef);
        if (!projectSnap.exists()) return { success: false, awarded: 0 };

        const projectData = projectSnap.data() || {};
        const authorUid = projectData.authorUid;
        const likes = projectData.likes || 0;
        if (!authorUid || authorUid === callerUid || likes < 3) {
          return { success: true, awarded: 0 };
        }

        const voteLedgerRef = doc(db, 'xpLedger', `vote_${callerUid}_${projectId}`);
        const authorRef = doc(db, 'users', authorUid);
        let awarded = 0;

        await runTransaction(db, async (tx) => {
          const [voteSnap, authorSnap] = await Promise.all([
            tx.get(voteLedgerRef),
            tx.get(authorRef),
          ]);
          if (!authorSnap.exists() || voteSnap.exists()) return;

          awarded = CLIENT_XP_VALUES.RECEIVE_VOTE;
          tx.set(voteLedgerRef, {
            userId: authorUid,
            amount: awarded,
            reason: 'RECEIVE_VOTE',
            meta: { projectId, voterUid: callerUid },
            createdAt: serverTimestamp(),
          });
          tx.update(authorRef, {
            xp: increment(awarded),
            seasonXp: increment(awarded),
          });
        });

        return { success: true, awarded };
      }

      case 'COMMENT_POSTED': {
        const collectionName = payload.targetType === 'writing' ? 'writings' : 'projects';
        const docId = payload.targetId || payload.projectId;
        const commentId = payload.commentId;
        if (!docId || !commentId) return { success: false, awarded: 0 };

        const targetRef = doc(db, collectionName, docId);
        const targetSnap = await getDoc(targetRef);
        if (!targetSnap.exists()) return { success: false, awarded: 0 };

        const targetData = targetSnap.data() || {};
        if ((targetData.likes || 0) < 3) {
          return { success: true, awarded: 0 };
        }

        const giveLedgerRef = doc(db, 'xpLedger', `cgive_${docId}_${commentId}`);
        let awarded = 0;

        await runTransaction(db, async (tx) => {
          const [giveSnap, userSnap] = await Promise.all([
            tx.get(giveLedgerRef),
            tx.get(userRef),
          ]);
          if (!userSnap.exists() || giveSnap.exists()) return;

          awarded = CLIENT_XP_VALUES.LEAVE_COMMENT;
          tx.set(giveLedgerRef, {
            userId: callerUid,
            amount: awarded,
            reason: 'LEAVE_COMMENT',
            meta: { targetId: docId, commentId },
            createdAt: serverTimestamp(),
          });
          tx.update(userRef, {
            xp: increment(awarded),
            seasonXp: increment(awarded),
          });
        });

        return { success: true, awarded };
      }

      case 'WRITING_SUBMITTED': {
        const writingId = payload.writingId;
        if (!writingId) return { success: false, awarded: 0 };

        const submitLedgerRef = doc(db, 'xpLedger', `wsubmit_${writingId}`);
        let awarded = 0;

        await runTransaction(db, async (tx) => {
          const [submitSnap, userSnap] = await Promise.all([
            tx.get(submitLedgerRef),
            tx.get(userRef),
          ]);
          if (!userSnap.exists() || submitSnap.exists()) return;

          awarded = CLIENT_XP_VALUES.SUBMIT_PROJECT;
          tx.set(submitLedgerRef, {
            userId: callerUid,
            amount: awarded,
            reason: 'SUBMIT_PROJECT',
            meta: { writingId },
            createdAt: serverTimestamp(),
          });
          tx.update(userRef, {
            xp: increment(awarded),
            seasonXp: increment(awarded),
          });
        });

        return { success: true, awarded };
      }

      case 'WRITING_APPROVED': {
        const writingId = payload.writingId;
        if (!writingId) return { success: false, awarded: 0 };

        const writingSnap = await getDoc(doc(db, 'writings', writingId));
        if (!writingSnap.exists()) return { success: false, awarded: 0 };
        const authorUid = writingSnap.data()?.authorUid;
        if (!authorUid) return { success: false, awarded: 0 };

        const approveLedgerRef = doc(db, 'xpLedger', `wapprove_${writingId}`);
        const authorRef = doc(db, 'users', authorUid);
        let awarded = 0;

        await runTransaction(db, async (tx) => {
          const [ledgerSnap, authorSnap] = await Promise.all([
            tx.get(approveLedgerRef),
            tx.get(authorRef),
          ]);
          if (!authorSnap.exists() || ledgerSnap.exists()) return;

          awarded = CLIENT_XP_VALUES.PROJECT_APPROVED;
          tx.set(approveLedgerRef, {
            userId: authorUid,
            amount: awarded,
            reason: 'PROJECT_APPROVED',
            meta: { writingId, approvedBy: callerUid },
            createdAt: serverTimestamp(),
          });
          tx.update(authorRef, {
            xp: increment(awarded),
            seasonXp: increment(awarded),
          });
        });

        return { success: true, awarded };
      }

      case 'WRITING_VOTE_CAST': {
        const writingId = payload.writingId;
        if (!writingId) return { success: false, awarded: 0 };

        const writingSnap = await getDoc(doc(db, 'writings', writingId));
        if (!writingSnap.exists()) return { success: false, awarded: 0 };
        const writingData = writingSnap.data() || {};
        const authorUid = writingData.authorUid;
        if (!authorUid || authorUid === callerUid || (writingData.likes || 0) < 3) {
          return { success: true, awarded: 0 };
        }

        const voteLedgerRef = doc(db, 'xpLedger', `wvote_${callerUid}_${writingId}`);
        const authorRef = doc(db, 'users', authorUid);
        let awarded = 0;

        await runTransaction(db, async (tx) => {
          const [voteSnap, authorSnap] = await Promise.all([
            tx.get(voteLedgerRef),
            tx.get(authorRef),
          ]);
          if (!authorSnap.exists() || voteSnap.exists()) return;

          awarded = CLIENT_XP_VALUES.RECEIVE_VOTE;
          tx.set(voteLedgerRef, {
            userId: authorUid,
            amount: awarded,
            reason: 'RECEIVE_VOTE',
            meta: { writingId, voterUid: callerUid },
            createdAt: serverTimestamp(),
          });
          tx.update(authorRef, {
            xp: increment(awarded),
            seasonXp: increment(awarded),
          });
        });

        return { success: true, awarded };
      }

      default:
        return { success: false, awarded: 0 };
    }
  } catch (err: any) {
    console.warn(`Client XP fallback error for ${payload.type}:`, err);
    return { success: false, awarded: 0, error: err?.message };
  }
}

/**
 * Server-first XP reporter with automatic ledger-backed client transaction fallback.
 */
export async function reportXpEvent(payload: XpEventPayload): Promise<XpEventResponse> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return { success: false, awarded: 0, reason: 'NOT_AUTHENTICATED' };
  }

  try {
    const idToken = await currentUser.getIdToken();
    const { profile: _omitProfile, ...serverPayload } = payload;
    const response = await fetch('/api/xp-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(serverPayload),
    });

    if (response.ok) {
      const data: XpEventResponse = await response.json();
      if (!data.fallbackToClient) {
        return {
          success: !!data.success,
          awarded: data.awarded || 0,
          streakDays: data.streakDays,
          reason: data.reason,
          profile: data.profile || payload.profile,
          onboardingCompletedAt: data.onboardingCompletedAt,
        };
      }
    }
  } catch (err) {
    console.warn(`XP event ${payload.type} server unreachable, using ledger-backed client fallback:`, err);
  }

  return executeClientXpFallback(currentUser.uid, payload);
}

/**
 * Self-heals any missing XP for actions the user already completed (onboarding, GitHub connection,
 * submitted projects, and approved projects) whose ledger entries were not created when the server was down.
 */
export async function reconcileMissingUserXp(uid: string): Promise<number> {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return 0;

    const userData = userSnap.data() || {};
    let totalReconciled = 0;

    // 1. Reconcile Onboarding XP (+25 XP) if onboarding was completed
    const hasCompletedOnboarding = Boolean(
      userData.onboardingCompletedAt || (userData.department && userData.academicLevel)
    );
    if (hasCompletedOnboarding) {
      const onboardingLedgerRef = doc(db, 'xpLedger', `onboarding_${uid}`);
      const onboardingSnap = await getDoc(onboardingLedgerRef);
      if (!onboardingSnap.exists()) {
        const res = await executeClientXpFallback(uid, { type: 'ONBOARDING_COMPLETED' });
        totalReconciled += res.awarded || 0;
      }
    }

    // 2. Reconcile GitHub Connection XP (+15 XP) if GitHub is connected
    if (userData.githubProfile?.username) {
      const ghLedgerRef = doc(db, 'xpLedger', `github_connect_${uid}`);
      const ghSnap = await getDoc(ghLedgerRef);
      if (!ghSnap.exists()) {
        const res = await executeClientXpFallback(uid, {
          type: 'GITHUB_SYNC',
          profile: userData.githubProfile,
        });
        totalReconciled += res.awarded || 0;
      }
    }

    // 3. Reconcile Submitted & Approved Projects XP
    const userProjectsSnap = await getDocs(
      query(collection(db, 'projects'), where('authorUid', '==', uid))
    );
    for (const projDoc of userProjectsSnap.docs) {
      const projId = projDoc.id;
      const projData = projDoc.data() || {};

      const submitLedgerSnap = await getDoc(doc(db, 'xpLedger', `submit_${projId}`));
      if (!submitLedgerSnap.exists()) {
        const res = await executeClientXpFallback(uid, {
          type: 'PROJECT_SUBMITTED',
          projectId: projId,
        });
        totalReconciled += res.awarded || 0;
      }

      if (projData.approvalStatus === 'approved') {
        const approveLedgerSnap = await getDoc(doc(db, 'xpLedger', `approve_${projId}`));
        if (!approveLedgerSnap.exists()) {
          const res = await executeClientXpFallback(uid, {
            type: 'PROJECT_APPROVED',
            projectId: projId,
          });
          totalReconciled += res.awarded || 0;
        }
      }
    }

    return totalReconciled;
  } catch (err) {
    console.warn('XP reconciliation skipped:', err);
    return 0;
  }
}

export async function runQuestChecker(questId: 'quest_1_baby_steps' | 'quest_2_shell_basics') {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Please sign in to run the Quest Checker.');
  }

  // Read current user's GitHub username and completedQuests from Firestore as context
  const userRef = doc(db, 'users', currentUser.uid);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.exists() ? userSnap.data() || {} : {};
  const githubUsername =
    userData.githubProfile?.username || userData.githubUsernameLower || '';
  const completedQuests = Array.isArray(userData.completedQuests)
    ? userData.completedQuests
    : [];

  const idToken = await currentUser.getIdToken();
  const response = await fetch('/api/quest-check', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      action: 'check_quest',
      questId,
      githubUsername,
      completedQuests,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(data.error || `Quest check failed (${response.status})`);
  }

  // If the server graded all tasks as passed and delegated the Firestore XP write to the client:
  if (data.allPassed && data.clientShouldAwardXp) {
    const rewardAmount =
      data.rewardAmount ||
      (questId === 'quest_1_baby_steps'
        ? CLIENT_XP_VALUES.QUEST_1_BABY_STEPS
        : CLIENT_XP_VALUES.QUEST_2_SHELL_BASICS);
    const ledgerRef = doc(db, 'xpLedger', `quest_${questId}_${currentUser.uid}`);
    let awarded = 0;

    await runTransaction(db, async (tx) => {
      const [ledgerSnap, freshUserSnap] = await Promise.all([
        tx.get(ledgerRef),
        tx.get(userRef),
      ]);
      if (!freshUserSnap.exists()) return;

      const updates: Record<string, any> = {
        completedQuests: arrayUnion(questId),
      };

      if (!ledgerSnap.exists()) {
        awarded = rewardAmount;
        tx.set(ledgerRef, {
          userId: currentUser.uid,
          amount: awarded,
          reason: `QUEST_COMPLETED:${questId}`,
          meta: { questId, githubUsername },
          createdAt: serverTimestamp(),
        });
        updates.xp = increment(awarded);
        updates.seasonXp = increment(awarded);
      }

      tx.update(userRef, updates);
    });

    data.xpAwarded = awarded;
  }

  return data;
}

export async function validateCampaignRepo(repoUrl: string, figmaUrl: string) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Please sign in first.');
  }

  const idToken = await currentUser.getIdToken();
  const response = await fetch('/api/quest-check', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      action: 'validate_campaign_repo',
      repoUrl,
      figmaUrl,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(data.error || 'Repository validation failed.');
  }
  return data as {
    success: boolean;
    valid: boolean;
    wordCount: number;
    repoFullName: string;
    repoHtmlUrl: string;
  };
}

export async function approveCampaignSubmissionOnServer(submissionId: string) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Not authenticated.');
  }

  const idToken = await currentUser.getIdToken();
  const response = await fetch('/api/quest-check', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      action: 'approve_campaign_submission',
      submissionId,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(data.error || 'Failed to approve campaign submission.');
  }

  if (data.fallbackToClient) {
    const subRef = doc(db, 'campaignSubmissions', submissionId);
    const subSnap = await getDoc(subRef);
    if (!subSnap.exists()) {
      throw new Error('Campaign submission not found.');
    }
    const subData = subSnap.data() || {};
    const authorUid = subData.authorUid;
    const partnerUid = subData.partnerUid || null;
    let totalAwarded = 0;

    await runTransaction(db, async (tx) => {
      const authorLedgerRef = doc(db, 'xpLedger', `campaign_approve_${submissionId}_${authorUid}`);
      const authorRef = doc(db, 'users', authorUid);
      const [authorLedgerSnap, authorSnap] = await Promise.all([
        tx.get(authorLedgerRef),
        tx.get(authorRef),
      ]);

      const partnerLedgerRef =
        partnerUid && partnerUid !== authorUid
          ? doc(db, 'xpLedger', `campaign_approve_${submissionId}_${partnerUid}`)
          : null;
      const partnerRef =
        partnerUid && partnerUid !== authorUid ? doc(db, 'users', partnerUid) : null;
      const [partnerLedgerSnap, partnerSnap] =
        partnerLedgerRef && partnerRef
          ? await Promise.all([tx.get(partnerLedgerRef), tx.get(partnerRef)])
          : [null, null];

      tx.update(subRef, {
        status: 'approved',
        reviewedAt: new Date().toISOString(),
        reviewedBy: currentUser.uid,
      });

      if (authorSnap.exists() && !authorLedgerSnap.exists()) {
        const amt = CLIENT_XP_VALUES.CAMPAIGN_SUBMISSION_APPROVED;
        totalAwarded += amt;
        tx.set(authorLedgerRef, {
          userId: authorUid,
          amount: amt,
          reason: 'CAMPAIGN_SUBMISSION_APPROVED',
          meta: { submissionId },
          createdAt: serverTimestamp(),
        });
        tx.update(authorRef, {
          xp: increment(amt),
          seasonXp: increment(amt),
        });
      }

      if (
        partnerRef &&
        partnerLedgerRef &&
        partnerSnap?.exists() &&
        !partnerLedgerSnap?.exists()
      ) {
        const amt = CLIENT_XP_VALUES.CAMPAIGN_SUBMISSION_APPROVED;
        totalAwarded += amt;
        tx.set(partnerLedgerRef, {
          userId: partnerUid,
          amount: amt,
          reason: 'CAMPAIGN_SUBMISSION_APPROVED',
          meta: { submissionId, role: 'partner' },
          createdAt: serverTimestamp(),
        });
        tx.update(partnerRef, {
          xp: increment(amt),
          seasonXp: increment(amt),
        });
      }
    });

    return { success: true, awarded: totalAwarded };
  }

  return data as { success: boolean; awarded: number };
}
