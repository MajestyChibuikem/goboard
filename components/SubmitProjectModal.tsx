import React, { useState, useRef } from 'react';
import { X, Upload, Image as ImageIcon } from 'lucide-react';
import { Button } from './Button';
import { Category, Project } from '../types';
import { uploadProjectImage } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';

interface SubmitProjectModalProps {
  onClose: () => void;
  onSubmit: (project: Omit<Project, 'id' | 'likes' | 'datePosted'>) => void;
}

export const SubmitProjectModal: React.FC<SubmitProjectModalProps> = ({ onClose, onSubmit }) => {
  const { profile } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    level: '',
    category: Category.WEB,
    techStack: '',
    demoUrl: '',
    repoUrl: '',
    websiteUrl: '' // NEW: Website URL
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5MB');
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      let imageUrl = `https://picsum.photos/seed/${Math.random()}/800/600`;

      // Upload image if provided
      if (imageFile) {
        try {
          const tempId = `temp_${Date.now()}`;
          imageUrl = await uploadProjectImage(imageFile, tempId, `cover_${imageFile.name}`);
        } catch (uploadErr) {
          console.warn('Image upload failed, using placeholder:', uploadErr);
          // Continue with placeholder image instead of blocking submission
        }
      }

      onSubmit({
        ...formData,
        displayName: profile?.displayName || 'Student',
        studentName: profile?.displayName || 'Student',
        authorPhotoURL: profile?.photoURL || null,
        techStack: formData.techStack.split(',').map(s => s.trim()),
        imageUrl,
        comments: [],
        screenshots: [],
        status: 'idea',
        updates: [],
      });
      onClose();
    } catch (err) {
      console.error('Submit failed:', err);
      setSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const inputStyles = "w-full px-3.5 py-2.5 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-gouni-primary/20 focus:border-gouni-primary/40 outline-none text-sm transition-all bg-white placeholder:text-neutral-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-float w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-up">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-100">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">Submit Project</h2>
            <p className="text-[13px] text-neutral-400 mt-0.5">Share your work with the GoUni community</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors text-neutral-400 hover:text-neutral-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-[13px] font-medium text-neutral-700 mb-1.5">Project Title</label>
            <input
              required
              name="title"
              value={formData.title}
              onChange={handleChange}
              className={inputStyles}
              placeholder="e.g. Campus Navigator"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
              <label className="block text-[13px] font-medium text-neutral-700 mb-1.5">Level</label>
              <input
                required
                name="level"
                value={formData.level}
                onChange={handleChange}
                placeholder="e.g. 400 Level"
                className={inputStyles}
              />
            </div>
             <div>
              <label className="block text-[13px] font-medium text-neutral-700 mb-1.5">Category</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className={inputStyles}
              >
                {Object.values(Category).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-neutral-700 mb-1.5">Description</label>
            <textarea
              required
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className={`${inputStyles} resize-none`}
              placeholder="Briefly describe the problem and solution..."
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-neutral-700 mb-1.5">Tech Stack <span className="text-neutral-400 font-normal">(comma separated)</span></label>
            <input
              required
              name="techStack"
              value={formData.techStack}
              onChange={handleChange}
              placeholder="React, Node.js, Python..."
              className={inputStyles}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
              <label className="block text-[13px] font-medium text-neutral-700 mb-1.5">Demo URL <span className="text-neutral-400 font-normal">(optional)</span></label>
              <input
                name="demoUrl"
                type="url"
                value={formData.demoUrl}
                onChange={handleChange}
                className={inputStyles}
              />
            </div>
             <div>
              <label className="block text-[13px] font-medium text-neutral-700 mb-1.5">Repo URL <span className="text-neutral-400 font-normal">(optional)</span></label>
              <input
                name="repoUrl"
                type="url"
                value={formData.repoUrl}
                onChange={handleChange}
                className={inputStyles}
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-neutral-700 mb-1.5">Website URL <span className="text-neutral-400 font-normal">(optional)</span></label>
            <input
              name="websiteUrl"
              type="url"
              value={formData.websiteUrl}
              onChange={handleChange}
              placeholder="https://example.com"
              className={inputStyles}
            />
          </div>

          {/* Image upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleImageSelect}
          />
          {imagePreview ? (
            <div className="relative rounded-2xl overflow-hidden border border-neutral-200">
              <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover" />
              <button
                type="button"
                onClick={() => { setImageFile(null); setImagePreview(null); }}
                className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
              <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2.5 py-1 bg-black/50 rounded-lg">
                <ImageIcon className="w-3 h-3 text-white" />
                <span className="text-[11px] text-white font-medium">{imageFile?.name}</span>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-neutral-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center bg-neutral-50/50 hover:bg-neutral-50 hover:border-neutral-300 transition-all cursor-pointer"
            >
              <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center mb-3">
                <Upload className="w-5 h-5 text-neutral-400" />
              </div>
              <span className="text-[13px] font-medium text-neutral-600">Upload Screenshot</span>
              <span className="text-[11px] text-neutral-400 mt-1">PNG, JPG up to 5MB</span>
            </div>
          )}

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
