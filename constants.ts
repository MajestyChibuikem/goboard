import { Category, Project } from './types';

export const INITIAL_PROJECTS: Project[] = [];

export const CATEGORIES = Object.values(Category);

export const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  'idea': { label: 'Idea', color: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-400' },
  'in-progress': { label: 'Building', color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-400' },
  'beta': { label: 'Beta', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
  'launched': { label: 'Launched', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400' },
};
