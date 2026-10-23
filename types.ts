export enum Category {
  WEB = 'Web Development',
  MOBILE = 'Mobile App',
  AI = 'Artificial Intelligence',
  IOT = 'IoT & Hardware',
  GAME = 'Game Development',
  DATA = 'Data Science',
  BLOCKCHAIN = 'Blockchain & Crypto',
  CYBERSECURITY = 'Cybersecurity',
  DEVOPS = 'DevOps & Cloud',
  AR_VR = 'AR / VR',
  FINTECH = 'FinTech',
  EDTECH = 'EdTech',
}

export interface Comment {
  id: string;
  author: string; // Generated anonymous name or user display name
  content: string;
  date: string;
  authorUid?: string; // User ID for permission checks
  authorPhotoURL?: string | null;
  parentUpdateId?: string | null; // null = global comment, else = update ID
  parentCommentId?: string | null; // null = root comment, else = parent comment ID
}

export interface Notification {
  id: string;
  type: 'approval' | 'rejection' | 'comment' | 'reply' | 'mention' | 'suspension' | 'paper_approved' | 'paper_closed' | 'id_verified' | 'id_rejected' | 'payday_paid';
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
    type: 'project' | 'writing' | 'profile' | 'campaign';
    id: string;
  };
}

export interface Project {
  id: string;
  slug?: string;
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
  authorPhotoURL?: string | null;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  // Suspension fields
  isSuspended?: boolean;
  suspendedBy?: string;
  suspendedAt?: string;
  suspensionReason?: string;
  // GitHub Open-Source Collaboration fields
  openToContributions?: boolean;
  contributionAreas?: string[];
  githubMeta?: ProjectGitHubMeta;
  contributorUids?: string[];
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

export type WritingGenre = 'short-story' | 'poem' | 'essay';

export interface Writing {
  id: string;
  title: string;
  body: string;
  genre: WritingGenre;
  authorUid?: string;
  displayName?: string;
  authorPhotoURL?: string | null;
  likes: number;
  datePosted: string;
  comments: Comment[];
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  isSuspended?: boolean;
  suspendedBy?: string;
  suspendedAt?: string;
  suspensionReason?: string;
}

// ─── Season 1 Campaign & Economy Types ───

export interface CampaignConfig {
  seasonNumber: number;
  title: string;
  description: string;
  rewardPerPaper: number; // e.g. 500 GoCoins
  nairaPer500Coins: number; // e.g. 500 GoCoins = ₦500 (or dynamic exchange rate)
  paydayDate: string; // ISO string date for countdown
  isActive: boolean;
  maxSubmissionsPerCourse: number; // default 5
  updatedAt?: string;
  updatedBy?: string;
}

export type ExamPaperStatus = 'pending' | 'approved' | 'not_selected' | 'rejected';

export interface ExamPaperSubmission {
  id: string;
  courseCode: string; // Normalized: e.g. "CSC 301"
  courseTitle: string;
  level: string; // e.g. "300 Level"
  semester: string; // e.g. "1st Semester"
  imageUrls: string[]; // Multi-page photos of the exam paper
  authorUid: string;
  displayName: string;
  authorPhotoURL?: string | null;
  slotNumber: number; // 1 to 5
  status: ExamPaperStatus;
  rejectionReason?: string;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface CourseBountySummary {
  courseCode: string; // Document ID: e.g. "CSC 301"
  courseTitle: string;
  level: string;
  submissionCount: number; // 0 to 5
  submittedUserIds: string[]; // List of UIDs who already uploaded
  isCollected: boolean; // True once winner is chosen or slots maxed/approved
  winnerUid?: string;
  winnerPaperId?: string;
  updatedAt: string;
}

export type StudentVerificationStatus = 'none' | 'pending' | 'verified' | 'rejected';

export interface BankDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
  updatedAt?: string;
}

export interface PayoutRecord {
  id: string;
  userId: string;
  displayName: string;
  coinsPaid: number;
  nairaAmount: number;
  bankDetails: BankDetails;
  seasonNumber: number;
  paidAt: string;
  paidBy: string;
}

// ─── GitHub Integration, Collaboration & Activity Types ───

export interface GitHubRepoSummary {
  id: number;
  name: string;
  fullName: string; // e.g. "chidi/shuttle-tracker"
  htmlUrl: string;
  description: string | null;
  language: string | null;
  stargazersCount: number;
  forksCount: number;
  openIssuesCount: number;
  topics: string[];
  updatedAt: string;
  pushedAt?: string;
  isPinned?: boolean;
}

export interface GitHubRecentCommit {
  repoName: string;
  sha: string;
  message: string;
  date: string;
  url: string;
}

export interface GitHubLanguageStat {
  name: string;
  count: number;
  percentage: number;
}

export interface GitHubProfileData {
  username: string; // Lowercase-normalized for matching
  displayUsername: string; // Original casing from GitHub
  githubId?: number;
  avatarUrl: string;
  profileUrl: string;
  bio?: string | null;
  publicRepos: number;
  followers: number;
  totalStars: number;
  topLanguages: GitHubLanguageStat[];
  recentCommits30d: number;
  activeCodingDays30d: number;
  lastActiveDate?: string | null;
  lastRewardedCodingDate?: string | null;
  isVerifiedOAuth: boolean;
  topRepos: GitHubRepoSummary[];
  recentCommitsList?: GitHubRecentCommit[];
  customPinnedRepoNames?: string[];
  lastSyncedAt: string;
}

export interface ProjectContributor {
  githubUsername: string;
  githubAvatarUrl: string;
  githubProfileUrl: string;
  contributions: number; // Commit count on this repository
  goboardUid?: string;
  goboardDisplayName?: string;
  goboardPhotoURL?: string | null;
  goboardRank?: string;
}

export interface ProjectGitHubMeta {
  owner: string;
  repo: string;
  fullName: string;
  htmlUrl: string;
  stars: number;
  forks: number;
  openIssues: number;
  language: string | null;
  languages: string[];
  lastCommitDate?: string | null;
  lastCommitMessage?: string | null;
  contributors: ProjectContributor[];
  lastSyncedAt: string;
}

