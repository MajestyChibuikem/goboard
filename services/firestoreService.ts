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
  arrayRemove,
  runTransaction,
  setDoc,
  limit,
} from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth } from './firebase';
import { reportXpEvent, approveCampaignSubmissionOnServer } from './xpClient';
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
  GitHubProfileData,
  ProjectGitHubMeta,
  ProjectContributor,
  CampaignSubmission,
} from '../types';
import { generateSlug, cleanOldFirebaseUrl, getRank } from './utils';
import { fetchGitHubRepoMetadata, parseGitHubRepoUrl } from './githubService';

// ─── Collection refs ───

const projectsCol = collection(db, 'projects');
const usersCol = collection(db, 'users');
const votesCol = collection(db, 'votes');
const examPapersCol = collection(db, 'examPapers');
const courseBountiesCol = collection(db, 'courseBounties');
const payoutsCol = collection(db, 'payouts');
const campaignSubmissionsCol = collection(db, 'campaignSubmissions');
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
    ...(d.openToContributions !== undefined && { openToContributions: Boolean(d.openToContributions) }),
    ...(Array.isArray(d.contributionAreas) && { contributionAreas: d.contributionAreas }),
    ...(d.githubMeta && { githubMeta: d.githubMeta }),
    ...(Array.isArray(d.contributorUids) && { contributorUids: d.contributorUids }),
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

  let fallbackUnsub: (() => void) | undefined;

  const unsub = onSnapshot(
    q,
    (snapshot) => {
      let projects = snapshot.docs.map(projectFromDoc);

      // Filter out suspended projects unless user is admin or author
      if (!isAdmin) {
        projects = projects.filter(p => !p.isSuspended || (userId && p.authorUid === userId));
      }

      callback(projects);
    },
    (err) => {
      console.warn('subscribeToProjects index warning, falling back to in-memory sort:', err);
      if (approvalFilter !== 'all') {
        const fallbackQ = query(projectsCol, where('approvalStatus', '==', approvalFilter));
        fallbackUnsub = onSnapshot(
          fallbackQ,
          (snapshot) => {
            let projects = snapshot.docs.map(projectFromDoc);
            if (!isAdmin) {
              projects = projects.filter(p => !p.isSuspended || (userId && p.authorUid === userId));
            }
            projects.sort((a, b) => new Date(b.datePosted).getTime() - new Date(a.datePosted).getTime());
            callback(projects);
          },
          (fallbackErr) => {
            console.warn('subscribeToProjects fallback failed:', fallbackErr);
          }
        );
      }
    }
  );

  return () => {
    unsub();
    if (fallbackUnsub) {
      fallbackUnsub();
    }
  };
}

async function checkProjectAvailabilityClientFallback(title: string): Promise<{
  available: boolean;
  titleTaken: boolean;
  slug: string;
  message?: string;
}> {
  const normalized = title.trim().toLowerCase();
  let baseSlug = generateSlug(title);
  if (!baseSlug) baseSlug = `project-${Date.now().toString().slice(-4)}`;

  try {
    const approvedSnap = await getDocs(
      query(projectsCol, where('approvalStatus', '==', 'approved'))
    );
    const takenSlugs = new Set<string>();
    for (const d of approvedSnap.docs) {
      const data = d.data();
      const docTitleLower = String(data.titleLower || data.title || '').trim().toLowerCase();
      if (docTitleLower === normalized) {
        return {
          available: false,
          titleTaken: true,
          slug: baseSlug,
          message: 'A project with this name already exists. Please choose a different title.',
        };
      }
      if (data.slug) {
        takenSlugs.add(String(data.slug));
      }
    }

    let slug = baseSlug;
    let counter = 1;
    while (takenSlugs.has(slug)) {
      counter += 1;
      slug = `${baseSlug}-${counter}`;
    }

    return {
      available: true,
      titleTaken: false,
      slug,
    };
  } catch (err) {
    console.warn('Client availability check fallback failed, using generated slug:', err);
    return {
      available: true,
      titleTaken: false,
      slug: `${baseSlug}-${Date.now().toString().slice(-4)}`,
    };
  }
}

export async function checkProjectAvailability(title: string): Promise<{
  available: boolean;
  titleTaken: boolean;
  slug?: string;
  message?: string;
}> {
  try {
    const currentUser = auth.currentUser;
    const token = currentUser ? await currentUser.getIdToken() : '';
    const response = await fetch('/api/project-availability', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ title }),
    });

    if (response.ok) {
      const data = await response.json();
      if (!data.fallback) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Server availability check unreachable, falling back to client check:', err);
  }

  return checkProjectAvailabilityClientFallback(title);
}

export async function isProjectTitleTaken(title: string): Promise<boolean> {
  try {
    const res = await checkProjectAvailability(title);
    return res.titleTaken;
  } catch (err) {
    console.warn('Availability check fallback error:', err);
    return false;
  }
}

export async function createProject(
  data: Omit<Project, 'id' | 'likes' | 'datePosted' | 'comments' | 'screenshots' | 'updates'>,
  authorUid: string
) {
  // Enforce unique title & secure slug generation via server endpoint
  const availability = await checkProjectAvailability(data.title);
  if (availability.titleTaken) {
    throw new Error(availability.message || 'A project with this name already exists. Please choose a different title.');
  }

  const slug = availability.slug || generateSlug(data.title) || `project-${Date.now().toString().slice(-4)}`;

  // Strip any undefined top-level fields so Firestore addDoc never rejects optional fields
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  );

  const docRef = await addDoc(projectsCol, {
    ...cleanData,
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

  // Report submission event to server-authoritative XP engine
  reportXpEvent({ type: 'PROJECT_SUBMITTED', projectId: docRef.id }).catch(console.warn);

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

    // Report vote cast to server-authoritative XP engine (async, non-blocking)
    if (authorUid && authorUid !== userId) {
      reportXpEvent({ type: 'VOTE_CAST', projectId }).catch(console.warn);
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

      // Report project approval to server-authoritative XP engine
      reportXpEvent({ type: 'PROJECT_APPROVED', projectId }).catch(console.warn);
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
  GITHUB_ACTIVE_DAY: 15,
  GITHUB_REPO_CONTRIBUTION: 30,
  COMMENT_XP_DAILY_CAP: 25,
  MIN_VOTES_FOR_XP: 3,
  MIN_ACCOUNT_AGE_DAYS: 7,
} as const;

// Deprecated legacy shim - XP awards are now server-authoritative via reportXpEvent
export async function awardXP(userId: string, amount: number, action?: string) {
  console.warn('awardXP is deprecated. All XP awards are server-authoritative via reportXpEvent.');
}

// ─── Comment XP ───

export async function awardCommentXP(
  commenterId: string,
  targetId: string,
  authorUid?: string,
  targetType: 'project' | 'writing' = 'project',
  commentId?: string
) {
  return reportXpEvent({
    type: 'COMMENT_POSTED',
    targetType,
    targetId,
    commentId,
  });
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

  let fallbackUnsub: (() => void) | undefined;

  const unsub = onSnapshot(
    q,
    (snapshot) => {
      let writings = snapshot.docs.map(writingFromDoc);
      if (!isAdmin) {
        writings = writings.filter(w => !w.isSuspended || (userId && w.authorUid === userId));
      }
      callback(writings);
    },
    (err) => {
      console.warn('subscribeToWritings index warning, falling back to in-memory sort:', err);
      if (approvalFilter !== 'all') {
        const fallbackQ = query(writingsCol, where('approvalStatus', '==', approvalFilter));
        fallbackUnsub = onSnapshot(
          fallbackQ,
          (snapshot) => {
            let writings = snapshot.docs.map(writingFromDoc);
            if (!isAdmin) {
              writings = writings.filter(w => !w.isSuspended || (userId && w.authorUid === userId));
            }
            writings.sort((a, b) => new Date(b.datePosted).getTime() - new Date(a.datePosted).getTime());
            callback(writings);
          },
          (fallbackErr) => {
            console.warn('subscribeToWritings fallback failed:', fallbackErr);
          }
        );
      }
    }
  );

  return () => {
    unsub();
    if (fallbackUnsub) {
      fallbackUnsub();
    }
  };
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

  // Report writing submission to server-authoritative XP engine
  reportXpEvent({ type: 'WRITING_SUBMITTED', writingId: docRef.id }).catch(console.warn);

  return docRef.id;
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
      // Report writing approval to server-authoritative XP engine
      reportXpEvent({ type: 'WRITING_APPROVED', writingId }).catch(console.warn);
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
      reportXpEvent({ type: 'WRITING_VOTE_CAST', writingId }).catch(console.warn);
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

const CAMPAIGN_CONFIG_CACHE_KEY = 'goboard_campaign_config_v1';
const DEFAULT_PAYDAY_STORAGE_KEY = 'goboard_default_payday_iso_v1';

function getPersistentDefaultPaydayIso(): string {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const existing = window.localStorage.getItem(DEFAULT_PAYDAY_STORAGE_KEY);
      if (existing && !Number.isNaN(new Date(existing).getTime())) {
        return existing;
      }
      const created = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      window.localStorage.setItem(DEFAULT_PAYDAY_STORAGE_KEY, created);
      return created;
    }
  } catch {
    // Ignore storage access errors
  }
  return '2026-11-05T18:00:00.000Z';
}

export const DEFAULT_CAMPAIGN_CONFIG: CampaignConfig = {
  seasonNumber: 1,
  title: 'Season 1: Exam Question Paper Bounty',
  description: 'Collect exam question papers, earn 500 GoCoins per approved course, and get paid automatically on Payday!',
  rewardPerPaper: 500,
  nairaPer500Coins: 500,
  paydayDate: getPersistentDefaultPaydayIso(),
  isActive: true,
  maxSubmissionsPerCourse: 5,
};

function readCachedCampaignConfig(): CampaignConfig {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(CAMPAIGN_CONFIG_CACHE_KEY);
      if (raw) {
        return normalizeCampaignConfig(JSON.parse(raw));
      }
    }
  } catch {
    // Ignore parse/storage errors
  }
  return DEFAULT_CAMPAIGN_CONFIG;
}

function writeCachedCampaignConfig(config: CampaignConfig): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(CAMPAIGN_CONFIG_CACHE_KEY, JSON.stringify(config));
    }
  } catch {
    // Ignore storage errors
  }
}

export function normalizeCampaignConfig(raw?: Record<string, any> | null): CampaignConfig {
  if (!raw) return DEFAULT_CAMPAIGN_CONFIG;

  let paydayDate = DEFAULT_CAMPAIGN_CONFIG.paydayDate;
  const rawDate = raw.paydayDate;
  if (rawDate) {
    if (typeof rawDate?.toDate === 'function') {
      paydayDate = rawDate.toDate().toISOString();
    } else if (typeof rawDate?.seconds === 'number') {
      paydayDate = new Date(rawDate.seconds * 1000).toISOString();
    } else {
      const parsed = new Date(rawDate);
      if (!Number.isNaN(parsed.getTime())) {
        paydayDate = parsed.toISOString();
      }
    }
  }

  return {
    ...DEFAULT_CAMPAIGN_CONFIG,
    ...raw,
    seasonNumber: Number(raw.seasonNumber ?? DEFAULT_CAMPAIGN_CONFIG.seasonNumber),
    rewardPerPaper: Number(raw.rewardPerPaper ?? DEFAULT_CAMPAIGN_CONFIG.rewardPerPaper),
    nairaPer500Coins: Number(raw.nairaPer500Coins ?? DEFAULT_CAMPAIGN_CONFIG.nairaPer500Coins),
    maxSubmissionsPerCourse: Number(raw.maxSubmissionsPerCourse ?? DEFAULT_CAMPAIGN_CONFIG.maxSubmissionsPerCourse),
    isActive: raw.isActive ?? DEFAULT_CAMPAIGN_CONFIG.isActive,
    paydayDate,
  };
}

export function normalizeCourseCode(code: string): string {
  if (!code) return '';
  // Strip slashes and non-alphanumeric characters so it is always a safe Firestore doc ID
  const clean = code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const match = clean.match(/^([A-Z]+)\s*(\d+[A-Z]?)$/);
  if (match) {
    return `${match[1]} ${match[2]}`;
  }
  return clean;
}

export async function getCampaignConfig(): Promise<CampaignConfig> {
  try {
    const snap = await getDoc(campaignConfigDoc);
    if (snap.exists()) {
      const normalized = normalizeCampaignConfig(snap.data());
      writeCachedCampaignConfig(normalized);
      return normalized;
    }
    return readCachedCampaignConfig();
  } catch (err) {
    console.warn('Failed to fetch campaign config, using cached/default:', err);
    return readCachedCampaignConfig();
  }
}

export function subscribeToCampaignConfig(callback: (config: CampaignConfig) => void) {
  // Emit cached/default immediately so UI has a stable date before network roundtrip
  callback(readCachedCampaignConfig());

  return onSnapshot(
    campaignConfigDoc,
    (snap) => {
      if (snap.exists()) {
        const normalized = normalizeCampaignConfig(snap.data());
        writeCachedCampaignConfig(normalized);
        callback(normalized);
      } else {
        callback(readCachedCampaignConfig());
      }
    },
    (err) => {
      console.warn('Campaign config listener fallback:', err);
      callback(readCachedCampaignConfig());
    }
  );
}

export async function updateCampaignConfig(
  updates: Partial<CampaignConfig>,
  adminUid: string
): Promise<void> {
  const current = readCachedCampaignConfig();
  const nextConfig = normalizeCampaignConfig({
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
    updatedBy: adminUid,
  });

  writeCachedCampaignConfig(nextConfig);

  await setDoc(
    campaignConfigDoc,
    nextConfig,
    { merge: true }
  );
}

export function subscribeToCourseBounties(callback: (bounties: CourseBountySummary[]) => void) {
  const q = query(courseBountiesCol, orderBy('updatedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const bounties = snap.docs.map(d => ({
        courseCode: d.id,
        ...d.data(),
      } as CourseBountySummary));
      callback(bounties);
    },
    (err) => {
      console.warn('subscribeToCourseBounties error:', err);
      callback([]);
    }
  );
}

function examPaperFromDoc(d: any): ExamPaperSubmission {
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
  };
}

export function subscribeToExamPapers(
  callback: (papers: ExamPaperSubmission[]) => void,
  statusFilter: 'all' | 'pending' | 'approved' = 'all'
) {
  const q = statusFilter === 'all'
    ? query(examPapersCol, orderBy('createdAt', 'desc'))
    : query(examPapersCol, where('status', '==', statusFilter));

  return onSnapshot(
    q,
    (snap) => {
      const papers = snap.docs
        .map(examPaperFromDoc)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(papers);
    },
    (err) => {
      console.warn('subscribeToExamPapers error:', err);
      callback([]);
    }
  );
}

export function subscribeToUserExamPapers(
  userId: string,
  callback: (papers: ExamPaperSubmission[]) => void
) {
  const q = query(examPapersCol, where('authorUid', '==', userId));
  return onSnapshot(
    q,
    (snap) => {
      const papers = snap.docs
        .map(examPaperFromDoc)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(papers);
    },
    (err) => {
      console.warn('subscribeToUserExamPapers error:', err);
      callback([]);
    }
  );
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

  // Use a transaction to guard against double-clicking or concurrent approvals
  await runTransaction(db, async (tx) => {
    const [paperSnap, bountySnap] = await Promise.all([
      tx.get(paperRef),
      tx.get(bountyRef),
    ]);

    if (!paperSnap.exists()) {
      throw new Error('Paper submission not found.');
    }
    if (paperSnap.data().status === 'approved') {
      throw new Error('This paper submission has already been approved.');
    }
    if (bountySnap.exists() && bountySnap.data().isCollected) {
      throw new Error(`A winner has already been selected for ${normalizedCode}.`);
    }

    const nowIso = new Date().toISOString();

    // 1. Mark winning paper as approved
    tx.update(paperRef, {
      status: 'approved',
      reviewedAt: nowIso,
    });

    // 2. Award GoCoins to winner
    tx.update(winnerUserRef, {
      goCoins: increment(rewardAmount),
      totalGoCoinsEarned: increment(rewardAmount),
    });

    // 3. Mark course as collected
    tx.set(
      bountyRef,
      {
        courseCode: normalizedCode,
        isCollected: true,
        winnerUid,
        winnerPaperId: paperId,
        updatedAt: nowIso,
      },
      { merge: true }
    );
  });

  // 4. Close all other pending submissions for this course (single-field query to avoid composite index)
  const coursePapersQuery = query(
    examPapersCol,
    where('courseCode', '==', normalizedCode)
  );
  const coursePapersSnap = await getDocs(coursePapersQuery);
  const otherPendingDocs = coursePapersSnap.docs.filter(
    (d) => d.id !== paperId && d.data().status === 'pending'
  );

  if (otherPendingDocs.length > 0) {
    const batch = writeBatch(db);
    const nowIso = new Date().toISOString();
    otherPendingDocs.forEach((d) => {
      batch.update(d.ref, {
        status: 'not_selected',
        reviewedAt: nowIso,
      });
    });
    await batch.commit();
  }

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
  for (const d of otherPendingDocs) {
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

export async function rejectCoursePaper(
  paperId: string,
  reason: string,
  courseCode: string,
  authorUid: string
): Promise<void> {
  const normalizedCode = normalizeCourseCode(courseCode);
  const paperRef = doc(db, 'examPapers', paperId);
  const bountyRef = doc(db, 'courseBounties', normalizedCode);

  await runTransaction(db, async (tx) => {
    const [paperSnap, bountySnap] = await Promise.all([
      tx.get(paperRef),
      tx.get(bountyRef),
    ]);

    if (!paperSnap.exists()) {
      throw new Error('Paper submission not found.');
    }
    if (paperSnap.data().status !== 'pending') {
      throw new Error('Only pending submissions can be rejected.');
    }

    const nowIso = new Date().toISOString();
    tx.update(paperRef, {
      status: 'rejected',
      rejectionReason: reason,
      reviewedAt: nowIso,
    });

    if (bountySnap.exists()) {
      const currentCount = bountySnap.data().submissionCount || 0;
      tx.update(bountyRef, {
        submissionCount: Math.max(0, currentCount - 1),
        submittedUserIds: arrayRemove(authorUid),
        updatedAt: nowIso,
      });
    }
  });

  await createNotification({
    type: 'rejection',
    userId: authorUid,
    triggerUid: 'ADMIN',
    triggerDisplayName: 'Admin',
    projectId: paperId,
    projectTitle: `${normalizedCode} Exam Paper`,
    message: `Your ${normalizedCode} paper submission was not accepted`,
    previewText: reason || 'Image was blurry or unreadable. Your slot has been reopened so you can re-upload a clearer photo.',
    viewedAt: null,
    link: { type: 'campaign', id: paperId },
  });
}

export function subscribeToPendingVerifications(callback: (users: any[]) => void) {
  const q = query(usersCol, where('verificationStatus', '==', 'pending'));
  return onSnapshot(
    q,
    (snap) => {
      const users = snap.docs.map(d => {
        const data = d.data();
        return {
          uid: d.id,
          ...data,
          photoURL: cleanOldFirebaseUrl(data.photoURL),
          studentIdCardUrl: cleanOldFirebaseUrl(data.studentIdCardUrl),
        };
      });
      callback(users);
    },
    (err) => {
      console.warn('subscribeToPendingVerifications error:', err);
      callback([]);
    }
  );
}

export function subscribeToUsersWithGoCoins(callback: (users: any[]) => void) {
  const q = query(usersCol, where('goCoins', '>', 0));
  return onSnapshot(
    q,
    (snap) => {
      const users = snap.docs
        .map(d => {
          const data = d.data();
          return {
            uid: d.id,
            ...data,
            photoURL: cleanOldFirebaseUrl(data.photoURL),
            studentIdCardUrl: cleanOldFirebaseUrl(data.studentIdCardUrl),
          };
        })
        .sort((a: any, b: any) => (b.goCoins || 0) - (a.goCoins || 0));
      callback(users);
    },
    (err) => {
      console.warn('subscribeToUsersWithGoCoins error:', err);
      callback([]);
    }
  );
}

export function subscribeToPayoutHistory(callback: (payouts: PayoutRecord[]) => void) {
  const q = query(payoutsCol, orderBy('paidAt', 'desc'), limit(50));
  return onSnapshot(
    q,
    (snap) => {
      const records = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      } as PayoutRecord));
      callback(records);
    },
    (err) => {
      console.warn('subscribeToPayoutHistory error:', err);
      callback([]);
    }
  );
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
    bannerCustomGradient?: string | null;
    bio?: string;
    department?: string;
    academicLevel?: string;
    accentColor?: string;
  }
): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, profileData);
}

export async function saveOnboardingDraftFields(
  userId: string,
  fields: {
    displayName?: string;
    department?: string;
    academicLevel?: string;
    interests?: string[];
  }
): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, fields);
}

export async function markStudentAsPaid(
  studentUid: string,
  adminUid: string,
  coinsToDeduct: number,
  nairaAmount: number,
  bankDetails: BankDetails,
  seasonNumber = 1
): Promise<void> {
  if (coinsToDeduct <= 0) {
    throw new Error('Coins to deduct must be greater than 0.');
  }

  const studentRef = doc(db, 'users', studentUid);
  const payoutRef = doc(payoutsCol);

  await runTransaction(db, async (tx) => {
    const studentSnap = await tx.get(studentRef);
    if (!studentSnap.exists()) {
      throw new Error('Student profile not found.');
    }

    const studentData = studentSnap.data();
    const currentCoins = studentData.goCoins || 0;
    if (currentCoins < coinsToDeduct) {
      throw new Error(`Student only has ${currentCoins} GoCoins available.`);
    }

    const studentName = studentData.displayName || 'Student';

    // 1. Deduct paid coins safely
    tx.update(studentRef, {
      goCoins: currentCoins - coinsToDeduct,
    });

    // 2. Record payout log
    tx.set(payoutRef, {
      userId: studentUid,
      displayName: studentName,
      coinsPaid: coinsToDeduct,
      nairaAmount,
      bankDetails,
      seasonNumber,
      paidAt: new Date().toISOString(),
      paidBy: adminUid,
    });
  });

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

// ─── GitHub Integration, Open-Source Collaboration & Activity Tracking ───

export async function saveUserGitHubProfile(
  userId: string,
  fallbackProfile?: GitHubProfileData
): Promise<{ xpAwarded: number; updatedProfile: GitHubProfileData }> {
  // Server is the sole authoritative writer of GitHub data and activity XP
  const res = await reportXpEvent({ type: 'GITHUB_SYNC' });
  const finalProfile = res.profile || fallbackProfile;
  if (!finalProfile) {
    throw new Error(res.error || 'Failed to sync GitHub profile with server.');
  }
  return { xpAwarded: res.awarded || 0, updatedProfile: finalProfile };
}

export async function disconnectUserGitHubProfile(userId: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    githubProfile: null,
    githubUsernameLower: null,
  });
}

/**
 * Matches a list of GitHub repository contributors against GoBoard users who have connected their GitHub accounts.
 */
export async function matchGitHubContributorsToUsers(
  contributors: ProjectContributor[]
): Promise<{ matchedContributors: ProjectContributor[]; contributorUids: string[] }> {
  if (!contributors || contributors.length === 0) {
    return { matchedContributors: [], contributorUids: [] };
  }

  const lowerNames = Array.from(
    new Set(contributors.map((c) => c.githubUsername.toLowerCase()).filter(Boolean))
  ).slice(0, 30);

  const userMap = new Map<
    string,
    { uid: string; displayName: string; photoURL: string | null; rank: string }
  >();

  // Firestore 'in' queries support up to 30 items
  try {
    if (lowerNames.length > 0) {
      const q = query(usersCol, where('githubUsernameLower', 'in', lowerNames));
      const snap = await getDocs(q);
      snap.docs.forEach((d) => {
        const data = d.data();
        const ghLower = String(
          data.githubUsernameLower || data.githubProfile?.username || ''
        ).toLowerCase();
        if (ghLower) {
          userMap.set(ghLower, {
            uid: d.id,
            displayName: data.displayName || 'Student',
            photoURL: cleanOldFirebaseUrl(data.photoURL) || null,
            rank: getRank(data.xp || 0),
          });
        }
      });
    }
  } catch (err) {
    console.warn('matchGitHubContributorsToUsers lookup error:', err);
  }

  const contributorUidsSet = new Set<string>();
  const matchedContributors: ProjectContributor[] = contributors.map((c) => {
    const match = userMap.get(c.githubUsername.toLowerCase());
    if (match) {
      contributorUidsSet.add(match.uid);
      return {
        ...c,
        goboardUid: match.uid,
        goboardDisplayName: match.displayName,
        goboardPhotoURL: match.photoURL,
        goboardRank: match.rank,
      };
    }
    return c;
  });

  return {
    matchedContributors,
    contributorUids: Array.from(contributorUidsSet),
  };
}

/**
 * Fetches live repository metadata + contributors from GitHub, matches contributors to GoBoard students,
 * and saves the snapshot on the project document in Firestore.
 */
export async function syncAndSaveProjectGitHub(
  projectId: string,
  repoUrl: string,
  options?: {
    openToContributions?: boolean;
    contributionAreas?: string[];
    accessToken?: string;
  }
): Promise<{ githubMeta: ProjectGitHubMeta; contributorUids: string[] }> {
  const parsed = parseGitHubRepoUrl(repoUrl);
  if (!parsed) {
    throw new Error('Please provide a valid GitHub repository URL.');
  }

  const { meta } = await fetchGitHubRepoMetadata(repoUrl, options?.accessToken);
  const { matchedContributors, contributorUids } = await matchGitHubContributorsToUsers(
    meta.contributors
  );

  const enrichedMeta: ProjectGitHubMeta = {
    ...meta,
    contributors: matchedContributors,
  };

  const updates: Record<string, any> = {
    githubMeta: enrichedMeta,
    contributorUids,
  };

  if (options?.openToContributions !== undefined) {
    updates.openToContributions = options.openToContributions;
  }
  if (options?.contributionAreas !== undefined) {
    updates.contributionAreas = options.contributionAreas;
  }

  const projectRef = doc(db, 'projects', projectId);
  await updateDoc(projectRef, updates);

  return { githubMeta: enrichedMeta, contributorUids };
}

export async function updateProjectCollaborationSettings(
  projectId: string,
  userId: string,
  settings: {
    openToContributions: boolean;
    contributionAreas: string[];
    repoUrl?: string;
  }
): Promise<void> {
  const projectRef = doc(db, 'projects', projectId);
  const snap = await getDoc(projectRef);
  if (!snap.exists()) throw new Error('Project not found');
  const data = snap.data();
  if (data.authorUid !== userId) {
    throw new Error('Only the project author can update collaboration settings');
  }

  const updates: Record<string, any> = {
    openToContributions: settings.openToContributions,
    contributionAreas: settings.contributionAreas,
  };
  if (settings.repoUrl !== undefined) {
    updates.repoUrl = settings.repoUrl.trim() || null;
  }

  await updateDoc(projectRef, updates);
}

/**
 * Returns approved GoBoard projects where the user is a verified GitHub contributor
 * (excluding projects authored by the user themselves, so their own projects and open-source contributions stay distinct).
 */
export async function getUserContributedProjects(userId: string): Promise<Project[]> {
  try {
    const q = query(projectsCol, where('contributorUids', 'array-contains', userId));
    const snap = await getDocs(q);
    return snap.docs
      .map(projectFromDoc)
      .filter((p) => p.authorUid !== userId && !p.isSuspended && p.approvalStatus === 'approved');
  } catch (err) {
    console.warn('getUserContributedProjects error:', err);
    return [];
  }
}

/**
 * Real-time listener for top active GitHub student builders on GoBoard.
 */
export function subscribeToTopGitHubBuilders(
  callback: (
    users: {
      uid: string;
      displayName: string;
      photoURL: string | null;
      xp: number;
      rank: string;
      githubProfile: GitHubProfileData;
    }[]
  ) => void,
  count = 10
) {
  const q = query(usersCol, orderBy('xp', 'desc'), limit(50));
  return onSnapshot(
    q,
    (snapshot) => {
      const builders = snapshot.docs
        .map((d) => {
          const data = d.data();
          if (!data.githubProfile || !data.githubProfile.username) return null;
          return {
            uid: d.id,
            displayName: data.displayName || 'Student',
            photoURL: cleanOldFirebaseUrl(data.photoURL) || null,
            xp: data.xp || 0,
            rank: getRank(data.xp || 0),
            githubProfile: data.githubProfile as GitHubProfileData,
          };
        })
        .filter(Boolean) as {
        uid: string;
        displayName: string;
        photoURL: string | null;
        xp: number;
        rank: string;
        githubProfile: GitHubProfileData;
      }[];

      // Sort by 30-day active coding days, then 30-day commits, then total stars
      builders.sort((a, b) => {
        const daysDiff =
          (b.githubProfile.activeCodingDays30d || 0) -
          (a.githubProfile.activeCodingDays30d || 0);
        if (daysDiff !== 0) return daysDiff;
        const commitsDiff =
          (b.githubProfile.recentCommits30d || 0) -
          (a.githubProfile.recentCommits30d || 0);
        if (commitsDiff !== 0) return commitsDiff;
        return (b.githubProfile.totalStars || 0) - (a.githubProfile.totalStars || 0);
      });

      callback(builders.slice(0, count));
    },
    (err) => {
      console.warn('subscribeToTopGitHubBuilders error:', err);
      callback([]);
    }
  );
}

// ─── GoUni Prayer Book Redesign Campaign Submissions ───

function campaignSubmissionFromDoc(docSnap: any): CampaignSubmission {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    campaignId: d.campaignId || 'prayer_book_s1',
    authorUid: d.authorUid || '',
    displayName: d.displayName || 'Student',
    authorPhotoURL: cleanOldFirebaseUrl(d.authorPhotoURL) || null,
    teamSize: d.teamSize === 'duo' ? 'duo' : 'solo',
    partnerUsername: d.partnerUsername || null,
    partnerUid: d.partnerUid || null,
    repoUrl: d.repoUrl || '',
    figmaUrl: d.figmaUrl || '',
    pitchSummary: d.pitchSummary || '',
    screenshots: Array.isArray(d.screenshots)
      ? (d.screenshots.map(cleanOldFirebaseUrl).filter(Boolean) as string[])
      : [],
    likes: Number(d.likes) || 0,
    votedUserIds: Array.isArray(d.votedUserIds) ? d.votedUserIds : [],
    status: d.status || 'pending',
    rejectionReason: d.rejectionReason || undefined,
    createdAt: tsToISO(d.createdAt),
    reviewedAt: d.reviewedAt || undefined,
    reviewedBy: d.reviewedBy || undefined,
  };
}

export async function submitCampaignDesign(params: {
  authorUid: string;
  displayName: string;
  authorPhotoURL?: string | null;
  teamSize: 'solo' | 'duo';
  partnerUsername?: string;
  repoUrl: string;
  figmaUrl: string;
  pitchSummary: string;
  screenshotFiles: File[];
}): Promise<string> {
  // Check if user already submitted a pending/approved entry for prayer_book_s1
  const existingQ = query(
    campaignSubmissionsCol,
    where('authorUid', '==', params.authorUid),
    where('campaignId', '==', 'prayer_book_s1')
  );
  const existingSnap = await getDocs(existingQ);
  const activeExisting = existingSnap.docs.find(
    (d) => d.data().status === 'pending' || d.data().status === 'approved' || d.data().status === 'winner'
  );
  if (activeExisting) {
    throw new Error('You already have an active submission for the GoUni Prayer Book Redesign Campaign.');
  }

  // Upload screenshots to Cloudinary
  const uploadedUrls: string[] = [];
  for (const file of params.screenshotFiles.slice(0, 5)) {
    const url = await uploadToCloudinary(file);
    uploadedUrls.push(url);
  }

  // Resolve partnerUid if duo
  let partnerUid: string | null = null;
  const cleanPartner = (params.partnerUsername || '').replace(/^@/, '').trim();
  if (params.teamSize === 'duo' && cleanPartner) {
    try {
      const ghQ = query(
        usersCol,
        where('githubUsernameLower', '==', cleanPartner.toLowerCase()),
        limit(1)
      );
      const ghSnap = await getDocs(ghQ);
      if (!ghSnap.empty) {
        partnerUid = ghSnap.docs[0].id;
      } else {
        const byName = await findUserByDisplayName(cleanPartner);
        if (byName) partnerUid = byName.uid;
      }
    } catch {
      // Optional resolution
    }
  }

  const docRef = await addDoc(campaignSubmissionsCol, {
    campaignId: 'prayer_book_s1',
    authorUid: params.authorUid,
    displayName: params.displayName,
    authorPhotoURL: params.authorPhotoURL || null,
    teamSize: params.teamSize,
    partnerUsername: params.teamSize === 'duo' && cleanPartner ? cleanPartner : null,
    partnerUid: params.teamSize === 'duo' ? partnerUid : null,
    repoUrl: params.repoUrl.trim(),
    figmaUrl: params.figmaUrl.trim(),
    pitchSummary: params.pitchSummary.trim(),
    screenshots: uploadedUrls,
    likes: 0,
    votedUserIds: [],
    status: 'pending',
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}

export function subscribeToCampaignSubmissions(
  callback: (submissions: CampaignSubmission[]) => void,
  filterStatus: 'approved_or_winner' | 'pending' | 'all' = 'approved_or_winner',
  currentUserId?: string
) {
  let q;
  if (filterStatus === 'pending') {
    q = query(campaignSubmissionsCol, where('status', '==', 'pending'));
  } else if (filterStatus === 'all') {
    q = query(campaignSubmissionsCol, orderBy('createdAt', 'desc'));
  } else {
    q = query(campaignSubmissionsCol, where('status', 'in', ['approved', 'winner']));
  }

  const unsub = onSnapshot(
    q,
    async (snap) => {
      const items = snap.docs.map(campaignSubmissionFromDoc);
      // If currentUserId is provided and filterStatus is approved_or_winner, also include the user's own submission so they can see its status
      if (filterStatus === 'approved_or_winner' && currentUserId) {
        try {
          const ownQ = query(campaignSubmissionsCol, where('authorUid', '==', currentUserId));
          const ownSnap = await getDocs(ownQ);
          ownSnap.docs.forEach((d) => {
            if (!items.some((x) => x.id === d.id)) {
              items.push(campaignSubmissionFromDoc(d));
            }
          });
        } catch {
          // ignore
        }
      }
      items.sort((a, b) => {
        if (a.status === 'winner' && b.status !== 'winner') return -1;
        if (b.status === 'winner' && a.status !== 'winner') return 1;
        if (b.likes !== a.likes) return b.likes - a.likes;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      callback(items);
    },
    (err) => {
      console.warn('subscribeToCampaignSubmissions error:', err);
      callback([]);
    }
  );

  return unsub;
}

export async function toggleCampaignSubmissionVote(
  submissionId: string,
  userId: string
): Promise<boolean> {
  const subRef = doc(campaignSubmissionsCol, submissionId);
  return await runTransaction(db, async (tx) => {
    const snap = await tx.get(subRef);
    if (!snap.exists()) throw new Error('Submission not found');
    const data = snap.data();
    const votedUserIds: string[] = Array.isArray(data.votedUserIds) ? data.votedUserIds : [];
    const alreadyVoted = votedUserIds.includes(userId);
    const currentLikes = Number(data.likes) || 0;

    if (alreadyVoted) {
      tx.update(subRef, {
        likes: Math.max(0, currentLikes - 1),
        votedUserIds: arrayRemove(userId),
      });
      return false;
    } else {
      tx.update(subRef, {
        likes: currentLikes + 1,
        votedUserIds: arrayUnion(userId),
      });
      return true;
    }
  });
}

export async function approveCampaignSubmission(
  submissionId: string,
  adminUid: string
): Promise<void> {
  const subRef = doc(campaignSubmissionsCol, submissionId);
  const snap = await getDoc(subRef);
  if (!snap.exists()) throw new Error('Submission not found');
  const data = snap.data();

  await approveCampaignSubmissionOnServer(submissionId);

  if (data.authorUid) {
    await createNotification({
      type: 'campaign_approved',
      userId: data.authorUid,
      triggerUid: adminUid,
      triggerDisplayName: 'GoBoard Campaign',
      projectId: submissionId,
      projectTitle: 'GoUni Prayer Book Redesign',
      message: '🎉 Your GoUni Prayer Book redesign submission is approved and live in the Showcase! (+50 XP)',
      previewText: data.pitchSummary?.slice(0, 100) || 'View in Campaign Hub',
      viewedAt: null,
      link: { type: 'campaign', id: submissionId },
    });
  }
}

export async function rejectCampaignSubmission(
  submissionId: string,
  adminUid: string,
  reason: string
): Promise<void> {
  const subRef = doc(campaignSubmissionsCol, submissionId);
  const snap = await getDoc(subRef);
  if (!snap.exists()) throw new Error('Submission not found');
  const data = snap.data();

  await updateDoc(subRef, {
    status: 'rejected',
    rejectionReason: reason.trim() || 'Did not meet design brief requirements.',
    reviewedAt: new Date().toISOString(),
    reviewedBy: adminUid,
  });

  if (data.authorUid) {
    await createNotification({
      type: 'campaign_rejected',
      userId: data.authorUid,
      triggerUid: adminUid,
      triggerDisplayName: 'GoBoard Campaign',
      projectId: submissionId,
      projectTitle: 'GoUni Prayer Book Redesign',
      message: 'Your GoUni Prayer Book redesign submission needs revision.',
      previewText: reason.trim() || 'Check the Campaign Hub for feedback.',
      viewedAt: null,
      link: { type: 'campaign', id: submissionId },
    });
  }
}

export async function markCampaignSubmissionWinner(
  submissionId: string,
  adminUid: string
): Promise<void> {
  const subRef = doc(campaignSubmissionsCol, submissionId);
  await updateDoc(subRef, {
    status: 'winner',
    reviewedAt: new Date().toISOString(),
    reviewedBy: adminUid,
  });
}


