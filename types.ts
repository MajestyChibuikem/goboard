export enum Category {
  WEB = 'Web Development',
  MOBILE = 'Mobile App',
  AI = 'Artificial Intelligence',
  IOT = 'IoT & Hardware',
  GAME = 'Game Development',
  DATA = 'Data Science'
}

export interface Comment {
  id: string;
  author: string; // Generated anonymous name or user display name
  content: string;
  date: string;
  authorUid?: string; // User ID for permission checks
  parentUpdateId?: string | null; // null = global comment, else = update ID
  parentCommentId?: string | null; // null = root comment, else = parent comment ID
}

export interface Notification {
  id: string;
  type: 'approval' | 'rejection' | 'comment' | 'reply' | 'mention';
  userId: string;
  triggerUid: string;
  triggerDisplayName: string;
  projectId: string;
  projectTitle: string;
  commentId?: string;
  parentUpdateId?: string | null;
  parentCommentId?: string;
  previewText: string;
  message: string;
  viewedAt?: string | null;
  createdAt: string;
  expiresAt: string;
  link?: {
    type: 'project' | 'profile';
    id: string;
  };
}

export interface Project {
  id: string;
  title: string;
  description: string;
  studentName: string; // Legacy field for backward compatibility
  displayName?: string; // NEW: Auto-filled from user's displayName
  level: string;
  category: Category;
  techStack: string[];
  imageUrl: string;
  screenshots: string[]; // Additional images
  likes: number;
  demoUrl?: string;
  repoUrl?: string;
  websiteUrl?: string; // NEW: Optional project website
  datePosted: string;
  comments: Comment[];
  status: ProjectStatus;
  updates: ProjectUpdate[];
  // Optional fields persisted in Firestore for auth/approval flows
  authorUid?: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
}

export type ProjectStatus = 'idea' | 'in-progress' | 'beta' | 'launched';

export interface ProjectUpdate {
  id: string;
  content: string;
  imageUrl?: string;
  date: string;
  milestone?: string; // e.g. "MVP Ready", "First 10 Users", "Design Complete"
  authorUid?: string; // NEW: Track who posted the update
}

export interface GeminiInsight {
  review: string;
  impact: string;
  suggestion: string;
}

export interface Badge {
  label: string;
  color: string;
  icon: string;
}

export interface BoardNotice {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
  updatedBy?: string;
}
