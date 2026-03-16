import React, { useMemo, useState, useEffect } from 'react';
import { Project, Category, BoardNotice } from '../types';
import { ProjectCard } from '../components/ProjectCard';
import { ProjectGridSkeleton } from '../components/Skeleton';
import { PublicProfileModal } from '../components/PublicProfileModal';
import { Button } from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import {
  getTopUsersByXP,
  getBoardNotice,
  updateBoardNotice,
  getTrendingTechnologies,
} from '../services/firestoreService';
import { useToast } from '../components/Toast';
import { CATEGORIES } from '../constants';
import {
  Search,
  Plus,
  Tag,
  Home,
  TrendingUp,
  Clock,
  MessageCircle,
  Trophy,
  Zap,
  Layers,
} from 'lucide-react';
import { useOutletContext, useNavigate } from 'react-router-dom';

type SortOption = 'newest' | 'votes' | 'comments';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  [Category.WEB]: <Layers className="w-4 h-4" />,
  [Category.MOBILE]: <Zap className="w-4 h-4" />,
  [Category.AI]: <Zap className="w-4 h-4" />,
  [Category.IOT]: <Zap className="w-4 h-4" />,
  [Category.GAME]: <Zap className="w-4 h-4" />,
  [Category.DATA]: <Zap className="w-4 h-4" />,
};

export interface HomeContext {
  projects: Project[];
  firestoreReady: boolean;
  userVotes: Set<string>;
  votingPending: Set<string>;
  handleVote: (e: React.MouseEvent, projectId: string) => void;
  requireAuth: (action: () => void) => void;
  setIsSubmitModalOpen: (open: boolean) => void;
}

const HomePage: React.FC = () => {
  const {
    projects,
    firestoreReady,
    userVotes,
    votingPending,
    handleVote,
    requireAuth,
    setIsSubmitModalOpen,
  } = useOutletContext<HomeContext>();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null);

  // Sidebar state
  const [topUsersByXP, setTopUsersByXP] = useState<any[]>([]);
  const [boardNotice, setBoardNotice] = useState<BoardNotice>({
    id: 'boardNotice',
    title: 'Board Notice',
    content: 'Post more projects to gain more XP!!',
    updatedAt: new Date().toISOString(),
  });
  const [trendingTechs, setTrendingTechs] = useState<{ tech: string; count: number }[]>([]);
  const [showEditNoticeModal, setShowEditNoticeModal] = useState(false);
  const [noticeEditText, setNoticeEditText] = useState(boardNotice.content);

  useEffect(() => {
    getTopUsersByXP(5)
      .then(setTopUsersByXP)
      .catch(err => console.warn('Failed to fetch top users:', err));
  }, []);

  useEffect(() => {
    getBoardNotice()
      .then(notice => notice && setBoardNotice(notice))
      .catch(err => console.warn('Failed to fetch board notice:', err));
  }, []);

  useEffect(() => {
    if (projects.length > 0) {
      getTrendingTechnologies(6)
        .then(setTrendingTechs)
        .catch(err => console.warn('Failed to fetch trending tech:', err));
    }
  }, [projects]);

  const filteredProjects = useMemo(() => {
    let filtered = projects.filter(project => {
      const matchesSearch = project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            project.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            project.techStack.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = selectedCategory === 'All' || project.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'votes':
          return b.likes - a.likes;
        case 'comments':
          return b.comments.length - a.comments.length;
        case 'newest':
        default:
          return new Date(b.datePosted).getTime() - new Date(a.datePosted).getTime();
      }
    });
  }, [projects, searchQuery, selectedCategory, sortBy]);

  const handleShowProfile = (userId: string) => {
    setSelectedProfileUserId(userId);
  };

  return (
    <div className="flex gap-8">
      {/* Left Sidebar (Desktop) */}
      <nav className="hidden lg:block w-52 shrink-0 sticky top-24 h-fit">
        <div className="space-y-1">
          <button
            onClick={() => setSelectedCategory('All')}
            className={`flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] font-medium rounded-xl transition-all ${
              selectedCategory === 'All'
                ? 'bg-neutral-900 text-white shadow-sm'
                : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
            }`}
          >
            <Home className="w-4 h-4" />
            All Projects
          </button>

          <div className="pt-5 pb-2 px-3.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest">Categories</div>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] rounded-xl transition-all ${
                selectedCategory === cat
                  ? 'bg-neutral-900 text-white shadow-sm'
                  : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              {CATEGORY_ICONS[cat] || <Tag className="w-4 h-4" />}
              <span className="truncate">{cat}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow min-w-0">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
              {selectedCategory === 'All' ? 'Discover Projects' : selectedCategory}
            </h1>
            <p className="text-sm text-neutral-400 mt-1">
              {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''} from GoUni students
            </p>
          </div>

          {/* Sort pills */}
          <div className="flex items-center gap-1 bg-white border border-neutral-200 p-1 rounded-xl">
            <button
              onClick={() => setSortBy('newest')}
              className={`px-3.5 py-1.5 text-[12px] font-medium rounded-lg flex items-center gap-1.5 transition-all ${
                sortBy === 'newest' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-700'
              }`}
            >
              <Clock className="w-3.5 h-3.5" /> New
            </button>
            <button
              onClick={() => setSortBy('votes')}
              className={`px-3.5 py-1.5 text-[12px] font-medium rounded-lg flex items-center gap-1.5 transition-all ${
                sortBy === 'votes' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-700'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" /> Top
            </button>
            <button
              onClick={() => setSortBy('comments')}
              className={`px-3.5 py-1.5 text-[12px] font-medium rounded-lg flex items-center gap-1.5 transition-all ${
                sortBy === 'comments' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-700'
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" /> Discussed
            </button>
          </div>
        </div>

        {/* Mobile search */}
        <div className="md:hidden mb-6 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search projects, students, tech..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 text-sm bg-neutral-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gouni-primary/20"
          />
        </div>

        {/* Desktop search (visible on home) */}
        <div className="hidden md:block lg:hidden mb-6 relative w-80">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search projects, students, tech..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 text-sm bg-neutral-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gouni-primary/20"
          />
        </div>

        {/* Project Grid */}
        {!firestoreReady ? (
          <ProjectGridSkeleton count={4} />
        ) : filteredProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-10">
            {filteredProjects.map((project, idx) => (
              <div key={project.id} className={idx > 0 ? `animate-fade-up animate-fade-up-delay-${Math.min(idx, 3)}` : 'animate-fade-up'}>
                <ProjectCard
                  project={project}
                  onClick={(p) => navigate(`/project/${p.id}`)}
                  onVote={handleVote}
                  voted={userVotes.has(project.id)}
                  disabled={votingPending.has(project.id) || (!!user && user.uid === (project as any).authorUid)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-24">
            <div className="w-16 h-16 mx-auto mb-4 bg-neutral-100 rounded-2xl flex items-center justify-center">
              <Tag className="w-7 h-7 text-neutral-300" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 mb-1">No projects found</h3>
            <p className="text-sm text-neutral-400 mb-6">Be the first to submit a project in this category</p>
            <Button variant="primary" className="rounded-xl" onClick={() => requireAuth(() => setIsSubmitModalOpen(true))}>
              <Plus className="w-4 h-4 mr-1.5" /> Submit Project
            </Button>
          </div>
        )}
      </main>

      {/* Right Sidebar (Desktop) */}
      <aside className="hidden xl:block w-72 shrink-0 space-y-6">
        {/* Leaderboard */}
        <div className="bg-white rounded-2xl border border-neutral-200/60 overflow-hidden">
          <div className="px-5 py-4 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span className="text-[13px] font-bold text-neutral-900">Top Contributors</span>
          </div>
          <div className="px-2 pb-2">
            {topUsersByXP.map((u, idx) => (
              <button
                type="button"
                key={u.uid}
                onClick={() => handleShowProfile(u.uid)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-neutral-50 active:bg-neutral-100 transition-colors cursor-pointer w-full text-left"
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  idx === 0 ? 'bg-amber-100 text-amber-700'
                  : idx === 1 ? 'bg-neutral-100 text-neutral-600'
                  : idx === 2 ? 'bg-orange-100 text-orange-700'
                  : 'bg-neutral-50 text-neutral-400'
                }`}>
                  {idx + 1}
                </div>
                <div className="flex-grow min-w-0">
                  <div className="text-[13px] font-medium text-neutral-900 truncate">{u.displayName || 'Anonymous'}</div>
                  <div className="text-[11px] text-neutral-400">{u.xp || 0} XP · {u.rank || 'Freshman Coder'}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Notice */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200/60 p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
              {boardNotice.title}
            </div>
            {profile?.isAdmin && (
              <button
                onClick={() => {
                  setNoticeEditText(boardNotice.content);
                  setShowEditNoticeModal(true);
                }}
                className="text-[11px] text-amber-600 hover:text-amber-700 font-semibold"
              >
                Edit
              </button>
            )}
          </div>
          <p className="text-[13px] text-neutral-700 leading-relaxed">
            {boardNotice.content}
          </p>
        </div>

        {/* Trending Tech */}
        <div className="bg-white rounded-2xl border border-neutral-200/60 p-5">
          <div className="text-[13px] font-bold text-neutral-900 mb-4">Trending Technologies</div>
          <div className="flex flex-wrap gap-2">
            {trendingTechs.length > 0 ? (
              trendingTechs.map(({ tech, count }) => (
                <span key={tech} className="px-3 py-1.5 bg-neutral-50 text-neutral-600 text-[12px] font-medium rounded-lg border border-neutral-100 hover:border-neutral-300 hover:bg-white transition-all cursor-default" title={`${count} project${count !== 1 ? 's' : ''}`}>
                  {tech} <span className="text-neutral-400 text-[11px]">({count})</span>
                </span>
              ))
            ) : (
              <span className="text-[12px] text-neutral-400">No technologies yet</span>
            )}
          </div>
        </div>
      </aside>

      {/* Edit Board Notice Modal */}
      {showEditNoticeModal && profile?.isAdmin && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-float p-6 w-96 animate-fade-up">
            <h3 className="text-lg font-bold text-neutral-900 mb-4">Edit Board Notice</h3>
            <textarea
              value={noticeEditText}
              onChange={(e) => setNoticeEditText(e.target.value)}
              className="w-full p-3 border border-neutral-200 rounded-xl mb-4 text-sm font-sans resize-none"
              rows={4}
              placeholder="Enter board notice content..."
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowEditNoticeModal(false)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={async () => {
                  try {
                    await updateBoardNotice(noticeEditText, user!.uid);
                    setBoardNotice({ ...boardNotice, content: noticeEditText, updatedAt: new Date().toISOString() });
                    toast('Board notice updated!', 'success');
                    setShowEditNoticeModal(false);
                  } catch (err) {
                    console.error('Failed to update notice:', err);
                    toast('Failed to update notice.', 'error');
                  }
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Public Profile Modal */}
      {selectedProfileUserId && (
        <PublicProfileModal
          userId={selectedProfileUserId}
          onClose={() => setSelectedProfileUserId(null)}
          onProjectClick={(project) => navigate(`/project/${project.id}`)}
        />
      )}
    </div>
  );
};

export default HomePage;
