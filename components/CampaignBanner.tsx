import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CampaignConfig, Project, GENESIS_QUESTS } from '../types';
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

  // Genesis Quests Completion Calculations
  const isForgeConnected = Boolean(profile?.githubProfile?.username);
  const userProjects = useMemo(
    () => (user ? projects.filter((p) => p.authorUid === user.uid) : []),
    [projects, user]
  );
  const isFirstShipDone = userProjects.length > 0;
  const scoutCount = userVotes ? Math.min(userVotes.size, 3) : 0;
  const isCampusScoutDone = scoutCount >= 3;
  const isOpenSourcePioneerDone = userProjects.some((p) => p.openToContributions);

  const completedCount =
    (isForgeConnected ? 1 : 0) +
    (isFirstShipDone ? 1 : 0) +
    (isCampusScoutDone ? 1 : 0) +
    (isOpenSourcePioneerDone ? 1 : 0);
  const progressPercent = Math.round((completedCount / 4) * 100);

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
            className="rounded-2xl text-neutral-900 px-4 py-3 shadow-card border border-neutral-200/90 flex flex-wrap items-center justify-between gap-3 relative overflow-hidden"
            style={{
              backgroundImage: "url('/bannerbg.jpg')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="relative z-10 flex items-center gap-2.5 min-w-0">
              <motion.span
                whileHover={{ scale: 1.04 }}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-950 border border-amber-400/60 shrink-0 backdrop-blur-sm"
              >
                <span className="relative flex h-2 w-2">
                  <motion.span
                    animate={{ scale: [1, 2, 1], opacity: [0.8, 0, 0.8] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute inline-flex h-full w-full rounded-full bg-amber-500"
                  />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-600" />
                </span>
                Genesis Quests: {completedCount}/4 Done ({progressPercent}%)
              </motion.span>
              <span className="text-xs sm:text-sm font-bold text-neutral-950 truncate drop-shadow-xs">
                {activeView === 'quests' ? 'The Basics • Builder Milestones' : campaignConfig.title}
              </span>
              <span className="hidden md:inline-flex items-center gap-1 text-xs font-bold text-emerald-900 bg-white/80 backdrop-blur-sm px-2.5 py-0.5 rounded-lg border border-emerald-300">
                <Coins className="w-3.5 h-3.5 text-amber-600" />
                {activeView === 'quests'
                  ? '+350 XP • 70 GoCoins Total Value'
                  : `+${campaignConfig.rewardPerPaper} GC (₦${campaignConfig.nairaPer500Coins.toLocaleString()}) / Course`}
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
                    <Award className="w-3.5 h-3.5 text-amber-400" />
                    Quests Hub
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    Upload Paper
                  </>
                )}
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => setIsMinimized(false)}
                className="p-1.5 rounded-lg bg-white/80 hover:bg-white text-neutral-700 transition-colors cursor-pointer border border-neutral-200/60 shadow-xs flex items-center justify-center"
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
            className="relative rounded-3xl overflow-hidden text-neutral-900 shadow-card border border-neutral-200/90 group"
            style={{
              backgroundImage: "url('/bannerbg.jpg')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            {/* Top Right Controls: View Switcher Pill & Minimize Button */}
            <div className="absolute top-3.5 right-3.5 z-30 flex items-center gap-2">
              {/* Segmented View Switcher */}
              <div className="bg-white/90 backdrop-blur-md p-1 rounded-2xl border border-neutral-200/80 shadow-xs flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveView('quests')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeView === 'quests'
                      ? 'bg-neutral-900 text-white shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/70'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>The Basics Quests</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                      activeView === 'quests' ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-500'
                    }`}
                  >
                    {completedCount}/4
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('bounty')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeView === 'bounty'
                      ? 'bg-neutral-900 text-white shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/70'
                  }`}
                >
                  <Target className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Academic Bounty</span>
                </button>
              </div>

              {/* Minimize Toggle Button */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => setIsMinimized(true)}
                className="p-1.5 rounded-xl bg-white/85 hover:bg-white text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer backdrop-blur-md border border-neutral-200/80 shadow-xs flex items-center justify-center"
                title="Minimize Banner"
                aria-label="Minimize Banner"
              >
                <ChevronUp className="w-4 h-4" />
              </motion.button>
            </div>

            <div className="relative z-10 p-5 sm:p-7 lg:p-8">
              <AnimatePresence mode="wait">
                {activeView === 'quests' ? (
                  // ─────────────────────────────────────────────────────────────
                  // VIEW 1: GENESIS BUILDER QUESTS ("THE BASICS")
                  // ─────────────────────────────────────────────────────────────
                  <motion.div
                    key="view-quests"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.22 }}
                    className="space-y-5"
                  >
                    {/* Header Badges Tray */}
                    <div className="flex flex-wrap items-center gap-2 pr-28 sm:pr-40">
                      <motion.span
                        whileHover={{ scale: 1.03 }}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-900 border border-amber-300 shadow-xs backdrop-blur-md"
                      >
                        <span className="relative flex h-2 w-2 mr-0.5">
                          <motion.span
                            animate={{ scale: [1, 2.2, 1], opacity: [0.8, 0, 0.8] }}
                            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                            className="absolute inline-flex h-full w-full rounded-full bg-amber-500"
                          />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-600" />
                        </span>
                        Genesis Questline • The Basics
                      </motion.span>

                      <motion.span
                        whileHover={{ scale: 1.03 }}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-800 border border-emerald-300 backdrop-blur-md shadow-xs"
                      >
                        <Coins className="w-3.5 h-3.5 text-amber-600" />
                        +350 XP • 70 GoCoins Total Rewards
                      </motion.span>

                      <motion.span
                        whileHover={{ scale: 1.03 }}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-neutral-900/10 text-neutral-800 border border-neutral-300/80 backdrop-blur-md shadow-xs"
                      >
                        <Award className="w-3.5 h-3.5 text-amber-500" />
                        {completedCount} / 4 Completed ({progressPercent}%)
                      </motion.span>
                    </div>

                    {/* Headline & Description */}
                    <div className="max-w-3xl">
                      <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight text-neutral-900">
                        The Basics: Build, Ship & Collaborate
                      </h2>
                      <p className="text-xs sm:text-sm text-neutral-600 mt-2 leading-relaxed max-w-2xl">
                        Complete the 4 foundational builder quests to connect your GitHub forge, launch verified repositories, review peer innovations, and earn early builder badges.
                      </p>
                    </div>

                    {/* Animated Progress Bar */}
                    <div className="bg-white/80 backdrop-blur-md p-3 rounded-2xl border border-neutral-200/90 shadow-xs max-w-3xl space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-neutral-800">
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          Questline Progress
                        </span>
                        <span className="text-amber-800 tabular-nums">
                          {completedCount} of 4 Completed ({progressPercent}%)
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-neutral-100 rounded-full overflow-hidden p-0.5 border border-neutral-200/70">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progressPercent}%` }}
                          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-500 relative"
                        />
                      </div>
                    </div>

                    {/* 4 Interactive Quest Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                      {/* Quest 1: Connect Your Forge */}
                      <motion.div
                        whileHover={{ y: -2 }}
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                          isForgeConnected
                            ? 'bg-emerald-50/90 border-emerald-200/90 text-emerald-950 shadow-xs'
                            : 'bg-white/90 border-neutral-200/90 text-neutral-900 shadow-xs'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="w-8 h-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center">
                              <Github className="w-4 h-4" />
                            </div>
                            {isForgeConnected ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Done
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                Step 1
                              </span>
                            )}
                          </div>
                          <div>
                            <h4 className="text-xs sm:text-sm font-bold">Connect Your Forge</h4>
                            <p className="text-[11px] text-neutral-500 mt-0.5 leading-snug">
                              Link your GitHub account to verify your builder profile.
                            </p>
                          </div>
                          <div className="text-[10px] font-bold text-amber-800 bg-amber-50/80 px-2 py-0.5 rounded-md inline-block border border-amber-200/60">
                            +50 XP • Builder Badge
                          </div>
                        </div>

                        <div>
                          {isForgeConnected ? (
                            <div className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1.5">
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
                        </div>
                      </motion.div>

                      {/* Quest 2: First Ship */}
                      <motion.div
                        whileHover={{ y: -2 }}
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                          isFirstShipDone
                            ? 'bg-emerald-50/90 border-emerald-200/90 text-emerald-950 shadow-xs'
                            : 'bg-white/90 border-neutral-200/90 text-neutral-900 shadow-xs'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                              <Rocket className="w-4 h-4" />
                            </div>
                            {isFirstShipDone ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Done
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                Step 2
                              </span>
                            )}
                          </div>
                          <div>
                            <h4 className="text-xs sm:text-sm font-bold">First Ship</h4>
                            <p className="text-[11px] text-neutral-500 mt-0.5 leading-snug">
                              Submit your first project backed by a verified GitHub repo.
                            </p>
                          </div>
                          <div className="text-[10px] font-bold text-amber-800 bg-amber-50/80 px-2 py-0.5 rounded-md inline-block border border-amber-200/60">
                            +150 XP • 50 GoCoins
                          </div>
                        </div>

                        <div>
                          {isFirstShipDone ? (
                            <div className="text-[11px] font-semibold text-emerald-800 truncate">
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
                        </div>
                      </motion.div>

                      {/* Quest 3: Campus Scout */}
                      <motion.div
                        whileHover={{ y: -2 }}
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                          isCampusScoutDone
                            ? 'bg-emerald-50/90 border-emerald-200/90 text-emerald-950 shadow-xs'
                            : 'bg-white/90 border-neutral-200/90 text-neutral-900 shadow-xs'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="w-8 h-8 rounded-xl bg-blue-500 text-white flex items-center justify-center">
                              <Compass className="w-4 h-4" />
                            </div>
                            {isCampusScoutDone ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Done
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                                {scoutCount}/3 Upvotes
                              </span>
                            )}
                          </div>
                          <div>
                            <h4 className="text-xs sm:text-sm font-bold">Campus Scout</h4>
                            <p className="text-[11px] text-neutral-500 mt-0.5 leading-snug">
                              Upvote and review 3 peer student projects on GoBoard.
                            </p>
                          </div>
                          <div className="text-[10px] font-bold text-blue-800 bg-blue-50/80 px-2 py-0.5 rounded-md inline-block border border-blue-200/60">
                            +50 XP • 20 GoCoins
                          </div>
                        </div>

                        <div>
                          {isCampusScoutDone ? (
                            <div className="text-[11px] font-semibold text-emerald-800">
                              ✓ 3/3 Projects Scouted
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                const feed = document.getElementById('project-grid-feed');
                                if (feed) feed.scrollIntoView({ behavior: 'smooth' });
                                else window.scrollTo({ top: 600, behavior: 'smooth' });
                              }}
                              className="w-full py-1.5 px-3 rounded-xl bg-white hover:bg-neutral-50 text-neutral-800 font-bold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer border border-neutral-300 shadow-2xs"
                            >
                              <Compass className="w-3.5 h-3.5 text-blue-600" />
                              Scout Feed ({scoutCount}/3)
                            </button>
                          )}
                        </div>
                      </motion.div>

                      {/* Quest 4: Open Source Pioneer */}
                      <motion.div
                        whileHover={{ y: -2 }}
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                          isOpenSourcePioneerDone
                            ? 'bg-emerald-50/90 border-emerald-200/90 text-emerald-950 shadow-xs'
                            : 'bg-white/90 border-neutral-200/90 text-neutral-900 shadow-xs'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center">
                              <GitPullRequest className="w-4 h-4" />
                            </div>
                            {isOpenSourcePioneerDone ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Done
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                                Step 4
                              </span>
                            )}
                          </div>
                          <div>
                            <h4 className="text-xs sm:text-sm font-bold">Open Source Pioneer</h4>
                            <p className="text-[11px] text-neutral-500 mt-0.5 leading-snug">
                              Mark a project &quot;Open to PRs&quot; to invite collaboration.
                            </p>
                          </div>
                          <div className="text-[10px] font-bold text-purple-800 bg-purple-50/80 px-2 py-0.5 rounded-md inline-block border border-purple-200/60">
                            +100 XP • Contributor Badge
                          </div>
                        </div>

                        <div>
                          {isOpenSourcePioneerDone ? (
                            <div className="text-[11px] font-semibold text-emerald-800">
                              ✓ Repo Open to PRs
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (onOpenSubmitModal) onOpenSubmitModal();
                                else onOpenCampaignHub('quests');
                              }}
                              className="w-full py-1.5 px-3 rounded-xl bg-white hover:bg-neutral-50 text-neutral-800 font-bold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer border border-neutral-300 shadow-2xs"
                            >
                              <GitPullRequest className="w-3.5 h-3.5 text-purple-600" />
                              Enable PRs
                            </button>
                          )}
                        </div>
                      </motion.div>
                    </div>

                    {/* Bottom CTA Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-200/60">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenCampaignHub('quests')}
                          className="px-4 py-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <Award className="w-4 h-4 text-amber-400" />
                          Open Quests Hub
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveView('bounty')}
                          className="px-3.5 py-2 rounded-xl bg-white/80 hover:bg-white text-neutral-700 font-semibold text-xs sm:text-sm transition-all flex items-center gap-1.5 cursor-pointer border border-neutral-200/80 shadow-2xs"
                        >
                          View Exam Paper Bounty
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="text-xs text-neutral-500 font-medium">
                        {completedCount === 4
                          ? '🎉 All 4 Genesis Quests Completed! Master Builder Status Unlocked.'
                          : `${4 - completedCount} quest${4 - completedCount === 1 ? '' : 's'} remaining to complete the Genesis questline.`}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  // ─────────────────────────────────────────────────────────────
                  // VIEW 2: ACADEMIC BOUNTY (EXAM QUESTION PAPERS)
                  // ─────────────────────────────────────────────────────────────
                  <motion.div
                    key="view-bounty"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.22 }}
                    className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 sm:gap-8"
                  >
                    {/* Left Column: Details, Rules Flow & CTAs */}
                    <div className="space-y-4 max-w-2xl min-w-0">
                      {/* Header Badges Tray */}
                      <div className="flex flex-wrap items-center gap-2 pr-28 sm:pr-40">
                        <motion.span
                          whileHover={{ scale: 1.03 }}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-900 border border-amber-300 shadow-xs backdrop-blur-md"
                        >
                          <span className="relative flex h-2 w-2 mr-0.5">
                            <motion.span
                              animate={{ scale: [1, 2.2, 1], opacity: [0.8, 0, 0.8] }}
                              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                              className="absolute inline-flex h-full w-full rounded-full bg-amber-500"
                            />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-600" />
                          </span>
                          Season {campaignConfig.seasonNumber} • Live Academic Bounty
                        </motion.span>

                        <motion.span
                          whileHover={{ scale: 1.03 }}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-800 border border-emerald-300 backdrop-blur-md shadow-xs"
                        >
                          <Coins className="w-3.5 h-3.5 text-amber-600" />
                          {campaignConfig.rewardPerPaper} GoCoins = ₦{campaignConfig.nairaPer500Coins.toLocaleString()} / Course
                        </motion.span>

                        <motion.span
                          whileHover={{ scale: 1.03 }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-neutral-900/5 text-neutral-700 border border-neutral-300/60 backdrop-blur-md"
                        >
                          <Target className="w-3 h-3 text-neutral-600" />
                          5 Slots / Course
                        </motion.span>
                      </div>

                      {/* Headline & Description */}
                      <div>
                        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight text-neutral-900">
                          {campaignConfig.title}
                        </h2>
                        <p className="text-xs sm:text-sm text-neutral-600 mt-2 leading-relaxed max-w-xl">
                          {campaignConfig.description ||
                            'Upload verified Godfrey Okoye University exam question papers. The fastest clear submission per course wins 500 GoCoins (₦500) automatically deposited on Payday!'}
                        </p>
                      </div>

                      {/* 3-Step Micro-Flow */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                        <motion.div
                          whileHover={{ y: -1.5, scale: 1.01 }}
                          transition={{ duration: 0.15 }}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/90 border border-neutral-200 backdrop-blur-md text-neutral-800 shadow-xs cursor-default"
                        >
                          <span className="w-5 h-5 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs border border-amber-300">
                            1
                          </span>
                          <span className="font-semibold">
                            Race for Slot #1 <span className="text-neutral-500 font-normal">(Max 5)</span>
                          </span>
                        </motion.div>
                        <ChevronRight className="w-3.5 h-3.5 text-neutral-400 hidden sm:block shrink-0" />
                        <motion.div
                          whileHover={{ y: -1.5, scale: 1.01 }}
                          transition={{ duration: 0.15 }}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/90 border border-neutral-200 backdrop-blur-md text-neutral-800 shadow-xs cursor-default"
                        >
                          <span className="w-5 h-5 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs border border-blue-300">
                            2
                          </span>
                          <span className="font-semibold">Upload Clear Scan</span>
                        </motion.div>
                        <ChevronRight className="w-3.5 h-3.5 text-neutral-400 hidden sm:block shrink-0" />
                        <motion.div
                          whileHover={{ y: -1.5, scale: 1.01 }}
                          transition={{ duration: 0.15 }}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50/90 border border-emerald-200 backdrop-blur-md text-emerald-900 shadow-xs cursor-default"
                        >
                          <span className="w-5 h-5 rounded-lg bg-emerald-200 text-emerald-800 flex items-center justify-center font-bold text-xs border border-emerald-300">
                            3
                          </span>
                          <span className="font-semibold text-emerald-800">
                            Direct Bank Payday <span className="text-emerald-600 font-normal">(₦500)</span>
                          </span>
                        </motion.div>
                      </div>

                      {/* Action Buttons Tray */}
                      <div className="flex flex-wrap items-center gap-2.5 pt-2">
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.025, boxShadow: '0 8px 20px -4px rgba(245, 158, 11, 0.3)' }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => onOpenCampaignHub('upload')}
                          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-amber-500/20 hover:brightness-105 active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer border border-amber-400/40"
                        >
                          <Upload className="w-4 h-4 stroke-[2.5]" />
                          Upload Exam Paper
                          <motion.span
                            animate={{ scale: [1, 1.08, 1] }}
                            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                            className="px-1.5 py-0.5 rounded-md bg-black/15 text-[10px] font-black tracking-wide"
                          >
                            +{campaignConfig.rewardPerPaper} GC
                          </motion.span>
                        </motion.button>

                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.02, backgroundColor: 'rgba(255, 255, 255, 1)' }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => onOpenCampaignHub('tracker')}
                          className="px-3.5 py-2.5 rounded-xl bg-white/90 hover:bg-white text-neutral-800 font-semibold text-xs sm:text-sm border border-neutral-200 shadow-xs backdrop-blur-md transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Target className="w-4 h-4 text-amber-600" />
                          Course Slot Tracker
                        </motion.button>

                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.02, backgroundColor: 'rgba(255, 255, 255, 1)' }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => onOpenCampaignHub('submissions')}
                          className="px-3 py-2.5 rounded-xl bg-white/80 hover:bg-white text-neutral-700 font-medium text-xs transition-all flex items-center gap-1.5 cursor-pointer border border-neutral-200/80 shadow-xs"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          My Uploads
                        </motion.button>

                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.02, backgroundColor: 'rgba(236, 253, 245, 1)' }}
                          whileTap={{ scale: 0.98 }}
                          onClick={onOpenPaydaySetup}
                          className="px-3 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-xs transition-all flex items-center gap-1 cursor-pointer border border-emerald-200 shadow-xs"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          Payday Setup
                          <ChevronRight className="w-3.5 h-3.5" />
                        </motion.button>
                      </div>
                    </div>

                    {/* Right Section: Glassmorphic Payday Countdown HUD */}
                    <motion.div
                      whileHover={{ y: -2 }}
                      transition={{ duration: 0.2 }}
                      className="w-full lg:w-76 shrink-0 bg-white/90 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-neutral-200 shadow-md flex flex-col justify-between gap-3 relative"
                    >
                      {/* Top Card Kicker */}
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          Payday Countdown
                        </span>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md">
                          Zero Min. Payout
                        </span>
                      </div>

                      {timeLeft.isExpired ? (
                        <div className="py-3 px-4 rounded-xl bg-emerald-50 border border-emerald-300 text-center">
                          <div className="text-sm font-extrabold text-emerald-800 tracking-wide">
                            🎉 PAYDAY IS LIVE!
                          </div>
                          <div className="text-[11px] text-emerald-700 mt-0.5">
                            Verified students are being paid out
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 gap-2 text-center">
                          {[
                            { label: 'Days', value: timeLeft.days },
                            { label: 'Hours', value: timeLeft.hours },
                            { label: 'Mins', value: timeLeft.minutes },
                            { label: 'Secs', value: timeLeft.seconds },
                          ].map((unit) => (
                            <div
                              key={unit.label}
                              className="bg-neutral-50/90 rounded-xl py-2 px-1 border border-neutral-200/80 shadow-inner overflow-hidden"
                            >
                              <div className="h-6 sm:h-7 flex items-center justify-center overflow-hidden">
                                <AnimatePresence mode="popLayout" initial={false}>
                                  <motion.span
                                    key={unit.value}
                                    initial={{ y: -12, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: 12, opacity: 0 }}
                                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                    className="inline-block text-lg sm:text-xl font-black text-neutral-900 tabular-nums leading-none"
                                  >
                                    {String(unit.value).padStart(2, '0')}
                                  </motion.span>
                                </AnimatePresence>
                              </div>
                              <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider mt-1">
                                {unit.label}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="pt-2 border-t border-neutral-200/80 flex items-center justify-between text-[11px] text-neutral-500">
                        <span>Best scan + timestamp wins</span>
                        <span className="font-bold text-amber-700">1 upload / course</span>
                      </div>
                    </motion.div>
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
