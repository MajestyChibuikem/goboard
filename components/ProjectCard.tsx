import React from 'react';
import { motion } from 'framer-motion';
import { Project } from '../types';
import { formatDate, getProjectBadges } from '../services/utils';
import { STATUS_CONFIG } from '../constants';
import { ChevronUp, MessageCircle, Bookmark, GitPullRequest, Star } from 'lucide-react';
import { UserAvatar } from './UserAvatar';
import { useResolvedUser } from '../contexts/UserCacheContext';

interface ProjectCardProps {
  project: Project;
  onClick: (project: Project) => void;
  onVote: (e: React.MouseEvent, projectId: string) => void;
  onToggleFavorite?: (e: React.MouseEvent, projectId: string) => void;
  voted?: boolean;
  favorited?: boolean;
  disabled?: boolean;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onClick, onVote, onToggleFavorite, voted, favorited, disabled }) => {
  const badges = getProjectBadges(project);
  const author = useResolvedUser(project.authorUid, project.displayName || project.studentName, project.authorPhotoURL);

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="group cursor-pointer"
      onClick={() => onClick(project)}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[16/10] w-full rounded-2xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 mb-4">
        <img
          src={project.imageUrl || undefined}
          alt={project.title}
          className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Status pill top-right */}
        <div className="absolute top-3 right-3">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm shadow-sm border border-transparent dark:border-neutral-700/50 ${STATUS_CONFIG[project.status].color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[project.status].dot}`} />
            {STATUS_CONFIG[project.status].label}
          </span>
        </div>

        {/* Badges floating top-left */}
        {(badges.length > 0 || project.openToContributions) && (
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            {project.openToContributions && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-600/95 dark:bg-emerald-600/90 backdrop-blur-sm text-white shadow-sm"
                title="Open to Pull Requests & Student Contributions"
              >
                <GitPullRequest className="w-3 h-3" /> Open to PRs
              </span>
            )}
            {badges.map((badge) => (
              <span
                key={badge.label}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm text-neutral-800 dark:text-neutral-200 shadow-sm border border-transparent dark:border-neutral-700/50"
              >
                <span className="mr-1">{badge.icon}</span> {badge.label}
              </span>
            ))}
          </div>
        )}

        {/* Category pill bottom-left */}
        <div className="absolute bottom-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <span className="px-3 py-1 rounded-full text-[11px] font-medium bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm text-neutral-700 dark:text-neutral-200 border border-transparent dark:border-neutral-700/50">
            {project.category}
          </span>
        </div>
      </div>

      {/* Content below thumbnail */}
      <div className="px-1">
        {/* Title + Vote row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-[15px] font-semibold text-neutral-900 dark:text-neutral-100 leading-snug group-hover:text-gouni-primary dark:group-hover:text-blue-400 transition-colors line-clamp-1">
            {project.title}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0">
            {onToggleFavorite && (
              <motion.button
                type="button"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.85 }}
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(e, project.id); }}
                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                  favorited
                    ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-neutral-400 dark:text-neutral-500 hover:text-blue-500 dark:hover:text-blue-400'
                }`}
                title={favorited ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Bookmark className={`w-3.5 h-3.5 ${favorited ? 'fill-current' : ''}`} />
              </motion.button>
            )}
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.82 }}
              onClick={(e) => { e.stopPropagation(); onVote(e, project.id); }}
              disabled={disabled}
              aria-pressed={!!voted}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-all group/vote cursor-pointer ${
                voted
                  ? 'border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400'
                  : 'border-neutral-200 dark:border-neutral-800 hover:border-orange-300 dark:hover:border-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/40'
              }`}
              title={voted ? 'Remove vote' : 'Upvote'}
            >
              <ChevronUp className={`w-3.5 h-3.5 ${voted ? 'text-orange-500' : 'text-neutral-400 dark:text-neutral-500 group-hover/vote:text-orange-500'}`} />
              <span className={`text-xs font-semibold ${voted ? 'text-orange-600 dark:text-orange-400' : 'text-neutral-600 dark:text-neutral-400 group-hover/vote:text-orange-600'}`}>{project.likes}</span>
            </motion.button>
          </div>
        </div>

        {/* Description */}
        <p className="text-[13px] text-neutral-500 dark:text-neutral-400 leading-relaxed line-clamp-2 mb-3">
          {project.description}
        </p>

        {/* Meta row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserAvatar
              uid={project.authorUid}
              photoURL={author.photoURL}
              fallbackName={author.displayName}
              size="sm"
            />
            <span className="text-[12px] text-neutral-500 dark:text-neutral-400">
              {author.displayName}
            </span>
          </div>

          <div className="flex items-center gap-3 text-[12px] text-neutral-400 dark:text-neutral-500">
            {project.githubMeta && (
              <span className="flex items-center gap-1 text-neutral-500 dark:text-neutral-400 font-medium" title={`GitHub Stars (${project.githubMeta.fullName})`}>
                <Star className="w-3 h-3 text-amber-500 fill-amber-400" />
                {project.githubMeta.stars}
              </span>
            )}
            {project.updates.length > 0 && (
              <span className="flex items-center gap-1" title={`${project.updates.length} updates`}>
                {project.updates.length} update{project.updates.length !== 1 ? 's' : ''}
              </span>
            )}
            {project.comments.length > 0 && (
              <span className="flex items-center gap-1">
                <MessageCircle className="w-3 h-3" />
                {project.comments.length}
              </span>
            )}
            <span>{formatDate(project.datePosted).split(',')[0]}</span>
          </div>
        </div>

        {/* Tech stack pills */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {project.techStack.slice(0, 3).map(tech => (
            <span key={tech} className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800/80 text-neutral-500 dark:text-neutral-400 text-[11px] rounded-md font-medium border border-transparent dark:border-neutral-700/40">
              {tech}
            </span>
          ))}
          {project.techStack.length > 3 && (
            <span className="px-2 py-0.5 text-neutral-400 dark:text-neutral-500 text-[11px] font-medium">
              +{project.techStack.length - 3}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};
