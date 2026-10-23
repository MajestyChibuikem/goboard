import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Upload,
  Image as ImageIcon,
  Github,
  GitFork,
  Sparkles,
  Check,
  Search,
  ExternalLink,
  Loader2,
  RefreshCw,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Star,
  Clock,
} from 'lucide-react';
import { Button } from './Button';
import { Category, Project, ProjectGitHubMeta, GitHubRepoSummary } from '../types';
import {
  uploadProjectImage,
  isProjectTitleTaken,
  matchGitHubContributorsToUsers,
} from '../services/firestoreService';
import {
  fetchGitHubRepoMetadata,
  parseGitHubRepoUrl,
  fetchAllUserRepositories,
} from '../services/githubService';
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

  // Live repository catalog state (fetches all 60+ user repos)
  const [userRepos, setUserRepos] = useState<GitHubRepoSummary[]>(profile?.githubProfile?.topRepos || []);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoSearchQuery, setRepoSearchQuery] = useState('');
  const [isRepoSelectorOpen, setIsRepoSelectorOpen] = useState(false);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [titleError, setTitleError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch full live repository catalog if user has connected GitHub
  useEffect(() => {
    const ghUser = profile?.githubProfile?.username || profile?.githubProfile?.displayUsername;
    if (!ghUser) return;

    setLoadingRepos(true);
    fetchAllUserRepositories(ghUser)
      .then((repos) => {
        if (repos.length > 0) {
          setUserRepos(repos);
        }
      })
      .catch((err) => console.warn('Live repos fetch failed, using cached list:', err))
      .finally(() => setLoadingRepos(false));
  }, [profile?.githubProfile?.username, profile?.githubProfile?.displayUsername]);

  // Filtered repositories based on live search
  const filteredRepos = useMemo(() => {
    if (!repoSearchQuery.trim()) return userRepos;
    const q = repoSearchQuery.toLowerCase().trim();
    return userRepos.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.language && r.language.toLowerCase().includes(q)) ||
        (r.description && r.description.toLowerCase().includes(q))
    );
  }, [userRepos, repoSearchQuery]);

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
      setIsRepoSelectorOpen(false);
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
    setImportError(null);

    // Enforce GitHub-First requirement
    if (!formData.repoUrl || !parseGitHubRepoUrl(formData.repoUrl)) {
      setImportError('A valid GitHub repository is required to submit a project on GoBoard.');
      return;
    }

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
          console.warn('GitHub metadata fetch during submit skipped:', ghErr);
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
        className="relative bg-white rounded-2xl shadow-float w-full max-w-lg max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-neutral-900">Submit Project</h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-900 text-white">
                <Github className="w-3 h-3 text-emerald-400" /> GitHub Required
              </span>
            </div>
            <p className="text-[13px] text-neutral-400 mt-0.5">Showcase your verified open-source software and invite student collaborators</p>
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
          {/* ── Step 1: GitHub Repository Selection (Mandatory) ── */}
          <div className="p-4 rounded-2xl bg-neutral-900 text-white space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold">
                <Github className="w-4 h-4 text-emerald-400" />
                Step 1: Choose GitHub Repository
              </div>
              {loadingRepos && (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-neutral-400">
                  <Loader2 className="w-3 h-3 animate-spin text-emerald-400" /> Loading repos...
                </span>
              )}
            </div>

            {/* When already imported */}
            {importedGitHubMeta ? (
              <div className="p-3 bg-white/10 border border-emerald-500/30 rounded-xl space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="font-semibold text-xs text-white truncate">{importedGitHubMeta.fullName}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setImportedGitHubMeta(null);
                      setFormData(prev => ({ ...prev, repoUrl: '' }));
                    }}
                    className="text-[11px] text-emerald-300 hover:text-emerald-200 underline shrink-0 cursor-pointer"
                  >
                    Change Repo
                  </button>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-neutral-300">
                  {importedGitHubMeta.language && (
                    <span className="px-2 py-0.5 rounded-md bg-white/10 text-white font-medium">
                      {importedGitHubMeta.language}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-400" /> {importedGitHubMeta.stars}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <GitFork className="w-3 h-3 text-neutral-400" /> {importedGitHubMeta.forks}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Searchable live repo list if user has repos */}
                {userRepos.length > 0 ? (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                      <input
                        type="text"
                        value={repoSearchQuery}
                        onChange={(e) => setRepoSearchQuery(e.target.value)}
                        placeholder={`Search through ${userRepos.length} repositories...`}
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/10 border border-white/15 text-xs text-white placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      />
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                      {filteredRepos.length > 0 ? (
                        filteredRepos.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            disabled={importingRepo}
                            onClick={() => handleImportFromGitHub(r.htmlUrl)}
                            className="w-full text-left p-2.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/5 hover:border-white/20 transition-all cursor-pointer group"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-white group-hover:text-emerald-300 transition-colors truncate">
                                {r.name}
                              </span>
                              <div className="flex items-center gap-2 text-[10px] text-neutral-400 shrink-0">
                                {r.language && (
                                  <span className="px-1.5 py-0.5 rounded bg-white/10 text-neutral-300 font-medium">
                                    {r.language}
                                  </span>
                                )}
                                <span className="inline-flex items-center gap-0.5">
                                  <Star className="w-2.5 h-2.5 text-amber-400" /> {r.stargazersCount}
                                </span>
                              </div>
                            </div>
                            {r.description && (
                              <p className="text-[11px] text-neutral-400 truncate mt-0.5">{r.description}</p>
                            )}
                          </button>
                        ))
                      ) : (
                        <div className="text-center py-4 text-xs text-neutral-400">
                          No repositories matching "{repoSearchQuery}"
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {/* Direct Paste URL input */}
                <div className="pt-2 border-t border-white/10 space-y-1.5">
                  <span className="text-[11px] text-neutral-400">Or paste any public GitHub repository URL:</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={repoImportInput}
                      onChange={(e) => setRepoImportInput(e.target.value)}
                      placeholder="https://github.com/owner/repo"
                      className="flex-grow px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-xs text-white placeholder:text-neutral-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={importingRepo || !repoImportInput.trim()}
                      onClick={() => handleImportFromGitHub(repoImportInput)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs transition-colors disabled:opacity-40 shrink-0 cursor-pointer"
                    >
                      {importingRepo ? 'Importing...' : 'Auto-Fill'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {importError && (
              <div className="flex items-center gap-1.5 text-[11px] text-red-300 bg-red-950/40 p-2 rounded-lg border border-red-800/50">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{importError}</span>
              </div>
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
              placeholder="Briefly describe what this project does and the problem it solves..."
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
              <label className="block text-[13px] font-medium text-neutral-700 mb-1.5">Live Demo URL <span className="text-neutral-400 font-normal">(optional)</span></label>
              <input
                name="demoUrl"
                type="url"
                value={formData.demoUrl}
                onChange={handleChange}
                placeholder="https://my-app.vercel.app"
                className={inputStyles}
              />
            </div>
             <div>
              <label className="block text-[13px] font-medium text-neutral-700 mb-1.5">GitHub Repository</label>
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-800 text-sm">
                <Github className="w-4 h-4 text-neutral-600 shrink-0" />
                <span className="font-mono text-xs truncate flex-grow text-neutral-700">
                  {formData.repoUrl ? formData.repoUrl.replace('https://github.com/', '') : 'Select repo above'}
                </span>
                {formData.repoUrl ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <span className="text-[10px] text-amber-600 font-bold uppercase">Required</span>
                )}
              </div>
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

