import { getAdminApp, getAdminDb, getAdminAuth, verifyAuth } from './_lib/admin';
import { XP_VALUES, XP_LIMITS } from './_lib/xpRules';
import { getTodayString, readXpGrantState, applyXpGrantInTransaction, XpTransactionAccumulator } from './_lib/ledger';
import { fetchServerGitHubBundle } from './_lib/githubServer';
import { ACADEMIC_LEVELS } from '../shared/profileOptions';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let callerUid: string;
  let authResult: any;
  try {
    authResult = await verifyAuth(req);
    callerUid = authResult.uid;
  } catch (err: any) {
    return res.status(401).json({ error: err.message || 'Unauthorized' });
  }

  // Provider gate: only accounts with Google or GitHub linked are eligible to earn XP
  const identities = authResult.identities || {};
  const isAllowedProvider = Boolean(
    identities['google.com']?.length ||
    identities['github.com']?.length ||
    authResult.signInProvider === 'google.com' ||
    authResult.signInProvider === 'github.com'
  );

  if (!isAllowedProvider) {
    return res.status(403).json({
      error: 'Unverified provider. Only Google and GitHub accounts are eligible for platform interactions.',
      awarded: 0,
      reason: 'PROVIDER_NOT_ALLOWED',
    });
  }

  const db = getAdminDb();
  const today = getTodayString();
  const { type, projectId, writingId, targetType, targetId, commentId } = req.body || {};

  if (!type || typeof type !== 'string') {
    return res.status(400).json({ error: 'Event type is required.' });
  }

  try {
    switch (type) {
      // ─────────────────────────────────────────────────────────────
      // PROJECT_SUBMITTED
      // ─────────────────────────────────────────────────────────────
      case 'PROJECT_SUBMITTED': {
        if (!projectId || typeof projectId !== 'string') {
          return res.status(400).json({ error: 'projectId is required.' });
        }

        const projectRef = db.collection('projects').doc(projectId);
        const projectSnap = await projectRef.get();
        if (!projectSnap.exists) {
          return res.status(404).json({ error: 'Project not found.' });
        }

        const project = projectSnap.data() || {};
        if (project.authorUid !== callerUid) {
          return res.status(403).json({ error: 'Only the project author can report project submission.' });
        }

        // Check first project bonus
        const allUserProjects = await db.collection('projects').where('authorUid', '==', callerUid).get();
        const isFirstProject = allUserProjects.size === 1;

        let totalAwarded = 0;
        await db.runTransaction(async (tx) => {
          const submitRead = await readXpGrantState(
            tx,
            db,
            `submit_${projectId}`,
            callerUid,
            XP_VALUES.SUBMIT_PROJECT,
            today
          );

          let firstRead: any = null;
          if (isFirstProject) {
            firstRead = await readXpGrantState(
              tx,
              db,
              `first_${callerUid}`,
              callerUid,
              XP_VALUES.FIRST_PROJECT,
              today
            );
          }

          const acc = new XpTransactionAccumulator();
          const awardedSubmit = acc.addGrant(
            db,
            `submit_${projectId}`,
            callerUid,
            submitRead,
            'SUBMIT_PROJECT',
            today,
            { projectId }
          );

          let awardedFirst = 0;
          if (firstRead) {
            awardedFirst = acc.addGrant(
              db,
              `first_${callerUid}`,
              callerUid,
              firstRead,
              'FIRST_PROJECT',
              today,
              { projectId }
            );
          }

          acc.apply(tx, db);
          totalAwarded = awardedSubmit + awardedFirst;
        });

        return res.status(200).json({ success: true, awarded: totalAwarded });
      }

      // ─────────────────────────────────────────────────────────────
      // PROJECT_APPROVED
      // ─────────────────────────────────────────────────────────────
      case 'PROJECT_APPROVED': {
        if (!projectId || typeof projectId !== 'string') {
          return res.status(400).json({ error: 'projectId is required.' });
        }

        // Must be admin
        const callerDoc = await db.collection('users').doc(callerUid).get();
        if (!callerDoc.exists || callerDoc.data()?.isAdmin !== true) {
          return res.status(403).json({ error: 'Only administrators can award approval XP.' });
        }

        const projectRef = db.collection('projects').doc(projectId);
        const projectSnap = await projectRef.get();
        if (!projectSnap.exists) {
          return res.status(404).json({ error: 'Project not found.' });
        }

        const project = projectSnap.data() || {};
        const authorUid = project.authorUid;
        if (!authorUid) {
          return res.status(400).json({ error: 'Project has no authorUid.' });
        }

        let awarded = 0;
        await db.runTransaction(async (tx) => {
          const readState = await readXpGrantState(
            tx,
            db,
            `approve_${projectId}`,
            authorUid,
            XP_VALUES.PROJECT_APPROVED,
            today,
            true // Bypass daily cap for official admin approvals
          );

          const acc = new XpTransactionAccumulator();
          awarded = acc.addGrant(
            db,
            `approve_${projectId}`,
            authorUid,
            readState,
            'PROJECT_APPROVED',
            today,
            { projectId, approvedBy: callerUid }
          );
          acc.apply(tx, db);
        });

        return res.status(200).json({ success: true, awarded });
      }

      // ─────────────────────────────────────────────────────────────
      // VOTE_CAST
      // ─────────────────────────────────────────────────────────────
      case 'VOTE_CAST': {
        if (!projectId || typeof projectId !== 'string') {
          return res.status(400).json({ error: 'projectId is required.' });
        }

        const projectRef = db.collection('projects').doc(projectId);
        const projectSnap = await projectRef.get();
        if (!projectSnap.exists) {
          return res.status(404).json({ error: 'Project not found.' });
        }

        const project = projectSnap.data() || {};
        const authorUid = project.authorUid;
        if (!authorUid || authorUid === callerUid) {
          return res.status(200).json({ success: true, awarded: 0, reason: 'SELF_OR_NO_AUTHOR' });
        }

        // Verify the vote document exists in Firestore
        const voteRef = db.collection('votes').doc(`${callerUid}_${projectId}`);
        const voteSnap = await voteRef.get();
        if (!voteSnap.exists) {
          return res.status(400).json({ error: 'Vote record not found.' });
        }

        // Verify voter account age (>= 7 days)
        const voterDoc = await db.collection('users').doc(callerUid).get();
        const joinedAt = voterDoc.data()?.joinedAt;
        if (joinedAt) {
          const joinedMs = joinedAt.toDate ? joinedAt.toDate().getTime() : new Date(joinedAt).getTime();
          const ageDays = (Date.now() - joinedMs) / (1000 * 60 * 60 * 24);
          if (ageDays < XP_LIMITS.MIN_ACCOUNT_AGE_DAYS) {
            return res.status(200).json({ success: true, awarded: 0, reason: 'ACCOUNT_TOO_NEW' });
          }
        }

        // Verify minimum votes threshold (3 likes)
        const likes = project.likes || 0;
        if (likes < XP_LIMITS.MIN_VOTES_FOR_XP) {
          return res.status(200).json({ success: true, awarded: 0, reason: 'MIN_VOTES_NOT_REACHED' });
        }

        const voteLedgerId = `vote_${callerUid}_${projectId}`;
        let awardedVote = 0;
        let awardedMilestones = 0;

        await db.runTransaction(async (tx) => {
          // Pre-reads
          const voteRead = await readXpGrantState(
            tx,
            db,
            voteLedgerId,
            authorUid,
            XP_VALUES.RECEIVE_VOTE,
            today
          );

          // Check milestones
          const currentAwarded: number[] = project.xpMilestonesAwarded || [];
          const m10Eligible = likes >= 10 && !currentAwarded.includes(10);
          const m50Eligible = likes >= 50 && !currentAwarded.includes(50);

          let m10Read: any = null;
          let m50Read: any = null;
          if (m10Eligible) {
            m10Read = await readXpGrantState(
              tx,
              db,
              `milestone_${projectId}_10`,
              authorUid,
              XP_VALUES.VOTE_MILESTONE_10,
              today
            );
          }
          if (m50Eligible) {
            m50Read = await readXpGrantState(
              tx,
              db,
              `milestone_${projectId}_50`,
              authorUid,
              XP_VALUES.VOTE_MILESTONE_50,
              today
            );
          }

          // Writes
          const acc = new XpTransactionAccumulator();
          awardedVote = acc.addGrant(
            db,
            voteLedgerId,
            authorUid,
            voteRead,
            'RECEIVE_VOTE',
            today,
            { projectId, voterUid: callerUid }
          );

          const updatedMilestones = [...currentAwarded];
          if (m10Read) {
            const m10Awarded = acc.addGrant(
              db,
              `milestone_${projectId}_10`,
              authorUid,
              m10Read,
              'VOTE_MILESTONE_10',
              today,
              { projectId }
            );
            if (m10Awarded > 0) {
              awardedMilestones += m10Awarded;
              updatedMilestones.push(10);
            }
          }
          if (m50Read) {
            const m50Awarded = acc.addGrant(
              db,
              `milestone_${projectId}_50`,
              authorUid,
              m50Read,
              'VOTE_MILESTONE_50',
              today,
              { projectId }
            );
            if (m50Awarded > 0) {
              awardedMilestones += m50Awarded;
              updatedMilestones.push(50);
            }
          }

          acc.apply(tx, db);

          if (updatedMilestones.length > currentAwarded.length) {
            tx.update(projectRef, { xpMilestonesAwarded: updatedMilestones });
          }
        });

        return res.status(200).json({ success: true, awarded: awardedVote + awardedMilestones });
      }

      // ─────────────────────────────────────────────────────────────
      // COMMENT_POSTED
      // ─────────────────────────────────────────────────────────────
      case 'COMMENT_POSTED': {
        const collectionName = targetType === 'writing' ? 'writings' : 'projects';
        const docId = targetId || projectId;
        if (!docId || !commentId) {
          return res.status(400).json({ error: 'targetId (or projectId) and commentId are required.' });
        }

        const targetRef = db.collection(collectionName).doc(docId);
        const targetSnap = await targetRef.get();
        if (!targetSnap.exists) {
          return res.status(404).json({ error: 'Target post not found.' });
        }

        const targetData = targetSnap.data() || {};
        const comments = targetData.comments || [];
        const foundComment = comments.find((c: any) => c.id === commentId);
        if (!foundComment || foundComment.authorUid !== callerUid) {
          return res.status(400).json({ error: 'Valid comment authored by caller not found.' });
        }

        // Verify minimum votes threshold (3 likes)
        if ((targetData.likes || 0) < XP_LIMITS.MIN_VOTES_FOR_XP) {
          return res.status(200).json({ success: true, awarded: 0, reason: 'MIN_VOTES_NOT_REACHED' });
        }

        // Verify commenter account age (>= 7 days)
        const commenterDoc = await db.collection('users').doc(callerUid).get();
        const joinedAt = commenterDoc.data()?.joinedAt;
        if (joinedAt) {
          const joinedMs = joinedAt.toDate ? joinedAt.toDate().getTime() : new Date(joinedAt).getTime();
          const ageDays = (Date.now() - joinedMs) / (1000 * 60 * 60 * 24);
          if (ageDays < XP_LIMITS.MIN_ACCOUNT_AGE_DAYS) {
            return res.status(200).json({ success: true, awarded: 0, reason: 'ACCOUNT_TOO_NEW' });
          }
        }

        const authorUid = targetData.authorUid;
        const commenterLedgerId = `cgive_${docId}_${commentId}`;
        const authorLedgerId = `crecv_${docId}_${commentId}`;

        let totalAwarded = 0;
        await db.runTransaction(async (tx) => {
          // Pre-reads
          const commenterRead = await readXpGrantState(
            tx,
            db,
            commenterLedgerId,
            callerUid,
            XP_VALUES.LEAVE_COMMENT,
            today
          );

          let authorRead: any = null;
          if (authorUid && authorUid !== callerUid) {
            authorRead = await readXpGrantState(
              tx,
              db,
              authorLedgerId,
              authorUid,
              XP_VALUES.RECEIVE_COMMENT,
              today
            );
          }

          // Check commenter's daily comment cap
          const commenterData = commenterDoc.data() || {};
          const commentXpToday = commenterData.lastCommentXpDate === today ? (commenterData.commentXpToday || 0) : 0;
          let awardableCommenter = 0;
          if (commentXpToday < XP_LIMITS.COMMENT_XP_DAILY_CAP) {
            awardableCommenter = Math.min(
              commenterRead.grantAmount,
              XP_LIMITS.COMMENT_XP_DAILY_CAP - commentXpToday
            );
          }

          // Writes
          const acc = new XpTransactionAccumulator();

          if (awardableCommenter > 0) {
            commenterRead.grantAmount = awardableCommenter;
            const awardedCommenter = acc.addGrant(
              db,
              commenterLedgerId,
              callerUid,
              commenterRead,
              'LEAVE_COMMENT',
              today,
              { targetId: docId, commentId }
            );
            if (awardedCommenter > 0) {
              totalAwarded += awardedCommenter;
              acc.setUserExtraFields(callerUid, {
                commentXpToday: commentXpToday + awardedCommenter,
                lastCommentXpDate: today,
              });
            }
          }

          if (authorRead) {
            const awardedAuthor = acc.addGrant(
              db,
              authorLedgerId,
              authorUid,
              authorRead,
              'RECEIVE_COMMENT',
              today,
              { targetId: docId, commentId, commenterUid: callerUid }
            );
            totalAwarded += awardedAuthor;
          }

          acc.apply(tx, db);
        });

        return res.status(200).json({ success: true, awarded: totalAwarded });
      }

      // ─────────────────────────────────────────────────────────────
      // WRITING_SUBMITTED
      // ─────────────────────────────────────────────────────────────
      case 'WRITING_SUBMITTED': {
        if (!writingId || typeof writingId !== 'string') {
          return res.status(400).json({ error: 'writingId is required.' });
        }

        const writingRef = db.collection('writings').doc(writingId);
        const writingSnap = await writingRef.get();
        if (!writingSnap.exists) {
          return res.status(404).json({ error: 'Writing not found.' });
        }

        const writing = writingSnap.data() || {};
        if (writing.authorUid !== callerUid) {
          return res.status(403).json({ error: 'Only the writing author can report submission.' });
        }

        let totalAwarded = 0;
        await db.runTransaction(async (tx) => {
          const submitRead = await readXpGrantState(
            tx,
            db,
            `wsubmit_${writingId}`,
            callerUid,
            XP_VALUES.SUBMIT_PROJECT,
            today
          );

          const acc = new XpTransactionAccumulator();
          totalAwarded = acc.addGrant(
            db,
            `wsubmit_${writingId}`,
            callerUid,
            submitRead,
            'SUBMIT_PROJECT',
            today,
            { writingId }
          );
          acc.apply(tx, db);
        });

        return res.status(200).json({ success: true, awarded: totalAwarded });
      }

      // ─────────────────────────────────────────────────────────────
      // WRITING_APPROVED
      // ─────────────────────────────────────────────────────────────
      case 'WRITING_APPROVED': {
        if (!writingId || typeof writingId !== 'string') {
          return res.status(400).json({ error: 'writingId is required.' });
        }

        const callerDoc = await db.collection('users').doc(callerUid).get();
        if (!callerDoc.exists || callerDoc.data()?.isAdmin !== true) {
          return res.status(403).json({ error: 'Only administrators can award approval XP.' });
        }

        const writingRef = db.collection('writings').doc(writingId);
        const writingSnap = await writingRef.get();
        if (!writingSnap.exists) {
          return res.status(404).json({ error: 'Writing not found.' });
        }

        const writing = writingSnap.data() || {};
        const authorUid = writing.authorUid;
        if (!authorUid) {
          return res.status(400).json({ error: 'Writing has no authorUid.' });
        }

        let awarded = 0;
        await db.runTransaction(async (tx) => {
          const readState = await readXpGrantState(
            tx,
            db,
            `wapprove_${writingId}`,
            authorUid,
            XP_VALUES.PROJECT_APPROVED,
            today,
            true
          );

          const acc = new XpTransactionAccumulator();
          awarded = acc.addGrant(
            db,
            `wapprove_${writingId}`,
            authorUid,
            readState,
            'PROJECT_APPROVED',
            today,
            { writingId, approvedBy: callerUid }
          );
          acc.apply(tx, db);
        });

        return res.status(200).json({ success: true, awarded });
      }

      // ─────────────────────────────────────────────────────────────
      // WRITING_VOTE_CAST
      // ─────────────────────────────────────────────────────────────
      case 'WRITING_VOTE_CAST': {
        if (!writingId || typeof writingId !== 'string') {
          return res.status(400).json({ error: 'writingId is required.' });
        }

        const writingRef = db.collection('writings').doc(writingId);
        const writingSnap = await writingRef.get();
        if (!writingSnap.exists) {
          return res.status(404).json({ error: 'Writing not found.' });
        }

        const writing = writingSnap.data() || {};
        const authorUid = writing.authorUid;
        if (!authorUid || authorUid === callerUid) {
          return res.status(200).json({ success: true, awarded: 0, reason: 'SELF_OR_NO_AUTHOR' });
        }

        const voteRef = db.collection('litVotes').doc(`${callerUid}_${writingId}`);
        const voteSnap = await voteRef.get();
        if (!voteSnap.exists) {
          return res.status(400).json({ error: 'Lit vote record not found.' });
        }

        const voterDoc = await db.collection('users').doc(callerUid).get();
        const joinedAt = voterDoc.data()?.joinedAt;
        if (joinedAt) {
          const joinedMs = joinedAt.toDate ? joinedAt.toDate().getTime() : new Date(joinedAt).getTime();
          const ageDays = (Date.now() - joinedMs) / (1000 * 60 * 60 * 24);
          if (ageDays < XP_LIMITS.MIN_ACCOUNT_AGE_DAYS) {
            return res.status(200).json({ success: true, awarded: 0, reason: 'ACCOUNT_TOO_NEW' });
          }
        }

        if ((writing.likes || 0) < XP_LIMITS.MIN_VOTES_FOR_XP) {
          return res.status(200).json({ success: true, awarded: 0, reason: 'MIN_VOTES_NOT_REACHED' });
        }

        const voteLedgerId = `wvote_${callerUid}_${writingId}`;
        let awardedVote = 0;
        await db.runTransaction(async (tx) => {
          const voteRead = await readXpGrantState(
            tx,
            db,
            voteLedgerId,
            authorUid,
            XP_VALUES.RECEIVE_VOTE,
            today
          );

          const acc = new XpTransactionAccumulator();
          awardedVote = acc.addGrant(
            db,
            voteLedgerId,
            authorUid,
            voteRead,
            'RECEIVE_VOTE',
            today,
            { writingId, voterUid: callerUid }
          );
          acc.apply(tx, db);
        });

        return res.status(200).json({ success: true, awarded: awardedVote });
      }

      // ─────────────────────────────────────────────────────────────
      // DAILY_LOGIN
      // ─────────────────────────────────────────────────────────────
      case 'DAILY_LOGIN': {
        const userRef = db.collection('users').doc(callerUid);
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        let awarded = 0;
        let finalStreak = 1;

        await db.runTransaction(async (tx) => {
          const userSnap = await tx.get(userRef);
          if (!userSnap.exists) return;

          const data = userSnap.data() || {};
          if (data.lastLoginDate === today) {
            finalStreak = data.streakDays || 1;
            return; // Already logged in today
          }

          let newStreak = 1;
          if (data.lastLoginDate === yesterday) {
            newStreak = (data.streakDays || 1) + 1;
          }
          finalStreak = newStreak;

          const streakLedgerId = `streak_${callerUid}_${today}`;
          let streakRead: any = null;
          if (newStreak % 3 === 0) {
            streakRead = await readXpGrantState(
              tx,
              db,
              streakLedgerId,
              callerUid,
              XP_VALUES.LOGIN_STREAK,
              today
            );
          }

          // Writes
          const acc = new XpTransactionAccumulator();
          if (streakRead) {
            awarded = acc.addGrant(
              db,
              streakLedgerId,
              callerUid,
              streakRead,
              'LOGIN_STREAK',
              today,
              { streakDays: newStreak }
            );
          }

          acc.setUserExtraFields(callerUid, {
            lastLoginDate: today,
            streakDays: newStreak,
          });

          acc.apply(tx, db);
        });

        return res.status(200).json({ success: true, awarded, streakDays: finalStreak });
      }

      // ─────────────────────────────────────────────────────────────
      // GITHUB_SYNC
      // ─────────────────────────────────────────────────────────────
      case 'GITHUB_SYNC': {
        const userRef = db.collection('users').doc(callerUid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
          return res.status(404).json({ error: 'User profile not found.' });
        }

        const userData = userSnap.data() || {};

        // 1. Resolve verified GitHub identity from Firebase Auth
        let ghNumericId: string | undefined;
        let ghUsername: string | undefined;

        try {
          const authUser = await getAdminAuth().getUser(callerUid);
          const ghProvider = authUser.providerData.find((p) => p.providerId === 'github.com');
          if (ghProvider) {
            ghNumericId = ghProvider.uid;
            ghUsername = ghProvider.displayName || undefined;
          }
        } catch (authErr) {
          console.warn('Could not inspect Firebase Auth providerData:', authErr);
        }

        if (!ghNumericId && !userData.githubProfile?.githubId && !userData.githubProfile?.username) {
          return res.status(400).json({
            error: 'No verified GitHub account linked to your profile. Please connect GitHub first.',
          });
        }

        // 2. Sync throttle: at most once every 60 minutes
        const lastSynced = userData.githubSyncedAt;
        if (lastSynced) {
          const lastSyncedMs = lastSynced.toDate ? lastSynced.toDate().getTime() : new Date(lastSynced).getTime();
          const oneHourAgo = Date.now() - 60 * 60 * 1000;
          if (lastSyncedMs > oneHourAgo) {
            return res.status(200).json({
              success: true,
              awarded: 0,
              profile: userData.githubProfile,
              reason: 'SYNC_RATE_LIMITED',
            });
          }
        }

        // 3. Fetch fresh bundle on the server using verified identity
        const freshProfile = await fetchServerGitHubBundle({
          githubNumericId: ghNumericId || (userData.githubProfile?.githubId ? String(userData.githubProfile.githubId) : undefined),
          knownUsername: ghUsername || userData.githubProfile?.displayUsername || userData.githubProfile?.username,
          previousRewardedDate: userData.lastRewardedCodingDate,
        });

        // 4. Calculate eligible coding XP
        const activeDate = freshProfile.lastActiveDate;
        const lastRewarded = userData.lastRewardedCodingDate;
        let eligibleForXp = false;

        if (activeDate) {
          const activeMs = new Date(activeDate).getTime();
          const sevenDaysAgo = Date.now() - 7 * 86400000;
          if (activeMs >= sevenDaysAgo && (!lastRewarded || activeDate > lastRewarded)) {
            eligibleForXp = true;
          }
        }

        const ledgerId = activeDate ? `github_${callerUid}_${activeDate}` : `github_${callerUid}_noop`;
        let awarded = 0;

        await db.runTransaction(async (tx) => {
          let readState: any = null;
          if (eligibleForXp && activeDate) {
            readState = await readXpGrantState(
              tx,
              db,
              ledgerId,
              callerUid,
              XP_VALUES.GITHUB_ACTIVE_DAY,
              today
            );
          }

          // Writes
          const acc = new XpTransactionAccumulator();
          if (readState) {
            awarded = acc.addGrant(
              db,
              ledgerId,
              callerUid,
              readState,
              'GITHUB_ACTIVE_DAY',
              today,
              { activeDate }
            );
          }

          const updatePayload: Record<string, any> = {
            githubProfile: freshProfile,
            githubUsernameLower: freshProfile.username.toLowerCase(),
            githubSyncedAt: FieldValue.serverTimestamp(),
          };

          if (awarded > 0 && activeDate) {
            updatePayload.lastRewardedCodingDate = activeDate;
            freshProfile.lastRewardedCodingDate = activeDate;
            updatePayload.githubProfile = freshProfile;
          }

          acc.setUserExtraFields(callerUid, updatePayload);
          acc.apply(tx, db);
        });

        return res.status(200).json({ success: true, awarded, profile: freshProfile });
      }

      // ─────────────────────────────────────────────────────────────
      // ONBOARDING_COMPLETED
      // ─────────────────────────────────────────────────────────────
      case 'ONBOARDING_COMPLETED': {
        const { displayName, department, academicLevel, interests } = req.body || {};

        if (!displayName || typeof displayName !== 'string' || displayName.trim().length < 2 || displayName.trim().length > 40) {
          return res.status(400).json({ error: 'Display name must be between 2 and 40 characters.' });
        }

        if (!department || typeof department !== 'string' || department.trim().length < 2 || department.trim().length > 60) {
          return res.status(400).json({ error: 'Department must be between 2 and 60 characters.' });
        }

        if (!academicLevel || !ACADEMIC_LEVELS.includes(academicLevel as any)) {
          return res.status(400).json({ error: 'Valid Academic Level is required.' });
        }

        const userRef = db.collection('users').doc(callerUid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
          return res.status(404).json({ error: 'User profile not found.' });
        }

        const userData = userSnap.data() || {};
        if (userData.onboardingCompletedAt) {
          const completedAtIso = userData.onboardingCompletedAt?.toDate
            ? userData.onboardingCompletedAt.toDate().toISOString()
            : typeof userData.onboardingCompletedAt === 'string'
            ? userData.onboardingCompletedAt
            : new Date().toISOString();

          return res.status(200).json({
            success: true,
            awarded: 0,
            reason: 'ALREADY_COMPLETED',
            onboardingCompletedAt: completedAtIso,
          });
        }

        const ledgerId = `onboarding_${callerUid}`;
        let awarded = 0;

        await db.runTransaction(async (tx) => {
          const readState = await readXpGrantState(
            tx,
            db,
            ledgerId,
            callerUid,
            XP_VALUES.ONBOARDING_COMPLETE,
            today,
            true // Official onboarding setup bonus bypasses daily cap
          );

          const acc = new XpTransactionAccumulator();
          awarded = acc.addGrant(
            db,
            ledgerId,
            callerUid,
            readState,
            'ONBOARDING_COMPLETE',
            today
          );

          const sanitizedInterests = Array.isArray(interests)
            ? interests.filter((i) => typeof i === 'string').slice(0, 5)
            : [];

          acc.setUserExtraFields(callerUid, {
            displayName: displayName.trim(),
            department: department.trim(),
            academicLevel,
            interests: sanitizedInterests,
            onboardingCompletedAt: FieldValue.serverTimestamp(),
          });

          acc.apply(tx, db);
        });

        return res.status(200).json({
          success: true,
          awarded,
          onboardingCompletedAt: new Date().toISOString(),
        });
      }

      // ─────────────────────────────────────────────────────────────
      // ONBOARDING_SKIPPED
      // ─────────────────────────────────────────────────────────────
      case 'ONBOARDING_SKIPPED': {
        const userRef = db.collection('users').doc(callerUid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
          return res.status(404).json({ error: 'User profile not found.' });
        }

        const updates: Record<string, any> = {
          onboardingCompletedAt: FieldValue.serverTimestamp(),
        };
        const { displayName, department, academicLevel, interests } = req.body || {};
        if (typeof displayName === 'string' && displayName.trim().length >= 2) {
          updates.displayName = displayName.trim();
        }
        if (typeof department === 'string' && department.trim().length >= 2) {
          updates.department = department.trim();
        }
        if (typeof academicLevel === 'string' && ACADEMIC_LEVELS.includes(academicLevel as any)) {
          updates.academicLevel = academicLevel;
        }
        if (Array.isArray(interests)) {
          updates.interests = interests.filter((i: any) => typeof i === 'string').slice(0, 5);
        }

        await userRef.update(updates);
        return res.status(200).json({
          success: true,
          awarded: 0,
          onboardingCompletedAt: new Date().toISOString(),
        });
      }

      default:
        return res.status(400).json({ error: `Unknown event type: ${type}` });
    }
  } catch (err: any) {
    console.error('XP Event processing error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error while processing XP event.' });
  }
}
