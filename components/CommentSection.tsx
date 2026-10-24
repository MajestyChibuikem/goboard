import React, { useState } from 'react';
import { Comment, ProjectUpdate } from '../types';
import { generateAnonymousName, formatDate } from '../services/utils';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './Button';
import { MessageSquare, Send, Lock, Reply } from 'lucide-react';
import { UserAvatar } from './UserAvatar';
import { useResolvedUser } from '../contexts/UserCacheContext';

/** Extracted so we can call useResolvedUser (hook) per comment. */
const CommentItem: React.FC<{
  comment: Comment;
  depth: number;
  getReplies: (id: string) => Comment[];
  onProfileClick?: (uid: string) => void;
  onReply: (commentId: string) => void;
  formatDate: (d: string) => string;
}> = ({ comment, depth, getReplies, onProfileClick, onReply, formatDate: fmt }) => {
  const replies = getReplies(comment.id);
  const indent = depth * 20;
  const resolved = useResolvedUser(comment.authorUid, comment.author, comment.authorPhotoURL);

  return (
    <div style={{ marginLeft: `${indent}px` }}>
      <div className="flex gap-3.5 py-4 border-b border-neutral-100 dark:border-neutral-800">
        <UserAvatar
          uid={comment.authorUid}
          photoURL={resolved.photoURL}
          fallbackName={resolved.displayName}
          size="md"
        />
        <div className="flex-grow min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            <button
              type="button"
              onClick={() => comment.authorUid && onProfileClick?.(comment.authorUid)}
              className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100 hover:underline hover:text-neutral-700 dark:hover:text-neutral-300 active:text-gouni-primary transition-colors cursor-pointer"
            >
              {resolved.displayName}
            </button>
            <span className="text-[11px] text-neutral-400 dark:text-neutral-500">{fmt(comment.date)}</span>
            {depth === 0 && (
              <button
                onClick={() => onReply(comment.id)}
                className="text-[11px] text-neutral-500 dark:text-neutral-400 hover:text-gouni-primary transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Reply className="w-3 h-3" /> Reply
              </button>
            )}
          </div>
          <p className="text-[14px] text-neutral-600 dark:text-neutral-300 leading-relaxed">{comment.content}</p>
        </div>
      </div>
      {replies.map(reply => (
        <CommentItem
          key={reply.id}
          comment={reply}
          depth={depth + 1}
          getReplies={getReplies}
          onProfileClick={onProfileClick}
          onReply={onReply}
          formatDate={fmt}
        />
      ))}
    </div>
  );
};

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

  const handleReply = (commentId: string) => {
    setReplyingTo(commentId);
    setCommentMode('global');
  };

  return (
    <div className="mt-10 pt-10 border-t border-neutral-200 dark:border-neutral-800">
      <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-neutral-400 dark:text-neutral-500" />
        {comments.length} Comment{comments.length !== 1 ? 's' : ''}
      </h3>

      {/* Comment list */}
      <div className="space-y-0 mb-8">
        {/* Global Comments */}
        {globalComments.length > 0 && (
          <div>
            <h4 className="text-[13px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-4">Global Comments</h4>
            <div className="space-y-0 mb-6">
              {globalComments.filter(c => !c.parentCommentId).map(comment => (
                <CommentItem key={comment.id} comment={comment} depth={0} getReplies={getReplies} onProfileClick={onProfileClick} onReply={handleReply} formatDate={formatDate} />
              ))}
            </div>
          </div>
        )}

        {/* Comments grouped by update */}
        {updates.map(update => {
          const updateComments = updateCommentMap[update.id] || [];
          if (updateComments.length === 0) return null;

          return (
            <div key={update.id} className="mb-8 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-100 dark:border-neutral-800">
              <div className="mb-4">
                <p className="text-[12px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                  {update.milestone || 'Update'}: {formatDate(update.date)}
                </p>
                <p className="text-[13px] text-neutral-600 dark:text-neutral-300 line-clamp-2">{update.content}</p>
              </div>
              <div className="space-y-0">
                {updateComments.filter(c => !c.parentCommentId).map(comment => (
                  <CommentItem key={comment.id} comment={comment} depth={0} getReplies={getReplies} onProfileClick={onProfileClick} onReply={handleReply} formatDate={formatDate} />
                ))}
              </div>
            </div>
          );
        })}

        {comments.length === 0 && (
          <p className="text-sm text-neutral-400 dark:text-neutral-500 py-6 text-center">No comments yet. Be the first to share your thoughts.</p>
        )}
      </div>

      {/* Comment form */}
      {user ? (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 shadow-sm">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400">
                Commenting as{' '}
                <span className="font-mono text-gouni-primary dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded-md text-[12px]">
                  {displayName}
                </span>
              </label>
              <button
                type="button"
                onClick={() => setIsAnonymous(!isAnonymous)}
                className={`text-[11px] font-medium px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  isAnonymous
                    ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800'
                    : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
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
                  className={`text-[12px] px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                    commentMode === 'global'
                      ? 'bg-gouni-primary text-white'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  Global Comment
                </button>
                <button
                  type="button"
                  onClick={() => setCommentMode('update')}
                  className={`text-[12px] px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                    commentMode === 'update'
                      ? 'bg-gouni-primary text-white'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
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
                  className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg text-sm text-neutral-700 dark:text-neutral-200 focus:ring-2 focus:ring-gouni-primary/20 focus:border-gouni-primary/40"
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
              <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900/40">
                <p className="text-[12px] text-blue-700 dark:text-blue-300">
                  Replying to comment • <button onClick={() => setReplyingTo(null)} className="hover:underline cursor-pointer">Cancel</button>
                </p>
              </div>
            )}

            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="w-full p-3.5 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-xl focus:ring-2 focus:ring-gouni-primary/20 focus:border-gouni-primary/40 outline-none min-h-[100px] text-sm resize-none transition-all text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
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
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed border-neutral-200 dark:border-neutral-800 text-[13px] font-medium text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all cursor-pointer"
        >
          <Lock className="w-4 h-4" />
          Sign in to leave a comment
        </button>
      )}
    </div>
  );
};
