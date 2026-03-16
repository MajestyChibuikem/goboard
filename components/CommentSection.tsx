import React, { useState } from 'react';
import { Comment, ProjectUpdate } from '../types';
import { generateAnonymousName, formatDate } from '../services/utils';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './Button';
import { MessageSquare, Send, Lock, Reply } from 'lucide-react';
import { UserAvatar } from './UserAvatar';

interface CommentSectionProps {
  comments: Comment[];
  onAddComment: (comment: Comment) => void;
  onRequireAuth: () => void;
  onProfileClick?: (userId: string) => void;
  updates?: ProjectUpdate[]; // NEW: For grouping comments by update
  projectId?: string; // NEW: For update-specific comments
}

export const CommentSection: React.FC<CommentSectionProps> = ({
  comments,
  onAddComment,
  onRequireAuth,
  onProfileClick,
  updates = [],
  projectId
}) => {
  const { user, profile } = useAuth();
  const [newComment, setNewComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [anonName] = useState(generateAnonymousName());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [commentMode, setCommentMode] = useState<'global' | 'update'>('global');
  const [selectedUpdateId, setSelectedUpdateId] = useState<string | null>(null);

  const displayName = isAnonymous
    ? anonName
    : profile?.displayName || user?.email?.split('@')[0] || 'Student';

  // Filter comments by type
  const globalComments = comments.filter(c => !c.parentUpdateId);
  const updateCommentMap: Record<string, Comment[]> = {};
  updates.forEach(update => {
    updateCommentMap[update.id] = comments.filter(c => c.parentUpdateId === update.id);
  });

  // Get nested replies for a comment
  const getReplies = (commentId: string) => {
    return comments.filter(c => c.parentCommentId === commentId);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onRequireAuth();
      return;
    }
    if (!newComment.trim()) return;

    const comment: Comment = {
      id: Date.now().toString(),
      author: displayName,
      content: newComment,
      date: new Date().toISOString(),
      authorUid: user.uid,
      authorPhotoURL: isAnonymous ? null : (profile?.photoURL || null),
      parentUpdateId: commentMode === 'update' ? selectedUpdateId || null : null,
      parentCommentId: replyingTo || null,
    };

    onAddComment(comment);
    setNewComment('');
    setReplyingTo(null);
  };

  // Render a single comment with optional nesting
  const renderComment = (comment: Comment, depth = 0) => {
    const replies = getReplies(comment.id);
    const indent = depth * 20;

    return (
      <div key={comment.id} style={{ marginLeft: `${indent}px` }}>
        <div className="flex gap-3.5 py-4 border-b border-neutral-100">
          <UserAvatar
            uid={comment.authorUid}
            photoURL={comment.authorPhotoURL}
            fallbackName={comment.author}
            size="md"
          />
          <div className="flex-grow min-w-0">
            <div className="flex items-center gap-3 mb-1.5">
              <button
                type="button"
                onClick={() => comment.authorUid && onProfileClick?.(comment.authorUid)}
                className="text-[13px] font-semibold text-neutral-900 hover:underline hover:text-neutral-700 active:text-gouni-primary transition-colors cursor-pointer"
              >
                {comment.author}
              </button>
              <span className="text-[11px] text-neutral-400">{formatDate(comment.date)}</span>
              {depth === 0 && (
                <button
                  onClick={() => {
                    setReplyingTo(comment.id);
                    setCommentMode('global');
                  }}
                  className="text-[11px] text-neutral-500 hover:text-gouni-primary transition-colors flex items-center gap-1"
                >
                  <Reply className="w-3 h-3" /> Reply
                </button>
              )}
            </div>
            <p className="text-[14px] text-neutral-600 leading-relaxed">{comment.content}</p>
          </div>
        </div>
        {/* Render nested replies */}
        {replies.map(reply => renderComment(reply, depth + 1))}
      </div>
    );
  };

  return (
    <div className="mt-10 pt-10 border-t border-neutral-200">
      <h3 className="text-lg font-bold text-neutral-900 mb-6 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-neutral-400" />
        {comments.length} Comment{comments.length !== 1 ? 's' : ''}
      </h3>

      {/* Comment list */}
      <div className="space-y-0 mb-8">
        {/* Global Comments */}
        {globalComments.length > 0 && (
          <div>
            <h4 className="text-[13px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">Global Comments</h4>
            <div className="space-y-0 mb-6">
              {globalComments.filter(c => !c.parentCommentId).map(comment => renderComment(comment))}
            </div>
          </div>
        )}

        {/* Comments grouped by update */}
        {updates.map(update => {
          const updateComments = updateCommentMap[update.id] || [];
          if (updateComments.length === 0) return null;

          return (
            <div key={update.id} className="mb-8 p-4 bg-neutral-50 rounded-xl border border-neutral-100">
              <div className="mb-4">
                <p className="text-[12px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                  {update.milestone || 'Update'}: {formatDate(update.date)}
                </p>
                <p className="text-[13px] text-neutral-600 line-clamp-2">{update.content}</p>
              </div>
              <div className="space-y-0">
                {updateComments.filter(c => !c.parentCommentId).map(comment => renderComment(comment))}
              </div>
            </div>
          );
        })}

        {comments.length === 0 && (
          <p className="text-sm text-neutral-400 py-6 text-center">No comments yet. Be the first to share your thoughts.</p>
        )}
      </div>

      {/* Comment form */}
      {user ? (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-neutral-200 p-5">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-[13px] font-medium text-neutral-500">
                Commenting as{' '}
                <span className="font-mono text-gouni-primary bg-blue-50 px-1.5 py-0.5 rounded-md text-[12px]">
                  {displayName}
                </span>
              </label>
              <button
                type="button"
                onClick={() => setIsAnonymous(!isAnonymous)}
                className={`text-[11px] font-medium px-2.5 py-1 rounded-lg transition-all ${
                  isAnonymous
                    ? 'bg-purple-50 text-purple-600 border border-purple-200'
                    : 'text-neutral-400 hover:text-neutral-600 border border-neutral-200 hover:border-neutral-300'
                }`}
              >
                {isAnonymous ? 'Anonymous mode' : 'Go anonymous'}
              </button>
            </div>

            {/* Comment mode toggle - only show if updates exist */}
            {updates.length > 0 && !replyingTo && (
              <div className="mb-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCommentMode('global');
                    setSelectedUpdateId(null);
                  }}
                  className={`text-[12px] px-3 py-1.5 rounded-lg font-medium transition-all ${
                    commentMode === 'global'
                      ? 'bg-gouni-primary text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  Global Comment
                </button>
                <button
                  type="button"
                  onClick={() => setCommentMode('update')}
                  className={`text-[12px] px-3 py-1.5 rounded-lg font-medium transition-all ${
                    commentMode === 'update'
                      ? 'bg-gouni-primary text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  Comment on Update
                </button>
              </div>
            )}

            {/* Update selector - shown when commenting on update */}
            {commentMode === 'update' && updates.length > 0 && !replyingTo && (
              <div className="mb-3">
                <select
                  value={selectedUpdateId || ''}
                  onChange={(e) => setSelectedUpdateId(e.target.value || null)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm text-neutral-700 focus:ring-2 focus:ring-gouni-primary/20 focus:border-gouni-primary/40"
                >
                  <option value="">Select an update...</option>
                  {updates.map(update => (
                    <option key={update.id} value={update.id}>
                      {update.milestone || 'Update'} - {formatDate(update.date)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Show if replying */}
            {replyingTo && (
              <div className="mb-3 p-2 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-[12px] text-blue-700">
                  Replying to comment • <button onClick={() => setReplyingTo(null)} className="hover:underline">Cancel</button>
                </p>
              </div>
            )}

            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="w-full p-3.5 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-gouni-primary/20 focus:border-gouni-primary/40 outline-none min-h-[100px] text-sm resize-none transition-all placeholder:text-neutral-400"
              placeholder="Share your thoughts on the code, design, or functionality..."
              required
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="sm" className="rounded-xl">
              <Send className="w-3.5 h-3.5" />
              {replyingTo ? 'Reply' : 'Post Comment'}
            </Button>
          </div>
        </form>
      ) : (
        <button
          onClick={onRequireAuth}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed border-neutral-200 text-[13px] font-medium text-neutral-400 hover:text-neutral-600 hover:border-neutral-300 transition-all"
        >
          <Lock className="w-4 h-4" />
          Sign in to leave a comment
        </button>
      )}
    </div>
  );
};
