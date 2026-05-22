import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';
import { WritingGenre } from '../types';
import { createWriting } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './Toast';

interface SubmitWritingModalProps {
  onClose: () => void;
  onSubmitted: () => void;
}

export const SubmitWritingModal: React.FC<SubmitWritingModalProps> = ({ onClose, onSubmitted }) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({ title: '', genre: 'essay' as WritingGenre, body: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.body.trim()) return;
    setSubmitting(true);
    try {
      await createWriting(
        {
          title: formData.title.trim(),
          body: formData.body.trim(),
          genre: formData.genre,
          displayName: profile?.displayName || 'Student',
          authorPhotoURL: profile?.photoURL || null,
        },
        user.uid
      );
      toast('Writing submitted for review!', 'success');
      onSubmitted();
      onClose();
    } catch (err) {
      console.error('Submit failed:', err);
      toast('Failed to submit. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyles = "w-full px-3.5 py-2.5 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-gouni-primary/20 focus:border-gouni-primary/40 outline-none text-sm transition-all bg-white placeholder:text-neutral-400";
  const wordCount = formData.body.split(/\s+/).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-float w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-up">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-100">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">Submit a Writing</h2>
            <p className="text-[13px] text-neutral-400 mt-0.5">Share your piece with the Literature Club</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors text-neutral-400 hover:text-neutral-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[13px] font-medium text-neutral-700 mb-1.5">Title</label>
              <input
                required
                name="title"
                value={formData.title}
                onChange={(e) => setFormData(f => ({ ...f, title: e.target.value }))}
                className={inputStyles}
                placeholder="e.g. The Last Garden"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[13px] font-medium text-neutral-700 mb-1.5">Genre</label>
              <select
                name="genre"
                value={formData.genre}
                onChange={(e) => setFormData(f => ({ ...f, genre: e.target.value as WritingGenre }))}
                className={inputStyles}
              >
                <option value="short-story">Short Story</option>
                <option value="poem">Poem</option>
                <option value="essay">Essay</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[13px] font-medium text-neutral-700">Your Writing</label>
              <span className="text-[12px] text-neutral-400">{wordCount} words</span>
            </div>
            <textarea
              required
              name="body"
              value={formData.body}
              onChange={(e) => setFormData(f => ({ ...f, body: e.target.value }))}
              rows={14}
              className={`${inputStyles} resize-y min-h-[300px] font-serif leading-relaxed`}
              placeholder="Write or paste your full piece here…"
            />
          </div>

          <div className="pt-2">
            <Button type="submit" className="w-full rounded-xl" variant="primary" isLoading={submitting}>
              Submit for Review
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
