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
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import { db, storage } from './firebase';
import { Project, Comment, ProjectUpdate, ProjectStatus } from '../types';

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
    level: d.level || '',
    category: d.category || 'Web Development',
    techStack: d.techStack || [],
    imageUrl: d.imageUrl || '',
    screenshots: d.screenshots || [],
    likes: d.likes || 0,
    demoUrl: d.demoUrl || undefined,
    repoUrl: d.repoUrl || undefined,
    datePosted: tsToISO(d.datePosted),
    comments: d.comments || [],
    status: d.status || 'idea',
    updates: d.updates || [],
    // Firestore-specific fields passed through
    ...(d.authorUid && { authorUid: d.authorUid }),
    ...(d.approvalStatus && { approvalStatus: d.approvalStatus }),
  } as Project & { authorUid?: string; approvalStatus?: string };
}

// ─── Projects ───

export function subscribeToProjects(
  callback: (projects: Project[]) => void,
  approvalFilter: 'approved' | 'pending' | 'all' = 'approved'
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
    const projects = snapshot.docs.map(projectFromDoc);
    callback(projects);
  });
}

export async function createProject(
  data: Omit<Project, 'id' | 'likes' | 'datePosted' | 'comments' | 'screenshots' | 'updates'>,
  authorUid: string
) {
  const docRef = await addDoc(projectsCol, {
    ...data,
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

  const current = snap.data().comments || [];
  await updateDoc(projectRef, {
    comments: [...current, comment],
  });
}

// ─── Project Updates (Build Journey) ───

export async function addProjectUpdate(projectId: string, update: ProjectUpdate) {
  const projectRef = doc(db, 'projects', projectId);
  const snap = await getDoc(projectRef);
  if (!snap.exists()) return;

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
  await updateProjectField(projectId, { approvalStatus: 'approved' });
}

export async function rejectProject(projectId: string, reason?: string) {
  await updateProjectField(projectId, {
    approvalStatus: 'rejected',
    rejectionReason: reason || '',
  });
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

// ─── Seed Data ───

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
