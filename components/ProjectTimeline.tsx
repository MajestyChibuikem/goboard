import React, { useState, useEffect } from 'react';
import { ProjectUpdate, ProjectStatus, GitHubCommitItem } from '../types';
import { formatDate } from '../services/utils';
import { STATUS_CONFIG } from '../constants';
import { fetchRepoRecentCommits } from '../services/githubService';
import {
  Flag,
  ChevronDown,
  ChevronUp,
  X,
  GitCommit,
  ExternalLink,
  GitBranch,
  Layers,
  Sparkles,
} from 'lucide-react';

interface ProjectTimelineProps {
  updates: ProjectUpdate[];
  status: ProjectStatus;
  onAddUpdate?: (update: Omit<ProjectUpdate, 'id' | 'date'>) => void;
  repoUrl?: string;
}

type TimelineFilter = 'all' | 'milestones' | 'commits';

interface UnifiedTimelineEntry {
  id: string;
  isGitCommit: boolean;
  date: string;
  milestone?: string;
  content: string;
  imageUrl?: string;
  sha?: string;
  shortSha?: string;
  commitUrl?: string;
  authorName?: string;
  authorUsername?: string;
  authorAvatarUrl?: string;
}

export const ProjectTimeline: React.FC<ProjectTimelineProps> = ({
  updates = [],
  status,
  onAddUpdate,
  repoUrl,
}) => {
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [gitCommits, setGitCommits] = useState<GitHubCommitItem[]>([]);
  const [loadingCommits, setLoadingCommits] = useState<boolean>(false);
  const [filter, setFilter] = useState<TimelineFilter>('all');

  // Fetch git commits if repoUrl is present
  useEffect(() => {
    let isMounted = true;
    if (!repoUrl) {
      setGitCommits([]);
      return;
    }

    setLoadingCommits(true);
    fetchRepoRecentCommits(repoUrl, 20)
      .then((commits) => {
        if (isMounted) {
          setGitCommits(commits);
        }
      })
      .catch((err) => {
        console.warn('Failed to load repo commits for timeline:', err);
      })
      .finally(() => {
        if (isMounted) {
          setLoadingCommits(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [repoUrl]);

  // Transform manual updates to unified entries
  const manualEntries: UnifiedTimelineEntry[] = updates.map((u) => ({
    id: `manual-${u.id}`,
    isGitCommit: false,
    date: u.date,
    milestone: u.milestone,
    content: u.content,
    imageUrl: u.imageUrl,
  }));

  // Transform git commits to unified entries
  const commitEntries: UnifiedTimelineEntry[] = gitCommits.map((c) => ({
    id: `commit-${c.sha}`,
    isGitCommit: true,
    date: c.date,
    content: c.message,
    sha: c.sha,
    shortSha: c.shortSha,
    commitUrl: c.htmlUrl,
    authorName: c.authorName,
    authorUsername: c.authorUsername,
    authorAvatarUrl: c.authorAvatarUrl,
  }));

  // Combine and sort
  const combinedEntries = [...manualEntries, ...commitEntries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Filter based on selected tab
  const filteredEntries =
    filter === 'milestones'
      ? manualEntries.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )
      : filter === 'commits'
      ? commitEntries.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )
      : combinedEntries;

  const statusConf = STATUS_CONFIG[status] || STATUS_CONFIG['idea'];
  const INITIAL_DISPLAY_COUNT = 5;
  const displayedEntries = showAll
    ? filteredEntries
    : filteredEntries.slice(0, INITIAL_DISPLAY_COUNT);
  const hasMore = filteredEntries.length > INITIAL_DISPLAY_COUNT;

  const hasCommits = gitCommits.length > 0;
  const hasManual = updates.length > 0;

  return (
    <div className="mb-10">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2.5">
          <h3 className="text-[13px] font-bold text-neutral-400 uppercase tracking-wider">
            Build Journey
          </h3>
          {hasCommits && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200/60 dark:border-violet-800/60">
              <GitCommit className="w-3 h-3 text-violet-500" />
              Live Git Commits
            </span>
          )}
          {loadingCommits && (
            <span className="text-[11px] text-neutral-400 dark:text-neutral-500 animate-pulse">
              Syncing git history...
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${statusConf.color}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dot}`} />
            {statusConf.label}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="flex gap-1 mb-6">
        {(['idea', 'in-progress', 'beta', 'launched'] as ProjectStatus[]).map(
          (s, idx) => {
            const stages: ProjectStatus[] = ['idea', 'in-progress', 'beta', 'launched'];
            const currentIdx = stages.indexOf(status);
            const isActive = idx <= currentIdx;
            return (
              <div key={s} className="flex-1 flex flex-col items-center gap-1.5">
                <div
                  className={`h-1.5 w-full rounded-full transition-all ${
                    isActive
                      ? STATUS_CONFIG[s].dot
                      : 'bg-neutral-100 dark:bg-neutral-800'
                  }`}
                />
                <span
                  className={`text-[10px] font-medium ${
                    isActive
                      ? 'text-neutral-600 dark:text-neutral-300'
                      : 'text-neutral-300 dark:text-neutral-600'
                  }`}
                >
                  {STATUS_CONFIG[s].label}
                </span>
              </div>
            );
          }
        )}
      </div>

      {/* Activity Filter Tabs (if both manual updates and commits exist) */}
      {(hasCommits || hasManual) && (
        <div className="flex items-center justify-between flex-wrap gap-2 mb-6">
          <div className="inline-flex items-center bg-neutral-100 dark:bg-neutral-900 p-0.5 rounded-xl border border-neutral-200/60 dark:border-neutral-800 text-xs">
            <button
              type="button"
              onClick={() => {
                setFilter('all');
                setShowAll(false);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                filter === 'all'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-2xs font-semibold'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All Activity</span>
              <span className="text-[10px] opacity-75">
                ({combinedEntries.length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFilter('milestones');
                setShowAll(false);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                filter === 'milestones'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-2xs font-semibold'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              <Flag className="w-3.5 h-3.5" />
              <span>Milestones</span>
              <span className="text-[10px] opacity-75">({updates.length})</span>
            </button>

            {hasCommits && (
              <button
                type="button"
                onClick={() => {
                  setFilter('commits');
                  setShowAll(false);
                }}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                  filter === 'commits'
                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-2xs font-semibold'
                    : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                }`}
              >
                <GitCommit className="w-3.5 h-3.5 text-violet-500" />
                <span>Git Commits</span>
                <span className="text-[10px] opacity-75">
                  ({gitCommits.length})
                </span>
              </button>
            )}
          </div>

          {repoUrl && hasCommits && (
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors"
            >
              <GitBranch className="w-3 h-3" />
              <span>View repo history</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          )}
        </div>
      )}

      {/* Timeline List */}
      {filteredEntries.length > 0 ? (
        <div className="relative">
          {/* Vertical Connecting Line */}
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-neutral-200 dark:bg-neutral-800" />

          <div className="space-y-0">
            {displayedEntries.map((entry) => (
              <div key={entry.id} className="relative flex gap-4 pb-7 last:pb-0">
                {/* Node Icon */}
                <div className="relative z-10 shrink-0">
                  {entry.isGitCommit ? (
                    <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800/60 flex items-center justify-center text-violet-600 dark:text-violet-400 shadow-2xs">
                      <GitCommit className="w-4 h-4" />
                    </div>
                  ) : entry.milestone ? (
                    <div className="w-8 h-8 rounded-full bg-neutral-900 dark:bg-neutral-800 border dark:border-neutral-700 flex items-center justify-center text-white shadow-2xs">
                      <Flag className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-neutral-300 dark:bg-neutral-700 border-2 border-white dark:border-neutral-950" />
                    </div>
                  )}
                </div>

                {/* Entry Content */}
                <div className="flex-grow min-w-0 pt-0.5">
                  {/* Badges / Header line */}
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    {entry.isGitCommit ? (
                      <>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/50 border border-violet-200/60 dark:border-violet-800/60 px-2 py-0.5 rounded-md">
                          Git Commit
                        </span>
                        {entry.commitUrl && entry.shortSha && (
                          <a
                            href={entry.commitUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800/80 hover:bg-neutral-200 dark:hover:bg-neutral-750 border border-neutral-200/60 dark:border-neutral-700/60 px-1.5 py-0.5 rounded transition-colors"
                            title="View commit on GitHub"
                          >
                            <span>#{entry.shortSha}</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                          </a>
                        )}
                        {entry.authorName && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                            {entry.authorAvatarUrl ? (
                              <img
                                src={entry.authorAvatarUrl}
                                alt={entry.authorName}
                                className="w-4 h-4 rounded-full object-cover"
                              />
                            ) : null}
                            <span>{entry.authorName}</span>
                          </span>
                        )}
                      </>
                    ) : (
                      entry.milestone && (
                        <span className="inline-block text-[11px] font-bold text-neutral-900 dark:text-neutral-100 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-md">
                          {entry.milestone}
                        </span>
                      )
                    )}
                  </div>

                  {/* Body text */}
                  <p className="text-[13.5px] text-neutral-700 dark:text-neutral-300 leading-relaxed mb-2 whitespace-pre-line font-normal">
                    {entry.content}
                  </p>

                  {/* Optional Image Attachment (manual updates) */}
                  {entry.imageUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedImage(
                          expandedImage === entry.imageUrl ? null : entry.imageUrl!
                        )
                      }
                      className="mb-2 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all inline-block cursor-pointer"
                    >
                      <img
                        src={entry.imageUrl}
                        alt="Project milestone preview"
                        className="h-32 w-auto object-cover"
                      />
                    </button>
                  )}

                  {/* Timestamp */}
                  <div className="text-[11px] text-neutral-400 dark:text-neutral-500">
                    {formatDate(entry.date)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Show More / Show Less */}
          {hasMore && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="flex items-center gap-1.5 ml-12 mt-4 text-[12px] font-semibold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors cursor-pointer"
            >
              {showAll ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" /> Show fewer updates
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" /> Show {filteredEntries.length - INITIAL_DISPLAY_COUNT} older update
                  {filteredEntries.length - INITIAL_DISPLAY_COUNT !== 1 ? 's' : ''}
                </>
              )}
            </button>
          )}
        </div>
      ) : (
        <div className="text-center py-8 px-4 rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800">
          <p className="text-[13px] text-neutral-500 dark:text-neutral-400 font-medium mb-1">
            {filter === 'milestones'
              ? 'No manual milestones posted yet.'
              : filter === 'commits'
              ? 'No recent git commits found for this repository.'
              : 'No build updates or commits recorded yet.'}
          </p>
          <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
            {repoUrl
              ? 'Pushes made to the connected GitHub repository automatically appear here.'
              : 'The author can post milestones or connect a GitHub repository to track progress.'}
          </p>
        </div>
      )}

      {/* Lightbox for expanded image */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setExpandedImage(null)}
        >
          <button
            type="button"
            onClick={() => setExpandedImage(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={expandedImage}
            alt="Expanded update preview"
            className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
