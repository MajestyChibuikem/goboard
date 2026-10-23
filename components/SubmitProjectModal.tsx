import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Upload, Image as ImageIcon, Github, GitFork, Sparkles, Check } from 'lucide-react';
import { Button } from './Button';
import { Category, Project, ProjectGitHubMeta, GitHubRepoSummary } from '../types';
import {
  uploadProjectImage,
  isProjectTitleTaken,
  matchGitHubContributorsToUsers,
} from '../services/firestoreService';
import { fetchGitHubRepoMetadata, parseGitHubRepoUrl } from '../services/githubService';
import { useAuth } from '../contexts/AuthContext';
import { CONTRIBUTION_AREAS, ACADEMIC_LEVELS } from '../constants';

interface SubmitProjectModalProps {
  onClose: () => void;
  onSubmit: (project: Omit<Project, 'id' | 'likes' | 'datePosted'>) => void;
}

export const SubmitProjectModal: React.FC<SubmitProjectModalProps> = ({ onClose, onSubmit }) => {
  const { profile } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    level: profile?.academicLevel || '',
    category: Category.WEB,
    techStack: '',
    demoUrl: '',
    repoUrl: '',
    websiteUrl: '',
  });
  const [openToContributions, setOpenToContributions] = useState(false);
  const [contributionAreas, setContributionAreas] = useState<string[]>([]);
  const [importedGitHubMeta, setImportedGitHubMeta] = useState<ProjectGitHubMeta | null>(null);
  const [importingRepo, setImportingRepo] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [repoImportInput, setRepoImportInput] = useState('');

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [titleError, setTitleError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const connectedRepos: GitHubRepoSummary[] = profile?.githubProfile?.topRepos || [];

  const handleImportFromGitHub = async (repoUrlOrFullName: string) => {
    if (!repoUrlOrFullName.trim()) return;
    setImportError(null);
    setImportingRepo(true);
    try {
      const { repoSummary, meta } = await fetchGitHubRepoMetadata(repoUrlOrFullName);
      const { matchedContributors } = await matchGitHubContributorsToUsers(meta.contributors);
      const enrichedMeta: ProjectGitHubMeta = {
        ...meta,
        contributors: matchedContributors,
      };
      setImportedGitHubMeta(enrichedMeta);

      const techItems = Array.from(
        new Set([
          ...enrichedMeta.languages,
          ...(repoSummary.topics || []).slice(0, 4),
        ].filter(Boolean))
      );

      const prettyTitle = repoSummary.name
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

      setFormData((prev) => ({
        ...prev,
        title: prev.title || prettyTitle,
        description: prev.description || repoSummary.description || `Open-source project repository ${repoSummary.fullName}`,
        techStack: techItems.length > 0 ? techItems.join(', ') : prev.techStack,
        repoUrl: repoSummary.htmlUrl,
      }));
      setTitleError('');
    } catch (err: any) {
      console.error('GitHub import failed:', err);
      setImportError(err?.message || 'Could not import repository from GitHub.');
    } finally {
      setImportingRepo(false);
    }
  };

  const toggleContributionArea = (area: string) => {
    setContributionAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

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
    setTitleError('');
    setSubmitting(true);

    try {
      // Check for duplicate title (case-insensitive)
      const taken = await isProjectTitleTaken(formData.title);
      if (taken) {
        setTitleError('A project with this name already exists. Please choose a different title.');
        setSubmitting(false);
        return;
      }

      let imageUrl = `https://picsum.photos/seed/${Math.random()}/800/600`;

      // Upload image if provided
      if (imageFile) {
        try {
          const tempId = `temp_${Date.now()}`;
          imageUrl = await uploadProjectImage(imageFile, tempId, `cover_${imageFile.name}`);
        } catch (uploadErr) {
          console.warn('Image upload failed, using placeholder:', uploadErr);
        }
      }

      // If repoUrl is a GitHub URL and wasn't imported yet, try fetching its metadata + contributors
      let finalGitHubMeta = importedGitHubMeta;
      let contributorUids: string[] = [];

      if (formData.repoUrl && parseGitHubRepoUrl(formData.repoUrl)) {
        try {
          if (!finalGitHubMeta || finalGitHubMeta.htmlUrl !== formData.repoUrl.trim()) {
            const { meta } = await fetchGitHubRepoMetadata(formData.repoUrl);
            const matched = await matchGitHubContributorsToUsers(meta.contributors);
            finalGitHubMeta = {
              ...meta,
              contributors: matched.matchedContributors,
            };
            contributorUids = matched.contributorUids;
          } else {
            const matched = await matchGitHubContributorsToUsers(finalGitHubMeta.contributors);
            finalGitHubMeta = {
              ...finalGitHubMeta,
              contributors: matched.matchedContributors,
            };
            contributorUids = matched.contributorUids;
          }
        } catch (ghErr) {
          console.warn('Optional GitHub metadata fetch during submit skipped:', ghErr);
        }
      }

      onSubmit({
        ...formData,
        displayName: profile?.displayName || 'Student',
        studentName: profile?.displayName || 'Student',
        authorPhotoURL: profile?.photoURL || null,
        techStack: formData.techStack.split(',').map(s => s.trim()).filter(Boolean),
        imageUrl,
        comments: [],
        screenshots: [],
        status: 'idea',
        updates: [],
        openToContributions,
        contributionAreas: openToContributions ? contributionAreas : [],
        ...(finalGitHubMeta ? { githubMeta: finalGitHubMeta } : {}),
        ...(contributorUids.length > 0 ? { contributorUids } : {}),
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 14 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        className="relative bg-white rounded-2xl shadow-float w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-100">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">Submit Project</h2>
            <p className="text-[13px] text-neutral-400 mt-0.5">Share your work or invite open-source contributors</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={onClose}
            className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors text-neutral-400 hover:text-neutral-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </motion.button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* ── 1-Click GitHub Repository Import Bar ── */}
          <div className="p-4 rounded-2xl bg-neutral-900 text-white space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold">
                <Github className="w-4 h-4 text-emerald-400" />
                1-Click Import from GitHub
              </div>
              {importedGitHubMeta && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                  <Check className="w-3 h-3" /> Imported {importedGitHubMeta.fullName}
                </span>
              )}
            </div>

            {connectedRepos.length > 0 && (
              <div>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      setRepoImportInput(e.target.value);
                      handleImportFromGitHub(e.target.value);
                    }
                  }}
                  defaultValue=""
                  className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-xs text-white focus:outline-none"
                >
                  <option value="" className="text-neutral-900">
                    Select from your connected GitHub repositories (@{profile?.githubProfile?.displayUsername})...
                  </option>
                  {connectedRepos.map((r) => (
                    <option key={r.id} value={r.htmlUrl} className="text-neutral-900">
                      {r.name} {r.language ? `(${r.language})` : ''} — ★ {r.stargazersCount}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={repoImportInput}
                onChange={(e) => setRepoImportInput(e.target.value)}
                placeholder="Or paste GitHub URL (e.g. github.com/owner/repo)"
                className="flex-grow px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-xs text-white placeholder:text-neutral-400 focus:outline-none"
              />
              <button
                type="button"
                disabled={importingRepo || !repoImportInput.trim()}
                onClick={() => handleImportFromGitHub(repoImportInput)}
                className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-neutral-950 font-bold text-xs transition-colors disabled:opacity-40 shrink-0"
              >
                {importingRepo ? 'Importing...' : 'Auto-Fill'}
              </button>
            </div>

            {importError && (
              <p className="text-[11px] text-red-300">{importError}</p>
            )}
          </div>

          <div>
            <label className="block text-[13px] font-medium text-neutral-700 mb-1.5">Project Title</label>
            <input
              required
              name="title"
              value={formData.title}
              onChange={(e) => { handleChange(e); setTitleError(''); }}
              className={`${inputStyles} ${titleError ? 'border-red-400 focus:ring-red-200 focus:border-red-400' : ''}`}
              placeholder="e.g. Campus Navigator"
            />
            {titleError && (
              <p className="text-[12px] text-red-600 mt-1">{titleError}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
              <label className="block text-[13px] font-medium text-neutral-700 mb-1.5">Level</label>
              <select
                required
                name="level"
                value={formData.level}
                onChange={handleChange}
                className={inputStyles}
              >
                <option value="">Select Level</option>
                {ACADEMIC_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))}
              </select>
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
                placeholder="https://github.com/..."
                className={inputStyles}
              />
            </div>
          </div>

          {/* ── Open to Contributions (Open-Source Collaboration) ── */}
          <div className="p-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/40 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <GitFork className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-neutral-900">
                    Open to Contributions (Pull Requests & Issues)
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Let other students push PRs on GitHub & get auto-recognized as contributors
                  </div>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={openToContributions}
                onClick={() => setOpenToContributions(!openToContributions)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  openToContributions ? 'bg-emerald-600' : 'bg-neutral-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition ${
                    openToContributions ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {openToContributions && (
              <div className="pt-2 border-t border-emerald-200/60">
                <div className="text-[11px] font-semibold text-emerald-800 mb-2">
                  What kind of contributions are welcome? (optional)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {CONTRIBUTION_AREAS.map((area) => {
                    const selected = contributionAreas.includes(area);
                    return (
                      <button
                        key={area}
                        type="button"
                        onClick={() => toggleContributionArea(area)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
                          selected
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : 'bg-white text-neutral-600 border-neutral-200 hover:border-emerald-300'
                        }`}
                      >
                        {area}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
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
              <img src={imagePreview || undefined} alt="Preview" className="w-full h-48 object-cover" />
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
      </motion.div>
    </motion.div>
  );
};

