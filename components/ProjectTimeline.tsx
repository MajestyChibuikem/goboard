import React, { useState } from 'react';
import { ProjectUpdate, ProjectStatus } from '../types';
import { formatDate } from '../services/utils';
import { STATUS_CONFIG } from '../constants';
import { Flag, ChevronDown, ChevronUp, X } from 'lucide-react';

interface ProjectTimelineProps {
  updates: ProjectUpdate[];
  status: ProjectStatus;
  onAddUpdate?: (update: Omit<ProjectUpdate, 'id' | 'date'>) => void;
}

export const ProjectTimeline: React.FC<ProjectTimelineProps> = ({ updates, status, onAddUpdate }) => {
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const sortedUpdates = [...updates].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const statusConf = STATUS_CONFIG[status];
  const displayedUpdates = showAll ? sortedUpdates : sortedUpdates.slice(0, 3);
  const hasMore = sortedUpdates.length > 3;

  return (
    <div className="mb-10">
      {/* Section header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[13px] font-bold text-neutral-400 uppercase tracking-wider">Build Journey</h3>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${statusConf.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dot}`} />
          {statusConf.label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1 mb-8">
        {(['idea', 'in-progress', 'beta', 'launched'] as ProjectStatus[]).map((s, idx) => {
          const stages: ProjectStatus[] = ['idea', 'in-progress', 'beta', 'launched'];
          const currentIdx = stages.indexOf(status);
          const isActive = idx <= currentIdx;
          return (
            <div key={s} className="flex-1 flex flex-col items-center gap-1.5">
              <div className={`h-1.5 w-full rounded-full transition-all ${isActive ? STATUS_CONFIG[s].dot : 'bg-neutral-100'}`} />
              <span className={`text-[10px] font-medium ${isActive ? 'text-neutral-600' : 'text-neutral-300'}`}>
                {STATUS_CONFIG[s].label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Timeline */}
      {sortedUpdates.length > 0 ? (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-neutral-200" />

          <div className="space-y-0">
            {displayedUpdates.map((update, idx) => (
              <div key={update.id} className="relative flex gap-4 pb-8 last:pb-0">
                {/* Dot */}
                <div className="relative z-10 shrink-0">
                  {update.milestone ? (
                    <div className="w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center">
                      <Flag className="w-3.5 h-3.5 text-white" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-neutral-300 border-2 border-white" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-grow min-w-0 pt-1">
                  {update.milestone && (
                    <span className="inline-block text-[11px] font-bold text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded-md mb-1.5">
                      {update.milestone}
                    </span>
                  )}
                  <p className="text-[14px] text-neutral-600 leading-relaxed mb-2">{update.content}</p>

                  {update.imageUrl && (
                    <button
                      onClick={() => setExpandedImage(expandedImage === update.imageUrl ? null : update.imageUrl)}
                      className="mb-2 rounded-xl overflow-hidden border border-neutral-200 hover:border-neutral-300 transition-all inline-block"
                    >
                      <img
                        src={update.imageUrl}
                        alt="Update"
                        className="h-32 w-auto object-cover"
                      />
                    </button>
                  )}

                  <div className="text-[11px] text-neutral-400">{formatDate(update.date)}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Show more/less */}
          {hasMore && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="flex items-center gap-1.5 ml-12 mt-4 text-[12px] font-medium text-neutral-400 hover:text-neutral-700 transition-colors"
            >
              {showAll ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" /> Show less
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" /> Show {sortedUpdates.length - 3} more update{sortedUpdates.length - 3 !== 1 ? 's' : ''}
                </>
              )}
            </button>
          )}
        </div>
      ) : (
        <p className="text-[13px] text-neutral-400 text-center py-6">No updates posted yet.</p>
      )}

      {/* Lightbox for expanded image */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setExpandedImage(null)}
        >
          <button
            onClick={() => setExpandedImage(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={expandedImage}
            alt="Update"
            className="max-w-full max-h-[85vh] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
