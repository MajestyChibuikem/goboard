import React, { useState, useRef, useEffect } from 'react';
import { Project, Comment, ProjectUpdate, ProjectStatus, GitHubPullRequestItem } from '../types';
import { generateProjectInsight } from '../services/geminiService';
import { fetchRepoPullRequests } from '../services/githubService';
import { getProjectBadges, formatDate } from '../services/utils';
import { ArrowLeft, Github, Sparkles, Monitor, ChevronUp, AlertCircle, Trash2, X, GitPullRequest, GitMerge, GitFork, Star, RefreshCw, ExternalLink, CheckCircle2 } from 'lucide-react';
import { Button } from './Button';
import { CommentSection } from './CommentSection';
import { ProjectTimeline } from './ProjectTimeline';
import { AddUpdateForm } from './AddUpdateForm';
import { BlurredImage } from './BlurredImage';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './Toast';
import {
  addComment as addCommentToFirestore,
  addProjectUpdate as addUpdateToFirestore,
  updateProjectStatus as updateStatusInFirestore,
  awardCommentXP,
  deleteProject,
  suspendProject,
  restoreProject,
  updateProjectDescription,
  updateProjectDetails,
  updateProjectCollaborationSettings,
  syncAndSaveProjectGitHub,
  uploadProjectImage,
} from '../services/firestoreService';
import { UserAvatar } from './UserAvatar';
import { useResolvedUser } from '../contexts/UserCacheContext';
import { GeminiInsight } from '../types';
import { STATUS_CONFIG, CONTRIBUTION_AREAS } from '../constants';

interface ProjectDetailViewProps {
  project: Project;
  onBack: () => void;
  onUpdateProject: (project: Project) => void;
  allProjects: Project[];
  onProjectClick: (project: Project) => void;
  onVote: (e: React.MouseEvent, projectId: string) => void;
  onRequireAuth: () => void;
  onProfileClick?: (userId: string) => void;
  voted?: boolean;
  disabled?: boolean;
}

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({
  project,
  onBack,
  onUpdateProject,
  allProjects,
  onProjectClick,
  onVote,
  onRequireAuth,
  onProfileClick,
  voted,
  disabled,
}) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [insight, setInsight] = useState<GeminiInsight | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [activeImage, setActiveImage] = useState(project.imageUrl);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [showEditDescriptionModal, setShowEditDescriptionModal] = useState(false);
  const [editedDescription, setEditedDescription] = useState(project.description);
  const [showEditDetailsModal, setShowEditDetailsModal] = useState(false);
  const [editedDemoUrl, setEditedDemoUrl] = useState(project.demoUrl || '');
  const [editedRepoUrl, setEditedRepoUrl] = useState(project.repoUrl || '');
  const [editedWebsiteUrl, setEditedWebsiteUrl] = useState(project.websiteUrl || '');
  const [editedOpenToContributions, setEditedOpenToContributions] = useState(!!project.openToContributions);
  const [editedContributionAreas, setEditedContributionAreas] = useState<string[]>(project.contributionAreas || []);
  const [editedImageFile, setEditedImageFile] = useState<File | null>(null);
  const [editedImagePreview, setEditedImagePreview] = useState<string | null>(null);
  const [syncingGitHub, setSyncingGitHub] = useState(false);
  const [pullRequests, setPullRequests] = useState<GitHubPullRequestItem[]>([]);
  const [loadingPrs, setLoadingPrs] = useState(false);
  const editImageInputRef = useRef<HTMLInputElement>(null);

  const badges = getProjectBadges(project);

  const similarProjects = allProjects
    .filter(p => p.category === project.category && p.id !== project.id)
    .slice(0, 3);

  const handleGenerateInsight = async () => {
    setLoadingInsight(true);
    const data = await generateProjectInsight(project);
    setInsight(data);
    setLoadingInsight(false);
  };

  const authorUid = (project as any).authorUid as string | undefined;
  const author = useResolvedUser(authorUid, project.displayName || project.studentName, project.authorPhotoURL);

  const handleAddComment = async (newComment: Comment) => {
    // Optimistic update
    onUpdateProject({
      ...project,
      comments: [...project.comments, newComment],
    });

    // Persist to Firestore
    try {
      await addCommentToFirestore(project.id, newComment);
      if (user) {
        await awardCommentXP(user.uid, project.id, authorUid, 'project', newComment.id);
      }
      toast('Comment posted!', 'success');
    } catch (err) {
      console.error('Failed to save comment:', err);
      toast('Failed to post comment.', 'error');
    }
  };

  const handleAddUpdate = async (updateData: Omit<ProjectUpdate, 'id' | 'date'>, imageFile?: File) => {
    if (!user) { onRequireAuth(); return; }

    let imageUrl: string | undefined;
    if (imageFile) {
      try {
        imageUrl = await uploadProjectImage(imageFile, project.id, `update_${Date.now()}_${imageFile.name}`);
      } catch (err) {
        console.error('Failed to upload update image:', err);
        toast('Image upload failed, posting without image.', 'error');
      }
    }

    const newUpdate: ProjectUpdate = {
      ...updateData,
      id: Date.now().toString(),
      date: new Date().toISOString(),
      ...(imageUrl && { imageUrl }),
    };

    // Optimistic update
    onUpdateProject({
      ...project,
      updates: [...project.updates, newUpdate],
    });

    // Persist
    try {
      await addUpdateToFirestore(project.id, newUpdate, user.uid);
      toast('Update posted!', 'success');
    } catch (err) {
      console.error('Failed to save update:', err);
      toast('Failed to post update.', 'error');
    }
  };

  const handleStatusChange = async (newStatus: ProjectStatus) => {
    onUpdateProject({ ...project, status: newStatus });
    try {
      await updateStatusInFirestore(project.id, newStatus);
      toast(`Status updated to ${STATUS_CONFIG[newStatus].label}`, 'success');
    } catch (err) {
      console.error('Failed to update status:', err);
      toast('Failed to update status.', 'error');
    }
  };

  const handleDelete = async () => {
    if (!user || !profile?.isAdmin) return;
    setIsProcessing(true);
    try {
      await deleteProject(project.id, user.uid);
      toast('Project deleted permanently', 'success');
      onBack(); // Return to list
    } catch (err) {
      console.error('Failed to delete:', err);
      toast('Failed to delete project', 'error');
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
      await suspendProject(project.id, user.uid, suspensionReason);
      // Update local project state
      onUpdateProject({ ...project, isSuspended: true, suspensionReason });
      toast('Project suspended', 'success');
      setShowSuspendModal(false);
    } catch (err) {
      console.error('Failed to suspend:', err);
      toast('Failed to suspend project', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = async () => {
    if (!user || !profile?.isAdmin) return;
    setIsProcessing(true);
    try {
      await restoreProject(project.id, user.uid);
      // Update local project state
      onUpdateProject({ ...project, isSuspended: false, suspendedBy: undefined, suspendedAt: undefined, suspensionReason: undefined });
      toast('Project restored', 'success');
      setShowSuspendModal(false);
    } catch (err) {
      console.error('Failed to restore:', err);
      toast('Failed to restore project', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditDescription = async () => {
    if (!user || user.uid !== authorUid) return;
    if (!editedDescription.trim()) {
      toast('Description cannot be empty', 'error');
      return;
    }
    setIsProcessing(true);
    try {
      await updateProjectDescription(project.id, user.uid, editedDescription.trim());
      onUpdateProject({ ...project, description: editedDescription.trim() });
      toast('Description updated!', 'success');
      setShowEditDescriptionModal(false);
    } catch (err) {
      console.error('Failed to update description:', err);
      toast('Failed to update description', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const loadPullRequests = async (repoTarget?: string) => {
    const repo = repoTarget || project.repoUrl || project.githubMeta?.fullName;
    if (!repo) {
      setPullRequests([]);
      return;
    }
    setLoadingPrs(true);
    try {
      const prs = await fetchRepoPullRequests(repo);
      setPullRequests(prs);
    } catch {
      // ignore
    } finally {
      setLoadingPrs(false);
    }
  };

  const handleSyncGitHubRepo = async (showFeedback = true, repoUrlOverride?: string) => {
    const targetRepoUrl = (repoUrlOverride ?? project.repoUrl)?.trim();
    if (!targetRepoUrl) return;
    setSyncingGitHub(true);
    try {
      const [{ githubMeta, contributorUids }] = await Promise.all([
        syncAndSaveProjectGitHub(project.id, targetRepoUrl),
        loadPullRequests(targetRepoUrl),
      ]);
      onUpdateProject({
        ...project,
        repoUrl: targetRepoUrl,
        githubMeta,
        contributorUids,
      });
      if (showFeedback) {
        toast('Synced GitHub repository, PRs & contributor list!', 'success');
      }
    } catch (err: any) {
      if (showFeedback) {
        toast(err?.message || 'Failed to sync GitHub repository', 'error');
      }
    } finally {
      setSyncingGitHub(false);
    }
  };

  useEffect(() => {
    if (project.repoUrl || project.githubMeta?.fullName) {
      loadPullRequests(project.repoUrl || project.githubMeta?.fullName);
    }
    if (project.repoUrl && !project.githubMeta && user) {
      handleSyncGitHubRepo(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, project.repoUrl]);

  const handleEditDetails = async () => {
    if (!user || user.uid !== authorUid) return;
    setIsProcessing(true);
    try {
      const fields: { demoUrl?: string; websiteUrl?: string; imageUrl?: string } = {
        demoUrl: editedDemoUrl,
        websiteUrl: editedWebsiteUrl,
      };

      if (editedImageFile) {
        const newImageUrl = await uploadProjectImage(editedImageFile, project.id, `cover_${editedImageFile.name}`);
        fields.imageUrl = newImageUrl;
      }

      const trimmedRepoUrl = editedRepoUrl.trim();
      const areas = editedOpenToContributions ? editedContributionAreas : [];

      await updateProjectDetails(project.id, user.uid, fields);
      await updateProjectCollaborationSettings(project.id, user.uid, {
        repoUrl: trimmedRepoUrl,
        openToContributions: editedOpenToContributions,
        contributionAreas: areas,
      });

      const updatedProject: Project = {
        ...project,
        ...fields,
        repoUrl: trimmedRepoUrl || undefined,
        openToContributions: editedOpenToContributions,
        contributionAreas: areas,
      };
      onUpdateProject(updatedProject);

      if (trimmedRepoUrl && trimmedRepoUrl !== project.repoUrl) {
        handleSyncGitHubRepo(true, trimmedRepoUrl);
      }

      toast('Project details updated!', 'success');
      setShowEditDetailsModal(false);
      setEditedImageFile(null);
      setEditedImagePreview(null);
    } catch (err) {
      console.error('Failed to update details:', err);
      toast('Failed to update details', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleEditedArea = (area: string) => {
    setEditedContributionAreas(prev =>
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    );
  };

  return (
    <div className="animate-fade-up">

      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors mb-8 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to projects
      </button>

      {/* Hero section */}
      <div className="mb-10">
        {/* Title + badges */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white tracking-tight">{project.title}</h1>
          {/* Status badge */}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${STATUS_CONFIG[project.status].color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[project.status].dot}`} />
            {STATUS_CONFIG[project.status].label}
          </span>
          {project.openToContributions && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
              <GitPullRequest className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Open to Contributions
            </span>
          )}
          {badges.map((badge) => (
            <span
              key={badge.label}
              className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
            >
              <span className="mr-1.5">{badge.icon}</span> {badge.label}
            </span>
          ))}
          {project.isSuspended && (
            <span className="inline-block px-3 py-1 bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-full text-[11px] font-semibold text-amber-700 dark:text-amber-400">
              ⚠️ Suspended
            </span>
          )}
          {project.approvalStatus === 'pending' && (
            <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800 rounded-full text-[11px] font-semibold text-blue-700 dark:text-blue-400">
              ⏳ Pending Review
            </span>
          )}
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-400 dark:text-neutral-400">
          <span className="px-2.5 py-1 bg-neutral-900 dark:bg-neutral-800 text-white text-[11px] font-medium rounded-lg">{project.category}</span>
          <span>Posted {formatDate(project.datePosted)}</span>
          <span className="text-neutral-200 dark:text-neutral-700">|</span>
          <span className="flex items-center gap-1.5">
            <UserAvatar
              uid={authorUid}
              photoURL={author.photoURL}
              fallbackName={author.displayName}
              size="xs"
            />
            <button
              type="button"
              onClick={() => {
                if (authorUid) {
                  onProfileClick?.(authorUid);
                }
              }}
              className="font-medium text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 hover:underline active:text-gouni-primary transition-colors cursor-pointer"
            >
              {author.displayName}
            </button>
            <span className="text-neutral-300 dark:text-neutral-700">·</span>
            <span>{project.level}</span>
          </span>
        </div>

        {/* Open-Source Contribution Banner */}
        {project.openToContributions && (
          <div className="mt-5 p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-850/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[13px] font-bold text-emerald-900 dark:text-emerald-200">
                <GitPullRequest className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                This project welcomes student pull requests & commits
              </div>
              <p className="text-[12px] text-emerald-700/90 dark:text-emerald-400/90 mt-0.5">
                No team invite required — fork or push code on GitHub, link your GitHub account on your GoBoard profile, and you&apos;ll automatically appear as a verified contributor (+40 XP).
              </p>
              {project.contributionAreas && project.contributionAreas.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                  <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 mr-1">Looking for help with:</span>
                  {project.contributionAreas.map(area => (
                    <span
                      key={area}
                      className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 shadow-sm"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {project.repoUrl && (
              <a
                href={project.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[12px] font-semibold transition-colors shrink-0 self-start sm:self-center"
              >
                <Github className="w-3.5 h-3.5" />
                Fork &amp; Open PR
                <ExternalLink className="w-3 h-3 opacity-80" />
              </a>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

        {/* ── Left: Content ── */}
        <div className="lg:col-span-2">

          {/* Image gallery */}
          <div className="mb-10">
            <div
              className="aspect-video w-full bg-neutral-100 dark:bg-neutral-800 rounded-2xl overflow-hidden mb-3 cursor-zoom-in"
              onClick={() => setShowImageViewer(true)}
            >
              <BlurredImage
                src={activeImage || undefined}
                alt={project.title}
                aspectRatio="aspect-video"
                fallbackText={project.title}
              />
            </div>
            {(project.screenshots.length > 0) && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setActiveImage(project.imageUrl)}
                  className={`w-20 h-14 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${activeImage === project.imageUrl ? 'border-neutral-900 dark:border-white shadow-sm' : 'border-transparent opacity-60 hover:opacity-100'}`}
                >
                  <img src={project.imageUrl || undefined} className="w-full h-full object-cover" />
                </button>
                {project.screenshots.map((shot, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImage(shot)}
                    className={`w-20 h-14 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${activeImage === shot ? 'border-neutral-900 dark:border-white shadow-sm' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  >
                    <img src={shot || undefined} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-bold text-neutral-400 uppercase tracking-wider">Overview</h3>
              {user && user.uid === authorUid && (
                <button
                  onClick={() => {
                    setEditedDescription(project.description);
                    setShowEditDescriptionModal(true);
                  }}
                  className="text-[12px] font-semibold text-gouni-primary hover:text-gouni-primary/80 transition-colors cursor-pointer"
                >
                  Edit
                </button>
              )}
            </div>
            <p className="text-[15px] text-neutral-700 dark:text-neutral-300 whitespace-pre-line leading-relaxed">{project.description}</p>
          </div>

          {/* Build Journey Timeline */}
          <ProjectTimeline updates={project.updates} status={project.status} />

          {/* Add Update Form */}
          <div className="mb-10">
            <AddUpdateForm
              currentStatus={project.status}
              onAddUpdate={handleAddUpdate}
              onStatusChange={handleStatusChange}
              projectAuthorUid={authorUid}
              currentUserUid={user?.uid}
            />
          </div>

          {/* AI Insight */}
          <div className="bg-gradient-to-br from-indigo-50/80 to-violet-50/50 dark:from-indigo-950/30 dark:to-violet-950/20 rounded-2xl p-6 mb-10 border border-indigo-100/60 dark:border-indigo-900/40">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/60 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <span className="text-[13px] font-bold text-neutral-900 dark:text-white">AI Analysis</span>
              </div>
              {!insight && (
                <Button size="sm" onClick={handleGenerateInsight} isLoading={loadingInsight} variant="primary" className="rounded-xl">
                  Generate
                </Button>
              )}
            </div>

            {insight ? (
              <div className="space-y-4 animate-fade-up">
                <div>
                  <div className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider mb-1">Review</div>
                  <p className="text-[14px] text-neutral-700 dark:text-neutral-300 leading-relaxed">{insight.review}</p>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider mb-1">Impact</div>
                  <p className="text-[14px] text-neutral-700 dark:text-neutral-300 leading-relaxed">{insight.impact}</p>
                </div>
                <div className="bg-white/60 dark:bg-neutral-900/60 rounded-xl p-4 border border-indigo-100/60 dark:border-indigo-900/40">
                  <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">Suggestion</div>
                  <p className="text-[14px] text-neutral-600 dark:text-neutral-300 italic leading-relaxed">"{insight.suggestion}"</p>
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-neutral-400 dark:text-neutral-500">
                Get an AI-powered evaluation of technical merit and potential impact.
              </p>
            )}
          </div>

          {/* Comments */}
          <CommentSection
            comments={project.comments}
            onAddComment={handleAddComment}
            onRequireAuth={onRequireAuth}
            onProfileClick={onProfileClick}
            updates={project.updates}
            projectId={project.id}
          />

          {/* Similar Projects */}
          {similarProjects.length > 0 && (
             <div className="mt-12 pt-10 border-t border-neutral-200 dark:border-neutral-800">
               <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-6">Similar Projects</h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                 {similarProjects.map(sim => (
                    <div
                      key={sim.id}
                      className="group rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 hover:shadow-card-hover hover:border-neutral-300 dark:hover:border-neutral-700 transition-all cursor-pointer bg-white dark:bg-neutral-900"
                      onClick={() => onProjectClick(sim)}
                    >
                       <div className="aspect-[16/10] bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                          <BlurredImage
                            src={sim.imageUrl || undefined}
                            alt={sim.title}
                            aspectRatio="aspect-[16/10]"
                            fallbackText={sim.title}
                            className="transition-transform duration-500 group-hover:scale-105"
                          />
                       </div>
                       <div className="p-4">
                         <h4 className="text-[14px] font-semibold text-neutral-900 dark:text-white group-hover:text-gouni-primary transition-colors truncate">{sim.title}</h4>
                         <p className="text-[12px] text-neutral-400 dark:text-neutral-400 mt-1 line-clamp-2">{sim.description}</p>
                       </div>
                    </div>
                 ))}
               </div>
             </div>
          )}
        </div>

        {/* ── Right: Sidebar ── */}
        <div className="space-y-5">

          {/* Actions */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 space-y-3">
            <Button
              onClick={(e) => onVote(e, project.id)}
              variant="outline"
              disabled={disabled || !user}
              aria-pressed={!!voted}
              className={`w-full justify-center rounded-xl border-orange-200 dark:border-neutral-700 hover:bg-orange-50 dark:hover:bg-neutral-800 hover:border-orange-300 dark:hover:border-neutral-600 ${
                voted ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-800' : 'text-neutral-700 dark:text-neutral-200'
              }`}
            >
              <ChevronUp className={`w-4 h-4 ${voted ? 'text-orange-500' : ''}`} />
              {voted ? `Upvoted (${project.likes})` : `Upvote (${project.likes})`}
            </Button>

            {project.demoUrl ? (
              <a href={project.demoUrl} target="_blank" rel="noreferrer" className="block">
                <Button variant="primary" className="w-full justify-center rounded-xl">
                  <Monitor className="w-4 h-4" />
                  Live Demo
                </Button>
              </a>
            ) : (
              <Button disabled variant="outline" className="w-full justify-center rounded-xl opacity-40">
                <Monitor className="w-4 h-4" />
                Demo Unavailable
              </Button>
            )}

            {project.repoUrl ? (
              <a href={project.repoUrl} target="_blank" rel="noreferrer" className="block">
                <Button variant="outline" className="w-full justify-center rounded-xl">
                  <Github className="w-4 h-4" />
                  Source Code
                </Button>
              </a>
            ) : (
              <Button variant="ghost" disabled className="w-full justify-center rounded-xl opacity-40">
                <Github className="w-4 h-4" />
                Repo Private
              </Button>
            )}

            {project.websiteUrl ? (
              <a href={project.websiteUrl} target="_blank" rel="noreferrer" className="block">
                <Button variant="outline" className="w-full justify-center rounded-xl">
                  Website
                </Button>
              </a>
            ) : null}

            {user && user.uid === authorUid && (
              <Button
                variant="outline"
                className="w-full justify-center rounded-xl text-gouni-primary border-gouni-primary/30 hover:bg-blue-50 dark:hover:bg-neutral-800"
                onClick={() => {
                  setEditedDemoUrl(project.demoUrl || '');
                  setEditedRepoUrl(project.repoUrl || '');
                  setEditedWebsiteUrl(project.websiteUrl || '');
                  setEditedOpenToContributions(!!project.openToContributions);
                  setEditedContributionAreas(project.contributionAreas || []);
                  setEditedImageFile(null);
                  setEditedImagePreview(null);
                  setShowEditDetailsModal(true);
                }}
              >
                Edit Details
              </Button>
            )}

            {profile?.isAdmin && (
              <div className="flex gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <Button
                  size="sm"
                  variant="outline"
                  className={`flex-1 rounded-xl ${
                    project.isSuspended
                      ? 'text-green-700 dark:text-green-400 border-green-300 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-950/30'
                      : 'text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                  }`}
                  onClick={() => setShowSuspendModal(true)}
                >
                  <AlertCircle className="w-4 h-4" /> {project.isSuspended ? 'Restore' : 'Suspend'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-red-700 dark:text-red-400 border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl"
                  onClick={() => setShowDeleteModal(true)}
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </Button>
              </div>
            )}
          </div>

          {/* GitHub Repository & Auto-Detected Contributors */}
          {(project.repoUrl || project.githubMeta) && (
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-neutral-900 dark:bg-neutral-800 border dark:border-neutral-700 text-white flex items-center justify-center shrink-0">
                    <Github className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">GitHub Repo</h4>
                    {project.githubMeta?.fullName ? (
                      <a
                        href={project.repoUrl || `https://github.com/${project.githubMeta.fullName}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[13px] font-semibold text-neutral-900 dark:text-white hover:text-gouni-primary truncate block"
                      >
                        {project.githubMeta.fullName}
                      </a>
                    ) : (
                      <span className="text-[12px] text-neutral-600 dark:text-neutral-300 truncate block">Repository Linked</span>
                    )}
                  </div>
                </div>

                {project.repoUrl && user && (
                  <button
                    type="button"
                    onClick={() => handleSyncGitHubRepo(true)}
                    disabled={syncingGitHub}
                    title="Sync latest commits, stars, and contributors from GitHub"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-[11px] font-semibold text-neutral-700 dark:text-neutral-200 transition-all disabled:opacity-50 shrink-0 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${syncingGitHub ? 'animate-spin' : ''}`} />
                    {syncingGitHub ? 'Syncing' : 'Sync'}
                  </button>
                )}
              </div>

              {project.githubMeta ? (
                <>
                  {/* Repo Stats */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-neutral-50 dark:bg-neutral-800/60 rounded-xl p-2.5 text-center border border-neutral-100 dark:border-neutral-800">
                      <div className="flex items-center justify-center gap-1 text-neutral-900 dark:text-white font-bold text-[14px]">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                        {project.githubMeta.stars}
                      </div>
                      <div className="text-[10px] font-medium text-neutral-400 mt-0.5">Stars</div>
                    </div>
                    <div className="bg-neutral-50 dark:bg-neutral-800/60 rounded-xl p-2.5 text-center border border-neutral-100 dark:border-neutral-800">
                      <div className="flex items-center justify-center gap-1 text-neutral-900 dark:text-white font-bold text-[14px]">
                        <GitFork className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
                        {project.githubMeta.forks}
                      </div>
                      <div className="text-[10px] font-medium text-neutral-400 mt-0.5">Forks</div>
                    </div>
                    <div className="bg-neutral-50 dark:bg-neutral-800/60 rounded-xl p-2.5 text-center border border-neutral-100 dark:border-neutral-800">
                      <div className="text-neutral-900 dark:text-white font-bold text-[14px]">
                        {project.githubMeta.openIssues}
                      </div>
                      <div className="text-[10px] font-medium text-neutral-400 mt-0.5">Open Issues</div>
                    </div>
                  </div>

                  {/* Languages */}
                  {project.githubMeta.languages && project.githubMeta.languages.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {project.githubMeta.languages.map(lang => (
                        <span
                          key={lang}
                          className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-[11px] font-medium border border-transparent dark:border-neutral-700/60"
                        >
                          {lang}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Latest Commit */}
                  {project.githubMeta.lastCommitMessage && (
                    <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-100 dark:border-neutral-800">
                      <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                        Latest Commit {project.githubMeta.lastCommitDate ? `· ${formatDate(project.githubMeta.lastCommitDate).split(',')[0]}` : ''}
                      </div>
                      <p className="text-[12px] text-neutral-700 dark:text-neutral-300 font-mono line-clamp-2">
                        {project.githubMeta.lastCommitMessage}
                      </p>
                    </div>
                  )}

                  {/* Quick GitHub Action Links */}
                  {project.repoUrl && (
                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={`${project.repoUrl.replace(/\/$/, '')}/pulls`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-[12px] font-semibold text-neutral-700 dark:text-neutral-200 transition-colors"
                      >
                        <GitPullRequest className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        Pull Requests
                      </a>
                      <a
                        href={`${project.repoUrl.replace(/\/$/, '')}/issues`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-[12px] font-semibold text-neutral-700 dark:text-neutral-200 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
                        View Issues
                      </a>
                    </div>
                  )}

                  {/* Contributors List */}
                  {project.githubMeta.contributors && project.githubMeta.contributors.length > 0 && (
                    <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                          Contributors ({project.githubMeta.contributors.length})
                        </span>
                      </div>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {project.githubMeta.contributors.map(contributor => {
                          const isGoBoardStudent = Boolean(contributor.goboardUid);
                          return (
                            <div
                              key={contributor.githubUsername}
                              onClick={() => {
                                if (contributor.goboardUid) {
                                  onProfileClick?.(contributor.goboardUid);
                                }
                              }}
                              className={`flex items-center justify-between gap-2 p-2 rounded-xl border transition-all ${
                                isGoBoardStudent
                                  ? 'border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/25 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer'
                                  : 'border-neutral-100 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-800/40'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <img
                                  src={contributor.githubAvatarUrl}
                                  alt={contributor.githubUsername}
                                  className="w-7 h-7 rounded-full object-cover border border-neutral-200 dark:border-neutral-700 shrink-0"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[12px] font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                                      {contributor.goboardDisplayName || `@${contributor.githubUsername}`}
                                    </span>
                                    {isGoBoardStudent && (
                                      <span
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 shrink-0"
                                        title="Verified GoBoard Student"
                                      >
                                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                                        Student
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-neutral-400 truncate">
                                    @{contributor.githubUsername}
                                  </div>
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded-md bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-[10px] font-semibold text-neutral-600 dark:text-neutral-300 shrink-0">
                                {contributor.contributions} commit{contributor.contributions !== 1 ? 's' : ''}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-3 leading-relaxed">
                        Pushed commits or merged a PR? Connect your GitHub in Profile and click <span className="font-semibold text-neutral-600 dark:text-neutral-300">Sync</span> to appear here.
                      </p>
                    </div>
                  )}

                  {/* Pull Request Cards */}
                  {(project.openToContributions || pullRequests.length > 0) && (
                    <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                          <GitPullRequest className="w-3.5 h-3.5 text-emerald-500" />
                          Pull Requests ({pullRequests.length})
                        </span>
                        {loadingPrs && (
                          <span className="text-[10px] text-neutral-400">Loading...</span>
                        )}
                      </div>

                      {pullRequests.length === 0 ? (
                        <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-dashed border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-500 dark:text-neutral-400 text-center">
                          No pull requests yet. Be the first to open a PR on GitHub!
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                          {pullRequests.map((pr) => {
                            const statusLabel = pr.merged
                              ? 'Merged'
                              : pr.state === 'open'
                              ? 'Open'
                              : 'Closed';
                            const statusBadgeClass = pr.merged
                              ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                              : pr.state === 'open'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700';

                            return (
                              <a
                                key={pr.id}
                                href={pr.htmlUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block p-2.5 rounded-xl border border-neutral-150 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/40 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all space-y-1.5"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="text-[12px] font-bold text-neutral-900 dark:text-neutral-100 line-clamp-1">
                                    <span className="text-neutral-400 font-mono mr-1">#{pr.number}</span>
                                    {pr.title}
                                  </div>
                                  <span
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase border shrink-0 ${statusBadgeClass}`}
                                  >
                                    {pr.merged ? (
                                      <GitMerge className="w-2.5 h-2.5" />
                                    ) : (
                                      <GitPullRequest className="w-2.5 h-2.5" />
                                    )}
                                    {statusLabel}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-neutral-500 dark:text-neutral-400">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    {pr.authorAvatarUrl && (
                                      <img
                                        src={pr.authorAvatarUrl}
                                        alt={pr.authorUsername}
                                        className="w-4 h-4 rounded-full object-cover"
                                      />
                                    )}
                                    <span className="truncate font-medium">@{pr.authorUsername}</span>
                                  </div>
                                  <span>{formatDate(pr.createdAt).split(',')[0]}</span>
                                </div>
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[12px] text-neutral-400 dark:text-neutral-500">
                  {syncingGitHub
                    ? 'Fetching repository stats & contributors from GitHub...'
                    : 'Click Sync to load live repository stats, languages, and contributors from GitHub.'}
                </div>
              )}
            </div>
          )}

          {/* Tech Stack */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5">
            <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-4">Technologies</h4>
            <div className="flex flex-wrap gap-2">
              {project.techStack.map(tech => (
                <span key={tech} className="px-3 py-1.5 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-[12px] font-medium rounded-lg border border-neutral-100 dark:border-neutral-700">
                  {tech}
                </span>
              ))}
            </div>
          </div>

          {/* Author */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5">
            <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-4">Author</h4>
            <div className="flex items-center gap-3">
              <UserAvatar
                uid={authorUid}
                photoURL={author.photoURL}
                fallbackName={author.displayName}
                size="lg"
                className="rounded-xl"
              />
              <div>
                <div className="text-[14px] font-semibold text-neutral-900 dark:text-white">{author.displayName}</div>
                <div className="text-[12px] text-neutral-400">{project.level}</div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && profile?.isAdmin && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-float p-6 w-96 animate-fade-up">
            <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-2">Delete Project?</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-4">
              This will permanently delete the project and all associated votes, comments, and updates. This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="bg-red-600 hover:bg-red-700"
                onClick={handleDelete}
                isLoading={isProcessing}
              >
                Delete Permanently
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend/Restore Confirmation Modal */}
      {showSuspendModal && profile?.isAdmin && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-float p-6 w-96 animate-fade-up">
            {project.isSuspended ? (
              <>
                <h3 className="text-lg font-bold text-green-600 dark:text-green-400 mb-2">Restore Project?</h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-4">
                  This will restore the project to public view. The author will be notified.
                </p>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowSuspendModal(false)}
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={handleRestore}
                    isLoading={isProcessing}
                  >
                    Restore Project
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-amber-600 dark:text-amber-400 mb-2">Suspend Project?</h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-3">
                  The project will be hidden from public view. The author will be notified.
                </p>
                <textarea
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  placeholder="Reason for suspension (will be sent to author)..."
                  className="w-full p-3 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 rounded-xl mb-4 text-sm font-sans resize-none"
                  rows={3}
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowSuspendModal(false);
                      setSuspensionReason('');
                    }}
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    className="bg-amber-600 hover:bg-amber-700"
                    onClick={handleSuspend}
                    isLoading={isProcessing}
                  >
                    Suspend Project
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit Description Modal */}
      {showEditDescriptionModal && user && user.uid === authorUid && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-float p-6 w-96 animate-fade-up max-h-[70vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-4">Edit Project Description</h3>
            <textarea
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              placeholder="Enter project description..."
              className="w-full p-3 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 rounded-xl mb-4 text-sm font-sans resize-none focus:outline-none focus:ring-2 focus:ring-gouni-primary/20 focus:border-gouni-primary/40"
              rows={6}
            />
            <div className="text-xs text-neutral-400 dark:text-neutral-500 mb-4">{editedDescription.length} characters</div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowEditDescriptionModal(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleEditDescription}
                isLoading={isProcessing}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Details Modal (URLs + Collaboration + Image) */}
      {showEditDetailsModal && user && user.uid === authorUid && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-float p-6 w-full max-w-md animate-fade-up max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-5">Edit Project Details</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">GitHub Repository URL</label>
                <input
                  type="url"
                  value={editedRepoUrl}
                  onChange={(e) => setEditedRepoUrl(e.target.value)}
                  placeholder="https://github.com/username/repo"
                  className="w-full px-3.5 py-2.5 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 rounded-xl focus:ring-2 focus:ring-gouni-primary/20 focus:border-gouni-primary/40 outline-none text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Demo URL</label>
                <input
                  type="url"
                  value={editedDemoUrl}
                  onChange={(e) => setEditedDemoUrl(e.target.value)}
                  placeholder="https://demo.example.com"
                  className="w-full px-3.5 py-2.5 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 rounded-xl focus:ring-2 focus:ring-gouni-primary/20 focus:border-gouni-primary/40 outline-none text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Website URL</label>
                <input
                  type="url"
                  value={editedWebsiteUrl}
                  onChange={(e) => setEditedWebsiteUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3.5 py-2.5 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 rounded-xl focus:ring-2 focus:ring-gouni-primary/20 focus:border-gouni-primary/40 outline-none text-sm transition-all"
                />
              </div>

              {/* Open to Contributions Toggle */}
              <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-semibold text-neutral-900 dark:text-emerald-200 flex items-center gap-1.5">
                      <GitPullRequest className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      Open to Contributions
                    </div>
                    <p className="text-[11px] text-neutral-500 dark:text-emerald-400/80 mt-0.5">
                      Invite students to push commits or open PRs on GitHub
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={editedOpenToContributions}
                    onClick={() => setEditedOpenToContributions(prev => !prev)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      editedOpenToContributions ? 'bg-emerald-600' : 'bg-neutral-300 dark:bg-neutral-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        editedOpenToContributions ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {editedOpenToContributions && (
                  <div className="mt-3 pt-3 border-t border-emerald-200/60 dark:border-emerald-800/40">
                    <label className="block text-[11px] font-semibold text-emerald-900 dark:text-emerald-300 mb-2">
                      Areas where contributions are welcome
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {CONTRIBUTION_AREAS.map(area => {
                        const selected = editedContributionAreas.includes(area);
                        return (
                          <button
                            key={area}
                            type="button"
                            onClick={() => toggleEditedArea(area)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                              selected
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-emerald-200 dark:border-emerald-800 hover:border-emerald-400'
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
                <label className="block text-[13px] font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Project Image</label>
                <input
                  ref={editImageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) {
                      toast('Image must be under 5MB', 'error');
                      return;
                    }
                    setEditedImageFile(file);
                    const reader = new FileReader();
                    reader.onloadend = () => setEditedImagePreview(reader.result as string);
                    reader.readAsDataURL(file);
                  }}
                />
                {editedImagePreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700">
                    <img src={editedImagePreview || undefined} alt="Preview" className="w-full h-40 object-cover" />
                    <button
                      type="button"
                      onClick={() => { setEditedImageFile(null); setEditedImagePreview(null); }}
                      className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-lg transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => editImageInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-xl p-6 flex flex-col items-center text-center bg-neutral-50/50 dark:bg-neutral-800/40 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-600 transition-all cursor-pointer"
                  >
                    <span className="text-[13px] font-medium text-neutral-600 dark:text-neutral-300">Upload new image</span>
                    <span className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">PNG, JPG up to 5MB (optional)</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <Button
                variant="outline"
                onClick={() => setShowEditDetailsModal(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleEditDetails}
                isLoading={isProcessing}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer */}
      {showImageViewer && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowImageViewer(false)}
        >
          <button
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            onClick={() => setShowImageViewer(false)}
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <img
            src={activeImage || undefined}
            alt={project.title}
            className="max-w-full max-h-[75vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          {/* Thumbnail strip */}
          {project.screenshots.length > 0 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 bg-black/60 p-2 rounded-xl backdrop-blur-sm">
              <button
                onClick={(e) => { e.stopPropagation(); setActiveImage(project.imageUrl); }}
                className={`w-16 h-11 rounded-lg overflow-hidden border-2 transition-all ${activeImage === project.imageUrl ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'}`}
              >
                <img src={project.imageUrl || undefined} className="w-full h-full object-cover" />
              </button>
              {project.screenshots.map((shot, idx) => (
                <button
                  key={idx}
                  onClick={(e) => { e.stopPropagation(); setActiveImage(shot); }}
                  className={`w-16 h-11 rounded-lg overflow-hidden border-2 transition-all ${activeImage === shot ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'}`}
                >
                  <img src={shot || undefined} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
