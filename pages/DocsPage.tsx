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
  ChevronDown,
  ChevronLeft,
  Shield,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  Info,
  Lightbulb,
  UserCheck,
  FolderGit2,
  BarChart3,
  GitBranch,
  Megaphone,
  Feather,
  GraduationCap,
  Lock,
  Cpu,
  ListOrdered,
  Link2,
  X,
} from 'lucide-react';
import { RANKS } from '../services/utils';
import { CLIENT_XP_VALUES, CLIENT_XP_LIMITS } from '../services/xpClient';
import { ACTIVE_QUESTS } from '../shared/questsConfig';
import { CONTRIBUTION_AREAS } from '../constants';

interface SubHeading {
  id: string;
  label: string;
}

interface DocSection {
  id: string;
  number: string;
  title: string;
  category: string;
  icon: React.ReactNode;
  summary: string;
  keywords: string;
  subHeadings?: SubHeading[];
}

const DOC_SECTIONS: DocSection[] = [
  {
    id: 'overview',
    number: '01',
    title: 'Welcome and Overview',
    category: 'Foundation',
    icon: <BookOpen className="w-4 h-4" />,
    summary: 'Mission, healthy peer competition, and who GoBoard is built for at Godfrey Okoye University.',
    keywords: 'welcome overview mission healthy competition students lecturers faculty university proof of work',
    subHeadings: [
      { id: 'overview-pillars', label: 'Core Pillars' },
      { id: 'overview-competition', label: 'Why GoBoard Works' },
      { id: 'overview-audience', label: 'Who GoBoard Is For' },
    ],
  },
  {
    id: 'getting-started',
    number: '02',
    title: 'Account Setup and Student Verification',
    category: 'Foundation',
    icon: <UserCheck className="w-4 h-4" />,
    summary: 'Sign in, complete onboarding, link GitHub for 5,000/hr API limits, and verify your GoUni Student ID.',
    keywords: 'account setup onboarding github oauth rate limit 5000 student id verification pending verified rejected bank details',
    subHeadings: [
      { id: 'setup-steps', label: 'Step-by-Step Setup' },
      { id: 'setup-verification', label: 'Student ID Verification' },
      { id: 'setup-statuses', label: 'Verification Statuses' },
    ],
  },
  {
    id: 'projects',
    number: '03',
    title: 'Submitting and Managing Projects',
    category: 'Projects',
    icon: <FolderGit2 className="w-4 h-4" />,
    summary: 'Walkthrough of the project submission form, GitHub auto-import, approval criteria, and Gemini AI insights.',
    keywords: 'submit project github import tech stack contribution areas approval queue rejection criteria gemini ai insight',
    subHeadings: [
      { id: 'projects-walkthrough', label: 'Submission Walkthrough' },
      { id: 'projects-rejection', label: 'What Gets Rejected' },
      { id: 'projects-gemini', label: 'Gemini AI Project Insight' },
    ],
  },
  {
    id: 'xp-system',
    number: '04',
    title: 'XP, Ranks and the XP Ledger',
    category: 'Progression',
    icon: <Sparkles className="w-4 h-4" />,
    summary: 'Canonical XP reward table, builder rank thresholds, idempotent ledger protection, and fair play rules.',
    keywords: 'xp points ranks freshman coder rising dev code ninja campus builder legend hall of fame idempotent ledger anti-cheat',
    subHeadings: [
      { id: 'xp-table', label: 'Verified XP Table' },
      { id: 'xp-ranks', label: 'Builder Ranks' },
      { id: 'xp-level-fast', label: 'How to Level Up Fast' },
      { id: 'xp-ledger', label: 'Idempotent XP Ledger' },
    ],
  },
  {
    id: 'leaderboard',
    number: '05',
    title: 'Leaderboard and Healthy Competition',
    category: 'Progression',
    icon: <BarChart3 className="w-4 h-4" />,
    summary: 'How Top XP and 30-day GitHub Builders rankings work, tie-breaking rules, and community standards.',
    keywords: 'leaderboard top xp github builders 30d active coding days commits stars tie breaker public profile',
  },
  {
    id: 'git-primer',
    number: '06',
    title: 'Git and GitHub Primer',
    category: 'Developer Skills',
    icon: <GitBranch className="w-4 h-4" />,
    summary: 'Beginner-friendly guide to Git version control, daily commands, .gitignore safety, and fixing merge conflicts.',
    keywords: 'git github primer repository commit branch clone fork push pull merge conflict gitignore secrets',
    subHeadings: [
      { id: 'git-terms', label: 'Key Terms' },
      { id: 'git-commands', label: 'Setup & Everyday Loop' },
      { id: 'git-safety', label: '.gitignore & Commit Style' },
      { id: 'git-problems', label: 'Common Problems' },
    ],
  },
  {
    id: 'terminal',
    number: '07',
    title: 'Terminal Basics',
    category: 'Developer Skills',
    icon: <Terminal className="w-4 h-4" />,
    summary: 'Essential UNIX shell commands, file permissions, and writing executable Bash scripts.',
    keywords: 'terminal bash shell pwd ls cd mkdir touch cat cp mv rm chmod shebang script',
  },
  {
    id: 'quests-grader',
    number: '08',
    title: 'Genesis Quests and Grader',
    category: 'Challenges',
    icon: <Trophy className="w-4 h-4" />,
    summary: 'Hands-on Git and Bash quests, automated GitHub repository grading, and troubleshooting failed checks.',
    keywords: 'genesis quests grader baby steps goquests 0x00 shell basics check progress troubleshooting',
    subHeadings: [
      { id: 'quests-overview', label: 'Quest Overview Table' },
      { id: 'quests-walkthroughs', label: 'Quest Specifications' },
      { id: 'quests-troubleshooting', label: 'Troubleshooting Failed Checks' },
    ],
  },
  {
    id: 'pr-collaboration',
    number: '09',
    title: 'Open-Source and PR Guide',
    category: 'Collaboration',
    icon: <GitPullRequest className="w-4 h-4" />,
    summary: 'Finding projects open to contributions, forking, topic branches, and pull request etiquette.',
    keywords: 'open source pull request pr collaboration fork branch review etiquette contributors',
  },
  {
    id: 'git-commits',
    number: '10',
    title: 'Commits as Live Updates and Build Journey',
    category: 'Features',
    icon: <GitCommit className="w-4 h-4" />,
    summary: 'Unified project timelines combining manual Build Journey milestones with live GitHub commit history.',
    keywords: 'git commits live updates build journey milestones timeline filters rate limits caching',
  },
  {
    id: 'campaigns',
    number: '11',
    title: 'Campaigns',
    category: 'Challenges',
    icon: <Megaphone className="w-4 h-4" />,
    summary: 'Campus-wide design and engineering sprints, starting with the GoUni Prayer Book Redesign Campaign.',
    keywords: 'campaigns gouni prayer book redesign 100 xp solo duo figma google drive readme pitch rubric',
    subHeadings: [
      { id: 'campaigns-prayerbook', label: 'GoUni Prayer Book Redesign' },
      { id: 'campaigns-submission', label: 'What to Submit' },
      { id: 'campaigns-rubric', label: '100-Point Judging Rubric' },
    ],
  },
  {
    id: 'gocoins-economy',
    number: '12',
    title: 'GoCoins and Student Wallet',
    category: 'Economy',
    icon: <Coins className="w-4 h-4" />,
    summary: 'How GoCoins work, configuring your student wallet, ID verification, and end-of-season Naira payouts.',
    keywords: 'gocoins student wallet payday naira bank transfer verification payout',
  },
  {
    id: 'lit-club',
    number: '13',
    title: 'Lit Club',
    category: 'Community',
    icon: <Feather className="w-4 h-4" />,
    summary: 'Campus creative and technical writing showcase for short stories, poetry, and essays across all faculties.',
    keywords: 'lit club literature writing short stories poems essays non-cs students xp approval',
  },
  {
    id: 'lecturers',
    number: '14',
    title: 'For Lecturers and Faculty',
    category: 'Academic',
    icon: <GraduationCap className="w-4 h-4" />,
    summary: 'Using GoBoard to verify coursework repositories, inspect commit authorship in group projects, and sponsor campaigns.',
    keywords: 'lecturers faculty hod dean final year project coursework github verification group contribution',
  },
  {
    id: 'admins',
    number: '15',
    title: 'Admin Guide',
    category: 'Operations',
    icon: <Shield className="w-4 h-4" />,
    summary: 'Reference for student moderators and faculty admins managing queues, ID verification, payouts, and XP audits.',
    keywords: 'admin guide moderation project queue student id verification payday xp history reconcile',
  },
  {
    id: 'privacy',
    number: '16',
    title: 'Privacy, Security and Data',
    category: 'Trust & Safety',
    icon: <Lock className="w-4 h-4" />,
    summary: 'What data GoBoard stores, who can view sensitive fields, Firestore security rules, and data deletion requests.',
    keywords: 'privacy security data firestore rules student id visibility bank details deletion',
  },
  {
    id: 'technical',
    number: '17',
    title: 'Technical Overview and Contributing',
    category: 'Engineering',
    icon: <Cpu className="w-4 h-4" />,
    summary: 'GoBoard system architecture, React 19 + Firebase + Vercel stack, Firestore schema, and local development setup.',
    keywords: 'technical overview contributing architecture react typescript tailwind firebase firestore vercel setup',
    subHeadings: [
      { id: 'tech-architecture', label: 'System Architecture' },
      { id: 'tech-collections', label: 'Firestore Collections' },
      { id: 'tech-setup', label: 'Local Setup' },
    ],
  },
  {
    id: 'faq',
    number: '18',
    title: 'FAQ and Troubleshooting',
    category: 'Support',
    icon: <HelpCircle className="w-4 h-4" />,
    summary: 'Direct answers to common questions on XP sync, private repos, ID rejection, bank updates, and browser support.',
    keywords: 'faq troubleshooting private repo id rejected bank details disconnect github rate limit queue bug report',
  },
  {
    id: 'glossary',
    number: '19',
    title: 'Glossary and Changelog',
    category: 'Reference',
    icon: <ListOrdered className="w-4 h-4" />,
    summary: 'Definitions of platform and Git terms alongside the dated GoBoard release changelog.',
    keywords: 'glossary changelog definitions xp rank ledger quest grader pr fork branch build journey gocoins',
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
    <div className="my-4 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-950 text-neutral-100">
      {title && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800 bg-neutral-900/70 text-xs text-neutral-400 font-mono">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-neutral-500" />
            <span>{title}</span>
          </div>
          <span className="text-[10px] uppercase font-semibold tracking-wider text-neutral-500">
            {language}
          </span>
        </div>
      )}
      <div className="relative p-4 font-mono text-[12.5px] leading-relaxed overflow-x-auto">
        <button
          type="button"
          onClick={handleCopy}
          className="absolute right-3 top-3 p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
          title="Copy code"
          aria-label="Copy code"
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
      border: 'border-emerald-200/80 dark:border-emerald-900/60',
      bg: 'bg-emerald-50/50 dark:bg-emerald-950/20',
      text: 'text-neutral-800 dark:text-neutral-200',
      titleColor: 'text-emerald-800 dark:text-emerald-300',
      icon: <Lightbulb className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />,
      defaultTitle: 'Tip',
    },
    note: {
      border: 'border-neutral-200 dark:border-neutral-800',
      bg: 'bg-neutral-50 dark:bg-neutral-950/60',
      text: 'text-neutral-700 dark:text-neutral-300',
      titleColor: 'text-neutral-900 dark:text-neutral-100',
      icon: <Info className="w-4 h-4 text-neutral-500 dark:text-neutral-400 shrink-0" />,
      defaultTitle: 'Note',
    },
    warning: {
      border: 'border-amber-200/80 dark:border-amber-900/60',
      bg: 'bg-amber-50/50 dark:bg-amber-950/20',
      text: 'text-neutral-800 dark:text-neutral-200',
      titleColor: 'text-amber-800 dark:text-amber-300',
      icon: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />,
      defaultTitle: 'Warning',
    },
    important: {
      border: 'border-neutral-300 dark:border-neutral-700',
      bg: 'bg-neutral-100/70 dark:bg-neutral-800/40',
      text: 'text-neutral-800 dark:text-neutral-200',
      titleColor: 'text-neutral-900 dark:text-white',
      icon: <CheckCircle2 className="w-4 h-4 text-neutral-700 dark:text-neutral-300 shrink-0" />,
      defaultTitle: 'Important',
    },
  }[type];

  return (
    <div className={`my-5 rounded-xl p-4 border ${styles.border} ${styles.bg} ${styles.text}`}>
      <div className="flex items-center gap-2 mb-1.5 font-semibold text-xs uppercase tracking-wider">
        {styles.icon}
        <span className={styles.titleColor}>{title || styles.defaultTitle}</span>
      </div>
      <div className="text-[13px] leading-relaxed">{children}</div>
    </div>
  );
};

interface ChapterShellProps {
  section: DocSection;
  prevSection?: DocSection;
  nextSection?: DocSection;
  onSelectSection: (id: string) => void;
  children: React.ReactNode;
}

const ChapterShell: React.FC<ChapterShellProps> = ({
  section,
  prevSection,
  nextSection,
  onSelectSection,
  children,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyChapterLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#${section.id}`;
    navigator.clipboard.writeText(url);
    window.history.replaceState(null, '', `#${section.id}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const scrollToSubHeading = (subId: string) => {
    const el = document.getElementById(subId);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <section
      id={section.id}
      className="scroll-mt-24 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 overflow-hidden shadow-2xs"
    >
      {/* Top Meta Bar */}
      <div className="px-6 sm:px-8 py-3.5 border-b border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-950/30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-neutral-400 dark:text-neutral-500">{section.icon}</span>
          <span className="font-mono font-semibold text-neutral-400 dark:text-neutral-500">
            {section.number} / {DOC_SECTIONS.length}
          </span>
          <span className="text-neutral-300 dark:text-neutral-700">·</span>
          <span className="font-mono text-[11px] uppercase tracking-wider font-semibold text-neutral-500 dark:text-neutral-400">
            {section.category}
          </span>
        </div>

        <button
          type="button"
          onClick={handleCopyChapterLink}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          title="Copy direct link to this chapter"
        >
          {copiedLink ? (
            <>
              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span className="text-emerald-600 dark:text-emerald-400">Link copied</span>
            </>
          ) : (
            <>
              <Link2 className="w-3 h-3" />
              <span>#{section.id}</span>
            </>
          )}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="p-6 sm:p-8">
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white mb-2">
            {section.title}
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
            {section.summary}
          </p>
        </div>

        {/* Optional "On this page" mini TOC for long chapters */}
        {section.subHeadings && section.subHeadings.length > 0 && (
          <div className="mb-6 p-3.5 rounded-xl bg-neutral-50/80 dark:bg-neutral-950/50 border border-neutral-200/70 dark:border-neutral-800/80 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-neutral-400 dark:text-neutral-500 mr-1">
              In this chapter:
            </span>
            {section.subHeadings.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => scrollToSubHeading(sub.id)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors cursor-pointer"
              >
                {sub.label}
              </button>
            ))}
          </div>
        )}

        <div className="text-[13.5px] text-neutral-700 dark:text-neutral-300 leading-relaxed space-y-5">
          {children}
        </div>

        {/* Previous / Next Chapter Footer */}
        <div className="mt-8 pt-5 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between gap-4">
          {prevSection ? (
            <button
              type="button"
              onClick={() => onSelectSection(prevSection.id)}
              className="group flex items-center gap-2.5 text-left py-1.5 px-3 -ml-3 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer max-w-[48%]"
            >
              <ChevronLeft className="w-4 h-4 text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white shrink-0 transition-transform group-hover:-translate-x-0.5" />
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                  Previous · {prevSection.number}
                </div>
                <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-white truncate">
                  {prevSection.title}
                </div>
              </div>
            </button>
          ) : (
            <div />
          )}

          {nextSection ? (
            <button
              type="button"
              onClick={() => onSelectSection(nextSection.id)}
              className="group flex items-center gap-2.5 text-right py-1.5 px-3 -mr-3 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer max-w-[48%] ml-auto"
            >
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                  Next · {nextSection.number}
                </div>
                <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-white truncate">
                  {nextSection.title}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white shrink-0 transition-transform group-hover:translate-x-0.5" />
            </button>
          ) : (
            <div />
          )}
        </div>
      </div>
    </section>
  );
};

export const DocsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    setMobileMenuOpen(false);
    window.history.replaceState(null, '', `#${id}`);
    const el = document.getElementById(id);
    if (el) {
      const yOffset = -90;
      const y = el.getBoundingClientRect().top + window.scrollY + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  // Support both #section hashes and ?section= query params on mount & location change
  useEffect(() => {
    const hashSection = location.hash ? location.hash.replace(/^#/, '') : '';
    const params = new URLSearchParams(location.search);
    const querySection = params.get('section') || '';
    const target = hashSection || querySection;

    if (target && DOC_SECTIONS.some((s) => s.id === target)) {
      setActiveSection(target);
      setTimeout(() => {
        const el = document.getElementById(target);
        if (el) {
          const y = el.getBoundingClientRect().top + window.scrollY - 90;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }, 60);
    }
  }, [location.hash, location.search]);

  // Scroll-spy using IntersectionObserver so the sidebar follows the reader
  useEffect(() => {
    const elements = DOC_SECTIONS.map((s) => document.getElementById(s.id)).filter(
      Boolean
    ) as HTMLElement[];
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0 && visible[0].target.id) {
          setActiveSection(visible[0].target.id);
        }
      },
      {
        rootMargin: '-100px 0px -65% 0px',
        threshold: 0,
      }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [searchQuery]);

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return DOC_SECTIONS;
    const q = searchQuery.toLowerCase().trim();
    return DOC_SECTIONS.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.summary.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.keywords.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const visibleIds = useMemo(
    () => new Set(filteredSections.map((s) => s.id)),
    [filteredSections]
  );

  const activeDocSection =
    DOC_SECTIONS.find((s) => s.id === activeSection) || DOC_SECTIONS[0];

  const getNeighbors = (id: string) => {
    const idx = DOC_SECTIONS.findIndex((s) => s.id === id);
    return {
      section: DOC_SECTIONS[idx] || DOC_SECTIONS[0],
      prevSection: idx > 0 ? DOC_SECTIONS[idx - 1] : undefined,
      nextSection: idx >= 0 && idx < DOC_SECTIONS.length - 1 ? DOC_SECTIONS[idx + 1] : undefined,
    };
  };

  return (
    <div className="max-w-[1360px] mx-auto px-2 sm:px-4 py-4 sm:py-6">
      {/* ─── Editorial Header Card (Matches CampaignBanner Design Language) ─── */}
      <div className="rounded-2xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-card border border-neutral-200/80 dark:border-neutral-800 overflow-hidden mb-6 sm:mb-8">
        {/* Top Bar */}
        <div className="px-5 sm:px-8 py-3.5 border-b border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-950/30 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
              GoBoard Docs v2
            </span>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {DOC_SECTIONS.length} chapters · Student, Lecturer &amp; Admin Reference
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => navigate('/browse')}
              className="px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200/70 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 font-semibold text-xs transition-colors cursor-pointer"
            >
              Back to Projects
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
          <div className="lg:col-span-7 space-y-3">
            <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Godfrey Okoye University · Faculty of Computing
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white">
              Everything you need to build, collaborate &amp; level up.
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-2xl">
              Complete technical guides covering account verification, project publishing, the idempotent XP ledger, Git &amp; Linux terminal basics, Genesis Quests, faculty campaigns, and the student wallet.
            </p>
          </div>

          {/* Search & Quick Jump Column */}
          <div className="lg:col-span-5 space-y-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search chapters & topics (e.g. Git, Quests, XP, ID, Lecturers)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 focus:border-neutral-400 dark:focus:border-neutral-600 focus:bg-white dark:focus:bg-neutral-900 focus:outline-none text-xs sm:text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[11px] font-mono text-neutral-400 mr-1">Jump:</span>
              {[
                { id: 'getting-started', label: '02 Setup' },
                { id: 'xp-system', label: '04 XP & Ranks' },
                { id: 'git-primer', label: '06 Git Primer' },
                { id: 'quests-grader', label: '08 Quests' },
                { id: 'campaigns', label: '11 Campaigns' },
                { id: 'lecturers', label: '14 Lecturers' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => scrollToSection(pill.id)}
                  className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer font-mono text-[11px] font-medium"
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Mobile Collapsible Chapter Picker (Visible below lg) ─── */}
      <div className="lg:hidden sticky top-16 z-30 mb-6">
        <div className="rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border border-neutral-200/90 dark:border-neutral-800 shadow-card overflow-hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 shrink-0">
                {activeDocSection.number} / {DOC_SECTIONS.length}
              </span>
              <span className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
                {activeDocSection.title}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-neutral-500 shrink-0">
              <span className="text-[11px] font-medium">Chapters</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${mobileMenuOpen ? 'rotate-180' : ''}`}
              />
            </div>
          </button>

          {mobileMenuOpen && (
            <div className="max-h-80 overflow-y-auto border-t border-neutral-100 dark:border-neutral-800 p-2 space-y-0.5">
              {filteredSections.map((sec) => {
                const isActive = activeSection === sec.id;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => scrollToSection(sec.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-semibold'
                        : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="font-mono text-[11px] opacity-60">{sec.number}</span>
                      <span className="truncate">{sec.title}</span>
                    </div>
                    <span className="text-[10px] font-mono opacity-60 shrink-0 ml-2">
                      {sec.category}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Main Documentation Grid ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Sticky Sidebar Navigation (Desktop) */}
        <aside className="hidden lg:block lg:col-span-3 lg:sticky lg:top-20 space-y-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 p-3 shadow-2xs">
            <div className="flex items-center justify-between px-2.5 py-1.5 mb-1">
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                Chapters ({filteredSections.length})
              </span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-[11px] text-neutral-500 hover:text-neutral-900 dark:hover:text-white cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>

            <nav className="space-y-0.5 max-h-[calc(100vh-14rem)] overflow-y-auto pr-1">
              {filteredSections.map((sec) => {
                const isActive = activeSection === sec.id;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => scrollToSection(sec.id)}
                    className={`flex items-center justify-between w-full text-left px-2.5 py-2 rounded-xl text-xs transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-semibold'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-800/60 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span
                        className={`font-mono text-[11px] tabular-nums ${
                          isActive ? 'opacity-80' : 'text-neutral-400 dark:text-neutral-500'
                        }`}
                      >
                        {sec.number}
                      </span>
                      <span className="truncate">{sec.title}</span>
                    </div>
                    {isActive && <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-70" />}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Editorial Sidebar Support Card */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-4 border border-neutral-200/80 dark:border-neutral-800 text-xs space-y-2.5">
            <div className="text-[11px] font-mono uppercase tracking-wider font-semibold text-neutral-400 dark:text-neutral-500">
              Faculty of Computing
            </div>
            <div className="font-semibold text-neutral-900 dark:text-white text-[13px]">
              Need help with your project or quest?
            </div>
            <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Reach out to the Office of the Software Director (NACOS / Faculty of Computing) or jump straight to the FAQ.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => scrollToSection('faq')}
                className="flex-1 py-2 px-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-semibold transition-colors cursor-pointer text-center"
              >
                Read FAQ
              </button>
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="flex-1 py-2 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-950 font-semibold transition-colors cursor-pointer text-center"
              >
                My Profile
              </button>
            </div>
          </div>
        </aside>

        {/* Content Body */}
        <main className="lg:col-span-9 space-y-8">
          {filteredSections.length === 0 && (
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 p-10 text-center space-y-3">
              <div className="text-base font-bold text-neutral-900 dark:text-white">
                No chapters matched &ldquo;{searchQuery}&rdquo;
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Try searching for terms like <code className="font-mono">Git</code>, <code className="font-mono">XP</code>, <code className="font-mono">GoQuests</code>, <code className="font-mono">Verification</code>, or <code className="font-mono">Lecturer</code>.
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold cursor-pointer"
              >
                Show All {DOC_SECTIONS.length} Chapters
              </button>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════
              CHAPTER 1: OVERVIEW
             ═════════════════════════════════════════════════════════════════ */}
          {visibleIds.has('overview') && (
            <ChapterShell {...getNeighbors('overview')} onSelectSection={scrollToSection}>
              <p>
                <strong>GoBoard</strong> is the student engineering showcase, learning curriculum, and developer network for <strong>Godfrey Okoye University</strong>. Instead of letting coursework and personal software sit unseen on laptops after grading, GoBoard gives students a permanent, verifiable public portfolio backed by real GitHub repositories.
              </p>

              <div id="overview-pillars" className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200/80 dark:border-neutral-800">
                  <div className="font-mono text-xs font-semibold text-neutral-400 mb-2">01 · PORTFOLIO</div>
                  <div className="font-bold text-sm text-neutral-900 dark:text-white mb-1">
                    Verified Proof of Work
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    Every project links directly to a public GitHub repository, live demo, commit timeline, and contributor list.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200/80 dark:border-neutral-800">
                  <div className="font-mono text-xs font-semibold text-neutral-400 mb-2">02 · COLLABORATION</div>
                  <div className="font-bold text-sm text-neutral-900 dark:text-white mb-1">
                    Campus Open Source
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    Mark projects as <em>Open to Contributions</em> and invite classmates to ship frontend, backend, UI/UX, or bug-fix pull requests.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200/80 dark:border-neutral-800">
                  <div className="font-mono text-xs font-semibold text-neutral-400 mb-2">03 · CURRICULUM</div>
                  <div className="font-bold text-sm text-neutral-900 dark:text-white mb-1">
                    Quests &amp; Campaigns
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    Pass automated Git and Linux terminal quests, earn verified XP, and compete in real university software campaigns.
                  </p>
                </div>
              </div>

              <div id="overview-competition" className="space-y-2 pt-2">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  Why GoBoard works: healthy competition
                </h3>
                <blockquote className="pl-4 border-l-2 border-neutral-900 dark:border-neutral-200 text-neutral-600 dark:text-neutral-300 italic bg-neutral-50/70 dark:bg-neutral-950/40 py-3 pr-4 rounded-r-xl">
                  Students do their best work when they can see what their classmates are building. On GoBoard, projects, XP and ranks are public, so healthy competition and peer motivation push everyone past the minimum. You see someone ship a feature, you want to ship one too. Competition on GoBoard rewards effort that can be verified: real commits, real repositories, real merged pull requests.
                </blockquote>
              </div>

              <div id="overview-audience" className="space-y-3 pt-2">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  Who is GoBoard for?
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                    <div className="font-bold text-sm text-neutral-900 dark:text-white mb-1.5">
                      Students
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                      Build a living engineering portfolio from 100 Level to graduation, learn Git and Linux through practical quests, collaborate with peers, and share a verified profile with employers.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                    <div className="font-bold text-sm text-neutral-900 dark:text-white mb-1.5">
                      Lecturers
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                      Inspect real commit histories and individual contribution breakdowns for course assignments and final-year projects without manually downloading zip archives.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                    <div className="font-bold text-sm text-neutral-900 dark:text-white mb-1.5">
                      Faculty &amp; University
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                      Maintain a public record of student innovation across Godfrey Okoye University and direct student talent toward real campus tools through sponsored campaigns.
                    </p>
                  </div>
                </div>
              </div>
            </ChapterShell>
          )}

          {/* ═════════════════════════════════════════════════════════════════
              CHAPTER 2: ACCOUNT SETUP & STUDENT VERIFICATION
             ═════════════════════════════════════════════════════════════════ */}
          {visibleIds.has('getting-started') && (
            <ChapterShell {...getNeighbors('getting-started')} onSelectSection={scrollToSection}>
              <div id="setup-steps" className="space-y-3">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  Step-by-Step Account Setup
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-xs sm:text-[13px]">
                  <li>
                    <strong>Sign in:</strong> Click <strong>Sign In</strong> and authenticate with your university email, Google account, or GitHub account.
                  </li>
                  <li>
                    <strong>Complete Onboarding (+{CLIENT_XP_VALUES.ONBOARDING_COMPLETE} XP):</strong> Enter your display name, select your department and academic level (e.g. <code className="font-mono">200 Level</code>), and pick up to 5 technical interests on the welcome screen.
                  </li>
                  <li>
                    <strong>Connect GitHub (+{CLIENT_XP_VALUES.GITHUB_CONNECT} XP):</strong> Open <strong>My Profile</strong> and link your GitHub account via OAuth (or username fallback). Connecting GitHub via OAuth also raises your GitHub API rate limit from <strong>60 to 5,000 requests per hour</strong>.
                  </li>
                  <li>
                    <strong>Configure Payday &amp; Wallet:</strong> Switch to the <strong>Payday &amp; Wallet</strong> tab in your profile (<code className="font-mono">/profile?tab=wallet</code>) to upload your Godfrey Okoye University Student ID card and save your bank details.
                  </li>
                </ol>
              </div>

              <div id="setup-verification" className="space-y-2 pt-2">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  Student ID Verification &amp; Bank Details
                </h3>
                <p>
                  To protect academic integrity and prevent multi-account farming (&ldquo;smurfing&rdquo;), cash payouts at the end of a season require a verified Godfrey Okoye University Student ID card. You do <strong>not</strong> need ID verification to browse, submit projects, post in the Lit Club, or complete Genesis Quests.
                </p>
                <p>
                  Your payout bank details (<strong>Bank Name</strong>, <strong>10-digit Account Number</strong>, and <strong>Account Name</strong>) are entered exclusively inside <strong>Profile → Payday &amp; Wallet</strong>. Never post your bank account number in project descriptions or comments.
                </p>
              </div>

              <div id="setup-statuses" className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {[
                  {
                    status: 'Not Uploaded (none)',
                    desc: 'Default state for new accounts. You can use all learning and showcase features, but payouts are locked until an ID card is uploaded.',
                  },
                  {
                    status: 'Pending Admin Review (pending)',
                    desc: 'Your Student ID photo has been uploaded and is waiting in the admin verification queue.',
                  },
                  {
                    status: 'Verified (verified)',
                    desc: 'Approved by an admin. Your public profile displays a Verified badge and your wallet is eligible for Payday transfers.',
                  },
                  {
                    status: 'Rejected (rejected)',
                    desc: 'The uploaded image was blurry, expired, or did not match a valid GoUni ID. Read the rejection reason in your Wallet tab and click "Replace Student ID Photo".',
                  },
                ].map((item) => (
                  <div
                    key={item.status}
                    className="p-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40"
                  >
                    <div className="font-mono text-xs font-bold text-neutral-900 dark:text-white mb-1">
                      {item.status}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>

              <Callout type="important" title="ID Card Privacy">
                Your uploaded Student ID card image is visible <strong>only to you and platform admins</strong> for verification. Other students only see a green <em>Verified</em> badge on your profile once approved.
              </Callout>
            </ChapterShell>
          )}

          {/* ═════════════════════════════════════════════════════════════════
              CHAPTER 3: SUBMITTING AND MANAGING PROJECTS
             ═════════════════════════════════════════════════════════════════ */}
          {visibleIds.has('projects') && (
            <ChapterShell {...getNeighbors('projects')} onSelectSection={scrollToSection}>
              <div id="projects-walkthrough" className="space-y-3">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  Walkthrough: Publishing a Project
                </h3>
                <ol className="list-decimal list-inside space-y-2.5 text-xs sm:text-[13px]">
                  <li>
                    <strong>Click Submit Project:</strong> Use the <strong>Submit Project</strong> button in the navigation bar.
                  </li>
                  <li>
                    <strong>Import from GitHub (Optional Fast Path):</strong> If your GitHub account is connected, pick any of your public repositories from the dropdown or paste a repo URL. GoBoard automatically pulls your repository title, <code className="font-mono">README.md</code> summary, detected programming languages, topics, and deployed homepage URL.
                  </li>
                  <li>
                    <strong>Complete Required Details:</strong> Verify or enter your <strong>Project Title</strong> (must be unique on GoBoard), <strong>Academic Level</strong>, <strong>Category</strong>, <strong>Description</strong>, comma-separated <strong>Tech Stack</strong>, and <strong>Public GitHub Repository URL</strong>. Optionally add a <strong>Live Demo URL</strong> and upload a <strong>Cover Image</strong> (up to 5 MB).
                  </li>
                  <li>
                    <strong>Configure Open-Source Collaboration:</strong> Toggle <strong>Open to Contributions</strong> if you want classmates to help build your project, then select the areas where you need support ({CONTRIBUTION_AREAS.join(', ')}) and add an optional note for contributors.
                  </li>
                  <li>
                    <strong>Submit &amp; Earn XP:</strong> Submitting your very first project earns <strong>+{CLIENT_XP_VALUES.SUBMIT_PROJECT + CLIENT_XP_VALUES.FIRST_PROJECT} XP</strong> (+{CLIENT_XP_VALUES.SUBMIT_PROJECT} XP submission + +{CLIENT_XP_VALUES.FIRST_PROJECT} XP first-project bonus). Every subsequent project submission earns <strong>+{CLIENT_XP_VALUES.SUBMIT_PROJECT} XP</strong>.
                  </li>
                  <li>
                    <strong>Admin Review &amp; Build Journey:</strong> Your project enters the admin review queue (typically reviewed within 12 to 24 hours). Approval awards another <strong>+{CLIENT_XP_VALUES.PROJECT_APPROVED} XP</strong>. Once live, open your project page anytime to edit details, sync GitHub metadata, advance your project stage (<em>Idea → Building → Beta → Launched</em>), or post Build Journey milestones.
                  </li>
                </ol>
              </div>

              <div id="projects-rejection" className="space-y-2 pt-2">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  What Gets Rejected in Review
                </h3>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-neutral-600 dark:text-neutral-400">
                  <li>
                    <strong>Broken, private, or empty GitHub repositories:</strong> Your repository URL must be publicly reachable and contain actual source files rather than an empty initial commit.
                  </li>
                  <li>
                    <strong>Plagiarized or uncredited forks:</strong> Submitting someone else&rsquo;s repository as your own work without substantial original commits will be rejected.
                  </li>
                  <li>
                    <strong>Placeholder or spam descriptions:</strong> Titles or descriptions consisting of random characters or single-word placeholders.
                  </li>
                  <li>
                    <strong>Inappropriate content or exposed secrets:</strong> Projects containing offensive material or committed API keys/passwords.
                  </li>
                </ul>
              </div>

              <div id="projects-gemini" className="space-y-2 pt-2">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  Gemini AI Project Insight
                </h3>
                <p>
                  Every project detail page includes an on-demand <strong>AI Project Insight</strong> powered by Google Gemini (<code className="font-mono">/api/insight</code>). Clicking <strong>Generate AI Insight</strong> analyzes the project&rsquo;s title, description, category, and tech stack to return three structured sections:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200/80 dark:border-neutral-800">
                    <div className="font-bold text-xs text-neutral-900 dark:text-white mb-1">1. Technical Review</div>
                    <p className="text-xs text-neutral-500">Evaluates the architecture and stack choices for the problem domain.</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200/80 dark:border-neutral-800">
                    <div className="font-bold text-xs text-neutral-900 dark:text-white mb-1">2. Potential Impact</div>
                    <p className="text-xs text-neutral-500">Highlights how the project benefits students, faculty, or real users.</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200/80 dark:border-neutral-800">
                    <div className="font-bold text-xs text-neutral-900 dark:text-white mb-1">3. Growth Suggestion</div>
                    <p className="text-xs text-neutral-500">Recommends a concrete next technical step or improvement.</p>
                  </div>
                </div>
                <Callout type="note" title="Advisory Feedback, Not a Grade">
                  Gemini AI Project Insights are instant architectural feedback to help you improve your project presentation and roadmap. They do not affect your XP, rank, or lecturer grading.
                </Callout>
              </div>
            </ChapterShell>
          )}

          {/* ═════════════════════════════════════════════════════════════════
              CHAPTER 4: XP, RANKS AND THE XP LEDGER
             ═════════════════════════════════════════════════════════════════ */}
          {visibleIds.has('xp-system') && (
            <ChapterShell {...getNeighbors('xp-system')} onSelectSection={scrollToSection}>
              <p>
                Experience Points (<strong>XP</strong>) measure verified building, writing, and collaboration on GoBoard. All values below are imported directly from GoBoard&rsquo;s shared rules engine (<code className="font-mono">CLIENT_XP_VALUES</code> and <code className="font-mono">RANKS</code>) so this table never drifts from live platform behavior.
              </p>

              {/* Canonical XP Table */}
              <div id="xp-table" className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 my-4">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-950 text-neutral-600 dark:text-neutral-400 font-mono uppercase tracking-wider text-[11px] border-b border-neutral-200 dark:border-neutral-800">
                    <tr>
                      <th className="py-3 px-4">Action / Milestone</th>
                      <th className="py-3 px-4">Reward</th>
                      <th className="py-3 px-4">Frequency</th>
                      <th className="py-3 px-4">Verification Rule</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800 text-neutral-700 dark:text-neutral-300">
                    <tr>
                      <td className="py-2.5 px-4 font-semibold">Complete User Onboarding</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">+{CLIENT_XP_VALUES.ONBOARDING_COMPLETE} XP</td>
                      <td className="py-2.5 px-4">One-time</td>
                      <td className="py-2.5 px-4">Ledger key <code className="font-mono">onboarding_&#123;uid&#125;</code></td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-semibold">Connect GitHub Account</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">+{CLIENT_XP_VALUES.GITHUB_CONNECT} XP</td>
                      <td className="py-2.5 px-4">One-time</td>
                      <td className="py-2.5 px-4">Ledger key <code className="font-mono">github_connect_&#123;uid&#125;</code></td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-semibold">First Project Bonus</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">+{CLIENT_XP_VALUES.FIRST_PROJECT} XP</td>
                      <td className="py-2.5 px-4">One-time</td>
                      <td className="py-2.5 px-4">Added to +{CLIENT_XP_VALUES.SUBMIT_PROJECT} XP submission (+{CLIENT_XP_VALUES.FIRST_PROJECT + CLIENT_XP_VALUES.SUBMIT_PROJECT} XP total)</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-semibold">Submit a Project or Lit Club Piece</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">+{CLIENT_XP_VALUES.SUBMIT_PROJECT} XP</td>
                      <td className="py-2.5 px-4">Per submission</td>
                      <td className="py-2.5 px-4">Valid repository or writing submission</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-semibold">Project or Writing Approved by Admin</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">+{CLIENT_XP_VALUES.PROJECT_APPROVED} XP</td>
                      <td className="py-2.5 px-4">Per approval</td>
                      <td className="py-2.5 px-4">Admin queue review</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-semibold">Active GitHub Coding Day</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">+{CLIENT_XP_VALUES.GITHUB_ACTIVE_DAY} XP</td>
                      <td className="py-2.5 px-4">Once per active day</td>
                      <td className="py-2.5 px-4">Public push event within last 7 days</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-semibold">3-Day Login Streak Bonus</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">+{CLIENT_XP_VALUES.LOGIN_STREAK} XP</td>
                      <td className="py-2.5 px-4">Every 3 streak days</td>
                      <td className="py-2.5 px-4">Triggered when <code className="font-mono">streakDays % 3 === 0</code></td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-semibold">Genesis Quest 1: Baby Steps</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">+{CLIENT_XP_VALUES.QUEST_1_BABY_STEPS} XP</td>
                      <td className="py-2.5 px-4">One-time</td>
                      <td className="py-2.5 px-4">Automated GitHub Quest Checker</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-semibold">Genesis Quest 2: 0x00. Shell Basics</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">+{CLIENT_XP_VALUES.QUEST_2_SHELL_BASICS} XP</td>
                      <td className="py-2.5 px-4">One-time</td>
                      <td className="py-2.5 px-4">Automated GitHub Quest Checker</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-semibold">Campaign Submission Approved</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">+{CLIENT_XP_VALUES.CAMPAIGN_SUBMISSION_APPROVED} XP</td>
                      <td className="py-2.5 px-4">Per campaign</td>
                      <td className="py-2.5 px-4">Admin approval of campaign entry</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-semibold">Receive an Upvote</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">+{CLIENT_XP_VALUES.RECEIVE_VOTE} XP</td>
                      <td className="py-2.5 px-4">Per unique voter</td>
                      <td className="py-2.5 px-4">Item has {CLIENT_XP_LIMITS.MIN_VOTES_FOR_XP}+ likes; voter account &ge; {CLIENT_XP_LIMITS.MIN_ACCOUNT_AGE_DAYS} days old</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-semibold">10-Vote &amp; 50-Vote Project Milestones</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">+{CLIENT_XP_VALUES.VOTE_MILESTONE_10} / +{CLIENT_XP_VALUES.VOTE_MILESTONE_50} XP</td>
                      <td className="py-2.5 px-4">One-time per project</td>
                      <td className="py-2.5 px-4">Reached 10 or 50 verified upvotes</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-semibold">Leave / Receive a Comment</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">+{CLIENT_XP_VALUES.LEAVE_COMMENT} / +{CLIENT_XP_VALUES.RECEIVE_COMMENT} XP</td>
                      <td className="py-2.5 px-4">Capped at {CLIENT_XP_LIMITS.COMMENT_XP_DAILY_CAP} XP/day</td>
                      <td className="py-2.5 px-4">On items with {CLIENT_XP_LIMITS.MIN_VOTES_FOR_XP}+ likes</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Shared Ranks Hierarchy */}
              <div id="xp-ranks" className="space-y-3 pt-2">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  Builder Rank Thresholds
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {RANKS.map((r) => (
                    <div
                      key={r.rank}
                      className="p-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-neutral-900 dark:text-white">
                          {r.emoji} {r.rank}
                        </div>
                        <div className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 mt-0.5">
                          {r.max !== null
                            ? `${r.min.toLocaleString()} – ${r.max.toLocaleString()} XP`
                            : `${r.min.toLocaleString()}+ XP`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* How to Level Up Fast */}
              <div id="xp-level-fast" className="space-y-2 pt-2">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  How to Level Up Fast (Reach 100+ XP on Day 1)
                </h3>
                <ul className="list-disc list-inside space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
                  <li>
                    Complete onboarding (+{CLIENT_XP_VALUES.ONBOARDING_COMPLETE} XP) and connect your GitHub account (+{CLIENT_XP_VALUES.GITHUB_CONNECT} XP) = <strong>40 XP</strong>.
                  </li>
                  <li>
                    Complete <strong>Genesis Quest 01: Baby Steps</strong> (+{CLIENT_XP_VALUES.QUEST_1_BABY_STEPS} XP) and <strong>Genesis Quest 02: 0x00. Shell Basics</strong> (+{CLIENT_XP_VALUES.QUEST_2_SHELL_BASICS} XP) = <strong>115 XP total</strong> (unlocks Rising Dev rank and the Season 1 Campaign vault).
                  </li>
                  <li>
                    Publish your first GitHub project (+{CLIENT_XP_VALUES.SUBMIT_PROJECT + CLIENT_XP_VALUES.FIRST_PROJECT} XP on submission, +{CLIENT_XP_VALUES.PROJECT_APPROVED} XP on approval) = <strong>+200 XP</strong>.
                  </li>
                  <li>
                    Push commits to public repositories on active coding days (+{CLIENT_XP_VALUES.GITHUB_ACTIVE_DAY} XP/day) and maintain a 3-day login streak (+{CLIENT_XP_VALUES.LOGIN_STREAK} XP).
                  </li>
                </ul>
              </div>

              <div id="xp-ledger">
                <Callout type="important" title="Idempotent & Tamper-Resistant XP Ledger">
                  Every XP event is recorded with a deterministic idempotency key (such as <code className="font-mono">quest_quest_1_baby_steps_&#123;uid&#125;</code> or <code className="font-mono">approve_&#123;projectId&#125;</code>) in the <code className="font-mono">xpLedger</code> collection and mirrored in your profile&rsquo;s <code className="font-mono">xpLedgerIds</code> array. Firestore security rules enforce <code className="font-mono">allow update, delete: if false;</code> on <code className="font-mono">xpLedger</code>, ensuring:
                  <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                    <li>No action can ever grant duplicate XP, even if you click a button twice or refresh mid-request.</li>
                    <li>If your network drops, GoBoard automatically reconciles any missing milestone XP the next time your profile loads.</li>
                    <li>Non-approval XP is capped at {CLIENT_XP_LIMITS.DAILY_XP_CAP} XP per day and vote XP requires accounts at least {CLIENT_XP_LIMITS.MIN_ACCOUNT_AGE_DAYS} days old.</li>
                  </ul>
                </Callout>
              </div>

              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                <strong>Fair Play Policy:</strong> Creating fake accounts to upvote your own posts, committing empty whitespace scripts to farm daily coding XP, or spamming low-effort comments will result in project suspension and XP ledger auditing by admins.
              </p>
            </ChapterShell>
          )}

          {/* ═════════════════════════════════════════════════════════════════
              CHAPTER 5: LEADERBOARD AND HEALTHY COMPETITION
             ═════════════════════════════════════════════════════════════════ */}
          {visibleIds.has('leaderboard') && (
            <ChapterShell {...getNeighbors('leaderboard')} onSelectSection={scrollToSection}>
              <p>
                The GoBoard Leaderboard appears in the right-hand panel on desktop (and via the trophy button on mobile) and highlights consistent builders across two live views:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
                <div className="p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40">
                  <div className="font-bold text-sm text-neutral-900 dark:text-white mb-1">
                    1. Top XP Leaderboard
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    Ranks students by total verified <code className="font-mono">xp</code> (synchronized with <code className="font-mono">seasonXp</code>) earned from projects, quests, Lit Club writings, streaks, and community upvotes.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40">
                  <div className="font-bold text-sm text-neutral-900 dark:text-white mb-1">
                    2. GitHub Builders (30-Day Activity)
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    Ranks students with linked GitHub accounts by <strong>active coding days in the last 30 days</strong>. Ties are broken first by <strong>30-day commit count</strong> and then by <strong>total repository stars</strong>.
                  </p>
                </div>
              </div>

              <h3 className="text-base font-bold text-neutral-900 dark:text-white pt-2">
                What Appears on Your Public Profile
              </h3>
              <p>
                Clicking any student on the leaderboard or a project card opens their <strong>Public Profile Modal</strong>, displaying their current rank badge, total XP, department and academic level, verified Student ID badge (if verified), GitHub 30-day commit stats, pinned repositories, top programming languages, published projects, and open-source contributions to other classmates&rsquo; projects.
              </p>

              <h3 className="text-base font-bold text-neutral-900 dark:text-white pt-2">
                Community Guidelines
              </h3>
              <ul className="list-disc list-inside space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
                <li>Compete on real engineering effort — ship working code, clear documentation, and thoughtful designs.</li>
                <li>Upvote and leave constructive feedback on classmates&rsquo; projects across all levels.</li>
                <li>Keep pull request reviews and comment threads respectful and specific.</li>
              </ul>

              <Callout type="tip" title="Beat Your Own Streak First">
                Don&rsquo;t worry if 400-level students have higher total XP when you join. The <strong>Builders</strong> tab measures the last 30 days of coding activity — a 100-level student who pushes code four days a week will outrank a senior who hasn&rsquo;t committed in a month.
              </Callout>
            </ChapterShell>
          )}

          {/* ═════════════════════════════════════════════════════════════════
              CHAPTER 6: GIT AND GITHUB PRIMER
             ═════════════════════════════════════════════════════════════════ */}
          {visibleIds.has('git-primer') && (
            <ChapterShell {...getNeighbors('git-primer')} onSelectSection={scrollToSection}>
              <p>
                <strong>Git</strong> records every change in a project, like track changes in Word but for code. <strong>GitHub</strong> puts that history online, like a public portfolio. Employers check it when they hire. Every commit is timestamped, which is why GoBoard can trust your work.
              </p>

              <div id="git-terms" className="space-y-2 pt-2">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  Key Terms Every Builder Should Know
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  {[
                    ['Repository (Repo)', 'A project folder tracked by Git, containing all files and their full change history.'],
                    ['Commit', 'A saved snapshot of your changes with a unique SHA hash, timestamp, and message.'],
                    ['Branch', 'An independent line of development (e.g. feat/dark-mode) so you can experiment safely.'],
                    ['Remote (origin)', 'The online copy of your repository hosted on GitHub.'],
                    ['Clone', 'Downloading a repository from GitHub onto your computer with its full Git history.'],
                    ['Fork', 'Making your own personal copy of someone else’s repository on GitHub so you can contribute.'],
                    ['Push', 'Uploading your local commits to GitHub.'],
                    ['Pull', 'Downloading the latest commits from GitHub into your local folder.'],
                    ['Pull Request (PR)', 'A request asking a project owner to review and merge your branch into their repository.'],
                    ['Merge', 'Combining changes from one branch into another (such as merging a feature branch into main).'],
                  ].map(([term, def]) => (
                    <div
                      key={term}
                      className="p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40"
                    >
                      <span className="font-mono font-bold text-neutral-900 dark:text-white">{term}:</span>{' '}
                      <span className="text-neutral-600 dark:text-neutral-400">{def}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div id="git-commands" className="space-y-2 pt-2">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  First-Time Setup &amp; Everyday Loop
                </h3>
                <CodeSnippet
                  title="One-Time Git Identity Setup"
                  code={`git config --global user.name "Your Name"
git config --global user.email "you@example.com"`}
                />
                <CodeSnippet
                  title="The Everyday Git Loop"
                  code={`git init                         # start tracking a folder
git status                       # see what changed
git add .                        # stage changes
git commit -m "feat: add login"  # save a snapshot
git remote add origin <repo-url>
git push -u origin main          # upload
git pull                         # download latest`}
                />
              </div>

              <div id="git-safety" className="space-y-2 pt-2">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  Protecting Secrets with <code className="font-mono">.gitignore</code> &amp; Writing Clean Commits
                </h3>
                <p>
                  Create a file named <code className="font-mono">.gitignore</code> in your project root before running <code className="font-mono">git add .</code> so heavy folders and private API keys are never uploaded to GitHub:
                </p>
                <CodeSnippet
                  title=".gitignore Example"
                  language="text"
                  code={`node_modules/
dist/
.env
.env.local
*.log
.DS_Store`}
                />
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  <strong>Commit Message Prefixes:</strong> Use clear prefixes so teammates and lecturers can scan your history: <code className="font-mono">feat:</code> (new feature), <code className="font-mono">fix:</code> (bug fix), <code className="font-mono">docs:</code> (README or comments), <code className="font-mono">refactor:</code> (code cleanup).
                </p>
              </div>

              <div id="git-problems" className="space-y-2 pt-2">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  Common Problems &amp; How to Fix Them
                </h3>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-neutral-600 dark:text-neutral-400">
                  <li>
                    <strong>Rejected push (<code className="font-mono">fetch first</code> / <code className="font-mono">non-fast-forward</code>):</strong> GitHub has changes (such as a README edited in the browser) that your laptop doesn&rsquo;t have yet. Run <code className="font-mono">git pull --rebase origin main</code>, then run <code className="font-mono">git push</code> again.
                  </li>
                  <li>
                    <strong>Merge conflicts:</strong> Open the file marked by Git, look for the <code className="font-mono">&lt;&lt;&lt;&lt;&lt;&lt;&lt;</code>, <code className="font-mono">=======</code>, and <code className="font-mono">&gt;&gt;&gt;&gt;&gt;&gt;&gt;</code> markers, keep the correct lines, delete the conflict markers, and run <code className="font-mono">git add . &amp;&amp; git commit -m &quot;fix: resolve merge conflict&quot;</code>.
                  </li>
                  <li>
                    <strong>Accidentally committed a secret (<code className="font-mono">.env</code> or API key):</strong> Immediately revoke/rotate the key in your provider dashboard first (deleting the file in a later commit still leaves the key visible in old commit history), then add <code className="font-mono">.env</code> to <code className="font-mono">.gitignore</code> and remove it from tracking with <code className="font-mono">git rm --cached .env</code>.
                  </li>
                </ul>
              </div>

              <Callout type="note" title="New to Git?">
                New to this? <strong>Genesis Quest 01: Baby Steps</strong> walks you through creating your first repository and README step by step.
              </Callout>
            </ChapterShell>
          )}

          {/* ═════════════════════════════════════════════════════════════════
              CHAPTER 7: TERMINAL BASICS
             ═════════════════════════════════════════════════════════════════ */}
          {visibleIds.has('terminal') && (
            <ChapterShell {...getNeighbors('terminal')} onSelectSection={scrollToSection}>
              <p>
                Professional developers use the command line (Terminal on macOS/Linux, Git Bash or WSL on Windows) to navigate folders, run build tools, and automate tasks. These ten commands cover 90% of daily terminal work and are required for <strong>Quest 02: 0x00. Shell Basics</strong>.
              </p>

              <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 my-4">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-950 text-neutral-600 dark:text-neutral-400 font-mono uppercase tracking-wider text-[11px] border-b border-neutral-200 dark:border-neutral-800">
                    <tr>
                      <th className="py-3 px-4">Command</th>
                      <th className="py-3 px-4">What It Does</th>
                      <th className="py-3 px-4">One-Line Example</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800 font-mono text-[12px]">
                    {[
                      ['pwd', 'Print working directory (shows full path of where you are)', 'pwd'],
                      ['ls', 'List files and folders (-la shows hidden dot-files & permissions)', 'ls -la'],
                      ['cd', 'Change directory (use .. to move up one folder)', 'cd 0x00-shell_basics'],
                      ['mkdir', 'Create a new directory (-p creates parent folders if needed)', 'mkdir -p /tmp/gouni_lab'],
                      ['touch', 'Create an empty file or update its timestamp', 'touch /tmp/gouni_lab/ready.txt'],
                      ['cat', 'Print the contents of a file to the terminal screen', 'cat README.md'],
                      ['cp', 'Copy a file or folder (-r for directories)', 'cp template.sh 0-current_working_directory'],
                      ['mv', 'Move or rename a file or folder', 'mv draft.sh 1-listit'],
                      ['rm', 'Delete a file permanently', 'rm old_notes.txt'],
                      ['chmod +x', 'Grant execute permission so a script can run as a program', 'chmod +x 1-listit'],
                    ].map(([cmd, desc, ex]) => (
                      <tr key={cmd}>
                        <td className="py-2.5 px-4 font-bold text-neutral-900 dark:text-white">{cmd}</td>
                        <td className="py-2.5 px-4 font-sans text-neutral-600 dark:text-neutral-400">{desc}</td>
                        <td className="py-2.5 px-4 text-neutral-800 dark:text-neutral-200">{ex}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 className="text-base font-bold text-neutral-900 dark:text-white pt-2">
                Writing and Running a Two-Line Bash Script
              </h3>
              <p>
                Every executable Bash script in GoBoard quests starts with a <strong>shebang</strong> (<code className="font-mono">#!/bin/bash</code>) on Line 1, which tells the operating system to run the file using the Bash interpreter, followed by your command on Line 2:
              </p>
              <CodeSnippet
                title="Creating & Executing a Bash Script (Quest 2 Pattern)"
                code={`# 1. Create a 2-line script with #!/bin/bash on Line 1
printf "#!/bin/bash\\nls -la\\n" > 1-listit

# 2. Make the script executable
chmod +x 1-listit

# 3. Test it locally in your terminal
./1-listit`}
              />

              <Callout type="warning" title="Be Careful with rm -rf">
                Unlike deleting a file in Windows Explorer or macOS Finder, <code className="font-mono">rm</code> does <strong>not</strong> send files to the Recycle Bin or Trash. Never run <code className="font-mono">rm -rf /</code> or <code className="font-mono">rm -rf *</code> without double-checking your current directory using <code className="font-mono">pwd</code>.
              </Callout>
            </ChapterShell>
          )}

          {/* ═════════════════════════════════════════════════════════════════
              CHAPTER 8: GENESIS QUESTS AND GRADER
             ═════════════════════════════════════════════════════════════════ */}
          {visibleIds.has('quests-grader') && (
            <ChapterShell {...getNeighbors('quests-grader')} onSelectSection={scrollToSection}>
              <p>
                Genesis Quests are practical developer challenges built into the Season 1 curriculum. When you click <strong>Run Checker</strong> in the Quests modal, GoBoard&rsquo;s backend (<code className="font-mono">/api/quest-check</code>) queries the GitHub API to inspect your public <code className="font-mono">GoQuests</code> repository and grade your files in real time.
              </p>

              {/* Quest Overview Table */}
              <div id="quests-overview" className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 my-4">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-950 text-neutral-600 dark:text-neutral-400 font-mono uppercase tracking-wider text-[11px] border-b border-neutral-200 dark:border-neutral-800">
                    <tr>
                      <th className="py-3 px-4">Quest</th>
                      <th className="py-3 px-4">Skill Taught</th>
                      <th className="py-3 px-4">Reward</th>
                      <th className="py-3 px-4">What the Grader Checks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
                    {ACTIVE_QUESTS.map((q) => (
                      <tr key={q.id}>
                        <td className="py-3 px-4 font-bold text-neutral-900 dark:text-white">
                          {q.numberLabel}: {q.title}
                        </td>
                        <td className="py-3 px-4 text-neutral-600 dark:text-neutral-400">{q.subtitle}</td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          +{q.xpReward} XP
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
                          {q.tasks.map((t) => t.filePath).join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Detailed Quest Specs */}
              <div id="quests-walkthroughs" className="space-y-4 pt-2">
                {ACTIVE_QUESTS.map((quest) => (
                  <div
                    key={quest.id}
                    className="p-5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-950/40 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-bold text-sm text-neutral-900 dark:text-white">
                        {quest.numberLabel}: {quest.title}
                      </div>
                      <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        +{quest.xpReward} XP · Repo: {quest.targetRepoName}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">{quest.overview}</p>
                    <div className="space-y-2">
                      {quest.tasks.map((task) => (
                        <div
                          key={task.id}
                          className="p-3 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/70 dark:border-neutral-800 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-semibold text-neutral-900 dark:text-white">
                              {task.number} — {task.title}
                            </span>
                            <code className="font-mono text-[11px] px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                              {task.filePath}
                            </code>
                          </div>
                          <p className="text-neutral-500 dark:text-neutral-400">{task.instructions}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Troubleshooting Failed Checks */}
              <div id="quests-troubleshooting" className="space-y-2 pt-3">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  Troubleshooting a Failed Grader Check
                </h3>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-neutral-600 dark:text-neutral-400">
                  <li>
                    <strong>Repository is private or a fork:</strong> Your <code className="font-mono">GoQuests</code> repository must be <strong>Public</strong> and created directly by you (not forked from another student).
                  </li>
                  <li>
                    <strong>Repository name mismatch:</strong> Ensure the repository is named <code className="font-mono">GoQuests</code> (without spaces or typos).
                  </li>
                  <li>
                    <strong>README missing required phrase:</strong> For Quest 01, your root <code className="font-mono">README.md</code> must be at least 15 characters long and include the phrase <code className="font-mono">Baby Steps</code> (case-insensitive).
                  </li>
                  <li>
                    <strong>Missing <code className="font-mono">#!/bin/bash</code> on Line 1:</strong> Every Quest 02 script (<code className="font-mono">0-current_working_directory</code>, <code className="font-mono">1-listit</code>, <code className="font-mono">2-gouni_lab</code>) must start with <code className="font-mono">#!/bin/bash</code> on the very first line, followed by the exact command on Line 2.
                  </li>
                  <li>
                    <strong>Windows CRLF line endings or extra file extensions:</strong> Do not add <code className="font-mono">.sh</code> or <code className="font-mono">.txt</code> to the Quest 02 filenames. Name them exactly <code className="font-mono">0-current_working_directory</code>, <code className="font-mono">1-listit</code>, and <code className="font-mono">2-gouni_lab</code>.
                  </li>
                  <li>
                    <strong>Forgot to push commits:</strong> Running scripts locally on your laptop does not update GitHub. Run <code className="font-mono">git status</code>, <code className="font-mono">git add .</code>, <code className="font-mono">git commit</code>, and <code className="font-mono">git push origin main</code> before clicking <strong>Run Checker</strong>.
                  </li>
                  <li>
                    <strong>GitHub account not linked:</strong> Connect your GitHub account in <strong>My Profile</strong> first so the grader knows which GitHub username to inspect.
                  </li>
                </ul>
              </div>
            </ChapterShell>
          )}

          {/* ═════════════════════════════════════════════════════════════════
              CHAPTER 9: OPEN-SOURCE AND PR GUIDE
             ═════════════════════════════════════════════════════════════════ */}
          {visibleIds.has('pr-collaboration') && (
            <ChapterShell {...getNeighbors('pr-collaboration')} onSelectSection={scrollToSection}>
              <p>
                GoBoard encourages students to build together using real open-source workflows. Project authors can enable <strong>Open to Contributions</strong> and tag specific areas ({CONTRIBUTION_AREAS.join(', ')}) where classmates can jump in.
              </p>

              <div className="space-y-3 my-4">
                {[
                  ['01', 'Filter by "Open to PRs"', 'Click the "Open to PRs" pill on the home feed to see campus repositories actively welcoming student contributors.'],
                  ['02', 'Fork & Clone the Repository', 'Open the project detail page, click the GitHub link, press "Fork" on GitHub, and clone your fork locally.'],
                  ['03', 'Create a Focused Topic Branch', 'Create a descriptive branch such as feat/mobile-navbar or fix/auth-redirect rather than committing directly to main.'],
                  ['04', 'Test & Push Your Changes', 'Verify your code builds cleanly, ensure no .env or node_modules files are staged, and push your branch to your fork.'],
                  ['05', 'Open a Pull Request & Sync', 'Open a Pull Request on GitHub explaining what you changed. Once merged, GoBoard matches your GitHub username to your profile and lists the project under your Contributed Projects!'],
                ].map(([step, title, desc]) => (
                  <div
                    key={step}
                    className="flex gap-3.5 p-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40"
                  >
                    <span className="font-mono text-xs font-bold text-neutral-400 pt-0.5">{step}</span>
                    <div>
                      <div className="font-bold text-xs text-neutral-900 dark:text-white mb-0.5">{title}</div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <CodeSnippet
                title="Standard Open-Source Pull Request Flow"
                code={`# 1. Keep main in sync
git checkout main
git pull origin main

# 2. Create a topic branch
git checkout -b feat/responsive-table

# 3. Stage, commit, and push
git add src/components/Table.tsx
git commit -m "feat(ui): make course table scrollable on mobile"
git push -u origin feat/responsive-table`}
              />
            </ChapterShell>
          )}

          {/* ═════════════════════════════════════════════════════════════════
              CHAPTER 10: COMMITS AS LIVE UPDATES AND BUILD JOURNEY
             ═════════════════════════════════════════════════════════════════ */}
          {visibleIds.has('git-commits') && (
            <ChapterShell {...getNeighbors('git-commits')} onSelectSection={scrollToSection}>
              <p>
                Every project detail page features a unified <strong>Build Journey</strong> timeline (<code className="font-mono">ProjectTimeline.tsx</code>) that tracks how a project evolves from an initial idea to a launched product.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
                <div className="p-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40">
                  <div className="font-bold text-xs text-neutral-900 dark:text-white mb-1">All Activity</div>
                  <p className="text-xs text-neutral-500">
                    Interleaves author milestone posts and live GitHub commits in chronological order.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40">
                  <div className="font-bold text-xs text-neutral-900 dark:text-white mb-1">Milestones</div>
                  <p className="text-xs text-neutral-500">
                    Curated release notes, architecture decisions, and progress screenshots posted by the author.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40">
                  <div className="font-bold text-xs text-neutral-900 dark:text-white mb-1">Git Commits</div>
                  <p className="text-xs text-neutral-500">
                    Up to 20 recent commits fetched live from GitHub with short SHAs, author avatars, and commit links.
                  </p>
                </div>
              </div>

              <h3 className="text-base font-bold text-neutral-900 dark:text-white pt-2">
                How to Add a Great Build Journey Milestone
              </h3>
              <p>
                When signed in as the project author, use the <strong>Add Milestone Update</strong> form on your project page. The strongest milestones include: (1) a clear version or milestone title (e.g. <em>v0.2 — Offline Prayer Caching</em>), (2) what problem you solved or learned, and (3) a screenshot of the new feature. You can also update your project&rsquo;s 4-stage status bar across <strong>Idea → Building → Beta → Launched</strong>.
              </p>

              <Callout type="note" title="GitHub API Rate Limits & Caching">
                GoBoard fetches recent commits and open pull requests directly from the GitHub REST API and caches repository metadata in Firestore (<code className="font-mono">githubMeta</code>). Connecting your GitHub account via OAuth in your Profile ensures you use your 5,000 requests/hour authenticated quota rather than the 60 requests/hour anonymous IP limit.
              </Callout>
            </ChapterShell>
          )}

          {/* ═════════════════════════════════════════════════════════════════
              CHAPTER 11: CAMPAIGNS
             ═════════════════════════════════════════════════════════════════ */}
          {visibleIds.has('campaigns') && (
            <ChapterShell {...getNeighbors('campaigns')} onSelectSection={scrollToSection}>
              <p>
                <strong>Campaigns</strong> are time-boxed campus challenges that point student engineering and UI/UX talent at real Godfrey Okoye University needs.
              </p>

              <div id="campaigns-prayerbook" className="p-5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 space-y-2 my-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    Season 01 Active Campaign
                  </span>
                  <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    Unlocks at 100 XP · +{CLIENT_XP_VALUES.CAMPAIGN_SUBMISSION_APPROVED} XP on Approval
                  </span>
                </div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  The GoUni Prayer Book Redesign Campaign
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  Every student at Godfrey Okoye University uses the GoUni Prayer Book for daily Angelus, morning and night prayers, campus Mass responses, and hymns. Your challenge is to redesign it into a calm, legible, offline-first mobile experience covering at least <strong>4 core screens</strong>: (1) Smart Home / Daily Routine, (2) Distraction-Free Prayer Reader, (3) Instant Search &amp; Bookmarks, and (4) Campus Chapel &amp; Chant Mode.
                </p>
              </div>

              <div id="campaigns-submission" className="space-y-2 pt-2">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  How to Join &amp; What to Submit
                </h3>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-neutral-600 dark:text-neutral-400">
                  <li>
                    <strong>Reach 100 XP:</strong> Complete onboarding, connect GitHub, and finish Genesis Quests 01 &amp; 02 (or ship a project) to unlock the Campaign Vault.
                  </li>
                  <li>
                    <strong>Choose Solo or Duo Team:</strong> Compete individually (<strong>Solo Designer</strong>) or pair up with one classmate (<strong>Duo Team</strong>, linking their GitHub <code className="font-mono">@username</code> or GoBoard display name).
                  </li>
                  <li>
                    <strong>Public GitHub Repository with 80+ Word Pitch:</strong> Create a public repository whose root <code className="font-mono">README.md</code> contains a written UX pitch of <strong>at least 80 words</strong> and includes your design link.
                  </li>
                  <li>
                    <strong>Accessible Figma or Google Drive Link:</strong> Provide a public <strong>Figma</strong> prototype link or an accessible <strong>Google Drive</strong> link. To keep GoBoard fast and lightweight, all screenshots and visual assets live inside your GitHub repository, Figma file, or Google Drive folder — no screenshot uploads are required in the submission form.
                  </li>
                </ul>
              </div>

              <div id="campaigns-rubric" className="space-y-2 pt-3">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  100-Point Judging Rubric
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  {[
                    ['1. UX Problem Solving & Navigation', '35 pts'],
                    ['2. Visual Craft, Typography & Accessibility', '25 pts'],
                    ['3. Figma Prototype & README Pitch Clarity', '20 pts'],
                    ['4. Verified Student Community Votes', '20 pts'],
                  ].map(([criterion, pts]) => (
                    <div
                      key={criterion}
                      className="flex items-center justify-between p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900"
                    >
                      <span className="font-medium text-neutral-800 dark:text-neutral-200">{criterion}</span>
                      <span className="font-mono font-bold text-neutral-900 dark:text-white">{pts}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-neutral-500">
                  Note: Firestore security rules block authors and duo partners from voting on their own campaign submissions.
                </p>
              </div>
            </ChapterShell>
          )}

          {/* ═════════════════════════════════════════════════════════════════
              CHAPTER 12: GOCOINS AND STUDENT WALLET
             ═════════════════════════════════════════════════════════════════ */}
          {visibleIds.has('gocoins-economy') && (
            <ChapterShell {...getNeighbors('gocoins-economy')} onSelectSection={scrollToSection}>
              <p>
                <strong>GoCoins (GC)</strong> are GoBoard&rsquo;s seasonal reward balance stored on your profile (<code className="font-mono">goCoins</code> and <code className="font-mono">totalGoCoinsEarned</code>) and managed in <strong>My Profile → Payday &amp; Wallet</strong> (<code className="font-mono">/profile?tab=wallet</code>).
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
                <div className="p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40">
                  <div className="font-mono text-xs font-bold text-neutral-400 mb-1">STEP 01</div>
                  <div className="font-bold text-xs text-neutral-900 dark:text-white mb-1">Earn GoCoins</div>
                  <p className="text-xs text-neutral-500">
                    Accumulate GoCoins through seasonal campaigns, faculty bounties, and verified campus challenges.
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40">
                  <div className="font-mono text-xs font-bold text-neutral-400 mb-1">STEP 02</div>
                  <div className="font-bold text-xs text-neutral-900 dark:text-white mb-1">Verify Student ID</div>
                  <p className="text-xs text-neutral-500">
                    Upload your Godfrey Okoye University ID card so an admin can confirm you are an active student.
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40">
                  <div className="font-mono text-xs font-bold text-neutral-400 mb-1">STEP 03</div>
                  <div className="font-bold text-xs text-neutral-900 dark:text-white mb-1">Save Bank Details</div>
                  <p className="text-xs text-neutral-500">
                    Save your Nigerian bank name, 10-digit NUBAN account number, and account name in your Wallet tab.
                  </p>
                </div>
              </div>

              <h3 className="text-base font-bold text-neutral-900 dark:text-white pt-2">
                How Payday Transfers Work
              </h3>
              <p>
                Your Wallet screen displays your live GoCoins balance alongside the current Naira conversion rate configured for the season (<code className="font-mono">nairaPer500Coins</code>) and the scheduled Payday countdown. When a season concludes, admins review all eligible students (those with <code className="font-mono">goCoins &gt; 0</code>, <code className="font-mono">verificationStatus === &apos;verified&apos;</code>, and saved bank details), process direct bank transfers, and record each transfer in the immutable <code className="font-mono">payouts</code> ledger.
              </p>

              <Callout type="note" title="Reporting a Payout Issue">
                If your bank transfer is delayed or your account details changed before Payday, update your bank details in <strong>Profile → Payday &amp; Wallet</strong> and contact the Software Director (Faculty of Computing) with your registered GoBoard email.
              </Callout>
            </ChapterShell>
          )}

          {/* ═════════════════════════════════════════════════════════════════
              CHAPTER 13: LIT CLUB
             ═════════════════════════════════════════════════════════════════ */}
          {visibleIds.has('lit-club') && (
            <ChapterShell {...getNeighbors('lit-club')} onSelectSection={scrollToSection}>
              <p>
                The <strong>Literature Club (Lit Club)</strong> at <code className="font-mono">/lit-club</code> is GoBoard&rsquo;s creative and intellectual writing space. Great universities blend technology with strong storytelling and critical thought — students from <strong>every faculty and department</strong> (Arts, Law, Management, Natural Sciences, Medicine, and Computing) are welcome to publish.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
                <div className="p-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40">
                  <div className="font-bold text-xs text-neutral-900 dark:text-white mb-1">Short Stories</div>
                  <p className="text-xs text-neutral-500">Original campus fiction, speculative stories, and narrative prose (<code className="font-mono">short-story</code>).</p>
                </div>
                <div className="p-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40">
                  <div className="font-bold text-xs text-neutral-900 dark:text-white mb-1">Poems</div>
                  <p className="text-xs text-neutral-500">Verse, spoken-word pieces, and lyrical reflections (<code className="font-mono">poem</code>).</p>
                </div>
                <div className="p-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40">
                  <div className="font-bold text-xs text-neutral-900 dark:text-white mb-1">Essays</div>
                  <p className="text-xs text-neutral-500">Technical essays, engineering post-mortems, and cultural commentary (<code className="font-mono">essay</code>).</p>
                </div>
              </div>

              <h3 className="text-base font-bold text-neutral-900 dark:text-white pt-2">
                How Writing Rewards &amp; Review Work
              </h3>
              <ul className="list-disc list-inside space-y-1.5 text-xs text-neutral-600 dark:text-neutral-400">
                <li>
                  <strong>Submitting a piece:</strong> Click <strong>Submit Writing</strong> on the Lit Club page, choose your genre, and paste your work. Submitting awards <strong>+{CLIENT_XP_VALUES.SUBMIT_PROJECT} XP</strong>.
                </li>
                <li>
                  <strong>Editorial review:</strong> Submissions enter the Literature Queue in the Admin Dashboard to check for originality and formatting. Approval awards an additional <strong>+{CLIENT_XP_VALUES.PROJECT_APPROVED} XP</strong>.
                </li>
                <li>
                  <strong>Community upvotes &amp; discussion:</strong> Readers can filter by genre, upvote pieces (<code className="font-mono">+{CLIENT_XP_VALUES.RECEIVE_VOTE} XP</code> per upvote once a piece reaches {CLIENT_XP_LIMITS.MIN_VOTES_FOR_XP}+ likes), and leave comments.
                </li>
              </ul>
            </ChapterShell>
          )}

          {/* ═════════════════════════════════════════════════════════════════
              CHAPTER 14: FOR LECTURERS AND FACULTY
             ═════════════════════════════════════════════════════════════════ */}
          {visibleIds.has('lecturers') && (
            <ChapterShell {...getNeighbors('lecturers')} onSelectSection={scrollToSection}>
              <p>
                GoBoard is designed to make coursework assessment, final-year project supervision, and departmental accreditation simpler and more transparent for lecturers in the Faculty of Computing and across Godfrey Okoye University.
              </p>

              <div className="space-y-4 my-4">
                <div className="p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40">
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-1">
                    1. Requiring a GoBoard &amp; GitHub Link on Course Projects
                  </h3>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    When assigning practical coursework or 400-level final-year projects, lecturers can ask students to include their <strong>GoBoard project URL</strong> (<code className="font-mono">goboard-psi.vercel.app/project/&lt;slug&gt;</code>) on their submission cover page. Because GoBoard enforces a valid public GitHub repository on every submission, this immediately eliminates broken flash drives and unrunnable zip archives.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40">
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-1">
                    2. Inspecting Individual Effort in Group Projects
                  </h3>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    On any project page, lecturers can view the <strong>Contributors</strong> list (automatically matched to students&rsquo; GoBoard profiles) and switch the <strong>Build Journey</strong> timeline to <strong>Git Commits</strong>. This shows exact commit timestamps, commit messages, and which student authored each change — making it easy to distinguish students who built the software over several weeks from someone who uploaded a single bulk commit the night before defense.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40">
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-1">
                    3. Sponsoring a Departmental or Faculty Campaign
                  </h3>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    Have a campus tool, lab utility, or departmental workflow that needs software or UI/UX design? Lecturers and HODs can partner with the Software Director to launch a dedicated Campaign brief on GoBoard where students compete to build the best solution.
                  </p>
                </div>
              </div>
            </ChapterShell>
          )}

          {/* ═════════════════════════════════════════════════════════════════
              CHAPTER 15: ADMIN GUIDE
             ═════════════════════════════════════════════════════════════════ */}
          {visibleIds.has('admins') && (
            <ChapterShell {...getNeighbors('admins')} onSelectSection={scrollToSection}>
              <p>
                Users with <code className="font-mono">isAdmin: true</code> on their Firestore user document can access the <strong>Admin Dashboard</strong> (<code className="font-mono">/admin</code>). The dashboard is organized into focused operational tabs:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4">
                {[
                  [
                    '1. Prayer Book Campaign (design-campaign)',
                    'Inspect submitted GitHub repositories, 80-word README pitches, and Figma/Google Drive links. Approve entries (+50 XP), reject with revision feedback, or mark winners.',
                  ],
                  [
                    '2. Student ID Verification (id-verification)',
                    'Open uploaded Godfrey Okoye University Student ID cards in the full-screen lightbox inspector. Confirm name and matriculation details, then click Verify or Reject with a clear reason.',
                  ],
                  [
                    '3. Payday & Economy (payday)',
                    'Update season configuration (title, conversion rate, payday date), inspect verified students with GoCoins and saved bank details, export payout sheets to CSV, and mark students as paid.',
                  ],
                  [
                    '4. Project Queue (projects)',
                    'Review pending student software submissions. Verify that the GitHub repository opens and contains real source code before clicking Approve (+50 XP) or Reject.',
                  ],
                  [
                    '5. Literature Queue (literature)',
                    'Review pending short stories, poems, and essays submitted to the Lit Club. Approve original student writing (+50 XP) or return with feedback.',
                  ],
                  [
                    '6. XP History & Audit (xp-history)',
                    'View the live audit stream of XP events across all users, inspect per-student milestone breakdowns, and run one-click Reconcile XP for a single student or all users.',
                  ],
                ].map(([title, desc]) => (
                  <div
                    key={title}
                    className="p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40"
                  >
                    <div className="font-bold text-xs text-neutral-900 dark:text-white mb-1">{title}</div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>

              <Callout type="tip" title="Daily Admin Checklist (5 Minutes)">
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Clear the <strong>Project Queue</strong> and <strong>Literature Queue</strong> so students receive their approval XP within 24 hours.</li>
                  <li>Review any pending uploads in <strong>Student ID Verification</strong>.</li>
                  <li>Check <strong>Prayer Book Campaign</strong> submissions for valid GitHub and Figma/Google Drive links.</li>
                  <li>Spot-check the <strong>XP History &amp; Audit</strong> feed and run <em>Reconcile All Users</em> if any student reports a network sync hiccup.</li>
                </ol>
              </Callout>
            </ChapterShell>
          )}

          {/* ═════════════════════════════════════════════════════════════════
              CHAPTER 16: PRIVACY, SECURITY AND DATA
             ═════════════════════════════════════════════════════════════════ */}
          {visibleIds.has('privacy') && (
            <ChapterShell {...getNeighbors('privacy')} onSelectSection={scrollToSection}>
              <p>
                GoBoard collects only the information needed to display your student portfolio, verify academic identity, and process seasonal payouts.
              </p>

              <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 my-4">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-950 text-neutral-600 dark:text-neutral-400 font-mono uppercase tracking-wider text-[11px] border-b border-neutral-200 dark:border-neutral-800">
                    <tr>
                      <th className="py-3 px-4">Data Category</th>
                      <th className="py-3 px-4">Examples</th>
                      <th className="py-3 px-4">Who Can View It</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
                    <tr>
                      <td className="py-2.5 px-4 font-semibold text-neutral-900 dark:text-white">Public Builder Profile</td>
                      <td className="py-2.5 px-4">Display name, department, level, bio, XP, rank, public GitHub username &amp; stats, Verified badge</td>
                      <td className="py-2.5 px-4 text-emerald-600 dark:text-emerald-400 font-medium">Public (All visitors)</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-semibold text-neutral-900 dark:text-white">Projects &amp; Lit Club Posts</td>
                      <td className="py-2.5 px-4">Approved projects, repo links, Build Journey milestones, approved writings, comments</td>
                      <td className="py-2.5 px-4 text-emerald-600 dark:text-emerald-400 font-medium">Public once approved (Author &amp; Admins while pending)</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-semibold text-neutral-900 dark:text-white">Student ID Card Photo</td>
                      <td className="py-2.5 px-4"><code className="font-mono">studentIdCardUrl</code> uploaded for verification</td>
                      <td className="py-2.5 px-4 font-semibold text-amber-600 dark:text-amber-400">Account Owner &amp; Admins only</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-semibold text-neutral-900 dark:text-white">Payout Bank Details &amp; History</td>
                      <td className="py-2.5 px-4">Bank name, 10-digit account number, account holder name, <code className="font-mono">/payouts</code> records</td>
                      <td className="py-2.5 px-4 font-semibold text-amber-600 dark:text-amber-400">Account Owner &amp; Admins only</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-base font-bold text-neutral-900 dark:text-white pt-2">
                Firestore Security Rules &amp; Server Verification
              </h3>
              <ul className="list-disc list-inside space-y-1.5 text-xs text-neutral-600 dark:text-neutral-400">
                <li>
                  <strong>Protected Privilege Fields:</strong> Firestore rules (<code className="font-mono">firestore.rules</code>) explicitly block clients from modifying <code className="font-mono">isAdmin</code>, <code className="font-mono">joinedAt</code>, <code className="font-mono">goCoins</code>, or <code className="font-mono">totalGoCoinsEarned</code>, or setting their own <code className="font-mono">verificationStatus</code> to <code className="font-mono">&apos;verified&apos;</code>.
                </li>
                <li>
                  <strong>Immutable Ledger Records:</strong> Documents in <code className="font-mono">/xpLedger/&#123;ledgerId&#125;</code> and <code className="font-mono">/votes/&#123;voteId&#125;</code> disallow updates and arbitrary edits (<code className="font-mono">allow update: if false;</code>).
                </li>
                <li>
                  <strong>Data Updates &amp; Deletion Requests:</strong> You can edit your profile, unlink your GitHub account, or replace your bank details anytime in <strong>My Profile</strong>. To request full account or project deletion, contact a platform admin or the Office of the Software Director.
                </li>
              </ul>
            </ChapterShell>
          )}

          {/* ═════════════════════════════════════════════════════════════════
              CHAPTER 17: TECHNICAL OVERVIEW AND CONTRIBUTING
             ═════════════════════════════════════════════════════════════════ */}
          {visibleIds.has('technical') && (
            <ChapterShell {...getNeighbors('technical')} onSelectSection={scrollToSection}>
              <p>
                GoBoard is a modern full-stack TypeScript application built for fast page loads on campus connections and strict data integrity.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-4 text-xs">
                {[
                  ['Frontend', 'React 19, TypeScript, Vite 6, Tailwind CSS v4, Framer Motion'],
                  ['Authentication', 'Firebase Auth (Google OAuth, GitHub OAuth, Email/Password)'],
                  ['Database', 'Cloud Firestore with declarative security rules (firestore.rules)'],
                  ['Serverless API', 'Vercel Serverless Functions (/api/xp-event, /api/quest-check, /api/insight)'],
                  ['AI & Media', 'Google Gemini (@google/genai) & Cloudinary unsigned image uploads'],
                  ['External APIs', 'GitHub REST v3 & GraphQL v4 APIs'],
                ].map(([layer, tech]) => (
                  <div
                    key={layer}
                    className="p-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40"
                  >
                    <div className="font-mono text-[11px] font-bold uppercase text-neutral-400 mb-1">
                      {layer}
                    </div>
                    <div className="font-medium text-neutral-800 dark:text-neutral-200">{tech}</div>
                  </div>
                ))}
              </div>

              <div id="tech-architecture" className="space-y-2 pt-2">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  System Architecture
                </h3>
                <CodeSnippet
                  title="GoBoard Request & Data Flow"
                  language="text"
                  code={`┌─────────────────────────────────────────────────────────────────────────┐
│                    React 19 + TypeScript SPA (Vite)                     │
│  Pages: HomePage · ProjectPage · LitClubPage · ProfilePage · DocsPage   │
└───────────────┬───────────────────────────┬─────────────────────────────┘
                │                           │
   Real-time Listeners & Tx     Bearer ID Token (HTTPS POST)
                │                           │
                ▼                           ▼
┌───────────────────────────────┐ ┌───────────────────────────────────────┐
│   Cloud Firestore & Auth      │ │      Vercel Serverless Functions      │
│ • /users/{uid} (+subcols)     │ │ • /api/xp-event   (Admin SDK Ledger)  │
│ • /projects/{projectId}       │ │ • /api/quest-check (GitHub Grader)    │
│ • /writings/{writingId}       │ │ • /api/insight    (Gemini 2.5 Flash)  │
│ • /campaignSubmissions/{id}   │ └─────────────────┬─────────────────────┘
│ • /xpLedger/{ledgerId}        │                   │
│ • /payouts/{payoutId}         │                   ▼
└───────────────────────────────┘ ┌───────────────────────────────────────┐
                                  │   GitHub REST / GraphQL & Gemini API  │
                                  └───────────────────────────────────────┘`}
                />
              </div>

              <div id="tech-collections" className="space-y-2 pt-2">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  Core Firestore Collections
                </h3>
                <ul className="list-disc list-inside space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
                  <li>
                    <code className="font-mono">/users/&#123;userId&#125;</code> — Student profile, <code className="font-mono">xp</code>, <code className="font-mono">seasonXp</code>, <code className="font-mono">goCoins</code>, <code className="font-mono">verificationStatus</code>, <code className="font-mono">githubProfile</code>, <code className="font-mono">completedQuests</code>, <code className="font-mono">xpLedgerIds</code>, plus <code className="font-mono">/notifications</code> and <code className="font-mono">/favorites</code> subcollections.
                  </li>
                  <li>
                    <code className="font-mono">/projects/&#123;projectId&#125;</code> — Project metadata, <code className="font-mono">repoUrl</code>, <code className="font-mono">approvalStatus</code>, <code className="font-mono">openToContributions</code>, <code className="font-mono">contributionAreas</code>, <code className="font-mono">githubMeta</code>, <code className="font-mono">updates</code>, and <code className="font-mono">comments</code>.
                  </li>
                  <li>
                    <code className="font-mono">/writings/&#123;writingId&#125;</code> — Lit Club submissions (<code className="font-mono">short-story</code>, <code className="font-mono">poem</code>, <code className="font-mono">essay</code>) and comments.
                  </li>
                  <li>
                    <code className="font-mono">/campaignSubmissions/&#123;submissionId&#125;</code> — Season 1 GoUni Prayer Book Redesign entries, <code className="font-mono">repoUrl</code>, <code className="font-mono">figmaUrl</code>, <code className="font-mono">teamSize</code>, and <code className="font-mono">votedUserIds</code>.
                  </li>
                  <li>
                    <code className="font-mono">/xpLedger/&#123;ledgerId&#125;</code> &amp; <code className="font-mono">/xpDaily/&#123;dailyId&#125;</code> — Idempotent XP audit records and daily cap trackers.
                  </li>
                  <li>
                    <code className="font-mono">/votes/&#123;voteId&#125;</code>, <code className="font-mono">/litVotes/&#123;voteId&#125;</code>, <code className="font-mono">/payouts/&#123;payoutId&#125;</code>, and <code className="font-mono">/settings/&#123;docId&#125;</code>.
                  </li>
                </ul>
              </div>

              <div id="tech-setup" className="space-y-2 pt-2">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  Local Development Setup
                </h3>
                <CodeSnippet
                  title="Clone, Configure & Run Locally"
                  code={`# 1. Clone the repository and install dependencies
git clone https://github.com/MajestyChibuikem/goboard.git
cd goboard
npm install

# 2. Create .env.local with required environment variable names (never commit values):
# VITE_FIREBASE_API_KEY
# VITE_FIREBASE_AUTH_DOMAIN
# VITE_FIREBASE_PROJECT_ID
# VITE_FIREBASE_STORAGE_BUCKET
# VITE_FIREBASE_MESSAGING_SENDER_ID
# VITE_FIREBASE_APP_ID
# VITE_CLOUDINARY_CLOUD_NAME
# VITE_CLOUDINARY_UPLOAD_PRESET
# GEMINI_API_KEY
# FIREBASE_SERVICE_ACCOUNT_KEY

# 3. Start the Vite dev server and type-check build
npm run dev
npm run build`}
                />
              </div>
            </ChapterShell>
          )}

          {/* ═════════════════════════════════════════════════════════════════
              CHAPTER 18: FAQ AND TROUBLESHOOTING
             ═════════════════════════════════════════════════════════════════ */}
          {visibleIds.has('faq') && (
            <ChapterShell {...getNeighbors('faq')} onSelectSection={scrollToSection}>
              <div className="space-y-3">
                {[
                  {
                    q: 'Why hasn’t my XP updated immediately after completing an action?',
                    a: 'XP events are recorded through an idempotent ledger (/api/xp-event with a client transaction fallback) to prevent duplicates. If your connection dropped mid-request, simply open or refresh My Profile — GoBoard automatically runs background milestone reconciliation on profile load, and admins can also trigger Reconcile XP from the Admin Dashboard.',
                  },
                  {
                    q: 'Why do I see a "GitHub API rate limit reached" notice?',
                    a: 'Unauthenticated requests to the GitHub API are limited by GitHub to 60 queries per hour per shared campus IP address. Connecting your GitHub account via OAuth in My Profile raises your personal limit to 5,000 requests per hour.',
                  },
                  {
                    q: 'How does the project approval process work, and what if my project is stuck in the queue?',
                    a: 'New project submissions enter the Admin Queue so moderators can verify that your GitHub repository is public and contains real source code. Reviews normally take 12 to 24 hours. While pending, you can still view and edit your project from your profile.',
                  },
                  {
                    q: 'Can non-Computer Science students participate in GoBoard?',
                    a: 'Yes! Students from every department at Godfrey Okoye University are welcome. Non-CS students regularly publish stories, poems, and essays in the Lit Club, collaborate as UI/UX designers in Duo teams for the Prayer Book Redesign Campaign, and test student apps.',
                  },
                  {
                    q: 'How do I edit or delete my project once it has been submitted?',
                    a: 'Open your project detail page while signed in as the author. Click the "Edit" button in the project header to update your description, tech stack, live demo URL, cover image, project stage, or contribution tags.',
                  },
                  {
                    q: 'Can I submit a private GitHub repository?',
                    a: 'No. GoBoard is built around open, verifiable proof of work. Both the project submission form and the Genesis Quest checker require a public GitHub repository so classmates, lecturers, and the automated grader can inspect the code.',
                  },
                  {
                    q: 'Why was my Student ID card rejected?',
                    a: 'IDs are rejected if the photo is blurry, cropped so your name or matriculation number is unreadable, or not an official Godfrey Okoye University Student ID card. Open Profile → Payday & Wallet to read the admin’s rejection note and click "Replace Student ID Photo".',
                  },
                  {
                    q: 'How do I change my payout bank details?',
                    a: 'Open My Profile → Payday & Wallet (/profile?tab=wallet), update your Bank Name, 10-digit Account Number, and Account Name under Step 3, and click "Save Bank Details".',
                  },
                  {
                    q: 'How do I disconnect or switch my linked GitHub account?',
                    a: 'Open My Profile, scroll to the GitHub Developer Card in the Overview tab, and click the "Unlink" button. You can then connect a different GitHub account.',
                  },
                  {
                    q: 'My quest script works on my laptop, why did it fail the Quest Checker?',
                    a: 'Check three common causes: (1) you forgot to run git push origin main after editing, (2) your script is missing #!/bin/bash on Line 1, or (3) you added a .sh extension to the filename instead of naming it 0-current_working_directory, 1-listit, or 2-gouni_lab.',
                  },
                  {
                    q: 'How do I report a bug or suspected XP cheating?',
                    a: 'Report bugs or suspicious leaderboard activity directly to the Office of the Software Director (Faculty of Computing) or open an issue on the GoBoard GitHub repository.',
                  },
                  {
                    q: 'Which browsers and devices are supported?',
                    a: 'GoBoard works on all modern mobile and desktop browsers, including Chrome, Safari (iOS & macOS), Edge, Firefox, and Brave, with full light and dark mode support.',
                  },
                ].map((faq, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-950/40"
                  >
                    <div className="font-bold text-xs sm:text-sm text-neutral-900 dark:text-white mb-1.5">
                      {faq.q}
                    </div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      {faq.a}
                    </p>
                  </div>
                ))}
              </div>

              <Callout type="note" title="Still Stuck?">
                Contact the <strong>Software Director, Faculty of Computing (Godfrey Okoye University)</strong> or reach out to a student moderator on campus with your display name and GitHub repository URL.
              </Callout>
            </ChapterShell>
          )}

          {/* ═════════════════════════════════════════════════════════════════
              CHAPTER 19: GLOSSARY AND CHANGELOG
             ═════════════════════════════════════════════════════════════════ */}
          {visibleIds.has('glossary') && (
            <ChapterShell {...getNeighbors('glossary')} onSelectSection={scrollToSection}>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                Platform &amp; Developer Glossary
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 my-4 text-xs">
                {[
                  ['XP (Experience Points)', 'Verified progression points earned by shipping projects, completing quests, writing in the Lit Club, and coding on GitHub.'],
                  ['Rank', 'Your builder tier (from Freshman Coder at 0 XP up to Hall of Fame at 2,000+ XP) derived automatically from your total XP.'],
                  ['XP Ledger', 'The idempotent audit log (xpLedger & xpLedgerIds) that guarantees every milestone is credited once and cannot be duplicated.'],
                  ['Genesis Quest', 'A hands-on Git or Linux terminal challenge graded automatically by inspecting your public GoQuests repository.'],
                  ['Quest Grader', 'The serverless testing engine (/api/quest-check) that verifies your repository structure, README, and Bash scripts.'],
                  ['Pull Request (PR)', 'A GitHub contribution proposing code changes from your forked branch into another student’s repository.'],
                  ['Fork & Branch', 'A personal copy of a repository on GitHub (fork) and an isolated line of commits (branch) used for safe collaboration.'],
                  ['Build Journey', 'The unified timeline on every project page combining manual milestone updates with live GitHub commits.'],
                  ['GoCoins (GC)', 'Seasonal reward units tracked in your Student Wallet and converted to Nigerian Naira transfers on Payday.'],
                  ['Season', 'An academic competition cycle featuring quests, a flagship faculty campaign, and a scheduled Payday payout.'],
                ].map(([term, def]) => (
                  <div
                    key={term}
                    className="p-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40"
                  >
                    <div className="font-mono font-bold text-neutral-900 dark:text-white mb-0.5">{term}</div>
                    <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">{def}</p>
                  </div>
                ))}
              </div>

              <h3 className="text-base font-bold text-neutral-900 dark:text-white pt-3">
                Changelog (Newest First)
              </h3>
              <div className="space-y-3 mt-3">
                {[
                  {
                    version: 'v2.4 — November 2026',
                    title: 'GoBoard Docs v2, Onboarding Guard & Pre-Launch Hardening',
                    items: [
                      'Expanded documentation to 19 verified chapters with scroll-spy navigation, mobile chapter picker, and shared XP/Rank constants.',
                      'Streamlined Campaign submissions to use GitHub repositories plus Figma or Google Drive links without redundant image uploads.',
                      'Hardened Quest Checker authentication, Firestore data sanitization, and multi-step onboarding completion.',
                    ],
                  },
                  {
                    version: 'v2.2 — October 2026',
                    title: 'Genesis Quests, Prayer Book Redesign Campaign & Idempotent XP Ledger',
                    items: [
                      'Launched automated GitHub Quest Checker for Quest 01 (Baby Steps) and Quest 02 (0x00. Shell Basics).',
                      'Introduced the Season 1 GoUni Prayer Book Redesign Campaign with a 100-XP vault unlock and 100-point rubric.',
                      'Added server-first idempotent XP ledger (/api/xp-event) with automatic profile milestone reconciliation.',
                    ],
                  },
                  {
                    version: 'v2.0 — October 2026',
                    title: 'GitHub Collaboration, Live Commit Timelines & Lit Club',
                    items: [
                      'Added one-click GitHub repository import, 30-day Builders leaderboard, and live Git commits inside project Build Journeys.',
                      'Launched the Literature Club (/lit-club) for campus short stories, poetry, and essays alongside Student ID verification.',
                    ],
                  },
                ].map((release) => (
                  <div
                    key={release.version}
                    className="p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900"
                  >
                    <div className="font-mono text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                      {release.version}
                    </div>
                    <div className="font-bold text-sm text-neutral-900 dark:text-white mt-0.5 mb-2">
                      {release.title}
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
                      {release.items.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </ChapterShell>
          )}

          {/* ─── Clean Footer Navigation ─── */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <div>
              <div className="font-bold text-sm text-neutral-900 dark:text-white">
                Ready to publish your next build?
              </div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                Godfrey Okoye University · Faculty of Computing Developer Platform
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => navigate('/browse')}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 transition-colors cursor-pointer"
              >
                Explore Projects
              </button>
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 transition-colors cursor-pointer"
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
