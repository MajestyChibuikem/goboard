import React, { useEffect, useState } from 'react';
import {
  X,
  Trophy,
  Code2,
  Zap,
  ShieldCheck,
  Flame,
  Sparkles,
  GraduationCap,
  Calendar,
  Github,
  GitFork,
  GitCommit,
  Star,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import {
  getUserProfile,
  getUserApprovedProjects,
  getUserContributedProjects,
} from '../services/firestoreService';
import { getRank, RANK_EMOJIS, cleanOldFirebaseUrl } from '../services/utils';
import { Project, StudentVerificationStatus, GitHubProfileData } from '../types';
import { DISCORD_BANNER_PRESETS, GITHUB_LANGUAGE_COLORS } from '../constants';

interface PublicUserProfileData {
  uid: string;
  displayName: string;
  photoURL: string | null;
  xp: number;
  rank: string;
  streakDays: number;
  joinedAt: any;
  verificationStatus?: StudentVerificationStatus;
  totalGoCoinsEarned?: number;
  bannerPreset?: string;
  bannerUrl?: string | null;
  bio?: string;
  department?: string;
  academicLevel?: string;
  accentColor?: string;
  githubProfile?: GitHubProfileData | null;
}

interface PublicProfileModalProps {
  userId: string;
  onClose: () => void;
  onProjectClick?: (project: Project) => void;
}

export const PublicProfileModal: React.FC<PublicProfileModalProps> = ({
  userId,
  onClose,
  onProjectClick,
}) => {
  const [profile, setProfile] = useState<PublicUserProfileData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contributedProjects, setContributedProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const [userProfile, userProjects, userContributed] = await Promise.all([
          getUserProfile(userId),
          getUserApprovedProjects(userId),
          getUserContributedProjects(userId),
        ]);
        if (userProfile) {
          const d = userProfile as any;
          const xp = d.xp || 0;
          setProfile({
            uid: userId,
            displayName: d.displayName || 'Student',
            photoURL: cleanOldFirebaseUrl(d.photoURL) || null,
            xp,
            rank: d.rank || getRank(xp),
            streakDays: d.streakDays || 0,
            joinedAt: d.joinedAt,
            verificationStatus: d.verificationStatus || 'none',
            totalGoCoinsEarned: d.totalGoCoinsEarned || 0,
            bannerPreset: d.bannerPreset || 'gradient-blue',
            bannerUrl: cleanOldFirebaseUrl(d.bannerUrl) || null,
            bio: d.bio || '',
            department: d.department || '',
            academicLevel: d.academicLevel || '',
            accentColor: d.accentColor || '#1e3a8a',
            githubProfile: d.githubProfile || null,
          });
        }
        setProjects(userProjects.slice(0, 4));
        setContributedProjects(userContributed.slice(0, 4));
      } catch (err) {
        console.error('Failed to load user profile:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [userId]);

  const formatJoinDate = (joinedAt: any) => {
    try {
      let date: Date;
      if (joinedAt && typeof joinedAt === 'object' && 'toDate' in joinedAt) {
        date = joinedAt.toDate();
      } else if (joinedAt && typeof joinedAt === 'object' && 'seconds' in joinedAt) {
        date = new Date(joinedAt.seconds * 1000);
      } else if (typeof joinedAt === 'string') {
        date = new Date(joinedAt);
      } else {
        return 'Unknown';
      }
      if (isNaN(date.getTime())) return 'Unknown';
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch {
      return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-3xl border border-neutral-200 shadow-float p-8 w-full max-w-md text-center" onClick={e => e.stopPropagation()}>
          <div className="w-8 h-8 border-2 border-neutral-200 border-t-neutral-800 rounded-full animate-spin mx-auto mb-3" />
          <div className="text-sm text-neutral-400">Loading profile...</div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-3xl border border-neutral-200 shadow-float p-8 w-full max-w-md text-center" onClick={e => e.stopPropagation()}>
          <div className="text-sm text-neutral-400 mb-4">User not found</div>
          <button onClick={onClose} className="px-4 py-2 bg-neutral-900 text-white text-xs font-semibold rounded-xl">
            Close
          </button>
        </div>
      </div>
    );
  }

  const memberSince = formatJoinDate(profile.joinedAt);
  const bannerPresetKey = profile.bannerPreset || 'gradient-blue';
  const bannerPresetConfig = DISCORD_BANNER_PRESETS[bannerPresetKey] || DISCORD_BANNER_PRESETS['gradient-blue'];
  const accentColor = profile.accentColor || '#1e3a8a';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl border border-neutral-200 shadow-float w-full max-w-lg overflow-hidden animate-fade-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Discord-Style Top Banner ── */}
        <div
          data-sdk-banner-slot="true"
          className={`relative h-32 sm:h-36 w-full overflow-hidden ${!profile.bannerUrl ? bannerPresetConfig.className : 'bg-neutral-900'}`}
        >
          {profile.bannerUrl ? (
            <img
              src={profile.bannerUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.35) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.25) 0%, transparent 40%)',
              }}
            />
          )}

          {/* Close button floating on banner */}
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-black/45 hover:bg-black/65 text-white flex items-center justify-center transition-colors backdrop-blur-md"
            aria-label="Close profile"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Profile Body ── */}
        <div className="px-6 pb-6">
          {/* Overlapping Avatar + Badges */}
          <div className="flex items-end justify-between gap-3 -mt-11 mb-4 relative z-10">
            <div className="relative shrink-0">
              <div
                className="w-22 h-22 rounded-2xl p-1 bg-white shadow-md"
                style={{ boxShadow: `0 0 0 2px ${accentColor}25` }}
              >
                {profile.photoURL ? (
                  <img
                    src={profile.photoURL}
                    alt={profile.displayName}
                    className="w-20 h-20 rounded-xl object-cover"
                  />
                ) : (
                  <div
                    className="w-20 h-20 rounded-xl flex items-center justify-center text-white font-bold text-2xl"
                    style={{ backgroundColor: accentColor }}
                  >
                    {profile.displayName[0]?.toUpperCase() || 'S'}
                  </div>
                )}
              </div>
              <div
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg bg-white shadow-xs border border-neutral-200 flex items-center justify-center text-sm"
                title={profile.rank}
              >
                {RANK_EMOJIS[profile.rank] || '🎓'}
              </div>
            </div>

            {/* Badge Tray */}
            <div className="flex flex-wrap items-center justify-end gap-1.5 pb-1">
              {profile.verificationStatus === 'verified' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Verified Student
                </span>
              )}
              {profile.githubProfile?.username && (
                <a
                  href={profile.githubProfile.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-neutral-900 text-white hover:bg-neutral-800 transition-colors"
                >
                  <Github className="w-3 h-3" />
                  @{profile.githubProfile.displayUsername || profile.githubProfile.username}
                  {profile.githubProfile.isVerifiedOAuth && (
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                  )}
                </a>
              )}
              {profile.streakDays > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-orange-50 text-orange-700 border border-orange-200">
                  <Flame className="w-3.5 h-3.5 text-orange-500" />
                  {profile.streakDays}d
                </span>
              )}
              {(profile.totalGoCoinsEarned || 0) > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Season 1
                </span>
              )}
            </div>
          </div>

          {/* Identity Info */}
          <div className="mb-5">
            <h2 className="text-xl font-bold text-neutral-900">{profile.displayName}</h2>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-neutral-500">
              {(profile.department || profile.academicLevel) && (
                <span className="inline-flex items-center gap-1 font-medium text-neutral-700">
                  <GraduationCap className="w-3.5 h-3.5 text-neutral-400" />
                  {[profile.department, profile.academicLevel].filter(Boolean).join(' • ')}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-neutral-400">
                <Calendar className="w-3.5 h-3.5" />
                Member since {memberSince}
              </span>
            </div>

            {profile.bio && (
              <div className="mt-3 p-3.5 rounded-2xl bg-neutral-50 border border-neutral-100 text-xs text-neutral-600 leading-relaxed">
                {profile.bio}
              </div>
            )}
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-neutral-50 rounded-2xl p-3.5 border border-neutral-100">
              <div className="flex items-center gap-1.5 mb-1">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">XP</span>
              </div>
              <div className="text-xl font-bold text-neutral-900">{profile.xp.toLocaleString()}</div>
            </div>
            <div className="bg-neutral-50 rounded-2xl p-3.5 border border-neutral-100">
              <div className="flex items-center gap-1.5 mb-1">
                <Trophy className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Rank</span>
              </div>
              <div className="text-base font-bold text-neutral-900 truncate">{profile.rank}</div>
            </div>
          </div>

          {/* Compact GitHub Developer Card */}
          {profile.githubProfile && (
            <div className="mb-5 p-4 rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-800 text-white space-y-3">
              <div className="flex items-center justify-between gap-2">
                <a
                  href={profile.githubProfile.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-bold text-white hover:text-emerald-300 transition-colors"
                >
                  <Github className="w-4 h-4" />
                  @{profile.githubProfile.displayUsername || profile.githubProfile.username}
                  <ExternalLink className="w-3 h-3 text-neutral-400" />
                </a>
                <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full">
                  {profile.githubProfile.activeCodingDays30d || 0}d Active (30d)
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/10 rounded-xl py-2 px-2">
                  <div className="text-sm font-extrabold text-white flex items-center justify-center gap-1">
                    <GitCommit className="w-3.5 h-3.5 text-emerald-400" />
                    {profile.githubProfile.recentCommits30d || 0}
                  </div>
                  <div className="text-[10px] text-neutral-300">30d Commits</div>
                </div>
                <div className="bg-white/10 rounded-xl py-2 px-2">
                  <div className="text-sm font-extrabold text-white">
                    {profile.githubProfile.publicRepos || 0}
                  </div>
                  <div className="text-[10px] text-neutral-300">Repos</div>
                </div>
                <div className="bg-white/10 rounded-xl py-2 px-2">
                  <div className="text-sm font-extrabold text-white flex items-center justify-center gap-1">
                    <Star className="w-3 h-3 text-amber-400" />
                    {profile.githubProfile.totalStars || 0}
                  </div>
                  <div className="text-[10px] text-neutral-300">Stars</div>
                </div>
              </div>

              {profile.githubProfile.topLanguages && profile.githubProfile.topLanguages.length > 0 && (
                <div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden flex bg-white/10 mb-1.5">
                    {profile.githubProfile.topLanguages.map((lang) => (
                      <div
                        key={lang.name}
                        style={{
                          width: `${Math.max(lang.percentage, 8)}%`,
                          backgroundColor: GITHUB_LANGUAGE_COLORS[lang.name] || '#94a3b8',
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2.5 text-[10px] text-neutral-300">
                    {profile.githubProfile.topLanguages.slice(0, 4).map((lang) => (
                      <span key={lang.name} className="inline-flex items-center gap-1">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{
                            backgroundColor: GITHUB_LANGUAGE_COLORS[lang.name] || '#94a3b8',
                          }}
                        />
                        {lang.name} {lang.percentage}%
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Projects Section */}
          <div>
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5" />
              Projects ({projects.length})
            </h3>
            {projects.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => {
                      onProjectClick?.(project);
                      onClose();
                    }}
                    className="text-left p-3 bg-neutral-50 rounded-2xl border border-neutral-200/80 hover:border-neutral-300 hover:bg-neutral-100/70 transition-all group flex items-center gap-3"
                  >
                    {project.imageUrl ? (
                      <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-neutral-200">
                        <img
                          src={project.imageUrl}
                          alt={project.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-neutral-200 shrink-0 flex items-center justify-center">
                        <Code2 className="w-5 h-5 text-neutral-500" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-neutral-900 truncate group-hover:text-gouni-primary transition-colors">
                        {project.title}
                      </p>
                      <p className="text-[11px] text-neutral-400 truncate mt-0.5">{project.category}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 bg-neutral-50 rounded-2xl border border-neutral-100">
                <p className="text-xs text-neutral-400">No approved projects yet</p>
              </div>
            )}
          </div>

          {/* Open-Source Contributions Section */}
          {contributedProjects.length > 0 && (
            <div className="mt-5">
              <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <GitFork className="w-3.5 h-3.5" />
                Open-Source Contributions ({contributedProjects.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {contributedProjects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => {
                      onProjectClick?.(project);
                      onClose();
                    }}
                    className="text-left p-3 bg-emerald-50/50 rounded-2xl border border-emerald-200/80 hover:border-emerald-300 transition-all group flex items-center gap-3"
                  >
                    {project.imageUrl ? (
                      <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-emerald-200">
                        <img
                          src={project.imageUrl}
                          alt={project.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-emerald-100 shrink-0 flex items-center justify-center">
                        <GitFork className="w-5 h-5 text-emerald-700" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-neutral-900 truncate group-hover:text-emerald-700 transition-colors">
                        {project.title}
                      </p>
                      <p className="text-[11px] text-emerald-700 truncate mt-0.5">
                        By {project.displayName || project.studentName}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
