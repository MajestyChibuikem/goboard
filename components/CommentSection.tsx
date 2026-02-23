import React, { useState } from 'react';
import { Comment } from '../types';
import { generateAnonymousName, formatDate } from '../services/utils';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './Button';
import { MessageSquare, User, Send, Lock } from 'lucide-react';

interface CommentSectionProps {
  comments: Comment[];
  onAddComment: (comment: Comment) => void;
  onRequireAuth: () => void;
}

export const CommentSection: React.FC<CommentSectionProps> = ({ comments, onAddComment, onRequireAuth }) => {
  const { user } = useAuth();
  const [newComment, setNewComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [anonName] = useState(generateAnonymousName());

  const displayName = isAnonymous
    ? anonName
    : user?.displayName || user?.email?.split('@')[0] || 'Student';

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
      date: new Date().toISOString()
    };

    onAddComment(comment);
    setNewComment('');
  };

  return (
    <div className="mt-10 pt-10 border-t border-neutral-200">
      <h3 className="text-lg font-bold text-neutral-900 mb-6 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-neutral-400" />
        {comments.length} Comment{comments.length !== 1 ? 's' : ''}
      </h3>

      {/* Comment list */}
      <div className="space-y-0 mb-8">
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-3.5 py-5 border-b border-neutral-100 last:border-0">
            <div className="w-9 h-9 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-neutral-400" />
            </div>
            <div className="flex-grow min-w-0">
              <div className="flex items-center gap-3 mb-1.5">
                <span className="text-[13px] font-semibold text-neutral-900">{comment.author}</span>
                <span className="text-[11px] text-neutral-400">{formatDate(comment.date)}</span>
              </div>
              <p className="text-[14px] text-neutral-600 leading-relaxed">{comment.content}</p>
            </div>
          </div>
        ))}
        {comments.length === 0 && (
          <p className="text-sm text-neutral-400 py-6 text-center">No comments yet. Be the first to share your thoughts.</p>
        )}
      </div>

      {/* Comment form */}
      {user ? (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-neutral-200 p-5">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
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
              Post Comment
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
