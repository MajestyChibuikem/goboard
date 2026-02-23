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
  });
  return docRef.id;
}

export async function updateProjectField(projectId: string, fields: Partial<Record<string, any>>) {
  const ref = doc(db, 'projects', projectId);
  await updateDoc(ref, fields);
}

// ─── Voting ───

export async function toggleVote(projectId: string, userId: string): Promise<boolean> {
  // Vote doc ID = `${userId}_${projectId}` for uniqueness
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
    return false; // unvoted
  } else {
    // New vote
    batch.set(voteRef, {
      userId,
      projectId,
      createdAt: serverTimestamp(),
    });
    batch.update(projectRef, { likes: increment(1) });
    await batch.commit();
    return true; // voted
  }
}

export async function getUserVotes(userId: string): Promise<Set<string>> {
  const q = query(votesCol, where('userId', '==', userId));
  const snap = await getDocs(q);
  const votedProjectIds = new Set<string>();
  snap.forEach(doc => votedProjectIds.add(doc.data().projectId));
  return votedProjectIds;
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

  const current = snap.data().updates || [];
  await updateDoc(projectRef, {
    updates: [...current, update],
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

export async function awardXP(userId: string, amount: number) {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { xp: increment(amount) });
}

// XP amounts
export const XP_VALUES = {
  SUBMIT_PROJECT: 50,
  PROJECT_APPROVED: 25,
  RECEIVE_VOTE: 2,
  LEAVE_COMMENT: 5,
  RECEIVE_COMMENT: 3,
} as const;

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
