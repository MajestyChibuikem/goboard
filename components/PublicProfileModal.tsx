import React, { useEffect, useState } from 'react';
import { ArrowLeft, Trophy, Code2, Zap } from 'lucide-react';
import { getUserProfile, getUserProjects } from '../services/firestoreService';
import { Project } from '../types';

interface UserProfile {
  uid: string;
  displayName: string;
  email?: string;
  photoURL: string | null;
  xp: number;
  rank?: string;
  joinedAt: string | any; // Can be Firestore timestamp or string
}

interface PublicProfileModalProps {
  userId: string;
  onClose: () => void;
  onProjectClick?: (project: Project) => void;
}

export const PublicProfileModal: React.FC<PublicProfileModalProps> = ({ userId, onClose, onProjectClick }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const userProfile = await getUserProfile(userId);
        if (userProfile) {
          setProfile(userProfile);
        }
        const userProjects = await getUserProjects(userId);
        setProjects(userProjects.filter(p => p.approvalStatus === 'approved').slice(0, 4));
      } catch (err) {
        console.error('Failed to load user profile:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [userId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-float p-6 w-96">
          <div className="text-center text-neutral-400">Loading...</div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-float p-6 w-96">
          <div className="text-center text-neutral-400">User not found</div>
        </div>
      </div>
    );
  }

  // Handle both Firestore timestamps and string dates
  const formatJoinDate = (joinedAt: any) => {
    try {
      let date: Date;

      // Check if it's a Firestore timestamp object
      if (joinedAt && typeof joinedAt === 'object' && 'toDate' in joinedAt) {
        date = joinedAt.toDate();
      } else if (joinedAt && typeof joinedAt === 'object' && 'seconds' in joinedAt) {
        // Firestore timestamp format: { seconds: number, nanoseconds: number }
        date = new Date(joinedAt.seconds * 1000);
      } else if (typeof joinedAt === 'string') {
        date = new Date(joinedAt);
      } else {
        return 'Unknown';
      }

      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Unknown';
      }

      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch (err) {
      console.error('Error formatting date:', err);
      return 'Unknown';
    }
  };

  const memberSince = formatJoinDate(profile.joinedAt);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-float w-full max-w-sm md:max-w-xl overflow-hidden animate-fade-up max-h-[90vh] overflow-y-auto">
        {/* Header with back button */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <span className="text-sm text-neutral-400">Profile</span>
        </div>

        {/* Profile content */}
        <div className="p-6 md:p-8">
          {/* User info section */}
          <div className="text-center mb-8 md:mb-10">
            {profile.photoURL ? (
              <img
                src={profile.photoURL}
                alt={profile.displayName}
                className="w-20 h-20 md:w-24 md:h-24 rounded-full mx-auto mb-4 object-cover border-2 border-neutral-200"
              />
            ) : (
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full mx-auto mb-4 bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-3xl md:text-4xl">
                {profile.displayName[0]?.toUpperCase()}
              </div>
            )}
            <h2 className="text-2xl md:text-3xl font-bold text-neutral-900 mb-2">{profile.displayName}</h2>
            <p className="text-sm md:text-base text-neutral-500">Member since {memberSince}</p>
          </div>

          {/* Stats section */}
          <div className="grid grid-cols-2 gap-3 md:gap-4 mb-8 md:mb-10">
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 md:p-5 border border-amber-100">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-medium text-amber-700">XP</span>
              </div>
              <div className="text-2xl md:text-3xl font-bold text-amber-900">{profile.xp || 0}</div>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 md:p-5 border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-medium text-blue-700">Rank</span>
              </div>
              <div className="text-2xl md:text-3xl font-bold text-blue-900">{profile.rank || 'Freshman Coder'}</div>
            </div>
          </div>

          {/* Projects section */}
          {projects.length > 0 && (
            <div>
              <h3 className="text-sm md:text-base font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <Code2 className="w-4 h-4 text-neutral-600" />
                Projects ({projects.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                {projects.map(project => (
                  <button
                    key={project.id}
                    onClick={() => {
                      onProjectClick?.(project);
                      onClose();
                    }}
                    className="text-left p-4 md:p-5 bg-neutral-50 rounded-lg border border-neutral-200 hover:border-neutral-400 hover:bg-neutral-100 transition-all group"
                  >
                    <div className="flex gap-3">
                      {/* Project image thumbnail */}
                      {project.imageUrl && (
                        <div className="w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden flex-shrink-0 border border-neutral-200">
                          <img
                            src={project.imageUrl}
                            alt={project.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
                      )}
                      {!project.imageUrl && (
                        <div className="w-16 h-16 md:w-20 md:h-20 rounded-lg bg-gradient-to-br from-neutral-300 to-neutral-400 flex-shrink-0 flex items-center justify-center">
                          <Code2 className="w-6 h-6 text-neutral-600" />
                        </div>
                      )}

                      {/* Project info */}
                      <div className="flex-grow min-w-0">
                        <p className="text-sm md:text-base font-medium text-neutral-900 line-clamp-2 group-hover:text-gouni-primary transition-colors">
                          {project.title}
                        </p>
                        <p className="text-xs md:text-sm text-neutral-500 mt-1">
                          {project.category}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {projects.length === 0 && (
            <div className="text-center py-4">
              <p className="text-sm text-neutral-400">No projects yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
