import React from 'react';
import { Writing, WritingGenre } from '../types';
import { formatDate } from '../services/utils';
import { ChevronUp, MessageCircle, BookOpen, Feather, ScrollText } from 'lucide-react';
import { UserAvatar } from './UserAvatar';
import { useResolvedUser } from '../contexts/UserCacheContext';

const GENRE_CONFIG: Record<WritingGenre, { label: string; icon: React.ReactNode; bg: string; text: string; border: string }> = {
  'short-story': {
    label: 'Short Story',
    icon: <BookOpen className="w-3.5 h-3.5" />,
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
  },
  poem: {
    label: 'Poem',
    icon: <Feather className="w-3.5 h-3.5" />,
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
  },
  essay: {
    label: 'Essay',
    icon: <ScrollText className="w-3.5 h-3.5" />,
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
};

const GENRE_HEADER_BG: Record<WritingGenre, string> = {
  'short-story': 'bg-gradient-to-br from-purple-50 to-purple-100/60',
  poem: 'bg-gradient-to-br from-rose-50 to-rose-100/60',
  essay: 'bg-gradient-to-br from-blue-50 to-blue-100/60',
};

interface WritingCardProps {
  writing: Writing;
  onClick: (writing: Writing) => void;
  onVote: (e: React.MouseEvent, writingId: string) => void;
  voted?: boolean;
  disabled?: boolean;
}

export const WritingCard: React.FC<WritingCardProps> = ({ writing, onClick, onVote, voted, disabled }) => {
  const genre = GENRE_CONFIG[writing.genre];
  const author = useResolvedUser(writing.authorUid, writing.displayName, writing.authorPhotoURL);
  const wordCount = writing.body.split(/\s+/).filter(Boolean).length;
  const excerpt = writing.body.length > 160 ? writing.body.slice(0, 160).trimEnd() + '…' : writing.body;

  return (
    <div
      className="group cursor-pointer animate-fade-up"
      onClick={() => onClick(writing)}
    >
      {/* Header preview area (replaces thumbnail) */}
      <div className={`relative aspect-[16/10] w-full rounded-2xl overflow-hidden ${GENRE_HEADER_BG[writing.genre]} mb-4 flex flex-col justify-between p-5`}>
        {/* Decorative lines */}
        <div className="space-y-2 opacity-30">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-1.5 rounded-full bg-current"
              style={{ width: `${75 - i * 8}%`, opacity: 1 - i * 0.1 }}
            />
          ))}
        </div>

        {/* Excerpt text overlay */}
        <div className="absolute inset-0 flex items-center px-5">
          <p className={`text-[12px] leading-relaxed font-serif line-clamp-4 ${genre.text} opacity-80`}>
            {excerpt}
          </p>
        </div>

        {/* Genre pill bottom-left */}
        <div className="relative z-10 self-end">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/90 backdrop-blur-sm shadow-sm border ${genre.border} ${genre.text}`}>
            {genre.icon}
            {genre.label}
          </span>
        </div>
      </div>

      {/* Content below header */}
      <div className="px-1">
        {/* Title + Vote row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-[15px] font-semibold text-neutral-900 leading-snug group-hover:text-gouni-primary transition-colors line-clamp-1">
            {writing.title}
          </h3>
          <button
            onClick={(e) => { e.stopPropagation(); onVote(e, writing.id); }}
            disabled={disabled}
            aria-pressed={!!voted}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-all shrink-0 group/vote ${
              voted
                ? 'border-orange-300 bg-orange-50 text-orange-600'
                : 'border-surface-border hover:border-orange-300 hover:bg-orange-50'
            }`}
            title={voted ? 'Remove vote' : 'Upvote'}
          >
            <ChevronUp className={`w-3.5 h-3.5 ${voted ? 'text-orange-500' : 'text-neutral-400 group-hover/vote:text-orange-500'}`} />
            <span className={`text-xs font-semibold ${voted ? 'text-orange-600' : 'text-neutral-600 group-hover/vote:text-orange-600'}`}>{writing.likes}</span>
          </button>
        </div>

        {/* Excerpt */}
        <p className="text-[13px] text-neutral-500 leading-relaxed line-clamp-2 mb-3">
          {writing.body}
        </p>

        {/* Meta row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserAvatar
              uid={writing.authorUid}
              photoURL={author.photoURL}
              fallbackName={author.displayName}
              size="sm"
            />
            <span className="text-[12px] text-neutral-500">{author.displayName}</span>
          </div>

          <div className="flex items-center gap-3 text-[12px] text-neutral-400">
            <span>{wordCount} words</span>
            {writing.comments.length > 0 && (
              <span className="flex items-center gap-1">
                <MessageCircle className="w-3 h-3" />
                {writing.comments.length}
              </span>
            )}
            <span>{formatDate(writing.datePosted).split(',')[0]}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
