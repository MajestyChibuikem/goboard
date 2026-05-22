import React, { useState } from 'react';
import { Writing, Comment, WritingGenre } from '../types';
import { formatDate } from '../services/utils';
import { ArrowLeft, ChevronUp, AlertCircle, Trash2, BookOpen, Feather, ScrollText } from 'lucide-react';
import { Button } from './Button';
import { CommentSection } from './CommentSection';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './Toast';
import { addWritingComment, awardCommentXP, deleteWriting, suspendWriting, restoreWriting } from '../services/firestoreService';
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

interface WritingDetailViewProps {
  writing: Writing;
  onBack: () => void;
  onUpdateWriting: (writing: Writing) => void;
  onVote: (e: React.MouseEvent, writingId: string) => void;
  onRequireAuth: () => void;
  onProfileClick?: (userId: string) => void;
  voted?: boolean;
  disabled?: boolean;
}

export const WritingDetailView: React.FC<WritingDetailViewProps> = ({
  writing,
  onBack,
  onUpdateWriting,
  onVote,
  onRequireAuth,
  onProfileClick,
  voted,
  disabled,
}) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const genre = GENRE_CONFIG[writing.genre];
  const author = useResolvedUser(writing.authorUid, writing.displayName, writing.authorPhotoURL);
  const wordCount = writing.body.split(/\s+/).filter(Boolean).length;
  const readingMinutes = Math.max(1, Math.round(wordCount / 200));

  const handleAddComment = async (newComment: Comment) => {
    onUpdateWriting({ ...writing, comments: [...writing.comments, newComment] });
    try {
      await addWritingComment(writing.id, newComment);
      if (user) {
        await awardCommentXP(user.uid, writing.id, writing.authorUid);
      }
      toast('Comment posted!', 'success');
    } catch (err) {
      console.error('Failed to save comment:', err);
      toast('Failed to post comment.', 'error');
    }
  };

  const handleDelete = async () => {
    if (!user || !profile?.isAdmin) return;
    setIsProcessing(true);
    try {
      await deleteWriting(writing.id, user.uid);
      toast('Writing deleted permanently', 'success');
      onBack();
    } catch (err) {
      console.error('Failed to delete:', err);
      toast('Failed to delete writing', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSuspend = async () => {
    if (!user || !profile?.isAdmin) return;
    if (!suspensionReason.trim()) {
      toast('Please provide a reason for suspension', 'error');
      return;
    }
    setIsProcessing(true);
    try {
      await suspendWriting(writing.id, user.uid, suspensionReason);
      onUpdateWriting({ ...writing, isSuspended: true, suspensionReason });
      toast('Writing suspended', 'success');
      setShowSuspendModal(false);
    } catch (err) {
      console.error('Failed to suspend:', err);
      toast('Failed to suspend writing', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = async () => {
    if (!user || !profile?.isAdmin) return;
    setIsProcessing(true);
    try {
      await restoreWriting(writing.id, user.uid);
      onUpdateWriting({ ...writing, isSuspended: false, suspendedBy: undefined, suspendedAt: undefined, suspensionReason: undefined });
      toast('Writing restored', 'success');
      setShowSuspendModal(false);
    } catch (err) {
      console.error('Failed to restore:', err);
      toast('Failed to restore writing', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="animate-fade-up">

      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-400 hover:text-neutral-900 transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Lit Club
      </button>

      {/* Hero */}
      <div className="mb-10">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h1 className="text-3xl font-bold text-neutral-900 tracking-tight">{writing.title}</h1>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${genre.bg} ${genre.text} ${genre.border}`}>
            {genre.icon}
            {genre.label}
          </span>
          {writing.isSuspended && (
            <span className="inline-block px-3 py-1 bg-amber-100 border border-amber-300 rounded-full text-[11px] font-semibold text-amber-700">
              ⚠️ Suspended
            </span>
          )}
          {writing.approvalStatus === 'pending' && (
            <span className="inline-block px-3 py-1 bg-blue-100 border border-blue-300 rounded-full text-[11px] font-semibold text-blue-700">
              ⏳ Pending Review
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-400">
          <span>Posted {formatDate(writing.datePosted)}</span>
          <span className="text-neutral-200">|</span>
          <span className="flex items-center gap-1.5">
            <UserAvatar uid={writing.authorUid} photoURL={author.photoURL} fallbackName={author.displayName} size="xs" />
            <button
              type="button"
              onClick={() => writing.authorUid && onProfileClick?.(writing.authorUid)}
              className="font-medium text-neutral-700 hover:text-neutral-900 hover:underline transition-colors cursor-pointer"
            >
              {author.displayName}
            </button>
          </span>
          <span className="text-neutral-200">|</span>
          <span>{wordCount} words · {readingMinutes} min read</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

        {/* ── Left: Body + Comments ── */}
        <div className="lg:col-span-2">

          {/* Full writing body */}
          <div className="mb-12 bg-white rounded-2xl border border-neutral-200 p-8">
            <p className="font-serif text-[16px] leading-[1.9] text-neutral-800 whitespace-pre-wrap">
              {writing.body}
            </p>
          </div>

          {/* Comments */}
          <CommentSection
            comments={writing.comments}
            onAddComment={handleAddComment}
            onRequireAuth={onRequireAuth}
            onProfileClick={onProfileClick}
            updates={[]}
            projectId={writing.id}
          />
        </div>

        {/* ── Right: Sidebar ── */}
        <div className="space-y-5">

          {/* Actions */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-5 space-y-3">
            <Button
              onClick={(e) => onVote(e, writing.id)}
              variant="outline"
              disabled={disabled || !user}
              aria-pressed={!!voted}
              className={`w-full justify-center rounded-xl border-orange-200 hover:bg-orange-50 hover:border-orange-300 ${
                voted ? 'bg-orange-50 text-orange-600 border-orange-300' : 'text-neutral-700'
              }`}
            >
              <ChevronUp className={`w-4 h-4 ${voted ? 'text-orange-500' : ''}`} />
              {voted ? `Upvoted (${writing.likes})` : `Upvote (${writing.likes})`}
            </Button>

            {profile?.isAdmin && (
              <div className="flex gap-2 pt-3 border-t border-neutral-200">
                <Button
                  size="sm"
                  variant="outline"
                  className={`flex-1 rounded-xl ${
                    writing.isSuspended
                      ? 'text-green-700 border-green-300 hover:bg-green-50'
                      : 'text-amber-700 border-amber-300 hover:bg-amber-50'
                  }`}
                  onClick={() => setShowSuspendModal(true)}
                >
                  <AlertCircle className="w-4 h-4" /> {writing.isSuspended ? 'Restore' : 'Suspend'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-red-700 border-red-300 hover:bg-red-50 rounded-xl"
                  onClick={() => setShowDeleteModal(true)}
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </Button>
              </div>
            )}
          </div>

          {/* Author */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-5">
            <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-4">Author</h4>
            <div className="flex items-center gap-3">
              <UserAvatar uid={writing.authorUid} photoURL={author.photoURL} fallbackName={author.displayName} size="lg" className="rounded-xl" />
              <div>
                <div className="text-[14px] font-semibold text-neutral-900">{author.displayName}</div>
                <div className="text-[12px] text-neutral-400">{wordCount} words written</div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-5">
            <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-4">Stats</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-[13px]">
                <span className="text-neutral-400">Upvotes</span>
                <span className="font-semibold text-neutral-900">{writing.likes}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-neutral-400">Comments</span>
                <span className="font-semibold text-neutral-900">{writing.comments.length}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-neutral-400">Word count</span>
                <span className="font-semibold text-neutral-900">{wordCount}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-neutral-400">Reading time</span>
                <span className="font-semibold text-neutral-900">{readingMinutes} min</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && profile?.isAdmin && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-float p-6 w-96 animate-fade-up">
            <h3 className="text-lg font-bold text-red-600 mb-2">Delete Writing?</h3>
            <p className="text-sm text-neutral-600 mb-4">
              This will permanently delete the writing and all associated votes and comments. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowDeleteModal(false)} disabled={isProcessing}>Cancel</Button>
              <Button variant="primary" className="bg-red-600 hover:bg-red-700" onClick={handleDelete} isLoading={isProcessing}>
                Delete Permanently
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend/Restore Modal */}
      {showSuspendModal && profile?.isAdmin && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-float p-6 w-96 animate-fade-up">
            {writing.isSuspended ? (
              <>
                <h3 className="text-lg font-bold text-green-600 mb-2">Restore Writing?</h3>
                <p className="text-sm text-neutral-600 mb-4">This will restore the writing to public view. The author will be notified.</p>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowSuspendModal(false)} disabled={isProcessing}>Cancel</Button>
                  <Button variant="primary" className="bg-green-600 hover:bg-green-700" onClick={handleRestore} isLoading={isProcessing}>
                    Restore Writing
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-amber-600 mb-2">Suspend Writing?</h3>
                <p className="text-sm text-neutral-600 mb-3">The writing will be hidden from public view. The author will be notified.</p>
                <textarea
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  placeholder="Reason for suspension (will be sent to author)..."
                  className="w-full p-3 border border-neutral-200 rounded-xl mb-4 text-sm font-sans resize-none"
                  rows={3}
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => { setShowSuspendModal(false); setSuspensionReason(''); }} disabled={isProcessing}>Cancel</Button>
                  <Button variant="primary" className="bg-amber-600 hover:bg-amber-700" onClick={handleSuspend} isLoading={isProcessing}>
                    Suspend Writing
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
