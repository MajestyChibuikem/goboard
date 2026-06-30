import React, { useState, useEffect } from 'react';
import { Project, Writing } from '../types';
import {
  subscribeToPendingProjects, approveProject, rejectProject, deleteProject,
  awardXP, XP_VALUES, resetDatabase,
  subscribeToPendingWritings, approveWriting, rejectWriting, deleteWriting,
} from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './Toast';
import { Button } from './Button';
import { ArrowLeft, Check, X, Shield, Clock, Trash, RotateCcw, BookOpen, Layers } from 'lucide-react';
import { formatDate } from '../services/utils';
import { STATUS_CONFIG } from '../constants';

interface AdminQueueProps {
  onBack: () => void;
  onProjectClick: (project: Project) => void;
}

export const AdminQueue: React.FC<AdminQueueProps> = ({ onBack, onProjectClick }) => {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'projects' | 'literature'>('projects');

  // Projects queue state
  const [pendingProjects, setPendingProjects] = useState<Project[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Literature queue state
  const [pendingWritings, setPendingWritings] = useState<Writing[]>([]);
  const [litProcessing, setLitProcessing] = useState<string | null>(null);
  const [litRejectId, setLitRejectId] = useState<string | null>(null);
  const [litRejectReason, setLitRejectReason] = useState('');

  useEffect(() => {
    const unsub = subscribeToPendingProjects(setPendingProjects);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeToPendingWritings(setPendingWritings);
    return () => unsub();
  }, []);

  if (!profile?.isAdmin) {
    return (
      <div className="animate-fade-up text-center py-20">
        <Shield className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-neutral-900 mb-1">Admin Access Required</h2>
        <p className="text-[13px] text-neutral-400">You don't have permission to view this page.</p>
      </div>
    );
  }

  // ── Project handlers ──

  const handleApprove = async (project: Project) => {
    setProcessing(project.id);
    try {
      await approveProject(project.id);
      const authorUid = (project as any).authorUid;
      if (authorUid) await awardXP(authorUid, XP_VALUES.PROJECT_APPROVED);
      toast('Project approved!', 'success');
    } catch (err) {
      console.error('Failed to approve:', err);
      toast('Failed to approve project.', 'error');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (projectId: string) => {
    setProcessing(projectId);
    try {
      await rejectProject(projectId, rejectReason);
      toast('Project rejected.', 'info');
    } catch (err) {
      console.error('Failed to reject:', err);
      toast('Failed to reject project.', 'error');
    } finally {
      setProcessing(null);
      setRejectId(null);
      setRejectReason('');
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!confirm('Permanently delete this project? This cannot be undone.')) return;
    setProcessing(projectId);
    try {
      await deleteProject(projectId, profile!.uid);
      toast('Project deleted.', 'success');
    } catch (err) {
      console.error('Failed to delete:', err);
      toast('Failed to delete project.', 'error');
    } finally {
      setProcessing(null);
    }
  };

  const handleResetDatabase = async () => {
    setProcessing('reset');
    try {
      await resetDatabase();
      toast('Database reset complete. All projects, votes, and comments cleared.', 'success');
      setShowResetConfirm(false);
      setPendingProjects([]);
    } catch (err) {
      console.error('Reset failed:', err);
      toast('Failed to reset database.', 'error');
    } finally {
      setProcessing(null);
    }
  };

  // ── Writing handlers ──

  const handleApproveWriting = async (writing: Writing) => {
    setLitProcessing(writing.id);
    try {
      await approveWriting(writing.id);
      toast('Writing approved!', 'success');
    } catch (err) {
      console.error('Failed to approve writing:', err);
      toast('Failed to approve writing.', 'error');
    } finally {
      setLitProcessing(null);
    }
  };

  const handleRejectWriting = async (writingId: string) => {
    setLitProcessing(writingId);
    try {
      await rejectWriting(writingId, litRejectReason);
      toast('Writing rejected.', 'info');
    } catch (err) {
      console.error('Failed to reject writing:', err);
      toast('Failed to reject writing.', 'error');
    } finally {
      setLitProcessing(null);
      setLitRejectId(null);
      setLitRejectReason('');
    }
  };

  const handleDeleteWriting = async (writingId: string) => {
    if (!confirm('Permanently delete this writing? This cannot be undone.')) return;
    setLitProcessing(writingId);
    try {
      await deleteWriting(writingId, profile!.uid);
      toast('Writing deleted.', 'success');
    } catch (err) {
      console.error('Failed to delete writing:', err);
      toast('Failed to delete writing.', 'error');
    } finally {
      setLitProcessing(null);
    }
  };

  const totalPending = pendingProjects.length + pendingWritings.length;

  return (
    <div className="animate-fade-up">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-400 hover:text-neutral-900 transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to projects
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
          <Shield className="w-5 h-5 text-amber-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Approval Queue</h1>
          <p className="text-[13px] text-neutral-400">{totalPending} submission{totalPending !== 1 ? 's' : ''} awaiting review</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 bg-white border border-neutral-200 p-1 rounded-xl mb-6 w-fit">
        <button
          onClick={() => setActiveTab('projects')}
          className={`flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg transition-all ${
            activeTab === 'projects' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-700'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Projects
          {pendingProjects.length > 0 && (
            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'projects' ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-600'
            }`}>
              {pendingProjects.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('literature')}
          className={`flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg transition-all ${
            activeTab === 'literature' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-700'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          Literature
          {pendingWritings.length > 0 && (
            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'literature' ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-600'
            }`}>
              {pendingWritings.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Projects Tab ── */}
      {activeTab === 'projects' && (
        <>
          <div className="mb-6 flex justify-end">
            <Button
              onClick={() => setShowResetConfirm(true)}
              size="sm"
              variant="outline"
              className="rounded-xl text-red-700 border-red-300 hover:bg-red-50"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Database
            </Button>
          </div>

          {pendingProjects.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-neutral-200">
              <Clock className="w-10 h-10 text-neutral-200 mx-auto mb-3" />
              <p className="text-[14px] font-medium text-neutral-900 mb-1">All caught up</p>
              <p className="text-[13px] text-neutral-400">No pending project submissions to review.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingProjects.map(project => (
                <div key={project.id} className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
                  <div className="flex gap-4 p-5">
                    <div
                      className="w-24 h-18 rounded-xl bg-neutral-100 overflow-hidden shrink-0 cursor-pointer"
                      onClick={() => onProjectClick(project)}
                    >
                      <img src={project.imageUrl || undefined} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3
                          className="text-[15px] font-semibold text-neutral-900 truncate cursor-pointer hover:text-gouni-primary transition-colors"
                          onClick={() => onProjectClick(project)}
                        >
                          {project.title}
                        </h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_CONFIG[project.status].color}`}>
                          {STATUS_CONFIG[project.status].label}
                        </span>
                      </div>
                      <p className="text-[13px] text-neutral-500 line-clamp-2 mb-2">{project.description}</p>
                      <div className="flex items-center gap-3 text-[12px] text-neutral-400">
                        <span className="font-medium text-neutral-600">{project.displayName || project.studentName}</span>
                        <span>{project.level}</span>
                        <span>{project.category}</span>
                        <span>{formatDate(project.datePosted)}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {project.techStack.map(t => (
                          <span key={t} className="px-2 py-0.5 bg-neutral-50 text-neutral-500 text-[11px] rounded-md border border-neutral-100">{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {rejectId === project.id && (
                    <div className="px-5 pb-3">
                      <input
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Reason for rejection (optional)..."
                        className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm mb-2"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2 px-5 py-3 bg-neutral-50 border-t border-neutral-100">
                    {rejectId === project.id ? (
                      <>
                        <Button size="sm" variant="primary" className="rounded-xl bg-red-600 hover:bg-red-700" onClick={() => handleReject(project.id)} isLoading={processing === project.id}>
                          Confirm Reject
                        </Button>
                        <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => setRejectId(null)}>Cancel</Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="primary" className="rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApprove(project)} isLoading={processing === project.id}>
                          <Check className="w-3.5 h-3.5" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-xl text-red-600 border-red-200 hover:bg-red-50" onClick={() => setRejectId(project.id)}>
                          <X className="w-3.5 h-3.5" /> Reject
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-xl text-red-700 border-red-300 hover:bg-red-50" onClick={() => handleDelete(project.id)} isLoading={processing === project.id}>
                          <Trash className="w-3.5 h-3.5" /> Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Literature Tab ── */}
      {activeTab === 'literature' && (
        <>
          {pendingWritings.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-neutral-200">
              <Clock className="w-10 h-10 text-neutral-200 mx-auto mb-3" />
              <p className="text-[14px] font-medium text-neutral-900 mb-1">All caught up</p>
              <p className="text-[13px] text-neutral-400">No pending writing submissions to review.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingWritings.map(writing => (
                <div key={writing.id} className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-[15px] font-semibold text-neutral-900 truncate">{writing.title}</h3>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 capitalize">
                        {writing.genre.replace('-', ' ')}
                      </span>
                    </div>
                    <p className="text-[13px] text-neutral-500 line-clamp-3 mb-2 font-serif whitespace-pre-line">{writing.body}</p>
                    <div className="flex items-center gap-3 text-[12px] text-neutral-400">
                      <span className="font-medium text-neutral-600">{writing.displayName || 'Student'}</span>
                      <span>{writing.body.split(/\s+/).filter(Boolean).length} words</span>
                      <span>{formatDate(writing.datePosted)}</span>
                    </div>
                  </div>

                  {litRejectId === writing.id && (
                    <div className="px-5 pb-3">
                      <input
                        value={litRejectReason}
                        onChange={(e) => setLitRejectReason(e.target.value)}
                        placeholder="Reason for rejection (optional)..."
                        className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm mb-2"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2 px-5 py-3 bg-neutral-50 border-t border-neutral-100">
                    {litRejectId === writing.id ? (
                      <>
                        <Button size="sm" variant="primary" className="rounded-xl bg-red-600 hover:bg-red-700" onClick={() => handleRejectWriting(writing.id)} isLoading={litProcessing === writing.id}>
                          Confirm Reject
                        </Button>
                        <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => setLitRejectId(null)}>Cancel</Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="primary" className="rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApproveWriting(writing)} isLoading={litProcessing === writing.id}>
                          <Check className="w-3.5 h-3.5" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-xl text-red-600 border-red-200 hover:bg-red-50" onClick={() => setLitRejectId(writing.id)}>
                          <X className="w-3.5 h-3.5" /> Reject
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-xl text-red-700 border-red-300 hover:bg-red-50" onClick={() => handleDeleteWriting(writing.id)} isLoading={litProcessing === writing.id}>
                          <Trash className="w-3.5 h-3.5" /> Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Reset Database Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowResetConfirm(false)} />
          <div className="relative bg-white rounded-2xl shadow-float w-full max-w-sm animate-fade-up">
            <div className="flex items-center justify-between p-6 border-b border-neutral-100">
              <h2 className="text-lg font-bold text-neutral-900">Reset Database?</h2>
              <button onClick={() => setShowResetConfirm(false)} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-neutral-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-[13px] text-red-800">
                  ⚠️ <strong>This action cannot be undone.</strong> This will permanently delete all projects, votes, and comments. User accounts will be preserved.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 px-4 py-2.5 border border-neutral-200 rounded-xl text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                >
                  Cancel
                </button>
                <Button
                  onClick={handleResetDatabase}
                  disabled={processing === 'reset'}
                  className="flex-1 rounded-xl bg-red-600 hover:bg-red-700"
                  isLoading={processing === 'reset'}
                >
                  Reset Now
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
