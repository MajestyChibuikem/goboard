import React, { useState } from 'react';
import { Project, Comment, ProjectUpdate, ProjectStatus } from '../types';
import { generateProjectInsight } from '../services/geminiService';
import { getProjectBadges } from '../services/utils';
import { ArrowLeft, Github, Sparkles, User, Monitor, ChevronUp, AlertCircle, Trash2 } from 'lucide-react';
import { Button } from './Button';
import { CommentSection } from './CommentSection';
import { ProjectTimeline } from './ProjectTimeline';
import { AddUpdateForm } from './AddUpdateForm';
import { formatDate } from '../services/utils';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './Toast';
import { addComment as addCommentToFirestore, addProjectUpdate as addUpdateToFirestore, updateProjectStatus as updateStatusInFirestore, awardCommentXP, deleteProject, suspendProject } from '../services/firestoreService';
import { GeminiInsight } from '../types';
import { STATUS_CONFIG } from '../constants';

interface ProjectDetailViewProps {
  project: Project;
  onBack: () => void;
  onUpdateProject: (project: Project) => void;
  allProjects: Project[];
  onProjectClick: (project: Project) => void;
  onVote: (e: React.MouseEvent, projectId: string) => void;
  onRequireAuth: () => void;
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
        await awardCommentXP(user.uid, project.id, authorUid);
      }
      toast('Comment posted!', 'success');
    } catch (err) {
      console.error('Failed to save comment:', err);
      toast('Failed to post comment.', 'error');
    }
  };

  const handleAddUpdate = async (updateData: Omit<ProjectUpdate, 'id' | 'date'>) => {
    if (!user) { onRequireAuth(); return; }

    const newUpdate: ProjectUpdate = {
      ...updateData,
      id: Date.now().toString(),
      date: new Date().toISOString(),
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

  return (
    <div className="animate-fade-up">

      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-400 hover:text-neutral-900 transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to projects
      </button>

      {/* Hero section */}
      <div className="mb-10">
        {/* Title + badges */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h1 className="text-3xl font-bold text-neutral-900 tracking-tight">{project.title}</h1>
          {/* Status badge */}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${STATUS_CONFIG[project.status].color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[project.status].dot}`} />
            {STATUS_CONFIG[project.status].label}
          </span>
          {badges.map((badge) => (
            <span
              key={badge.label}
              className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold bg-neutral-100 text-neutral-700"
            >
              <span className="mr-1.5">{badge.icon}</span> {badge.label}
            </span>
          ))}
          {project.isSuspended && (
            <span className="inline-block px-3 py-1 bg-amber-100 border border-amber-300 rounded-full text-[11px] font-semibold text-amber-700">
              ⚠️ Suspended
            </span>
          )}
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-400">
          <span className="px-2.5 py-1 bg-neutral-900 text-white text-[11px] font-medium rounded-lg">{project.category}</span>
          <span>Posted {formatDate(project.datePosted)}</span>
          <span className="text-neutral-200">|</span>
          <span className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-gouni-secondary/80 flex items-center justify-center text-[9px] font-bold text-gouni-dark">
              {(project.displayName || project.studentName).charAt(0)}
            </div>
            <span className="font-medium text-neutral-700">{project.displayName || project.studentName}</span>
            <span className="text-neutral-300">·</span>
            <span>{project.level}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

        {/* ── Left: Content ── */}
        <div className="lg:col-span-2">

          {/* Image gallery */}
          <div className="mb-10">
            <div className="aspect-video w-full bg-neutral-100 rounded-2xl overflow-hidden mb-3">
              <img src={activeImage} alt={project.title} className="w-full h-full object-cover" />
            </div>
            {(project.screenshots.length > 0) && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setActiveImage(project.imageUrl)}
                  className={`w-20 h-14 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all ${activeImage === project.imageUrl ? 'border-neutral-900 shadow-sm' : 'border-transparent opacity-60 hover:opacity-100'}`}
                >
                  <img src={project.imageUrl} className="w-full h-full object-cover" />
                </button>
                {project.screenshots.map((shot, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImage(shot)}
                    className={`w-20 h-14 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all ${activeImage === shot ? 'border-neutral-900 shadow-sm' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  >
                    <img src={shot} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="mb-10">
            <h3 className="text-[13px] font-bold text-neutral-400 uppercase tracking-wider mb-3">Overview</h3>
            <p className="text-[15px] text-neutral-700 whitespace-pre-line leading-relaxed">{project.description}</p>
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
          <div className="bg-gradient-to-br from-indigo-50/80 to-violet-50/50 rounded-2xl p-6 mb-10 border border-indigo-100/60">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                </div>
                <span className="text-[13px] font-bold text-neutral-900">AI Analysis</span>
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
                  <p className="text-[14px] text-neutral-700 leading-relaxed">{insight.review}</p>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider mb-1">Impact</div>
                  <p className="text-[14px] text-neutral-700 leading-relaxed">{insight.impact}</p>
                </div>
                <div className="bg-white/60 rounded-xl p-4 border border-indigo-100/60">
                  <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider mb-1">Suggestion</div>
                  <p className="text-[14px] text-neutral-600 italic leading-relaxed">"{insight.suggestion}"</p>
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-neutral-400">
                Get an AI-powered evaluation of technical merit and potential impact.
              </p>
            )}
          </div>

          {/* Comments */}
          <CommentSection
            comments={project.comments}
            onAddComment={handleAddComment}
            onRequireAuth={onRequireAuth}
            updates={project.updates}
            projectId={project.id}
          />

          {/* Similar Projects */}
          {similarProjects.length > 0 && (
             <div className="mt-12 pt-10 border-t border-neutral-200">
               <h3 className="text-lg font-bold text-neutral-900 mb-6">Similar Projects</h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                 {similarProjects.map(sim => (
                    <div
                      key={sim.id}
                      className="group rounded-2xl overflow-hidden border border-neutral-200 hover:shadow-card-hover hover:border-neutral-300 transition-all cursor-pointer bg-white"
                      onClick={() => onProjectClick(sim)}
                    >
                       <div className="aspect-[16/10] bg-neutral-100 overflow-hidden">
                          <img src={sim.imageUrl} alt={sim.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                       </div>
                       <div className="p-4">
                         <h4 className="text-[14px] font-semibold text-neutral-900 group-hover:text-gouni-primary transition-colors truncate">{sim.title}</h4>
                         <p className="text-[12px] text-neutral-400 mt-1 line-clamp-2">{sim.description}</p>
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
          <div className="bg-white rounded-2xl border border-neutral-200 p-5 space-y-3">
            <Button
              onClick={(e) => onVote(e, project.id)}
              variant="outline"
              disabled={disabled || !user}
              aria-pressed={!!voted}
              className={`w-full justify-center rounded-xl border-orange-200 hover:bg-orange-50 hover:border-orange-300 ${
                voted ? 'bg-orange-50 text-orange-600 border-orange-300' : 'text-neutral-700'
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

            {profile?.isAdmin && (
              <div className="flex gap-2 pt-3 border-t border-neutral-200">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-amber-700 border-amber-300 hover:bg-amber-50 rounded-xl"
                  onClick={() => setShowSuspendModal(true)}
                >
                  <AlertCircle className="w-4 h-4" /> Suspend
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-red-700 border-red-300 hover:bg-red-50 rounded-xl"
                  onClick={() => setShowDeleteModal(true)}
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </Button>
              </div>
            )}
          </div>

          {/* Tech Stack */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-5">
            <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-4">Technologies</h4>
            <div className="flex flex-wrap gap-2">
              {project.techStack.map(tech => (
                <span key={tech} className="px-3 py-1.5 bg-neutral-50 text-neutral-600 text-[12px] font-medium rounded-lg border border-neutral-100">
                  {tech}
                </span>
              ))}
            </div>
          </div>

          {/* Author */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-5">
            <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-4">Author</h4>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gouni-secondary/80 rounded-xl flex items-center justify-center text-lg font-bold text-gouni-dark">
                {(project.displayName || project.studentName).charAt(0)}
              </div>
              <div>
                <div className="text-[14px] font-semibold text-neutral-900">{project.displayName || project.studentName}</div>
                <div className="text-[12px] text-neutral-400">{project.level}</div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && profile?.isAdmin && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-float p-6 w-96 animate-fade-up">
            <h3 className="text-lg font-bold text-red-600 mb-2">Delete Project?</h3>
            <p className="text-sm text-neutral-600 mb-4">
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

      {/* Suspend Confirmation Modal */}
      {showSuspendModal && profile?.isAdmin && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-float p-6 w-96 animate-fade-up">
            <h3 className="text-lg font-bold text-amber-600 mb-2">Suspend Project?</h3>
            <p className="text-sm text-neutral-600 mb-3">
              The project will be hidden from public view. The author will be notified.
            </p>
            <textarea
              value={suspensionReason}
              onChange={(e) => setSuspensionReason(e.target.value)}
              placeholder="Reason for suspension (will be sent to author)..."
              className="w-full p-3 border border-neutral-200 rounded-xl mb-4 text-sm font-sans resize-none"
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
          </div>
        </div>
      )}
    </div>
  );
};
