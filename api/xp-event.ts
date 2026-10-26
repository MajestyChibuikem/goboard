import { getAdminDb, verifyAuth } from './_lib/admin';
import { XP_VALUES, XP_LIMITS } from './_lib/xpRules';
import { getTodayString, readXpGrantState, applyXpGrantInTransaction } from './_lib/ledger';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let callerUid: string;
  try {
    const authResult = await verifyAuth(req);
    callerUid = authResult.uid;
  } catch (err: any) {
    return res.status(401).json({ error: err.message || 'Unauthorized' });
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

          const awardedSubmit = applyXpGrantInTransaction(
            tx,
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
            awardedFirst = applyXpGrantInTransaction(
              tx,
              db,
              `first_${callerUid}`,
              callerUid,
              firstRead,
              'FIRST_PROJECT',
              today,
              { projectId }
            );
          }

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

          awarded = applyXpGrantInTransaction(
            tx,
            db,
            `approve_${projectId}`,
            authorUid,
            readState,
            'PROJECT_APPROVED',
            today,
            { projectId, approvedBy: callerUid }
          );
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
          awardedVote = applyXpGrantInTransaction(
            tx,
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
            const m10Awarded = applyXpGrantInTransaction(
              tx,
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
            const m50Awarded = applyXpGrantInTransaction(
              tx,
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
          if (awardableCommenter > 0) {
            commenterRead.grantAmount = awardableCommenter;
            const awardedCommenter = applyXpGrantInTransaction(
              tx,
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
              tx.update(db.collection('users').doc(callerUid), {
                commentXpToday: commentXpToday + awardedCommenter,
                lastCommentXpDate: today,
              });
            }
          }

          if (authorRead) {
            const awardedAuthor = applyXpGrantInTransaction(
              tx,
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

          totalAwarded = applyXpGrantInTransaction(
            tx,
            db,
            `wsubmit_${writingId}`,
            callerUid,
            submitRead,
            'SUBMIT_PROJECT',
            today,
            { writingId }
          );
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

          awarded = applyXpGrantInTransaction(
            tx,
            db,
            `wapprove_${writingId}`,
            authorUid,
            readState,
            'PROJECT_APPROVED',
            today,
            { writingId, approvedBy: callerUid }
          );
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

          awardedVote = applyXpGrantInTransaction(
            tx,
            db,
            voteLedgerId,
            authorUid,
            voteRead,
            'RECEIVE_VOTE',
            today,
            { writingId, voterUid: callerUid }
          );
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
          tx.update(userRef, {
            lastLoginDate: today,
            streakDays: newStreak,
          });

          if (streakRead) {
            awarded = applyXpGrantInTransaction(
              tx,
              db,
              streakLedgerId,
              callerUid,
              streakRead,
              'LOGIN_STREAK',
              today,
              { streakDays: newStreak }
            );
          }
        });

        return res.status(200).json({ success: true, awarded, streakDays: finalStreak });
      }

      // ─────────────────────────────────────────────────────────────
      // GITHUB_SYNC
      // ─────────────────────────────────────────────────────────────
      case 'GITHUB_SYNC': {
        const userRef = db.collection('users').doc(callerUid);
        let awarded = 0;

        await db.runTransaction(async (tx) => {
          const userSnap = await tx.get(userRef);
          if (!userSnap.exists) return;

          const data = userSnap.data() || {};
          const githubProfile = data.githubProfile;
          if (!githubProfile?.lastActiveDate) return;

          const activeDate = githubProfile.lastActiveDate;
          const activeMs = new Date(activeDate).getTime();
          const sevenDaysAgo = Date.now() - 7 * 86400000;
          const lastRewarded = data.lastRewardedCodingDate;

          if (activeMs < sevenDaysAgo) return;
          if (lastRewarded && activeDate <= lastRewarded) return;

          const ledgerId = `github_${callerUid}_${activeDate}`;
          const readState = await readXpGrantState(
            tx,
            db,
            ledgerId,
            callerUid,
            XP_VALUES.GITHUB_ACTIVE_DAY,
            today
          );

          awarded = applyXpGrantInTransaction(
            tx,
            db,
            ledgerId,
            callerUid,
            readState,
            'GITHUB_ACTIVE_DAY',
            today,
            { activeDate }
          );

          if (awarded > 0) {
            tx.update(userRef, {
              lastRewardedCodingDate: activeDate,
              'githubProfile.lastRewardedCodingDate': activeDate,
            });
          }
        });

        return res.status(200).json({ success: true, awarded });
      }

      default:
        return res.status(400).json({ error: `Unknown event type: ${type}` });
    }
  } catch (err: any) {
    console.error('XP Event processing error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error while processing XP event.' });
  }
}
