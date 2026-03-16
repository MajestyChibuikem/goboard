import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { Project } from '../types';
import { ProjectDetailView } from '../components/ProjectDetailView';
import { PublicProfileModal } from '../components/PublicProfileModal';
import { getProjectById } from '../services/firestoreService';
import type { HomeContext } from './HomePage';

const ProjectPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    projects,
    userVotes,
    votingPending,
    handleVote,
    requireAuth,
  } = useOutletContext<HomeContext>();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null);

  // Try to find the project in the already-loaded list first, then fall back to Firestore
  useEffect(() => {
    if (!id) return;

    const fromList = projects.find(p => p.id === id);
    if (fromList) {
      setProject(fromList);
      setLoading(false);
      return;
    }

    // Not in local list — fetch from Firestore (handles refresh)
    getProjectById(id)
      .then(p => {
        setProject(p);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch project:', err);
        setLoading(false);
      });
  }, [id, projects]);

  const handleUpdateProject = useCallback((updated: Project) => {
    setProject(updated);
  }, []);

  if (loading) {
    return (
      <div className="max-w-[1440px] mx-auto flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-neutral-200 border-t-neutral-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-[1440px] mx-auto text-center py-24">
        <h2 className="text-xl font-semibold text-neutral-900 mb-2">Project not found</h2>
        <p className="text-sm text-neutral-400 mb-6">This project may have been removed or doesn't exist.</p>
        <button
          onClick={() => navigate('/')}
          className="text-sm font-medium text-gouni-primary hover:underline"
        >
          Back to projects
        </button>
      </div>
    );
  }

  return (
    <>
      <ProjectDetailView
        project={project}
        onBack={() => navigate('/')}
        onUpdateProject={handleUpdateProject}
        allProjects={projects}
        onProjectClick={(p) => navigate(`/project/${p.id}`)}
        onVote={handleVote}
        onRequireAuth={() => requireAuth(() => {})}
        onProfileClick={(userId) => setSelectedProfileUserId(userId)}
        voted={userVotes.has(project.id)}
        disabled={votingPending.has(project.id)}
      />

      {selectedProfileUserId && (
        <PublicProfileModal
          userId={selectedProfileUserId}
          onClose={() => setSelectedProfileUserId(null)}
          onProjectClick={(p) => navigate(`/project/${p.id}`)}
        />
      )}
    </>
  );
};

export default ProjectPage;
