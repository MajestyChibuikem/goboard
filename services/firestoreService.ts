import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  increment,
  serverTimestamp,
  Timestamp,
  writeBatch,
  arrayUnion,
  runTransaction,
  setDoc,
  limit,
} from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth } from './firebase';
import {
  Project,
  Comment,
  ProjectUpdate,
  ProjectStatus,
  Notification,
  BoardNotice,
  Writing,
  WritingGenre,
  CampaignConfig,
  ExamPaperSubmission,
  CourseBountySummary,
  StudentVerificationStatus,
  BankDetails,
  PayoutRecord,
} from '../types';
import { generateSlug, cleanOldFirebaseUrl } from './utils';

// ─── Collection refs ───

const projectsCol = collection(db, 'projects');
const usersCol = collection(db, 'users');
const votesCol = collection(db, 'votes');
const examPapersCol = collection(db, 'examPapers');
const courseBountiesCol = collection(db, 'courseBounties');
const payoutsCol = collection(db, 'payouts');
const campaignConfigDoc = doc(db, 'settings', 'campaignConfig');

// ─── Helpers ───

function tsToISO(ts: any): string {
  if (!ts) return new Date().toISOString();
  if (ts.toDate) return ts.toDate().toISOString();
  return new Date(ts).toISOString();
}

function projectFromDoc(docSnap: any): Project {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    slug: d.slug,
    title: d.title || '',
    description: d.description || '',
    studentName: d.studentName || '',
    displayName: d.displayName || d.studentName || '',
    level: d.level || '',
    category: d.category || 'Web Development',
    techStack: d.techStack || [],
    imageUrl: cleanOldFirebaseUrl(d.imageUrl) || '',
    screenshots: (d.screenshots || []).map(cleanOldFirebaseUrl).filter(Boolean) as string[],
    likes: d.likes || 0,
    demoUrl: d.demoUrl || undefined,
    repoUrl: d.repoUrl || undefined,
    websiteUrl: d.websiteUrl || undefined,
    datePosted: tsToISO(d.datePosted),
    comments: d.comments || [],
    status: d.status || 'idea',
    updates: d.updates || [],
    // Firestore-specific fields passed through
    ...(d.authorUid && { authorUid: d.authorUid }),
    ...(d.approvalStatus && { approvalStatus: d.approvalStatus }),
    ...(d.isSuspended && { isSuspended: d.isSuspended }),
    ...(d.suspendedBy && { suspendedBy: d.suspendedBy }),
    ...(d.suspendedAt && { suspendedAt: d.suspendedAt }),
    ...(d.suspensionReason && { suspensionReason: d.suspensionReason }),
  } as Project & { authorUid?: string; approvalStatus?: string };
}

export async function getProjectById(projectId: string): Promise<Project | null> {
  try {
    const snap = await getDoc(doc(projectsCol, projectId));
    if (!snap.exists()) return null;
    return projectFromDoc(snap);
  } catch (err) {
    console.warn('getProjectById failed or access denied:', err);
    return null;
  }
}

export async function getProjectBySlugOrId(slugOrId: string): Promise<Project | null> {
  try {
    // First, try to find by slug
    const q = query(projectsCol, where('slug', '==', slugOrId), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return projectFromDoc(snap.docs[0]);
    }

    // Fallback to fetch by ID for older projects
    return await getProjectById(slugOrId);
  } catch (err) {
    console.warn('getProjectBySlugOrId failed or access denied:', err);
    return null;
  }
}

// ─── Projects ───

export function subscribeToProjects(
  callback: (projects: Project[]) => void,
  approvalFilter: 'approved' | 'pending' | 'all' = 'approved',
  isAdmin: boolean = false,
  userId?: string
) {
  let q;
  if (approvalFilter === 'all') {
    q = query(projectsCol, orderBy('datePosted', 'desc'));
  } else {
    q = query(
      projectsCol,
      where('approvalStatus', '==', approvalFilter),
      orderBy('datePosted', 'desc')
    );
  }

  return onSnapshot(q, (snapshot) => {
    let projects = snapshot.docs.map(projectFromDoc);

    // Filter out suspended projects unless user is admin or author
    if (!isAdmin) {
      projects = projects.filter(p => !p.isSuspended || (userId && p.authorUid === userId));
    }

    callback(projects);
  });
}

export async function isProjectTitleTaken(title: string): Promise<boolean> {
  const normalised = title.trim().toLowerCase();
  const q = query(projectsCol, where('titleLower', '==', normalised));
  const snap = await getDocs(q);
  return !snap.empty;
}

export async function createProject(
  data: Omit<Project, 'id' | 'likes' | 'datePosted' | 'comments' | 'screenshots' | 'updates'>,
  authorUid: string
) {
  // Enforce case-insensitive unique title
  const taken = await isProjectTitleTaken(data.title);
  if (taken) {
    throw new Error('A project with this name already exists. Please choose a different title.');
  }

  let baseSlug = generateSlug(data.title);
  if (!baseSlug) {
    baseSlug = 'project';
  }

  let slug = baseSlug;
  let counter = 1;
  while (true) {
    const slugQuery = query(projectsCol, where('slug', '==', slug), limit(1));
    const slugSnap = await getDocs(slugQuery);
    if (slugSnap.empty) break;
    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }

  const docRef = await addDoc(projectsCol, {
    ...data,
    slug,
    titleLower: data.title.trim().toLowerCase(),
    likes: 0,
    datePosted: serverTimestamp(),
    comments: [],
    screenshots: [],
    status: data.status || 'idea',
    updates: [],
    authorUid,
    approvalStatus: 'pending',
    xpMilestonesAwarded: [],
  });

  // Award submission XP + check first project bonus
  await awardXP(authorUid, XP_VALUES.SUBMIT_PROJECT, 'SUBMIT_PROJECT');
  await checkFirstProjectBonus(authorUid);

  return docRef.id;
}

export async function updateProjectField(projectId: string, fields: Partial<Record<string, any>>) {
  const ref = doc(db, 'projects', projectId);
  await updateDoc(ref, fields);
}

// ─── User Profile Management ───

export async function updateDisplayName(userId: string, newName: string) {
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) throw new Error('User not found');

  const data = snap.data();
  if (data.hasEditedDisplayName === true) {
    throw new Error('You can only edit your display name once');
  }

  // Update Firestore user doc
  await updateDoc(userRef, {
    displayName: newName.trim(),
    hasEditedDisplayName: true,
    displayNameEditedAt: new Date().toISOString(),
  });

  // Update Firebase Auth user profile
  const currentUser = auth.currentUser;
  if (currentUser) {
    await updateProfile(currentUser, { displayName: newName.trim() });
  }
}

export async function canPostUpdate(projectId: string, userId: string): Promise<boolean> {
  const projectRef = doc(db, 'projects', projectId);
  const projectSnap = await getDoc(projectRef);
  if (!projectSnap.exists()) return false;

  const projectData = projectSnap.data();
  if (projectData.authorUid === userId) return true;

  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return false;

  return userSnap.data().isAdmin === true;
}

export async function deleteProject(projectId: string, userId: string) {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists() || !userSnap.data().isAdmin) {
    throw new Error('Only admins can delete projects');
  }

  // Delete project document
  await deleteDoc(doc(db, 'projects', projectId));

  // Delete all votes for this project
  const votesQuery = query(votesCol, where('projectId', '==', projectId));
  const votesSnap = await getDocs(votesQuery);
  const batch = writeBatch(db);
  votesSnap.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
}

export async function resetDatabase() {
  console.warn('⚠️  RESETTING DATABASE: Deleting all projects, votes, and comments...');

  // Delete all projects
  const projectsSnap = await getDocs(projectsCol);
  let batch = writeBatch(db);
  projectsSnap.docs.forEach((doc, idx) => {
    if (idx > 0 && idx % 500 === 0) {
      batch.commit();
      batch = writeBatch(db);
    }
    batch.delete(doc.ref);
  });
  await batch.commit();

  // Delete all votes
  const votesSnap = await getDocs(votesCol);
  batch = writeBatch(db);
  votesSnap.docs.forEach((doc, idx) => {
    if (idx > 0 && idx % 500 === 0) {
      batch.commit();
      batch = writeBatch(db);
    }
    batch.delete(doc.ref);
  });
  await batch.commit();

  console.log('✓ Database reset complete. Users collection preserved.');
}

// ─── Voting ───

export async function toggleVote(
  projectId: string,
  userId: string,
  authorUid?: string
): Promise<boolean> {
  const voteId = `${userId}_${projectId}`;
  const voteRef = doc(db, 'votes', voteId);
  const projectRef = doc(db, 'projects', projectId);

  const voteSnap = await getDoc(voteRef);

  const batch = writeBatch(db);

  if (voteSnap.exists()) {
    // Already voted — remove vote
    batch.delete(voteRef);
    batch.update(projectRef, { likes: increment(-1) });
    await batch.commit();
    return false;
  } else {
    // New vote
    batch.set(voteRef, {
      userId,
      projectId,
      createdAt: serverTimestamp(),
    });
    batch.update(projectRef, { likes: increment(1) });
    await batch.commit();

    // Award XP to project author (async, non-blocking)
    if (authorUid && authorUid !== userId) {
      awardVoteXP(projectId, userId, authorUid).catch(console.error);
    }

    return true;
  }
}

export async function getUserVotes(userId: string): Promise<Set<string>> {
  const q = query(votesCol, where('userId', '==', userId));
  const snap = await getDocs(q);
  const votedProjectIds = new Set<string>();
  snap.forEach(doc => votedProjectIds.add(doc.data().projectId));
  return votedProjectIds;
}

export function subscribeToUserVotes(userId: string, callback: (votes: Set<string>) => void) {
  const q = query(votesCol, where('userId', '==', userId));
  return onSnapshot(q, (snapshot) => {
    const voted = new Set<string>();
    snapshot.forEach(docSnap => {
      const d = docSnap.data();
      if (d?.projectId) voted.add(d.projectId);
    });
    callback(voted);
  });
}

// ─── Comments ───

export async function addComment(projectId: string, comment: Comment) {
  const projectRef = doc(db, 'projects', projectId);
  const snap = await getDoc(projectRef);
  if (!snap.exists()) return;

  // Ensure parentUpdateId is either null or explicitly set
  if (!comment.parentUpdateId) {
    comment.parentUpdateId = null;
  }

  // Ensure parentCommentId is either null or explicitly set
  if (!comment.parentCommentId) {
    comment.parentCommentId = null;
  }

  const project = snap.data();
  const current = snap.data().comments || [];
  await updateDoc(projectRef, {
    comments: arrayUnion(comment),
  });

  // Create notification for project author if this is a root comment (not a reply)
  if (!comment.parentCommentId && comment.authorUid && project.authorUid && comment.authorUid !== project.authorUid) {
    await createNotification({
      type: 'comment',
      userId: project.authorUid,
      triggerUid: comment.authorUid,
      triggerDisplayName: comment.author,
      projectId,
      projectTitle: project.title,
      commentId: comment.id,
      ...(comment.parentUpdateId && { parentUpdateId: comment.parentUpdateId }),
      message: `${comment.author} commented on your project`,
      previewText: comment.content.substring(0, 100),
      viewedAt: null,
      link: {
        type: 'project',
        id: projectId,
      },
    });
  }

  // Create notification for parent comment author if this is a reply
  if (comment.parentCommentId && comment.authorUid) {
    const parentComment = current.find((c: Comment) => c.id === comment.parentCommentId);
    if (parentComment && parentComment.authorUid && parentComment.authorUid !== comment.authorUid) {
      await createNotification({
        type: 'reply',
        userId: parentComment.authorUid,
        triggerUid: comment.authorUid,
        triggerDisplayName: comment.author,
        projectId,
        projectTitle: project.title,
        commentId: comment.id,
        parentCommentId: comment.parentCommentId,
        message: `${comment.author} replied to your comment`,
        previewText: comment.content.substring(0, 100),
        viewedAt: null,
        link: {
          type: 'project',
          id: projectId,
        },
      });
    }
  }

  // Parse mentions and create notifications for tagged users
  const mentions = parseMentions(comment.content);
  for (const mention of mentions) {
    const mentionedUser = await findUserByDisplayName(mention);
    if (mentionedUser && mentionedUser.uid && mentionedUser.uid !== comment.authorUid) {
      await createNotification({
        type: 'mention',
        userId: mentionedUser.uid,
        triggerUid: comment.authorUid || 'unknown',
        triggerDisplayName: comment.author,
        projectId,
        projectTitle: project.title,
        commentId: comment.id,
        message: `${comment.author} mentioned you in a comment`,
        previewText: comment.content.substring(0, 100),
        viewedAt: null,
        link: {
          type: 'project',
          id: projectId,
        },
      });
    }
  }
}

// ─── Project Updates (Build Journey) ───

export async function addProjectUpdate(projectId: string, update: ProjectUpdate, userId: string) {
  // Check if user has permission to post update
  const hasPermission = await canPostUpdate(projectId, userId);
  if (!hasPermission) {
    throw new Error('Only the project creator and admins can post updates');
  }

  const projectRef = doc(db, 'projects', projectId);
  const snap = await getDoc(projectRef);
  if (!snap.exists()) throw new Error('Project not found');

  // Filter out undefined values before storing
  const cleanUpdate = Object.fromEntries(
    Object.entries(update).filter(([, v]) => v !== undefined)
  );

  const current = snap.data().updates || [];
  await updateDoc(projectRef, {
    updates: [...current, cleanUpdate],
  });
}

export async function updateProjectStatus(projectId: string, status: ProjectStatus) {
  await updateProjectField(projectId, { status });
}

// ─── Admin ───

export async function approveProject(projectId: string) {
  const projectRef = doc(db, 'projects', projectId);
  const projectSnap = await getDoc(projectRef);

  await updateProjectField(projectId, { approvalStatus: 'approved' });

  // Create notification for project author
  if (projectSnap.exists()) {
    const project = projectSnap.data();
    if (project.authorUid) {
      await createNotification({
        type: 'approval',
        userId: project.authorUid,
        triggerUid: 'ADMIN',
        triggerDisplayName: 'Admin',
        projectId,
        projectTitle: project.title,
        message: `Your project "${project.title}" has been approved!`,
        previewText: project.description.substring(0, 100),
        viewedAt: null,
        link: {
          type: 'project',
          id: projectId,
        },
      });

      // Award XP to project author
      await awardXP(project.authorUid, XP_VALUES.PROJECT_APPROVED, 'PROJECT_APPROVED');
    }
  }
}

export async function rejectProject(projectId: string, reason?: string) {
  const projectRef = doc(db, 'projects', projectId);
  const projectSnap = await getDoc(projectRef);

  await updateProjectField(projectId, {
    approvalStatus: 'rejected',
    rejectionReason: reason || '',
  });

  // Create notification for project author
  if (projectSnap.exists()) {
    const project = projectSnap.data();
    if (project.authorUid) {
      await createNotification({
        type: 'rejection',
        userId: project.authorUid,
        triggerUid: 'ADMIN',
        triggerDisplayName: 'Admin',
        projectId,
        projectTitle: project.title,
        message: `Your project "${project.title}" was not approved`,
        previewText: reason || 'No reason provided',
        viewedAt: null,
        link: {
          type: 'project',
          id: projectId,
        },
      });
    }
  }
}

export async function suspendProject(
  projectId: string,
  adminUid: string,
  reason: string
): Promise<void> {
  const projectRef = doc(db, 'projects', projectId);
  const projectSnap = await getDoc(projectRef);

  if (!projectSnap.exists()) throw new Error('Project not found');
  const project = projectSnap.data();

  // Update project with suspension
  await updateDoc(projectRef, {
    isSuspended: true,
    suspendedBy: adminUid,
    suspendedAt: new Date().toISOString(),
    suspensionReason: reason,
  });

  // Create notification for project author
  if (project.authorUid && project.authorUid !== adminUid) {
    await createNotification({
      type: 'suspension',
      userId: project.authorUid,
      triggerUid: adminUid,
      triggerDisplayName: 'Admin',
      projectId,
      projectTitle: project.title,
      message: `Your project "${project.title}" has been suspended`,
      previewText: reason,
      viewedAt: null,
      link: {
        type: 'project',
        id: projectId,
      },
    });
  }
}

export async function restoreProject(
  projectId: string,
  adminUid: string
): Promise<void> {
  const projectRef = doc(db, 'projects', projectId);
  const projectSnap = await getDoc(projectRef);

  if (!projectSnap.exists()) throw new Error('Project not found');
  const project = projectSnap.data();

  // Remove suspension
  await updateDoc(projectRef, {
    isSuspended: false,
    suspendedBy: null,
    suspendedAt: null,
    suspensionReason: null,
  });

  // Create notification for project author
  if (project.authorUid && project.authorUid !== adminUid) {
    await createNotification({
      type: 'approval',
      userId: project.authorUid,
      triggerUid: adminUid,
      triggerDisplayName: 'Admin',
      projectId,
      projectTitle: project.title,
      message: `Your project "${project.title}" has been restored`,
      previewText: 'Your project is now visible to all users',
      viewedAt: null,
      link: {
        type: 'project',
        id: projectId,
      },
    });
  }
}

export async function updateProjectDescription(
  projectId: string,
  userId: string,
  newDescription: string
): Promise<void> {
  const projectRef = doc(db, 'projects', projectId);
  const projectSnap = await getDoc(projectRef);

  if (!projectSnap.exists()) throw new Error('Project not found');
  const project = projectSnap.data();

  // Only allow author to edit
  if (project.authorUid !== userId) {
    throw new Error('Only the project author can edit the description');
  }

  // Update project description
  await updateDoc(projectRef, {
    description: newDescription,
  });
}

export async function updateProjectDetails(
  projectId: string,
  userId: string,
  fields: { demoUrl?: string; websiteUrl?: string; imageUrl?: string }
): Promise<void> {
  const projectRef = doc(db, 'projects', projectId);
  const projectSnap = await getDoc(projectRef);

  if (!projectSnap.exists()) throw new Error('Project not found');
  const project = projectSnap.data();

  if (project.authorUid !== userId) {
    throw new Error('Only the project author can edit project details');
  }

  await updateDoc(projectRef, fields);
}

export function subscribeToPendingProjects(callback: (projects: Project[]) => void) {
  return subscribeToProjects(callback, 'pending');
}

// ─── XP ───

export const XP_VALUES = {
  SUBMIT_PROJECT: 50,
  PROJECT_APPROVED: 50,
  RECEIVE_VOTE: 3,
  LEAVE_COMMENT: 3,
  RECEIVE_COMMENT: 5,
  FIRST_PROJECT: 100,
  VOTE_MILESTONE_10: 25,
  VOTE_MILESTONE_50: 75,
  LOGIN_STREAK: 10,
  COMMENT_XP_DAILY_CAP: 25,
  MIN_VOTES_FOR_XP: 3,
  MIN_ACCOUNT_AGE_DAYS: 7,
} as const;

export async function awardXP(userId: string, amount: number, action?: string) {
  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/award-xp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          targetUserId: userId,
          amount,
          action: action || 'CUSTOM_AWARD',
        }),
      });

      if (response.ok) {
        const data = await response.json().catch(() => null);
        if (data?.success) {
          return;
        }
      }
    }
  } catch (err) {
    console.warn('Serverless XP award error, falling back to direct write:', err);
  }

  // Fallback to client-side write (bounded by Firestore security rules)
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    xp: increment(amount),
    seasonXp: increment(amount),
  });
}

// ─── XP Guardrails ───

function getDateString(date = new Date()): string {
  return date.toISOString().split('T')[0];
}

async function isAccountOldEnough(userId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) return false;
  const data = snap.data();
  const joinedAt = data.joinedAt?.toDate?.() || new Date(data.joinedAt);
  const ageMs = Date.now() - joinedAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays >= XP_VALUES.MIN_ACCOUNT_AGE_DAYS;
}

async function projectHasMinVotes(projectId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'projects', projectId));
  if (!snap.exists()) return false;
  return (snap.data().likes || 0) >= XP_VALUES.MIN_VOTES_FOR_XP;
}

// ─── Vote XP ───

async function awardVoteXP(
  projectId: string,
  voterId: string,
  authorUid: string
) {
  // Votes from new accounts don't award XP
  const eligible = await isAccountOldEnough(voterId);
  if (!eligible) return;

  // XP only flows on projects with 3+ votes
  const hasMinVotes = await projectHasMinVotes(projectId);
  if (!hasMinVotes) return;

  await awardXP(authorUid, XP_VALUES.RECEIVE_VOTE, 'RECEIVE_VOTE');

  // Check milestones after the vote
  await checkVoteMilestones(projectId, authorUid);
}

async function checkVoteMilestones(projectId: string, authorUid: string) {
  const projectRef = doc(db, 'projects', projectId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(projectRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const likes: number = data.likes || 0;
    const awarded: number[] = data.xpMilestonesAwarded || [];

    const milestones: { threshold: number; xp: number; action: string }[] = [
      { threshold: 10, xp: XP_VALUES.VOTE_MILESTONE_10, action: 'VOTE_MILESTONE_10' },
      { threshold: 50, xp: XP_VALUES.VOTE_MILESTONE_50, action: 'VOTE_MILESTONE_50' },
    ];

    const achievedMilestones: { xp: number; action: string }[] = [];
    const newAwarded = [...awarded];

    for (const m of milestones) {
      if (likes >= m.threshold && !awarded.includes(m.threshold)) {
        achievedMilestones.push({ xp: m.xp, action: m.action });
        newAwarded.push(m.threshold);
      }
    }

    if (achievedMilestones.length > 0) {
      transaction.update(projectRef, { xpMilestonesAwarded: newAwarded });
    }

    return achievedMilestones;
  }).then(async (milestones) => {
    if (milestones && milestones.length > 0) {
      for (const m of milestones) {
        await awardXP(authorUid, m.xp, m.action);
      }
    }
  });
}

// ─── Comment XP ───

export async function awardCommentXP(
  commenterId: string,
  projectId: string,
  authorUid?: string
) {
  const hasMinVotes = await projectHasMinVotes(projectId);
  if (!hasMinVotes) return;

  // Award commenter XP (with daily cap)
  const commenterRef = doc(db, 'users', commenterId);
  const commenterSnap = await getDoc(commenterRef);
  if (commenterSnap.exists()) {
    const data = commenterSnap.data();
    const today = getDateString();
    const commentXpToday = data.lastCommentXpDate === today ? (data.commentXpToday || 0) : 0;

    if (commentXpToday < XP_VALUES.COMMENT_XP_DAILY_CAP) {
      const awardable = Math.min(
        XP_VALUES.LEAVE_COMMENT,
        XP_VALUES.COMMENT_XP_DAILY_CAP - commentXpToday
      );
      await updateDoc(commenterRef, {
        xp: increment(awardable),
        seasonXp: increment(awardable),
        commentXpToday: commentXpToday + awardable,
        lastCommentXpDate: today,
      });
    }
  }

  // Award project author XP for receiving a comment
  if (authorUid && authorUid !== commenterId) {
    await awardXP(authorUid, XP_VALUES.RECEIVE_COMMENT, 'RECEIVE_COMMENT');
  }
}

// ─── First Project Bonus ───

async function checkFirstProjectBonus(authorUid: string) {
  const q = query(projectsCol, where('authorUid', '==', authorUid));
  const snap = await getDocs(q);
  // Count is 1 because the project was just created
  if (snap.size === 1) {
    await awardXP(authorUid, XP_VALUES.FIRST_PROJECT, 'FIRST_PROJECT');
  }
}

// ─── Image Upload ───

async function uploadToCloudinary(file: File): Promise<string> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary configuration is missing. Please check your .env variables.");
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Cloudinary upload failed: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.secure_url;
}

export async function uploadProjectImage(
  file: File,
  _projectId: string,
  _fileName?: string
): Promise<string> {
  return uploadToCloudinary(file);
}

// ─── User Profile ───

export async function uploadUserAvatar(
  _userId: string,
  file: File
): Promise<string> {
  return uploadToCloudinary(file);
}

export async function uploadStudentIdCard(
  userId: string,
  file: File
): Promise<string> {
  const imageUrl = await uploadToCloudinary(file);
  await updateDoc(doc(db, 'users', userId), {
    studentIdCardUrl: imageUrl,
    verificationStatus: 'pending',
    verificationRejectionReason: null,
  });
  return imageUrl;
}

export async function uploadUserBanner(
  userId: string,
  file: File
): Promise<string> {
  const imageUrl = await uploadToCloudinary(file);
  await updateDoc(doc(db, 'users', userId), {
    bannerUrl: imageUrl,
  });
  return imageUrl;
}

export async function getUserProfile(userId: string) {
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) return null;
  const data = snap.data();
  if (data.photoURL) {
    data.photoURL = cleanOldFirebaseUrl(data.photoURL);
  }
  return { uid: userId, ...data };
}

export async function getUserProjects(authorUid: string): Promise<Project[]> {
  const q = query(projectsCol, where('authorUid', '==', authorUid));
  const snap = await getDocs(q);
  return snap.docs.map(projectFromDoc);
}

export async function getUserApprovedProjects(authorUid: string): Promise<Project[]> {
  try {
    const q = query(
      projectsCol,
      where('authorUid', '==', authorUid),
      where('approvalStatus', '==', 'approved')
    );
    const snap = await getDocs(q);
    return snap.docs
      .map(projectFromDoc)
      .filter(p => !p.isSuspended);
  } catch (err) {
    console.warn('getUserApprovedProjects failed or access denied:', err);
    return [];
  }
}

// ─── Notification System ───

export async function createNotification(notification: Omit<Notification, 'id' | 'createdAt' | 'expiresAt'>) {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days from now

  const userNotifRef = collection(db, 'users', notification.userId, 'notifications');
  await addDoc(userNotifRef, {
    ...notification,
    createdAt: now,
    expiresAt,
  });
}

export async function markNotificationAsViewed(userId: string, notificationId: string) {
  const notifRef = doc(db, 'users', userId, 'notifications', notificationId);
  await updateDoc(notifRef, {
    viewedAt: new Date().toISOString(),
  });
}

export async function deleteViewedNotifications(userId: string) {
  const userNotifRef = collection(db, 'users', userId, 'notifications');
  const q = query(userNotifRef, where('expiresAt', '<', new Date().toISOString()));
  const snap = await getDocs(q);

  const batch = writeBatch(db);
  snap.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  await batch.commit();
}

export function subscribeToUserNotifications(
  userId: string,
  callback: (notifications: Notification[]) => void
) {
  const userNotifRef = collection(db, 'users', userId, 'notifications');
  const q = query(userNotifRef, orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Notification[];
    callback(notifications);
  });
}

export function parseMentions(text: string): string[] {
  // Matches @Name or @FirstName LastName (up to 3 words, bounded by punctuation or space)
  const mentionRegex = /@([a-zA-Z0-9_.-]+(?:\s+[a-zA-Z0-9_.-]+){0,2})(?=[,!?\s]|$)/g;
  const mentions: string[] = [];
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    const mention = match[1].trim();
    if (mention && !mentions.includes(mention)) {
      mentions.push(mention);
    }
  }

  return mentions;
}

export async function findUserByDisplayName(displayName: string): Promise<{ uid: string; [key: string]: any } | null> {
  const trimmed = displayName.trim();
  if (!trimmed) return null;
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('displayName', '==', trimmed), limit(1));
  const snap = await getDocs(q);

  if (snap.empty) {
    // If multiple words were passed, try matching just the first word as a fallback
    const words = trimmed.split(/\s+/);
    if (words.length > 1) {
      const qFirst = query(usersRef, where('displayName', '==', words[0]), limit(1));
      const snapFirst = await getDocs(qFirst);
      if (!snapFirst.empty) {
        const d = snapFirst.docs[0];
        return { uid: d.id, ...d.data() };
      }
    }
    return null;
  }
  const d = snap.docs[0];
  return { uid: d.id, ...d.data() };
}

// ─── Board Notice ───

export async function getBoardNotice(): Promise<BoardNotice | null> {
  const docRef = doc(db, 'settings', 'boardNotice');
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    // First time: create default
    const defaultNotice: BoardNotice = {
      id: 'boardNotice',
      title: 'Board Notice',
      content: 'Post more projects to gain more XP!!',
      updatedAt: new Date().toISOString(),
    };
    await setDoc(docRef, defaultNotice);
    return defaultNotice;
  }
  return snap.data() as BoardNotice;
}

export async function updateBoardNotice(content: string, adminUid: string): Promise<void> {
  const docRef = doc(db, 'settings', 'boardNotice');
  await setDoc(docRef, {
    title: 'Board Notice',
    content,
    updatedAt: new Date().toISOString(),
    updatedBy: adminUid,
  }, { merge: true });
}

// ─── Trending Technologies ───

export async function getTrendingTechnologies(maxLimit: number = 6): Promise<{ tech: string; count: number }[]> {
  const snap = await getDocs(projectsCol);
  const techCounts: Record<string, number> = {};

  snap.docs.forEach(doc => {
    const project = doc.data();
    if (project.techStack && Array.isArray(project.techStack)) {
      project.techStack.forEach((tech: string) => {
        techCounts[tech] = (techCounts[tech] || 0) + 1;
      });
    }
  });

  return Object.entries(techCounts)
    .map(([tech, count]) => ({ tech, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, maxLimit);
}

// ─── Top Users by XP ───

export async function getTopUsersByXP(maxLimit: number = 5): Promise<any[]> {
  const q = query(
    usersCol,
    orderBy('xp', 'desc'),
    limit(maxLimit)
  );
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
}

// ─── Seed Data ───

// ─── Favorites ───

export async function toggleFavorite(userId: string, projectId: string): Promise<boolean> {
  const favRef = doc(db, 'users', userId, 'favorites', projectId);
  const snap = await getDoc(favRef);
  if (snap.exists()) {
    await deleteDoc(favRef);
    return false; // removed
  } else {
    await setDoc(favRef, { addedAt: serverTimestamp() });
    return true; // added
  }
}

export async function getUserFavorites(userId: string): Promise<Set<string>> {
  const favsCol = collection(db, 'users', userId, 'favorites');
  const snap = await getDocs(favsCol);
  return new Set(snap.docs.map(d => d.id));
}

export function subscribeToUserFavorites(userId: string, callback: (favs: Set<string>) => void) {
  const favsCol = collection(db, 'users', userId, 'favorites');
  return onSnapshot(favsCol, (snap) => {
    callback(new Set(snap.docs.map(d => d.id)));
  });
}

export async function seedProjects(projects: Project[]) {
  const snap = await getDocs(query(projectsCol));
  if (!snap.empty) return; // Already seeded

  const batch = writeBatch(db);
  projects.forEach(p => {
    const ref = doc(projectsCol);
    batch.set(ref, {
      title: p.title,
      description: p.description,
      studentName: p.studentName,
      level: p.level,
      category: p.category,
      techStack: p.techStack,
      imageUrl: p.imageUrl,
      screenshots: p.screenshots,
      likes: p.likes,
      demoUrl: p.demoUrl || null,
      repoUrl: p.repoUrl || null,
      datePosted: Timestamp.fromDate(new Date(p.datePosted)),
      comments: p.comments,
      status: p.status,
      updates: p.updates,
      authorUid: null, // seed data has no real author
      approvalStatus: 'approved', // seed data is pre-approved
    });
  });
  await batch.commit();
}

// ─── Literature Club ───

const writingsCol = collection(db, 'writings');
const litVotesCol = collection(db, 'litVotes');

function writingFromDoc(docSnap: any): Writing {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    title: d.title || '',
    body: d.body || '',
    genre: d.genre || 'essay',
    displayName: d.displayName || '',
    authorPhotoURL: cleanOldFirebaseUrl(d.authorPhotoURL),
    likes: d.likes || 0,
    datePosted: tsToISO(d.datePosted),
    comments: d.comments || [],
    ...(d.authorUid && { authorUid: d.authorUid }),
    ...(d.approvalStatus && { approvalStatus: d.approvalStatus }),
    ...(d.rejectionReason && { rejectionReason: d.rejectionReason }),
    ...(d.isSuspended && { isSuspended: d.isSuspended }),
    ...(d.suspendedBy && { suspendedBy: d.suspendedBy }),
    ...(d.suspendedAt && { suspendedAt: d.suspendedAt }),
    ...(d.suspensionReason && { suspensionReason: d.suspensionReason }),
  } as Writing;
}

export async function getWritingById(writingId: string): Promise<Writing | null> {
  try {
    const snap = await getDoc(doc(writingsCol, writingId));
    if (!snap.exists()) return null;
    return writingFromDoc(snap);
  } catch (err) {
    console.warn('getWritingById failed or access denied:', err);
    return null;
  }
}

export function subscribeToWritings(
  callback: (writings: Writing[]) => void,
  approvalFilter: 'approved' | 'pending' | 'all' = 'approved',
  isAdmin: boolean = false,
  userId?: string
) {
  let q;
  if (approvalFilter === 'all') {
    q = query(writingsCol, orderBy('datePosted', 'desc'));
  } else {
    q = query(
      writingsCol,
      where('approvalStatus', '==', approvalFilter),
      orderBy('datePosted', 'desc')
    );
  }

  return onSnapshot(q, (snapshot) => {
    let writings = snapshot.docs.map(writingFromDoc);
    if (!isAdmin) {
      writings = writings.filter(w => !w.isSuspended || (userId && w.authorUid === userId));
    }
    callback(writings);
  });
}

export function subscribeToPendingWritings(callback: (writings: Writing[]) => void) {
  return subscribeToWritings(callback, 'pending');
}

export async function createWriting(
  data: { title: string; body: string; genre: WritingGenre; displayName: string; authorPhotoURL?: string | null },
  authorUid: string
) {
  const docRef = await addDoc(writingsCol, {
    ...data,
    likes: 0,
    datePosted: serverTimestamp(),
    comments: [],
    authorUid,
    approvalStatus: 'pending',
  });

  await awardXP(authorUid, XP_VALUES.SUBMIT_PROJECT, 'SUBMIT_PROJECT');
  await checkFirstWritingBonus(authorUid);

  return docRef.id;
}

async function checkFirstWritingBonus(authorUid: string) {
  const q = query(writingsCol, where('authorUid', '==', authorUid));
  const snap = await getDocs(q);
  if (snap.size === 1) {
    await awardXP(authorUid, XP_VALUES.FIRST_PROJECT, 'FIRST_PROJECT');
  }
}

export async function approveWriting(writingId: string) {
  const writingRef = doc(writingsCol, writingId);
  const writingSnap = await getDoc(writingRef);
  await updateDoc(writingRef, { approvalStatus: 'approved' });

  if (writingSnap.exists()) {
    const writing = writingSnap.data();
    if (writing.authorUid) {
      await createNotification({
        type: 'approval',
        userId: writing.authorUid,
        triggerUid: 'ADMIN',
        triggerDisplayName: 'Admin',
        projectId: writingId,
        projectTitle: writing.title,
        message: `Your writing "${writing.title}" has been approved!`,
        previewText: writing.body.substring(0, 100),
        viewedAt: null,
        link: { type: 'writing', id: writingId },
      });
      await awardXP(writing.authorUid, XP_VALUES.PROJECT_APPROVED, 'PROJECT_APPROVED');
    }
  }
}

export async function rejectWriting(writingId: string, reason?: string) {
  const writingRef = doc(writingsCol, writingId);
  const writingSnap = await getDoc(writingRef);
  await updateDoc(writingRef, {
    approvalStatus: 'rejected',
    rejectionReason: reason || '',
  });

  if (writingSnap.exists()) {
    const writing = writingSnap.data();
    if (writing.authorUid) {
      await createNotification({
        type: 'rejection',
        userId: writing.authorUid,
        triggerUid: 'ADMIN',
        triggerDisplayName: 'Admin',
        projectId: writingId,
        projectTitle: writing.title,
        message: `Your writing "${writing.title}" was not approved`,
        previewText: reason || 'No reason provided',
        viewedAt: null,
        link: { type: 'writing', id: writingId },
      });
    }
  }
}

export async function deleteWriting(writingId: string, userId: string) {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists() || !userSnap.data().isAdmin) {
    throw new Error('Only admins can delete writings');
  }
  await deleteDoc(doc(writingsCol, writingId));

  const votesQuery = query(litVotesCol, where('writingId', '==', writingId));
  const votesSnap = await getDocs(votesQuery);
  const batch = writeBatch(db);
  votesSnap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

export async function suspendWriting(writingId: string, adminUid: string, reason: string) {
  const writingRef = doc(writingsCol, writingId);
  const writingSnap = await getDoc(writingRef);
  if (!writingSnap.exists()) throw new Error('Writing not found');
  const writing = writingSnap.data();

  await updateDoc(writingRef, {
    isSuspended: true,
    suspendedBy: adminUid,
    suspendedAt: new Date().toISOString(),
    suspensionReason: reason,
  });

  if (writing.authorUid && writing.authorUid !== adminUid) {
    await createNotification({
      type: 'suspension',
      userId: writing.authorUid,
      triggerUid: adminUid,
      triggerDisplayName: 'Admin',
      projectId: writingId,
      projectTitle: writing.title,
      message: `Your writing "${writing.title}" has been suspended`,
      previewText: reason,
      viewedAt: null,
      link: { type: 'writing', id: writingId },
    });
  }
}

export async function restoreWriting(writingId: string, adminUid: string) {
  const writingRef = doc(writingsCol, writingId);
  const writingSnap = await getDoc(writingRef);
  if (!writingSnap.exists()) throw new Error('Writing not found');
  const writing = writingSnap.data();

  await updateDoc(writingRef, {
    isSuspended: false,
    suspendedBy: null,
    suspendedAt: null,
    suspensionReason: null,
  });

  if (writing.authorUid && writing.authorUid !== adminUid) {
    await createNotification({
      type: 'approval',
      userId: writing.authorUid,
      triggerUid: adminUid,
      triggerDisplayName: 'Admin',
      projectId: writingId,
      projectTitle: writing.title,
      message: `Your writing "${writing.title}" has been restored`,
      previewText: 'Your writing is now visible to all users',
      viewedAt: null,
      link: { type: 'writing', id: writingId },
    });
  }
}

export async function toggleWritingVote(
  writingId: string,
  userId: string,
  authorUid?: string
): Promise<boolean> {
  const voteId = `${userId}_${writingId}`;
  const voteRef = doc(litVotesCol, voteId);
  const writingRef = doc(writingsCol, writingId);
  const voteSnap = await getDoc(voteRef);
  const batch = writeBatch(db);

  if (voteSnap.exists()) {
    batch.delete(voteRef);
    batch.update(writingRef, { likes: increment(-1) });
    await batch.commit();
    return false;
  } else {
    batch.set(voteRef, { userId, writingId, createdAt: serverTimestamp() });
    batch.update(writingRef, { likes: increment(1) });
    await batch.commit();

    if (authorUid && authorUid !== userId) {
      awardXP(authorUid, XP_VALUES.RECEIVE_VOTE, 'RECEIVE_VOTE').catch(console.error);
    }
    return true;
  }
}

export function subscribeToUserLitVotes(userId: string, callback: (votes: Set<string>) => void) {
  const q = query(litVotesCol, where('userId', '==', userId));
  return onSnapshot(q, (snapshot) => {
    const voted = new Set<string>();
    snapshot.forEach(docSnap => {
      const d = docSnap.data();
      if (d?.writingId) voted.add(d.writingId);
    });
    callback(voted);
  });
}

export async function seedWritings(writings: Omit<Writing, 'id'>[]) {
  const snap = await getDocs(query(writingsCol));
  if (!snap.empty) return;

  const batch = writeBatch(db);
  writings.forEach(w => {
    const ref = doc(writingsCol);
    batch.set(ref, {
      ...w,
      datePosted: Timestamp.fromDate(new Date(w.datePosted)),
      authorUid: null,
    });
  });
  await batch.commit();
}

export async function addWritingComment(writingId: string, comment: Comment) {
  const writingRef = doc(writingsCol, writingId);
  const snap = await getDoc(writingRef);
  if (!snap.exists()) return;

  if (!comment.parentCommentId) comment.parentCommentId = null;

  const writing = snap.data();
  const current = writing.comments || [];
  await updateDoc(writingRef, { comments: arrayUnion(comment) });

  if (!comment.parentCommentId && comment.authorUid && writing.authorUid && comment.authorUid !== writing.authorUid) {
    await createNotification({
      type: 'comment',
      userId: writing.authorUid,
      triggerUid: comment.authorUid,
      triggerDisplayName: comment.author,
      projectId: writingId,
      projectTitle: writing.title,
      commentId: comment.id,
      message: `${comment.author} commented on your writing`,
      previewText: comment.content.substring(0, 100),
      viewedAt: null,
      link: { type: 'writing', id: writingId },
    });
  }

  if (comment.parentCommentId && comment.authorUid) {
    const parentComment = current.find((c: Comment) => c.id === comment.parentCommentId);
    if (parentComment && parentComment.authorUid && parentComment.authorUid !== comment.authorUid) {
      await createNotification({
        type: 'reply',
        userId: parentComment.authorUid,
        triggerUid: comment.authorUid,
        triggerDisplayName: comment.author,
        projectId: writingId,
        projectTitle: writing.title,
        commentId: comment.id,
        parentCommentId: comment.parentCommentId,
        message: `${comment.author} replied to your comment`,
        previewText: comment.content.substring(0, 100),
        viewedAt: null,
        link: { type: 'writing', id: writingId },
      });
    }
  }

  const mentions = parseMentions(comment.content);
  for (const mention of mentions) {
    const mentionedUser = await findUserByDisplayName(mention);
    if (mentionedUser && mentionedUser.uid && mentionedUser.uid !== comment.authorUid) {
      await createNotification({
        type: 'mention',
        userId: mentionedUser.uid,
        triggerUid: comment.authorUid || 'unknown',
        triggerDisplayName: comment.author,
        projectId: writingId,
        projectTitle: writing.title,
        commentId: comment.id,
        message: `${comment.author} mentioned you in a comment`,
        previewText: comment.content.substring(0, 100),
        viewedAt: null,
        link: { type: 'writing', id: writingId },
      });
    }
  }
}

// ─── Season 1 Campaign & Economy ───

export const DEFAULT_CAMPAIGN_CONFIG: CampaignConfig = {
  seasonNumber: 1,
  title: 'Season 1: Exam Question Paper Bounty',
  description: 'Collect exam question papers, earn 500 GoCoins per approved course, and get paid automatically on Payday!',
  rewardPerPaper: 500,
  nairaPer500Coins: 500,
  paydayDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  isActive: true,
  maxSubmissionsPerCourse: 5,
};

export function normalizeCourseCode(code: string): string {
  if (!code) return '';
  const clean = code.trim().toUpperCase().replace(/[-_]+/g, ' ');
  const match = clean.match(/^([A-Z]+)\s*(\d+[A-Z]?)$/);
  if (match) {
    return `${match[1]} ${match[2]}`;
  }
  return clean.replace(/\s+/g, ' ');
}

export async function getCampaignConfig(): Promise<CampaignConfig> {
  try {
    const snap = await getDoc(campaignConfigDoc);
    if (snap.exists()) {
      return { ...DEFAULT_CAMPAIGN_CONFIG, ...snap.data() } as CampaignConfig;
    }
    return DEFAULT_CAMPAIGN_CONFIG;
  } catch (err) {
    console.warn('Failed to fetch campaign config, using default:', err);
    return DEFAULT_CAMPAIGN_CONFIG;
  }
}

export function subscribeToCampaignConfig(callback: (config: CampaignConfig) => void) {
  return onSnapshot(campaignConfigDoc, (snap) => {
    if (snap.exists()) {
      callback({ ...DEFAULT_CAMPAIGN_CONFIG, ...snap.data() } as CampaignConfig);
    } else {
      callback(DEFAULT_CAMPAIGN_CONFIG);
    }
  });
}

export async function updateCampaignConfig(
  updates: Partial<CampaignConfig>,
  adminUid: string
): Promise<void> {
  await setDoc(
    campaignConfigDoc,
    {
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: adminUid,
    },
    { merge: true }
  );
}

export function subscribeToCourseBounties(callback: (bounties: CourseBountySummary[]) => void) {
  const q = query(courseBountiesCol, orderBy('updatedAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const bounties = snap.docs.map(d => ({
      courseCode: d.id,
      ...d.data(),
    } as CourseBountySummary));
    callback(bounties);
  });
}

export function subscribeToExamPapers(
  callback: (papers: ExamPaperSubmission[]) => void,
  statusFilter: 'all' | 'pending' | 'approved' = 'all'
) {
  let q;
  if (statusFilter === 'all') {
    q = query(examPapersCol, orderBy('createdAt', 'desc'));
  } else {
    q = query(examPapersCol, where('status', '==', statusFilter), orderBy('createdAt', 'desc'));
  }

  return onSnapshot(q, (snap) => {
    const papers = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        courseCode: data.courseCode || '',
        courseTitle: data.courseTitle || '',
        level: data.level || '',
        semester: data.semester || '',
        imageUrls: (data.imageUrls || []).map(cleanOldFirebaseUrl).filter(Boolean) as string[],
        authorUid: data.authorUid || '',
        displayName: data.displayName || 'Student',
        authorPhotoURL: cleanOldFirebaseUrl(data.authorPhotoURL) || null,
        slotNumber: data.slotNumber || 1,
        status: data.status || 'pending',
        rejectionReason: data.rejectionReason,
        createdAt: tsToISO(data.createdAt),
        reviewedAt: data.reviewedAt,
        reviewedBy: data.reviewedBy,
      } as ExamPaperSubmission;
    });
    callback(papers);
  });
}

export function subscribeToUserExamPapers(
  userId: string,
  callback: (papers: ExamPaperSubmission[]) => void
) {
  const q = query(examPapersCol, where('authorUid', '==', userId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const papers = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        courseCode: data.courseCode || '',
        courseTitle: data.courseTitle || '',
        level: data.level || '',
        semester: data.semester || '',
        imageUrls: (data.imageUrls || []).map(cleanOldFirebaseUrl).filter(Boolean) as string[],
        authorUid: data.authorUid || '',
        displayName: data.displayName || 'Student',
        authorPhotoURL: cleanOldFirebaseUrl(data.authorPhotoURL) || null,
        slotNumber: data.slotNumber || 1,
        status: data.status || 'pending',
        rejectionReason: data.rejectionReason,
        createdAt: tsToISO(data.createdAt),
        reviewedAt: data.reviewedAt,
        reviewedBy: data.reviewedBy,
      } as ExamPaperSubmission;
    });
    callback(papers);
  });
}

export async function submitExamPaper(
  data: {
    courseCode: string;
    courseTitle: string;
    level: string;
    semester: string;
    imageUrls: string[];
  },
  authorUid: string,
  displayName: string,
  authorPhotoURL?: string | null
): Promise<string> {
  const normalizedCode = normalizeCourseCode(data.courseCode);
  if (!normalizedCode) {
    throw new Error('Please enter a valid course code (e.g. CSC 301)');
  }

  const bountyDocRef = doc(db, 'courseBounties', normalizedCode);

  return await runTransaction(db, async (tx) => {
    const bountySnap = await tx.get(bountyDocRef);
    let currentCount = 0;
    let submittedUserIds: string[] = [];

    if (bountySnap.exists()) {
      const bData = bountySnap.data();
      if (bData.isCollected) {
        throw new Error(`Submissions for ${normalizedCode} have already been collected and closed.`);
      }
      submittedUserIds = bData.submittedUserIds || [];
      if (submittedUserIds.includes(authorUid)) {
        throw new Error(`You have already submitted an exam paper for ${normalizedCode}. Only 1 upload per student is allowed.`);
      }
      currentCount = bData.submissionCount || 0;
      if (currentCount >= 5) {
        throw new Error(`All 5 submission slots for ${normalizedCode} are currently full under review.`);
      }
    }

    const slotNumber = currentCount + 1;
    const newPaperRef = doc(examPapersCol);

    tx.set(newPaperRef, {
      courseCode: normalizedCode,
      courseTitle: data.courseTitle.trim(),
      level: data.level,
      semester: data.semester,
      imageUrls: data.imageUrls,
      authorUid,
      displayName,
      authorPhotoURL: authorPhotoURL || null,
      slotNumber,
      status: 'pending',
      createdAt: serverTimestamp(),
    });

    tx.set(
      bountyDocRef,
      {
        courseCode: normalizedCode,
        courseTitle: data.courseTitle.trim(),
        level: data.level,
        submissionCount: slotNumber,
        submittedUserIds: arrayUnion(authorUid),
        isCollected: false,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return newPaperRef.id;
  });
}

export async function selectCoursePaperWinner(
  paperId: string,
  courseCode: string,
  winnerUid: string,
  rewardAmount = 500
): Promise<void> {
  const normalizedCode = normalizeCourseCode(courseCode);
  const paperRef = doc(db, 'examPapers', paperId);
  const bountyRef = doc(db, 'courseBounties', normalizedCode);
  const winnerUserRef = doc(db, 'users', winnerUid);

  const paperSnap = await getDoc(paperRef);
  if (!paperSnap.exists()) throw new Error('Paper submission not found');

  const batch = writeBatch(db);

  // 1. Mark winning paper as approved
  batch.update(paperRef, {
    status: 'approved',
    reviewedAt: new Date().toISOString(),
  });

  // 2. Award GoCoins to winner
  batch.update(winnerUserRef, {
    goCoins: increment(rewardAmount),
    totalGoCoinsEarned: increment(rewardAmount),
  });

  // 3. Mark course as collected
  batch.update(bountyRef, {
    isCollected: true,
    winnerUid,
    winnerPaperId: paperId,
    updatedAt: new Date().toISOString(),
  });

  // 4. Close all other pending submissions for this course
  const otherPapersQuery = query(
    examPapersCol,
    where('courseCode', '==', normalizedCode),
    where('status', '==', 'pending')
  );
  const otherPapersSnap = await getDocs(otherPapersQuery);

  otherPapersSnap.docs.forEach((d) => {
    if (d.id !== paperId) {
      batch.update(d.ref, {
        status: 'not_selected',
        reviewedAt: new Date().toISOString(),
      });
    }
  });

  await batch.commit();

  // 5. Send notification to winner
  await createNotification({
    type: 'paper_approved',
    userId: winnerUid,
    triggerUid: 'ADMIN',
    triggerDisplayName: 'GoBoard Campaign',
    projectId: paperId,
    projectTitle: `${normalizedCode} Exam Paper`,
    message: `🎉 Your ${normalizedCode} exam paper was chosen as the winner! +${rewardAmount} GoCoins awarded to your wallet.`,
    previewText: `Congratulations! Your submission for ${normalizedCode} was selected based on lighting and upload speed.`,
    viewedAt: null,
    link: { type: 'campaign', id: paperId },
  });

  // 6. Send polite notification to other submitters
  for (const d of otherPapersSnap.docs) {
    if (d.id !== paperId) {
      const data = d.data();
      if (data.authorUid && data.authorUid !== winnerUid) {
        await createNotification({
          type: 'paper_closed',
          userId: data.authorUid,
          triggerUid: 'ADMIN',
          triggerDisplayName: 'GoBoard Campaign',
          projectId: d.id,
          projectTitle: `${normalizedCode} Exam Paper`,
          message: `Another submission was chosen for ${normalizedCode} based on lighting and upload speed.`,
          previewText: `Thank you for contributing! Keep an eye on open course bounties to snap more papers.`,
          viewedAt: null,
          link: { type: 'campaign', id: d.id },
        });
      }
    }
  }
}

export async function rejectCoursePaper(
  paperId: string,
  reason: string,
  courseCode: string,
  authorUid: string
): Promise<void> {
  const normalizedCode = normalizeCourseCode(courseCode);
  const paperRef = doc(db, 'examPapers', paperId);
  const bountyRef = doc(db, 'courseBounties', normalizedCode);

  const batch = writeBatch(db);

  batch.update(paperRef, {
    status: 'rejected',
    rejectionReason: reason,
    reviewedAt: new Date().toISOString(),
  });

  // Decrement submissionCount so slot opens up for another student
  batch.update(bountyRef, {
    submissionCount: increment(-1),
    updatedAt: new Date().toISOString(),
  });

  await batch.commit();

  await createNotification({
    type: 'rejection',
    userId: authorUid,
    triggerUid: 'ADMIN',
    triggerDisplayName: 'Admin',
    projectId: paperId,
    projectTitle: `${normalizedCode} Exam Paper`,
    message: `Your ${normalizedCode} paper submission was not accepted`,
    previewText: reason || 'Image was blurry or unreadable. A slot has been reopened.',
    viewedAt: null,
    link: { type: 'campaign', id: paperId },
  });
}

export async function updateStudentVerification(
  userId: string,
  status: StudentVerificationStatus,
  rejectionReason?: string
): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    verificationStatus: status,
    verificationRejectionReason: rejectionReason || null,
  });

  if (status === 'verified') {
    await createNotification({
      type: 'id_verified',
      userId,
      triggerUid: 'ADMIN',
      triggerDisplayName: 'GoBoard Admin',
      projectId: userId,
      projectTitle: 'Student ID Verification',
      message: '✅ Your Student ID has been verified! You are now qualified for Payday cashouts.',
      previewText: 'Your Verified GoUni Student badge is now active on your profile.',
      viewedAt: null,
      link: { type: 'profile', id: userId },
    });
  } else if (status === 'rejected') {
    await createNotification({
      type: 'id_rejected',
      userId,
      triggerUid: 'ADMIN',
      triggerDisplayName: 'GoBoard Admin',
      projectId: userId,
      projectTitle: 'Student ID Verification',
      message: '❌ Your Student ID card photo could not be verified.',
      previewText: rejectionReason || 'Please re-upload a clear photo of your student ID card.',
      viewedAt: null,
      link: { type: 'profile', id: userId },
    });
  }
}

export async function updateBankDetails(
  userId: string,
  bankDetails: BankDetails
): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    bankDetails: {
      ...bankDetails,
      updatedAt: new Date().toISOString(),
    },
  });
}

export async function updateDiscordProfile(
  userId: string,
  profileData: {
    bannerPreset?: string;
    bannerUrl?: string | null;
    bio?: string;
    department?: string;
    academicLevel?: string;
    accentColor?: string;
  }
): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, profileData);
}

export async function markStudentAsPaid(
  studentUid: string,
  adminUid: string,
  coinsToDeduct: number,
  nairaAmount: number,
  bankDetails: BankDetails,
  seasonNumber = 1
): Promise<void> {
  const studentRef = doc(db, 'users', studentUid);
  const payoutRef = doc(payoutsCol);

  const studentSnap = await getDoc(studentRef);
  const studentData = studentSnap.data() || {};
  const studentName = studentData.displayName || 'Student';

  const batch = writeBatch(db);

  // 1. Deduct paid coins
  batch.update(studentRef, {
    goCoins: increment(-coinsToDeduct),
  });

  // 2. Record payout log
  batch.set(payoutRef, {
    userId: studentUid,
    displayName: studentName,
    coinsPaid: coinsToDeduct,
    nairaAmount,
    bankDetails,
    seasonNumber,
    paidAt: new Date().toISOString(),
    paidBy: adminUid,
  });

  await batch.commit();

  // 3. Notify student
  await createNotification({
    type: 'payday_paid',
    userId: studentUid,
    triggerUid: adminUid,
    triggerDisplayName: 'GoBoard Payday',
    projectId: payoutRef.id,
    projectTitle: 'Payday Reward Paid',
    message: `🎉 Payday! ₦${nairaAmount.toLocaleString()} (${coinsToDeduct} GoCoins) has been transferred to your ${bankDetails.bankName} account.`,
    previewText: `Account: ${bankDetails.accountNumber} (${bankDetails.accountName})`,
    viewedAt: null,
    link: { type: 'profile', id: studentUid },
  });
}

