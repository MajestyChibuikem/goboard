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
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { db, storage, auth } from './firebase';
import { Project, Comment, ProjectUpdate, ProjectStatus, Notification, BoardNotice } from '../types';

// ─── Collection refs ───

const projectsCol = collection(db, 'projects');
const usersCol = collection(db, 'users');
const votesCol = collection(db, 'votes');

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
    title: d.title || '',
    description: d.description || '',
    studentName: d.studentName || '',
    displayName: d.displayName || d.studentName || '',
    level: d.level || '',
    category: d.category || 'Web Development',
    techStack: d.techStack || [],
    imageUrl: d.imageUrl || '',
    screenshots: d.screenshots || [],
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
  const snap = await getDoc(doc(projectsCol, projectId));
  if (!snap.exists()) return null;
  return projectFromDoc(snap);
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

  const docRef = await addDoc(projectsCol, {
    ...data,
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
  await awardXP(authorUid, XP_VALUES.SUBMIT_PROJECT);
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
    comments: [...current, comment],
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
    const parentComment = current.find(c => c.id === comment.parentCommentId);
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
      await awardXP(project.authorUid, XP_VALUES.PROJECT_APPROVED);
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

export async function awardXP(userId: string, amount: number) {
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

  await awardXP(authorUid, XP_VALUES.RECEIVE_VOTE);

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

    const milestones: { threshold: number; xp: number }[] = [
      { threshold: 10, xp: XP_VALUES.VOTE_MILESTONE_10 },
      { threshold: 50, xp: XP_VALUES.VOTE_MILESTONE_50 },
    ];

    let totalBonus = 0;
    const newAwarded = [...awarded];

    for (const m of milestones) {
      if (likes >= m.threshold && !awarded.includes(m.threshold)) {
        totalBonus += m.xp;
        newAwarded.push(m.threshold);
      }
    }

    if (totalBonus > 0) {
      transaction.update(projectRef, { xpMilestonesAwarded: newAwarded });
    }

    // XP award happens outside the project transaction to keep it simple
    // We store the bonus to apply after
    return totalBonus;
  }).then(async (bonus) => {
    if (bonus && bonus > 0) {
      await awardXP(authorUid, bonus);
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
    await awardXP(authorUid, XP_VALUES.RECEIVE_COMMENT);
  }
}

// ─── First Project Bonus ───

async function checkFirstProjectBonus(authorUid: string) {
  const q = query(projectsCol, where('authorUid', '==', authorUid));
  const snap = await getDocs(q);
  // Count is 1 because the project was just created
  if (snap.size === 1) {
    await awardXP(authorUid, XP_VALUES.FIRST_PROJECT);
  }
}

// ─── Image Upload ───

export async function uploadProjectImage(
  file: File,
  projectId: string,
  fileName?: string
): Promise<string> {
  const name = fileName || `${Date.now()}_${file.name}`;
  const storageRef = ref(storage, `projects/${projectId}/${name}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

// ─── User Profile ───

export async function uploadUserAvatar(
  userId: string,
  file: File
): Promise<string> {
  const name = `${Date.now()}_${file.name}`;
  const storageRef = ref(storage, `users/${userId}/avatar/${name}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function getUserProfile(userId: string) {
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) return null;
  return { uid: userId, ...snap.data() };
}

export async function getUserProjects(authorUid: string): Promise<Project[]> {
  const q = query(projectsCol, where('authorUid', '==', authorUid));
  const snap = await getDocs(q);
  return snap.docs.map(projectFromDoc);
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
  const mentionRegex = /@([a-zA-Z0-9\s\-\.]+)(?:\s|$|[,!?])/g;
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

export async function findUserByDisplayName(displayName: string) {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('displayName', '==', displayName));
  const snap = await getDocs(q);

  if (snap.empty) return null;
  return snap.docs[0].data();
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
