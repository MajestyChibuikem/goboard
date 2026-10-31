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
  type: 'approval' | 'rejection' | 'comment' | 'reply' | 'mention' | 'suspension' | 'paper_approved' | 'paper_closed' | 'id_verified' | 'id_rejected' | 'payday_paid' | 'campaign_approved' | 'campaign_rejected' | 'pull_request';
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
  contributionNeedsNote?: string;
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

// ─── Genesis Quests & Builder Milestones ───

export interface QuestDefinition {
  id: string;
  title: string;
  shortDesc: string;
  category: 'identity' | 'shipping' | 'community' | 'collaboration';
  icon: string;
  xpReward: number;
  coinReward?: number;
  badgeName?: string;
  actionLabel: string;
  completedLabel: string;
}

export const GENESIS_QUESTS: QuestDefinition[] = [
  {
    id: 'connect_forge',
    title: 'Connect Your Forge',
    shortDesc: 'Link your GitHub profile to verify your developer identity',
    category: 'identity',
    icon: 'shield',
    xpReward: 50,
    badgeName: 'Builder',
    actionLabel: 'Connect GitHub',
    completedLabel: 'GitHub Linked',
  },
  {
    id: 'first_ship',
    title: 'First Ship',
    shortDesc: 'Submit your first project backed by a verified GitHub repo',
    category: 'shipping',
    icon: 'rocket',
    xpReward: 150,
    coinReward: 50,
    badgeName: 'Shipper',
    actionLabel: 'Ship Project',
    completedLabel: 'Project Shipped',
  },
  {
    id: 'campus_scout',
    title: 'Campus Scout',
    shortDesc: 'Upvote and review 3 student projects across campus',
    category: 'community',
    icon: 'compass',
    xpReward: 50,
    coinReward: 20,
    actionLabel: 'Explore Feed',
    completedLabel: '3 Projects Scouted',
  },
  {
    id: 'open_source_pioneer',
    title: 'Open Source Pioneer',
    shortDesc: 'Mark any project "Open to PRs" to invite collaboration',
    category: 'collaboration',
    icon: 'git-pull-request',
    xpReward: 100,
    badgeName: 'Contributor',
    actionLabel: 'Enable PRs',
    completedLabel: 'Repo Open to PRs',
  },
];

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
  homepage?: string | null;
}

export interface GitHubRecentCommit {
  repoName: string;
  sha: string;
  message: string;
  date: string;
  url: string;
}

export interface GitHubCommitItem {
  sha: string;
  shortSha: string;
  message: string;
  authorName: string;
  authorUsername?: string;
  authorAvatarUrl?: string;
  date: string;
  htmlUrl: string;
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

export interface GitHubPullRequestItem {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  merged: boolean;
  htmlUrl: string;
  authorUsername: string;
  authorAvatarUrl: string;
  authorProfileUrl: string;
  createdAt: string;
  mergedAt?: string | null;
}

export type CampaignSubmissionStatus = 'pending' | 'approved' | 'rejected' | 'winner';

export interface CampaignSubmission {
  id: string;
  campaignId: string; // e.g. "prayer_book_s1"
  authorUid: string;
  displayName: string;
  authorPhotoURL?: string | null;
  teamSize: 'solo' | 'duo';
  partnerUsername?: string | null;
  partnerUid?: string | null;
  repoUrl: string;
  figmaUrl: string;
  pitchSummary: string;
  screenshots: string[]; // 1 to 5 URLs
  likes: number;
  votedUserIds?: string[];
  status: CampaignSubmissionStatus;
  rejectionReason?: string;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export type SortOption = 'newest' | 'votes' | 'comments';

