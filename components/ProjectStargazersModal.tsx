import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { Project } from '../types';
import { getProjectVoters, ProjectVoterInfo } from '../services/firestoreService';
import { fetchRepoStargazers, GitHubStargazerItem } from '../services/githubService';
import { formatDate } from '../services/utils';
import {
  X,
  Heart,
  Star,
  Users,
  ExternalLink,
  Shield,
  Github,
  Loader2,
  Sparkles,
} from 'lucide-react';

interface ProjectStargazersModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onSelectUser?: (uid: string) => void;
}

export const ProjectStargazersModal: React.FC<ProjectStargazersModalProps> = ({
  isOpen,
  onClose,
  project,
  onSelectUser,
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'supporters' | 'github'>('supporters');
  const [voters, setVoters] = useState<ProjectVoterInfo[]>([]);
  const [loadingVoters, setLoadingVoters] = useState(true);
  const [stargazers, setStargazers] = useState<GitHubStargazerItem[]>([]);
  const [loadingStargazers, setLoadingStargazers] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    if (user) {
      setLoadingVoters(true);
      getProjectVoters(project.id)
        .then((data) => {
          if (isMounted) {
            setVoters(data);
          }
        })
        .finally(() => {
          if (isMounted) setLoadingVoters(false);
        });
    } else {
      setVoters([]);
      setLoadingVoters(false);
    }

    if (project.repoUrl) {
      setLoadingStargazers(true);
      fetchRepoStargazers(project.repoUrl, 50)
        .then((stars) => {
          if (isMounted) {
            setStargazers(stars);
          }
        })
        .finally(() => {
          if (isMounted) setLoadingStargazers(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen, project.id, project.repoUrl, user]);

  if (!isOpen) return null;

  const hasRepo = Boolean(project.repoUrl);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          onClick={onClose}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden z-10 flex flex-col max-h-[85vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-neutral-900 dark:text-white">
                  Supporters & Stargazers
                </h3>
                <p className="text-xs text-neutral-500 truncate max-w-[280px]">
                  {project.title}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Segmented Tabs */}
          {hasRepo && (
            <div className="px-6 pt-3 pb-1 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-850/40">
              <div className="inline-flex items-center gap-1 p-1 bg-neutral-200/60 dark:bg-neutral-800 rounded-xl text-xs font-semibold w-full">
                <button
                  type="button"
                  onClick={() => setActiveTab('supporters')}
                  className={`flex-1 py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'supporters'
                      ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-2xs'
                      : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
                  }`}
                >
                  <Heart className="w-3.5 h-3.5 text-orange-500" />
                  <span>GoBoard Upvotes {user ? `(${voters.length})` : ''}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('github')}
                  className={`flex-1 py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'github'
                      ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-2xs'
                      : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
                  }`}
                >
                  <Star className="w-3.5 h-3.5 text-amber-500" />
                  <span>GitHub Stars ({stargazers.length})</span>
                </button>
              </div>
            </div>
          )}

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-2">
            {activeTab === 'supporters' ? (
              !user ? (
                <div className="py-12 text-center text-neutral-400 space-y-2">
                  <Shield className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mx-auto" />
                  <div className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                    Sign in to view student supporters
                  </div>
                  <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                    Logged in students can view who upvoted this project.
                  </p>
                </div>
              ) : loadingVoters ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-neutral-400">
                  <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                  <span className="text-xs">Loading supporters...</span>
                </div>
              ) : voters.length === 0 ? (
                <div className="py-12 text-center text-neutral-400 space-y-2">
                  <Heart className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mx-auto" />
                  <div className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                    No upvotes recorded yet
                  </div>
                  <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                    Be the first student to upvote and support this project!
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {voters.map((voter) => (
                    <div
                      key={voter.userId}
                      onClick={() => {
                        if (onSelectUser) {
                          onClose();
                          onSelectUser(voter.userId);
                        }
                      }}
                      className={`p-3 rounded-2xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-850/50 flex items-center justify-between gap-3 transition-all ${
                        onSelectUser ? 'hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {voter.photoURL ? (
                          <img
                            src={voter.photoURL}
                            alt={voter.displayName}
                            className="w-9 h-9 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold flex items-center justify-center text-xs shrink-0">
                            {voter.displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                            {voter.displayName}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                            {voter.department && (
                              <span className="truncate">{voter.department}</span>
                            )}
                            {voter.rank && (
                              <span className="inline-block px-1.5 py-0.2 rounded text-[9.5px] font-semibold bg-neutral-200/70 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
                                {voter.rank}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {voter.votedAt && (
                        <span className="text-[10px] text-neutral-400 shrink-0">
                          {formatDate(voter.votedAt)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )
            ) : loadingStargazers ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-neutral-400">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                <span className="text-xs">Fetching stargazers from GitHub...</span>
              </div>
            ) : stargazers.length === 0 ? (
              <div className="py-12 text-center text-neutral-400 space-y-2">
                <Star className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mx-auto" />
                <div className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                  No GitHub stars yet
                </div>
                <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                  Star this project on GitHub to support the author&apos;s open-source work!
                </p>
                {project.repoUrl && (
                  <a
                    href={project.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold mt-2"
                  >
                    <Github className="w-3.5 h-3.5" /> Star on GitHub
                  </a>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {stargazers.map((star) => (
                  <a
                    key={star.username}
                    href={star.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-2xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-850/50 flex items-center justify-between gap-3 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={star.avatarUrl}
                        alt={star.username}
                        className="w-9 h-9 rounded-full object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-1.5 truncate">
                          <span>@{star.username}</span>
                        </div>
                        <div className="text-[11px] text-neutral-500">
                          GitHub Stargazer
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {star.starredAt && (
                        <span className="text-[10px] text-neutral-400">
                          {formatDate(star.starredAt)}
                        </span>
                      )}
                      <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-950/40 flex items-center justify-between text-xs text-neutral-500">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              {activeTab === 'supporters'
                ? !user
                  ? 'Sign in required'
                  : `${voters.length} student supporter${voters.length !== 1 ? 's' : ''}`
                : `${stargazers.length} GitHub stargazer${stargazers.length !== 1 ? 's' : ''}`}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="font-semibold text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 cursor-pointer"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ProjectStargazersModal;
