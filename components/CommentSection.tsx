import React, { useState } from 'react';
import { Comment } from '../types';
import { generateAnonymousName, formatDate } from '../services/utils';
import { Button } from './Button';
import { MessageSquare, User, Send } from 'lucide-react';

interface CommentSectionProps {
  comments: Comment[];
  onAddComment: (comment: Comment) => void;
}

export const CommentSection: React.FC<CommentSectionProps> = ({ comments, onAddComment }) => {
  const [newComment, setNewComment] = useState('');
  const [anonName] = useState(generateAnonymousName());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const comment: Comment = {
      id: Date.now().toString(),
      author: anonName,
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
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-neutral-200 p-5">
        <div className="mb-4">
          <label className="block text-[13px] font-medium text-neutral-500 mb-2">
            Commenting as <span className="font-mono text-gouni-primary bg-blue-50 px-1.5 py-0.5 rounded-md text-[12px]">{anonName}</span>
          </label>
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
    </div>
  );
};
