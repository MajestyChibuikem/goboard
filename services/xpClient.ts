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
  | 'ONBOARDING_SKIPPED'
  | 'RECONCILE_XP';

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
  accessToken?: string;
  githubUsername?: string;
  githubId?: string;
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
 * Grants an idempotent XP reward to the authenticated owner directly on `/users/{callerUid}`
 * using `xpLedgerIds` array tracking.
 *
 * IMPORTANT: Never touches `/xpLedger` from the client (avoiding 403 errors on undeployed collections)
 * and caps each single atomic transaction delta to `<= 100` XP to comply with deployed Firestore rules.
 */
async function grantOwnerXpStep(
  callerUid: string,
  ledgerId: string,
  amount: number,
  extraUpdates: Record<string, any> = {}
): Promise<number> {
  const userRef = doc(db, 'users', callerUid);
  let awarded = 0;

  await runTransaction(db, async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) return;

    const data = userSnap.data() || {};
    const existingIds: string[] = Array.isArray(data.xpLedgerIds) ? data.xpLedgerIds : [];
    const alreadyGranted = existingIds.includes(ledgerId);

    const updates: Record<string, any> = { ...extraUpdates };

    if (!alreadyGranted && amount > 0) {
      const safeAmount = Math.min(amount, 100);
      awarded = safeAmount;
      const currentXp = typeof data.xp === 'number' ? data.xp : 0;
      const currentSeasonXp = typeof data.seasonXp === 'number' ? data.seasonXp : 0;
      updates.xp = currentXp + safeAmount;
      updates.seasonXp = currentSeasonXp + safeAmount;
      updates.xpLedgerIds = arrayUnion(ledgerId);
      updates.xpHistory = arrayUnion({
        id: ledgerId,
        amount: safeAmount,
        createdAt: new Date().toISOString(),
      });
    }

    if (Object.keys(updates).length > 0) {
      tx.update(userRef, updates);
    }
  });

  return awarded;
}

/**
 * Client Firestore transaction fallback.
 * Stores idempotency keys in `xpLedgerIds` directly on `/users/{uid}` and respects
 * the `<= 100` XP per-update bound in production Firestore security rules.
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
        const completedIso = new Date().toISOString();
        const extraUpdates: Record<string, any> = {
          onboardingCompletedAt: serverTimestamp(),
        };
        if (payload.displayName?.trim()) extraUpdates.displayName = payload.displayName.trim();
        if (payload.department?.trim()) extraUpdates.department = payload.department.trim();
        if (payload.academicLevel) extraUpdates.academicLevel = payload.academicLevel;
        if (Array.isArray(payload.interests)) {
          extraUpdates.interests = payload.interests.slice(0, 5);
        }

        const awarded = await grantOwnerXpStep(
          callerUid,
          `onboarding_${callerUid}`,
          CLIENT_XP_VALUES.ONBOARDING_COMPLETE,
          extraUpdates
        );

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
        const connectLedgerId = `github_connect_${callerUid}`;
        const activeDate = ghProfile?.lastActiveDate || null;
        const activeLedgerId = activeDate ? `github_${callerUid}_${activeDate}` : null;

        let awarded = 0;

        await runTransaction(db, async (tx) => {
          const userSnap = await tx.get(userRef);
          if (!userSnap.exists()) return;
          const userData = userSnap.data() || {};
          const existingIds: string[] = Array.isArray(userData.xpLedgerIds)
            ? userData.xpLedgerIds
            : [];

          let grantedLedgerId: string | null = null;

          if (!existingIds.includes(connectLedgerId)) {
            awarded = CLIENT_XP_VALUES.GITHUB_CONNECT;
            grantedLedgerId = connectLedgerId;
          } else if (activeDate && activeLedgerId && !existingIds.includes(activeLedgerId)) {
            const activeMs = new Date(activeDate).getTime();
            const sevenDaysAgo = Date.now() - 7 * 86400000;
            const lastRewarded = userData.lastRewardedCodingDate;
            if (activeMs >= sevenDaysAgo && (!lastRewarded || activeDate > lastRewarded)) {
              awarded = CLIENT_XP_VALUES.GITHUB_ACTIVE_DAY;
              grantedLedgerId = activeLedgerId;
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
          if (awarded > 0 && grantedLedgerId) {
            const currentXp = typeof userData.xp === 'number' ? userData.xp : 0;
            const currentSeasonXp = typeof userData.seasonXp === 'number' ? userData.seasonXp : 0;
            updates.xp = currentXp + awarded;
            updates.seasonXp = currentSeasonXp + awarded;
            updates.xpLedgerIds = arrayUnion(grantedLedgerId);
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

        // Execute as two separate <= 100 XP transactions to satisfy production Firestore rules
        const awardedSubmit = await grantOwnerXpStep(
          callerUid,
          `submit_${projectId}`,
          CLIENT_XP_VALUES.SUBMIT_PROJECT
        );
        const awardedFirst = await grantOwnerXpStep(
          callerUid,
          `first_${callerUid}`,
          CLIENT_XP_VALUES.FIRST_PROJECT
        );

        return { success: true, awarded: awardedSubmit + awardedFirst };
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

        const ledgerId = `approve_${projectId}`;

        if (authorUid === callerUid) {
          const awarded = await grantOwnerXpStep(
            callerUid,
            ledgerId,
            CLIENT_XP_VALUES.PROJECT_APPROVED
          );
          return { success: true, awarded };
        }

        const authorRef = doc(db, 'users', authorUid);
        let awarded = 0;

        try {
          await runTransaction(db, async (tx) => {
            const authorSnap = await tx.get(authorRef);
            if (!authorSnap.exists()) return;
            const authorData = authorSnap.data() || {};
            const existingIds: string[] = Array.isArray(authorData.xpLedgerIds)
              ? authorData.xpLedgerIds
              : [];
            if (existingIds.includes(ledgerId)) return;

            awarded = CLIENT_XP_VALUES.PROJECT_APPROVED;
            const currentXp = typeof authorData.xp === 'number' ? authorData.xp : 0;
            const currentSeasonXp =
              typeof authorData.seasonXp === 'number' ? authorData.seasonXp : 0;

            tx.update(authorRef, {
              xp: currentXp + awarded,
              seasonXp: currentSeasonXp + awarded,
              xpLedgerIds: arrayUnion(ledgerId),
            });
          });
        } catch {
          // Fallback if caller only has cross-user ['xp', 'seasonXp'] permission
          await runTransaction(db, async (tx) => {
            const [callerSnap, authorSnap] = await Promise.all([
              tx.get(userRef),
              tx.get(authorRef),
            ]);
            if (!authorSnap.exists() || !callerSnap.exists()) return;
            const callerData = callerSnap.data() || {};
            const authorData = authorSnap.data() || {};
            const callerIds: string[] = Array.isArray(callerData.xpLedgerIds)
              ? callerData.xpLedgerIds
              : [];
            const authorIds: string[] = Array.isArray(authorData.xpLedgerIds)
              ? authorData.xpLedgerIds
              : [];
            if (callerIds.includes(ledgerId) || authorIds.includes(ledgerId)) return;

            awarded = CLIENT_XP_VALUES.PROJECT_APPROVED;
            const currentXp = typeof authorData.xp === 'number' ? authorData.xp : 0;
            const currentSeasonXp =
              typeof authorData.seasonXp === 'number' ? authorData.seasonXp : 0;

            tx.update(authorRef, {
              xp: currentXp + awarded,
              seasonXp: currentSeasonXp + awarded,
            });
            tx.update(userRef, {
              xpLedgerIds: arrayUnion(ledgerId),
            });
          });
        }

        return { success: true, awarded };
      }

      case 'DAILY_LOGIN': {
        const yesterday = getYesterdayIsoDate();
        const streakLedgerId = `streak_${callerUid}_${today}`;
        let awarded = 0;
        let finalStreak = 1;

        await runTransaction(db, async (tx) => {
          const userSnap = await tx.get(userRef);
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

          const existingIds: string[] = Array.isArray(data.xpLedgerIds) ? data.xpLedgerIds : [];
          const updates: Record<string, any> = {
            lastLoginDate: today,
            streakDays: newStreak,
          };

          if (newStreak % 3 === 0 && !existingIds.includes(streakLedgerId)) {
            awarded = CLIENT_XP_VALUES.LOGIN_STREAK;
            const currentXp = typeof data.xp === 'number' ? data.xp : 0;
            const currentSeasonXp = typeof data.seasonXp === 'number' ? data.seasonXp : 0;
            updates.xp = currentXp + awarded;
            updates.seasonXp = currentSeasonXp + awarded;
            updates.xpLedgerIds = arrayUnion(streakLedgerId);
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

        const voteLedgerId = `vote_${callerUid}_${projectId}`;
        const authorRef = doc(db, 'users', authorUid);
        let awarded = 0;

        await runTransaction(db, async (tx) => {
          const [callerSnap, authorSnap] = await Promise.all([
            tx.get(userRef),
            tx.get(authorRef),
          ]);
          if (!callerSnap.exists() || !authorSnap.exists()) return;

          const callerData = callerSnap.data() || {};
          const existingIds: string[] = Array.isArray(callerData.xpLedgerIds)
            ? callerData.xpLedgerIds
            : [];
          if (existingIds.includes(voteLedgerId)) return;

          const authorData = authorSnap.data() || {};
          awarded = CLIENT_XP_VALUES.RECEIVE_VOTE;
          const currentXp = typeof authorData.xp === 'number' ? authorData.xp : 0;
          const currentSeasonXp = typeof authorData.seasonXp === 'number' ? authorData.seasonXp : 0;

          tx.update(userRef, {
            xpLedgerIds: arrayUnion(voteLedgerId),
          });
          tx.update(authorRef, {
            xp: currentXp + awarded,
            seasonXp: currentSeasonXp + awarded,
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

        const giveLedgerId = `cgive_${docId}_${commentId}`;
        const awarded = await grantOwnerXpStep(
          callerUid,
          giveLedgerId,
          CLIENT_XP_VALUES.LEAVE_COMMENT
        );

        return { success: true, awarded };
      }

      case 'WRITING_SUBMITTED': {
        const writingId = payload.writingId;
        if (!writingId) return { success: false, awarded: 0 };

        const awarded = await grantOwnerXpStep(
          callerUid,
          `wsubmit_${writingId}`,
          CLIENT_XP_VALUES.SUBMIT_PROJECT
        );

        return { success: true, awarded };
      }

      case 'WRITING_APPROVED': {
        const writingId = payload.writingId;
        if (!writingId) return { success: false, awarded: 0 };

        const writingSnap = await getDoc(doc(db, 'writings', writingId));
        if (!writingSnap.exists()) return { success: false, awarded: 0 };
        const authorUid = writingSnap.data()?.authorUid;
        if (!authorUid) return { success: false, awarded: 0 };

        const ledgerId = `wapprove_${writingId}`;
        if (authorUid === callerUid) {
          const awarded = await grantOwnerXpStep(
            callerUid,
            ledgerId,
            CLIENT_XP_VALUES.PROJECT_APPROVED
          );
          return { success: true, awarded };
        }

        const authorRef = doc(db, 'users', authorUid);
        let awarded = 0;

        await runTransaction(db, async (tx) => {
          const authorSnap = await tx.get(authorRef);
          if (!authorSnap.exists()) return;
          const authorData = authorSnap.data() || {};
          const existingIds: string[] = Array.isArray(authorData.xpLedgerIds)
            ? authorData.xpLedgerIds
            : [];
          if (existingIds.includes(ledgerId)) return;

          awarded = CLIENT_XP_VALUES.PROJECT_APPROVED;
          const currentXp = typeof authorData.xp === 'number' ? authorData.xp : 0;
          const currentSeasonXp = typeof authorData.seasonXp === 'number' ? authorData.seasonXp : 0;

          tx.update(authorRef, {
            xp: currentXp + awarded,
            seasonXp: currentSeasonXp + awarded,
            xpLedgerIds: arrayUnion(ledgerId),
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

        const voteLedgerId = `wvote_${callerUid}_${writingId}`;
        const authorRef = doc(db, 'users', authorUid);
        let awarded = 0;

        await runTransaction(db, async (tx) => {
          const [callerSnap, authorSnap] = await Promise.all([
            tx.get(userRef),
            tx.get(authorRef),
          ]);
          if (!callerSnap.exists() || !authorSnap.exists()) return;

          const callerData = callerSnap.data() || {};
          const existingIds: string[] = Array.isArray(callerData.xpLedgerIds)
            ? callerData.xpLedgerIds
            : [];
          if (existingIds.includes(voteLedgerId)) return;

          const authorData = authorSnap.data() || {};
          awarded = CLIENT_XP_VALUES.RECEIVE_VOTE;
          const currentXp = typeof authorData.xp === 'number' ? authorData.xp : 0;
          const currentSeasonXp = typeof authorData.seasonXp === 'number' ? authorData.seasonXp : 0;

          tx.update(userRef, {
            xpLedgerIds: arrayUnion(voteLedgerId),
          });
          tx.update(authorRef, {
            xp: currentXp + awarded,
            seasonXp: currentSeasonXp + awarded,
          });
        });

        return { success: true, awarded };
      }

      case 'RECONCILE_XP': {
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return { success: true, awarded: 0 };

        const userData = userSnap.data() || {};
        const existingIds = new Set<string>(
          Array.isArray(userData.xpLedgerIds) ? userData.xpLedgerIds : []
        );
        let totalAwarded = 0;

        // 1. Onboarding (+25 XP)
        const hasCompletedOnboarding = Boolean(
          userData.onboardingCompletedAt || (userData.department && userData.academicLevel)
        );
        if (hasCompletedOnboarding && !existingIds.has(`onboarding_${callerUid}`)) {
          totalAwarded += await grantOwnerXpStep(
            callerUid,
            `onboarding_${callerUid}`,
            CLIENT_XP_VALUES.ONBOARDING_COMPLETE
          );
        }

        // 2. GitHub Connection (+15 XP)
        const hasGitHub = Boolean(
          userData.githubProfile?.username || userData.githubUsernameLower
        );
        if (hasGitHub && !existingIds.has(`github_connect_${callerUid}`)) {
          totalAwarded += await grantOwnerXpStep(
            callerUid,
            `github_connect_${callerUid}`,
            CLIENT_XP_VALUES.GITHUB_CONNECT
          );
        }

        // 3. Submitted & Approved Projects (+100 First Project, +50 Submit, +50 Approved)
        const userProjectsSnap = await getDocs(
          query(collection(db, 'projects'), where('authorUid', '==', callerUid))
        );
        if (!userProjectsSnap.empty) {
          if (!existingIds.has(`first_${callerUid}`)) {
            totalAwarded += await grantOwnerXpStep(
              callerUid,
              `first_${callerUid}`,
              CLIENT_XP_VALUES.FIRST_PROJECT
            );
          }

          for (const projDoc of userProjectsSnap.docs) {
            const projId = projDoc.id;
            const projData = projDoc.data() || {};

            if (!existingIds.has(`submit_${projId}`)) {
              totalAwarded += await grantOwnerXpStep(
                callerUid,
                `submit_${projId}`,
                CLIENT_XP_VALUES.SUBMIT_PROJECT
              );
            }

            if (projData.approvalStatus === 'approved' && !existingIds.has(`approve_${projId}`)) {
              totalAwarded += await grantOwnerXpStep(
                callerUid,
                `approve_${projId}`,
                CLIENT_XP_VALUES.PROJECT_APPROVED
              );
            }
          }
        }

        // 4. Submitted & Approved Lit Club Writings (+50 Submit, +50 Approved)
        try {
          const userWritingsSnap = await getDocs(
            query(collection(db, 'writings'), where('authorUid', '==', callerUid))
          );
          for (const wDoc of userWritingsSnap.docs) {
            const wId = wDoc.id;
            const wData = wDoc.data() || {};

            if (!existingIds.has(`wsubmit_${wId}`) && !existingIds.has(`submit_writing_${wId}`)) {
              totalAwarded += await grantOwnerXpStep(
                callerUid,
                `wsubmit_${wId}`,
                CLIENT_XP_VALUES.SUBMIT_PROJECT
              );
            }

            if (
              wData.approvalStatus === 'approved' &&
              !existingIds.has(`wapprove_${wId}`) &&
              !existingIds.has(`approve_writing_${wId}`)
            ) {
              totalAwarded += await grantOwnerXpStep(
                callerUid,
                `wapprove_${wId}`,
                CLIENT_XP_VALUES.PROJECT_APPROVED
              );
            }
          }
        } catch {
          // Ignore if writings query fails
        }

        // 5. Completed Quests (+25 Quest 1, +50 Quest 2)
        const completedQuests: string[] = Array.isArray(userData.completedQuests)
          ? userData.completedQuests
          : [];
        for (const qId of completedQuests) {
          const qLedgerId = `quest_${qId}_${callerUid}`;
          if (!existingIds.has(qLedgerId)) {
            const amt =
              qId === 'quest_1_baby_steps'
                ? CLIENT_XP_VALUES.QUEST_1_BABY_STEPS
                : CLIENT_XP_VALUES.QUEST_2_SHELL_BASICS;
            totalAwarded += await grantOwnerXpStep(callerUid, qLedgerId, amt);
          }
        }

        return { success: true, awarded: totalAwarded };
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
 * Server-first XP reporter with automatic client transaction fallback.
 */
export async function reportXpEvent(payload: XpEventPayload): Promise<XpEventResponse> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return { success: false, awarded: 0, reason: 'NOT_AUTHENTICATED' };
  }

  try {
    const idToken = await currentUser.getIdToken();
    const response = await fetch('/api/xp-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
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
    console.warn(`XP event ${payload.type} server unreachable, using client fallback:`, err);
  }

  return executeClientXpFallback(currentUser.uid, payload);
}

/**
 * Self-heals any missing XP for actions the user already completed (onboarding, GitHub connection,
 * submitted projects, approved projects, writings, and quests).
 */
export async function reconcileMissingUserXp(uid: string): Promise<number> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== uid) return 0;

  try {
    const res = await reportXpEvent({ type: 'RECONCILE_XP' });
    // Also run client-side reconciliation check to ensure `xpLedgerIds` on `/users/{uid}` is fully synced
    const clientRes = await executeClientXpFallback(uid, { type: 'RECONCILE_XP' });
    const total = (res.awarded || 0) + (clientRes.awarded || 0);
    if (total > 0) {
      console.log(`[XP] Reconciled and credited ${total} missing XP for user ${uid}!`);
    }
    return total;
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

  if (data.allPassed && data.clientShouldAwardXp) {
    const rewardAmount =
      data.rewardAmount ||
      (questId === 'quest_1_baby_steps'
        ? CLIENT_XP_VALUES.QUEST_1_BABY_STEPS
        : CLIENT_XP_VALUES.QUEST_2_SHELL_BASICS);
    const awarded = await grantOwnerXpStep(
      currentUser.uid,
      `quest_${questId}_${currentUser.uid}`,
      rewardAmount,
      {
        completedQuests: arrayUnion(questId),
      }
    );
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
      const authorRef = doc(db, 'users', authorUid);
      const authorSnap = await tx.get(authorRef);

      const partnerRef =
        partnerUid && partnerUid !== authorUid ? doc(db, 'users', partnerUid) : null;
      const partnerSnap = partnerRef ? await tx.get(partnerRef) : null;

      tx.update(subRef, {
        status: 'approved',
        reviewedAt: new Date().toISOString(),
        reviewedBy: currentUser.uid,
      });

      const authorLedgerId = `campaign_approve_${submissionId}_${authorUid}`;
      if (authorSnap.exists()) {
        const aData = authorSnap.data() || {};
        const aIds: string[] = Array.isArray(aData.xpLedgerIds) ? aData.xpLedgerIds : [];
        if (!aIds.includes(authorLedgerId)) {
          const amt = CLIENT_XP_VALUES.CAMPAIGN_SUBMISSION_APPROVED;
          totalAwarded += amt;
          tx.update(authorRef, {
            xp: (typeof aData.xp === 'number' ? aData.xp : 0) + amt,
            seasonXp: (typeof aData.seasonXp === 'number' ? aData.seasonXp : 0) + amt,
            xpLedgerIds: arrayUnion(authorLedgerId),
          });
        }
      }

      if (partnerRef && partnerSnap?.exists()) {
        const pData = partnerSnap.data() || {};
        const pIds: string[] = Array.isArray(pData.xpLedgerIds) ? pData.xpLedgerIds : [];
        const partnerLedgerId = `campaign_approve_${submissionId}_${partnerUid}`;
        if (!pIds.includes(partnerLedgerId)) {
          const amt = CLIENT_XP_VALUES.CAMPAIGN_SUBMISSION_APPROVED;
          totalAwarded += amt;
          tx.update(partnerRef, {
            xp: (typeof pData.xp === 'number' ? pData.xp : 0) + amt,
            seasonXp: (typeof pData.seasonXp === 'number' ? pData.seasonXp : 0) + amt,
            xpLedgerIds: arrayUnion(partnerLedgerId),
          });
        }
      }
    });

    return { success: true, awarded: totalAwarded };
  }

  return data as { success: boolean; awarded: number };
}

// ─────────────────────────────────────────────────────────────
// Admin XP History & Audit Engine
// ─────────────────────────────────────────────────────────────

export type AdminXpEventCategory =
  | 'ONBOARDING'
  | 'GITHUB'
  | 'FIRST_PROJECT'
  | 'PROJECT_SUBMIT'
  | 'PROJECT_APPROVE'
  | 'WRITING_SUBMIT'
  | 'WRITING_APPROVE'
  | 'QUEST'
  | 'STREAK'
  | 'ENGAGEMENT';

export interface AdminXpHistoryEvent {
  id: string;
  userId: string;
  userDisplayName: string;
  userEmail: string;
  userPhotoURL: string | null;
  department: string;
  academicLevel: string;
  amount: number;
  category: AdminXpEventCategory;
  title: string;
  detail: string;
  timestamp: string;
  status: 'credited' | 'uncredited';
}

export interface AdminUserXpAudit {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  department: string;
  academicLevel: string;
  currentXp: number;
  seasonXp: number;
  expectedMilestoneXp: number;
  uncreditedXp: number;
  events: AdminXpHistoryEvent[];
}

function normalizeTimestampToIso(val: any, fallbackIso?: string): string {
  if (!val) return fallbackIso || new Date().toISOString();
  if (typeof val === 'string') {
    const parsed = new Date(val);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    return fallbackIso || new Date().toISOString();
  }
  if (typeof val?.toDate === 'function') {
    try {
      return val.toDate().toISOString();
    } catch {
      return fallbackIso || new Date().toISOString();
    }
  }
  if (typeof val?.seconds === 'number') {
    return new Date(val.seconds * 1000).toISOString();
  }
  return fallbackIso || new Date().toISOString();
}

export async function fetchAdminXpHistoryAudit(): Promise<{
  users: AdminUserXpAudit[];
  allEvents: AdminXpHistoryEvent[];
}> {
  const [usersSnap, projectsSnap, writingsSnap] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'projects')),
    getDocs(collection(db, 'writings')).catch(() => null),
  ]);

  const projectsByAuthor = new Map<string, Array<{ id: string; data: Record<string, any> }>>();
  const projectsById = new Map<string, { id: string; data: Record<string, any> }>();

  projectsSnap.docs.forEach((d) => {
    const data = d.data() || {};
    const entry = { id: d.id, data };
    projectsById.set(d.id, entry);
    if (data.authorUid) {
      const list = projectsByAuthor.get(data.authorUid) || [];
      list.push(entry);
      projectsByAuthor.set(data.authorUid, list);
    }
  });

  const writingsByAuthor = new Map<string, Array<{ id: string; data: Record<string, any> }>>();
  const writingsById = new Map<string, { id: string; data: Record<string, any> }>();

  if (writingsSnap) {
    writingsSnap.docs.forEach((d) => {
      const data = d.data() || {};
      const entry = { id: d.id, data };
      writingsById.set(d.id, entry);
      if (data.authorUid) {
        const list = writingsByAuthor.get(data.authorUid) || [];
        list.push(entry);
        writingsByAuthor.set(data.authorUid, list);
      }
    });
  }

  const usersAudit: AdminUserXpAudit[] = [];
  const allEvents: AdminXpHistoryEvent[] = [];

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const u = userDoc.data() || {};
    const displayName = u.displayName || 'Student';
    const email = u.email || '';
    const photoURL = u.photoURL || null;
    const department = u.department || '';
    const academicLevel = u.academicLevel || '';
    const joinedIso = normalizeTimestampToIso(u.joinedAt, '2026-10-01T00:00:00.000Z');

    const existingLedgerIds = new Set<string>(
      Array.isArray(u.xpLedgerIds) ? u.xpLedgerIds : []
    );
    const historyMap = new Map<string, { amount?: number; createdAt?: string }>();
    if (Array.isArray(u.xpHistory)) {
      for (const h of u.xpHistory) {
        if (h && typeof h.id === 'string') {
          historyMap.set(h.id, h);
          existingLedgerIds.add(h.id);
        }
      }
    }

    const handledIds = new Set<string>();
    const userEvents: AdminXpHistoryEvent[] = [];

    const addEvent = (params: {
      id: string;
      amount: number;
      category: AdminXpEventCategory;
      title: string;
      detail: string;
      defaultTimestamp: string;
      isCredited: boolean;
    }) => {
      handledIds.add(params.id);
      const hist = historyMap.get(params.id);
      const ev: AdminXpHistoryEvent = {
        id: params.id,
        userId: uid,
        userDisplayName: displayName,
        userEmail: email,
        userPhotoURL: photoURL,
        department,
        academicLevel,
        amount: params.amount,
        category: params.category,
        title: params.title,
        detail: params.detail,
        timestamp: hist?.createdAt
          ? normalizeTimestampToIso(hist.createdAt, params.defaultTimestamp)
          : params.defaultTimestamp,
        status: params.isCredited ? 'credited' : 'uncredited',
      };
      userEvents.push(ev);
      allEvents.push(ev);
    };

    // 1. Onboarding (+25 XP)
    const onboardingId = `onboarding_${uid}`;
    const hasCompletedOnboarding = Boolean(
      u.onboardingCompletedAt || (u.department && u.academicLevel) || existingLedgerIds.has(onboardingId)
    );
    if (hasCompletedOnboarding) {
      addEvent({
        id: onboardingId,
        amount: CLIENT_XP_VALUES.ONBOARDING_COMPLETE,
        category: 'ONBOARDING',
        title: 'Completed Student Onboarding',
        detail: [u.department, u.academicLevel].filter(Boolean).join(' • ') || 'Profile setup completed',
        defaultTimestamp: normalizeTimestampToIso(u.onboardingCompletedAt, joinedIso),
        isCredited: existingLedgerIds.has(onboardingId),
      });
    }

    // 2. GitHub Connect (+15 XP)
    const ghConnectId = `github_connect_${uid}`;
    const hasGitHub = Boolean(
      u.githubProfile?.username || u.githubUsernameLower || existingLedgerIds.has(ghConnectId)
    );
    if (hasGitHub) {
      const ghHandle = u.githubProfile?.displayUsername || u.githubProfile?.username || u.githubUsernameLower || 'github';
      addEvent({
        id: ghConnectId,
        amount: CLIENT_XP_VALUES.GITHUB_CONNECT,
        category: 'GITHUB',
        title: 'Connected GitHub Account',
        detail: `@${ghHandle}`,
        defaultTimestamp: normalizeTimestampToIso(
          u.githubSyncedAt || u.githubProfile?.lastSyncedAt,
          joinedIso
        ),
        isCredited: existingLedgerIds.has(ghConnectId),
      });
    }

    // 3. User's Projects (+100 First Project, +50 Submit, +50 Approved)
    const userProjects = projectsByAuthor.get(uid) || [];
    userProjects.sort((a, b) => {
      const ta = normalizeTimestampToIso(a.data.createdAt, joinedIso);
      const tb = normalizeTimestampToIso(b.data.createdAt, joinedIso);
      return ta.localeCompare(tb);
    });

    const firstProjId = `first_${uid}`;
    if (userProjects.length > 0 || existingLedgerIds.has(firstProjId)) {
      const firstProj = userProjects[0];
      addEvent({
        id: firstProjId,
        amount: CLIENT_XP_VALUES.FIRST_PROJECT,
        category: 'FIRST_PROJECT',
        title: 'First Project Milestone Bonus',
        detail: firstProj?.data?.title ? `Project: "${firstProj.data.title}"` : 'First showcase project',
        defaultTimestamp: normalizeTimestampToIso(firstProj?.data?.createdAt, joinedIso),
        isCredited: existingLedgerIds.has(firstProjId),
      });
    }

    for (const proj of userProjects) {
      const projCreatedIso = normalizeTimestampToIso(proj.data.createdAt, joinedIso);
      const submitId = `submit_${proj.id}`;
      addEvent({
        id: submitId,
        amount: CLIENT_XP_VALUES.SUBMIT_PROJECT,
        category: 'PROJECT_SUBMIT',
        title: 'Submitted Project',
        detail: proj.data.title || proj.id,
        defaultTimestamp: projCreatedIso,
        isCredited: existingLedgerIds.has(submitId),
      });

      const approveId = `approve_${proj.id}`;
      if (proj.data.approvalStatus === 'approved' || existingLedgerIds.has(approveId)) {
        addEvent({
          id: approveId,
          amount: CLIENT_XP_VALUES.PROJECT_APPROVED,
          category: 'PROJECT_APPROVE',
          title: 'Project Approved',
          detail: proj.data.title || proj.id,
          defaultTimestamp: normalizeTimestampToIso(proj.data.updatedAt || proj.data.createdAt, projCreatedIso),
          isCredited: existingLedgerIds.has(approveId),
        });
      }
    }

    // 4. User's Writings (+50 Submit, +50 Approved)
    const userWritings = writingsByAuthor.get(uid) || [];
    for (const w of userWritings) {
      const wCreatedIso = normalizeTimestampToIso(w.data.createdAt, joinedIso);
      const wSubmitId = `wsubmit_${w.id}`;
      const altSubmitId = `submit_writing_${w.id}`;
      const isSubmitCredited = existingLedgerIds.has(wSubmitId) || existingLedgerIds.has(altSubmitId);
      if (existingLedgerIds.has(altSubmitId)) handledIds.add(altSubmitId);

      addEvent({
        id: wSubmitId,
        amount: CLIENT_XP_VALUES.SUBMIT_PROJECT,
        category: 'WRITING_SUBMIT',
        title: 'Submitted Lit Club Writing',
        detail: w.data.title || w.id,
        defaultTimestamp: wCreatedIso,
        isCredited: isSubmitCredited,
      });

      const wApproveId = `wapprove_${w.id}`;
      const altApproveId = `approve_writing_${w.id}`;
      const isApproveCredited = existingLedgerIds.has(wApproveId) || existingLedgerIds.has(altApproveId);
      if (existingLedgerIds.has(altApproveId)) handledIds.add(altApproveId);

      if (w.data.approvalStatus === 'approved' || isApproveCredited) {
        addEvent({
          id: wApproveId,
          amount: CLIENT_XP_VALUES.PROJECT_APPROVED,
          category: 'WRITING_APPROVE',
          title: 'Lit Club Writing Approved',
          detail: w.data.title || w.id,
          defaultTimestamp: wCreatedIso,
          isCredited: isApproveCredited,
        });
      }
    }

    // 5. Completed Quests
    const completedQuests: string[] = Array.isArray(u.completedQuests) ? u.completedQuests : [];
    for (const qId of completedQuests) {
      const qLedgerId = `quest_${qId}_${uid}`;
      const amt =
        qId === 'quest_1_baby_steps'
          ? CLIENT_XP_VALUES.QUEST_1_BABY_STEPS
          : CLIENT_XP_VALUES.QUEST_2_SHELL_BASICS;
      const qTitle =
        qId === 'quest_1_baby_steps'
          ? 'Completed Quest 1: Baby Steps in Git'
          : 'Completed Quest 2: 0x00 Shell Basics';
      addEvent({
        id: qLedgerId,
        amount: amt,
        category: 'QUEST',
        title: qTitle,
        detail: qId,
        defaultTimestamp: joinedIso,
        isCredited: existingLedgerIds.has(qLedgerId),
      });
    }

    // 6. Any other recorded ledger IDs (Streaks, Active GitHub Days, Comments, Campaign, etc.)
    for (const lid of existingLedgerIds) {
      if (handledIds.has(lid)) continue;

      if (lid.startsWith(`streak_${uid}_`)) {
        const dateStr = lid.replace(`streak_${uid}_`, '');
        addEvent({
          id: lid,
          amount: CLIENT_XP_VALUES.LOGIN_STREAK,
          category: 'STREAK',
          title: '3-Day Login Streak Bonus',
          detail: `Streak milestone on ${dateStr}`,
          defaultTimestamp: `${dateStr}T12:00:00.000Z`,
          isCredited: true,
        });
      } else if (lid.startsWith(`github_${uid}_`)) {
        const dateStr = lid.replace(`github_${uid}_`, '');
        addEvent({
          id: lid,
          amount: CLIENT_XP_VALUES.GITHUB_ACTIVE_DAY,
          category: 'GITHUB',
          title: 'Active GitHub Coding Day',
          detail: `Public commits pushed on ${dateStr}`,
          defaultTimestamp: `${dateStr}T18:00:00.000Z`,
          isCredited: true,
        });
      } else if (lid.startsWith('cgive_')) {
        addEvent({
          id: lid,
          amount: CLIENT_XP_VALUES.LEAVE_COMMENT,
          category: 'ENGAGEMENT',
          title: 'Posted Project Comment',
          detail: lid,
          defaultTimestamp: joinedIso,
          isCredited: true,
        });
      } else if (lid.startsWith('campaign_approve_')) {
        addEvent({
          id: lid,
          amount: CLIENT_XP_VALUES.CAMPAIGN_SUBMISSION_APPROVED,
          category: 'PROJECT_APPROVE',
          title: 'Prayer Book Campaign Submission Approved',
          detail: lid,
          defaultTimestamp: joinedIso,
          isCredited: true,
        });
      } else if (lid.startsWith('vote_') || lid.startsWith('wvote_')) {
        // Outgoing vote marker on voter's profile (XP went to post author)
        handledIds.add(lid);
      } else if (lid.startsWith('submit_')) {
        const pid = lid.replace('submit_', '');
        const p = projectsById.get(pid);
        addEvent({
          id: lid,
          amount: CLIENT_XP_VALUES.SUBMIT_PROJECT,
          category: 'PROJECT_SUBMIT',
          title: 'Submitted Project',
          detail: p?.data?.title || pid,
          defaultTimestamp: joinedIso,
          isCredited: true,
        });
      } else if (lid.startsWith('approve_')) {
        const pid = lid.replace('approve_', '');
        const p = projectsById.get(pid);
        addEvent({
          id: lid,
          amount: CLIENT_XP_VALUES.PROJECT_APPROVED,
          category: 'PROJECT_APPROVE',
          title: 'Project Approved',
          detail: p?.data?.title || pid,
          defaultTimestamp: joinedIso,
          isCredited: true,
        });
      }
    }

    userEvents.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    const expectedMilestoneXp = userEvents.reduce((sum, ev) => sum + ev.amount, 0);
    const uncreditedEvents = userEvents.filter((ev) => ev.status === 'uncredited');
    const uncreditedEventsSum = uncreditedEvents.reduce((sum, ev) => sum + ev.amount, 0);
    const currentXp = typeof u.xp === 'number' ? u.xp : 0;
    const seasonXp = typeof u.seasonXp === 'number' ? u.seasonXp : 0;

    // If the user has uncredited events OR their currentXp is lower than expectedMilestoneXp,
    // calculate the exact XP needed so they are never short-changed or double-credited
    const uncreditedXp =
      uncreditedEvents.length > 0
        ? Math.max(expectedMilestoneXp - currentXp, uncreditedEventsSum)
        : Math.max(0, expectedMilestoneXp - currentXp);

    usersAudit.push({
      uid,
      displayName,
      email,
      photoURL,
      department,
      academicLevel,
      currentXp,
      seasonXp,
      expectedMilestoneXp,
      uncreditedXp,
      events: userEvents,
    });
  }

  allEvents.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'uncredited' ? -1 : 1;
    return b.timestamp.localeCompare(a.timestamp);
  });

  usersAudit.sort((a, b) => {
    if (b.uncreditedXp !== a.uncreditedXp) return b.uncreditedXp - a.uncreditedXp;
    if (b.currentXp !== a.currentXp) return b.currentXp - a.currentXp;
    return b.expectedMilestoneXp - a.expectedMilestoneXp;
  });

  return { users: usersAudit, allEvents };
}

/**
 * Admin action to reconcile and credit all missing XP & ledger history for a user.
 * Since `isAdmin()` has full update privileges on `/users/{userId}` in Firestore security rules,
 * this atomically credits any missing XP and records all ledger IDs and history entries.
 */
export async function adminReconcileUserXp(audit: AdminUserXpAudit): Promise<number> {
  const userRef = doc(db, 'users', audit.uid);
  let creditedDelta = 0;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) return;
    const data = snap.data() || {};
    const currentXp = typeof data.xp === 'number' ? data.xp : 0;
    const currentSeasonXp = typeof data.seasonXp === 'number' ? data.seasonXp : 0;

    const existingIds = new Set<string>(
      Array.isArray(data.xpLedgerIds) ? data.xpLedgerIds : []
    );

    const newIds: string[] = [];
    const newHistoryItems: Array<{ id: string; amount: number; createdAt: string }> = [];
    let uncreditedSum = 0;

    for (const ev of audit.events) {
      if (!existingIds.has(ev.id)) {
        newIds.push(ev.id);
        newHistoryItems.push({
          id: ev.id,
          amount: ev.amount,
          createdAt: ev.timestamp || new Date().toISOString(),
        });
        uncreditedSum += ev.amount;
      }
    }

    const targetXp = Math.max(currentXp + uncreditedSum, audit.expectedMilestoneXp);
    creditedDelta = Math.max(0, targetXp - currentXp);
    const targetSeasonXp = Math.max(currentSeasonXp + creditedDelta, targetXp);

    const updates: Record<string, any> = {};
    if (creditedDelta > 0) {
      updates.xp = targetXp;
      updates.seasonXp = targetSeasonXp;
    }
    if (newIds.length > 0) {
      updates.xpLedgerIds = arrayUnion(...newIds);
    }
    if (newHistoryItems.length > 0) {
      updates.xpHistory = arrayUnion(...newHistoryItems);
    }

    if (Object.keys(updates).length > 0) {
      tx.update(userRef, updates);
    }
  });

  return creditedDelta;
}

export async function adminReconcileAllUsersXp(
  audits: AdminUserXpAudit[]
): Promise<{ usersUpdated: number; totalXpCredited: number }> {
  let usersUpdated = 0;
  let totalXpCredited = 0;

  for (const audit of audits) {
    const hasUncreditedEvents = audit.events.some((e) => e.status === 'uncredited');
    if (audit.uncreditedXp > 0 || hasUncreditedEvents) {
      const added = await adminReconcileUserXp(audit);
      usersUpdated += 1;
      totalXpCredited += added;
    }
  }

  return { usersUpdated, totalXpCredited };
}

