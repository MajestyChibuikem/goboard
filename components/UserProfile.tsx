import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { RANK_EMOJIS, formatDate } from '../services/utils';
import {
  getUserProjects,
  getUserContributedProjects,
  updateDisplayName,
  uploadStudentIdCard,
  updateBankDetails,
  updateDiscordProfile,
  uploadUserBanner,
  subscribeToCampaignConfig,
  DEFAULT_CAMPAIGN_CONFIG,
} from '../services/firestoreService';
import { Project, CampaignConfig } from '../types';
import {
  ArrowLeft,
  Mail,
  Calendar,
  Layers,
  Flame,
  Edit2,
  Check,
  X,
  ShieldCheck,
  Coins,
  Palette,
  Camera,
  Building2,
  CreditCard,
  IdCard,
  AlertCircle,
  Clock,
  Sparkles,
  GraduationCap,
  Upload,
  CheckCircle2,
  Github,
  GitFork,
  Star,
  RefreshCw,
  ExternalLink,
  Unlink,
  GitCommit,
  Code2,
} from 'lucide-react';
import { useToast } from './Toast';
import {
  STATUS_CONFIG,
  DISCORD_BANNER_PRESETS,
  PROFILE_ACCENT_COLORS,
  ACADEMIC_LEVELS,
  GITHUB_LANGUAGE_COLORS,
} from '../constants';

interface UserProfileProps {
  onBack: () => void;
  onProjectClick: (project: Project) => void;
}

const RANK_PROGRESS = [
  { rank: 'Freshman Coder', min: 0, max: 99 },
  { rank: 'Rising Dev', min: 100, max: 299 },
  { rank: 'Code Ninja', min: 300, max: 599 },
  { rank: 'Campus Builder', min: 600, max: 999 },
  { rank: 'Campus Legend', min: 1000, max: 1999 },
  { rank: 'Hall of Fame', min: 2000, max: Infinity },
];

export const UserProfile: React.FC<UserProfileProps> = ({ onBack, onProjectClick }) => {
  const {
    user,
    profile,
    updateProfilePhoto,
    connectGitHubWithOAuth,
    connectGitHubByUsername,
    syncGitHubProfile,
    disconnectGitHub,
  } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<'overview' | 'wallet'>(() =>
    searchParams.get('tab') === 'wallet' ? 'wallet' : 'overview'
  );
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [contributedProjects, setContributedProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [campaignConfig, setCampaignConfig] = useState<CampaignConfig>(DEFAULT_CAMPAIGN_CONFIG);

  // GitHub connection & sync state
  const [connectingGitHub, setConnectingGitHub] = useState(false);
  const [syncingGitHub, setSyncingGitHub] = useState(false);
  const [showUsernameConnect, setShowUsernameConnect] = useState(false);
  const [githubUsernameInput, setGithubUsernameInput] = useState('');

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'wallet') {
      setActiveTab('wallet');
    } else if (tabParam === 'overview') {
      setActiveTab('overview');
    }
  }, [searchParams]);

  const handleTabChange = (tab: 'overview' | 'wallet') => {
    setActiveTab(tab);
    if (tab === 'wallet') {
      setSearchParams({ tab: 'wallet' }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  // Avatar & Banner upload state
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const idCardInputRef = useRef<HTMLInputElement | null>(null);

  // Display name one-time edit state
  const [showEditName, setShowEditName] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingName, setEditingName] = useState(false);

  // Discord profile customization modal state
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [customForm, setCustomForm] = useState({
    bannerPreset: 'gradient-blue',
    accentColor: '#1e3a8a',
    bio: '',
    department: '',
    academicLevel: '',
  });

  // Student ID & Bank Details state
  const [uploadingIdCard, setUploadingIdCard] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [bankForm, setBankForm] = useState({
    bankName: '',
    accountNumber: '',
    accountName: '',
  });

  useEffect(() => {
    if (user) {
      Promise.all([
        getUserProjects(user.uid),
        getUserContributedProjects(user.uid),
      ])
        .then(([own, contributed]) => {
          setMyProjects(own);
          setContributedProjects(contributed);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const unsub = subscribeToCampaignConfig(setCampaignConfig);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (profile) {
      setCustomForm({
        bannerPreset: profile.bannerPreset || 'gradient-blue',
        accentColor: profile.accentColor || '#1e3a8a',
        bio: profile.bio || '',
        department: profile.department || '',
        academicLevel: profile.academicLevel || '',
      });
      if (profile.bankDetails) {
        setBankForm({
          bankName: profile.bankDetails.bankName || '',
          accountNumber: profile.bankDetails.accountNumber || '',
          accountName: profile.bankDetails.accountName || '',
        });
      }
    }
  }, [profile]);

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Please choose an image smaller than 5MB.');
      return;
    }

    setUploadingAvatar(true);
    try {
      await updateProfilePhoto(file);
      toast('Avatar updated!', 'success');
    } catch (err) {
      setUploadError('Failed to upload profile photo. Please try again.');
      console.error(err);
    } finally {
      setUploadingAvatar(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleBannerFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      toast('Banner image must be smaller than 5MB.', 'error');
      return;
    }

    setUploadingBanner(true);
    try {
      await uploadUserBanner(user.uid, file);
      toast('Custom profile banner uploaded!', 'success');
    } catch (err) {
      console.error(err);
      toast('Failed to upload banner image.', 'error');
    } finally {
      setUploadingBanner(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleRemoveCustomBanner = async () => {
    if (!user) return;
    try {
      await updateDiscordProfile(user.uid, { bannerUrl: null });
      toast('Reverted to preset banner.', 'info');
    } catch (err) {
      console.error(err);
      toast('Failed to remove custom banner.', 'error');
    }
  };

  const handleSaveDisplayName = async () => {
    if (!newName.trim()) {
      toast('Display name cannot be empty', 'error');
      return;
    }
    if (!user) return;

    setEditingName(true);
    try {
      await updateDisplayName(user.uid, newName.trim());
      toast('Display name updated!', 'success');
      setShowEditName(false);
      setNewName('');
    } catch (err: any) {
      console.error('Failed to update display name:', err);
      toast(err.message || 'Failed to update display name', 'error');
    } finally {
      setEditingName(false);
    }
  };

  const handleSaveCustomization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSavingProfile(true);
    try {
      await updateDiscordProfile(user.uid, {
        bannerPreset: customForm.bannerPreset,
        accentColor: customForm.accentColor,
        bio: customForm.bio.trim().slice(0, 160),
        department: customForm.department.trim(),
        academicLevel: customForm.academicLevel,
      });
      toast('Profile style updated!', 'success');
      setShowCustomizeModal(false);
    } catch (err) {
      console.error('Failed to save profile customization:', err);
      toast('Failed to save profile style.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleIdCardUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      toast('Student ID image must be under 5MB.', 'error');
      return;
    }

    setUploadingIdCard(true);
    try {
      await uploadStudentIdCard(user.uid, file);
      toast('Student ID uploaded! Pending admin verification.', 'success');
    } catch (err) {
      console.error('Failed to upload Student ID:', err);
      toast('Failed to upload Student ID card. Try again.', 'error');
    } finally {
      setUploadingIdCard(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleSaveBankDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const cleanAcct = bankForm.accountNumber.replace(/\D/g, '');
    if (!bankForm.bankName.trim() || cleanAcct.length < 10 || !bankForm.accountName.trim()) {
      toast('Please enter a valid bank name, 10-digit account number, and account name.', 'error');
      return;
    }

    setSavingBank(true);
    try {
      await updateBankDetails(user.uid, {
        bankName: bankForm.bankName.trim(),
        accountNumber: cleanAcct,
        accountName: bankForm.accountName.trim(),
      });
      toast('Bank payout details saved!', 'success');
    } catch (err) {
      console.error('Failed to save bank details:', err);
      toast('Failed to save bank details.', 'error');
    } finally {
      setSavingBank(false);
    }
  };

  const handleConnectGitHubOAuth = async () => {
    setConnectingGitHub(true);
    try {
      const { profile: ghProfile, xpAwarded } = await connectGitHubWithOAuth();
      toast(
        xpAwarded > 0
          ? `Connected @${ghProfile.displayUsername} & earned +${xpAwarded} Active Coding XP!`
          : `Connected GitHub account @${ghProfile.displayUsername}!`,
        'success'
      );
      if (user) {
        getUserContributedProjects(user.uid).then(setContributedProjects).catch(() => {});
      }
    } catch (err: any) {
      console.error('GitHub OAuth connection error:', err);
      if (
        err?.code === 'auth/operation-not-allowed' ||
        err?.code === 'auth/unauthorized-domain' ||
        err?.code === 'auth/popup-blocked'
      ) {
        setShowUsernameConnect(true);
        toast(
          'GitHub OAuth popup unavailable — enter your GitHub username below to connect.',
          'info'
        );
      } else if (err?.code === 'auth/credential-already-in-use') {
        toast('This GitHub account is already linked to another GoBoard profile.', 'error');
      } else if (err?.code !== 'auth/popup-closed-by-user') {
        toast(err?.message || 'Could not connect GitHub via OAuth. Try connecting by username.', 'error');
        setShowUsernameConnect(true);
      }
    } finally {
      setConnectingGitHub(false);
    }
  };

  const handleConnectGitHubUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUsernameInput.trim()) return;
    setConnectingGitHub(true);
    try {
      const { profile: ghProfile, xpAwarded } = await connectGitHubByUsername(githubUsernameInput);
      setShowUsernameConnect(false);
      setGithubUsernameInput('');
      toast(
        xpAwarded > 0
          ? `Connected @${ghProfile.displayUsername} & earned +${xpAwarded} Active Coding XP!`
          : `Connected GitHub @${ghProfile.displayUsername}!`,
        'success'
      );
      if (user) {
        getUserContributedProjects(user.uid).then(setContributedProjects).catch(() => {});
      }
    } catch (err: any) {
      console.error('GitHub username connection error:', err);
      toast(err?.message || 'Failed to find that GitHub username.', 'error');
    } finally {
      setConnectingGitHub(false);
    }
  };

  const handleSyncGitHub = async () => {
    setSyncingGitHub(true);
    try {
      const res = await syncGitHubProfile();
      if (res) {
        toast(
          res.xpAwarded > 0
            ? `GitHub activity synced! +${res.xpAwarded} XP for active coding!`
            : 'GitHub activity & repositories synced!',
          'success'
        );
        if (user) {
          getUserContributedProjects(user.uid).then(setContributedProjects).catch(() => {});
        }
      }
    } catch (err: any) {
      console.error('Failed to sync GitHub activity:', err);
      toast(err?.message || 'Failed to sync GitHub activity.', 'error');
    } finally {
      setSyncingGitHub(false);
    }
  };

  const handleDisconnectGitHub = async () => {
    try {
      await disconnectGitHub();
      toast('GitHub account disconnected.', 'info');
    } catch (err) {
      console.error('Failed to disconnect GitHub:', err);
      toast('Failed to disconnect GitHub account.', 'error');
    }
  };

  if (!user || !profile) return null;

  const currentTier = RANK_PROGRESS.find(t => profile.xp >= t.min && profile.xp <= t.max) || RANK_PROGRESS[0];
  const progressInTier = currentTier.max === Infinity
    ? 100
    : Math.round(((profile.xp - currentTier.min) / (currentTier.max - currentTier.min + 1)) * 100);

  const bannerPresetKey = profile.bannerPreset || 'gradient-blue';
  const bannerPresetConfig = DISCORD_BANNER_PRESETS[bannerPresetKey] || DISCORD_BANNER_PRESETS['gradient-blue'];
  const accentColor = profile.accentColor || '#1e3a8a';

  // Payday qualification checks
  const hasCoins = (profile.goCoins || 0) > 0;
  const isIdVerified = profile.verificationStatus === 'verified';
  const hasBankInfo = Boolean(
    profile.bankDetails?.bankName &&
    profile.bankDetails?.accountNumber &&
    profile.bankDetails?.accountName
  );
  const completedStepsCount = [hasCoins, isIdVerified, hasBankInfo].filter(Boolean).length;
  const isFullyQualifiedForPayday = hasCoins && isIdVerified && hasBankInfo;

  // Estimated Naira payout based on live exchange rate
  const estimatedNaira = Math.round(((profile.goCoins || 0) / 500) * (campaignConfig.nairaPer500Coins || 500));

  return (
    <div className="animate-fade-up max-w-4xl mx-auto">
      {/* Hidden file inputs */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarChange}
      />
      <input
        ref={bannerInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleBannerFileChange}
      />
      <input
        ref={idCardInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleIdCardUpload}
      />

      {/* Back navigation */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-400 hover:text-neutral-900 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to projects
      </button>

      {/* ═══════════════════════════════════════════════════════
          DISCORD-INSPIRED PROFILE CARD
      ═══════════════════════════════════════════════════════ */}
      <div
        className="bg-white rounded-3xl border border-neutral-200/80 shadow-card overflow-hidden mb-6"
        style={{ borderTopColor: accentColor }}
      >
        {/* Modular Top Banner Slot (Ready for future SDK animated banners) */}
        <div
          data-sdk-banner-slot="true"
          className={`relative h-36 sm:h-48 w-full overflow-hidden ${!profile.bannerUrl ? bannerPresetConfig.className : 'bg-neutral-900'}`}
        >
          {profile.bannerUrl ? (
            <img
              src={profile.bannerUrl}
              alt="Profile banner"
              className="w-full h-full object-cover"
            />
          ) : (
            /* Subtle decorative mesh overlay for preset banners */
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.35) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.25) 0%, transparent 40%)',
              }}
            />
          )}

          {/* Top-right Banner Actions */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => bannerInputRef.current?.click()}
              disabled={uploadingBanner}
              className="px-3 py-1.5 rounded-xl bg-black/45 hover:bg-black/65 backdrop-blur-md text-white text-xs font-medium flex items-center gap-1.5 transition-all border border-white/15"
            >
              <Camera className="w-3.5 h-3.5" />
              {uploadingBanner ? 'Uploading...' : 'Banner Photo'}
            </button>
            <button
              type="button"
              onClick={() => setShowCustomizeModal(true)}
              className="px-3 py-1.5 rounded-xl bg-white/90 hover:bg-white text-neutral-900 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Palette className="w-3.5 h-3.5" />
              Customize Profile
            </button>
          </div>
        </div>

        {/* Profile Identity Body */}
        <div className="px-6 sm:px-8 pb-8">
          {/* Overlapping Avatar + Badge Tray Row */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 sm:-mt-14 mb-5 relative z-10">
            <div className="flex items-end gap-4">
              {/* Avatar with hover camera */}
              <div className="relative group shrink-0">
                <div
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl p-1 bg-white shadow-md"
                  style={{ boxShadow: `0 0 0 2px ${accentColor}25` }}
                >
                  {profile.photoURL || user.photoURL ? (
                    <img
                      src={(profile.photoURL || user.photoURL) || undefined}
                      alt={profile.displayName}
                      className="w-full h-full rounded-2xl object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full rounded-2xl flex items-center justify-center text-3xl font-bold text-white"
                      style={{ backgroundColor: accentColor }}
                    >
                      {(profile.displayName || 'S').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute inset-1 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[11px] font-medium cursor-pointer"
                >
                  <Camera className="w-5 h-5 mb-0.5" />
                  {uploadingAvatar ? '...' : 'Photo'}
                </button>

                {/* Status / Rank Corner Pill */}
                <div
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-white shadow-sm border border-neutral-200 flex items-center justify-center text-base"
                  title={profile.rank}
                >
                  {RANK_EMOJIS[profile.rank] || '🎓'}
                </div>
              </div>

              {/* Discord-Style Badge Tray */}
              <div className="flex flex-wrap items-center gap-1.5 pb-1">
                {profile.verificationStatus === 'verified' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Verified Student
                  </span>
                )}
                {profile.githubProfile?.username && (
                  <a
                    href={profile.githubProfile.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-neutral-900 text-white hover:bg-neutral-800 transition-colors shadow-2xs"
                    title="Connected GitHub Profile"
                  >
                    <Github className="w-3.5 h-3.5" />
                    @{profile.githubProfile.displayUsername || profile.githubProfile.username}
                    {profile.githubProfile.isVerifiedOAuth && (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    )}
                  </a>
                )}
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">
                  <span>{RANK_EMOJIS[profile.rank] || '🎓'}</span>
                  {profile.rank}
                </span>
                {profile.streakDays > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-orange-50 text-orange-700 border border-orange-200">
                    <Flame className="w-3.5 h-3.5 text-orange-500" />
                    {profile.streakDays}d Streak
                  </span>
                )}
                {(profile.totalGoCoinsEarned || 0) > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Season 1 Hunter
                  </span>
                )}
              </div>
            </div>

            {/* Right: GoCoins & XP HUD Pills */}
            <div className="flex items-center gap-2.5 self-start sm:self-end">
              <button
                type="button"
                onClick={() => handleTabChange('wallet')}
                className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200/80 hover:border-amber-300 transition-all text-left"
              >
                <div className="w-7 h-7 rounded-xl bg-amber-400/20 flex items-center justify-center text-amber-700">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-amber-900 leading-none">
                    {(profile.goCoins || 0).toLocaleString()} GC
                  </div>
                  <div className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mt-0.5">
                    ≈ ₦{estimatedNaira.toLocaleString()}
                  </div>
                </div>
              </button>

              <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-neutral-50 border border-neutral-200/80">
                <div>
                  <div className="text-sm font-bold text-neutral-900 leading-none">
                    {profile.xp.toLocaleString()} XP
                  </div>
                  <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mt-0.5">
                    Reputation
                  </div>
                </div>
              </div>
            </div>
          </div>

          {uploadError && (
            <p className="mb-3 text-xs text-red-500">{uploadError}</p>
          )}

          {/* Display Name + Department/Level + Bio */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
                {profile.displayName || 'Student'}
              </h1>
              {!profile.hasEditedDisplayName && (
                <button
                  onClick={() => {
                    setNewName(profile.displayName || '');
                    setShowEditName(true);
                  }}
                  className="text-[11px] font-medium px-2.5 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
                >
                  <Edit2 className="w-3 h-3" /> Edit Name (1x)
                </button>
              )}
              {(profile.department || profile.academicLevel) && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-neutral-100 text-neutral-700 text-xs font-medium">
                  <GraduationCap className="w-3.5 h-3.5 text-neutral-500" />
                  {[profile.department, profile.academicLevel].filter(Boolean).join(' • ')}
                </span>
              )}
            </div>

            {/* Bio / About Me */}
            {profile.bio ? (
              <p className="text-sm text-neutral-600 leading-relaxed max-w-2xl bg-neutral-50/80 border border-neutral-100 rounded-2xl px-4 py-3">
                {profile.bio}
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setShowCustomizeModal(true)}
                className="text-xs text-neutral-400 hover:text-neutral-600 italic transition-colors"
              >
                + Add an "About Me" bio, department, or custom banner...
              </button>
            )}

            {/* Metadata strip */}
            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-neutral-400">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> {user.email}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Joined {formatDate(profile.joinedAt).split(',')[0]}
              </span>
            </div>
          </div>

          {/* ── Profile Navigation Tabs ── */}
          <div className="flex items-center gap-2 mt-7 pt-6 border-t border-neutral-100">
            <button
              type="button"
              onClick={() => handleTabChange('overview')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${activeTab === 'overview'
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
                }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Overview & Projects
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('wallet')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${activeTab === 'wallet'
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
                }`}
            >
              <Coins className="w-3.5 h-3.5 text-amber-500" />
              GoCoins Wallet & Payday Setup
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isFullyQualifiedForPayday
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : activeTab === 'wallet'
                    ? 'bg-white/20 text-white'
                    : 'bg-amber-100 text-amber-800'
                  }`}
              >
                {isFullyQualifiedForPayday ? 'Qualified' : `${completedStepsCount}/3`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          TAB 1: OVERVIEW & PROJECTS
      ═══════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-up">
          {/* Rank Progress Card */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{RANK_EMOJIS[profile.rank] || '🎓'}</span>
                <span className="text-sm font-bold text-neutral-900">{profile.rank}</span>
              </div>
              {currentTier.max !== Infinity ? (
                <span className="text-xs font-medium text-neutral-500">
                  <span className="font-bold text-neutral-900">{profile.xp}</span> / {currentTier.max + 1} XP
                </span>
              ) : (
                <span className="text-xs font-bold text-gouni-primary">MAX RANK</span>
              )}
            </div>

            <div className="relative w-full h-3 bg-neutral-100 rounded-full overflow-hidden">
              <div
                className="absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${progressInTier}%`,
                  backgroundColor: accentColor,
                }}
              />
            </div>

            <div className="flex justify-between mt-2">
              <span className="text-[11px] font-semibold text-neutral-400">Current Tier</span>
              {currentTier.max !== Infinity && (
                <span className="text-[11px] font-semibold text-neutral-400">
                  Next: {RANK_PROGRESS[RANK_PROGRESS.indexOf(currentTier) + 1]?.rank || 'Next Rank'}
                </span>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="bg-white rounded-2xl border border-neutral-200 p-5 text-center">
              <div className="text-2xl font-bold text-neutral-900">{myProjects.length}</div>
              <div className="text-xs text-neutral-400 mt-1">Projects</div>
            </div>
            <div className="bg-white rounded-2xl border border-neutral-200 p-5 text-center">
              <div className="text-2xl font-bold text-neutral-900">
                {myProjects.reduce((acc, p) => acc + p.likes, 0)}
              </div>
              <div className="text-xs text-neutral-400 mt-1">Total Votes</div>
            </div>
            <div className="bg-white rounded-2xl border border-neutral-200 p-5 text-center">
              <div className="text-2xl font-bold text-amber-600">
                {(profile.goCoins || 0).toLocaleString()}
              </div>
              <div className="text-xs text-neutral-400 mt-1">GoCoins</div>
            </div>
            <div className="bg-white rounded-2xl border border-neutral-200 p-5 text-center">
              <div className="text-2xl font-bold text-neutral-900">{profile.seasonXp}</div>
              <div className="text-xs text-neutral-400 mt-1">Season XP</div>
            </div>
            <div className="bg-white rounded-2xl border border-neutral-200 p-5 text-center">
              <div className="flex items-center justify-center gap-1">
                <Flame className="w-5 h-5 text-orange-500" />
                <span className="text-2xl font-bold text-neutral-900">{profile.streakDays}</span>
              </div>
              <div className="text-xs text-neutral-400 mt-1">Day Streak</div>
            </div>
          </div>

          {/* ── Discord-Style GitHub Developer & Coding Productivity Card ── */}
          <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden shadow-2xs">
            <div className="bg-gradient-to-r from-[#0d1117] via-[#161b22] to-[#1f2937] text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center">
                  <Github className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold tracking-tight">GitHub Developer Profile & Activity</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      +15 XP / Active Day
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Connect GitHub to import projects in 1 click, get recognized as a contributor, and track coding productivity
                  </p>
                </div>
              </div>

              {profile.githubProfile && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSyncGitHub}
                    disabled={syncingGitHub}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingGitHub ? 'animate-spin' : ''}`} />
                    {syncingGitHub ? 'Syncing...' : 'Sync Activity'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnectGitHub}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-xs font-medium text-red-200 transition-colors"
                    title="Disconnect GitHub"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {!profile.githubProfile ? (
              <div className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1 max-w-lg">
                    <p className="text-sm font-semibold text-neutral-900">
                      Link your GitHub account to showcase your code & open-source contributions
                    </p>
                    <p className="text-xs text-neutral-500 leading-relaxed">
                      Whenever your commits or Pull Requests land in any GoBoard project repository, you'll automatically appear as a verified contributor and earn Builder XP.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleConnectGitHubOAuth}
                      disabled={connectingGitHub}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold transition-all shadow-xs disabled:opacity-50"
                    >
                      <Github className="w-4 h-4" />
                      {connectingGitHub ? 'Connecting...' : 'Connect with GitHub'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowUsernameConnect(!showUsernameConnect)}
                      className="px-3 py-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-xs font-medium text-neutral-600 transition-colors"
                    >
                      Use Username
                    </button>
                  </div>
                </div>

                {showUsernameConnect && (
                  <form
                    onSubmit={handleConnectGitHubUsername}
                    className="mt-4 pt-4 border-t border-neutral-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
                  >
                    <div className="relative flex-grow">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-neutral-400">
                        github.com/
                      </span>
                      <input
                        type="text"
                        value={githubUsernameInput}
                        onChange={(e) => setGithubUsernameInput(e.target.value)}
                        placeholder="your-github-username"
                        className="w-full pl-24 pr-4 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/15"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={connectingGitHub || !githubUsernameInput.trim()}
                      className="px-4 py-2 rounded-xl bg-gouni-primary hover:bg-gouni-dark text-white text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      {connectingGitHub ? 'Fetching...' : 'Link Profile'}
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {/* Connected Identity Strip */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    {profile.githubProfile.avatarUrl && (
                      <img
                        src={profile.githubProfile.avatarUrl}
                        alt={profile.githubProfile.displayUsername}
                        className="w-12 h-12 rounded-2xl border border-neutral-200 object-cover"
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <a
                          href={profile.githubProfile.profileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-base font-bold text-neutral-900 hover:text-gouni-primary transition-colors inline-flex items-center gap-1"
                        >
                          @{profile.githubProfile.displayUsername || profile.githubProfile.username}
                          <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
                        </a>
                        {profile.githubProfile.isVerifiedOAuth ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            OAuth Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 text-neutral-600">
                            Public Sync
                          </span>
                        )}
                      </div>
                      {profile.githubProfile.bio && (
                        <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">
                          {profile.githubProfile.bio}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-[11px] text-neutral-400">
                    Last synced {formatDate(profile.githubProfile.lastSyncedAt).split(',')[0]}
                  </div>
                </div>

                {/* 4-Pillar Productivity & Activity Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-100">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                      <GitCommit className="w-3.5 h-3.5 text-emerald-600" />
                      30d Commits & PRs
                    </div>
                    <div className="text-2xl font-extrabold text-neutral-900 mt-1">
                      {profile.githubProfile.recentCommits30d || 0}
                    </div>
                  </div>

                  <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-100">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                      <Flame className="w-3.5 h-3.5 text-orange-500" />
                      Active Days (30d)
                    </div>
                    <div className="text-2xl font-extrabold text-neutral-900 mt-1">
                      {profile.githubProfile.activeCodingDays30d || 0}
                      <span className="text-xs font-medium text-neutral-400 ml-1">days</span>
                    </div>
                  </div>

                  <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-100">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                      <Code2 className="w-3.5 h-3.5 text-blue-600" />
                      Public Repos
                    </div>
                    <div className="text-2xl font-extrabold text-neutral-900 mt-1">
                      {profile.githubProfile.publicRepos || 0}
                    </div>
                  </div>

                  <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-100">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                      <Star className="w-3.5 h-3.5 text-amber-500" />
                      Total Repo Stars
                    </div>
                    <div className="text-2xl font-extrabold text-neutral-900 mt-1">
                      {profile.githubProfile.totalStars || 0}
                    </div>
                  </div>
                </div>

                {/* Top Languages Breakdown Bar */}
                {profile.githubProfile.topLanguages && profile.githubProfile.topLanguages.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-neutral-700 mb-2">
                      Top Languages Across Repositories
                    </div>
                    <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-neutral-100">
                      {profile.githubProfile.topLanguages.map((lang) => (
                        <div
                          key={lang.name}
                          style={{
                            width: `${Math.max(lang.percentage, 6)}%`,
                            backgroundColor: GITHUB_LANGUAGE_COLORS[lang.name] || '#64748b',
                          }}
                          title={`${lang.name}: ${lang.percentage}%`}
                        />
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-2.5">
                      {profile.githubProfile.topLanguages.map((lang) => (
                        <span
                          key={lang.name}
                          className="inline-flex items-center gap-1.5 text-xs text-neutral-600 font-medium"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{
                              backgroundColor: GITHUB_LANGUAGE_COLORS[lang.name] || '#64748b',
                            }}
                          />
                          {lang.name}
                          <span className="text-neutral-400">{lang.percentage}%</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Repositories Strip */}
                {profile.githubProfile.topRepos && profile.githubProfile.topRepos.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-neutral-700 mb-2.5">
                      Recent & Highlighted Repositories
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {profile.githubProfile.topRepos.slice(0, 4).map((repo) => (
                        <a
                          key={repo.id}
                          href={repo.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3.5 rounded-2xl border border-neutral-200/80 hover:border-neutral-300 bg-neutral-50/50 hover:bg-neutral-50 transition-all group flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-neutral-900 group-hover:text-gouni-primary truncate">
                                {repo.name}
                              </span>
                              <ExternalLink className="w-3 h-3 text-neutral-400 shrink-0" />
                            </div>
                            {repo.description && (
                              <p className="text-[11px] text-neutral-500 line-clamp-1 mt-1">
                                {repo.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-2.5 text-[11px] text-neutral-400">
                            {repo.language && (
                              <span className="inline-flex items-center gap-1 text-neutral-600 font-medium">
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{
                                    backgroundColor:
                                      GITHUB_LANGUAGE_COLORS[repo.language] || '#64748b',
                                  }}
                                />
                                {repo.language}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-0.5">
                              <Star className="w-3 h-3 text-amber-500" /> {repo.stargazersCount}
                            </span>
                            <span className="inline-flex items-center gap-0.5">
                              <GitFork className="w-3 h-3 text-neutral-400" /> {repo.forksCount}
                            </span>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* My Projects */}
          <div>
            <h2 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-neutral-400" />
              My Projects
            </h2>

            {loading ? (
              <div className="space-y-4">
                {[1, 2].map(i => (
                  <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-5 animate-pulse">
                    <div className="h-4 bg-neutral-100 rounded w-1/3 mb-3" />
                    <div className="h-3 bg-neutral-100 rounded w-2/3" />
                  </div>
                ))}
              </div>
            ) : myProjects.length > 0 ? (
              <div className="space-y-3">
                {myProjects.map(project => (
                  <div
                    key={project.id}
                    onClick={() => onProjectClick(project)}
                    className="flex items-center gap-4 bg-white rounded-2xl border border-neutral-200 p-4 hover:border-neutral-300 hover:shadow-card-hover transition-all cursor-pointer"
                  >
                    <div className="w-16 h-12 rounded-xl bg-neutral-100 overflow-hidden shrink-0">
                      <img src={project.imageUrl || undefined} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-sm font-semibold text-neutral-900 truncate">{project.title}</h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_CONFIG[project.status].color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[project.status].dot}`} />
                          {STATUS_CONFIG[project.status].label}
                        </span>
                        {project.openToContributions && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <GitFork className="w-2.5 h-2.5" /> Open to PRs
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400 truncate">{project.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-neutral-700">{project.likes}</div>
                      <div className="text-[10px] text-neutral-400">votes</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-2xl border border-neutral-200">
                <p className="text-xs text-neutral-400">You haven't submitted any projects yet.</p>
              </div>
            )}
          </div>

          {/* Open-Source Contributions on GoBoard */}
          {contributedProjects.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
                <GitFork className="w-5 h-5 text-emerald-600" />
                Open-Source Contributions ({contributedProjects.length})
              </h2>
              <div className="space-y-3">
                {contributedProjects.map((project) => (
                  <div
                    key={project.id}
                    onClick={() => onProjectClick(project)}
                    className="flex items-center gap-4 bg-white rounded-2xl border border-emerald-200/80 p-4 hover:border-emerald-300 hover:shadow-card-hover transition-all cursor-pointer"
                  >
                    <div className="w-16 h-12 rounded-xl bg-neutral-100 overflow-hidden shrink-0">
                      <img src={project.imageUrl || undefined} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-sm font-semibold text-neutral-900 truncate">{project.title}</h3>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Github className="w-2.5 h-2.5" /> Verified Contributor
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 truncate">
                        By {project.displayName || project.studentName} • {project.description}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-neutral-700">{project.likes}</div>
                      <div className="text-[10px] text-neutral-400">votes</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB 2: GOCOINS WALLET & PAYDAY READINESS CHECKLIST
      ═══════════════════════════════════════════════════════ */}
      {activeTab === 'wallet' && (
        <div className="space-y-6 animate-fade-up">
          {/* Wallet Summary Hero */}
          <div className="bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#1e3a8a] text-white rounded-3xl p-6 sm:p-8 shadow-card relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/30 text-amber-300 text-xs font-semibold mb-3">
                  <Coins className="w-3.5 h-3.5" />
                  Season {campaignConfig.seasonNumber} Payday Wallet
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl sm:text-5xl font-extrabold tracking-tight">
                    {(profile.goCoins || 0).toLocaleString()}
                  </span>
                  <span className="text-lg font-semibold text-amber-300">GoCoins</span>
                </div>
                <p className="text-sm text-blue-100/80 mt-2">
                  Estimated Payday Value:{' '}
                  <strong className="text-white font-bold">₦{estimatedNaira.toLocaleString()}</strong>{' '}
                  <span className="text-xs text-blue-200/70">
                    (Rate: 500 GC = ₦{(campaignConfig.nairaPer500Coins || 500).toLocaleString()})
                  </span>
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 sm:p-5 shrink-0">
                <div className="text-xs text-blue-200 uppercase tracking-wider font-semibold mb-1">
                  Next Payday
                </div>
                <div className="text-lg font-bold text-white">
                  {formatDate(campaignConfig.paydayDate).split(',')[0]}
                </div>
                <div className="text-xs text-emerald-300 font-medium mt-1">
                  ✨ Season 1: No minimum coin limit!
                </div>
              </div>
            </div>
          </div>

          {/* Overall Qualification Banner */}
          <div
            className={`rounded-2xl border p-5 flex items-start gap-3.5 ${isFullyQualifiedForPayday
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
          >
            {isFullyQualifiedForPayday ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <h3 className="text-sm font-bold">
                {isFullyQualifiedForPayday
                  ? 'You are Qualified for Payday Payout!'
                  : `Payday Readiness Checklist (${completedStepsCount} of 3 Completed)`}
              </h3>
              <p className="text-xs mt-1 leading-relaxed opacity-85">
                {isFullyQualifiedForPayday
                  ? 'Everything is set. On Payday, the admin will transfer your GoCoins reward to your saved bank account.'
                  : 'There is no manual withdrawal queue—complete all 3 steps below before Payday so you are automatically included on the admin payout roster.'}
              </p>
            </div>
          </div>

          {/* Step 1: Earn GoCoins */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${hasCoins
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-neutral-100 text-neutral-600'
                    }`}
                >
                  {hasCoins ? <Check className="w-4 h-4" /> : '1'}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-neutral-900">
                    Earn GoCoins from Exam Paper Bounties
                  </h4>
                  <p className="text-xs text-neutral-500 mt-1">
                    Each approved exam question paper awards <strong>500 GoCoins</strong>. Season 1 has zero minimum threshold to get paid!
                  </p>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${hasCoins
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-neutral-100 text-neutral-500'
                  }`}
              >
                {hasCoins ? `${profile.goCoins} GC Ready` : '0 GC'}
              </span>
            </div>
          </div>

          {/* Step 2: Student ID Card Verification */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${isIdVerified
                    ? 'bg-emerald-100 text-emerald-700'
                    : profile.verificationStatus === 'pending'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-neutral-100 text-neutral-600'
                    }`}
                >
                  {isIdVerified ? <Check className="w-4 h-4" /> : '2'}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                    Student ID Card Verification
                    <span className="text-[11px] font-normal text-neutral-400">(Anti-Smurf Check)</span>
                  </h4>
                  <p className="text-xs text-neutral-500 mt-1">
                    Upload a clear photo of your GoUni Student ID card. Only visible to you and admins.
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="shrink-0">
                {profile.verificationStatus === 'verified' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <ShieldCheck className="w-3.5 h-3.5" /> Verified
                  </span>
                )}
                {profile.verificationStatus === 'pending' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    <Clock className="w-3.5 h-3.5" /> Pending Admin Review
                  </span>
                )}
                {profile.verificationStatus === 'rejected' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                    <X className="w-3.5 h-3.5" /> Rejected
                  </span>
                )}
                {(!profile.verificationStatus || profile.verificationStatus === 'none') && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-600">
                    Not Uploaded
                  </span>
                )}
              </div>
            </div>

            {profile.verificationStatus === 'rejected' && profile.verificationRejectionReason && (
              <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                <strong>Reason:</strong> {profile.verificationRejectionReason}
              </div>
            )}

            <div className="pl-0 sm:pl-11 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {profile.studentIdCardUrl && (
                <div className="w-40 h-24 rounded-xl border border-neutral-200 overflow-hidden bg-neutral-50 shrink-0">
                  <img
                    src={profile.studentIdCardUrl}
                    alt="Student ID Card"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {profile.verificationStatus !== 'verified' && (
                <button
                  type="button"
                  onClick={() => idCardInputRef.current?.click()}
                  disabled={uploadingIdCard}
                  className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-60"
                >
                  <IdCard className="w-4 h-4" />
                  {uploadingIdCard
                    ? 'Uploading ID Card...'
                    : profile.studentIdCardUrl
                      ? 'Replace Student ID Photo'
                      : 'Upload Student ID Card'}
                </button>
              )}
            </div>
          </div>

          {/* Step 3: Payout Bank Account Details */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${hasBankInfo
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-neutral-100 text-neutral-600'
                    }`}
                >
                  {hasBankInfo ? <Check className="w-4 h-4" /> : '3'}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-neutral-900">
                    Payout Bank Account Details
                  </h4>
                  <p className="text-xs text-neutral-500 mt-1">
                    Save the bank account where your Payday rewards should be sent.
                  </p>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${hasBankInfo
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-neutral-100 text-neutral-500'
                  }`}
              >
                {hasBankInfo ? 'Saved' : 'Required'}
              </span>
            </div>

            <form onSubmit={handleSaveBankDetails} className="pl-0 sm:pl-11 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                    Bank Name
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={bankForm.bankName}
                      onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                      placeholder="e.g. OPay, GTBank, Kuda"
                      className="w-full pl-9 pr-3.5 py-2.5 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-gouni-primary/20 focus:border-gouni-primary/40 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                    Account Number (10 digits)
                  </label>
                  <div className="relative">
                    <CreditCard className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      maxLength={10}
                      value={bankForm.accountNumber}
                      onChange={(e) =>
                        setBankForm({ ...bankForm, accountNumber: e.target.value.replace(/\D/g, '') })
                      }
                      placeholder="0123456789"
                      className="w-full pl-9 pr-3.5 py-2.5 border border-neutral-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-gouni-primary/20 focus:border-gouni-primary/40 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                    Account Name
                  </label>
                  <input
                    type="text"
                    required
                    value={bankForm.accountName}
                    onChange={(e) => setBankForm({ ...bankForm, accountName: e.target.value })}
                    placeholder="Full name on account"
                    className="w-full px-3.5 py-2.5 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-gouni-primary/20 focus:border-gouni-primary/40 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingBank}
                  className="px-5 py-2.5 rounded-xl bg-gouni-primary hover:bg-blue-800 text-white text-xs font-semibold transition-colors disabled:opacity-60 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  {savingBank ? 'Saving...' : 'Save Bank Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL: CUSTOMIZE DISCORD PROFILE
      ═══════════════════════════════════════════════════════ */}
      {showCustomizeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCustomizeModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-float w-full max-w-lg max-h-[85vh] overflow-y-auto animate-fade-up">
            <div className="flex items-center justify-between p-6 border-b border-neutral-100 sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-bold text-neutral-900">Customize Profile</h2>
                <p className="text-xs text-neutral-400 mt-0.5">Personalize your banner, theme accent, and bio</p>
              </div>
              <button
                onClick={() => setShowCustomizeModal(false)}
                className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-neutral-400" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomization} className="p-6 space-y-5">
              {/* Banner Preset Picker */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-neutral-700">Banner Theme</label>
                  {profile.bannerUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveCustomBanner}
                      className="text-[11px] text-red-600 hover:underline font-medium"
                    >
                      Remove custom banner image
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {Object.entries(DISCORD_BANNER_PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setCustomForm({ ...customForm, bannerPreset: key })}
                      className={`h-14 rounded-xl overflow-hidden relative border-2 transition-all ${customForm.bannerPreset === key
                        ? 'border-neutral-900 scale-[1.02] shadow-xs'
                        : 'border-transparent opacity-80 hover:opacity-100'
                        }`}
                    >
                      <div className={`w-full h-full ${preset.className}`} />
                      <span className="absolute bottom-1 left-2 text-[10px] font-semibold text-white drop-shadow">
                        {preset.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Accent Color */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-2">
                  Profile Accent Color
                </label>
                <div className="flex items-center gap-3">
                  {PROFILE_ACCENT_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCustomForm({ ...customForm, accentColor: c.value })}
                      className={`w-8 h-8 rounded-full transition-transform flex items-center justify-center ${customForm.accentColor === c.value ? 'scale-110 ring-2 ring-offset-2 ring-neutral-900' : ''
                        }`}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    >
                      {customForm.accentColor === c.value && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Department & Academic Level */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                    Department
                  </label>
                  <input
                    type="text"
                    value={customForm.department}
                    onChange={(e) => setCustomForm({ ...customForm, department: e.target.value })}
                    placeholder="e.g. Computer Science"
                    className="w-full px-3.5 py-2.5 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-gouni-primary/20 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                    Level
                  </label>
                  <select
                    value={customForm.academicLevel}
                    onChange={(e) => setCustomForm({ ...customForm, academicLevel: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-gouni-primary/20 outline-none"
                  >
                    <option value="">Select Level</option>
                    {ACADEMIC_LEVELS.map(lvl => (
                      <option key={lvl} value={lvl}>{lvl}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bio */}
              <div>
                <div className="flex justify-between mb-1.5">
                  <label className="text-xs font-semibold text-neutral-700">About Me (Bio)</label>
                  <span className="text-[11px] text-neutral-400">{customForm.bio.length}/160</span>
                </div>
                <textarea
                  rows={3}
                  maxLength={160}
                  value={customForm.bio}
                  onChange={(e) => setCustomForm({ ...customForm, bio: e.target.value })}
                  placeholder="Tell the community what you're building or studying..."
                  className="w-full px-3.5 py-2.5 border border-neutral-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-gouni-primary/20 outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCustomizeModal(false)}
                  className="flex-1 px-4 py-2.5 border border-neutral-200 rounded-xl text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="flex-1 px-4 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {savingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit display name modal */}
      {showEditName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowEditName(false)} />
          <div className="relative bg-white rounded-2xl shadow-float w-full max-w-sm animate-fade-up">
            <div className="flex items-center justify-between p-6 border-b border-neutral-100">
              <h2 className="text-lg font-bold text-neutral-900">Edit Display Name</h2>
              <button onClick={() => setShowEditName(false)} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-neutral-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-neutral-700 mb-2">New Display Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter your new display name"
                  className="w-full px-3.5 py-2.5 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-gouni-primary/20 focus:border-gouni-primary/40 outline-none text-sm transition-all"
                  autoFocus
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                <p className="text-[12px] text-yellow-800">
                  ⚠️ <strong>This is your only chance to change your display name.</strong> Choose wisely!
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowEditName(false)}
                  className="flex-1 px-4 py-2.5 border border-neutral-200 rounded-xl text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDisplayName}
                  disabled={editingName}
                  className="flex-1 px-4 py-2.5 bg-gouni-primary text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {editingName ? 'Updating...' : 'Save Name'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
