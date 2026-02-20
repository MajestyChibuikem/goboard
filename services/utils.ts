import { Project, Badge } from '../types';

const ADJECTIVES = ['Silent', 'Binary', 'Crypto', 'Pixel', 'Quantum', 'Rapid', 'Cyber', 'Null', 'Mega', 'Giga', 'Nano', 'Happy', 'Angry', 'Swift'];
const NOUNS = ['Coder', 'Byte', 'Glitch', 'Surfer', 'Ninja', 'Wizard', 'Script', 'Bot', 'Compiler', 'Server', 'Node', 'Badger', 'Fox', 'Hawk'];

export const generateAnonymousName = (): string => {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 999);
  return `${adj}${noun}_${num}`;
};

export const formatDate = (dateString: string): string => {
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return new Date(dateString).toLocaleDateString('en-US', options);
};

export const getProjectBadges = (project: Project): Badge[] => {
  const badges: Badge[] = [];

  // Gold / Campus Choice Logic
  if (project.likes >= 100) {
    badges.push({ label: 'Campus Choice', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: '👑' });
  } else if (project.likes >= 50) {
    badges.push({ label: 'Rising Star', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: '🚀' });
  }

  // Engagement Logic
  if (project.comments.length >= 5) {
    badges.push({ label: 'Hot Topic', color: 'bg-orange-50 text-orange-700 border-orange-200', icon: '🔥' });
  }

  // Category specific
  if (project.category === 'Artificial Intelligence') {
    badges.push({ label: 'Future Tech', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: '🔮' });
  }

  return badges;
};
