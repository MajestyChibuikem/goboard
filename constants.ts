import { Category, Project, Writing } from './types';

export const INITIAL_PROJECTS: Project[] = [];

export const INITIAL_WRITINGS: Omit<Writing, 'id'>[] = [
  {
    title: 'Binary Sunset',
    genre: 'poem',
    displayName: 'Chisom A.',
    authorPhotoURL: null,
    likes: 34,
    datePosted: new Date('2025-04-02').toISOString(),
    comments: [],
    approvalStatus: 'approved',
    body: `The cursor blinks — a heartbeat
on a screen that forgets
to breathe.

I have named all my variables
after places I want to go:
Venice, Kyoto, home.

The compiler does not care
that I stayed up until 3 a.m.
feeding it semicolons like prayers.

But when the code compiles —
that green checkmark,
small as a blessing —

I feel what gods must feel
on the seventh day:
tired, and done, and satisfied.`,
  },
  {
    title: 'Harmattan Aubade',
    genre: 'poem',
    displayName: 'Fatima O.',
    authorPhotoURL: null,
    likes: 27,
    datePosted: new Date('2025-04-10').toISOString(),
    comments: [],
    approvalStatus: 'approved',
    body: `Every December the dust arrives
before the harmattan does,
settling on textbooks like grief.

My roommate's braids hang
over borrowed notes — Organic Chemistry,
the one subject that smells of defeat.

We are both from somewhere
the internet forgets,
learning languages that forget us back.

Yet here, at 6 a.m.,
tea cooling between her palms,
she explains activation energy

as if she invented warmth.`,
  },
  {
    title: 'The Last Commit',
    genre: 'short-story',
    displayName: 'David E.',
    authorPhotoURL: null,
    likes: 52,
    datePosted: new Date('2025-03-18').toISOString(),
    comments: [],
    approvalStatus: 'approved',
    body: `She had been debugging the same function for eleven hours when the message came in.

"Call me when you're free," her mother had typed. "Nothing urgent."

Nothing urgent was always urgent.

Amara minimised the IDE and stared at the message. Through the window of the computer lab, the sun was already beginning its descent over the lecture theatre, painting the courtyard in the particular amber that only existed for about twenty minutes each evening. Students crossed below her like variables she'd forgotten to initialise.

She had three bugs left. The demo was tomorrow at nine.

She called.

Her mother answered on the first ring, which meant it was urgent. They talked for an hour — about her grandmother's knee, about whether Amara was eating, about a cousin's engagement in Abuja. When she hung up, the courtyard was dark and the amber was gone.

She looked at the code. The three bugs were still there. But somehow they seemed smaller.

She fixed them all by midnight.`,
  },
  {
    title: 'Room 214',
    genre: 'short-story',
    displayName: 'Blessing N.',
    authorPhotoURL: null,
    likes: 41,
    datePosted: new Date('2025-04-05').toISOString(),
    comments: [],
    approvalStatus: 'approved',
    body: `The girl in Room 214 only spoke between midnight and 3 a.m.

This was Kofi's first conclusion after two weeks of living next door. His second conclusion was that she was a literature student. He could tell by the sound of her — not words exactly, but the rhythm of someone reading aloud to themselves, testing sentences like she was tasting fruit.

His third conclusion came on a Thursday.

He had been awake for his usual reasons — code, coffee, the particular anxiety of someone who had chosen a degree their father thought was "not serious." He heard his door open. Then hers. Then her voice in the hallway.

"I can hear you thinking," she said.

He turned. She was wearing a face mask and holding a thick, annotated copy of Things Fall Apart.

"Sorry," he said.

"Don't be." She leaned against the wall. "What are you building?"

He told her about the app — the agricultural marketplace, the farmers who'd inspired it, the API that kept returning 500 errors. She listened the way people listened to music they hadn't heard before but already suspected they would love.

"What are you writing?" he asked.

She held up the book. "I'm trying to understand what breaks and what survives."

He nodded slowly. So was he.

They stood in the fluorescent hallway for a while, each working, neither alone.`,
  },
  {
    title: 'Generator Night',
    genre: 'short-story',
    displayName: 'Seun K.',
    authorPhotoURL: null,
    likes: 38,
    datePosted: new Date('2025-03-28').toISOString(),
    comments: [],
    approvalStatus: 'approved',
    body: `NEPA took the light at exactly 10:47 p.m., which Segun knew because the timestamp on his unsaved work blinked once before disappearing into darkness.

He sat in the silence. Outside, the generator of the hostel across the road coughed twice and started. Inside: nothing.

He had been writing his final-year project proposal. "Development of a Machine Learning Framework for Early Detection of Cassava Mosaic Disease." Twenty-two pages. Now: zero pages.

For several minutes he did not move.

Then, from the floor below, someone started playing afrobeats. Someone else shouted at them to stop. The shouter was ignored. The music grew louder, as music does when it is young and has nothing to lose.

Segun found his phone. Turned on the flashlight. Found his notepad.

He began writing by hand.

By the time the light came back at 1 a.m., he had thirty pages — messy, alive, better than what he had lost. He typed them up slowly, afraid of losing them again, handling each sentence like it was made of something fragile.

He submitted the proposal three days later. He got the highest mark in his department.

He still writes important things by hand first.`,
  },
  {
    title: 'Why I Build',
    genre: 'essay',
    displayName: 'Emmanuel O.',
    authorPhotoURL: null,
    likes: 61,
    datePosted: new Date('2025-03-12').toISOString(),
    comments: [],
    approvalStatus: 'approved',
    body: `People ask me why I code. I usually say something about problem-solving, or career prospects, or the satisfaction of making something from nothing. These things are true, but they are not the whole answer.

The whole answer is this: I come from a place where the infrastructure often fails. Roads flood. Power cuts out. Hospitals run out of drugs. I grew up watching adults grow skilled at working around systems that were supposed to work for them.

What I saw was not defeat. It was engineering.

My father rerouted water pipes with materials that were never meant for that purpose. My mother kept paper records when the hospital's database went down, cross-referencing by memory until the system came back. My uncle repaired generators using YouTube tutorials and stubborn intuition.

I code because I grew up surrounded by people who built their way through problems. Software is just the newest material.

When I write a function that automates something tedious, I think of my mother's paper records. When I build a system that routes around failure, I think of my father's pipes. When a junior developer tells me they can't figure something out, I tell them: You already know how to do this. You just haven't learned the syntax yet.

The syntax is the easy part.`,
  },
  {
    title: 'On Not Reading Enough',
    genre: 'essay',
    displayName: 'Zara M.',
    authorPhotoURL: null,
    likes: 29,
    datePosted: new Date('2025-04-14').toISOString(),
    comments: [],
    approvalStatus: 'approved',
    body: `I am in my third year of studying Literature, and I am ashamed to admit that I have not read enough.

Not for lack of books. My shelf is embarrassingly full — Achebe, Adichie, Soyinka, Baldwin, Morrison, Borges, a dog-eared copy of Middlemarch I have been meaning to finish since Year One. I have not read enough because I have been afraid.

Afraid that the books I love will reveal their faults under careful reading. Afraid that the writers I admire will become ordinary once I understand how they do what they do. Afraid, most of all, that careful reading will make me a more critical writer, and that criticism is incompatible with joy.

I know this is wrong. I know it intellectually. But knowing something intellectually and knowing it in your body — in the way you reach for a book without guilt — are different things.

What changed, this semester, was a seminar on African speculative fiction. The lecturer spent forty minutes on a single paragraph by Nnedi Ofofor. Forty minutes. He did not explain the paragraph so much as unfold it, turning it over to show us the light on different sides.

I understood, watching him, that close reading is not criticism.

It is love with attention.

I have been reading slowly ever since.`,
  },
];

export const CATEGORIES = Object.values(Category);

export const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  'idea': { label: 'Idea', color: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-400' },
  'in-progress': { label: 'Building', color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-400' },
  'beta': { label: 'Beta', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
  'launched': { label: 'Launched', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400' },
};

export const DISCORD_BANNER_PRESETS: Record<string, { label: string; className: string; gradient?: string }> = {
  'gradient-blue': {
    label: 'GoUni Royal',
    className: 'bg-gradient-to-r from-[#0f172a] via-[#1e3a8a] to-[#3b82f6]',
    gradient: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #3b82f6 100%)',
  },
  'gradient-purple': {
    label: 'Nitro Nebula',
    className: 'bg-gradient-to-r from-[#1e1b4b] via-[#6d28d9] to-[#ec4899]',
    gradient: 'linear-gradient(135deg, #1e1b4b 0%, #6d28d9 50%, #ec4899 100%)',
  },
  'cyberpunk': {
    label: 'Cyber Gold',
    className: 'bg-gradient-to-r from-[#090d16] via-[#1e293b] to-[#f59e0b]',
    gradient: 'linear-gradient(135deg, #090d16 0%, #1e293b 50%, #f59e0b 100%)',
  },
  'emerald': {
    label: 'Matrix Mint',
    className: 'bg-gradient-to-r from-[#022c22] via-[#059669] to-[#34d399]',
    gradient: 'linear-gradient(135deg, #022c22 0%, #059669 50%, #34d399 100%)',
  },
  'sunset': {
    label: 'Crimson Dusk',
    className: 'bg-gradient-to-r from-[#450a0a] via-[#e11d48] to-[#fb923c]',
    gradient: 'linear-gradient(135deg, #450a0a 0%, #e11d48 50%, #fb923c 100%)',
  },
  'midnight': {
    label: 'Obsidian Carbon',
    className: 'bg-gradient-to-r from-[#0a0a0a] via-[#262626] to-[#404040]',
    gradient: 'linear-gradient(135deg, #0a0a0a 0%, #262626 50%, #404040 100%)',
  },
  'aurora': {
    label: 'Northern Lights',
    className: 'bg-gradient-to-r from-[#064e3b] via-[#0284c7] to-[#a855f7]',
    gradient: 'linear-gradient(135deg, #064e3b 0%, #0284c7 50%, #a855f7 100%)',
  },
  'synthwave': {
    label: 'Neon Synthwave',
    className: 'bg-gradient-to-r from-[#2e0854] via-[#ec4899] to-[#06b6d4]',
    gradient: 'linear-gradient(135deg, #2e0854 0%, #ec4899 50%, #06b6d4 100%)',
  },
  'oceanic': {
    label: 'Deep Oceanic',
    className: 'bg-gradient-to-r from-[#0c4a6e] via-[#0284c7] to-[#38bdf8]',
    gradient: 'linear-gradient(135deg, #0c4a6e 0%, #0284c7 50%, #38bdf8 100%)',
  },
  'solar': {
    label: 'Solar Flare',
    className: 'bg-gradient-to-r from-[#7c2d12] via-[#ea580c] to-[#facc15]',
    gradient: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 50%, #facc15 100%)',
  },
  'tokyo': {
    label: 'Tokyo Night',
    className: 'bg-gradient-to-r from-[#0b0f19] via-[#1e1b4b] to-[#ec4899]',
    gradient: 'linear-gradient(135deg, #0b0f19 0%, #1e1b4b 50%, #ec4899 100%)',
  },
  'cosmic-peach': {
    label: 'Cosmic Peach',
    className: 'bg-gradient-to-r from-[#4a044e] via-[#c026d3] to-[#fb923c]',
    gradient: 'linear-gradient(135deg, #4a044e 0%, #c026d3 50%, #fb923c 100%)',
  },
};

export const PROFILE_ACCENT_COLORS = [
  { label: 'Royal Blue', value: '#1e3a8a' },
  { label: 'Electric Indigo', value: '#4f46e5' },
  { label: 'Nitro Violet', value: '#7c3aed' },
  { label: 'Hot Pink', value: '#ec4899' },
  { label: 'Crimson', value: '#e11d48' },
  { label: 'Sunset Amber', value: '#f59e0b' },
  { label: 'Cyber Emerald', value: '#059669' },
  { label: 'Cyan Ocean', value: '#06b6d4' },
  { label: 'Obsidian', value: '#0f172a' },
];

export const AESTHETIC_GRADIENT_PRESETS = [
  { label: 'Neon Cyber', from: '#18002e', via: '#7928ca', to: '#ff0080', deg: '135deg' },
  { label: 'Hyper Blue', from: '#021B79', via: '#0575E6', to: '#00F260', deg: '135deg' },
  { label: 'Sunset Glow', from: '#4a00e0', via: '#8e2de2', to: '#f953c6', deg: '135deg' },
  { label: 'Firefly Deep', from: '#0f2027', via: '#203a43', to: '#2c5364', deg: '135deg' },
  { label: 'Velvet Dream', from: '#240b36', via: '#8e0e00', to: '#c31432', deg: '135deg' },
  { label: 'Electric Lime', from: '#051937', via: '#004d7a', to: '#00bf72', deg: '135deg' },
  { label: 'Cosmic Coral', from: '#ff416c', via: '#ff4b2b', to: '#f7971e', deg: '135deg' },
  { label: 'Dark Amethyst', from: '#140026', via: '#38006b', to: '#6200ea', deg: '135deg' },
  { label: 'Sub-Zero Cyan', from: '#0f172a', via: '#1e293b', to: '#38bdf8', deg: '135deg' },
  { label: 'Golden Hour', from: '#3e2723', via: '#d84315', to: '#ffb300', deg: '135deg' },
  { label: 'Emerald Matrix', from: '#00251a', via: '#004d40', to: '#00bfa5', deg: '135deg' },
  { label: 'Rose Gold Glow', from: '#2e0220', via: '#be185d', to: '#fbcfe8', deg: '135deg' },
];

import { ACADEMIC_LEVELS } from './shared/profileOptions';
export { ACADEMIC_LEVELS };

export const CONTRIBUTION_AREAS = [
  'Frontend',
  'Backend',
  'Mobile',
  'UI / UX',
  'AI / ML',
  'Bug Fixes',
  'Testing',
  'Docs',
];

export const GITHUB_LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Dart: '#00B4AB',
  Java: '#b07219',
  Kotlin: '#A97BFF',
  Swift: '#F05138',
  Go: '#00ADD8',
  Rust: '#dea584',
  'C++': '#f34b7d',
  'C#': '#178600',
  PHP: '#4F5D95',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Solidity: '#AA6746',
  Vue: '#41b883',
  Shell: '#89e051',
};

