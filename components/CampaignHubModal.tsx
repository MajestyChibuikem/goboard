import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CampaignConfig,
  CampaignSubmission,
  Project,
} from '../types';
import {
  ACTIVE_QUESTS,
  QuestTaskCheckResult,
} from '../shared/questsConfig';
import { CampaignHubTab } from './CampaignBanner';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './Toast';
import {
  submitCampaignDesign,
  subscribeToCampaignSubmissions,
  toggleCampaignSubmissionVote,
} from '../services/firestoreService';
import {
  runQuestChecker,
  validateCampaignRepo,
} from '../services/xpClient';
import {
  X,
  Upload,
  Target,
  FileText,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertCircle,
  Lock,
  Unlock,
  Trash2,
  ArrowRight,
  ShieldCheck,
  Trophy,
  ExternalLink,
  Github,
  Rocket,
  Compass,
  GitPullRequest,
  Award,
  Terminal,
  BookOpen,
  Play,
  Loader2,
  Palette,
  Users,
  Heart,
  Figma,
} from 'lucide-react';

interface CampaignHubModalProps {
  initialTab?: CampaignHubTab;
  campaignConfig: CampaignConfig;
  onClose: () => void;
  onOpenPaydaySetup: () => void;
  onRequireAuth: () => void;
  onOpenSubmitModal?: () => void;
  projects?: Project[];
  userVotes?: Set<string>;
  onVoteProject?: (e: React.MouseEvent, projectId: string) => void;
}

export const CampaignHubModal: React.FC<CampaignHubModalProps> = ({
  initialTab = 'quests',
  onClose,
  onRequireAuth,
  onOpenSubmitModal,
  projects = [],
  userVotes = new Set(),
}) => {
  const { user, profile, connectGitHubWithOAuth, updateLocalProfile, refreshProfile } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<CampaignHubTab>(initialTab);
  const [connectingGitHub, setConnectingGitHub] = useState(false);
  const [adminPreviewUnlocked, setAdminPreviewUnlocked] = useState(false);

  // Active Quest Checker state
  const [checkingQuestId, setCheckingQuestId] = useState<string | null>(null);
  const [questCheckOutputs, setQuestCheckOutputs] = useState<
    Record<
      string,
      {
        allPassed: boolean;
        xpAwarded: number;
        repoUrl?: string;
        results: QuestTaskCheckResult[];
      }
    >
  >({});

  // Campaign Submissions Showcase state
  const [submissions, setSubmissions] = useState<CampaignSubmission[]>([]);
  const [votingId, setVotingId] = useState<string | null>(null);

  // Campaign Submission Form state
  const [teamSize, setTeamSize] = useState<'solo' | 'duo'>('solo');
  const [partnerUsername, setPartnerUsername] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [figmaUrl, setFigmaUrl] = useState('');
  const [pitchSummary, setPitchSummary] = useState('');
  const [validatingRepo, setValidatingRepo] = useState(false);
  const [repoValidationInfo, setRepoValidationInfo] = useState<{
    valid: boolean;
    wordCount: number;
    repoFullName: string;
  } | null>(null);
  const [submittingDesign, setSubmittingDesign] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToCampaignSubmissions(
      (items) => setSubmissions(items),
      'approved_or_winner',
      user?.uid
    );
    return () => unsub();
  }, [user?.uid]);

  // Starter Checklist & Quest Progress
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

  const userXp = profile?.xp || 0;
  const hasRequiredXp = userXp >= 100;
  const isCampaignUnlocked = hasRequiredXp || (Boolean(profile?.isAdmin) && adminPreviewUnlocked);
  const campaignXpPercent = Math.min(100, Math.round((userXp / 100) * 100));

  const handleConnectGitHub = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    setConnectingGitHub(true);
    try {
      await connectGitHubWithOAuth();
      toast('GitHub account connected!', 'success');
    } catch (err: any) {
      toast(err?.message || 'Failed to connect GitHub', 'error');
    } finally {
      setConnectingGitHub(false);
    }
  };

  const handleRunChecker = async (questId: 'quest_1_baby_steps' | 'quest_2_shell_basics') => {
    if (!user) {
      onRequireAuth();
      return;
    }
    if (!isForgeConnected) {
      toast('Please link your GitHub account first so the Checker can inspect your GoQuests repo.', 'error');
      return;
    }

    setCheckingQuestId(questId);
    try {
      const res = await runQuestChecker(questId);
      setQuestCheckOutputs((prev) => ({
        ...prev,
        [questId]: {
          allPassed: res.allPassed,
          xpAwarded: res.xpAwarded || 0,
          repoUrl: res.repoUrl,
          results: res.results || [],
        },
      }));

      if (res.allPassed) {
        const updatedQuests = Array.from(new Set([...completedQuests, questId]));
        const effectiveXp =
          typeof res.newTotalXp === 'number'
            ? res.newTotalXp
            : (profile?.xp || 0) + (res.xpAwarded || 0);
        const effectiveSeasonXp =
          typeof res.newTotalSeasonXp === 'number'
            ? res.newTotalSeasonXp
            : (profile?.seasonXp || 0) + (res.xpAwarded || 0);

        updateLocalProfile({
          completedQuests: updatedQuests,
          ...(res.xpAwarded > 0 || typeof res.newTotalXp === 'number'
            ? {
                xp: effectiveXp,
                seasonXp: effectiveSeasonXp,
              }
            : {}),
        });

        refreshProfile(true).catch(() => {});

        if (res.xpAwarded > 0) {
          toast(`🎉 Quest passed! +${res.xpAwarded} XP awarded!`, 'success');
        } else {
          toast('All quest checks passed!', 'success');
        }
      } else {
        toast('Some checks did not pass yet. Review the terminal output below.', 'error');
      }
    } catch (err: any) {
      toast(err?.message || 'Could not run Quest Checker.', 'error');
    } finally {
      setCheckingQuestId(null);
    }
  };

  const handleValidateRepo = async () => {
    setFormError(null);
    setRepoValidationInfo(null);
    if (!repoUrl.trim() || !figmaUrl.trim()) {
      setFormError('Please enter both your GitHub repository URL and your Figma URL first.');
      return;
    }

    setValidatingRepo(true);
    try {
      const res = await validateCampaignRepo(repoUrl.trim(), figmaUrl.trim());
      setRepoValidationInfo({
        valid: res.valid,
        wordCount: res.wordCount,
        repoFullName: res.repoFullName,
      });
      toast(`Verified ${res.repoFullName} (${res.wordCount}-word README pitch)!`, 'success');
    } catch (err: any) {
      setFormError(err?.message || 'Repository validation failed.');
    } finally {
      setValidatingRepo(false);
    }
  };

  const handleSubmitCampaignDesign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) {
      onRequireAuth();
      return;
    }
    setFormError(null);

    if (!isCampaignUnlocked) {
      setFormError('You need at least 100 XP to submit to the GoUni Prayer Book Redesign Campaign.');
      return;
    }

    if (!repoUrl.trim()) {
      setFormError('Please enter your public GitHub repository URL.');
      return;
    }
    if (!figmaUrl.trim()) {
      setFormError('Please enter your Figma prototype or design file URL.');
      return;
    }
    if (!pitchSummary.trim() || pitchSummary.trim().length < 30) {
      setFormError('Please provide a short pitch summary (at least 30 characters) for the showcase card.');
      return;
    }
    if (teamSize === 'duo' && !partnerUsername.trim()) {
      setFormError('Please enter your duo partner’s @username or display name.');
      return;
    }

    setSubmittingDesign(true);
    try {
      // Ensure repo + README pitch passes server validation
      const validation = await validateCampaignRepo(repoUrl.trim(), figmaUrl.trim());
      setRepoValidationInfo({
        valid: validation.valid,
        wordCount: validation.wordCount,
        repoFullName: validation.repoFullName,
      });

      await submitCampaignDesign({
        authorUid: user.uid,
        displayName: profile.displayName || user.displayName || 'Student',
        authorPhotoURL: profile.photoURL || user.photoURL || null,
        teamSize,
        partnerUsername: teamSize === 'duo' ? partnerUsername.trim() : undefined,
        repoUrl: repoUrl.trim(),
        figmaUrl: figmaUrl.trim(),
        pitchSummary: pitchSummary.trim(),
      });

      toast('Redesign submitted! Campus admins will review it shortly.', 'success');
      setRepoUrl('');
      setFigmaUrl('');
      setPitchSummary('');
      setPartnerUsername('');
      setRepoValidationInfo(null);
      setActiveTab('submissions');
    } catch (err: any) {
      setFormError(err?.message || 'Failed to submit redesign.');
    } finally {
      setSubmittingDesign(false);
    }
  };

  const handleVoteSubmission = async (submissionId: string) => {
    if (!user) {
      onRequireAuth();
      return;
    }
    setVotingId(submissionId);
    try {
      await toggleCampaignSubmissionVote(submissionId, user.uid);
    } catch (err: any) {
      toast(err?.message || 'Failed to toggle vote', 'error');
    } finally {
      setVotingId(null);
    }
  };

  // Reusable Locked 100 XP Component (spoiler-free)
  const renderLockedCampaignVault = () => (
    <div className="p-6 sm:p-8 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 space-y-6 text-center max-w-xl mx-auto my-4">
      <div className="w-12 h-12 rounded-xl bg-neutral-200/70 dark:bg-neutral-800 flex items-center justify-center mx-auto text-neutral-600 dark:text-neutral-300">
        <Lock className="w-5 h-5" />
      </div>
      <div className="space-y-1.5">
        <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          Season 01 · Campaign
        </div>
        <h3 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
          Unlocks at 100 XP
        </h3>
        <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto leading-relaxed">
          Reach <strong>100 XP</strong> to unlock the Season 1 Campaign brief, requirements, and submission portal.
        </p>
      </div>

      {/* Live XP Progress Bar */}
      <div className="max-w-md mx-auto bg-white dark:bg-neutral-950 p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 space-y-3 text-left">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-neutral-600 dark:text-neutral-400">Qualification Progress</span>
          <span className="font-mono text-neutral-900 dark:text-white tabular-nums">
            {userXp} / 100 XP ({campaignXpPercent}%)
          </span>
        </div>
        <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-neutral-900 dark:bg-white rounded-full transition-all duration-500"
            style={{ width: `${campaignXpPercent}%` }}
          />
        </div>
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80 pt-1 text-xs text-neutral-600 dark:text-neutral-400">
          <div className="py-1.5 flex items-center justify-between">
            <span>1. Complete Onboarding Setup</span>
            <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-200">
              {profile?.onboardingCompletedAt ? '✓ +25 XP' : '+25 XP'}
            </span>
          </div>
          <div className="py-1.5 flex items-center justify-between">
            <span>2. Pass Quest 01: Baby Steps</span>
            <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-200">
              {isQuest1Done ? '✓ +25 XP' : '+25 XP'}
            </span>
          </div>
          <div className="py-1.5 flex items-center justify-between">
            <span>3. Pass Quest 02: 0x00. Shell Basics</span>
            <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-200">
              {isQuest2Done ? '✓ +50 XP' : '+50 XP'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <button
          type="button"
          onClick={() => setActiveTab('quests')}
          className="px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-950 font-semibold text-xs sm:text-sm transition-colors inline-flex items-center gap-2 cursor-pointer"
        >
          <Terminal className="w-4 h-4" />
          Go to Quests
          <ArrowRight className="w-3.5 h-3.5" />
        </button>

        {profile?.isAdmin && (
          <button
            type="button"
            onClick={() => setAdminPreviewUnlocked(true)}
            className="px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-white dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-medium text-xs transition-colors cursor-pointer"
          >
            Admin Preview
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-neutral-950 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Top Modal Header */}
        <div className="p-5 sm:p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-4 bg-neutral-50/70 dark:bg-neutral-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 flex items-center justify-center font-black shadow-xs">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  Season 1 · Quests &amp; Campaign
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-neutral-200/70 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                  {userXp} XP
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {isCampaignUnlocked
                  ? 'GoQuests auto-grader and The GoUni Prayer Book Campaign'
                  : 'Complete technical quests to reach 100 XP and unlock the Season 1 Campaign'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-neutral-200/70 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 sm:px-6 pt-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-2 overflow-x-auto bg-neutral-50/40 dark:bg-neutral-900/30">
          {[
            { id: 'quests' as CampaignHubTab, label: 'Quests', icon: Terminal },
            {
              id: 'tracker' as CampaignHubTab,
              label: 'Campaign Brief',
              icon: isCampaignUnlocked ? Target : Lock,
            },
            {
              id: 'upload' as CampaignHubTab,
              label: 'Submit Entry',
              icon: isCampaignUnlocked ? Palette : Lock,
            },
            {
              id: 'submissions' as CampaignHubTab,
              label: isCampaignUnlocked ? `Submissions (${submissions.length})` : 'Submissions',
              icon: isCampaignUnlocked ? Trophy : Lock,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  active
                    ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                    : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* ─────────────────────────────────────────────────────────────────
              TAB 1: GOQUESTS & AUTOMATED GITHUB CHECKER
             ───────────────────────────────────────────────────────────────── */}
          {activeTab === 'quests' && (
            <div className="space-y-8">
              {/* GitHub Connection Banner if not connected */}
              {!isForgeConnected && (
                <div className="p-4 rounded-2xl bg-neutral-900 text-white border border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-400 shrink-0">
                      <Github className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold">Connect GitHub to Enable the Auto-Grader</div>
                      <div className="text-xs text-neutral-400">
                        Our server inspects your public <code className="text-amber-300">GoQuests</code> repository to grade your scripts and award XP.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleConnectGitHub}
                    disabled={connectingGitHub}
                    className="px-4 py-2.5 rounded-xl bg-white text-neutral-950 font-bold text-xs hover:bg-neutral-200 transition-all flex items-center gap-2 shrink-0 cursor-pointer"
                  >
                    {connectingGitHub ? <Loader2 className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />}
                    Connect GitHub
                  </button>
                </div>
              )}

              {/* Active Technical Quest Chain */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base sm:text-lg font-extrabold text-neutral-900 dark:text-white flex items-center gap-2">
                      <Terminal className="w-5 h-5 text-amber-500" />
                      Active Technical Quest Chain
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Complete quests in order. Each quest is graded live against your <code className="font-mono font-bold">GoQuests</code> GitHub repository.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                    {(isQuest1Done ? 1 : 0) + (isQuest2Done ? 1 : 0)} / 2 Completed
                  </span>
                </div>

                {ACTIVE_QUESTS.map((quest) => {
                  const isCompleted = completedQuests.includes(quest.id);
                  const isLocked =
                    quest.prerequisiteQuestId !== null &&
                    !completedQuests.includes(quest.prerequisiteQuestId);
                  const checkOutput = questCheckOutputs[quest.id];
                  const isChecking = checkingQuestId === quest.id;

                  if (isLocked) {
                    // Fog of War Locked Card
                    return (
                      <div
                        key={quest.id}
                        className="p-6 rounded-2xl bg-neutral-950 text-white border border-neutral-800 relative overflow-hidden"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-2 max-w-xl">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                                <Lock className="w-3 h-3" /> {quest.numberLabel} • Fog of War
                              </span>
                              <span className="text-xs font-bold text-emerald-400">
                                +{quest.xpReward} XP
                              </span>
                            </div>
                            <h4 className="text-lg font-extrabold text-white">{quest.title}</h4>
                            <p className="text-xs text-neutral-400 leading-relaxed">
                              {quest.fogOfWarTeaser}
                            </p>
                          </div>
                          <div className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-neutral-400 flex items-center gap-2 shrink-0">
                            <Lock className="w-4 h-4 text-amber-400" />
                            Pass Quest 01 to Unlock
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Unlocked Quest Card
                  return (
                    <div
                      key={quest.id}
                      className={`p-5 sm:p-6 rounded-2xl border transition-all space-y-5 ${
                        isCompleted
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/70'
                          : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 shadow-xs'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-neutral-900 dark:bg-white text-white dark:text-neutral-950">
                              {quest.numberLabel}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                              +{quest.xpReward} XP
                            </span>
                            <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                              Repo: <strong>{quest.targetRepoName}</strong>
                            </span>
                            {isCompleted && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                              </span>
                            )}
                          </div>
                          <h4 className="text-lg font-extrabold text-neutral-900 dark:text-white">
                            {quest.title}
                          </h4>
                          <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                            {quest.overview}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRunChecker(quest.id)}
                          disabled={isChecking}
                          className="px-4 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-950 font-extrabold text-xs transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-sm disabled:opacity-60"
                        >
                          {isChecking ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Checking GitHub...
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 fill-current" />
                              {isCompleted ? 'Re-Run Checker' : 'Run Checker'}
                            </>
                          )}
                        </button>
                      </div>

                      {/* Curated Learning Resources */}
                      {quest.learningResources && quest.learningResources.length > 0 && (
                        <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 space-y-2">
                          <div className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                            Recommended Study Materials (Read Before Coding)
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {quest.learningResources.map((res) => (
                              <a
                                key={res.url}
                                href={res.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-amber-500/50 transition-all flex items-center justify-between gap-2 group"
                              >
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-neutral-900 dark:text-white truncate group-hover:text-amber-600 dark:group-hover:text-amber-400">
                                    {res.title}
                                  </div>
                                  <div className="text-[10px] text-neutral-500">{res.tag}</div>
                                </div>
                                <ExternalLink className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tasks List */}
                      <div className="space-y-2.5">
                        {quest.tasks.map((task) => {
                          const taskResult = checkOutput?.results.find((r) => r.taskId === task.id);
                          return (
                            <div
                              key={task.id}
                              className="p-3.5 rounded-xl bg-neutral-50/80 dark:bg-neutral-950/70 border border-neutral-200/80 dark:border-neutral-800 space-y-2"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                                    {task.number}
                                  </span>
                                  <span className="text-xs font-bold text-neutral-900 dark:text-white">
                                    {task.title}
                                  </span>
                                </div>
                                <code className="text-[11px] font-mono px-2 py-0.5 rounded bg-neutral-900 text-amber-300">
                                  {task.filePath}
                                </code>
                              </div>
                              <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                                {task.instructions}
                              </p>

                              {taskResult && (
                                <div
                                  className={`p-2.5 rounded-lg text-xs font-mono flex items-start gap-2 ${
                                    taskResult.passed
                                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                      : 'bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/30'
                                  }`}
                                >
                                  {taskResult.passed ? (
                                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                                  ) : (
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                                  )}
                                  <span>{taskResult.reason}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Starter Platform Checklist (No Deadline) */}
              <div className="space-y-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <div>
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Starter Platform Checklist (Always Open)
                  </h3>
                  <p className="text-xs text-neutral-500">
                    General GoBoard milestones you can complete at your own pace.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Github className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
                      <div>
                        <div className="text-xs font-bold text-neutral-900 dark:text-white">Connect Your Forge</div>
                        <div className="text-[11px] text-neutral-500">Link your GitHub account</div>
                      </div>
                    </div>
                    {isForgeConnected ? (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">✓ Linked</span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleConnectGitHub}
                        className="px-3 py-1.5 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 text-xs font-bold cursor-pointer"
                      >
                        Connect
                      </button>
                    )}
                  </div>

                  <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Rocket className="w-5 h-5 text-amber-500" />
                      <div>
                        <div className="text-xs font-bold text-neutral-900 dark:text-white">First Ship (+150 XP)</div>
                        <div className="text-[11px] text-neutral-500">Submit your first project</div>
                      </div>
                    </div>
                    {isFirstShipDone ? (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">✓ Shipped</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          if (onOpenSubmitModal) onOpenSubmitModal();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 text-neutral-950 text-xs font-bold cursor-pointer"
                      >
                        Ship
                      </button>
                    )}
                  </div>

                  <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Compass className="w-5 h-5 text-blue-500" />
                      <div>
                        <div className="text-xs font-bold text-neutral-900 dark:text-white">Campus Scout</div>
                        <div className="text-[11px] text-neutral-500">Upvote 3 student projects ({scoutCount}/3)</div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-neutral-500">
                      {isCampusScoutDone ? '✓ Done' : `${scoutCount}/3`}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <GitPullRequest className="w-5 h-5 text-purple-500" />
                      <div>
                        <div className="text-xs font-bold text-neutral-900 dark:text-white">Open Source Pioneer</div>
                        <div className="text-[11px] text-neutral-500">Mark a project Open to PRs</div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-neutral-500">
                      {isOpenSourcePioneerDone ? '✓ Active' : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────
              TAB 2: PRAYER BOOK DESIGN BRIEF & 100-POINT RUBRIC
             ───────────────────────────────────────────────────────────────── */}
          {activeTab === 'tracker' && (
            <div>
              {!isCampaignUnlocked ? (
                renderLockedCampaignVault()
              ) : (
                <div className="space-y-6">
                  <div className="p-6 rounded-2xl bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-950 text-white border border-neutral-800 space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                      <Unlock className="w-3.5 h-3.5" /> 100 XP Vault Declassified • 3-Week Design Sprint
                    </div>
                    <h3 className="text-2xl font-extrabold">
                      Target App: The GoUni Prayer Book
                    </h3>
                    <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                      Every student at Godfrey Okoye University uses the GoUni Prayer Book for daily Angelus, morning/night prayers, campus Mass responses, and hymns. Your challenge is to redesign it into a calm, legible, offline-first mobile experience that students genuinely love opening every day.
                    </p>
                  </div>

                  {/* Core Screens Required */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3">
                      <h4 className="text-sm font-extrabold text-neutral-900 dark:text-white flex items-center gap-2">
                        <Palette className="w-4 h-4 text-amber-500" />
                        Required Screens & Flows (Min 4 Screens)
                      </h4>
                      <ul className="space-y-2 text-xs text-neutral-600 dark:text-neutral-400">
                        <li>• <strong>1. Smart Home / Daily Routine:</strong> Quick-launch card based on time of day (Morning Prayer, 12pm Angelus, Night Prayer).</li>
                        <li>• <strong>2. Distraction-Free Prayer Reader:</strong> High-contrast typography, font-size controls, dark/chalice mode, and response highlighting (Leader vs. All).</li>
                        <li>• <strong>3. Instant Search & Bookmarks:</strong> Fast filtering across prayers, novenas, hymns, and Order of Mass.</li>
                        <li>• <strong>4. Campus Chapel & Audio/Chant Mode:</strong> Optional liturgical calendar or audio accompaniment view.</li>
                      </ul>
                    </div>

                    <div className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3">
                      <h4 className="text-sm font-extrabold text-neutral-900 dark:text-white flex items-center gap-2">
                        <Award className="w-4 h-4 text-emerald-500" />
                        100-Point Judging Rubric (No Bonus for Code)
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between p-2 rounded-lg bg-neutral-50 dark:bg-neutral-950">
                          <span className="font-semibold">1. UX Problem Solving & Navigation</span>
                          <span className="font-extrabold text-amber-600">35 pts</span>
                        </div>
                        <div className="flex justify-between p-2 rounded-lg bg-neutral-50 dark:bg-neutral-950">
                          <span className="font-semibold">2. Visual Craft, Typography & Accessibility</span>
                          <span className="font-extrabold text-amber-600">25 pts</span>
                        </div>
                        <div className="flex justify-between p-2 rounded-lg bg-neutral-50 dark:bg-neutral-950">
                          <span className="font-semibold">3. Figma Prototype & README Pitch Clarity</span>
                          <span className="font-extrabold text-amber-600">20 pts</span>
                        </div>
                        <div className="flex justify-between p-2 rounded-lg bg-neutral-50 dark:bg-neutral-950">
                          <span className="font-semibold">4. Verified Student Community Votes</span>
                          <span className="font-extrabold text-amber-600">20 pts</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-neutral-500">
                        Note: Whether your GitHub repo contains only your <code className="font-mono">README.md</code> pitch + Figma link or frontend code, all entries are judged strictly on the 100-point UI/UX rubric above.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setActiveTab('upload')}
                      className="px-5 py-2.5 rounded-xl bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 font-extrabold text-xs sm:text-sm inline-flex items-center gap-2 cursor-pointer"
                    >
                      Proceed to Submission Form <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────
              TAB 3: SUBMIT REDESIGN FORM
             ───────────────────────────────────────────────────────────────── */}
          {activeTab === 'upload' && (
            <div>
              {!isCampaignUnlocked ? (
                renderLockedCampaignVault()
              ) : (
                <form onSubmit={handleSubmitCampaignDesign} className="space-y-5 max-w-2xl mx-auto">
                  <div>
                    <h3 className="text-lg font-extrabold text-neutral-900 dark:text-white">
                      Submit Your GoUni Prayer Book Redesign
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Create a public GitHub repository containing your written pitch (at least 80 words in <code className="font-mono">README.md</code>) and your Figma prototype link.
                    </p>
                  </div>

                  {formError && (
                    <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* Solo vs Duo */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTeamSize('solo')}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        teamSize === 'solo'
                          ? 'border-neutral-900 dark:border-white bg-neutral-900/5 dark:bg-white/10'
                          : 'border-neutral-200 dark:border-neutral-800'
                      }`}
                    >
                      <div className="text-xs font-extrabold text-neutral-900 dark:text-white">Solo Designer</div>
                      <div className="text-[11px] text-neutral-500">Competing individually (1 member)</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTeamSize('duo')}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        teamSize === 'duo'
                          ? 'border-neutral-900 dark:border-white bg-neutral-900/5 dark:bg-white/10'
                          : 'border-neutral-200 dark:border-neutral-800'
                      }`}
                    >
                      <div className="text-xs font-extrabold text-neutral-900 dark:text-white">Duo Team (Max 2)</div>
                      <div className="text-[11px] text-neutral-500">Collaborate with 1 campus partner</div>
                    </button>
                  </div>

                  {teamSize === 'duo' && (
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                        Partner’s GitHub @username or GoBoard Display Name
                      </label>
                      <input
                        type="text"
                        value={partnerUsername}
                        onChange={(e) => setPartnerUsername(e.target.value)}
                        placeholder="e.g. @chidi_ux"
                        className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-sm"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                        Public GitHub Repository URL (with README Pitch)
                      </label>
                      <input
                        type="url"
                        value={repoUrl}
                        onChange={(e) => {
                          setRepoUrl(e.target.value);
                          setRepoValidationInfo(null);
                        }}
                        placeholder="https://github.com/username/gouni-prayer-book"
                        className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                        Figma Design / Interactive Prototype URL
                      </label>
                      <input
                        type="url"
                        value={figmaUrl}
                        onChange={(e) => {
                          setFigmaUrl(e.target.value);
                          setRepoValidationInfo(null);
                        }}
                        placeholder="https://www.figma.com/file/..."
                        className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                    <div className="text-xs text-neutral-600 dark:text-neutral-400">
                      {repoValidationInfo ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          ✓ Verified {repoValidationInfo.repoFullName} ({repoValidationInfo.wordCount} words in README.md)
                        </span>
                      ) : (
                        <span>Pre-verify that your GitHub repo is public and has an 80+ word README pitch.</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleValidateRepo}
                      disabled={validatingRepo}
                      className="px-3 py-1.5 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 text-xs font-bold shrink-0 cursor-pointer"
                    >
                      {validatingRepo ? 'Checking...' : 'Verify Repo'}
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                      Short Showcase Summary (2–3 sentences on what you improved)
                    </label>
                    <textarea
                      rows={3}
                      value={pitchSummary}
                      onChange={(e) => setPitchSummary(e.target.value)}
                      placeholder="Explain how your redesign improves readability, daily Angelus access, and offline navigation..."
                      className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-sm"
                    />
                  </div>

                  {/* Notice about screenshots staying on GitHub/Figma */}
                  <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400 flex items-start gap-3">
                    <Github className="w-5 h-5 text-neutral-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-neutral-800 dark:text-neutral-200 mb-0.5">
                        No image upload needed on GoBoard
                      </div>
                      <p className="leading-relaxed">
                        Include your UI mockups, before/after comparisons, and design rationale directly in your public GitHub repository&apos;s <code className="font-mono font-bold">README.md</code> or inside your Figma file. Everything stays lightweight on the platform!
                      </p>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingDesign}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-extrabold text-sm shadow-md hover:brightness-105 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {submittingDesign ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Validating & Submitting Redesign...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Submit GoUni Prayer Book Redesign
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────
              TAB 4: SUBMISSIONS SHOWCASE
             ───────────────────────────────────────────────────────────────── */}
          {activeTab === 'submissions' && (
            <div>
              {!isCampaignUnlocked ? (
                renderLockedCampaignVault()
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base sm:text-lg font-extrabold text-neutral-900 dark:text-white">
                        GoUni Prayer Book Redesign Showcase
                      </h3>
                      <p className="text-xs text-neutral-500">
                        Upvote your favorite student UI/UX redesigns (counts for 20% of the final score).
                      </p>
                    </div>
                  </div>

              {submissions.length === 0 ? (
                <div className="p-10 text-center rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800 space-y-2">
                  <Palette className="w-8 h-8 text-neutral-400 mx-auto" />
                  <div className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                    No redesigns in the showcase yet
                  </div>
                  <p className="text-xs text-neutral-500">
                    Unlock 100 XP via GoQuests and be the first to submit your GoUni Prayer Book redesign!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {submissions.map((sub) => {
                    const hasVoted = user ? (sub.votedUserIds || []).includes(user.uid) : false;
                    return (
                      <div
                        key={sub.id}
                        className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden flex flex-col justify-between shadow-xs"
                      >
                        <div>
                          {sub.screenshots?.[0] ? (
                            <div className="h-44 bg-neutral-100 dark:bg-neutral-800 relative overflow-hidden">
                              <img
                                src={sub.screenshots[0]}
                                alt={sub.displayName}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-black/75 text-white backdrop-blur-xs">
                                  {sub.teamSize === 'duo'
                                    ? `Duo • +@${sub.partnerUsername}`
                                    : 'Solo Entry'}
                                </span>
                                {sub.status !== 'approved' && (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500 text-neutral-950">
                                    {sub.status}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="px-4 pt-4 pb-1 flex items-center justify-between">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                                {sub.teamSize === 'duo'
                                  ? `Duo • +@${sub.partnerUsername}`
                                  : 'Solo Entry'}
                              </span>
                              {sub.status !== 'approved' && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500 text-neutral-950">
                                  {sub.status}
                                </span>
                              )}
                            </div>
                          )}

                          <div className="p-4 space-y-2">
                            <div className="text-sm font-extrabold text-neutral-900 dark:text-white">
                              {sub.displayName}
                              {sub.teamSize === 'duo' && sub.partnerUsername
                                ? ` & @${sub.partnerUsername}`
                                : ''}
                            </div>
                            <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-3">
                              {sub.pitchSummary}
                            </p>
                          </div>
                        </div>

                        <div className="px-4 py-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <a
                              href={sub.figmaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 text-xs font-bold flex items-center gap-1"
                            >
                              <ExternalLink className="w-3.5 h-3.5" /> Figma
                            </a>
                            <a
                              href={sub.repoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 text-xs font-bold flex items-center gap-1"
                            >
                              <Github className="w-3.5 h-3.5" /> Pitch Repo
                            </a>
                          </div>

                          <button
                            type="button"
                            disabled={votingId === sub.id || sub.status === 'pending'}
                            onClick={() => handleVoteSubmission(sub.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-all ${
                              hasVoted
                                ? 'bg-amber-500 text-neutral-950'
                                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                            }`}
                          >
                            <Heart className={`w-3.5 h-3.5 ${hasVoted ? 'fill-current' : ''}`} />
                            {sub.likes}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
