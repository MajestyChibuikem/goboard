import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CampaignConfig, Project } from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
  ChevronRight,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  Github,
  ArrowRight,
  Terminal,
  Lock,
  Unlock,
  Eye,
  EyeOff,
} from 'lucide-react';

export type CampaignHubTab = 'quests' | 'upload' | 'tracker' | 'submissions';

interface CampaignBannerProps {
  campaignConfig: CampaignConfig;
  onOpenCampaignHub: (tab?: CampaignHubTab) => void;
  onOpenPaydaySetup: () => void;
  onOpenSubmitModal?: () => void;
  onConnectGitHub?: () => void;
  projects?: Project[];
  userVotes?: Set<string>;
}

export const CampaignBanner: React.FC<CampaignBannerProps> = ({
  campaignConfig,
  onOpenCampaignHub,
  onConnectGitHub,
  projects = [],
}) => {
  const { user, profile } = useAuth();

  const [isMinimized, setIsMinimized] = useState(false);
  const [activeView, setActiveView] = useState<'quests' | 'bounty'>('quests');
  const [adminPreviewUnlocked, setAdminPreviewUnlocked] = useState(false);

  const isForgeConnected = Boolean(profile?.githubProfile?.username);
  const userProjects = useMemo(
    () => (user ? projects.filter((p) => p.authorUid === user.uid) : []),
    [projects, user]
  );
  const isFirstShipDone = userProjects.length > 0;

  const completedQuests = profile?.completedQuests || [];
  const isQuest1Done = completedQuests.includes('quest_1_baby_steps');
  const isQuest2Done = completedQuests.includes('quest_2_shell_basics');
  const activeQuestsDoneCount = (isQuest1Done ? 1 : 0) + (isQuest2Done ? 1 : 0);

  const userXp = profile?.xp || 0;
  const hasRequiredXp = userXp >= 100;
  const isCampaignUnlocked = hasRequiredXp || (Boolean(profile?.isAdmin) && adminPreviewUnlocked);
  const campaignXpPercent = Math.min(100, Math.round((userXp / 100) * 100));
  const xpRemaining = Math.max(0, 100 - userXp);

  if (!campaignConfig.isActive) {
    return null;
  }

  return (
    <div className="mb-6 sm:mb-8">
      <AnimatePresence mode="wait" initial={false}>
        {isMinimized ? (
          // ─── Minimized Bar ───
          <motion.div
            key="minimized-banner"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 px-4 py-3 shadow-card border border-neutral-200/80 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 shrink-0">
                Season 01
              </span>
              <span className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                {activeView === 'quests'
                  ? `Quests (${activeQuestsDoneCount}/2 completed)`
                  : isCampaignUnlocked
                  ? 'The GoUni Prayer Book Campaign'
                  : 'Campaign (Unlocks at 100 XP)'}
              </span>
              <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
                <span>•</span>
                <span>{userXp} / 100 XP</span>
              </span>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => onOpenCampaignHub(activeView === 'quests' ? 'quests' : 'tracker')}
                className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-950 font-semibold text-xs transition-colors cursor-pointer"
              >
                {activeView === 'quests' ? 'Open Quests' : 'Campaign'}
              </button>
              <button
                type="button"
                onClick={() => setIsMinimized(false)}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 transition-colors cursor-pointer"
                title="Expand"
                aria-label="Expand"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ) : (
          // ─── Expanded Clean Card ───
          <motion.div
            key="expanded-banner"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.24 }}
            className="rounded-2xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-card border border-neutral-200/80 dark:border-neutral-800 overflow-hidden"
          >
            {/* Top Bar: Switcher + XP Progress + Collapse */}
            <div className="px-5 sm:px-6 py-3.5 border-b border-neutral-100 dark:border-neutral-800/80 flex flex-wrap items-center justify-between gap-3 bg-neutral-50/50 dark:bg-neutral-950/30">
              <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800/90 p-1 rounded-xl border border-neutral-200/60 dark:border-neutral-700/50">
                <button
                  type="button"
                  onClick={() => setActiveView('quests')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeView === 'quests'
                      ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-2xs'
                      : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Quests</span>
                  <span className="text-[11px] text-neutral-400 dark:text-neutral-500 font-mono tabular-nums">
                    {activeQuestsDoneCount}/2
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveView('bounty')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeView === 'bounty'
                      ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-2xs'
                      : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
                  }`}
                >
                  {isCampaignUnlocked ? (
                    <Unlock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500" />
                  )}
                  <span>Campaign</span>
                </button>
              </div>

              <div className="flex items-center gap-3 ml-auto">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 tabular-nums">
                    <strong className="font-semibold text-neutral-900 dark:text-neutral-100">{userXp}</strong> / 100 XP
                  </span>
                  <div className="w-20 h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden hidden sm:block">
                    <div
                      className="h-full bg-neutral-900 dark:bg-white rounded-full transition-all duration-500"
                      style={{ width: `${campaignXpPercent}%` }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMinimized(true)}
                  className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                  title="Minimize"
                  aria-label="Minimize"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 sm:p-6">
              <AnimatePresence mode="wait">
                {activeView === 'quests' ? (
                  // ─────────────────────────────────────────────────────────────
                  // VIEW 1: QUESTS
                  // ─────────────────────────────────────────────────────────────
                  <motion.div
                    key="view-quests"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                    className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
                  >
                    {/* Left Column: Editorial Intro & CTAs */}
                    <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                          Season 01 · Technical Curriculum
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
                          Git &amp; Terminal Quests
                        </h2>
                        <p className="text-[13px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                          Push real code and shell scripts to your public <code className="font-mono text-xs text-neutral-700 dark:text-neutral-300">GoQuests</code> repository. Reach <strong className="font-semibold text-neutral-700 dark:text-neutral-200">100 XP</strong> to unlock the Season 1 Campaign.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 pt-1">
                        <button
                          type="button"
                          onClick={() => onOpenCampaignHub('quests')}
                          className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-950 font-semibold text-xs transition-colors inline-flex items-center gap-2 cursor-pointer"
                        >
                          <Terminal className="w-3.5 h-3.5" />
                          Open Quests
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveView('bounty')}
                          className="px-3.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200/70 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-200 font-semibold text-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          {!isCampaignUnlocked && <Lock className="w-3 h-3 text-neutral-400" />}
                          <span>Campaign</span>
                          <ArrowRight className="w-3.5 h-3.5 text-neutral-400" />
                        </button>
                      </div>
                    </div>

                    {/* Right Column: Clean Track List */}
                    <div className="lg:col-span-7 rounded-xl border border-neutral-200/80 dark:border-neutral-800 divide-y divide-neutral-200/70 dark:divide-neutral-800 bg-neutral-50/40 dark:bg-neutral-950/40 overflow-hidden">
                      {/* Row 1: Quest 01 */}
                      <button
                        type="button"
                        onClick={() => onOpenCampaignHub('quests')}
                        className="w-full px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-neutral-100/70 dark:hover:bg-neutral-800/50 transition-colors text-left cursor-pointer"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="text-xs font-mono font-semibold text-neutral-400 dark:text-neutral-500 mt-0.5">
                            01
                          </span>
                          <div className="min-w-0">
                            <div className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                              <span>Baby Steps</span>
                              {isQuest1Done && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                              Create public repo <code className="font-mono">GoQuests</code> with <code className="font-mono">README.md</code>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="text-xs font-mono font-medium text-neutral-500 dark:text-neutral-400 tabular-nums">
                            +25 XP
                          </span>
                          <ChevronRight className="w-4 h-4 text-neutral-400" />
                        </div>
                      </button>

                      {/* Row 2: Quest 02 */}
                      <button
                        type="button"
                        onClick={() => onOpenCampaignHub('quests')}
                        className="w-full px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-neutral-100/70 dark:hover:bg-neutral-800/50 transition-colors text-left cursor-pointer"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="text-xs font-mono font-semibold text-neutral-400 dark:text-neutral-500 mt-0.5">
                            02
                          </span>
                          <div className="min-w-0">
                            <div className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                              <span>0x00. Shell Basics</span>
                              {isQuest2Done ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              ) : !isQuest1Done ? (
                                <Lock className="w-3 h-3 text-neutral-400 shrink-0" />
                              ) : null}
                            </div>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                              {isQuest1Done
                                ? '3 executable Bash scripts inside 0x00-shell_basics/'
                                : 'Complete Quest 01 to unlock instructions'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="text-xs font-mono font-medium text-neutral-500 dark:text-neutral-400 tabular-nums">
                            +50 XP
                          </span>
                          <ChevronRight className="w-4 h-4 text-neutral-400" />
                        </div>
                      </button>

                      {/* Row 3: GitHub Connection & Starter Status */}
                      <div className="px-4 py-3 flex items-center justify-between gap-4 bg-white/60 dark:bg-neutral-900/40">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Github className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 shrink-0" />
                          <span className="text-xs text-neutral-600 dark:text-neutral-400 truncate">
                            {isForgeConnected
                              ? `GitHub linked (@${profile?.githubProfile?.displayUsername || profile?.githubProfile?.username})`
                              : 'Link your GitHub account to enable automated quest grading'}
                          </span>
                        </div>
                        {!isForgeConnected ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (onConnectGitHub) onConnectGitHub();
                              else onOpenCampaignHub('quests');
                            }}
                            className="text-xs font-semibold text-neutral-900 dark:text-white hover:underline shrink-0 cursor-pointer"
                          >
                            Connect
                          </button>
                        ) : (
                          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
                            {isFirstShipDone ? 'Ready' : 'Connected'}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  // ─────────────────────────────────────────────────────────────
                  // VIEW 2: CAMPAIGN (LOCKED < 100 XP vs UNLOCKED >= 100 XP)
                  // ─────────────────────────────────────────────────────────────
                  <motion.div
                    key="view-bounty"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                  >
                    {!isCampaignUnlocked ? (
                      // LOCKED STATE — No spoilers about Prayer Book or Design
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                        <div className="lg:col-span-6 space-y-4">
                          <div className="space-y-2">
                            <div className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                              <Lock className="w-3 h-3" />
                              <span>Season 01 · Campaign</span>
                            </div>
                            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
                              Unlocks at 100 XP
                            </h2>
                            <p className="text-[13px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                              The Season 1 Campaign brief, rules, and submission portal are locked until you reach 100 XP. You need <strong className="font-semibold text-neutral-800 dark:text-neutral-200">{xpRemaining} more XP</strong> to unlock access.
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2.5 pt-1">
                            <button
                              type="button"
                              onClick={() => onOpenCampaignHub('quests')}
                              className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-950 font-semibold text-xs transition-colors inline-flex items-center gap-2 cursor-pointer"
                            >
                              <Terminal className="w-3.5 h-3.5" />
                              Complete Quests
                            </button>

                            {profile?.isAdmin && (
                              <button
                                type="button"
                                onClick={() => setAdminPreviewUnlocked(true)}
                                className="px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium text-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                                title="Preview the unlocked campaign view as Admin"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Admin Preview
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="lg:col-span-6 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 p-4 sm:p-5 space-y-3.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                              Qualification Progress
                            </span>
                            <span className="font-mono font-semibold text-neutral-900 dark:text-white tabular-nums">
                              {userXp} / 100 XP
                            </span>
                          </div>

                          <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-neutral-900 dark:bg-white rounded-full transition-all duration-500"
                              style={{ width: `${campaignXpPercent}%` }}
                            />
                          </div>

                          <div className="divide-y divide-neutral-200/60 dark:divide-neutral-800/80 text-xs pt-1">
                            <div className="py-2 flex items-center justify-between text-neutral-600 dark:text-neutral-400">
                              <span>1. Complete Onboarding</span>
                              <span className="font-mono tabular-nums text-neutral-900 dark:text-neutral-200">
                                {profile?.onboardingCompletedAt ? '✓ +25 XP' : '+25 XP'}
                              </span>
                            </div>
                            <div className="py-2 flex items-center justify-between text-neutral-600 dark:text-neutral-400">
                              <span>2. Quest 01: Baby Steps</span>
                              <span className="font-mono tabular-nums text-neutral-900 dark:text-neutral-200">
                                {isQuest1Done ? '✓ +25 XP' : '+25 XP'}
                              </span>
                            </div>
                            <div className="py-2 flex items-center justify-between text-neutral-600 dark:text-neutral-400">
                              <span>3. Quest 02: 0x00. Shell Basics</span>
                              <span className="font-mono tabular-nums text-neutral-900 dark:text-neutral-200">
                                {isQuest2Done ? '✓ +50 XP' : '+50 XP'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // UNLOCKED STATE (>= 100 XP or Admin Preview)
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        <div className="lg:col-span-7 space-y-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                Season 01 · Campaign Unlocked
                              </span>
                              {!hasRequiredXp && profile?.isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => setAdminPreviewUnlocked(false)}
                                  className="inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                                >
                                  <EyeOff className="w-3 h-3" /> Exit Preview
                                </button>
                              )}
                            </div>
                            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
                              The GoUni Prayer Book Redesign
                            </h2>
                            <p className="text-[13px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                              Reimagine the official Godfrey Okoye University Prayer Book into a clean, distraction-free mobile experience. Compete solo or as a duo—judged on UX problem solving, typography, prototype clarity, and student votes.
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2.5 pt-1">
                            <button
                              type="button"
                              onClick={() => onOpenCampaignHub('upload')}
                              className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-950 font-semibold text-xs transition-colors cursor-pointer"
                            >
                              Submit Entry
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenCampaignHub('tracker')}
                              className="px-3.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200/70 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-200 font-semibold text-xs transition-colors cursor-pointer"
                            >
                              Read Brief &amp; Rubric
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenCampaignHub('submissions')}
                              className="px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-medium text-xs transition-colors cursor-pointer"
                            >
                              Showcase
                            </button>
                          </div>
                        </div>

                        <div className="lg:col-span-5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 p-4 space-y-2.5">
                          <div className="flex items-center justify-between text-xs font-semibold text-neutral-900 dark:text-white pb-1 border-b border-neutral-200/70 dark:border-neutral-800">
                            <span>100-Point Rubric</span>
                            <span className="text-[11px] font-normal text-neutral-500">Solo or Duo</span>
                          </div>
                          <div className="space-y-1.5 text-xs text-neutral-600 dark:text-neutral-400">
                            <div className="flex justify-between">
                              <span>UX Problem Solving</span>
                              <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-200">35 pts</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Visual Craft &amp; Typography</span>
                              <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-200">25 pts</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Prototype &amp; README Pitch</span>
                              <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-200">20 pts</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Campus Community Votes</span>
                              <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-200">20 pts</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
