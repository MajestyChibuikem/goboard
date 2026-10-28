import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  CheckCircle2,
  Github,
  Award,
  ArrowRight,
  ShieldCheck,
  Flame,
  Compass,
  FolderGit2,
  FileText,
  Upload,
  Check,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { reportXpEvent } from '../services/xpClient';
import {
  ACADEMIC_LEVELS,
  AcademicLevel,
  DEPARTMENT_SUGGESTIONS,
  INTEREST_OPTIONS,
} from '../shared/profileOptions';
import { Button } from '../components/Button';
import { uploadStudentIdCard, saveOnboardingDraftFields } from '../services/firestoreService';

const WELCOME_DRAFT_KEY = 'goboard_welcome_draft';

interface WelcomeDraft {
  step: number;
  displayName: string;
  department: string;
  academicLevel: AcademicLevel | '';
  selectedInterests: string[];
}

function loadWelcomeDraft(): WelcomeDraft | null {
  try {
    const raw = sessionStorage.getItem(WELCOME_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WelcomeDraft;
  } catch {
    return null;
  }
}

export const WelcomePage: React.FC = () => {
  const { user, profile, connectGitHubWithOAuth, updateLocalProfile, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const initialDraft = loadWelcomeDraft();

  const [step, setStep] = useState<number>(() => {
    const s = initialDraft?.step;
    return s && s >= 1 && s <= 5 ? s : 1;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Who are you?
  const [displayName, setDisplayName] = useState(() => initialDraft?.displayName || '');
  const [department, setDepartment] = useState(() => initialDraft?.department || '');
  const [academicLevel, setAcademicLevel] = useState<AcademicLevel | ''>(() => initialDraft?.academicLevel || '');
  const [filteredDeptSuggestions, setFilteredDeptSuggestions] = useState<string[]>([]);
  const [showDeptDropdown, setShowDeptDropdown] = useState(false);

  // Step 2: Interests
  const [selectedInterests, setSelectedInterests] = useState<string[]>(() => initialDraft?.selectedInterests || []);

  // Step 3: GitHub
  const [connectingGh, setConnectingGh] = useState(false);

  // Step 4: Student ID
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idPreview, setIdPreview] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState(false);
  const [idUploaded, setIdUploaded] = useState(false);

  // Dismiss static #loading-screen from index.html on mount
  useEffect(() => {
    const loader = document.getElementById('loading-screen');
    if (loader) {
      loader.classList.add('fade-out');
      const timer = setTimeout(() => loader.remove(), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  // Persist wizard state in sessionStorage so full-window OAuth redirects or refreshes never lose progress
  useEffect(() => {
    try {
      const draft: WelcomeDraft = {
        step,
        displayName,
        department,
        academicLevel,
        selectedInterests,
      };
      sessionStorage.setItem(WELCOME_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Ignore storage quota errors
    }
  }, [step, displayName, department, academicLevel, selectedInterests]);

  // Prefill existing user data if available
  useEffect(() => {
    if (profile) {
      if (!displayName && profile.displayName && profile.displayName !== 'Student') {
        setDisplayName(profile.displayName);
      } else if (!displayName && user?.displayName) {
        setDisplayName(user.displayName);
      }
      if (!department && profile.department) {
        setDepartment(profile.department);
      }
      if (!academicLevel && profile.academicLevel && ACADEMIC_LEVELS.includes(profile.academicLevel as any)) {
        setAcademicLevel(profile.academicLevel as AcademicLevel);
      }
      if (profile.interests && profile.interests.length > 0 && selectedInterests.length === 0) {
        setSelectedInterests(profile.interests);
      }
      if (profile.verificationStatus === 'pending' || profile.verificationStatus === 'verified') {
        setIdUploaded(true);
      }
    }
  }, [profile, user]);

  // Redirect unauthenticated visitors to '/' and already-onboarded users to '/browse'
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/', { replace: true });
      return;
    }
    if (!authLoading && profile?.onboardingCompletedAt) {
      try {
        sessionStorage.removeItem(WELCOME_DRAFT_KEY);
      } catch {
        // ignore
      }
      navigate('/browse', { replace: true });
    }
  }, [user, profile?.onboardingCompletedAt, authLoading, navigate]);

  const handleDepartmentChange = (val: string) => {
    setDepartment(val);
    if (!val.trim()) {
      setFilteredDeptSuggestions([]);
      setShowDeptDropdown(false);
    } else {
      const q = val.toLowerCase();
      const matches = DEPARTMENT_SUGGESTIONS.filter((d) => d.toLowerCase().includes(q));
      setFilteredDeptSuggestions(matches.slice(0, 5));
      setShowDeptDropdown(matches.length > 0);
    }
  };

  const selectDepartmentSuggestion = (dept: string) => {
    setDepartment(dept);
    setShowDeptDropdown(false);
  };

  const toggleInterest = (id: string) => {
    setSelectedInterests((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleGitHubConnect = async () => {
    setConnectingGh(true);
    try {
      await connectGitHubWithOAuth();
      toast('GitHub account connected!', 'success');
    } catch (err: any) {
      toast(err.message || 'Could not connect GitHub', 'error');
    } finally {
      setConnectingGh(false);
    }
  };

  const handleIdFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) {
      toast('ID image must be under 5MB', 'error');
      return;
    }
    setIdFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setIdPreview(reader.result as string);
    reader.readAsDataURL(file);

    setUploadingId(true);
    try {
      await uploadStudentIdCard(user.uid, file);
      setIdUploaded(true);
      toast('Student ID uploaded for verification!', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to upload ID', 'error');
    } finally {
      setUploadingId(false);
    }
  };

  const validateStep1 = (): boolean => {
    setError(null);
    if (!displayName.trim() || displayName.trim().length < 2) {
      setError('Please enter a display name (at least 2 characters).');
      return false;
    }
    if (!department.trim() || department.trim().length < 2) {
      setError('Please enter or select your department (e.g. Computer Science).');
      return false;
    }
    if (!academicLevel) {
      setError('Please select your current academic level.');
      return false;
    }
    return true;
  };

  const handleFinishOnboarding = async () => {
    if (!validateStep1()) {
      setStep(1);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await reportXpEvent({
        type: 'ONBOARDING_COMPLETED',
        displayName: displayName.trim(),
        department: department.trim(),
        academicLevel,
        interests: selectedInterests,
      });

      if (!res.success && res.error) {
        throw new Error(res.error);
      }

      const completedIso = res.onboardingCompletedAt || new Date().toISOString();
      updateLocalProfile({
        onboardingCompletedAt: completedIso,
        displayName: displayName.trim(),
        department: department.trim(),
        academicLevel,
        interests: selectedInterests,
        ...(res.awarded > 0
          ? {
              xp: (profile?.xp || 0) + res.awarded,
              seasonXp: (profile?.seasonXp || 0) + res.awarded,
            }
          : {}),
      });

      if (res.awarded > 0) {
        toast(`Welcome to GoBoard! +${res.awarded} XP awarded!`, 'success');
      } else {
        toast('Profile updated successfully!', 'success');
      }

      try {
        sessionStorage.removeItem(WELCOME_DRAFT_KEY);
      } catch {
        // ignore
      }

      navigate('/browse', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Failed to finish onboarding. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const totalSteps = 5;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col justify-between p-4 md:p-8">
      {/* Top Header */}
      <header className="max-w-2xl mx-auto w-full flex items-center justify-between pb-6 border-b border-neutral-200/80 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gouni-primary text-white font-black flex items-center justify-center shadow-sm">
            G
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight">GoBoard Setup</div>
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400">Step {step} of {totalSteps}</div>
          </div>
        </div>

        {/* Step Progress Indicators */}
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s === step
                  ? 'w-6 bg-gouni-primary dark:bg-white'
                  : s < step
                  ? 'w-2 bg-emerald-500'
                  : 'w-2 bg-neutral-200 dark:bg-neutral-800'
              }`}
            />
          ))}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-xl mx-auto w-full my-auto py-8">
        <AnimatePresence mode="wait">
          {/* ──────────────── STEP 1: WHO ARE YOU? ──────────────── */}
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gouni-primary/10 dark:bg-white/10 text-gouni-primary dark:text-white mb-2">
                  <Sparkles className="w-3.5 h-3.5" /> Required Setup
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  Tell us about yourself
                </h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                  This sets up your campus profile so classmates recognize your work.
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Your Full Name or Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value);
                      setError(null);
                    }}
                    placeholder="e.g. Chinaza Okafor"
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-sm focus:ring-2 focus:ring-gouni-primary/20 focus:border-gouni-primary outline-none transition-all text-neutral-900 dark:text-white placeholder:text-neutral-400"
                  />
                </div>

                <div className="relative">
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Academic Department
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => {
                      handleDepartmentChange(e.target.value);
                      setError(null);
                    }}
                    onFocus={() => {
                      if (department.trim()) setShowDeptDropdown(true);
                    }}
                    placeholder="e.g. Computer Science"
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-sm focus:ring-2 focus:ring-gouni-primary/20 focus:border-gouni-primary outline-none transition-all text-neutral-900 dark:text-white placeholder:text-neutral-400"
                  />

                  {showDeptDropdown && filteredDeptSuggestions.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-lg overflow-hidden py-1">
                      {filteredDeptSuggestions.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => selectDepartmentSuggestion(d)}
                          className="w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 cursor-pointer"
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Suggestion Chips */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {DEPARTMENT_SUGGESTIONS.slice(0, 4).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => selectDepartmentSuggestion(d)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                          department === d
                            ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 border-neutral-900 dark:border-white'
                            : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:border-neutral-400'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Academic Level
                  </label>
                  <select
                    value={academicLevel}
                    onChange={(e) => {
                      setAcademicLevel(e.target.value as AcademicLevel);
                      setError(null);
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-sm focus:ring-2 focus:ring-gouni-primary/20 focus:border-gouni-primary outline-none transition-all text-neutral-900 dark:text-white"
                  >
                    <option value="">Select Level</option>
                    {ACADEMIC_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleFinishOnboarding}
                  disabled={submitting}
                  className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 font-medium underline underline-offset-4 cursor-pointer"
                >
                  Skip remaining steps & claim +25 XP
                </button>

                <Button
                  variant="primary"
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl cursor-pointer"
                  onClick={() => {
                    if (validateStep1()) {
                      if (user) {
                        saveOnboardingDraftFields(user.uid, {
                          displayName: displayName.trim(),
                          department: department.trim(),
                          academicLevel,
                        }).catch(console.warn);
                        updateLocalProfile({
                          displayName: displayName.trim(),
                          department: department.trim(),
                          academicLevel,
                        });
                      }
                      setStep(2);
                    }
                  }}
                >
                  Continue to Interests <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ──────────────── STEP 2: WHAT BRINGS YOU HERE? ──────────────── */}
          {step === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 mb-2">
                  <Compass className="w-3.5 h-3.5" /> Step 2: Tailor your feed
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  What are you excited to do?
                </h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                  Select all that interest you. We’ll customize your starter quests and recommendations.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {INTEREST_OPTIONS.map((opt) => {
                  const selected = selectedInterests.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleInterest(opt.id)}
                      className={`text-left p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                        selected
                          ? 'border-gouni-primary bg-gouni-primary/5 dark:bg-gouni-primary/10 shadow-xs'
                          : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-sm font-bold text-neutral-900 dark:text-white">
                          {opt.label}
                        </span>
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center border transition-colors ${
                            selected
                              ? 'bg-gouni-primary border-gouni-primary text-white'
                              : 'border-neutral-300 dark:border-neutral-700'
                          }`}
                        >
                          {selected && <Check className="w-3 h-3" />}
                        </div>
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                        {opt.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="pt-4 flex items-center justify-between gap-3">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setStep(3)}>
                    Skip
                  </Button>
                  <Button variant="primary" onClick={() => setStep(3)}>
                    Continue <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ──────────────── STEP 3: CONNECT GITHUB ──────────────── */}
          {step === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-2">
                  <Github className="w-3.5 h-3.5" /> Step 3: Developer Power
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  Connect your GitHub
                </h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                  Automatically sync your coding streaks, commit stats, top languages, and submit projects in seconds.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-neutral-900 text-white space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                    <Github className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-sm font-bold">Verified GitHub Integration</div>
                    <div className="text-xs text-neutral-400">Earn +15 XP automatically for every active coding day</div>
                  </div>
                </div>

                {profile?.githubProfile ? (
                  <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <div>
                        <div className="text-xs font-bold text-white">
                          @{profile.githubProfile.displayUsername || profile.githubProfile.username}
                        </div>
                        <div className="text-[11px] text-emerald-300">
                          {profile.githubProfile.publicRepos} public repos • {profile.githubProfile.totalStars} stars
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800">
                      Connected
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleGitHubConnect}
                    disabled={connectingGh}
                    className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl bg-white text-neutral-950 font-bold text-sm hover:bg-neutral-100 transition-all cursor-pointer disabled:opacity-60"
                  >
                    {connectingGh ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Connecting to GitHub...
                      </>
                    ) : (
                      <>
                        <Github className="w-4 h-4" /> Link GitHub Account
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="pt-4 flex items-center justify-between gap-3">
                <Button variant="ghost" onClick={() => setStep(2)}>
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setStep(4)}>
                    Skip
                  </Button>
                  <Button variant="primary" onClick={() => setStep(4)}>
                    Continue <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ──────────────── STEP 4: STUDENT ID VERIFICATION ──────────────── */}
          {step === 4 && (
            <motion.div
              key="step-4"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-2">
                  <ShieldCheck className="w-3.5 h-3.5" /> Step 4: Verification (Optional)
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  Unlock GoCoins & Payouts
                </h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                  Upload your Godfrey Okoye University Student ID card to access cash prize bounties and direct naira bank transfers.
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
                {idUploaded ? (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <div>
                      <div className="text-xs font-bold">Student ID Uploaded</div>
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                        Our campus admin team will review your ID card shortly.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                      Upload clear photo of your Student ID
                    </label>
                    <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl hover:border-neutral-400 dark:hover:border-neutral-700 transition-all cursor-pointer bg-neutral-50/50 dark:bg-neutral-950/50">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleIdFileSelect}
                        disabled={uploadingId}
                        className="hidden"
                      />
                      {uploadingId ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="w-6 h-6 animate-spin text-gouni-primary" />
                          <span className="text-xs text-neutral-500">Uploading ID...</span>
                        </div>
                      ) : idPreview ? (
                        <div className="flex items-center gap-3">
                          <img src={idPreview} alt="ID Preview" className="w-16 h-12 object-cover rounded-lg" />
                          <div className="text-left">
                            <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 block">
                              {idFile?.name}
                            </span>
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400">Ready to submit</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-center">
                          <Upload className="w-6 h-6 text-neutral-400 mb-2" />
                          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                            Click to upload ID Card photo
                          </span>
                          <span className="text-[11px] text-neutral-400 mt-0.5">PNG, JPG up to 5MB</span>
                        </div>
                      )}
                    </label>
                  </div>
                )}
                <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                  You can also do this anytime later from your Profile → Verification tab.
                </p>
              </div>

              <div className="pt-4 flex items-center justify-between gap-3">
                <Button variant="ghost" onClick={() => setStep(3)}>
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setStep(5)}>
                    Skip
                  </Button>
                  <Button variant="primary" onClick={() => setStep(5)}>
                    Continue <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ──────────────── STEP 5: HOW XP WORKS ──────────────── */}
          {step === 5 && (
            <motion.div
              key="step-5"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gouni-primary/10 text-gouni-primary dark:text-white mb-2">
                  <Award className="w-3.5 h-3.5" /> Final Step
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  How GoBoard XP & Fair Play Work
                </h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                  Keep these rules in mind as you build, write, and compete on the leaderboard.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-neutral-900 dark:text-white">Daily Login Streaks</div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
                      Visit the platform daily to maintain your streak badge and earn +10 bonus XP on every 3rd consecutive day.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-neutral-900 dark:text-white">7-Day Fair Voting Rule</div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
                      To prevent vote manipulation and bot accounts, upvotes and comments from accounts under 7 days old do not award author XP yet.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <FolderGit2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-neutral-900 dark:text-white">Software Submissions & Lit Club</div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
                      Earn +50 XP for submitting a software project (+100 XP for your first one!) and another +50 XP when approved by campus admins.
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="pt-4 flex items-center justify-between gap-3">
                <Button variant="ghost" onClick={() => setStep(4)}>
                  Back
                </Button>
                <Button
                  variant="primary"
                  className="px-6 py-2.5 rounded-xl cursor-pointer"
                  onClick={handleFinishOnboarding}
                  isLoading={submitting}
                >
                  <Sparkles className="w-4 h-4 mr-1.5 text-amber-300" />
                  Complete Setup & Claim 25 XP
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="max-w-2xl mx-auto w-full text-center text-[11px] text-neutral-400 dark:text-neutral-500 pt-6 border-t border-neutral-200/80 dark:border-neutral-800">
        Godfrey Okoye University • Computer Science & Tech Showcase Platform
      </footer>
    </div>
  );
};

export default WelcomePage;
