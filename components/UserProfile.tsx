import React, { useState, useEffect, useRef } from 'react';
import { useAuth, getRank, RANK_EMOJIS } from '../contexts/AuthContext';
import { getUserProjects } from '../services/firestoreService';
import { Project } from '../types';
import { ArrowLeft, Mail, Calendar, Zap, Trophy, Layers, Flame } from 'lucide-react';
import { formatDate } from '../services/utils';
import { STATUS_CONFIG } from '../constants';

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
  const { user, profile, updateProfilePhoto } = useAuth();
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (user) {
      getUserProjects(user.uid)
        .then(setMyProjects)
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // Optional: simple size guard (5MB)
    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setUploadError('Please choose an image smaller than 5MB.');
      return;
    }

    setUploading(true);
    try {
      await updateProfilePhoto(file);
    } catch (err) {
      setUploadError('Failed to upload profile photo. Please try again.');
      console.error(err);
    } finally {
      setUploading(false);
      // Reset the input so the same file can be selected again if needed
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  if (!user || !profile) return null;

  const currentTier = RANK_PROGRESS.find(t => profile.xp >= t.min && profile.xp <= t.max) || RANK_PROGRESS[0];
  const progressInTier = currentTier.max === Infinity
    ? 100
    : Math.round(((profile.xp - currentTier.min) / (currentTier.max - currentTier.min + 1)) * 100);

  return (
    <div className="animate-fade-up">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-400 hover:text-neutral-900 transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to projects
      </button>

      {/* Profile header */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-8 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Avatar + upload */}
          <div className="flex flex-col items-center gap-3">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="w-20 h-20 rounded-2xl object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gouni-secondary flex items-center justify-center text-3xl font-bold text-gouni-dark">
                {(user.displayName || 'S').charAt(0).toUpperCase()}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-[11px] font-medium text-gouni-primary hover:text-gouni-dark transition-colors disabled:opacity-60"
            >
              {uploading ? 'Uploading...' : user.photoURL ? 'Change photo' : 'Upload photo'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <div className="flex-grow">
            <h1 className="text-2xl font-bold text-neutral-900">{user.displayName || 'Student'}</h1>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-[13px] text-neutral-400">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> {user.email}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Joined {formatDate(profile.joinedAt).split(',')[0]}
              </span>
            </div>
          </div>

          {/* XP badge */}
          <div className="text-center sm:text-right shrink-0">
            <div className="text-3xl font-bold text-neutral-900">{profile.xp}</div>
            <div className="text-[11px] font-semibold text-gouni-primary uppercase tracking-wider">XP</div>
          </div>
        </div>

        {uploadError && (
          <p className="mt-3 text-[11px] text-red-500">
            {uploadError}
          </p>
        )}

        {/* Rank progress */}
        <div className="mt-6 pt-6 border-t border-neutral-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-base">{RANK_EMOJIS[profile.rank] || '🎓'}</span>
              <span className="text-[13px] font-bold text-neutral-900">{profile.rank}</span>
            </div>
            {currentTier.max !== Infinity && (
              <span className="text-[11px] text-neutral-400">{profile.xp}/{currentTier.max + 1} XP to next rank</span>
            )}
          </div>
          <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-gouni-primary to-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${progressInTier}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            {RANK_PROGRESS.map(tier => (
              <span
                key={tier.rank}
                className={`text-[10px] font-medium ${profile.xp >= tier.min ? 'text-neutral-600' : 'text-neutral-300'}`}
              >
                {tier.rank.split(' ').pop()}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 text-center">
          <div className="text-2xl font-bold text-neutral-900">{myProjects.length}</div>
          <div className="text-[12px] text-neutral-400 mt-1">Projects</div>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 text-center">
          <div className="text-2xl font-bold text-neutral-900">{myProjects.reduce((acc, p) => acc + p.likes, 0)}</div>
          <div className="text-[12px] text-neutral-400 mt-1">Total Votes</div>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 text-center">
          <div className="text-2xl font-bold text-neutral-900">{myProjects.reduce((acc, p) => acc + p.comments.length, 0)}</div>
          <div className="text-[12px] text-neutral-400 mt-1">Comments</div>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 text-center">
          <div className="text-2xl font-bold text-neutral-900">{profile.seasonXp}</div>
          <div className="text-[12px] text-neutral-400 mt-1">Season XP</div>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 text-center">
          <div className="flex items-center justify-center gap-1">
            <Flame className="w-5 h-5 text-orange-500" />
            <span className="text-2xl font-bold text-neutral-900">{profile.streakDays}</span>
          </div>
          <div className="text-[12px] text-neutral-400 mt-1">Day Streak</div>
        </div>
      </div>

      {/* My Projects */}
      <div>
        <h2 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
          <Layers className="w-5 h-5 text-neutral-400" />
          My Projects
        </h2>

        {loading ? (
          <div className="space-y-4">
            {[1,2].map(i => (
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
                  <img src={project.imageUrl} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-[14px] font-semibold text-neutral-900 truncate">{project.title}</h3>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_CONFIG[project.status].color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[project.status].dot}`} />
                      {STATUS_CONFIG[project.status].label}
                    </span>
                  </div>
                  <p className="text-[12px] text-neutral-400 truncate">{project.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[14px] font-semibold text-neutral-700">{project.likes}</div>
                  <div className="text-[10px] text-neutral-400">votes</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-2xl border border-neutral-200">
            <p className="text-[13px] text-neutral-400">You haven't submitted any projects yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};
