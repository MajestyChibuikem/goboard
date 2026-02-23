import React from 'react';
import { Project } from '../types';
import { formatDate, getProjectBadges } from '../services/utils';
import { STATUS_CONFIG } from '../constants';
import { ChevronUp, MessageCircle } from 'lucide-react';

interface ProjectCardProps {
  project: Project;
  onClick: (project: Project) => void;
  onVote: (e: React.MouseEvent, projectId: string) => void;
  voted?: boolean;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onClick, onVote, voted }) => {
  const badges = getProjectBadges(project);

  return (
    <div
      className="group cursor-pointer animate-fade-up"
      onClick={() => onClick(project)}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[16/10] w-full rounded-2xl overflow-hidden bg-neutral-100 mb-4">
        <img
          src={project.imageUrl}
          alt={project.title}
          className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Status pill top-right */}
        <div className="absolute top-3 right-3">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/90 backdrop-blur-sm shadow-sm ${STATUS_CONFIG[project.status].color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[project.status].dot}`} />
            {STATUS_CONFIG[project.status].label}
          </span>
        </div>

        {/* Badges floating top-left */}
        {badges.length > 0 && (
          <div className="absolute top-3 left-3 flex gap-1.5">
            {badges.map((badge) => (
              <span
                key={badge.label}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/90 backdrop-blur-sm text-neutral-800 shadow-sm"
              >
                <span className="mr-1">{badge.icon}</span> {badge.label}
              </span>
            ))}
          </div>
        )}

        {/* Category pill bottom-left */}
        <div className="absolute bottom-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <span className="px-3 py-1 rounded-full text-[11px] font-medium bg-white/90 backdrop-blur-sm text-neutral-700">
            {project.category}
          </span>
        </div>
      </div>

      {/* Content below thumbnail */}
      <div className="px-1">
        {/* Title + Vote row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-[15px] font-semibold text-neutral-900 leading-snug group-hover:text-gouni-primary transition-colors line-clamp-1">
            {project.title}
          </h3>
          <button
            onClick={(e) => { e.stopPropagation(); onVote(e, project.id); }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-all shrink-0 group/vote ${
              voted
                ? 'border-orange-300 bg-orange-50 text-orange-600'
                : 'border-surface-border hover:border-orange-300 hover:bg-orange-50'
            }`}
            title={voted ? 'Remove vote' : 'Upvote'}
          >
            <ChevronUp className={`w-3.5 h-3.5 ${voted ? 'text-orange-500' : 'text-neutral-400 group-hover/vote:text-orange-500'}`} />
            <span className={`text-xs font-semibold ${voted ? 'text-orange-600' : 'text-neutral-600 group-hover/vote:text-orange-600'}`}>{project.likes}</span>
          </button>
        </div>

        {/* Description */}
        <p className="text-[13px] text-neutral-500 leading-relaxed line-clamp-2 mb-3">
          {project.description}
        </p>

        {/* Meta row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Author avatar */}
            <div className="w-6 h-6 rounded-full bg-gouni-secondary/80 flex items-center justify-center text-[10px] font-bold text-gouni-dark">
              {project.studentName.charAt(0)}
            </div>
            <span className="text-[12px] text-neutral-500">
              {project.studentName}
            </span>
          </div>

          <div className="flex items-center gap-3 text-[12px] text-neutral-400">
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
            <span key={tech} className="px-2 py-0.5 bg-neutral-100 text-neutral-500 text-[11px] rounded-md font-medium">
              {tech}
            </span>
          ))}
          {project.techStack.length > 3 && (
            <span className="px-2 py-0.5 text-neutral-400 text-[11px] font-medium">
              +{project.techStack.length - 3}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
