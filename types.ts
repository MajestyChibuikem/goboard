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
  author: string; // Generated anonymous name
  content: string;
  date: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  studentName: string; // Original author
  level: string; 
  category: Category;
  techStack: string[];
  imageUrl: string;
  screenshots: string[]; // Additional images
  likes: number;
  demoUrl?: string;
  repoUrl?: string;
  datePosted: string;
  comments: Comment[];
  status: ProjectStatus;
  updates: ProjectUpdate[];
}

export type ProjectStatus = 'idea' | 'in-progress' | 'beta' | 'launched';

export interface ProjectUpdate {
  id: string;
  content: string;
  imageUrl?: string;
  date: string;
  milestone?: string; // e.g. "MVP Ready", "First 10 Users", "Design Complete"
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
