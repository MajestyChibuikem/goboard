import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Project, Category, BoardNotice, CampaignConfig, SortOption } from '../types';
import { ProjectCard } from '../components/ProjectCard';
import { ProjectGridSkeleton } from '../components/Skeleton';
import { PublicProfileModal } from '../components/PublicProfileModal';
import { CampaignBanner, CampaignHubTab } from '../components/CampaignBanner';
import { Button } from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import {
  getTopUsersByXP,
  getBoardNotice,
  updateBoardNotice,
  subscribeToTopGitHubBuilders,
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
  Bitcoin,
  ShieldCheck,
  Cloud,
  Glasses,
  DollarSign,
  BookOpen,
  ChevronUp,
  X,
  Bookmark,
  Sparkles,
  GitPullRequest,
  Github,
} from 'lucide-react';
import { useOutletContext, useNavigate, useNavigationType } from 'react-router-dom';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  [Category.WEB]: <Layers className="w-4 h-4" />,
  [Category.MOBILE]: <Zap className="w-4 h-4" />,
  [Category.AI]: <Zap className="w-4 h-4" />,
  [Category.IOT]: <Zap className="w-4 h-4" />,
  [Category.GAME]: <Zap className="w-4 h-4" />,
  [Category.DATA]: <Zap className="w-4 h-4" />,
  [Category.BLOCKCHAIN]: <Bitcoin className="w-4 h-4" />,
  [Category.CYBERSECURITY]: <ShieldCheck className="w-4 h-4" />,
  [Category.DEVOPS]: <Cloud className="w-4 h-4" />,
  [Category.AR_VR]: <Glasses className="w-4 h-4" />,
  [Category.FINTECH]: <DollarSign className="w-4 h-4" />,
  [Category.EDTECH]: <BookOpen className="w-4 h-4" />,
};

export interface HomeContext {
  projects: Project[];
  firestoreReady: boolean;
  userVotes: Set<string>;
  votingPending: Set<string>;
  handleVote: (e: React.MouseEvent, projectId: string) => void;
  requireAuth: (action: () => void) => void;
  setIsSubmitModalOpen: (open: boolean) => void;
  userFavorites: Set<string>;
  handleToggleFavorite: (e: React.MouseEvent, projectId: string) => void;
  campaignConfig: CampaignConfig;
  openCampaignHub: (tab?: CampaignHubTab) => void;
  isCampaignHubOpen?: boolean;
  setIsCampaignHubOpen?: (open: boolean) => void;
  campaignHubInitialTab?: CampaignHubTab;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  selectedCategory: string;
  setSelectedCategory: React.Dispatch<React.SetStateAction<string>>;
  sortBy: SortOption;
  setSortBy: React.Dispatch<React.SetStateAction<SortOption>>;
  showFavorites: boolean;
  setShowFavorites: React.Dispatch<React.SetStateAction<boolean>>;
  showOpenToContributions: boolean;
  setShowOpenToContributions: React.Dispatch<React.SetStateAction<boolean>>;
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
    userFavorites,
    handleToggleFavorite,
    campaignConfig,
    openCampaignHub,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    sortBy,
    setSortBy,
    showFavorites,
    setShowFavorites,
    showOpenToContributions,
    setShowOpenToContributions,
  } = useOutletContext<HomeContext>();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const navigationType = useNavigationType();

  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null);

  // Helper to record scroll position before navigating to a project
  const handleProjectClick = (p: Project) => {
    sessionStorage.setItem('goboard_browse_scroll_y', window.scrollY.toString());
    navigate(`/project/${p.slug || p.id}`);
  };

  // Keep sessionStorage scroll position synchronized while user scrolls on /browse
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          sessionStorage.setItem('goboard_browse_scroll_y', window.scrollY.toString());
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Restore scroll position when returning via back/forward navigation (POP)
  useEffect(() => {
    if (navigationType !== 'POP') return;

    const savedYStr = sessionStorage.getItem('goboard_browse_scroll_y');
    if (!savedYStr) return;
    const targetY = parseInt(savedYStr, 10);
    if (isNaN(targetY) || targetY <= 0) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 12;

    const checkAndScroll = () => {
      if (cancelled) return;

      const currentScroll = window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

      // If already at or very close to target position, done
      if (Math.abs(currentScroll - targetY) < 20) {
        return;
      }

      // If page height has expanded enough to reach target, restore
      if (maxScroll >= targetY - 40) {
        window.scrollTo({ top: targetY, behavior: 'instant' as ScrollBehavior });
      }

      attempts++;
      if (attempts < maxAttempts) {
        requestAnimationFrame(checkAndScroll);
      }
    };

    const rafId = requestAnimationFrame(checkAndScroll);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [navigationType]);

  // Sidebar state
  const [topUsersByXP, setTopUsersByXP] = useState<any[]>([]);
  const [topGitHubBuilders, setTopGitHubBuilders] = useState<any[]>([]);
  const [leaderboardTab, setLeaderboardTab] = useState<'xp' | 'builders'>('xp');
  const [boardNotice, setBoardNotice] = useState<BoardNotice>({
    id: 'boardNotice',
    title: 'Board Notice',
    content: 'Post more projects to gain more XP!!',
    updatedAt: new Date().toISOString(),
  });
  const [showEditNoticeModal, setShowEditNoticeModal] = useState(false);
  const [noticeEditText, setNoticeEditText] = useState(boardNotice.content);
  const [showMobileRightPanel, setShowMobileRightPanel] = useState(false);

  const openToContributionsCount = useMemo(
    () => projects.filter(p => p.openToContributions && !p.isSuspended).length,
    [projects]
  );

  const trendingTechs = useMemo(() => {
    const techCounts: Record<string, number> = {};
    projects.forEach(project => {
      if (project.approvalStatus === 'approved' && !project.isSuspended && Array.isArray(project.techStack)) {
        project.techStack.forEach(tech => {
          if (tech) {
            techCounts[tech] = (techCounts[tech] || 0) + 1;
          }
        });
      }
    });

    return Object.entries(techCounts)
      .map(([tech, count]) => ({ tech, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [projects]);

  useEffect(() => {
    getTopUsersByXP(5)
      .then(setTopUsersByXP)
      .catch(err => console.warn('Failed to fetch top users:', err));
  }, []);

  useEffect(() => {
    const unsub = subscribeToTopGitHubBuilders(setTopGitHubBuilders, 5);
    return () => unsub();
  }, []);

  useEffect(() => {
    getBoardNotice()
      .then(notice => notice && setBoardNotice(notice))
      .catch(err => console.warn('Failed to fetch board notice:', err));
  }, []);

  const filteredProjects = useMemo(() => {
    let filtered = projects.filter(project => {
      if (showFavorites && !userFavorites.has(project.id)) return false;
      if (showOpenToContributions && !project.openToContributions) return false;
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
  }, [projects, searchQuery, selectedCategory, sortBy, showFavorites, showOpenToContributions, userFavorites]);

  const handleShowProfile = (userId: string) => {
    setSelectedProfileUserId(userId);
  };

  return (
    <div className="flex gap-8">
      {/* Left Sidebar (Desktop) */}
      <nav className="hidden lg:block w-52 shrink-0 sticky top-24 h-fit">
        <div className="space-y-1">
          <button
            onClick={() => { setSelectedCategory('All'); setShowFavorites(false); setShowOpenToContributions(false); }}
            className={`flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] font-medium rounded-xl transition-all ${
              selectedCategory === 'All' && !showFavorites && !showOpenToContributions
                ? 'bg-neutral-900 text-white shadow-sm'
                : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
            }`}
          >
            <Home className="w-4 h-4" />
            All Projects
          </button>

          <button
            onClick={() => {
              setShowOpenToContributions(prev => !prev);
              setShowFavorites(false);
            }}
            className={`flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] font-medium rounded-xl transition-all ${
              showOpenToContributions
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-700 bg-emerald-50/70 hover:bg-emerald-100/80 border border-emerald-200/60'
            }`}
          >
            <GitPullRequest className="w-4 h-4 shrink-0" />
            <span className="truncate">Open to PRs</span>
            {openToContributionsCount > 0 && (
              <span className={`ml-auto text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${
                showOpenToContributions ? 'bg-white/20 text-white' : 'bg-emerald-200/60 text-emerald-800'
              }`}>
                {openToContributionsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => navigate('/lit-club')}
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] font-medium rounded-xl transition-all text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          >
            <BookOpen className="w-4 h-4" />
            Lit Club
          </button>

          {campaignConfig?.isActive && (
            <button
              onClick={() => openCampaignHub('upload')}
              className="flex items-center justify-between w-full px-3.5 py-2.5 text-[13px] font-semibold rounded-xl transition-all bg-gradient-to-r from-amber-50 to-orange-50 text-amber-900 border border-amber-200/70 hover:from-amber-100 hover:to-orange-100"
            >
              <span className="flex items-center gap-2 truncate">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="truncate">Paper Bounty</span>
              </span>
              <span className="text-[10px] font-extrabold text-amber-700 bg-amber-200/50 px-1.5 py-0.5 rounded-md shrink-0">
                +{campaignConfig.rewardPerPaper}
              </span>
            </button>
          )}

          {user && (
            <button
              onClick={() => { setShowFavorites(true); setShowOpenToContributions(false); setSelectedCategory('All'); }}
              className={`flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] font-medium rounded-xl transition-all ${
                showFavorites
                  ? 'bg-neutral-900 text-white shadow-sm'
                  : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              <Bookmark className="w-4 h-4" />
              Favorites
              {userFavorites.size > 0 && (
                <span className="ml-auto text-[11px] opacity-60">{userFavorites.size}</span>
              )}
            </button>
          )}

          <div className="pt-5 pb-2 px-3.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest">Categories</div>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => { setSelectedCategory(cat); setShowFavorites(false); }}
              className={`flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] rounded-xl transition-all ${
                selectedCategory === cat && !showFavorites
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
        {/* Gacha-Style Season 1 Campaign Banner */}
        {campaignConfig && (
          <CampaignBanner
            campaignConfig={campaignConfig}
            onOpenCampaignHub={openCampaignHub}
            onOpenPaydaySetup={() => requireAuth(() => navigate('/profile?tab=wallet'))}
          />
        )}

        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
              {showFavorites
                ? 'Favorites'
                : showOpenToContributions
                ? 'Open to Contributions'
                : selectedCategory === 'All'
                ? 'Discover Projects'
                : selectedCategory}
            </h1>
            <p className="text-sm text-neutral-400 mt-1">
              {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''} {showOpenToContributions ? 'welcoming student pull requests & commits' : 'from GoUni students'}
            </p>
          </div>

          {/* Sort & Filter pills */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setShowOpenToContributions(prev => !prev);
                setShowFavorites(false);
              }}
              className={`lg:hidden px-3 py-1.5 text-[12px] font-semibold rounded-xl flex items-center gap-1.5 border transition-all ${
                showOpenToContributions
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <GitPullRequest className="w-3.5 h-3.5" />
              Open to PRs
            </button>

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
          <motion.div
            layout
            className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-10"
          >
            <AnimatePresence mode="popLayout">
              {filteredProjects.map((project) => (
                <motion.div
                  layout
                  key={project.id}
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                >
                  <ProjectCard
                    project={project}
                    onClick={handleProjectClick}
                    onVote={handleVote}
                    onToggleFavorite={handleToggleFavorite}
                    voted={userVotes.has(project.id)}
                    favorited={userFavorites.has(project.id)}
                    disabled={votingPending.has(project.id) || (!!user && user.uid === (project as any).authorUid)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <div className="text-center py-24">
            <div className="w-16 h-16 mx-auto mb-4 bg-neutral-100 rounded-2xl flex items-center justify-center">
              {showFavorites ? <Bookmark className="w-7 h-7 text-neutral-300" /> : <Tag className="w-7 h-7 text-neutral-300" />}
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 mb-1">
              {showFavorites ? 'No favorites yet' : 'No projects found'}
            </h3>
            <p className="text-sm text-neutral-400 mb-6">
              {showFavorites ? 'Bookmark projects to save them here for quick access' : 'Be the first to submit a project in this category'}
            </p>
            {!showFavorites && (
              <Button variant="primary" className="rounded-xl" onClick={() => requireAuth(() => setIsSubmitModalOpen(true))}>
                <Plus className="w-4 h-4 mr-1.5" /> Submit Project
              </Button>
            )}
          </div>
        )}
      </main>

      {/* Right Sidebar (Desktop — sticky) */}
      <aside className="hidden xl:block w-72 shrink-0">
        <div className="sticky top-24 space-y-6 max-h-[calc(100vh-7rem)] overflow-y-auto scrollbar-hide">
          {/* Leaderboard */}
          <div className="bg-white rounded-2xl border border-neutral-200/60 overflow-hidden">
            <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span className="text-[13px] font-bold text-neutral-900">Leaderboard</span>
              </div>
              <div className="flex items-center bg-neutral-100 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setLeaderboardTab('xp')}
                  className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${
                    leaderboardTab === 'xp'
                      ? 'bg-white text-neutral-900 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  Top XP
                </button>
                <button
                  type="button"
                  onClick={() => setLeaderboardTab('builders')}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${
                    leaderboardTab === 'builders'
                      ? 'bg-neutral-900 text-white shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  <Github className="w-2.5 h-2.5" />
                  Builders
                </button>
              </div>
            </div>
            <div className="px-2 pb-2">
              {leaderboardTab === 'xp' ? (
                topUsersByXP.map((u, idx) => (
                  <button
                    type="button"
                    key={u.uid}
                    onClick={() => handleShowProfile(u.uid)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-neutral-50 active:bg-neutral-100 transition-colors cursor-pointer w-full text-left"
                  >
                    <div className="relative">
                      {u.photoURL ? (
                        <img src={u.photoURL || undefined} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gouni-secondary flex items-center justify-center text-[11px] font-bold text-gouni-dark">
                          {(u.displayName || 'A').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold border-2 border-white ${
                        idx === 0 ? 'bg-amber-400 text-amber-900'
                        : idx === 1 ? 'bg-neutral-300 text-neutral-700'
                        : idx === 2 ? 'bg-orange-300 text-orange-800'
                        : 'bg-neutral-100 text-neutral-600'
                      }`}>
                        {idx + 1}
                      </span>
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="text-[13px] font-medium text-neutral-900 truncate">{u.displayName || 'Anonymous'}</div>
                      <div className="text-[11px] text-neutral-400">{u.xp || 0} XP · {u.rank || 'Freshman Coder'}</div>
                    </div>
                  </button>
                ))
              ) : topGitHubBuilders.length > 0 ? (
                topGitHubBuilders.map((b, idx) => (
                  <button
                    type="button"
                    key={b.uid}
                    onClick={() => handleShowProfile(b.uid)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-neutral-50 active:bg-neutral-100 transition-colors cursor-pointer w-full text-left"
                  >
                    <div className="relative">
                      {b.photoURL || b.githubProfile?.avatarUrl ? (
                        <img
                          src={b.photoURL || b.githubProfile?.avatarUrl || undefined}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center text-[11px] font-bold text-white">
                          {(b.displayName || 'A').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold border-2 border-white ${
                        idx === 0 ? 'bg-emerald-500 text-white'
                        : idx === 1 ? 'bg-neutral-300 text-neutral-700'
                        : idx === 2 ? 'bg-orange-300 text-orange-800'
                        : 'bg-neutral-100 text-neutral-600'
                      }`}>
                        {idx + 1}
                      </span>
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-medium text-neutral-900 truncate">{b.displayName || 'Student'}</span>
                        <span className="text-[10px] text-neutral-400 truncate">@{b.githubProfile.username}</span>
                      </div>
                      <div className="text-[11px] text-emerald-600 font-medium">
                        {b.githubProfile.activeCodingDays30d || 0}d active · {b.githubProfile.recentCommits30d || 0} commits (30d)
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="px-4 py-6 text-center">
                  <Github className="w-6 h-6 text-neutral-300 mx-auto mb-1.5" />
                  <p className="text-[12px] font-medium text-neutral-600">No GitHub builders synced yet</p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Connect your GitHub in Profile to track coding activity &amp; earn XP!
                  </p>
                </div>
              )}
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
        </div>
      </aside>

      {/* Mobile right-panel toggle (visible below xl) */}
      <button
        onClick={() => setShowMobileRightPanel(true)}
        className="xl:hidden fixed bottom-6 right-6 z-40 w-12 h-12 bg-neutral-900 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-neutral-800 transition-colors"
        title="Leaderboard & Info"
      >
        <Trophy className="w-5 h-5" />
      </button>

      {/* Mobile right-panel slide-up sheet */}
      {showMobileRightPanel && (
        <div className="xl:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setShowMobileRightPanel(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 bg-[#fafafa] rounded-t-3xl max-h-[75vh] overflow-y-auto animate-slide-up p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="flex justify-center mb-2">
              <div className="w-10 h-1 bg-neutral-300 rounded-full" />
            </div>

            {/* Close */}
            <button
              onClick={() => setShowMobileRightPanel(false)}
              className="absolute top-4 right-4 p-1.5 hover:bg-neutral-200 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-neutral-500" />
            </button>

            {/* Leaderboard */}
            <div className="bg-white rounded-2xl border border-neutral-200/60 overflow-hidden">
              <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span className="text-[13px] font-bold text-neutral-900">Leaderboard</span>
                </div>
                <div className="flex items-center bg-neutral-100 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setLeaderboardTab('xp')}
                    className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${
                      leaderboardTab === 'xp'
                        ? 'bg-white text-neutral-900 shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-800'
                    }`}
                  >
                    Top XP
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaderboardTab('builders')}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${
                      leaderboardTab === 'builders'
                        ? 'bg-neutral-900 text-white shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-800'
                    }`}
                  >
                    <Github className="w-2.5 h-2.5" />
                    Builders
                  </button>
                </div>
              </div>
              <div className="px-2 pb-2">
                {leaderboardTab === 'xp' ? (
                  topUsersByXP.map((u, idx) => (
                    <button
                      type="button"
                      key={u.uid}
                      onClick={() => { handleShowProfile(u.uid); setShowMobileRightPanel(false); }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-neutral-50 active:bg-neutral-100 transition-colors cursor-pointer w-full text-left"
                    >
                      <div className="relative">
                        {u.photoURL ? (
                          <img src={u.photoURL || undefined} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gouni-secondary flex items-center justify-center text-[11px] font-bold text-gouni-dark">
                            {(u.displayName || 'A').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold border-2 border-white ${
                          idx === 0 ? 'bg-amber-400 text-amber-900'
                          : idx === 1 ? 'bg-neutral-300 text-neutral-700'
                          : idx === 2 ? 'bg-orange-300 text-orange-800'
                          : 'bg-neutral-100 text-neutral-600'
                        }`}>
                          {idx + 1}
                        </span>
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="text-[13px] font-medium text-neutral-900 truncate">{u.displayName || 'Anonymous'}</div>
                        <div className="text-[11px] text-neutral-400">{u.xp || 0} XP · {u.rank || 'Freshman Coder'}</div>
                      </div>
                    </button>
                  ))
                ) : topGitHubBuilders.length > 0 ? (
                  topGitHubBuilders.map((b, idx) => (
                    <button
                      type="button"
                      key={b.uid}
                      onClick={() => { handleShowProfile(b.uid); setShowMobileRightPanel(false); }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-neutral-50 active:bg-neutral-100 transition-colors cursor-pointer w-full text-left"
                    >
                      <div className="relative">
                        {b.photoURL || b.githubProfile?.avatarUrl ? (
                          <img
                            src={b.photoURL || b.githubProfile?.avatarUrl || undefined}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center text-[11px] font-bold text-white">
                            {(b.displayName || 'A').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold border-2 border-white ${
                          idx === 0 ? 'bg-emerald-500 text-white'
                          : idx === 1 ? 'bg-neutral-300 text-neutral-700'
                          : idx === 2 ? 'bg-orange-300 text-orange-800'
                          : 'bg-neutral-100 text-neutral-600'
                        }`}>
                          {idx + 1}
                        </span>
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-medium text-neutral-900 truncate">{b.displayName || 'Student'}</span>
                          <span className="text-[10px] text-neutral-400 truncate">@{b.githubProfile.username}</span>
                        </div>
                        <div className="text-[11px] text-emerald-600 font-medium">
                          {b.githubProfile.activeCodingDays30d || 0}d active · {b.githubProfile.recentCommits30d || 0} commits (30d)
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-6 text-center">
                    <Github className="w-6 h-6 text-neutral-300 mx-auto mb-1.5" />
                    <p className="text-[12px] font-medium text-neutral-600">No GitHub builders synced yet</p>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Connect your GitHub in Profile to track coding activity &amp; earn XP!
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Notice */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200/60 p-5">
              <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider mb-2">
                {boardNotice.title}
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
                    <span key={tech} className="px-3 py-1.5 bg-neutral-50 text-neutral-600 text-[12px] font-medium rounded-lg border border-neutral-100">
                      {tech} <span className="text-neutral-400 text-[11px]">({count})</span>
                    </span>
                  ))
                ) : (
                  <span className="text-[12px] text-neutral-400">No technologies yet</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
          onProjectClick={handleProjectClick}
        />
      )}
    </div>
  );
};

export default HomePage;
