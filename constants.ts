import { Category, Project } from './types';

export const INITIAL_PROJECTS: Project[] = [
  {
    id: '1',
    title: 'UniConnect Campus Map',
    description: 'An interactive campus navigation system built for Godfrey Okoye University to help freshers locate lecture halls and administrative blocks easily. It uses Dijkstra algorithm for shortest path finding.',
    studentName: 'Chinedu Okeke',
    level: '400 Level',
    category: Category.MOBILE,
    techStack: ['React Native', 'Firebase', 'Google Maps API'],
    imageUrl: 'https://picsum.photos/seed/project1/800/600',
    screenshots: ['https://picsum.photos/seed/p1_1/800/600', 'https://picsum.photos/seed/p1_2/800/600'],
    likes: 124,
    datePosted: '2023-10-15T10:30:00Z',
    status: 'launched',
    comments: [
      { id: 'c1', author: 'BinaryNinja_404', content: 'This helped me find the admin block on my first day! Great work.', date: '2023-10-16T14:20:00Z' },
      { id: 'c2', author: 'PixelWizard_99', content: 'You should cache the maps for offline use.', date: '2023-10-17T09:15:00Z' }
    ],
    updates: [
      { id: 'u1', content: 'Started with a basic wireframe of the campus layout. Mapped out all major buildings and paths manually by walking the campus with a notebook.', date: '2023-08-20T10:00:00Z', milestone: 'Project Started' },
      { id: 'u2', content: 'Got the Google Maps API integrated and plotted the first 15 buildings. Dijkstra pathfinding is working for shortest routes between any two points.', date: '2023-09-10T14:30:00Z', milestone: 'Core Navigation Working', imageUrl: 'https://picsum.photos/seed/u1_progress/800/600' },
      { id: 'u3', content: 'Added search functionality and building details (office hours, departments). Beta tested with 20 freshers during orientation week — feedback was amazing!', date: '2023-10-01T09:00:00Z', milestone: 'Beta Launch' },
      { id: 'u4', content: 'Officially launched on the faculty WhatsApp group. 50+ downloads in the first day. Working on offline map caching next based on user feedback.', date: '2023-10-15T10:30:00Z', milestone: 'Public Launch' }
    ]
  },
  {
    id: '2',
    title: 'AgroVest',
    description: 'A web platform connecting local Enugu farmers with investors. Features real-time ROI calculation and crop yield predictions using basic ML models.',
    studentName: 'Amaka Eze',
    level: '300 Level',
    category: Category.WEB,
    techStack: ['React', 'Node.js', 'MongoDB', 'Chart.js'],
    imageUrl: 'https://picsum.photos/seed/project2/800/600',
    screenshots: ['https://picsum.photos/seed/p2_1/800/600'],
    likes: 89,
    datePosted: '2023-11-02T11:00:00Z',
    status: 'beta',
    comments: [],
    updates: [
      { id: 'u5', content: 'Had a conversation with 3 local farmers in Nsukka market about their investment challenges. This problem is real — farmers struggle to find small-scale investors.', date: '2023-09-15T08:00:00Z', milestone: 'Research Phase' },
      { id: 'u6', content: 'Built the investor dashboard with Chart.js. ROI calculations are live. Still need to figure out the farmer onboarding flow — most don\'t have email addresses.', date: '2023-10-20T16:00:00Z', milestone: 'Dashboard Ready' },
      { id: 'u7', content: 'Added phone number auth for farmers. Three farmers from Enugu North have signed up for the beta. The ML yield prediction model needs more training data.', date: '2023-11-02T11:00:00Z', milestone: 'Beta with Real Users' }
    ]
  },
  {
    id: '3',
    title: 'StudyBuddy AI',
    description: 'An AI-powered study companion that generates quizzes from uploaded PDF lecture notes. Tailored specifically for the GoUni Computer Science curriculum.',
    studentName: 'David Okafor',
    level: '500 Level',
    category: Category.AI,
    techStack: ['Python', 'FastAPI', 'Gemini API', 'Next.js'],
    imageUrl: 'https://picsum.photos/seed/project3/800/600',
    screenshots: ['https://picsum.photos/seed/p3_1/800/600', 'https://picsum.photos/seed/p3_2/800/600'],
    likes: 210,
    datePosted: '2023-12-05T16:45:00Z',
    status: 'launched',
    comments: [
      { id: 'c3', author: 'CryptoCoder_007', content: 'The quiz generation is surprisingly accurate. What prompt engineering techniques did you use?', date: '2023-12-06T10:00:00Z' }
    ],
    updates: [
      { id: 'u8', content: 'The idea came from struggling with CSC 411 exam prep. What if AI could turn my lecture PDFs into practice questions?', date: '2023-10-01T12:00:00Z', milestone: 'Idea Born' },
      { id: 'u9', content: 'PDF parsing is tricky — tables and diagrams get mangled. Switched to a chunking strategy that preserves context. Gemini API generates solid MCQs now.', date: '2023-11-01T15:00:00Z', milestone: 'AI Pipeline Working' },
      { id: 'u10', content: 'Built the frontend with Next.js. Upload a PDF, pick your course, get 20 quiz questions in under 30 seconds. Tested with real CSC 301 notes — 85% accuracy on question relevance.', date: '2023-11-20T10:00:00Z', milestone: 'MVP Complete', imageUrl: 'https://picsum.photos/seed/u3_mvp/800/600' },
      { id: 'u11', content: 'Shared with my class group. 40 students used it for exam prep. Got featured in the faculty newsletter. Prof. Nnadi wants to discuss integrating it into the LMS!', date: '2023-12-05T16:45:00Z', milestone: 'Faculty Recognition' }
    ]
  },
  {
    id: '4',
    title: 'SecureGate IoT',
    description: 'Automated hostel entry system using RFID and facial recognition verification to enhance campus security.',
    studentName: 'Sarah Obi',
    level: '400 Level',
    category: Category.IOT,
    techStack: ['C++', 'Arduino', 'Raspberry Pi', 'OpenCV'],
    imageUrl: 'https://picsum.photos/seed/project4/800/600',
    screenshots: [],
    likes: 67,
    datePosted: '2024-01-12T08:30:00Z',
    status: 'in-progress',
    comments: [],
    updates: [
      { id: 'u12', content: 'Ordered Arduino Mega and RFID module from Jumia. While waiting for delivery, started writing the facial recognition module using OpenCV tutorials.', date: '2023-12-01T09:00:00Z', milestone: 'Hardware Sourcing' },
      { id: 'u13', content: 'RFID reading works! Can scan student ID cards and match against a local database. Facial recognition is at 70% accuracy — lighting in the hostel corridors is a challenge.', date: '2024-01-12T08:30:00Z', milestone: 'Prototype Working', imageUrl: 'https://picsum.photos/seed/u4_proto/800/600' }
    ]
  },
  {
    id: '5',
    title: 'Enugu Traffic Watch',
    description: 'Crowdsourced traffic monitoring app helping students commute from town to the permanent site faster.',
    studentName: 'Emeka Nnamdi',
    level: '200 Level',
    category: Category.MOBILE,
    techStack: ['Flutter', 'Dart', 'Firebase'],
    imageUrl: 'https://picsum.photos/seed/project5/800/600',
    screenshots: ['https://picsum.photos/seed/p5_1/800/600'],
    likes: 45,
    datePosted: '2024-02-20T13:15:00Z',
    status: 'idea',
    comments: [],
    updates: [
      { id: 'u14', content: 'Stuck in traffic on Enugu-Abakaliki road for 2 hours today. There has to be a better way. Starting a Flutter project to let students report traffic in real-time.', date: '2024-02-15T18:00:00Z', milestone: 'Idea Phase' },
      { id: 'u15', content: 'Basic Flutter UI is done — a map with pins where users can report congestion. Learning Firebase for the backend. Looking for a teammate who knows backend well.', date: '2024-02-20T13:15:00Z', milestone: 'UI Wireframes Done' }
    ]
  },
  {
    id: '6',
    title: 'GoUni Result Checker',
    description: 'A revamped, user-friendly portal for checking semester results with GPA visualization and transcript request features.',
    studentName: 'Blessing Udoh',
    level: '300 Level',
    category: Category.WEB,
    techStack: ['Vue.js', 'Laravel', 'MySQL'],
    imageUrl: 'https://picsum.photos/seed/project6/800/600',
    screenshots: ['https://picsum.photos/seed/p6_1/800/600'],
    likes: 156,
    datePosted: '2024-03-01T09:00:00Z',
    status: 'beta',
    comments: [
      { id: 'c4', author: 'SwiftSurfer_123', content: 'Finally, a result portal that works on mobile!', date: '2024-03-02T11:20:00Z' }
    ],
    updates: [
      { id: 'u16', content: 'The current result portal takes 5 clicks and 3 page loads just to see your GPA. I can do better. Starting with Vue.js + Laravel.', date: '2024-01-15T10:00:00Z', milestone: 'Problem Identified' },
      { id: 'u17', content: 'GPA visualization with semester-over-semester charts is working. The transcript PDF generator uses Laravel DomPDF. Mobile responsive from day one.', date: '2024-02-15T14:00:00Z', milestone: 'Core Features Done', imageUrl: 'https://picsum.photos/seed/u6_charts/800/600' },
      { id: 'u18', content: 'Beta launched to 30 students. The feedback is overwhelmingly positive — everyone says it should replace the official portal. Trying to get a meeting with ICT department.', date: '2024-03-01T09:00:00Z', milestone: 'Beta Launch' }
    ]
  }
];

export const CATEGORIES = Object.values(Category);

export const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  'idea': { label: 'Idea', color: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-400' },
  'in-progress': { label: 'Building', color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-400' },
  'beta': { label: 'Beta', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
  'launched': { label: 'Launched', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400' },
};
