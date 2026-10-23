import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CampaignConfig,
  CourseBountySummary,
  ExamPaperSubmission,
  Project,
} from '../types';
import { CampaignHubTab } from './CampaignBanner';
import { ACADEMIC_LEVELS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './Toast';
import {
  normalizeCourseCode,
  subscribeToCourseBounties,
  subscribeToUserExamPapers,
  submitExamPaper,
  uploadProjectImage,
} from '../services/firestoreService';
import {
  X,
  Upload,
  Target,
  FileText,
  Sparkles,
  Coins,
  CheckCircle2,
  Clock,
  AlertCircle,
  Lock,
  Search,
  Camera,
  Trash2,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Sun,
  Zap,
  EyeOff,
  Trophy,
  ChevronRight,
  ExternalLink,
  Github,
  Rocket,
  Compass,
  GitPullRequest,
  Award,
  Check,
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

interface PageUploadItem {
  id: string;
  file: File;
  previewUrl: string;
}

const MAX_PAGES = 6;
const MAX_FILE_SIZE_MB = 8;

export const CampaignHubModal: React.FC<CampaignHubModalProps> = ({
  initialTab = 'quests',
  campaignConfig,
  onClose,
  onOpenPaydaySetup,
  onRequireAuth,
  onOpenSubmitModal,
  projects = [],
  userVotes = new Set(),
  onVoteProject,
}) => {
  const { user, profile, connectGitHubWithOAuth, connectGitHubByUsername } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<CampaignHubTab>(initialTab);

  // GitHub inline connect state for Quest 1
  const [githubUsernameInput, setGithubUsernameInput] = useState('');
  const [connectingGitHub, setConnectingGitHub] = useState(false);
  const [showUsernameInput, setShowUsernameInput] = useState(false);

  // Genesis Quests calculations
  const isForgeConnected = Boolean(profile?.githubProfile?.username);
  const userProjects = useMemo(
    () => (user ? projects.filter((p) => p.authorUid === user.uid) : []),
    [projects, user]
  );
  const isFirstShipDone = userProjects.length > 0;
  const scoutCount = userVotes ? Math.min(userVotes.size, 3) : 0;
  const isCampusScoutDone = scoutCount >= 3;
  const openSourceProject = userProjects.find((p) => p.openToContributions);
  const isOpenSourcePioneerDone = Boolean(openSourceProject);

  const completedQuestsCount =
    (isForgeConnected ? 1 : 0) +
    (isFirstShipDone ? 1 : 0) +
    (isCampusScoutDone ? 1 : 0) +
    (isOpenSourcePioneerDone ? 1 : 0);
  const progressPercent = Math.round((completedQuestsCount / 4) * 100);

  const totalXpEarned =
    (isForgeConnected ? 50 : 0) +
    (isFirstShipDone ? 150 : 0) +
    (isCampusScoutDone ? 50 : 0) +
    (isOpenSourcePioneerDone ? 100 : 0);
  const totalCoinsEarned =
    (isFirstShipDone ? 50 : 0) + (isCampusScoutDone ? 20 : 0);

  const peerProjectsToScout = useMemo(
    () =>
      projects
        .filter((p) => p.authorUid !== user?.uid && (!userVotes || !userVotes.has(p.id)))
        .slice(0, 3),
    [projects, user, userVotes]
  );

  const handleConnectOAuth = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    setConnectingGitHub(true);
    try {
      const res = await connectGitHubWithOAuth();
      toast(`Connected @${res.profile.displayUsername}! +50 XP awarded.`, 'success');
    } catch (err: any) {
      console.error('Failed to connect GitHub OAuth:', err);
      toast(err.message || 'Failed to connect GitHub.', 'error');
    } finally {
      setConnectingGitHub(false);
    }
  };

  const handleConnectByUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onRequireAuth();
      return;
    }
    if (!githubUsernameInput.trim()) return;
    setConnectingGitHub(true);
    try {
      const res = await connectGitHubByUsername(githubUsernameInput.trim());
      setGithubUsernameInput('');
      setShowUsernameInput(false);
      toast(`Connected @${res.profile.displayUsername}! +50 XP awarded.`, 'success');
    } catch (err: any) {
      console.error('Failed to connect GitHub by username:', err);
      toast(err.message || 'Failed to connect GitHub account.', 'error');
    } finally {
      setConnectingGitHub(false);
    }
  };

  // Real-time data
  const [courseBounties, setCourseBounties] = useState<CourseBountySummary[]>([]);
  const [userPapers, setUserPapers] = useState<ExamPaperSubmission[]>([]);
  const [loadingBounties, setLoadingBounties] = useState(true);

  // Upload Form State
  const [courseCodeInput, setCourseCodeInput] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [level, setLevel] = useState(profile?.academicLevel || ACADEMIC_LEVELS[2]); // Default 300 Level
  const [semester, setSemester] = useState<'1st Semester' | '2nd Semester'>('1st Semester');
  const [pages, setPages] = useState<PageUploadItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tracker Filter State
  const [trackerSearch, setTrackerSearch] = useState('');
  const [trackerFilter, setTrackerFilter] = useState<'all' | 'open' | 'full' | 'collected'>('all');

  // Lightbox preview for user's own uploaded pages
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const maxSlots = campaignConfig.maxSubmissionsPerCourse || 5;

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Subscribe to all courseBounties
  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      unsub = subscribeToCourseBounties((bounties) => {
        setCourseBounties(bounties);
        setLoadingBounties(false);
      });
    } catch (err) {
      console.warn('Failed to subscribe to course bounties:', err);
      setLoadingBounties(false);
    }
    return () => unsub?.();
  }, []);

  // Subscribe to current user's exam papers
  useEffect(() => {
    if (!user) {
      setUserPapers([]);
      return;
    }
    let unsub: (() => void) | undefined;
    try {
      unsub = subscribeToUserExamPapers(user.uid, setUserPapers);
    } catch (err) {
      console.warn('Failed to subscribe to user exam papers:', err);
    }
    return () => unsub?.();
  }, [user]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      pages.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, []);

  const normalizedCode = useMemo(
    () => normalizeCourseCode(courseCodeInput),
    [courseCodeInput]
  );

  const matchingBounty = useMemo(
    () => courseBounties.find((b) => b.courseCode === normalizedCode),
    [courseBounties, normalizedCode]
  );

  // Auto-fill course title & level when typing a course code that already exists in tracker
  useEffect(() => {
    if (matchingBounty) {
      if (!courseTitle.trim() && matchingBounty.courseTitle) {
        setCourseTitle(matchingBounty.courseTitle);
      }
      if (matchingBounty.level && ACADEMIC_LEVELS.includes(matchingBounty.level)) {
        setLevel(matchingBounty.level);
      }
    }
  }, [matchingBounty]);

  const userAlreadySubmittedCourse = useMemo(() => {
    if (!user || !normalizedCode) return false;
    if (matchingBounty?.submittedUserIds?.includes(user.uid)) return true;
    return userPapers.some(
      (p) => p.courseCode === normalizedCode && p.status !== 'rejected'
    );
  }, [user, normalizedCode, matchingBounty, userPapers]);

  const courseSlotState = useMemo(() => {
    if (!normalizedCode) return { status: 'idle' as const, count: 0 };
    const count = matchingBounty?.submissionCount || 0;
    if (matchingBounty?.isCollected) {
      return { status: 'collected' as const, count };
    }
    if (userAlreadySubmittedCourse) {
      return { status: 'already_submitted' as const, count };
    }
    if (count >= maxSlots) {
      return { status: 'full' as const, count };
    }
    if (count > 0) {
      return { status: 'open' as const, count };
    }
    return { status: 'new' as const, count: 0 };
  }, [normalizedCode, matchingBounty, userAlreadySubmittedCourse, maxSlots]);

  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const remainingSlots = MAX_PAGES - pages.length;
    if (remainingSlots <= 0) {
      toast(`Maximum ${MAX_PAGES} pages allowed per question paper.`, 'error');
      e.target.value = '';
      return;
    }

    const selectedFiles = Array.from(fileList).slice(0, remainingSlots);
    const validNewPages: PageUploadItem[] = [];

    for (const file of selectedFiles) {
      if (!file.type.startsWith('image/')) {
        toast(`"${file.name}" is not an image file.`, 'error');
        continue;
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast(`"${file.name}" exceeds the ${MAX_FILE_SIZE_MB}MB size limit.`, 'error');
        continue;
      }
      validNewPages.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    if (validNewPages.length > 0) {
      setPages((prev) => [...prev, ...validNewPages]);
    }
    e.target.value = '';
  };

  const handleRemovePage = (id: string) => {
    setPages((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const handleMovePage = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= pages.length) return;
    setPages((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(newIndex, 0, item);
      return copy;
    });
  };

  const handlePrefillCourse = (
    code: string,
    title?: string,
    courseLevel?: string
  ) => {
    if (!user) {
      onRequireAuth();
      return;
    }
    setCourseCodeInput(code);
    if (title) setCourseTitle(title);
    if (courseLevel && ACADEMIC_LEVELS.includes(courseLevel)) {
      setLevel(courseLevel);
    }
    setActiveTab('upload');
  };

  const handleSubmitPaper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onRequireAuth();
      return;
    }

    if (!normalizedCode || normalizedCode.length < 3) {
      toast('Please enter a valid course code (e.g. CSC 301).', 'error');
      return;
    }
    if (!courseTitle.trim()) {
      toast('Please enter the course title.', 'error');
      return;
    }
    if (pages.length === 0) {
      toast('Please upload at least 1 clear photo of the question paper.', 'error');
      return;
    }
    if (
      courseSlotState.status === 'collected' ||
      courseSlotState.status === 'full' ||
      courseSlotState.status === 'already_submitted'
    ) {
      toast('This course slot is not available for upload.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < pages.length; i++) {
        setUploadProgressText(`Uploading page ${i + 1} of ${pages.length}...`);
        const url = await uploadProjectImage(
          pages[i].file,
          `exam_${normalizedCode.replace(/\s+/g, '_')}`
        );
        uploadedUrls.push(url);
      }

      setUploadProgressText('Locking in your course slot...');
      await submitExamPaper(
        {
          courseCode: normalizedCode,
          courseTitle: courseTitle.trim(),
          level,
          semester,
          imageUrls: uploadedUrls,
        },
        user.uid,
        profile?.displayName || user.displayName || 'Student',
        profile?.photoURL || user.photoURL || null
      );

      toast(
        `🎉 ${normalizedCode} paper uploaded! Your submission is now under review.`,
        'success'
      );

      // Clear form and switch to My Submissions
      pages.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setPages([]);
      setCourseCodeInput('');
      setCourseTitle('');
      setUploadProgressText('');
      setActiveTab('submissions');
    } catch (err: any) {
      console.error('Failed to submit exam paper:', err);
      toast(err?.message || 'Failed to upload exam paper. Please try again.', 'error');
    } finally {
      setSubmitting(false);
      setUploadProgressText('');
    }
  };

  // Filtered tracker list
  const filteredBounties = useMemo(() => {
    return courseBounties.filter((b) => {
      const matchesSearch =
        b.courseCode.toLowerCase().includes(trackerSearch.toLowerCase()) ||
        (b.courseTitle || '').toLowerCase().includes(trackerSearch.toLowerCase()) ||
        (b.level || '').toLowerCase().includes(trackerSearch.toLowerCase());

      if (!matchesSearch) return false;

      if (trackerFilter === 'open') {
        return !b.isCollected && b.submissionCount < maxSlots;
      }
      if (trackerFilter === 'full') {
        return !b.isCollected && b.submissionCount >= maxSlots;
      }
      if (trackerFilter === 'collected') {
        return b.isCollected;
      }
      return true;
    });
  }, [courseBounties, trackerSearch, trackerFilter, maxSlots]);

  const userSubmissionStats = useMemo(() => {
    const pending = userPapers.filter((p) => p.status === 'pending').length;
    const approved = userPapers.filter((p) => p.status === 'approved').length;
    return {
      total: userPapers.length,
      pending,
      approved,
      coinsEarned: approved * campaignConfig.rewardPerPaper,
    };
  }, [userPapers, campaignConfig.rewardPerPaper]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 14 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-neutral-200/80 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Gacha Header ── */}
        <div className="relative bg-gradient-to-r from-[#0f0c29] via-[#1e1b4b] to-[#311042] text-white px-6 py-5 border-b border-indigo-500/30 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  Season {campaignConfig.seasonNumber} Bounty Hub
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  <Coins className="w-3 h-3 text-amber-400" />
                  +{campaignConfig.rewardPerPaper} GC (₦{campaignConfig.nairaPer500Coins.toLocaleString()}) / Winner
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-white">
                {campaignConfig.title}
              </h2>
            </div>

            <motion.button
              type="button"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </motion.button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2 mt-5">
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab('quests')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'quests'
                  ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-neutral-950 shadow-md'
                  : 'bg-white/10 text-indigo-100 hover:bg-white/15'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              Genesis Quests
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                  activeTab === 'quests'
                    ? 'bg-neutral-950/15 text-neutral-950'
                    : 'bg-white/15 text-white'
                }`}
              >
                {completedQuestsCount}/4
              </span>
            </motion.button>

            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab('upload')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-neutral-950 shadow-md'
                  : 'bg-white/10 text-indigo-100 hover:bg-white/15'
              }`}
            >
              <Upload className="w-4 h-4" />
              Upload Exam Paper
            </motion.button>

            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab('tracker')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'tracker'
                  ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-neutral-950 shadow-md'
                  : 'bg-white/10 text-indigo-100 hover:bg-white/15'
              }`}
            >
              <Target className="w-4 h-4" />
              5-Slot Course Tracker
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                  activeTab === 'tracker'
                    ? 'bg-neutral-950/15 text-neutral-950'
                    : 'bg-white/15 text-white'
                }`}
              >
                {courseBounties.length}
              </span>
            </motion.button>

            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (!user) {
                  onRequireAuth();
                  return;
                }
                setActiveTab('submissions');
              }}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'submissions'
                  ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-neutral-950 shadow-md'
                  : 'bg-white/10 text-indigo-100 hover:bg-white/15'
              }`}
            >
              <FileText className="w-4 h-4" />
              My Uploads
              {user && (
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                    activeTab === 'submissions'
                      ? 'bg-neutral-950/15 text-neutral-950'
                      : 'bg-white/15 text-white'
                  }`}
                >
                  {userPapers.length}
                </span>
              )}
            </motion.button>
          </div>
        </div>

        {/* ── Modal Body ── */}
        <div className="p-5 sm:p-7 overflow-y-auto flex-grow space-y-6 bg-[#fafafa]">
          {/* =========================================================
              TAB 0: GENESIS BUILDER QUESTS ("THE BASICS")
             ========================================================= */}
          {activeTab === 'quests' && (
            <div className="space-y-6">
              {/* Top Milestone Summary Banner */}
              <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-neutral-900 via-neutral-950 to-indigo-950 text-white border border-neutral-800 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
                <div className="space-y-2 max-w-xl z-10">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/30">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      Genesis Questline • The Basics
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      <Coins className="w-3 h-3 text-amber-400" />
                      350 XP • 70 GoCoins Total Pool
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    Welcome to the Builder Network
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                    Complete these 4 foundational milestones to verify your developer identity, launch your first open-source project, review classmate projects, and claim GoCoins.
                  </p>
                </div>

                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15 shrink-0 w-full md:w-64 space-y-3 z-10">
                  <div className="flex items-center justify-between text-xs font-bold text-neutral-200">
                    <span>Quest Progress</span>
                    <span className="text-amber-400 tabular-nums">
                      {completedQuestsCount} of 4 ({progressPercent}%)
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-neutral-800 rounded-full overflow-hidden p-0.5 border border-white/10">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-emerald-400"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-neutral-300 pt-1 border-t border-white/10">
                    <span>Claimed Rewards:</span>
                    <span className="font-extrabold text-white">
                      +{totalXpEarned} XP • {totalCoinsEarned} GC
                    </span>
                  </div>
                </div>
              </div>

              {/* 4 Detailed Quest Cards */}
              <div className="space-y-4">
                {/* ── Quest 1: Connect Your Forge ── */}
                <div
                  className={`p-5 rounded-2xl border transition-all ${
                    isForgeConnected
                      ? 'bg-white border-emerald-300 shadow-sm'
                      : 'bg-white border-neutral-200 shadow-2xs hover:border-neutral-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                          isForgeConnected
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-neutral-900 text-white'
                        }`}
                      >
                        {isForgeConnected ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <Github className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-neutral-900">
                            1. Connect Your Forge
                          </h4>
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            +50 XP • Builder Identity
                          </span>
                          {isForgeConnected && (
                            <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              ✓ Completed
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                          Link your GitHub profile so your public repositories, languages, and commit activity power your GoBoard identity.
                        </p>
                      </div>
                    </div>

                    <div className="sm:self-center shrink-0">
                      {isForgeConnected ? (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900">
                          <Github className="w-3.5 h-3.5 text-emerald-700" />
                          <span>@{profile?.githubProfile?.displayUsername || profile?.githubProfile?.username}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <button
                            type="button"
                            onClick={handleConnectOAuth}
                            disabled={connectingGitHub}
                            className="px-3.5 py-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                          >
                            <Github className="w-4 h-4" />
                            {connectingGitHub ? 'Connecting...' : 'Connect via GitHub'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowUsernameInput(!showUsernameInput)}
                            className="px-3 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold transition-all cursor-pointer"
                          >
                            {showUsernameInput ? 'Cancel' : 'Use Username'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Optional Username Input Drawer */}
                  {showUsernameInput && !isForgeConnected && (
                    <form
                      onSubmit={handleConnectByUsername}
                      className="mt-4 pt-4 border-t border-neutral-100 flex items-center gap-2"
                    >
                      <input
                        type="text"
                        placeholder="Enter GitHub username (e.g. torvalds)"
                        value={githubUsernameInput}
                        onChange={(e) => setGithubUsernameInput(e.target.value)}
                        className="flex-grow px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      />
                      <button
                        type="submit"
                        disabled={connectingGitHub || !githubUsernameInput.trim()}
                        className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {connectingGitHub ? 'Connecting...' : 'Link'}
                      </button>
                    </form>
                  )}
                </div>

                {/* ── Quest 2: First Ship ── */}
                <div
                  className={`p-5 rounded-2xl border transition-all ${
                    isFirstShipDone
                      ? 'bg-white border-emerald-300 shadow-sm'
                      : 'bg-white border-neutral-200 shadow-2xs hover:border-neutral-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                          isFirstShipDone
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-amber-500 text-white'
                        }`}
                      >
                        {isFirstShipDone ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <Rocket className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-neutral-900">
                            2. First Ship
                          </h4>
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            +150 XP • 50 GoCoins
                          </span>
                          {isFirstShipDone && (
                            <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              ✓ Completed
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                          Submit your first project backed by a verified GitHub repository. Pick from all your public repos with 1-click auto-fill!
                        </p>
                      </div>
                    </div>

                    <div className="sm:self-center shrink-0">
                      {isFirstShipDone ? (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900">
                          <Rocket className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="truncate max-w-[160px]">{userProjects[0]?.title}</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            if (onOpenSubmitModal) onOpenSubmitModal();
                          }}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-105 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Rocket className="w-4 h-4" />
                          Ship Project via GitHub
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Quest 3: Campus Scout ── */}
                <div
                  className={`p-5 rounded-2xl border transition-all ${
                    isCampusScoutDone
                      ? 'bg-white border-emerald-300 shadow-sm'
                      : 'bg-white border-neutral-200 shadow-2xs hover:border-neutral-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                          isCampusScoutDone
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-blue-500 text-white'
                        }`}
                      >
                        {isCampusScoutDone ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <Compass className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-neutral-900">
                            3. Campus Scout
                          </h4>
                          <span className="text-[10px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                            +50 XP • 20 GoCoins
                          </span>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
                              isCampusScoutDone
                                ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                                : 'text-blue-800 bg-blue-50 border-blue-200'
                            }`}
                          >
                            {scoutCount} / 3 Upvoted
                          </span>
                        </div>
                        <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                          Upvote and review 3 classmate projects on GoBoard to help standout ideas rise to the campus leaderboard.
                        </p>
                      </div>
                    </div>

                    <div className="sm:self-center shrink-0">
                      {isCampusScoutDone ? (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>3/3 Scouted</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            const feed = document.getElementById('project-grid-feed');
                            if (feed) feed.scrollIntoView({ behavior: 'smooth' });
                            else window.scrollTo({ top: 600, behavior: 'smooth' });
                          }}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Compass className="w-4 h-4" />
                          Explore Projects ({scoutCount}/3)
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 1-Click Scout Quick Upvote Recommendations */}
                  {!isCampusScoutDone && peerProjectsToScout.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-neutral-100">
                      <div className="text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-2">
                        Quick Scout — Upvote Classmate Work:
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {peerProjectsToScout.map((p) => (
                          <div
                            key={p.id}
                            className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200/80 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-neutral-900 truncate">
                                {p.title}
                              </div>
                              <div className="text-[10px] text-neutral-500 truncate">
                                by {p.displayName || p.studentName}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                if (onVoteProject) onVoteProject(e, p.id);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-white hover:bg-neutral-900 hover:text-white text-neutral-800 text-[11px] font-bold border border-neutral-200 shadow-2xs transition-all cursor-pointer shrink-0"
                            >
                              👍 Vote
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Quest 4: Open Source Pioneer ── */}
                <div
                  className={`p-5 rounded-2xl border transition-all ${
                    isOpenSourcePioneerDone
                      ? 'bg-white border-emerald-300 shadow-sm'
                      : 'bg-white border-neutral-200 shadow-2xs hover:border-neutral-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                          isOpenSourcePioneerDone
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-purple-600 text-white'
                        }`}
                      >
                        {isOpenSourcePioneerDone ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <GitPullRequest className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-neutral-900">
                            4. Open Source Pioneer
                          </h4>
                          <span className="text-[10px] font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                            +100 XP • Contributor Badge
                          </span>
                          {isOpenSourcePioneerDone && (
                            <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              ✓ Completed
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                          Mark a project &quot;Open to PRs & Contributions&quot; to invite classmates to submit pull requests, open issues, and collaborate.
                        </p>
                      </div>
                    </div>

                    <div className="sm:self-center shrink-0">
                      {isOpenSourcePioneerDone ? (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900">
                          <GitPullRequest className="w-3.5 h-3.5 text-purple-600" />
                          <span className="truncate max-w-[160px]">{openSourceProject?.title}</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            if (onOpenSubmitModal) onOpenSubmitModal();
                          }}
                          className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <GitPullRequest className="w-4 h-4" />
                          Ship with Open to PRs
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              TAB 1: UPLOAD EXAM PAPER
             ========================================================= */}
          {activeTab === 'upload' && (
            <form onSubmit={handleSubmitPaper} className="space-y-6">
              {/* Winner Criteria & Privacy Callout */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-neutral-900">1. Speed Matters</div>
                    <p className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed">
                      Up to {maxSlots} uploads per course. Earlier timestamps win tie-breakers.
                    </p>
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Sun className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-neutral-900">2. Clear Lighting</div>
                    <p className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed">
                      Admin picks the sharpest, most readable scan out of the {maxSlots} slots.
                    </p>
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <EyeOff className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-neutral-900">3. Strictly Private</div>
                    <p className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed">
                      Papers are never public to other students — only reviewed by admins.
                    </p>
                  </div>
                </div>
              </div>

              {/* Course Code + Live 5-Slot Status Check */}
              <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                        Course Code *
                      </label>
                      {normalizedCode && (
                        <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/60">
                          Normalized: {normalizedCode}
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={courseCodeInput}
                      onChange={(e) => setCourseCodeInput(e.target.value)}
                      placeholder="Type any course (e.g. CSC 301, GST 102)"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm font-semibold uppercase placeholder:normal-case placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                      Course Title *
                    </label>
                    <input
                      type="text"
                      value={courseTitle}
                      onChange={(e) => setCourseTitle(e.target.value)}
                      placeholder="e.g. Data Structures & Algorithms"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>

                {/* Live Course Slot Availability Indicator */}
                {normalizedCode && (
                  <div
                    className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      courseSlotState.status === 'new'
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                        : courseSlotState.status === 'open'
                        ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                        : courseSlotState.status === 'already_submitted'
                        ? 'bg-indigo-50/70 border-indigo-200 text-indigo-900'
                        : 'bg-red-50/70 border-red-200 text-red-900'
                    }`}
                  >
                    <div className="flex items-start sm:items-center gap-2.5">
                      {courseSlotState.status === 'new' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
                      )}
                      {courseSlotState.status === 'open' && (
                        <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                      )}
                      {courseSlotState.status === 'already_submitted' && (
                        <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5 sm:mt-0" />
                      )}
                      {(courseSlotState.status === 'full' ||
                        courseSlotState.status === 'collected') && (
                        <Lock className="w-4 h-4 text-red-600 shrink-0 mt-0.5 sm:mt-0" />
                      )}

                      <div className="text-xs">
                        {courseSlotState.status === 'new' && (
                          <span>
                            <strong>{normalizedCode} is wide open!</strong> 0/{maxSlots} uploads so far — you&apos;ll lock in <strong>Slot #1</strong>.
                          </span>
                        )}
                        {courseSlotState.status === 'open' && (
                          <span>
                            <strong>
                              {courseSlotState.count}/{maxSlots} slots filled for {normalizedCode}.
                            </strong>{' '}
                            You can submit for <strong>Slot #{courseSlotState.count + 1}</strong> — make sure your photo is crystal clear!
                          </span>
                        )}
                        {courseSlotState.status === 'already_submitted' && (
                          <span>
                            <strong>You already uploaded a paper for {normalizedCode}.</strong> Only 1 upload per student per course is allowed.
                          </span>
                        )}
                        {courseSlotState.status === 'full' && (
                          <span>
                            <strong>All {maxSlots}/{maxSlots} slots for {normalizedCode} are currently full</strong> and under admin review.
                          </span>
                        )}
                        {courseSlotState.status === 'collected' && (
                          <span>
                            <strong>{normalizedCode} has already been collected!</strong> A winning paper was approved for this course.
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 5-Slot Visual Pips */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {Array.from({ length: maxSlots }).map((_, idx) => {
                        const filled = idx < courseSlotState.count;
                        return (
                          <div
                            key={idx}
                            title={`Slot ${idx + 1}`}
                            className={`w-6 h-2.5 rounded-full transition-all ${
                              courseSlotState.status === 'collected'
                                ? 'bg-emerald-500'
                                : filled
                                ? 'bg-amber-500'
                                : 'bg-neutral-200'
                            }`}
                          />
                        );
                      })}
                      <span className="text-[11px] font-bold ml-1 tabular-nums">
                        {courseSlotState.count}/{maxSlots}
                      </span>
                    </div>
                  </div>
                )}

                {/* Level & Semester */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                      Academic Level
                    </label>
                    <select
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      {ACADEMIC_LEVELS.map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {lvl}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                      Semester
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['1st Semester', '2nd Semester'] as const).map((sem) => (
                        <button
                          type="button"
                          key={sem}
                          onClick={() => setSemester(sem)}
                          className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            semester === sem
                              ? 'bg-neutral-900 text-white border-neutral-900'
                              : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                          }`}
                        >
                          {sem}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Multi-Page Photo Uploader */}
              <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900">
                      Question Paper Pages ({pages.length}/{MAX_PAGES}) *
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Upload all pages of the exam paper in order. Ensure good lighting and no blurry text.
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleSelectFiles}
                    className="hidden"
                  />
                  {pages.length < MAX_PAGES && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    >
                      <Camera className="w-4 h-4" />
                      Add Page Photos
                    </button>
                  )}
                </div>

                {pages.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-10 border-2 border-dashed border-neutral-200 hover:border-indigo-400 rounded-2xl bg-neutral-50/60 hover:bg-indigo-50/20 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div className="text-sm font-bold text-neutral-800">
                      Click to snap or select exam paper photos
                    </div>
                    <div className="text-xs text-neutral-400">
                      Supports JPG, PNG, WebP • Up to {MAX_PAGES} pages ({MAX_FILE_SIZE_MB}MB max per photo)
                    </div>
                  </button>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {pages.map((page, idx) => (
                      <div
                        key={page.id}
                        className="relative group rounded-2xl border border-neutral-200 overflow-hidden bg-neutral-100 aspect-[3/4] flex flex-col justify-between"
                      >
                        <img
                          src={page.previewUrl}
                          alt={`Page ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-x-0 top-0 p-2 bg-gradient-to-b from-black/70 to-transparent flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-extrabold">
                            Page {idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemovePage(page.id)}
                            className="p-1 rounded-lg bg-red-500/90 hover:bg-red-600 text-white transition-colors cursor-pointer"
                            title="Remove page"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {pages.length > 1 && (
                          <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 to-transparent flex items-center justify-center gap-2">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMovePage(idx, -1)}
                              className="p-1 rounded-lg bg-white/20 hover:bg-white/30 disabled:opacity-30 text-white backdrop-blur-xs cursor-pointer"
                              title="Move earlier"
                            >
                              <ArrowLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === pages.length - 1}
                              onClick={() => handleMovePage(idx, 1)}
                              className="p-1 rounded-lg bg-white/20 hover:bg-white/30 disabled:opacity-30 text-white backdrop-blur-xs cursor-pointer"
                              title="Move later"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Footer */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="text-xs text-neutral-500 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Remember to complete your{' '}
                    <button
                      type="button"
                      onClick={onOpenPaydaySetup}
                      className="font-bold text-indigo-600 hover:underline cursor-pointer"
                    >
                      Student ID & Bank Setup
                    </button>{' '}
                    before Payday!
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={
                    submitting ||
                    !normalizedCode ||
                    !courseTitle.trim() ||
                    pages.length === 0 ||
                    courseSlotState.status === 'collected' ||
                    courseSlotState.status === 'full' ||
                    courseSlotState.status === 'already_submitted'
                  }
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 text-neutral-950 font-extrabold text-sm shadow-lg shadow-amber-500/20 hover:brightness-105 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                  <Upload className="w-4 h-4 stroke-[2.5]" />
                  {submitting
                    ? uploadProgressText || 'Submitting...'
                    : `Submit Paper (+${campaignConfig.rewardPerPaper} GC Bounty)`}
                </button>
              </div>
            </form>
          )}

          {/* =========================================================
              TAB 2: 5-SLOT COURSE BOUNTY TRACKER
             ========================================================= */}
          {activeTab === 'tracker' && (
            <div className="space-y-5">
              {/* Open Course Info Banner */}
              <div className="bg-indigo-950 text-white p-4 rounded-2xl border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Don&apos;t see your course listed below?
                  </div>
                  <p className="text-xs text-indigo-100/90">
                    Every GoUni exam course has {maxSlots} open slots! Type any course code in the upload tab to be the first uploader.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-extrabold text-xs shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload New Course
                </button>
              </div>

              {/* Search & Filter Controls */}
              <div className="flex flex-col sm:flex-row gap-3 justify-between">
                <div className="relative flex-grow">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={trackerSearch}
                    onChange={(e) => setTrackerSearch(e.target.value)}
                    placeholder="Search tracked courses by code, title, or level..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-neutral-200 shrink-0 overflow-x-auto">
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'open', label: 'Open Slots' },
                      { id: 'full', label: 'Full (5/5)' },
                      { id: 'collected', label: 'Collected' },
                    ] as const
                  ).map((f) => (
                    <button
                      type="button"
                      key={f.id}
                      onClick={() => setTrackerFilter(f.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        trackerFilter === f.id
                          ? 'bg-neutral-900 text-white'
                          : 'text-neutral-500 hover:text-neutral-900'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Course Bounty Grid */}
              {loadingBounties ? (
                <div className="py-16 text-center text-sm text-neutral-400">
                  Loading course slot tracker...
                </div>
              ) : filteredBounties.length === 0 ? (
                <div className="bg-white rounded-2xl border border-neutral-200/80 p-10 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                    <Target className="w-6 h-6" />
                  </div>
                  <div className="text-base font-bold text-neutral-900">
                    {trackerSearch
                      ? `No tracked courses matching "${trackerSearch}"`
                      : 'No courses have been uploaded yet'}
                  </div>
                  <p className="text-xs text-neutral-500 max-w-md mx-auto">
                    {trackerSearch
                      ? 'That means 0/5 slots are taken for that course! Click below to upload it and claim Slot #1.'
                      : 'Be the first student to upload an exam question paper this season and claim Slot #1!'}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      handlePrefillCourse(
                        trackerSearch ? normalizeCourseCode(trackerSearch) : ''
                      )
                    }
                    className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {trackerSearch
                      ? `Upload ${normalizeCourseCode(trackerSearch)} (Slot #1)`
                      : 'Upload First Exam Paper'}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredBounties.map((bounty) => {
                    const count = bounty.submissionCount || 0;
                    const isFull = count >= maxSlots && !bounty.isCollected;
                    const hasUserSubmitted =
                      !!user &&
                      (bounty.submittedUserIds?.includes(user.uid) ||
                        userPapers.some(
                          (p) =>
                            p.courseCode === bounty.courseCode &&
                            p.status !== 'rejected'
                        ));

                    return (
                      <div
                        key={bounty.courseCode}
                        className="bg-white rounded-2xl border border-neutral-200/80 p-4 flex flex-col justify-between gap-3 hover:border-neutral-300 transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-neutral-900">
                                {bounty.courseCode}
                              </span>
                              {bounty.level && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600">
                                  {bounty.level}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-neutral-600 font-medium mt-0.5 line-clamp-1">
                              {bounty.courseTitle || 'Exam Question Paper'}
                            </div>
                          </div>

                          {/* Status Badge */}
                          {bounty.isCollected ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 shrink-0">
                              <CheckCircle2 className="w-3 h-3" />
                              Collected
                            </span>
                          ) : isFull ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-red-50 text-red-700 border border-red-200 flex items-center gap-1 shrink-0">
                              <Lock className="w-3 h-3" />
                              {maxSlots}/{maxSlots} Full
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1 shrink-0">
                              <Clock className="w-3 h-3" />
                              {maxSlots - count} Slot{maxSlots - count !== 1 ? 's' : ''} Left
                            </span>
                          )}
                        </div>

                        {/* 5-Pip Progress Bar & Action */}
                        <div className="pt-2 border-t border-neutral-100 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            {Array.from({ length: maxSlots }).map((_, idx) => (
                              <div
                                key={idx}
                                className={`w-5 h-2 rounded-full ${
                                  bounty.isCollected
                                    ? 'bg-emerald-500'
                                    : idx < count
                                    ? 'bg-amber-500'
                                    : 'bg-neutral-200'
                                }`}
                              />
                            ))}
                            <span className="text-[11px] font-bold text-neutral-500 ml-1 tabular-nums">
                              {count}/{maxSlots} under review
                            </span>
                          </div>

                          {hasUserSubmitted ? (
                            <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                              ✓ You Submitted
                            </span>
                          ) : !bounty.isCollected && !isFull ? (
                            <button
                              type="button"
                              onClick={() =>
                                handlePrefillCourse(
                                  bounty.courseCode,
                                  bounty.courseTitle,
                                  bounty.level
                                )
                              }
                              className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              Upload Slot #{count + 1}
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              TAB 3: MY UPLOADS / SUBMISSIONS
             ========================================================= */}
          {activeTab === 'submissions' && (
            <div className="space-y-5">
              {/* Summary Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80">
                  <div className="text-[11px] font-semibold text-neutral-400 uppercase">
                    My Uploads
                  </div>
                  <div className="text-xl font-black text-neutral-900 mt-0.5">
                    {userSubmissionStats.total}
                  </div>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80">
                  <div className="text-[11px] font-semibold text-amber-600 uppercase">
                    Under Review
                  </div>
                  <div className="text-xl font-black text-amber-600 mt-0.5">
                    {userSubmissionStats.pending}
                  </div>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80">
                  <div className="text-[11px] font-semibold text-emerald-600 uppercase">
                    Winning Papers
                  </div>
                  <div className="text-xl font-black text-emerald-600 mt-0.5">
                    {userSubmissionStats.approved}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-3.5 rounded-2xl border border-amber-200/80">
                  <div className="text-[11px] font-bold text-amber-800 uppercase">
                    Paper Rewards
                  </div>
                  <div className="text-xl font-black text-amber-900 mt-0.5 flex items-center gap-1">
                    <Coins className="w-4 h-4 text-amber-500" />
                    {userSubmissionStats.coinsEarned.toLocaleString()} GC
                  </div>
                </div>
              </div>

              {userPapers.length === 0 ? (
                <div className="bg-white rounded-2xl border border-neutral-200/80 p-10 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="text-base font-bold text-neutral-900">
                    You haven&apos;t uploaded any exam papers yet
                  </div>
                  <p className="text-xs text-neutral-500 max-w-md mx-auto">
                    Each approved exam question paper earns you{' '}
                    <strong>{campaignConfig.rewardPerPaper} GoCoins</strong> (₦
                    {campaignConfig.nairaPer500Coins.toLocaleString()}) paid out on Payday!
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('upload')}
                    className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload Your First Paper
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {userPapers.map((paper) => (
                    <div
                      key={paper.id}
                      className="bg-white rounded-2xl border border-neutral-200/80 p-4 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-black text-neutral-900">
                              {paper.courseCode}
                            </span>
                            <span className="text-xs font-semibold text-neutral-700">
                              {paper.courseTitle}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 text-[10px] font-bold">
                              Slot #{paper.slotNumber} of {maxSlots}
                            </span>
                          </div>
                          <div className="text-[11px] text-neutral-400 mt-0.5">
                            {paper.level} • {paper.semester} • Uploaded{' '}
                            {new Date(paper.createdAt).toLocaleString()}
                          </div>
                        </div>

                        {/* Submission Status Pill */}
                        <div className="shrink-0">
                          {paper.status === 'pending' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              Under Review
                            </span>
                          )}
                          {paper.status === 'approved' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Trophy className="w-3.5 h-3.5 text-emerald-600" />
                              Winner (+{campaignConfig.rewardPerPaper} GC)
                            </span>
                          )}
                          {paper.status === 'not_selected' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-neutral-100 text-neutral-600 border border-neutral-200">
                              <Lock className="w-3.5 h-3.5 text-neutral-500" />
                              Closed (Another Scan Won)
                            </span>
                          )}
                          {paper.status === 'rejected' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                              <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                              Not Accepted
                            </span>
                          )}
                        </div>
                      </div>

                      {paper.status === 'rejected' && (
                        <div className="p-3 rounded-xl bg-red-50 border border-red-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="text-xs text-red-800">
                            <strong>Reason:</strong>{' '}
                            {paper.rejectionReason ||
                              'Image was blurry or unreadable. Your slot has been reopened.'}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handlePrefillCourse(
                                paper.courseCode,
                                paper.courseTitle,
                                paper.level
                              )
                            }
                            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shrink-0 cursor-pointer"
                          >
                            Re-upload Clearer Scan
                          </button>
                        </div>
                      )}

                      {/* Private Page Thumbnails (Only visible to the uploader & admins) */}
                      {paper.imageUrls && paper.imageUrls.length > 0 && (
                        <div className="flex items-center gap-2 overflow-x-auto pt-1">
                          {paper.imageUrls.map((url, idx) => (
                            <button
                              type="button"
                              key={idx}
                              onClick={() => setPreviewImageUrl(url)}
                              className="relative w-16 h-20 rounded-xl overflow-hidden border border-neutral-200 group shrink-0 cursor-pointer"
                              title={`View Page ${idx + 1}`}
                            >
                              <img
                                src={url}
                                alt={`Page ${idx + 1}`}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                              <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-[9px] font-bold">
                                P{idx + 1}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Lightbox for inspecting own uploaded page */}
      <AnimatePresence>
        {previewImageUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setPreviewImageUrl(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.2 }}
              className="relative max-w-3xl max-h-[90vh] bg-neutral-900 rounded-2xl overflow-hidden border border-white/15"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-2.5 bg-black/60 text-white text-xs">
                <span className="font-bold">Exam Paper Page Preview</span>
                <div className="flex items-center gap-2">
                  <a
                    href={previewImageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                  >
                    Open Full Size <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setPreviewImageUrl(null)}
                    className="p-1 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <img
                src={previewImageUrl}
                alt="Exam paper page"
                className="max-h-[82vh] w-auto object-contain mx-auto"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
