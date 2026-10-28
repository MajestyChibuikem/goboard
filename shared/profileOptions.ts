export const ACADEMIC_LEVELS: string[] = [
  '100 Level',
  '200 Level',
  '300 Level',
  '400 Level',
  '500 Level',
];

export type AcademicLevel = string;

export const DEPARTMENT_SUGGESTIONS = [
  'Computer Science',
  'Software Engineering',
  'Cybersecurity',
  'Information Technology',
  'Data Science & AI',
  'Computer Engineering',
  'Electrical & Electronics Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Biomedical Engineering',
  'Economics',
  'Accounting',
  'Business Administration',
  'Mass Communication',
  'Law',
  'Medicine & Surgery',
  'Nursing Science',
  'Medical Laboratory Science',
  'Pharmacy',
  'Architecture',
] as const;

export const INTEREST_OPTIONS = [
  {
    id: 'build',
    label: 'Build & Showcase Projects',
    description: 'Share your web apps, mobile apps, AI tools, and hardware builds with students and faculty.',
  },
  {
    id: 'write',
    label: 'Write & Publish on Lit Club',
    description: 'Publish essays, dev stories, case studies, and creative tech writings.',
  },
  {
    id: 'collaborate',
    label: 'Collaborate & Open-Source',
    description: 'Find student-led open-source repos, push pull requests, and earn contributor badges.',
  },
  {
    id: 'explore',
    label: 'Explore, Vote & Review',
    description: 'Discover what campus peers are building, test live demos, and upvote the best innovations.',
  },
] as const;
