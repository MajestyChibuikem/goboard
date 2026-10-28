import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CampaignConfig, Project } from '../types';
import { ACTIVE_QUESTS } from '../shared/questsConfig';
import { useAuth } from '../contexts/AuthContext';
import {
  Coins,
  Upload,
  Sparkles,
  Clock,
  Target,
  ShieldCheck,
  ChevronRight,
  FileText,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  Github,
  Rocket,
  Compass,
  GitPullRequest,
  ArrowRight,
  Award,
  Terminal,
  Lock,
  Unlock,
  Palette,
  Users,
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

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

function calculateTimeRemaining(targetIso: string): TimeRemaining {
  const target = new Date(targetIso).getTime();
  const now = Date.now();
  const diff = target - now;

  if (Number.isNaN(target) || diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return { days, hours, minutes, seconds, isExpired: false };
}

export const CampaignBanner: React.FC<CampaignBannerProps> = ({
  campaignConfig,
  onOpenCampaignHub,
  onOpenPaydaySetup,
  onOpenSubmitModal,
  onConnectGitHub,
  projects = [],
  userVotes = new Set(),
}) => {
  const { user, profile } = useAuth();

  const [timeLeft, setTimeLeft] = useState<TimeRemaining>(() =>
    calculateTimeRemaining(campaignConfig.paydayDate)
  );
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeView, setActiveView] = useState<'quests' | 'bounty'>('quests');

  useEffect(() => {
    setTimeLeft(calculateTimeRemaining(campaignConfig.paydayDate));
    const interval = setInterval(() => {
      setTimeLeft(calculateTimeRemaining(campaignConfig.paydayDate));
    }, 1000);
    return () => clearInterval(interval);
  }, [campaignConfig.paydayDate]);

  // Starter Checklist + Active Technical Quests
  const isForgeConnected = Boolean(profile?.githubProfile?.username);
  const userProjects = useMemo(
    () => (user ? projects.filter((p) => p.authorUid === user.uid) : []),
    [projects, user]
  );
  const isFirstShipDone = userProjects.length > 0;
  const scoutCount = userVotes ? Math.min(userVotes.size, 3) : 0;
  const isCampusScoutDone = scoutCount >= 3;
  const isOpenSourcePioneerDone = userProjects.some((p) => p.openToContributions);

  const completedQuests = profile?.completedQuests || [];
  const isQuest1Done = completedQuests.includes('quest_1_baby_steps');
  const isQuest2Done = completedQuests.includes('quest_2_shell_basics');
  const activeQuestsDoneCount = (isQuest1Done ? 1 : 0) + (isQuest2Done ? 1 : 0);

  const starterCount =
    (isForgeConnected ? 1 : 0) +
    (isFirstShipDone ? 1 : 0) +
    (isCampusScoutDone ? 1 : 0) +
    (isOpenSourcePioneerDone ? 1 : 0);

  const totalQuestsCount = 6; // 2 Active Technical Quests + 4 Starter Milestones
  const totalCompleted = activeQuestsDoneCount + starterCount;
  const progressPercent = Math.round((totalCompleted / totalQuestsCount) * 100);

  const userXp = profile?.xp || 0;
  const isCampaignUnlocked = userXp >= 100 || Boolean(profile?.isAdmin);
  const campaignXpPercent = Math.min(100, Math.round((userXp / 100) * 100));

  if (!campaignConfig.isActive) {
    return null;
  }

  return (
    <div className="mb-6 sm:mb-8">
      <AnimatePresence mode="wait" initial={false}>
        {isMinimized ? (
          // ─── Minimized Sleek Bar ───
          <motion.div
            key="minimized-banner"
            initial={{ opacity: 0, height: 0, scale: 0.98 }}
            animate={{ opacity: 1, height: 'auto', scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-2xl text-neutral-900 dark:text-neutral-100 px-4 py-3 shadow-card border border-neutral-200/90 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3 relative overflow-hidden"
            style={{
              backgroundImage: "url('/bannerbg.jpg')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="absolute inset-0 bg-neutral-950/75 backdrop-blur-[1px] hidden dark:block pointer-events-none" />

            <div className="relative z-10 flex items-center gap-2.5 min-w-0">
              <motion.span
                whileHover={{ scale: 1.04 }}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-950 dark:text-amber-300 border border-amber-400/60 shrink-0 backdrop-blur-sm"
              >
                <span className="relative flex h-2 w-2">
                  <motion.span
                    animate={{ scale: [1, 2, 1], opacity: [0.8, 0, 0.8] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute inline-flex h-full w-full rounded-full bg-amber-500"
                  />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-600" />
                </span>
                Quests: {activeQuestsDoneCount}/2 Active • {starterCount}/4 Starter
              </motion.span>
              <span className="text-xs sm:text-sm font-bold text-neutral-950 dark:text-neutral-100 truncate drop-shadow-xs">
                {activeView === 'quests'
                  ? 'GoQuests: Baby Steps & 0x00. Shell Basics'
                  : isCampaignUnlocked
                  ? 'GoUni Prayer Book Redesign Campaign'
                  : '🔒 Classified Design Campaign (100 XP Vault)'}
              </span>
              <span className="hidden md:inline-flex items-center gap-1 text-xs font-bold text-emerald-900 dark:text-emerald-300 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm px-2.5 py-0.5 rounded-lg border border-emerald-300 dark:border-emerald-800">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                {isCampaignUnlocked ? '100+ XP Unlocked!' : `${userXp} / 100 XP to Unlock Campaign`}
              </span>
            </div>

            <div className="relative z-10 flex items-center gap-2 ml-auto">
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onOpenCampaignHub(activeView === 'quests' ? 'quests' : 'upload')}
                className="px-3 py-1.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                {activeView === 'quests' ? (
                  <>
                    <Terminal className="w-3.5 h-3.5 text-amber-400" />
                    Quests Hub
                  </>
                ) : (
                  <>
                    {isCampaignUnlocked ? <Palette className="w-3.5 h-3.5 text-emerald-400" /> : <Lock className="w-3.5 h-3.5 text-amber-400" />}
                    {isCampaignUnlocked ? 'Open Campaign' : 'View Vault'}
                  </>
                )}
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => setIsMinimized(false)}
                className="p-1.5 rounded-lg bg-white/80 dark:bg-neutral-800/80 hover:bg-white dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer border border-neutral-200/60 dark:border-neutral-700 shadow-xs flex items-center justify-center"
                title="Expand Banner"
                aria-label="Expand Banner"
              >
                <ChevronDown className="w-4 h-4" />
              </motion.button>
            </div>
          </motion.div>
        ) : (
          // ─── Full Campaign & Quests Banner ───
          <motion.div
            key="expanded-banner"
            initial={{ opacity: 0, height: 0, scale: 0.98 }}
            animate={{ opacity: 1, height: 'auto', scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.98 }}
            transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
            className="relative rounded-3xl overflow-hidden text-neutral-900 dark:text-neutral-100 shadow-card border border-neutral-200/90 dark:border-neutral-800 group"
            style={{
              backgroundImage: "url('/bannerbg.jpg')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="absolute inset-0 bg-neutral-950/75 backdrop-blur-[1px] hidden dark:block pointer-events-none" />

            <div className="relative z-10 p-5 sm:p-7 lg:p-8">
              {/* Top Navigation & Controls Row */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-5">
                <div className="flex flex-wrap items-center gap-2">
                  {activeView === 'quests' ? (
                    <>
                      <motion.span
                        whileHover={{ scale: 1.03 }}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 shadow-xs backdrop-blur-md"
                      >
                        <Terminal className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        GoQuests • Automated Git & Bash Curriculum
                      </motion.span>

                      <motion.span
                        whileHover={{ scale: 1.03 }}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 backdrop-blur-md shadow-xs"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        Reach 100 XP to Unlock the Design Campaign
                      </motion.span>
                    </>
                  ) : (
                    <>
                      <motion.span
                        whileHover={{ scale: 1.03 }}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 shadow-xs backdrop-blur-md"
                      >
                        {isCampaignUnlocked ? (
                          <Unlock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        )}
                        {isCampaignUnlocked
                          ? 'Vault Unlocked • Season 1 Design Sprint'
                          : 'Fog of War • 100 XP Qualification Gate'}
                      </motion.span>

                      <motion.span
                        whileHover={{ scale: 1.03 }}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 backdrop-blur-md shadow-xs"
                      >
                        <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        Solo or Duo (Max 2) • Pure UI/UX Judging
                      </motion.span>
                    </>
                  )}
                </div>

                {/* Right: Switcher Pill & Minimize Button */}
                <div className="flex items-center gap-2 shrink-0 self-start lg:self-auto">
                  <div className="bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md p-1 rounded-2xl border border-neutral-200/80 dark:border-neutral-700 shadow-xs flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setActiveView('quests')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeView === 'quests'
                          ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shadow-xs'
                          : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100/70 dark:hover:bg-neutral-800/70'
                      }`}
                    >
                      <Terminal className="w-3.5 h-3.5 text-amber-400" />
                      <span>GoQuests</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                          activeView === 'quests'
                            ? 'bg-white/20 dark:bg-neutral-900/20 text-white dark:text-neutral-900'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
                        }`}
                      >
                        {activeQuestsDoneCount}/2
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveView('bounty')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeView === 'bounty'
                          ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shadow-xs'
                          : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100/70 dark:hover:bg-neutral-800/70'
                      }`}
                    >
                      {isCampaignUnlocked ? (
                        <Palette className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-amber-500" />
                      )}
                      <span>Design Campaign</span>
                    </button>
                  </div>

                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => setIsMinimized(true)}
                    className="p-1.5 rounded-xl bg-white/85 dark:bg-neutral-900/90 hover:bg-white dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer backdrop-blur-md border border-neutral-200/80 dark:border-neutral-700 shadow-xs flex items-center justify-center shrink-0"
                    title="Minimize Banner"
                    aria-label="Minimize Banner"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {activeView === 'quests' ? (
                  // ─────────────────────────────────────────────────────────────
                  // VIEW 1: GOQUESTS (ACTIVE TECHNICAL QUESTS + STARTER CHECKLIST)
                  // ─────────────────────────────────────────────────────────────
                  <motion.div
                    key="view-quests"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.22 }}
                    className="space-y-5"
                  >
                    <div className="max-w-3xl">
                      <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight text-neutral-900 dark:text-white">
                        GoQuests: Build Your Git & Bash Mastery
                      </h2>
                      <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 mt-2 leading-relaxed max-w-2xl">
                        Complete hands-on GitHub & Linux terminal quests verified by our automated checker. Earn <strong>100 XP</strong> (Onboarding +25 XP, Quest 01 +25 XP, Quest 02 +50 XP) to declassify the campus design competition!
                      </p>
                    </div>

                    {/* 2 Active Technical Quests + 2 Key Starter Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                      {/* Active Quest 1: Baby Steps */}
                      <motion.div
                        whileHover={{ y: -2 }}
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                          isQuest1Done
                            ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-200/90 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-200 shadow-xs'
                            : 'bg-white/95 dark:bg-neutral-900/95 border-amber-300/90 dark:border-amber-700/70 text-neutral-900 dark:text-neutral-100 shadow-xs'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="w-8 h-8 rounded-xl bg-neutral-900 dark:bg-neutral-800 text-amber-400 flex items-center justify-center">
                              <Github className="w-4 h-4" />
                            </div>
                            {isQuest1Done ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                                <CheckCircle2 className="w-3 h-3" /> Passed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
                                Quest 01 • Active
                              </span>
                            )}
                          </div>
                          <div>
                            <h4 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-neutral-100">
                              Baby Steps
                            </h4>
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug">
                              Create public repo <code className="font-mono font-bold">GoQuests</code> with <code className="font-mono font-bold">&quot;Baby Steps&quot;</code> in README.md.
                            </p>
                          </div>
                          <div className="text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/40 px-2 py-0.5 rounded-md inline-block border border-amber-200/60 dark:border-amber-800/60">
                            +25 XP • Auto-Graded
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onOpenCampaignHub('quests')}
                          className="w-full py-1.5 px-3 rounded-xl bg-neutral-950 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-950 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Terminal className="w-3.5 h-3.5" />
                          {isQuest1Done ? 'View Checked Tasks' : 'Run Quest Checker'}
                        </button>
                      </motion.div>

                      {/* Active Quest 2: 0x00. Shell Basics (Fog of War until Quest 1 is done) */}
                      <motion.div
                        whileHover={{ y: -2 }}
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 relative overflow-hidden ${
                          isQuest2Done
                            ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-200/90 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-200 shadow-xs'
                            : isQuest1Done
                            ? 'bg-white/95 dark:bg-neutral-900/95 border-emerald-300/90 dark:border-emerald-700/70 text-neutral-900 dark:text-neutral-100 shadow-xs'
                            : 'bg-neutral-900/90 dark:bg-neutral-950/90 border-neutral-800 text-white shadow-xs'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                              {isQuest1Done ? <Terminal className="w-4 h-4" /> : <Lock className="w-4 h-4 text-amber-400" />}
                            </div>
                            {isQuest2Done ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                                <CheckCircle2 className="w-3 h-3" /> Passed
                              </span>
                            ) : isQuest1Done ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                                Quest 02 • Unlocked
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/40">
                                <Lock className="w-2.5 h-2.5" /> Fog of War
                              </span>
                            )}
                          </div>
                          <div>
                            <h4 className={`text-xs sm:text-sm font-bold ${isQuest1Done ? 'text-neutral-900 dark:text-neutral-100' : 'text-white'}`}>
                              0x00. Shell Basics
                            </h4>
                            <p className={`text-[11px] mt-0.5 leading-snug ${isQuest1Done ? 'text-neutral-500 dark:text-neutral-400' : 'text-neutral-400'}`}>
                              {isQuest1Done
                                ? '3 Bash script challenges inside 0x00-shell_basics/ (pwd, ls -la, mkdir && touch).'
                                : 'Classified terminal challenge. Pass "Quest 01: Baby Steps" to reveal instructions.'}
                            </p>
                          </div>
                          <div className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md inline-block border border-emerald-800/60">
                            +50 XP • Unlocks 100 XP Gate
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onOpenCampaignHub('quests')}
                          className={`w-full py-1.5 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            isQuest1Done
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              : 'bg-white/10 hover:bg-white/15 text-neutral-200 border border-white/15'
                          }`}
                        >
                          {isQuest1Done ? (
                            <>
                              <Terminal className="w-3.5 h-3.5" />
                              {isQuest2Done ? 'View Checked Tasks' : 'Open Shell Basics'}
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5 text-amber-400" />
                              Complete Quest 01 First
                            </>
                          )}
                        </button>
                      </motion.div>

                      {/* Starter Milestone: Connect Your Forge */}
                      <motion.div
                        whileHover={{ y: -2 }}
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                          isForgeConnected
                            ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-200/90 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-200 shadow-xs'
                            : 'bg-white/90 dark:bg-neutral-900/90 border-neutral-200/90 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-xs'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="w-8 h-8 rounded-xl bg-neutral-900 dark:bg-neutral-800 text-white flex items-center justify-center">
                              <Github className="w-4 h-4" />
                            </div>
                            <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400">
                              Starter Checklist
                            </span>
                          </div>
                          <div>
                            <h4 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-neutral-100">
                              Connect Your Forge
                            </h4>
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug">
                              Link your GitHub account so the Quest Checker can inspect your repos.
                            </p>
                          </div>
                        </div>

                        {isForgeConnected ? (
                          <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">@{profile?.githubProfile?.displayUsername || profile?.githubProfile?.username}</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (onConnectGitHub) onConnectGitHub();
                              else onOpenCampaignHub('quests');
                            }}
                            className="w-full py-1.5 px-3 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Github className="w-3.5 h-3.5" />
                            Connect GitHub
                          </button>
                        )}
                      </motion.div>

                      {/* Starter Milestone: First Ship */}
                      <motion.div
                        whileHover={{ y: -2 }}
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                          isFirstShipDone
                            ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-200/90 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-200 shadow-xs'
                            : 'bg-white/90 dark:bg-neutral-900/90 border-neutral-200/90 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-xs'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                              <Rocket className="w-4 h-4" />
                            </div>
                            <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400">
                              Starter Checklist
                            </span>
                          </div>
                          <div>
                            <h4 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-neutral-100">
                              First Ship
                            </h4>
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug">
                              Submit your first project on GoBoard (+150 XP first-project bonus).
                            </p>
                          </div>
                        </div>

                        {isFirstShipDone ? (
                          <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 truncate">
                            ✓ {userProjects[0]?.title || 'Project Shipped'}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (onOpenSubmitModal) onOpenSubmitModal();
                              else onOpenCampaignHub('quests');
                            }}
                            className="w-full py-1.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-105 text-white font-bold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                          >
                            <Rocket className="w-3.5 h-3.5" />
                            Ship Project
                          </button>
                        )}
                      </motion.div>
                    </div>

                    {/* Bottom CTA Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-200/60 dark:border-neutral-800">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenCampaignHub('quests')}
                          className="px-4 py-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-950 font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <Terminal className="w-4 h-4 text-amber-400 dark:text-amber-600" />
                          Open Quests & Auto-Grader
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveView('bounty')}
                          className="px-3.5 py-2 rounded-xl bg-white/80 dark:bg-neutral-800/80 hover:bg-white dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 font-semibold text-xs sm:text-sm transition-all flex items-center gap-1.5 cursor-pointer border border-neutral-200/80 dark:border-neutral-700 shadow-2xs"
                        >
                          {isCampaignUnlocked ? 'Open Prayer Book Campaign' : 'Preview 100 XP Campaign Vault'}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="text-xs text-neutral-600 dark:text-neutral-300 font-semibold">
                        Your XP: <span className="font-extrabold text-amber-600 dark:text-amber-400">{userXp} XP</span>{' '}
                        {isCampaignUnlocked
                          ? '• 🔓 Design Campaign Unlocked!'
                          : `• Need ${Math.max(0, 100 - userXp)} more XP to unlock the Design Campaign`}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  // ─────────────────────────────────────────────────────────────
                  // VIEW 2: GOUNI PRAYER BOOK REDESIGN CAMPAIGN (100 XP VAULT)
                  // ─────────────────────────────────────────────────────────────
                  <motion.div
                    key="view-bounty"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.22 }}
                    className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 sm:gap-8"
                  >
                    {!isCampaignUnlocked ? (
                      // 🔒 LOCKED VAULT TEASER (< 100 XP)
                      <div className="w-full p-6 rounded-2xl bg-neutral-950/90 text-white border border-amber-500/30 shadow-lg flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                        <div className="space-y-3 max-w-2xl">
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-extrabold uppercase tracking-wider">
                            <Lock className="w-3.5 h-3.5" /> Classified Campus Design Competition
                          </div>
                          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                            Reach 100 XP to Unlock the Season 1 Design Brief
                          </h2>
                          <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                            To ensure high-signal submissions, the campus redesign competition brief, target app, and submission portal are locked behind <strong>100 XP</strong>. Complete your onboarding (+25 XP), <strong>Quest 01: Baby Steps</strong> (+25 XP), and <strong>Quest 02: 0x00. Shell Basics</strong> (+50 XP) to unlock instant access!
                          </p>
                          <div className="max-w-md space-y-1.5 pt-1">
                            <div className="flex justify-between text-xs font-bold">
                              <span className="text-amber-300">Qualification Progress</span>
                              <span>{userXp} / 100 XP ({campaignXpPercent}%)</span>
                            </div>
                            <div className="w-full h-2.5 bg-neutral-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-500"
                                style={{ width: `${campaignXpPercent}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0 w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={() => onOpenCampaignHub('quests')}
                            className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-extrabold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                          >
                            <Terminal className="w-4 h-4" />
                            Complete Quests (+75 XP)
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenCampaignHub('upload')}
                            className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-white/15"
                          >
                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                            Inspect Locked Vault
                          </button>
                        </div>
                      </div>
                    ) : (
                      // 🔓 UNLOCKED GOUNI PRAYER BOOK REDESIGN CAMPAIGN (>= 100 XP)
                      <>
                        <div className="space-y-4 max-w-2xl min-w-0">
                          <div>
                            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight text-neutral-900 dark:text-white">
                              The GoUni Prayer Book Redesign
                            </h2>
                            <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 mt-2 leading-relaxed max-w-xl">
                              Reimagine the official Godfrey Okoye University Prayer Book into a distraction-free, modern mobile experience. Compete solo or as a duo—judged 100% on UI/UX craft, problem-solving, and student community votes (no bonus points for code).
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/90 dark:bg-neutral-900/90 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 shadow-xs">
                              <span className="w-5 h-5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center font-bold text-xs">
                                1
                              </span>
                              <span className="font-semibold">Design in Figma (Solo or Duo)</span>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-neutral-400 hidden sm:block shrink-0" />
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/90 dark:bg-neutral-900/90 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 shadow-xs">
                              <span className="w-5 h-5 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 flex items-center justify-center font-bold text-xs">
                                2
                              </span>
                              <span className="font-semibold">Write Pitch in GitHub README</span>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-neutral-400 hidden sm:block shrink-0" />
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200 shadow-xs">
                              <span className="w-5 h-5 rounded-lg bg-emerald-200 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
                                3
                              </span>
                              <span className="font-semibold">Submit & Rally Campus Votes</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2.5 pt-2">
                            <motion.button
                              type="button"
                              whileHover={{ scale: 1.025 }}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => onOpenCampaignHub('upload')}
                              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-amber-500/20 hover:brightness-105 transition-all flex items-center gap-2 cursor-pointer border border-amber-400/40"
                            >
                              <Palette className="w-4 h-4" />
                              Submit Redesign
                              <span className="px-1.5 py-0.5 rounded-md bg-black/15 text-[10px] font-black">
                                +50 XP
                              </span>
                            </motion.button>

                            <motion.button
                              type="button"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => onOpenCampaignHub('tracker')}
                              className="px-3.5 py-2.5 rounded-xl bg-white/90 dark:bg-neutral-800/90 hover:bg-white dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-semibold text-xs sm:text-sm border border-neutral-200 dark:border-neutral-700 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                              <Target className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                              Design Brief & Rubric
                            </motion.button>

                            <motion.button
                              type="button"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => onOpenCampaignHub('submissions')}
                              className="px-3 py-2.5 rounded-xl bg-white/80 dark:bg-neutral-800/80 hover:bg-white dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 font-medium text-xs transition-all flex items-center gap-1.5 cursor-pointer border border-neutral-200/80 dark:border-neutral-700 shadow-xs"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Submissions Showcase
                            </motion.button>
                          </div>
                        </div>

                        {/* Right Section: 3-Week Sprint Info Card */}
                        <div className="w-full lg:w-76 shrink-0 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-neutral-200 dark:border-neutral-800 shadow-md flex flex-col justify-between gap-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                              <Award className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                              100-Point Rubric
                            </span>
                            <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded-md">
                              No Code Bonus
                            </span>
                          </div>

                          <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between text-neutral-600 dark:text-neutral-300">
                              <span>UX Problem Solving</span>
                              <span className="font-bold">35 pts</span>
                            </div>
                            <div className="flex justify-between text-neutral-600 dark:text-neutral-300">
                              <span>Visual Craft & Typography</span>
                              <span className="font-bold">25 pts</span>
                            </div>
                            <div className="flex justify-between text-neutral-600 dark:text-neutral-300">
                              <span>Prototype & Pitch Clarity</span>
                              <span className="font-bold">20 pts</span>
                            </div>
                            <div className="flex justify-between text-neutral-600 dark:text-neutral-300">
                              <span>Campus Community Votes</span>
                              <span className="font-bold">20 pts</span>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                            <span>3-Week Design Sprint</span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">Solo or Duo</span>
                          </div>
                        </div>
                      </>
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
