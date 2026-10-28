import React, { useState, useEffect, useMemo } from 'react';
import {
  Project,
  Writing,
  CampaignConfig,
  ExamPaperSubmission,
  PayoutRecord,
  CampaignSubmission,
} from '../types';
import {
  subscribeToPendingProjects,
  approveProject,
  rejectProject,
  deleteProject,
  resetDatabase,
  subscribeToPendingWritings,
  approveWriting,
  rejectWriting,
  deleteWriting,
  subscribeToCampaignConfig,
  updateCampaignConfig,
  subscribeToExamPapers,
  selectCoursePaperWinner,
  rejectCoursePaper,
  subscribeToPendingVerifications,
  updateStudentVerification,
  subscribeToUsersWithGoCoins,
  markStudentAsPaid,
  subscribeToPayoutHistory,
  subscribeToCampaignSubmissions,
  approveCampaignSubmission,
  rejectCampaignSubmission,
  markCampaignSubmissionWinner,
  DEFAULT_CAMPAIGN_CONFIG,
} from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './Toast';
import { Button } from './Button';
import {
  ArrowLeft,
  Check,
  X,
  Shield,
  Clock,
  Trash,
  RotateCcw,
  BookOpen,
  Layers,
  FileText,
  BadgeCheck,
  Coins,
  Trophy,
  Zap,
  Search,
  ExternalLink,
  Copy,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Calendar,
  Building2,
  ChevronLeft,
  ChevronRight,
  Lock,
} from 'lucide-react';
import { formatDate } from '../services/utils';
import { STATUS_CONFIG } from '../constants';

interface AdminQueueProps {
  onBack: () => void;
  onProjectClick: (project: Project) => void;
}

type AdminTab =
  | 'design-campaign'
  | 'exam-papers'
  | 'id-verification'
  | 'payday'
  | 'projects'
  | 'literature';

export const AdminQueue: React.FC<AdminQueueProps> = ({
  onBack,
  onProjectClick,
}) => {
  const { profile, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<AdminTab>('design-campaign');

  // ── GoUni Prayer Book Redesign Campaign submissions state ──
  const [campaignSubmissions, setCampaignSubmissions] = useState<CampaignSubmission[]>([]);
  const [campaignProcessingId, setCampaignProcessingId] = useState<string | null>(null);
  const [campaignRejectId, setCampaignRejectId] = useState<string | null>(null);
  const [campaignRejectReason, setCampaignRejectReason] = useState('');

  // ── Projects queue state ──
  const [pendingProjects, setPendingProjects] = useState<Project[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // ── Literature queue state ──
  const [pendingWritings, setPendingWritings] = useState<Writing[]>([]);
  const [litProcessing, setLitProcessing] = useState<string | null>(null);
  const [litRejectId, setLitRejectId] = useState<string | null>(null);
  const [litRejectReason, setLitRejectReason] = useState('');

  // ── Season 1 Campaign & Exam Papers state ──
  const [campaignConfig, setCampaignConfig] = useState<CampaignConfig>(
    DEFAULT_CAMPAIGN_CONFIG
  );
  const [examPapers, setExamPapers] = useState<ExamPaperSubmission[]>([]);
  const [paperFilter, setPaperFilter] = useState<'pending' | 'decided' | 'all'>(
    'pending'
  );
  const [paperSearch, setPaperSearch] = useState('');
  const [paperProcessingId, setPaperProcessingId] = useState<string | null>(
    null
  );
  const [paperRejectId, setPaperRejectId] = useState<string | null>(null);
  const [paperRejectReason, setPaperRejectReason] = useState('');

  // ── Student ID Verification queue state ──
  const [pendingVerifications, setPendingVerifications] = useState<any[]>([]);
  const [verifyProcessingUid, setVerifyProcessingUid] = useState<string | null>(
    null
  );
  const [verifyRejectUid, setVerifyRejectUid] = useState<string | null>(null);
  const [verifyRejectReason, setVerifyRejectReason] = useState('');

  // ── Payday & Economy state ──
  const [usersWithCoins, setUsersWithCoins] = useState<any[]>([]);
  const [payoutHistory, setPayoutHistory] = useState<PayoutRecord[]>([]);
  const [payingStudentUid, setPayingStudentUid] = useState<string | null>(null);
  const [confirmPayUid, setConfirmPayUid] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  // Editable Campaign Config form state
  const isoToDatetimeLocal = (iso: string) => {
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return '';
    const tzOffset = dt.getTimezoneOffset() * 60000;
    return new Date(dt.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const [isConfigDirty, setIsConfigDirty] = useState(false);
  const [editTitle, setEditTitle] = useState(DEFAULT_CAMPAIGN_CONFIG.title);
  const [editDescription, setEditDescription] = useState(
    DEFAULT_CAMPAIGN_CONFIG.description
  );
  const [editNairaRate, setEditNairaRate] = useState(
    String(DEFAULT_CAMPAIGN_CONFIG.nairaPer500Coins)
  );
  const [editRewardPerPaper, setEditRewardPerPaper] = useState(
    String(DEFAULT_CAMPAIGN_CONFIG.rewardPerPaper)
  );
  const [editPaydayDate, setEditPaydayDate] = useState(() =>
    isoToDatetimeLocal(DEFAULT_CAMPAIGN_CONFIG.paydayDate)
  );
  const [editIsActive, setEditIsActive] = useState(true);

  // Lightbox inspector state (for multi-page exam papers & ID cards)
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxCaption, setLightboxCaption] = useState('');

  useEffect(() => {
    const unsub = subscribeToPendingProjects(setPendingProjects);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeToPendingWritings(setPendingWritings);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeToCampaignConfig((cfg) => {
      setCampaignConfig(cfg);
      if (!isConfigDirty) {
        setEditTitle(cfg.title);
        setEditDescription(cfg.description);
        setEditNairaRate(String(cfg.nairaPer500Coins));
        setEditRewardPerPaper(String(cfg.rewardPerPaper));
        setEditIsActive(cfg.isActive);
        if (cfg.paydayDate) {
          const formatted = isoToDatetimeLocal(cfg.paydayDate);
          if (formatted) setEditPaydayDate(formatted);
        }
      }
    });
    return () => unsub();
  }, [isConfigDirty]);

  useEffect(() => {
    const unsub = subscribeToExamPapers(setExamPapers, 'all');
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeToPendingVerifications(setPendingVerifications);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeToUsersWithGoCoins(setUsersWithCoins);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeToPayoutHistory(setPayoutHistory);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeToCampaignSubmissions(setCampaignSubmissions, 'all');
    return () => unsub();
  }, []);

  // Group exam papers by courseCode for side-by-side comparison
  const courseGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        courseCode: string;
        courseTitle: string;
        level: string;
        submissions: ExamPaperSubmission[];
        hasPending: boolean;
        hasWinner: boolean;
      }
    >();

    for (const paper of examPapers) {
      const code = paper.courseCode || 'UNKNOWN';
      if (!map.has(code)) {
        map.set(code, {
          courseCode: code,
          courseTitle: paper.courseTitle,
          level: paper.level,
          submissions: [],
          hasPending: false,
          hasWinner: false,
        });
      }
      const group = map.get(code)!;
      group.submissions.push(paper);
      if (paper.status === 'pending') group.hasPending = true;
      if (paper.status === 'approved') group.hasWinner = true;
    }

    // Sort submissions within each course by earliest upload first (slotNumber / createdAt asc)
    const groups = Array.from(map.values()).map((g) => ({
      ...g,
      submissions: g.submissions.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    }));

    return groups.filter((g) => {
      if (paperFilter === 'pending' && !g.hasPending) return false;
      if (paperFilter === 'decided' && g.hasPending) return false;

      if (paperSearch.trim()) {
        const q = paperSearch.toLowerCase();
        const codeMatch = g.courseCode.toLowerCase().includes(q);
        const titleMatch = (g.courseTitle || '').toLowerCase().includes(q);
        const uploaderMatch = g.submissions.some((s) =>
          (s.displayName || '').toLowerCase().includes(q)
        );
        return codeMatch || titleMatch || uploaderMatch;
      }
      return true;
    });
  }, [examPapers, paperFilter, paperSearch]);

  // Split users with GoCoins into Qualified vs Incomplete for Payday
  const { qualifiedPaydayUsers, incompletePaydayUsers, totalQualifiedNaira, totalQualifiedCoins } =
    useMemo(() => {
      const qualified: any[] = [];
      const incomplete: any[] = [];
      let nairaSum = 0;
      let coinSum = 0;

      for (const u of usersWithCoins) {
        const coins = u.goCoins || 0;
        if (coins <= 0) continue;

        const isVerified = u.verificationStatus === 'verified';
        const hasBank = Boolean(
          u.bankDetails?.bankName &&
            u.bankDetails?.accountNumber &&
            u.bankDetails?.accountName
        );

        const nairaEquivalent = Math.round(
          (coins / 500) * (campaignConfig.nairaPer500Coins || 500)
        );

        const enriched = {
          ...u,
          nairaEquivalent,
          isVerified,
          hasBank,
        };

        if (isVerified && hasBank) {
          qualified.push(enriched);
          nairaSum += nairaEquivalent;
          coinSum += coins;
        } else {
          incomplete.push(enriched);
        }
      }

      return {
        qualifiedPaydayUsers: qualified,
        incompletePaydayUsers: incomplete,
        totalQualifiedNaira: nairaSum,
        totalQualifiedCoins: coinSum,
      };
    }, [usersWithCoins, campaignConfig.nairaPer500Coins]);

  if (authLoading) {
    return (
      <div className="animate-fade-up text-center py-20 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-gouni-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-neutral-500 font-medium">Verifying administrator access...</p>
      </div>
    );
  }

  if (!profile?.isAdmin) {
    return (
      <div className="animate-fade-up text-center py-20">
        <Shield className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-neutral-900 mb-1">
          Admin Access Required
        </h2>
        <p className="text-[13px] text-neutral-400">
          You don&apos;t have permission to view this page.
        </p>
      </div>
    );
  }

  const openLightbox = (images: string[], index: number, caption: string) => {
    setLightboxImages(images);
    setLightboxIndex(index);
    setLightboxCaption(caption);
  };

  // ── Exam Paper handlers ──

  const handleSelectWinner = async (paper: ExamPaperSubmission) => {
    setPaperProcessingId(paper.id);
    try {
      await selectCoursePaperWinner(
        paper.id,
        paper.courseCode,
        paper.authorUid,
        campaignConfig.rewardPerPaper || 500
      );
      toast(
        `🏆 Selected ${paper.displayName}'s upload as winner for ${paper.courseCode} (+${campaignConfig.rewardPerPaper} GC)!`,
        'success'
      );
    } catch (err: any) {
      console.error('Failed to select winner:', err);
      toast(err?.message || 'Failed to select winner.', 'error');
    } finally {
      setPaperProcessingId(null);
    }
  };

  const handleRejectPaper = async (paper: ExamPaperSubmission) => {
    setPaperProcessingId(paper.id);
    try {
      await rejectCoursePaper(
        paper.id,
        paperRejectReason.trim() ||
          'Photo was blurry or unreadable. Slot reopened for a clearer scan.',
        paper.courseCode,
        paper.authorUid
      );
      toast(
        `Rejected ${paper.displayName}'s ${paper.courseCode} upload and reopened the slot.`,
        'info'
      );
    } catch (err: any) {
      console.error('Failed to reject paper:', err);
      toast(err?.message || 'Failed to reject paper.', 'error');
    } finally {
      setPaperProcessingId(null);
      setPaperRejectId(null);
      setPaperRejectReason('');
    }
  };

  // ── Student ID Verification handlers ──

  const handleVerifyStudent = async (uid: string, name: string) => {
    setVerifyProcessingUid(uid);
    try {
      await updateStudentVerification(uid, 'verified');
      toast(`✅ Verified ${name}'s Student ID!`, 'success');
    } catch (err) {
      console.error('Failed to verify student ID:', err);
      toast('Failed to verify student ID.', 'error');
    } finally {
      setVerifyProcessingUid(null);
    }
  };

  const handleRejectStudentId = async (uid: string, name: string) => {
    setVerifyProcessingUid(uid);
    try {
      await updateStudentVerification(
        uid,
        'rejected',
        verifyRejectReason.trim() ||
          'Please upload a clearer photo of your GoUni Student ID card.'
      );
      toast(`Rejected ${name}'s ID card verification.`, 'info');
    } catch (err) {
      console.error('Failed to reject student ID:', err);
      toast('Failed to reject student ID.', 'error');
    } finally {
      setVerifyProcessingUid(null);
      setVerifyRejectUid(null);
      setVerifyRejectReason('');
    }
  };

  // ── Campaign Config & Payday handlers ──

  const handleSaveCampaignConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedRate = Number(editNairaRate);
    const parsedReward = Number(editRewardPerPaper);
    if (Number.isNaN(parsedRate) || parsedRate <= 0) {
      toast('Please enter a valid Naira exchange rate.', 'error');
      return;
    }
    if (Number.isNaN(parsedReward) || parsedReward <= 0) {
      toast('Please enter a valid GoCoins reward per paper.', 'error');
      return;
    }

    const parsedPayday = editPaydayDate ? new Date(editPaydayDate) : null;
    if (parsedPayday && Number.isNaN(parsedPayday.getTime())) {
      toast('Please enter a valid Payday date and time.', 'error');
      return;
    }

    setSavingConfig(true);
    try {
      const paydayIso = parsedPayday
        ? parsedPayday.toISOString()
        : campaignConfig.paydayDate;

      const updates = {
        title: editTitle.trim() || DEFAULT_CAMPAIGN_CONFIG.title,
        description:
          editDescription.trim() || DEFAULT_CAMPAIGN_CONFIG.description,
        nairaPer500Coins: parsedRate,
        rewardPerPaper: parsedReward,
        paydayDate: paydayIso,
        isActive: editIsActive,
      };

      await updateCampaignConfig(updates, profile.uid);
      setCampaignConfig((prev) => ({ ...prev, ...updates }));
      setIsConfigDirty(false);
      toast('Campaign settings & Payday countdown updated!', 'success');
    } catch (err) {
      console.error('Failed to update campaign config:', err);
      toast('Failed to save campaign settings.', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleMarkPaid = async (student: any) => {
    setPayingStudentUid(student.uid);
    try {
      await markStudentAsPaid(
        student.uid,
        profile.uid,
        student.goCoins,
        student.nairaEquivalent,
        student.bankDetails,
        campaignConfig.seasonNumber || 1
      );
      toast(
        `💸 Marked ${student.displayName} as paid (₦${student.nairaEquivalent.toLocaleString()})!`,
        'success'
      );
      setConfirmPayUid(null);
    } catch (err: any) {
      console.error('Failed to mark student paid:', err);
      toast(err?.message || 'Failed to record payout.', 'error');
    } finally {
      setPayingStudentUid(null);
    }
  };

  const handleCopyRosterCsv = () => {
    if (qualifiedPaydayUsers.length === 0) return;
    const header =
      'Student Name,Email,GoCoins,Naira Amount,Bank Name,Account Number,Account Name';
    const rows = qualifiedPaydayUsers.map(
      (u) =>
        `"${u.displayName || 'Student'}","${u.email || ''}",${u.goCoins},${
          u.nairaEquivalent
        },"${u.bankDetails?.bankName || ''}","${
          u.bankDetails?.accountNumber || ''
        }","${u.bankDetails?.accountName || ''}"`
    );
    navigator.clipboard.writeText([header, ...rows].join('\n'));
    toast('Copied Qualified Payday Roster CSV to clipboard!', 'success');
  };

  // ── Project handlers ──

  const handleApprove = async (project: Project) => {
    setProcessing(project.id);
    try {
      await approveProject(project.id);
      toast('Project approved!', 'success');
    } catch (err) {
      console.error('Failed to approve:', err);
      toast('Failed to approve project.', 'error');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (projectId: string) => {
    setProcessing(projectId);
    try {
      await rejectProject(projectId, rejectReason);
      toast('Project rejected.', 'info');
    } catch (err) {
      console.error('Failed to reject:', err);
      toast('Failed to reject project.', 'error');
    } finally {
      setProcessing(null);
      setRejectId(null);
      setRejectReason('');
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!confirm('Permanently delete this project? This cannot be undone.'))
      return;
    setProcessing(projectId);
    try {
      await deleteProject(projectId, profile!.uid);
      toast('Project deleted.', 'success');
    } catch (err) {
      console.error('Failed to delete:', err);
      toast('Failed to delete project.', 'error');
    } finally {
      setProcessing(null);
    }
  };

  const handleResetDatabase = async () => {
    setProcessing('reset');
    try {
      await resetDatabase();
      toast(
        'Database reset complete. All projects, votes, and comments cleared.',
        'success'
      );
      setShowResetConfirm(false);
      setPendingProjects([]);
    } catch (err) {
      console.error('Reset failed:', err);
      toast('Failed to reset database.', 'error');
    } finally {
      setProcessing(null);
    }
  };

  // ── Writing handlers ──

  const handleApproveWriting = async (writing: Writing) => {
    setLitProcessing(writing.id);
    try {
      await approveWriting(writing.id);
      toast('Writing approved!', 'success');
    } catch (err) {
      console.error('Failed to approve writing:', err);
      toast('Failed to approve writing.', 'error');
    } finally {
      setLitProcessing(null);
    }
  };

  const handleRejectWriting = async (writingId: string) => {
    setLitProcessing(writingId);
    try {
      await rejectWriting(writingId, litRejectReason);
      toast('Writing rejected.', 'info');
    } catch (err) {
      console.error('Failed to reject writing:', err);
      toast('Failed to reject writing.', 'error');
    } finally {
      setLitProcessing(null);
      setLitRejectId(null);
      setLitRejectReason('');
    }
  };

  const handleDeleteWriting = async (writingId: string) => {
    if (!confirm('Permanently delete this writing? This cannot be undone.'))
      return;
    setLitProcessing(writingId);
    try {
      await deleteWriting(writingId, profile!.uid);
      toast('Writing deleted.', 'success');
    } catch (err) {
      console.error('Failed to delete writing:', err);
      toast('Failed to delete writing.', 'error');
    } finally {
      setLitProcessing(null);
    }
  };

  const handleApproveCampaignSub = async (submissionId: string) => {
    if (!profile) return;
    setCampaignProcessingId(submissionId);
    try {
      await approveCampaignSubmission(submissionId, profile.uid);
      toast('Campaign submission approved! (+50 XP awarded)', 'success');
    } catch (err: any) {
      toast(err?.message || 'Failed to approve submission', 'error');
    } finally {
      setCampaignProcessingId(null);
    }
  };

  const handleRejectCampaignSub = async (submissionId: string) => {
    if (!profile) return;
    setCampaignProcessingId(submissionId);
    try {
      await rejectCampaignSubmission(submissionId, profile.uid, campaignRejectReason);
      toast('Campaign submission rejected.', 'success');
      setCampaignRejectId(null);
      setCampaignRejectReason('');
    } catch (err: any) {
      toast(err?.message || 'Failed to reject submission', 'error');
    } finally {
      setCampaignProcessingId(null);
    }
  };

  const handleCrownCampaignWinner = async (submissionId: string) => {
    if (!profile) return;
    setCampaignProcessingId(submissionId);
    try {
      await markCampaignSubmissionWinner(submissionId, profile.uid);
      toast('🏆 Crowned as GoUni Prayer Book Redesign Winner!', 'success');
    } catch (err: any) {
      toast(err?.message || 'Failed to mark winner', 'error');
    } finally {
      setCampaignProcessingId(null);
    }
  };

  const pendingCampaignCount = campaignSubmissions.filter(
    (s) => s.status === 'pending'
  ).length;
  const pendingPaperCount = examPapers.filter(
    (p) => p.status === 'pending'
  ).length;
  const totalPending =
    pendingCampaignCount +
    pendingPaperCount +
    pendingVerifications.length +
    pendingProjects.length +
    pendingWritings.length;

  return (
    <div className="animate-fade-up">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors mb-8 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to projects
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-amber-100 dark:bg-amber-950/60 rounded-2xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-amber-700 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
              Admin Command & Campaign Center
            </h1>
            <p className="text-[13px] text-neutral-400 dark:text-neutral-500">
              {totalPending} item{totalPending !== 1 ? 's' : ''} awaiting admin
              action across queues
            </p>
          </div>
        </div>

        {/* Live Exchange Rate Summary Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-xs font-bold text-amber-900 dark:text-amber-300 w-fit">
          <Coins className="w-4 h-4 text-amber-500" />
          <span>
            500 GC = ₦{campaignConfig.nairaPer500Coins.toLocaleString()}
          </span>
          <span className="text-amber-300 dark:text-amber-600">•</span>
          <span>
            Payday:{' '}
            {new Date(campaignConfig.paydayDate).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex flex-wrap items-center gap-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-1.5 rounded-2xl mb-6 w-fit">
        <button
          onClick={() => setActiveTab('design-campaign')}
          className={`flex items-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === 'design-campaign'
              ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          Prayer Book Campaign
          {pendingCampaignCount > 0 && (
            <span
              className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'design-campaign'
                  ? 'bg-amber-400 text-neutral-950'
                  : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
              }`}
            >
              {pendingCampaignCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('exam-papers')}
          className={`flex items-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === 'exam-papers'
              ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Exam Papers
          {pendingPaperCount > 0 && (
            <span
              className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'exam-papers'
                  ? 'bg-amber-400 text-neutral-950'
                  : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
              }`}
            >
              {pendingPaperCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('id-verification')}
          className={`flex items-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === 'id-verification'
              ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <BadgeCheck className="w-3.5 h-3.5" />
          ID Verification
          {pendingVerifications.length > 0 && (
            <span
              className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'id-verification'
                  ? 'bg-amber-400 text-neutral-950'
                  : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
              }`}
            >
              {pendingVerifications.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('payday')}
          className={`flex items-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === 'payday'
              ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Coins className="w-3.5 h-3.5" />
          Payday & Economy
          {qualifiedPaydayUsers.length > 0 && (
            <span
              className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'payday'
                  ? 'bg-emerald-400 text-neutral-950'
                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
              }`}
            >
              {qualifiedPaydayUsers.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('projects')}
          className={`flex items-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === 'projects'
              ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Projects
          {pendingProjects.length > 0 && (
            <span
              className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'projects'
                  ? 'bg-white/20 dark:bg-neutral-900/20 text-white dark:text-neutral-900'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
              }`}
            >
              {pendingProjects.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('literature')}
          className={`flex items-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === 'literature'
              ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          Literature
          {pendingWritings.length > 0 && (
            <span
              className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'literature'
                  ? 'bg-white/20 dark:bg-neutral-900/20 text-white dark:text-neutral-900'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
              }`}
            >
              {pendingWritings.length}
            </span>
          )}
        </button>
      </div>

      {/* =====================================================================
          TAB 0: GOUNI PRAYER BOOK REDESIGN CAMPAIGN SUBMISSIONS
         ===================================================================== */}
      {activeTab === 'design-campaign' && (
        <div className="space-y-4">
          {campaignSubmissions.length === 0 ? (
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-10 text-center space-y-2">
              <Trophy className="w-8 h-8 text-amber-500 mx-auto" />
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                No GoUni Prayer Book Redesign Submissions Yet
              </h3>
              <p className="text-xs text-neutral-500">
                Entries submitted by qualified (100+ XP) students will appear here for review.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campaignSubmissions.map((sub) => (
                <div
                  key={sub.id}
                  className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 flex flex-col justify-between gap-4 shadow-xs"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold text-neutral-900 dark:text-white">
                          {sub.displayName}
                          {sub.teamSize === 'duo' && sub.partnerUsername
                            ? ` & @${sub.partnerUsername}`
                            : ''}
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          {sub.teamSize === 'duo' ? 'Duo Team' : 'Solo Entry'} • {formatDate(sub.createdAt)} • {sub.likes} votes
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          sub.status === 'winner'
                            ? 'bg-amber-400 text-neutral-950'
                            : sub.status === 'approved'
                            ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                            : sub.status === 'rejected'
                            ? 'bg-red-500/20 text-red-700 dark:text-red-300'
                            : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {sub.status}
                      </span>
                    </div>

                    <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                      {sub.pitchSummary}
                    </p>

                    {sub.screenshots && sub.screenshots.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {sub.screenshots.map((imgUrl, idx) => (
                          <button
                            key={imgUrl}
                            type="button"
                            onClick={() => {
                              setLightboxImages(sub.screenshots);
                              setLightboxIndex(idx);
                              setLightboxCaption(`${sub.displayName} — GoUni Prayer Book Redesign`);
                            }}
                            className="w-20 h-16 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 shrink-0 cursor-pointer"
                          >
                            <img src={imgUrl} alt="Mockup" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <a
                        href={sub.figmaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 text-xs font-bold inline-flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Inspect Figma
                      </a>
                      <a
                        href={sub.repoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 text-xs font-bold inline-flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Inspect GitHub README Pitch
                      </a>
                    </div>
                  </div>

                  {/* Admin Actions */}
                  <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
                    {campaignRejectId === sub.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={campaignRejectReason}
                          onChange={(e) => setCampaignRejectReason(e.target.value)}
                          placeholder="Reason for rejection..."
                          className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setCampaignRejectId(null);
                              setCampaignRejectReason('');
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleRejectCampaignSub(sub.id)}
                            isLoading={campaignProcessingId === sub.id}
                          >
                            Confirm Reject
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        {sub.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleApproveCampaignSub(sub.id)}
                            isLoading={campaignProcessingId === sub.id}
                          >
                            <Check className="w-3.5 h-3.5 mr-1" /> Approve (+50 XP)
                          </Button>
                        )}
                        {sub.status === 'approved' && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleCrownCampaignWinner(sub.id)}
                            isLoading={campaignProcessingId === sub.id}
                          >
                            <Trophy className="w-3.5 h-3.5 mr-1" /> Crown Winner
                          </Button>
                        )}
                        {sub.status !== 'rejected' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCampaignRejectId(sub.id)}
                          >
                            <X className="w-3.5 h-3.5 mr-1" /> Reject
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 1: COURSE-GROUPED EXAM PAPER REVIEW (5-SLOT COMPARISON)
         ===================================================================== */}
      {activeTab === 'exam-papers' && (
        <div className="space-y-6">
          {/* Controls bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800">
            <div className="relative flex-grow max-w-md">
              <Search className="w-4 h-4 text-neutral-400 dark:text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={paperSearch}
                onChange={(e) => setPaperSearch(e.target.value)}
                placeholder="Filter by course code, title, or student name..."
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl w-fit">
              {(
                [
                  { id: 'pending', label: 'Needs Winner Review' },
                  { id: 'decided', label: 'Collected / Decided' },
                  { id: 'all', label: 'All Courses' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setPaperFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    paperFilter === f.id
                      ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-2xs'
                      : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {courseGroups.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
              <FileText className="w-10 h-10 text-neutral-200 dark:text-neutral-700 mx-auto mb-3" />
              <p className="text-[14px] font-medium text-neutral-900 dark:text-white mb-1">
                No exam paper courses in this view
              </p>
              <p className="text-[13px] text-neutral-400 dark:text-neutral-500">
                When students upload exam question papers, they will appear
                grouped by course code here for 5-slot comparison.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {courseGroups.map((group) => (
                <div
                  key={group.courseCode}
                  className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-2xs"
                >
                  {/* Course Group Header */}
                  <div className="px-6 py-4 bg-neutral-900 dark:bg-neutral-950 text-white flex flex-wrap items-center justify-between gap-3 border-b border-transparent dark:border-neutral-800">
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-base font-black tracking-tight text-amber-400">
                          {group.courseCode}
                        </span>
                        <span className="text-sm font-bold text-white">
                          {group.courseTitle}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-md bg-white/10 text-xs font-semibold text-neutral-200">
                          {group.level}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Compare candidates below by{' '}
                        <strong className="text-neutral-200">
                          1) Upload Timestamp
                        </strong>{' '}
                        and{' '}
                        <strong className="text-neutral-200">
                          2) Lighting & Readability
                        </strong>
                        . Selecting 1 winner awards +{campaignConfig.rewardPerPaper}{' '}
                        GC and closes remaining slots.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {group.hasWinner ? (
                        <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1.5">
                          <Trophy className="w-3.5 h-3.5 text-emerald-400" />
                          Winner Chosen
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                          {group.submissions.length} /{' '}
                          {campaignConfig.maxSubmissionsPerCourse || 5}{' '}
                          Submissions
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Side-by-side Candidate Cards */}
                  <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {group.submissions.map((paper, idx) => {
                      const isEarliest = idx === 0;
                      return (
                        <div
                          key={paper.id}
                          className={`rounded-2xl border p-4 flex flex-col justify-between gap-4 transition-all ${
                            paper.status === 'approved'
                              ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 ring-2 ring-emerald-500/20'
                              : paper.status === 'pending'
                              ? 'bg-white dark:bg-neutral-800/70 border-neutral-200 dark:border-neutral-700'
                              : 'bg-neutral-50/70 dark:bg-neutral-900/60 border-neutral-200 dark:border-neutral-800 opacity-75'
                          }`}
                        >
                          <div className="space-y-3">
                            {/* Candidate Header: Slot, Timestamp & Earliest Badge */}
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="px-2 py-0.5 rounded-md bg-neutral-900 dark:bg-neutral-700 text-white text-[11px] font-extrabold">
                                    Slot #{paper.slotNumber || idx + 1}
                                  </span>
                                  {isEarliest && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 text-[10px] font-extrabold">
                                      <Zap className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                      Fastest Upload
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm font-bold text-neutral-900 dark:text-white mt-1.5">
                                  {paper.displayName}
                                </div>
                                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1 mt-0.5">
                                  <Clock className="w-3 h-3 text-neutral-400 dark:text-neutral-500" />
                                  {new Date(paper.createdAt).toLocaleDateString()}{' '}
                                  at{' '}
                                  <strong className="text-neutral-700 dark:text-neutral-300">
                                    {new Date(
                                      paper.createdAt
                                    ).toLocaleTimeString()}
                                  </strong>
                                </div>
                              </div>

                              {/* Status Pill */}
                              {paper.status === 'approved' && (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                                <Trophy className="w-3 h-3" />
                                Winner
                              </span>
                            )}
                            {paper.status === 'not_selected' && (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                                <Lock className="w-3 h-3" />
                                Closed
                              </span>
                            )}
                            {paper.status === 'rejected' && (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400">
                                Rejected
                              </span>
                            )}
                          </div>

                          {/* Page Thumbnails (Click to inspect lighting & readability) */}
                          <div>
                            <div className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">
                              {paper.imageUrls.length} Page
                              {paper.imageUrls.length !== 1 ? 's' : ''} — Click
                              to Inspect Readability
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {paper.imageUrls.map((url, pageIdx) => (
                                <button
                                  type="button"
                                  key={pageIdx}
                                  onClick={() =>
                                    openLightbox(
                                      paper.imageUrls,
                                      pageIdx,
                                      `${paper.courseCode} • ${paper.displayName} (Slot #${paper.slotNumber}) — Page ${pageIdx + 1} of ${paper.imageUrls.length}`
                                    )
                                  }
                                  className="relative aspect-[3/4] rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700 group bg-neutral-100 dark:bg-neutral-800 cursor-pointer"
                                >
                                  <img
                                    src={url}
                                    alt={`Page ${pageIdx + 1}`}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                  />
                                  <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/75 text-white text-[9px] font-extrabold">
                                    P{pageIdx + 1}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {paper.rejectionReason && (
                            <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-800 dark:text-red-300">
                              <strong>Rejection note:</strong>{' '}
                              {paper.rejectionReason}
                            </div>
                          )}
                        </div>

                        {/* Candidate Action Buttons */}
                        {paper.status === 'pending' && !group.hasWinner && (
                          <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
                            {paperRejectId === paper.id ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={paperRejectReason}
                                  onChange={(e) =>
                                    setPaperRejectReason(e.target.value)
                                  }
                                  placeholder="Reason (e.g. Page 2 is blurry, bad lighting)..."
                                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-xs"
                                />
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    className="rounded-xl bg-red-600 hover:bg-red-700 text-xs flex-1"
                                    onClick={() => handleRejectPaper(paper)}
                                    isLoading={paperProcessingId === paper.id}
                                  >
                                    Confirm Reject & Reopen Slot
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="rounded-xl text-xs"
                                    onClick={() => {
                                      setPaperRejectId(null);
                                      setPaperRejectReason('');
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="primary"
                                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs flex-1"
                                  onClick={() => handleSelectWinner(paper)}
                                  isLoading={paperProcessingId === paper.id}
                                >
                                  <Trophy className="w-3.5 h-3.5" />
                                  Pick Winner (+
                                  {campaignConfig.rewardPerPaper} GC)
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-xl text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs"
                                  onClick={() => setPaperRejectId(paper.id)}
                                >
                                  <X className="w-3.5 h-3.5" />
                                  Reject
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )}

      {/* =====================================================================
          TAB 2: ANTI-SMURF STUDENT ID VERIFICATION QUEUE
         ===================================================================== */}
      {activeTab === 'id-verification' && (
        <div className="space-y-4">
          {pendingVerifications.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
              <BadgeCheck className="w-10 h-10 text-neutral-200 dark:text-neutral-700 mx-auto mb-3" />
              <p className="text-[14px] font-medium text-neutral-900 dark:text-white mb-1">
                No pending Student ID verifications
              </p>
              <p className="text-[13px] text-neutral-400 dark:text-neutral-500">
                When students upload their GoUni Student ID card to qualify for
                Payday, they will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingVerifications.map((student) => (
                <div
                  key={student.uid}
                  className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {student.photoURL ? (
                          <img
                            src={student.photoURL}
                            alt=""
                            className="w-11 h-11 rounded-full object-cover border border-neutral-200 dark:border-neutral-700"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 font-bold flex items-center justify-center">
                            {(student.displayName || 'S')
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                            {student.displayName || 'Student'}
                          </div>
                          <div className="text-xs text-neutral-400 dark:text-neutral-500 truncate">
                            {student.email}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {student.department && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                                {student.department}
                              </span>
                            )}
                            {student.academicLevel && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                                {student.academicLevel}
                              </span>
                            )}
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60">
                              {(student.goCoins || 0).toLocaleString()} GC
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Student ID Card Photo */}
                    {student.studentIdCardUrl ? (
                      <div>
                        <div className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">
                          Uploaded GoUni Student ID Card (Click to Zoom)
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            openLightbox(
                              [student.studentIdCardUrl],
                              0,
                              `Student ID Card — ${student.displayName} (${student.email})`
                            )
                          }
                          className="w-full h-48 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 relative group cursor-pointer"
                        >
                          <img
                            src={student.studentIdCardUrl}
                            alt="Student ID Card"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <span className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-black/75 text-white text-[11px] font-bold">
                            Inspect Full Size
                          </span>
                        </button>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs">
                        No ID card image URL found on this profile.
                      </div>
                    )}
                  </div>

                  {/* Approve / Reject Controls */}
                  <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800">
                    {verifyRejectUid === student.uid ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={verifyRejectReason}
                          onChange={(e) =>
                            setVerifyRejectReason(e.target.value)
                          }
                          placeholder="Reason for rejecting ID card (e.g. Name/photo blurry)..."
                          className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-xs"
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="primary"
                            className="rounded-xl bg-red-600 hover:bg-red-700 text-xs flex-1"
                            onClick={() =>
                              handleRejectStudentId(
                                student.uid,
                                student.displayName || 'Student'
                              )
                            }
                            isLoading={verifyProcessingUid === student.uid}
                          >
                            Confirm Reject
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-xl text-xs"
                            onClick={() => {
                              setVerifyRejectUid(null);
                              setVerifyRejectReason('');
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs flex-1"
                          onClick={() =>
                            handleVerifyStudent(
                              student.uid,
                              student.displayName || 'Student'
                            )
                          }
                          isLoading={verifyProcessingUid === student.uid}
                        >
                          <Check className="w-3.5 h-3.5" />
                          Verify Student ID
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs"
                          onClick={() => setVerifyRejectUid(student.uid)}
                        >
                          <X className="w-3.5 h-3.5" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 3: PAYDAY ROSTER & CAMPAIGN ECONOMY SETTINGS
         ===================================================================== */}
      {activeTab === 'payday' && (
        <div className="space-y-8">
          {/* 1. Campaign Economy & Payday Countdown Settings */}
          <form
            onSubmit={handleSaveCampaignConfig}
            className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 p-6 space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 dark:border-neutral-800 pb-4">
              <div>
                <h2 className="text-base font-extrabold text-neutral-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Season {campaignConfig.seasonNumber} Economy & Payday
                  Configuration
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Adjust the live GoCoins-to-Naira exchange rate, reward per
                  paper, and the Payday countdown timer shown on the homepage.
                </p>
              </div>

              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editIsActive}
                  onChange={(e) => {
                    setEditIsActive(e.target.checked);
                    setIsConfigDirty(true);
                  }}
                  className="rounded border-neutral-300 dark:border-neutral-600 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                  Campaign Banner Active
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
                  Exchange Rate (₦ per 500 GoCoins)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-neutral-400 dark:text-neutral-500">
                    ₦
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={editNairaRate}
                    onChange={(e) => {
                      setEditNairaRate(e.target.value);
                      setIsConfigDirty(true);
                    }}
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
                  Reward per Winning Paper (GC)
                </label>
                <input
                  type="number"
                  min={50}
                  step={50}
                  value={editRewardPerPaper}
                  onChange={(e) => {
                    setEditRewardPerPaper(e.target.value);
                    setIsConfigDirty(true);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                    Payday Date & Time
                  </label>
                  <div className="flex items-center gap-1">
                    {[3, 7, 14].map((days) => (
                      <button
                        type="button"
                        key={days}
                        onClick={() => {
                          const target = new Date(
                            Date.now() + days * 24 * 60 * 60 * 1000
                          ).toISOString();
                          setEditPaydayDate(isoToDatetimeLocal(target));
                          setIsConfigDirty(true);
                        }}
                        className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-[10px] font-bold text-neutral-600 dark:text-neutral-300 cursor-pointer"
                      >
                        +{days}d
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="datetime-local"
                  value={editPaydayDate}
                  onChange={(e) => {
                    setEditPaydayDate(e.target.value);
                    setIsConfigDirty(true);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
                  Banner Headline
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => {
                    setEditTitle(e.target.value);
                    setIsConfigDirty(true);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
                  Banner Description
                </label>
                <input
                  type="text"
                  value={editDescription}
                  onChange={(e) => {
                    setEditDescription(e.target.value);
                    setIsConfigDirty(true);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                className="rounded-xl"
                isLoading={savingConfig}
              >
                Save Campaign Settings
              </Button>
            </div>
          </form>

          {/* 2. Qualified Payday Roster */}
          <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
            <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-neutral-900 dark:text-white">
                    Qualified Payday Roster
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    {qualifiedPaydayUsers.length} Ready to Pay
                  </span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Students below have <strong>GoCoins &gt; 0</strong>, a{' '}
                  <strong>Verified Student ID</strong>, and saved{' '}
                  <strong>Bank Account Details</strong>.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-xs">
                  <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                    Total Payout:{' '}
                  </span>
                  <strong className="text-emerald-950 dark:text-emerald-100 font-black">
                    ₦{totalQualifiedNaira.toLocaleString()}
                  </strong>{' '}
                  <span className="text-emerald-700 dark:text-emerald-300">
                    ({totalQualifiedCoins.toLocaleString()} GC)
                  </span>
                </div>

                {qualifiedPaydayUsers.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-xs"
                    onClick={handleCopyRosterCsv}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy CSV
                  </Button>
                )}
              </div>
            </div>

            {qualifiedPaydayUsers.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle2 className="w-10 h-10 text-neutral-200 dark:text-neutral-700 mx-auto mb-2" />
                <div className="text-sm font-bold text-neutral-900 dark:text-white">
                  No students currently waiting in the Qualified Payday Roster
                </div>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                  Once verified students earn GoCoins and save their bank
                  details, they will automatically appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {qualifiedPaydayUsers.map((student) => (
                  <div
                    key={student.uid}
                    className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-extrabold text-neutral-900 dark:text-white">
                          {student.displayName || 'Student'}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <BadgeCheck className="w-3 h-3" />
                          Verified ID
                        </span>
                        <span className="text-xs text-neutral-400 dark:text-neutral-500">
                          {student.email}
                        </span>
                      </div>

                      {/* Bank Details Pill */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 pt-1">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 font-semibold">
                          <Building2 className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
                          {student.bankDetails.bankName}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              student.bankDetails.accountNumber
                            );
                            toast(
                              `Copied account number ${student.bankDetails.accountNumber}`,
                              'info'
                            );
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-300 font-mono font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer"
                          title="Click to copy account number"
                        >
                          {student.bankDetails.accountNumber}
                          <Copy className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        </button>
                        <span className="font-semibold text-neutral-600 dark:text-neutral-400 uppercase">
                          {student.bankDetails.accountName}
                        </span>
                      </div>
                    </div>

                    {/* Amount & Mark Paid Action */}
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="text-right">
                        <div className="text-base font-black text-emerald-700 dark:text-emerald-400">
                          ₦{student.nairaEquivalent.toLocaleString()}
                        </div>
                        <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                          {student.goCoins.toLocaleString()} GoCoins
                        </div>
                      </div>

                      {confirmPayUid === student.uid ? (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="primary"
                            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs"
                            onClick={() => handleMarkPaid(student)}
                            isLoading={payingStudentUid === student.uid}
                          >
                            Confirm Paid ₦
                            {student.nairaEquivalent.toLocaleString()}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-xl text-xs"
                            onClick={() => setConfirmPayUid(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="primary"
                          className="rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 text-xs"
                          onClick={() => setConfirmPayUid(student.uid)}
                        >
                          <Check className="w-3.5 h-3.5" />
                          Mark Paid
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Students with Coins but Incomplete Payday Setup */}
          {incompletePaydayUsers.length > 0 && (
            <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
              <div className="p-5 border-b border-neutral-100 dark:border-neutral-800">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  Earned GoCoins — Awaiting ID Verification or Bank Details (
                  {incompletePaydayUsers.length})
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  These students have GoCoins &gt; 0 but must finish their
                  Payday Readiness Checklist before they move to the Qualified
                  Payday Roster.
                </p>
              </div>
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {incompletePaydayUsers.map((u) => (
                  <div
                    key={u.uid}
                    className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <span className="font-bold text-neutral-900 dark:text-white">
                        {u.displayName || 'Student'}
                      </span>{' '}
                      <span className="text-neutral-400 dark:text-neutral-500">({u.email})</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg">
                        {u.goCoins.toLocaleString()} GC (₦
                        {u.nairaEquivalent.toLocaleString()})
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-lg font-semibold ${
                          u.isVerified
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                            : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400'
                        }`}
                      >
                        {u.isVerified
                          ? '✓ ID Verified'
                          : `✗ ID: ${u.verificationStatus || 'unverified'}`}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-lg font-semibold ${
                          u.hasBank
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                            : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400'
                        }`}
                      >
                        {u.hasBank ? '✓ Bank Saved' : '✗ Missing Bank Details'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Payout Audit History */}
          {payoutHistory.length > 0 && (
            <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
              <div className="p-5 border-b border-neutral-100 dark:border-neutral-800">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                  Recent Payday Payout History
                </h3>
              </div>
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {payoutHistory.map((record) => (
                  <div
                    key={record.id}
                    className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <span className="font-bold text-neutral-900 dark:text-white">
                        {record.displayName}
                      </span>
                      <span className="text-neutral-400 dark:text-neutral-500 ml-2">
                        {record.bankDetails?.bankName} •{' '}
                        {record.bankDetails?.accountNumber} (
                        {record.bankDetails?.accountName})
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-extrabold text-emerald-700 dark:text-emerald-400">
                        ₦{record.nairaAmount.toLocaleString()} (
                        {record.coinsPaid.toLocaleString()} GC)
                      </span>
                      <span className="text-neutral-400 dark:text-neutral-500">
                        {new Date(record.paidAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 4: PROJECTS QUEUE
         ===================================================================== */}
      {activeTab === 'projects' && (
        <>
          <div className="mb-6 flex justify-end">
            <Button
              onClick={() => setShowResetConfirm(true)}
              size="sm"
              variant="outline"
              className="rounded-xl text-red-700 dark:text-red-400 border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Database
            </Button>
          </div>

          {pendingProjects.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
              <Clock className="w-10 h-10 text-neutral-200 dark:text-neutral-700 mx-auto mb-3" />
              <p className="text-[14px] font-medium text-neutral-900 dark:text-white mb-1">
                All caught up
              </p>
              <p className="text-[13px] text-neutral-400 dark:text-neutral-500">
                No pending project submissions to review.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingProjects.map((project) => (
                <div
                  key={project.id}
                  className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden"
                >
                  <div className="flex gap-4 p-5">
                    <div
                      className="w-24 h-18 rounded-xl bg-neutral-100 dark:bg-neutral-800 overflow-hidden shrink-0 cursor-pointer"
                      onClick={() => onProjectClick(project)}
                    >
                      <img
                        src={project.imageUrl || undefined}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3
                          className="text-[15px] font-semibold text-neutral-900 dark:text-white truncate cursor-pointer hover:text-gouni-primary transition-colors"
                          onClick={() => onProjectClick(project)}
                        >
                          {project.title}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            STATUS_CONFIG[project.status].color
                          }`}
                        >
                          {STATUS_CONFIG[project.status].label}
                        </span>
                      </div>
                      <p className="text-[13px] text-neutral-500 dark:text-neutral-400 line-clamp-2 mb-2">
                        {project.description}
                      </p>
                      <div className="flex items-center gap-3 text-[12px] text-neutral-400 dark:text-neutral-500">
                        <span className="font-medium text-neutral-600 dark:text-neutral-300">
                          {project.displayName || project.studentName}
                        </span>
                        <span>{project.level}</span>
                        <span>{project.category}</span>
                        <span>{formatDate(project.datePosted)}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {project.techStack.map((t) => (
                          <span
                            key={t}
                            className="px-2 py-0.5 bg-neutral-50 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 text-[11px] rounded-md border border-neutral-100 dark:border-neutral-700"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {rejectId === project.id && (
                    <div className="px-5 pb-3">
                      <input
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Reason for rejection (optional)..."
                        className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 rounded-xl text-sm mb-2"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2 px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-100 dark:border-neutral-800">
                    {rejectId === project.id ? (
                      <>
                        <Button
                          size="sm"
                          variant="primary"
                          className="rounded-xl bg-red-600 hover:bg-red-700"
                          onClick={() => handleReject(project.id)}
                          isLoading={processing === project.id}
                        >
                          Confirm Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-xl"
                          onClick={() => setRejectId(null)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="primary"
                          className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => handleApprove(project)}
                          isLoading={processing === project.id}
                        >
                          <Check className="w-3.5 h-3.5" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30"
                          onClick={() => setRejectId(project.id)}
                        >
                          <X className="w-3.5 h-3.5" /> Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl text-red-700 dark:text-red-400 border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30"
                          onClick={() => handleDelete(project.id)}
                          isLoading={processing === project.id}
                        >
                          <Trash className="w-3.5 h-3.5" /> Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* =====================================================================
          TAB 5: LITERATURE QUEUE
         ===================================================================== */}
      {activeTab === 'literature' && (
        <>
          {pendingWritings.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
              <Clock className="w-10 h-10 text-neutral-200 dark:text-neutral-700 mx-auto mb-3" />
              <p className="text-[14px] font-medium text-neutral-900 dark:text-white mb-1">
                All caught up
              </p>
              <p className="text-[13px] text-neutral-400 dark:text-neutral-500">
                No pending writing submissions to review.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingWritings.map((writing) => (
                <div
                  key={writing.id}
                  className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden"
                >
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-[15px] font-semibold text-neutral-900 dark:text-white truncate">
                        {writing.title}
                      </h3>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 capitalize">
                        {writing.genre.replace('-', ' ')}
                      </span>
                    </div>
                    <p className="text-[13px] text-neutral-500 dark:text-neutral-400 line-clamp-3 mb-2 font-serif whitespace-pre-line">
                      {writing.body}
                    </p>
                    <div className="flex items-center gap-3 text-[12px] text-neutral-400 dark:text-neutral-500">
                      <span className="font-medium text-neutral-600 dark:text-neutral-300">
                        {writing.displayName || 'Student'}
                      </span>
                      <span>
                        {writing.body.split(/\s+/).filter(Boolean).length} words
                      </span>
                      <span>{formatDate(writing.datePosted)}</span>
                    </div>
                  </div>

                  {litRejectId === writing.id && (
                    <div className="px-5 pb-3">
                      <input
                        value={litRejectReason}
                        onChange={(e) => setLitRejectReason(e.target.value)}
                        placeholder="Reason for rejection (optional)..."
                        className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 rounded-xl text-sm mb-2"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2 px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-100 dark:border-neutral-800">
                    {litRejectId === writing.id ? (
                      <>
                        <Button
                          size="sm"
                          variant="primary"
                          className="rounded-xl bg-red-600 hover:bg-red-700"
                          onClick={() => handleRejectWriting(writing.id)}
                          isLoading={litProcessing === writing.id}
                        >
                          Confirm Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-xl"
                          onClick={() => setLitRejectId(null)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="primary"
                          className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => handleApproveWriting(writing)}
                          isLoading={litProcessing === writing.id}
                        >
                          <Check className="w-3.5 h-3.5" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30"
                          onClick={() => setLitRejectId(writing.id)}
                        >
                          <X className="w-3.5 h-3.5" /> Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl text-red-700 dark:text-red-400 border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30"
                          onClick={() => handleDeleteWriting(writing.id)}
                          isLoading={litProcessing === writing.id}
                        >
                          <Trash className="w-3.5 h-3.5" /> Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Lightbox Modal for inspecting Exam Paper pages & Student ID Cards */}
      {lightboxImages.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setLightboxImages([])}
        >
          <div
            className="relative max-w-4xl w-full bg-neutral-950 rounded-3xl overflow-hidden border border-white/15 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 bg-black/60 text-white border-b border-white/10">
              <div className="text-xs sm:text-sm font-bold truncate pr-4">
                {lightboxCaption}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={lightboxImages[lightboxIndex]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white"
                >
                  Open Original <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxImages([])}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="relative flex items-center justify-center bg-neutral-900 min-h-[50vh] max-h-[80vh]">
              {lightboxImages.length > 1 && (
                <button
                  type="button"
                  disabled={lightboxIndex === 0}
                  onClick={() =>
                    setLightboxIndex((i) => Math.max(0, i - 1))
                  }
                  className="absolute left-4 p-2.5 rounded-full bg-black/70 hover:bg-black text-white disabled:opacity-30 cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}

              <img
                src={lightboxImages[lightboxIndex]}
                alt="Inspection view"
                className="max-h-[78vh] w-auto object-contain mx-auto"
              />

              {lightboxImages.length > 1 && (
                <button
                  type="button"
                  disabled={lightboxIndex === lightboxImages.length - 1}
                  onClick={() =>
                    setLightboxIndex((i) =>
                      Math.min(lightboxImages.length - 1, i + 1)
                    )
                  }
                  className="absolute right-4 p-2.5 rounded-full bg-black/70 hover:bg-black text-white disabled:opacity-30 cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reset Database Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowResetConfirm(false)}
          />
          <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-float w-full max-w-sm animate-fade-up border border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center justify-between p-6 border-b border-neutral-100 dark:border-neutral-800">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                Reset Database?
              </h2>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-neutral-400 dark:text-neutral-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl p-4">
                <p className="text-[13px] text-red-800 dark:text-red-300">
                  ⚠️ <strong>This action cannot be undone.</strong> This will
                  permanently delete all projects, votes, and comments. User
                  accounts will be preserved.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 px-4 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <Button
                  onClick={handleResetDatabase}
                  disabled={processing === 'reset'}
                  className="flex-1 rounded-xl bg-red-600 hover:bg-red-700"
                  isLoading={processing === 'reset'}
                >
                  Reset Now
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
