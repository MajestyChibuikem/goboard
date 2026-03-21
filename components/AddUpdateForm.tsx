import React, { useState, useRef } from 'react';
import { ProjectUpdate, ProjectStatus } from '../types';
import { STATUS_CONFIG } from '../constants';
import { Button } from './Button';
import { Plus, Send, Lock, Image as ImageIcon, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AddUpdateFormProps {
  currentStatus: ProjectStatus;
  onAddUpdate: (update: Omit<ProjectUpdate, 'id' | 'date'>, imageFile?: File) => void;
  onStatusChange: (status: ProjectStatus) => void;
  projectAuthorUid?: string;
  currentUserUid?: string | null;
}

export const AddUpdateForm: React.FC<AddUpdateFormProps> = ({
  currentStatus,
  onAddUpdate,
  onStatusChange,
  projectAuthorUid,
  currentUserUid
}) => {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState('');
  const [milestone, setMilestone] = useState('');
  const [newStatus, setNewStatus] = useState<ProjectStatus>(currentStatus);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Check if current user can edit
  const canEdit = currentUserUid && (currentUserUid === projectAuthorUid || profile?.isAdmin);

  if (!canEdit) {
    return (
      <div className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-neutral-200 text-[13px] font-medium text-neutral-400 bg-neutral-50/50">
        <Lock className="w-4 h-4" />
        Only project creator and admins can post updates
      </div>
    );
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    const updateData: Omit<ProjectUpdate, 'id' | 'date'> = {
      content: content.trim(),
      authorUid: currentUserUid,
    };

    if (milestone.trim()) {
      updateData.milestone = milestone.trim();
    }

    onAddUpdate(updateData, imageFile || undefined);

    if (newStatus !== currentStatus) {
      onStatusChange(newStatus);
    }

    setContent('');
    setMilestone('');
    clearImage();
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-neutral-200 text-[13px] font-medium text-neutral-400 hover:text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50/50 transition-all"
      >
        <Plus className="w-4 h-4" />
        Post an update
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-neutral-200 p-5 space-y-4 animate-fade-up">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold text-neutral-900">New Update</span>
        <button type="button" onClick={() => setIsOpen(false)} className="text-[12px] text-neutral-400 hover:text-neutral-600">
          Cancel
        </button>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What progress have you made? Share what you built, learned, or struggled with..."
        className="w-full p-3.5 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-gouni-primary/20 focus:border-gouni-primary/40 outline-none min-h-[100px] text-sm resize-none transition-all placeholder:text-neutral-400"
        required
      />

      {/* Optional image attachment */}
      <div>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />
        {imagePreview ? (
          <div className="relative inline-block">
            <img src={imagePreview} alt="Preview" className="h-28 rounded-xl border border-neutral-200 object-cover" />
            <button
              type="button"
              onClick={clearImage}
              className="absolute -top-2 -right-2 w-6 h-6 bg-neutral-900 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-neutral-200 text-[12px] text-neutral-400 hover:text-neutral-600 hover:border-neutral-300 transition-all"
          >
            <ImageIcon className="w-4 h-4" />
            Attach image (optional)
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">Milestone <span className="font-normal normal-case">(optional)</span></label>
          <input
            value={milestone}
            onChange={(e) => setMilestone(e.target.value)}
            placeholder="e.g. MVP Ready"
            className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-gouni-primary/20 focus:border-gouni-primary/40 outline-none transition-all placeholder:text-neutral-400"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">Project Status</label>
          <div className="flex gap-1.5 flex-wrap">
            {(['idea', 'in-progress', 'beta', 'launched'] as ProjectStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setNewStatus(s)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                  newStatus === s
                    ? STATUS_CONFIG[s].color
                    : 'border-neutral-100 text-neutral-400 hover:border-neutral-200'
                }`}
              >
                {STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <Button type="submit" size="sm" className="rounded-xl">
          <Send className="w-3.5 h-3.5" />
          Post Update
        </Button>
      </div>
    </form>
  );
};
