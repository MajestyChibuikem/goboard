import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, Outlet, ScrollRestoration } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Project, Category, CampaignConfig, SortOption } from './types';
import { INITIAL_PROJECTS, CATEGORIES } from './constants';
import { SubmitProjectModal } from './components/SubmitProjectModal';
import { AuthModal } from './components/AuthModal';
import { NotificationBell } from './components/NotificationBell';
import { PublicProfileModal } from './components/PublicProfileModal';
import { CampaignHubTab } from './components/CampaignBanner';
import { CampaignHubModal } from './components/CampaignHubModal';
import { Button } from './components/Button';
import { ThemeToggle } from './components/ThemeToggle';
import { useAuth } from './contexts/AuthContext';
import { useToast } from './components/Toast';
import {
  subscribeToProjects,
  createProject,
  toggleVote,
  getUserVotes,
  seedProjects,
  subscribeToUserVotes,
  toggleFavorite,
  subscribeToUserFavorites,
  subscribeToCampaignConfig,
  DEFAULT_CAMPAIGN_CONFIG,
} from './services/firestoreService';
import { Search, Plus, GraduationCap, Menu, X, Tag, Home, Zap, Layers, LogOut, User, Shield, Bitcoin, ShieldCheck, Cloud, Glasses, DollarSign, BookOpen, Coins, Sparkles } from 'lucide-react';

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

const App: React.FC = () => {
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [firestoreReady, setFirestoreReady] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showFavorites, setShowFavorites] = useState(false);
  const [showOpenToContributions, setShowOpenToContributions] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [userVotes, setUserVotes] = useState<Set<string>>(new Set());
  const [votingPending, setVotingPending] = useState<Set<string>>(new Set());
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null);
  const [userFavorites, setUserFavorites] = useState<Set<string>>(new Set());
  const [campaignConfig, setCampaignConfig] = useState<CampaignConfig>(DEFAULT_CAMPAIGN_CONFIG);
  const [isCampaignHubOpen, setIsCampaignHubOpen] = useState(false);
  const [campaignHubInitialTab, setCampaignHubInitialTab] = useState<CampaignHubTab>('upload');

  // Determine current page from URL for sidebar highlighting
  const currentPage = location.pathname === '/profile' ? 'profile' : location.pathname === '/admin' ? 'admin' : location.pathname.startsWith('/lit-club') || location.pathname.startsWith('/writing/') ? 'lit-club' : 'home';

  // Close open menus on navigation (ScrollRestoration handles scroll position preservation)
  useEffect(() => {
    setShowUserMenu(false);
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Onboarding guard: redirect signed-in users who haven't completed onboarding to /welcome
  useEffect(() => {
    if (!authLoading && user && profile && !profile.onboardingCompletedAt) {
      if (location.pathname !== '/welcome') {
        navigate('/welcome', { replace: true });
      }
    }
  }, [user, profile, authLoading, location.pathname, navigate]);

  // Subscribe to Firestore projects
  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      const isAdmin = profile?.isAdmin || false;
      unsub = subscribeToProjects((firestoreProjects) => {
        const filtered = firestoreProjects.filter(project => {
          if (isAdmin) return true;
          if (user?.uid && project.authorUid === user.uid) return true;
          return project.approvalStatus === 'approved';
        });

        if (filtered.length > 0) {
          setProjects(filtered);
        } else if (!firestoreReady && isAdmin) {
          seedProjects(INITIAL_PROJECTS).then(() => setFirestoreReady(true)).catch(console.error);
          return;
        }
        setFirestoreReady(true);
      }, isAdmin ? 'all' : 'approved', isAdmin, user?.uid);
    } catch (err) {
      console.warn('Firestore not available, using local data:', err);
    }
    return () => unsub?.();
  }, [profile?.isAdmin, user]);

  // Load user's votes when they sign in
  useEffect(() => {
    if (!user) {
      setUserVotes(new Set());
      return;
    }
    let unsub: (() => void) | undefined;
    try {
      unsub = subscribeToUserVotes(user.uid, setUserVotes);
    } catch (err) {
      console.warn('Failed to subscribe to user votes; falling back to one-time fetch', err);
      getUserVotes(user.uid).then(setUserVotes).catch(console.error);
    }
    return () => unsub?.();
  }, [user]);

  // Subscribe to user favorites
  useEffect(() => {
    if (!user) {
      setUserFavorites(new Set());
      return;
    }
    let unsub: (() => void) | undefined;
    try {
      unsub = subscribeToUserFavorites(user.uid, setUserFavorites);
    } catch (err) {
      console.warn('Failed to subscribe to favorites:', err);
    }
    return () => unsub?.();
  }, [user]);

  // Subscribe to live Season 1 Campaign Config
  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      unsub = subscribeToCampaignConfig(setCampaignConfig);
    } catch (err) {
      console.warn('Failed to subscribe to campaign config:', err);
    }
    return () => unsub?.();
  }, []);

  const handleToggleFavorite = useCallback(async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    // Optimistic update
    const wasFav = userFavorites.has(projectId);
    const newFavs = new Set(userFavorites);
    if (wasFav) newFavs.delete(projectId); else newFavs.add(projectId);
    setUserFavorites(newFavs);

    try {
      const added = await toggleFavorite(user.uid, projectId);
      toast(added ? 'Added to favorites!' : 'Removed from favorites.', 'success');
    } catch (err) {
      console.error('Toggle favorite failed:', err);
      setUserFavorites(userFavorites); // revert
      toast('Failed to update favorites.', 'error');
    }
  }, [user, userFavorites]);

  // Hide custom loading screen when Firebase is ready (or max safety timeout fallback)
  useEffect(() => {
    const hideLoading = () => {
      const loadingScreen = document.getElementById('loading-screen');
      if (loadingScreen && !loadingScreen.classList.contains('hidden')) {
        loadingScreen.classList.add('hidden');
        setTimeout(() => {
          try { loadingScreen.remove(); } catch (e) {}
        }, 400);
      }
    };

    if (firestoreReady) {
      hideLoading();
    } else {
      const timer = setTimeout(hideLoading, 1200);
      return () => clearTimeout(timer);
    }
  }, [firestoreReady]);

  const requireAuth = useCallback((action: () => void) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    action();
  }, [user]);

  const openCampaignHub = useCallback((tab: CampaignHubTab = 'upload') => {
    if ((tab === 'upload' || tab === 'submissions') && !user) {
      setIsAuthModalOpen(true);
      return;
    }
    setCampaignHubInitialTab(tab);
    setIsCampaignHubOpen(true);
  }, [user]);

  const handleAddProject = async (newProjectData: Omit<Project, 'id' | 'likes' | 'datePosted' | 'comments' | 'screenshots'>) => {
    if (!user) return;
    try {
      await createProject(newProjectData, user.uid);
      toast('Project submitted for review!', 'success');
    } catch (err: any) {
      console.error('Failed to create project:', err);
      toast(err?.message || 'Failed to submit project. Try again.', 'error');
      throw err;
    }
  };

  const handleVote = useCallback((e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    requireAuth(async () => {
      if (!user) return;

      const project = projects.find(p => p.id === projectId);
      const authorUid = project?.authorUid;
      if (authorUid && authorUid === user.uid) {
        toast("You can't upvote your own project.", 'info');
        return;
      }

      if (votingPending.has(projectId)) return;
      setVotingPending(prev => new Set(prev).add(projectId));

      const wasVoted = userVotes.has(projectId);
      const newVotes = new Set(userVotes);
      if (wasVoted) {
        newVotes.delete(projectId);
      } else {
        newVotes.add(projectId);
      }
      setUserVotes(newVotes);

      setProjects(prev => prev.map(p =>
        p.id === projectId
          ? { ...p, likes: p.likes + (wasVoted ? -1 : 1) }
          : p
      ));

      try {
        const added = await toggleVote(projectId, user.uid, authorUid);
        toast(added ? 'Upvoted!' : 'Removed vote.', 'success');
       } catch (err) {
         console.error('Vote failed:', err);
         toast('Vote failed. Try again.', 'error');
         setUserVotes(userVotes);
         setProjects(prev => prev.map(p =>
           p.id === projectId
             ? { ...p, likes: p.likes + (wasVoted ? 1 : -1) }
             : p
         ));
       } finally {
         setVotingPending(prev => {
           const next = new Set(prev);
           next.delete(projectId);
           return next;
         });
       }
    });
  }, [user, userVotes, projects, requireAuth, votingPending]);

  // Context passed to child routes via <Outlet>
  const outletContext = {
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
    isCampaignHubOpen,
    setIsCampaignHubOpen,
    campaignHubInitialTab,
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
  };

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-neutral-950 font-sans text-neutral-900 dark:text-neutral-100 transition-colors duration-200">
      <ScrollRestoration />

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-xl border-b border-neutral-200/60 dark:border-neutral-800/80">
        <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between">

          <div className="flex items-center gap-8">
            <button className="lg:hidden p-1.5 -ml-1.5 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              <Menu className="w-5 h-5" />
            </button>

            <div
              className="flex items-center gap-2.5 cursor-pointer"
              onClick={() => {
                setSelectedCategory('All');
                setSearchQuery('');
                setShowFavorites(false);
                setShowOpenToContributions(false);
                setSortBy('newest');
                navigate('/browse');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <div className="w-8 h-8 bg-gouni-dark dark:bg-neutral-850 border border-transparent dark:border-neutral-700/60 rounded-lg flex items-center justify-center">
                <GraduationCap className="w-4.5 h-4.5 text-white" />
              </div>
              <span className="hidden sm:block text-[15px] font-bold tracking-tight text-neutral-900 dark:text-white">
                GoBoard
              </span>
            </div>

            {/* Desktop Search */}
            <div className="hidden md:block relative w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 dark:text-neutral-500 w-4 h-4" />
              <input
                type="text"
                placeholder="Search projects, students, tech..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 focus:outline-none focus:ring-2 focus:ring-gouni-primary/20 focus:border-gouni-primary/40 text-sm transition-all bg-neutral-50/50 dark:bg-neutral-900/60 focus:bg-white dark:focus:bg-neutral-850 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-neutral-900 dark:text-neutral-100"
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
             {/* Theme Toggle Button */}
             <ThemeToggle />

             {/* Live GoCoins HUD Pill */}
             {user && (
               <button
                 type="button"
                 onClick={() => openCampaignHub('upload')}
                 title="Open Exam Paper Bounty Hub"
                 className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 hover:from-amber-100 dark:hover:from-amber-900/50 hover:to-orange-100 border border-amber-200/80 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 transition-all shadow-2xs cursor-pointer"
               >
                 <Coins className="w-4 h-4 text-amber-500 shrink-0" />
                 <span className="text-xs font-extrabold tabular-nums">
                   {(profile?.goCoins ?? 0).toLocaleString()}
                 </span>
                 <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">
                   GC
                 </span>
               </button>
             )}

             <Button
               variant="primary"
               className="text-sm h-9 rounded-xl px-4 sm:px-5"
               onClick={() => requireAuth(() => setIsSubmitModalOpen(true))}
             >
               <Plus className="w-4 h-4 sm:mr-1.5" />
               <span className="hidden sm:inline">Submit</span>
             </Button>

             {user && (
               <NotificationBell
                 onProjectClick={(projectId) => {
                   navigate(`/project/${projectId}`);
                 }}
                 onWritingClick={(writingId) => {
                   navigate(`/writing/${writingId}`);
                 }}
                 onProfileClick={() => {
                   navigate('/profile?tab=wallet');
                 }}
                 onCampaignClick={() => {
                   openCampaignHub('submissions');
                 }}
               />
             )}

             {/* Auth area */}
             {authLoading ? (
               <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
             ) : user ? (
               <div className="relative">
                 <button
                   onClick={() => setShowUserMenu(!showUserMenu)}
                   className="flex items-center gap-2 p-1 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                 >
                   {(profile?.photoURL || user.photoURL) ? (
                     <img src={(profile?.photoURL || user.photoURL) || undefined} alt="" className="w-8 h-8 rounded-full object-cover" />
                   ) : (
                     <div className="w-8 h-8 rounded-full bg-gouni-secondary flex items-center justify-center text-[12px] font-bold text-gouni-dark">
                       {(profile?.displayName || user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                     </div>
                   )}
                 </button>

                 {showUserMenu && (
                   <>
                     <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                     <div className="absolute right-0 top-12 z-50 w-64 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-float overflow-hidden animate-fade-up text-neutral-900 dark:text-neutral-100">
                       <div className="p-4 border-b border-neutral-100 dark:border-neutral-800">
                         <div className="text-[13px] font-semibold text-neutral-900 dark:text-white truncate">{profile?.displayName || user.displayName || 'Student'}</div>
                         <div className="text-[11px] text-neutral-400 dark:text-neutral-500 truncate">{user.email}</div>
                         {profile && (
                           <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                             <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60 px-2 py-0.5 rounded-md">
                               <Coins className="w-3 h-3 text-amber-500" />
                               {(profile.goCoins || 0).toLocaleString()} GC
                             </span>
                             <span className="text-[11px] font-medium text-gouni-primary dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-md">{profile.xp} XP</span>
                             <span className="text-[11px] text-neutral-400 truncate">{profile.rank}</span>
                           </div>
                         )}
                       </div>
                       <div className="p-1.5 space-y-0.5">
                         <button
                           onClick={() => { setShowUserMenu(false); openCampaignHub('quests'); }}
                           className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-amber-700 dark:text-amber-400 font-medium hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-xl transition-colors cursor-pointer"
                         >
                           <Sparkles className="w-4 h-4 text-amber-500" /> Builder Quests & Bounty
                         </button>
                         <button
                           onClick={() => { setShowUserMenu(false); navigate('/profile'); }}
                           className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
                         >
                           <User className="w-4 h-4" /> My Profile & Wallet
                         </button>
                         {profile?.isAdmin && (
                           <button
                             onClick={() => { setShowUserMenu(false); navigate('/admin'); }}
                             className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-xl transition-colors cursor-pointer"
                           >
                             <Shield className="w-4 h-4" /> Admin Queue
                           </button>
                         )}
                         <button
                           onClick={() => { setShowUserMenu(false); signOut(); }}
                           className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer"
                         >
                           <LogOut className="w-4 h-4" /> Sign Out
                         </button>
                       </div>
                       <div className="p-3 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-850/50">
                         <div className="text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-2">
                           Theme Mode
                         </div>
                         <ThemeToggle variant="segmented" />
                       </div>
                     </div>
                   </>
                 )}
               </div>
             ) : (
               <Button
                 variant="outline"
                 className="text-sm h-9 rounded-xl px-4"
                 onClick={() => setIsAuthModalOpen(true)}
               >
                 Sign In
               </Button>
             )}
          </div>
        </div>
      </header>

      {/* ── Mobile Menu Overlay ── */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="absolute left-0 top-0 h-full w-72 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 p-6 overflow-y-auto shadow-float border-r border-neutral-200 dark:border-neutral-800"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <span className="font-bold text-lg text-neutral-900 dark:text-white">Menu</span>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg cursor-pointer text-neutral-500 dark:text-neutral-400">
                  <X className="w-5 h-5"/>
                </button>
              </div>
              <div className="mb-6 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 dark:text-neutral-500 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/60 focus:bg-white dark:focus:bg-neutral-800 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
                />
              </div>
              <nav className="space-y-1">
                <button
                  onClick={() => {
                    setSelectedCategory('All');
                    setShowFavorites(false);
                    setShowOpenToContributions(false);
                    navigate('/browse');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 font-medium rounded-xl text-sm transition-colors ${
                    currentPage === 'home' && selectedCategory === 'All' && !showFavorites && !showOpenToContributions
                      ? 'text-neutral-900 dark:text-white bg-neutral-100 dark:bg-neutral-800 font-semibold'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  <Home className="w-4 h-4" /> All Projects
                </button>
                <button
                  onClick={() => { navigate('/lit-club'); setIsMobileMenuOpen(false); }}
                  className={`flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 font-medium rounded-xl text-sm transition-colors ${
                    currentPage === 'lit-club'
                      ? 'text-neutral-900 dark:text-white bg-neutral-100 dark:bg-neutral-800 font-semibold'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  <BookOpen className="w-4 h-4" /> Lit Club
                </button>
                {campaignConfig.isActive && (
                  <button
                    onClick={() => { setIsMobileMenuOpen(false); openCampaignHub('quests'); }}
                    className="flex items-center justify-between w-full text-left px-3.5 py-2.5 font-semibold rounded-xl text-sm bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 text-amber-900 dark:text-amber-200 border border-amber-200/70 dark:border-amber-800/70"
                  >
                    <span className="flex items-center gap-2.5">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      Builder Quests & Bounty
                    </span>
                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">+350 XP</span>
                  </button>
                )}
                <div className="pt-4 pb-2 px-3.5 text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Categories</div>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setShowFavorites(false);
                      setShowOpenToContributions(false);
                      navigate('/browse');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 text-sm rounded-xl transition-colors ${
                      selectedCategory === cat && !showFavorites && !showOpenToContributions
                        ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 font-semibold'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-800/60'
                    }`}
                  >
                    {CATEGORY_ICONS[cat] || <Tag className="w-4 h-4" />}
                    {cat}
                  </button>
                ))}
                {user && (
                  <>
                    <div className="pt-4 pb-2 px-3.5 text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Account</div>
                    <button
                      onClick={() => { navigate('/profile'); setIsMobileMenuOpen(false); }}
                      className={`flex items-center justify-between w-full text-left px-3.5 py-2.5 text-sm rounded-xl transition-colors ${
                        currentPage === 'profile'
                          ? 'text-neutral-900 dark:text-white bg-neutral-100 dark:bg-neutral-800 font-semibold'
                          : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/60'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <User className="w-4 h-4" /> My Profile
                      </span>
                      {profile && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60 px-2 py-0.5 rounded-md">
                          <Coins className="w-3 h-3 text-amber-500" />
                          {(profile.goCoins || 0).toLocaleString()} GC
                        </span>
                      )}
                    </button>
                    {profile?.isAdmin && (
                      <button
                        onClick={() => { navigate('/admin'); setIsMobileMenuOpen(false); }}
                        className={`flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 text-sm rounded-xl transition-colors ${
                          currentPage === 'admin'
                            ? 'text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 font-semibold'
                            : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                        }`}
                      >
                        <Shield className="w-4 h-4" /> Admin Queue
                      </button>
                    )}
                  </>
                )}

                <div className="pt-4 pb-2 px-3.5 text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Theme</div>
                <div className="px-2 pt-1">
                  <ThemeToggle variant="segmented" />
                </div>
              </nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Page Content ── */}
      <div className="max-w-[1440px] mx-auto px-6 py-8">
        <Outlet context={outletContext} />
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isSubmitModalOpen && (
          <SubmitProjectModal
            onClose={() => setIsSubmitModalOpen(false)}
            onSubmit={handleAddProject}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAuthModalOpen && (
          <AuthModal onClose={() => setIsAuthModalOpen(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedProfileUserId && (
          <PublicProfileModal
            userId={selectedProfileUserId}
            onClose={() => setSelectedProfileUserId(null)}
            onProjectClick={(project) => navigate(`/project/${project.slug || project.id}`)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCampaignHubOpen && (
          <CampaignHubModal
            initialTab={campaignHubInitialTab}
            campaignConfig={campaignConfig}
            onClose={() => setIsCampaignHubOpen(false)}
            onOpenPaydaySetup={() => {
              setIsCampaignHubOpen(false);
              requireAuth(() => navigate('/profile?tab=wallet'));
            }}
            onRequireAuth={() => {
              setIsCampaignHubOpen(false);
              setIsAuthModalOpen(true);
            }}
            onOpenSubmitModal={() => {
              setIsCampaignHubOpen(false);
              requireAuth(() => setIsSubmitModalOpen(true));
            }}
            projects={projects}
            userVotes={userVotes}
            onVoteProject={handleVote}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
