import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BookOpen,
  Sparkles,
  Trophy,
  GitPullRequest,
  GitCommit,
  Coins,
  HelpCircle,
  Search,
  Check,
  Copy,
  ChevronRight,
  ExternalLink,
  Shield,
  Terminal,
  ArrowRight,
  Layers,
  Flame,
  Award,
  CheckCircle2,
  AlertTriangle,
  Info,
  Lightbulb,
  FileCode,
  Users,
  Compass,
} from 'lucide-react';

interface DocSection {
  id: string;
  title: string;
  category: string;
  icon: React.ReactNode;
  summary: string;
}

const DOC_SECTIONS: DocSection[] = [
  {
    id: 'overview',
    title: 'Welcome & Overview',
    category: 'Getting Started',
    icon: <BookOpen className="w-4 h-4" />,
    summary: 'The mission, ecosystem architecture, and builder philosophy behind GoBoard.',
  },
  {
    id: 'xp-system',
    title: 'XP, Levels & Anti-Cheat',
    category: 'Progression',
    icon: <Sparkles className="w-4 h-4" />,
    summary: 'How to earn verified XP, rank thresholds, and cryptographic ledger security.',
  },
  {
    id: 'quests-grader',
    title: 'Genesis Quests & Grader',
    category: 'Challenges',
    icon: <Trophy className="w-4 h-4" />,
    summary: 'Interactive technical quests and the automated GitHub testing grader.',
  },
  {
    id: 'pr-collaboration',
    title: 'Open-Source & PR Guide',
    category: 'Collaboration',
    icon: <GitPullRequest className="w-4 h-4" />,
    summary: 'Contributing to student projects, branching workflows, and PR etiquette.',
  },
  {
    id: 'git-commits',
    title: 'Commits as Live Updates',
    category: 'Features',
    icon: <GitCommit className="w-4 h-4" />,
    summary: 'How your GitHub commits automatically populate the project Build Journey.',
  },
  {
    id: 'gocoins-economy',
    title: 'GoCoins & Student Wallet',
    category: 'Economy',
    icon: <Coins className="w-4 h-4" />,
    summary: 'Student ID verification, earning GoCoins, and seasonal payday cash bounties.',
  },
  {
    id: 'faq',
    title: 'FAQ & Troubleshooting',
    category: 'Support',
    icon: <HelpCircle className="w-4 h-4" />,
    summary: 'Answers to common questions regarding sync, rate limits, and verification.',
  },
];

const CodeSnippet: React.FC<{ code: string; language?: string; title?: string }> = ({
  code,
  language = 'bash',
  title,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-900 text-neutral-100 shadow-xs">
      {title && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800 bg-neutral-950/60 text-xs text-neutral-400 font-mono">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-neutral-500" />
            <span>{title}</span>
          </div>
          <span className="text-[10px] uppercase font-bold text-neutral-500">{language}</span>
        </div>
      )}
      <div className="relative p-4 font-mono text-[13px] leading-relaxed overflow-x-auto">
        <button
          type="button"
          onClick={handleCopy}
          className="absolute right-3 top-3 p-1.5 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
          title="Copy to clipboard"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
        <pre className="pr-10 text-neutral-200">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};

const Callout: React.FC<{
  type?: 'tip' | 'note' | 'warning' | 'important';
  title?: string;
  children: React.ReactNode;
}> = ({ type = 'note', title, children }) => {
  const styles = {
    tip: {
      border: 'border-emerald-200 dark:border-emerald-900/60',
      bg: 'bg-emerald-50/60 dark:bg-emerald-950/20',
      text: 'text-emerald-900 dark:text-emerald-200',
      titleColor: 'text-emerald-800 dark:text-emerald-300',
      icon: <Lightbulb className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />,
      defaultTitle: 'Pro Tip',
    },
    note: {
      border: 'border-blue-200 dark:border-blue-900/60',
      bg: 'bg-blue-50/60 dark:bg-blue-950/20',
      text: 'text-blue-900 dark:text-blue-200',
      titleColor: 'text-blue-800 dark:text-blue-300',
      icon: <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />,
      defaultTitle: 'Note',
    },
    warning: {
      border: 'border-amber-200 dark:border-amber-900/60',
      bg: 'bg-amber-50/60 dark:bg-amber-950/20',
      text: 'text-amber-900 dark:text-amber-200',
      titleColor: 'text-amber-800 dark:text-amber-300',
      icon: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />,
      defaultTitle: 'Warning',
    },
    important: {
      border: 'border-purple-200 dark:border-purple-900/60',
      bg: 'bg-purple-50/60 dark:bg-purple-950/20',
      text: 'text-purple-900 dark:text-purple-200',
      titleColor: 'text-purple-800 dark:text-purple-300',
      icon: <CheckCircle2 className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />,
      defaultTitle: 'Important',
    },
  }[type];

  return (
    <div className={`my-5 rounded-2xl p-4.5 border ${styles.border} ${styles.bg} ${styles.text}`}>
      <div className="flex items-center gap-2 mb-1.5 font-bold text-xs uppercase tracking-wide">
        {styles.icon}
        <span className={styles.titleColor}>{title || styles.defaultTitle}</span>
      </div>
      <div className="text-[13.5px] leading-relaxed">{children}</div>
    </div>
  );
};

export const DocsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Handle hash or query params on mount
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const section = params.get('section');
    if (section && DOC_SECTIONS.some((s) => s.id === section)) {
      setActiveSection(section);
      const el = document.getElementById(section);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [location.search]);

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      const yOffset = -90; // account for navbar
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return DOC_SECTIONS;
    const q = searchQuery.toLowerCase();
    return DOC_SECTIONS.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.summary.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  return (
    <div className="max-w-[1400px] mx-auto px-2 sm:px-4 py-4 sm:py-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-950 text-white p-8 sm:p-12 mb-10 border border-neutral-800 shadow-xl">
        <div className="absolute -right-24 -top-24 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-amber-300 text-xs font-semibold uppercase tracking-wider mb-4 border border-white/10">
            <Compass className="w-3.5 h-3.5" />
            GoBoard Handbook & Documentation
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-4">
            Everything you need to build, collaborate & level up.
          </h1>

          <p className="text-base sm:text-lg text-neutral-300 leading-relaxed mb-8 max-w-2xl">
            Explore complete technical guides on earning XP, completing developer quests, submitting pull requests, publishing live commit timelines, and unlocking GoCoins bounties.
          </p>

          {/* Quick Search */}
          <div className="relative max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search topics: XP breakdown, Git quests, PR guide, live commits..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white/10 border border-white/20 focus:border-amber-400 focus:bg-white/15 focus:outline-none text-sm text-white placeholder:text-neutral-400 backdrop-blur-md transition-all"
            />
          </div>

          {/* Quick Jump Pills */}
          <div className="flex flex-wrap items-center gap-2 mt-4 text-xs">
            <span className="text-neutral-400 font-medium">Quick Jumps:</span>
            {[
              { id: 'xp-system', label: '⚡ XP Rules' },
              { id: 'quests-grader', label: '🏆 Quests Grader' },
              { id: 'pr-collaboration', label: '🤝 PR Guide' },
              { id: 'git-commits', label: '🐙 Git Commits' },
              { id: 'gocoins-economy', label: '💰 GoCoins' },
            ].map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => scrollToSection(pill.id)}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-neutral-200 transition-colors cursor-pointer font-medium"
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Documentation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Sticky Sidebar Navigation (Desktop) */}
        <aside className="lg:col-span-3 lg:sticky lg:top-24 space-y-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 p-4 shadow-2xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-3 px-2">
              Documentation Chapters
            </div>

            <nav className="space-y-1">
              {filteredSections.map((sec) => {
                const isActive = activeSection === sec.id;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => scrollToSection(sec.id)}
                    className={`flex items-center justify-between w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 shadow-xs'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className={isActive ? 'opacity-100' : 'text-neutral-400'}>
                        {sec.icon}
                      </span>
                      <span className="truncate">{sec.title}</span>
                    </div>
                    {isActive && <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-70" />}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Help Box */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 rounded-2xl p-4.5 border border-amber-200/60 dark:border-amber-800/60 text-xs">
            <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200 mb-1">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Need Assistance?
            </div>
            <p className="text-amber-800/80 dark:text-amber-300/80 leading-relaxed mb-3">
              Have questions about your project approval, quest grading, or student ID verification?
            </p>
            <button
              type="button"
              onClick={() => navigate('/browse')}
              className="w-full py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-colors cursor-pointer text-center"
            >
              Back to Projects
            </button>
          </div>
        </aside>

        {/* Content Body */}
        <main className="lg:col-span-9 space-y-16">
          {/* Section 1: Overview */}
          <section id="overview" className="scroll-mt-24 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 p-6 sm:p-10 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-2">
              <BookOpen className="w-4 h-4" />
              Chapter 1: Getting Started
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white mb-4">
              Welcome to GoBoard
            </h2>
            <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed mb-6">
              GoBoard is the official campus showcase and developer network for Godfrey Okoye University students. Built to celebrate engineering excellence, GoBoard enables students across computer science, software engineering, and creative faculties to showcase real-world proof of work, receive constructive feedback, collaborate through open-source pull requests, and earn cash bounties.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-8">
              <div className="p-4.5 rounded-2xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/60 dark:border-neutral-800">
                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold mb-3">
                  1
                </div>
                <div className="font-bold text-sm text-neutral-900 dark:text-white mb-1">
                  Public Proof of Work
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Turn class assignments and personal projects into living portfolios with live demo links, screenshots, and GitHub sync.
                </p>
              </div>

              <div className="p-4.5 rounded-2xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/60 dark:border-neutral-800">
                <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold mb-3">
                  2
                </div>
                <div className="font-bold text-sm text-neutral-900 dark:text-white mb-1">
                  Open Collaboration
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Flag repositories as "Open to Contributions" and invite peers to submit frontend, backend, or bug-fix pull requests.
                </p>
              </div>

              <div className="p-4.5 rounded-2xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/60 dark:border-neutral-800">
                <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold mb-3">
                  3
                </div>
                <div className="font-bold text-sm text-neutral-900 dark:text-white mb-1">
                  Quests & Economy
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Conquer technical challenges graded automatically by the test bot, accumulate GoCoins, and qualify for seasonal cash paydays.
                </p>
              </div>
            </div>

            <Callout type="tip" title="Getting Setup in 2 Minutes">
              To get the most out of GoBoard, make sure to:
              <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                <li>Sign in with your university or Google account</li>
                <li>Complete your profile in the onboarding flow (+25 XP)</li>
                <li>Connect your GitHub account in <strong>My Profile & Wallet</strong> (+15 XP)</li>
                <li>Upload your first project or complete Genesis Quest 1</li>
              </ol>
            </Callout>
          </section>

          {/* Section 2: XP System */}
          <section id="xp-system" className="scroll-mt-24 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 p-6 sm:p-10 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-2">
              <Sparkles className="w-4 h-4" />
              Chapter 2: Progression
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white mb-4">
              XP, Levels & Anti-Cheat Ledger
            </h2>
            <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed mb-6">
              Experience Points (XP) represent verified engineering effort and campus leadership. Rather than rewarding superficial clicks, GoBoard uses server-verified triggers and cryptographic ledger keys to guarantee authenticity.
            </p>

            {/* XP Breakdown Table */}
            <div className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800 mb-8">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Action / Milestone</th>
                    <th className="py-3 px-4">Reward</th>
                    <th className="py-3 px-4">Frequency</th>
                    <th className="py-3 px-4">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 text-neutral-700 dark:text-neutral-300">
                  <tr>
                    <td className="py-3 px-4 font-semibold">Finish User Onboarding</td>
                    <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">+25 XP</td>
                    <td className="py-3 px-4">One-time</td>
                    <td className="py-3 px-4">Profile completion check</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold">Connect & Verify GitHub</td>
                    <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">+15 XP</td>
                    <td className="py-3 px-4">One-time</td>
                    <td className="py-3 px-4">GitHub OAuth / API check</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold">Submit First Project</td>
                    <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">+100 XP</td>
                    <td className="py-3 px-4">One-time</td>
                    <td className="py-3 px-4">First project created</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold">Subsequent Project Submission</td>
                    <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">+50 XP</td>
                    <td className="py-3 px-4">Per project</td>
                    <td className="py-3 px-4">Valid title, description & repo</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold">Project Approved by Admin</td>
                    <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">+50 XP</td>
                    <td className="py-3 px-4">Per approved project</td>
                    <td className="py-3 px-4">Peer review & approval queue</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold">Daily Active Coding / Push</td>
                    <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">+15 XP</td>
                    <td className="py-3 px-4">Once per calendar day</td>
                    <td className="py-3 px-4">GitHub public push activity</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold">7-Day Coding Streak Bonus</td>
                    <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">+10 XP</td>
                    <td className="py-3 px-4">Every 7 consecutive days</td>
                    <td className="py-3 px-4">Commit calendar inspection</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold">Genesis Quest 1: Baby Steps in Git</td>
                    <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">+150 XP</td>
                    <td className="py-3 px-4">One-time</td>
                    <td className="py-3 px-4">Automated technical grader</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold">Genesis Quest 2: 0x00 Shell Basics</td>
                    <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">+200 XP</td>
                    <td className="py-3 px-4">One-time</td>
                    <td className="py-3 px-4">Automated technical grader</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold">Merge Pull Request into Project</td>
                    <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">+50 XP</td>
                    <td className="py-3 px-4">Per merged PR</td>
                    <td className="py-3 px-4">GitHub PR merged state</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Ranks Hierarchy */}
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-4">
              Builder Rank Thresholds
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
              {[
                { name: 'Freshman Coder', xp: '0 – 99 XP', color: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300' },
                { name: 'Campus Builder', xp: '100 – 299 XP', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' },
                { name: 'Code Artisan', xp: '300 – 699 XP', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' },
                { name: 'Lead Engineer', xp: '700 – 1,499 XP', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' },
                { name: 'Campus Legend', xp: '1,500 – 2,999 XP', color: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300' },
                { name: 'Hall of Fame', xp: '3,000+ XP', color: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' },
              ].map((rank) => (
                <div key={rank.name} className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-850/50">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-1.5 ${rank.color}`}>
                    {rank.name}
                  </span>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 font-mono font-medium">
                    {rank.xp}
                  </div>
                </div>
              ))}
            </div>

            <Callout type="important" title="Cryptographic Ledger & Anti-Cheat">
              Every XP reward is recorded in an immutable Firestore collection (<code>xp_ledger</code>) with a deterministic idempotency key (e.g. <code>user123:quest:genesis_quest_1</code>). This guarantees:
              <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                <li>No duplicate XP can ever be awarded for the same action.</li>
                <li>If your browser disconnects or an API hiccups, the ledger self-heals automatically.</li>
                <li>Daily rate limits protect the leaderboard against automated bots.</li>
              </ul>
            </Callout>
          </section>

          {/* Section 3: Genesis Quests */}
          <section id="quests-grader" className="scroll-mt-24 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 p-6 sm:p-10 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-2">
              <Trophy className="w-4 h-4" />
              Chapter 3: Challenges
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white mb-4">
              Genesis Quests & Technical Grader
            </h2>
            <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed mb-6">
              Genesis Quests are hands-on coding challenges designed to prepare students for real industry development. Unlike multiple-choice quizzes, GoBoard connects directly to GitHub to inspect your repositories, commit trees, and file contents.
            </p>

            <div className="space-y-6">
              {/* Quest 1 */}
              <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-850/60">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                    Quest 1: Baby Steps in Git
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                    +150 XP
                  </span>
                </div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">
                  Forking, Branching & Opening Your First PR
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed mb-4">
                  Learn how professional software teams collaborate by forking the official GoBoard student repository, creating an isolated feature branch, and adding your student profile markdown card.
                </p>

                <div className="space-y-2 text-xs text-neutral-700 dark:text-neutral-300 mb-4">
                  <div className="font-semibold text-neutral-900 dark:text-white">Requirements to pass the Grader:</div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>Create a fork of the official repository on GitHub.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>Branch named with the pattern: <code>feature/&lt;your-github-username&gt;</code></span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>Add file at: <code>contributors/&lt;your-github-username&gt;.md</code></span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>Submit an open Pull Request back to the upstream repository.</span>
                  </div>
                </div>

                <CodeSnippet
                  title="Terminal Commands for Quest 1"
                  code={`# 1. Clone your personal fork
git clone https://github.com/<your-username>/goboard-students.git
cd goboard-students

# 2. Create your isolated feature branch
git checkout -b feature/<your-username>

# 3. Create your contributor markdown file
mkdir -p contributors
echo "# Student Profile: <Your Name>" > contributors/<your-username>.md

# 4. Commit and push
git add .
git commit -m "feat: add contributor profile for <your-username>"
git push origin feature/<your-username>`}
                />
              </div>

              {/* Quest 2 */}
              <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-850/60">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                    Quest 2: 0x00 Shell Basics
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                    +200 XP
                  </span>
                </div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">
                  Linux Terminal & Shell Mastery
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed mb-4">
                  Master the UNIX command line. Learn file manipulation, standard streams (stdin, stdout, stderr), pipe redirections, and permission chmod bits.
                </p>

                <div className="space-y-2 text-xs text-neutral-700 dark:text-neutral-300">
                  <div className="font-semibold text-neutral-900 dark:text-white">What the Grader checks:</div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>File existence and exact execution permissions (<code>chmod +x</code>).</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>Accurate bash shebang line (<code>#!/bin/bash</code>) in scripts.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>Proper directory structures and clean git history without merge conflicts.</span>
                  </div>
                </div>
              </div>
            </div>

            <Callout type="note" title="How to Run the Automated Grader">
              Once you've pushed your work to GitHub, click the <strong>Builder Quests & Bounty</strong> HUD button in the header, locate your quest, and click <strong>Check Progress</strong>. The server will fetch your commits and grade your work in real-time!
            </Callout>
          </section>

          {/* Section 4: PR Collaboration */}
          <section id="pr-collaboration" className="scroll-mt-24 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 p-6 sm:p-10 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-2">
              <GitPullRequest className="w-4 h-4" />
              Chapter 4: Collaboration
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white mb-4">
              Open-Source & Pull Request (PR) Guide
            </h2>
            <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed mb-6">
              Great software is built collectively. GoBoard allows project creators to mark their repositories as <strong>Open to Contributions</strong> and flag specific areas where they need assistance (Frontend, Backend, Bug Fixes, UI/UX, Documentation).
            </p>

            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-3">
              Step-by-Step Student Contribution Workflow
            </h3>

            <div className="space-y-4 mb-8">
              {[
                {
                  step: '01',
                  title: 'Find an Open Project',
                  desc: 'Filter the project feed on GoBoard by clicking the "Open to Contributions" toggle. Browse requested areas like Frontend or Bug Fixes.',
                },
                {
                  step: '02',
                  title: 'Fork & Clone the Repository',
                  desc: 'Click the GitHub link on the project page. Press "Fork" on GitHub to make a personal copy, then clone it to your local machine.',
                },
                {
                  step: '03',
                  title: 'Create an Isolated Topic Branch',
                  desc: 'Never commit directly to main. Always create a branch with a descriptive name like feat/navbar-darkmode or fix/login-validation.',
                },
                {
                  step: '04',
                  title: 'Write Clean, Tested Code',
                  desc: 'Implement your change. Ensure no unnecessary files (node_modules, .env, OS clutter) are included in your git stage.',
                },
                {
                  step: '05',
                  title: 'Open a Well-Documented Pull Request',
                  desc: 'Push your branch to GitHub and click "Compare & pull request". Fill out the description with what was changed and why.',
                },
              ].map((item) => (
                <div key={item.step} className="flex gap-4 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/60 dark:border-neutral-800">
                  <div className="font-mono text-sm font-bold text-amber-600 dark:text-amber-400 shrink-0 pt-0.5">
                    {item.step}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-neutral-900 dark:text-white mb-1">
                      {item.title}
                    </div>
                    <div className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      {item.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <CodeSnippet
              title="Standard Pull Request Git Flow"
              code={`# 1. Sync your local repo with upstream
git checkout main
git pull origin main

# 2. Branch out
git checkout -b feat/redesign-submission-form

# 3. Make small, atomic commits
git add src/components/Form.tsx
git commit -m "feat(ui): add responsive layout to submission form"

# 4. Push your branch
git push -u origin feat/redesign-submission-form`}
            />

            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mt-8 mb-3">
              Pull Request Etiquette & Best Practices
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-neutral-700 dark:text-neutral-300">
              <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-850/40">
                <span className="font-bold text-neutral-900 dark:text-white block mb-1">Keep PRs Focused</span>
                One PR should solve one issue. Don't mix refactoring, a bug fix, and a new feature in a single 1,500-line pull request.
              </div>
              <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-850/40">
                <span className="font-bold text-neutral-900 dark:text-white block mb-1">Write Clear Commit Messages</span>
                Follow standard prefixes like <code>feat:</code>, <code>fix:</code>, <code>docs:</code>, <code>refactor:</code>, or <code>chore:</code>.
              </div>
              <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-850/40">
                <span className="font-bold text-neutral-900 dark:text-white block mb-1">Include Screenshots for UI</span>
                If you made visual changes, attach before/after screenshots in your PR description so reviewers can immediately see the improvement.
              </div>
              <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-850/40">
                <span className="font-bold text-neutral-900 dark:text-white block mb-1">Respect Author Vision</span>
                Communicate politely in discussion threads. Remember that the project author has the final say on architectural direction.
              </div>
            </div>

            <Callout type="tip" title="In-App Collaboration Notifications">
              When someone opens or merges a Pull Request on your connected repository, GoBoard sends you an in-app notification bell update and credits <strong>+50 XP</strong> once the contribution is merged!
            </Callout>
          </section>

          {/* Section 5: Git Commits */}
          <section id="git-commits" className="scroll-mt-24 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 p-6 sm:p-10 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest mb-2">
              <GitCommit className="w-4 h-4" />
              Chapter 5: Features
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white mb-4">
              Commits as Live Updates
            </h2>
            <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed mb-6">
              Writing manual blog posts or diary updates every week can be tedious for active developers. GoBoard solves this by automatically indexing your connected GitHub repository's commit tree and displaying your git commits directly within your project's <strong>Build Journey</strong>.
            </p>

            <div className="p-5 rounded-2xl bg-neutral-50/80 dark:bg-neutral-850/80 border border-neutral-200/80 dark:border-neutral-800 mb-6">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-2 flex items-center gap-2">
                <GitCommit className="w-4 h-4 text-violet-500" />
                How the Unified Timeline Works
              </h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed mb-4">
                Visitors on your project page can view a unified chronological feed featuring:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800">
                  <div className="font-bold text-neutral-900 dark:text-white mb-1">All Activity</div>
                  <div className="text-neutral-500">
                    Interleaves high-level author milestones and low-level git commits in order of date.
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800">
                  <div className="font-bold text-neutral-900 dark:text-white mb-1">Milestones</div>
                  <div className="text-neutral-500">
                    Curated author updates, product milestones, and screenshot previews.
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800">
                  <div className="font-bold text-neutral-900 dark:text-white mb-1">Git Commits</div>
                  <div className="text-neutral-500">
                    Live commit logs with short SHAs, author avatar, message, and direct links to GitHub.
                  </div>
                </div>
              </div>
            </div>

            <Callout type="note" title="Zero Setup Required">
              As long as your project has a valid public GitHub URL (e.g. <code>https://github.com/username/project</code>), GoBoard pulls recent commits automatically without needing any webhook setup or API token installation.
            </Callout>
          </section>

          {/* Section 6: GoCoins Economy */}
          <section id="gocoins-economy" className="scroll-mt-24 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 p-6 sm:p-10 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-2">
              <Coins className="w-4 h-4" />
              Chapter 6: Economy
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white mb-4">
              GoCoins & Student Wallet
            </h2>
            <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed mb-6">
              GoCoins (GC) are the internal currency powering the GoBoard builder economy. GoCoins are awarded for verified development milestones, peer reviews, technical writing in the Lit Club, and winning seasonal design and engineering campaigns.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <div className="p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/60 dark:border-neutral-800">
                <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold mb-3">
                  <Shield className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-neutral-900 dark:text-white mb-1">
                  Student ID Verification
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed mb-3">
                  To prevent fraudulent multi-accounting and maintain academic integrity, cash payouts require a verified Godfrey Okoye University Student ID card.
                </p>
                <div className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                  Go to Profile → Student ID tab to upload your card.
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/60 dark:border-neutral-800">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold mb-3">
                  <Coins className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-neutral-900 dark:text-white mb-1">
                  Payday Bounties & Cash Payouts
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed mb-3">
                  At the conclusion of each academic season, top builders and campaign winners receive direct Nigerian Naira bank transfers based on their verified GoCoins balance.
                </p>
                <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                  Ensure your bank details are configured in your Profile & Wallet tab.
                </div>
              </div>
            </div>

            <Callout type="important" title="Rules for Seasonal Campaigns">
              During competitive seasons (such as UI/UX Redesign challenges):
              <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                <li>Submissions must include a valid GitHub repository and Figma prototype link.</li>
                <li>Design assets and screenshots should stay on GitHub to keep platform bandwidth clean and fast.</li>
                <li>Winners are selected through a combination of community voting and faculty technical review.</li>
              </ul>
            </Callout>
          </section>

          {/* Section 7: FAQ */}
          <section id="faq" className="scroll-mt-24 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 p-6 sm:p-10 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-2">
              <HelpCircle className="w-4 h-4" />
              Chapter 7: Support
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white mb-4">
              Frequently Asked Questions (FAQ)
            </h2>
            <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed mb-6">
              Quick answers to common questions about synchronization, grading, and approvals.
            </p>

            <div className="space-y-4">
              {[
                {
                  q: 'Why hasn’t my XP updated immediately after completing an action?',
                  a: 'XP events are processed through a cryptographic server ledger to prevent abuse. If your browser connection experienced a temporary latency hiccup, GoBoard automatically runs a background self-heal reconciliation on your next page load or when you click "Reconcile XP" in your profile.',
                },
                {
                  q: 'Why do I see a "GitHub API rate limit reached" notice?',
                  a: 'Unauthenticated requests to the GitHub API are limited by GitHub to 60 queries per hour per IP. Connecting your personal GitHub account in your Profile increases this threshold to 5,000 requests per hour.',
                },
                {
                  q: 'How does the project approval process work?',
                  a: 'New project submissions are placed in the Admin Queue to ensure submissions are academic, appropriate, and contain valid repositories. The student lead team reviews submissions regularly, typically within 12 to 24 hours.',
                },
                {
                  q: 'Can non-Computer Science students participate in GoBoard?',
                  a: 'Absolutely! GoBoard welcomes students from all departments. Non-engineering students frequently contribute UI/UX designs on Figma, write technical essays and stories in the Lit Club, or help test campus applications.',
                },
                {
                  q: 'How do I edit or delete my project once it has been submitted?',
                  a: 'Navigate to your project detail page. As the project author, you will see an "Edit" button beside your project description and title, allowing you to update descriptions, demo links, contribution tags, and add milestones.',
                },
              ].map((faq, i) => (
                <div key={i} className="p-4.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-850/50">
                  <div className="font-bold text-sm text-neutral-900 dark:text-white mb-2">
                    {faq.q}
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Footer Navigation */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <div>
              <div className="font-bold text-sm text-neutral-900 dark:text-white">
                Ready to showcase your software?
              </div>
              <div className="text-xs text-neutral-500">
                Join hundreds of student engineers building in public.
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/browse')}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-800 dark:text-neutral-200 transition-colors cursor-pointer"
              >
                Explore Projects
              </button>
              <button
                type="button"
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 transition-colors cursor-pointer"
              >
                Back to Top ↑
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DocsPage;
