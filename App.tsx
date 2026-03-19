import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Project, Category } from './types';
import { INITIAL_PROJECTS, CATEGORIES } from './constants';
import { SubmitProjectModal } from './components/SubmitProjectModal';
import { AuthModal } from './components/AuthModal';
import { NotificationBell } from './components/NotificationBell';
import { PublicProfileModal } from './components/PublicProfileModal';
import { Button } from './components/Button';
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
} from './services/firestoreService';
import { Search, Plus, GraduationCap, Menu, X, Tag, Home, Zap, Layers, LogOut, User, Shield, Bitcoin, ShieldCheck, Cloud, Glasses, DollarSign, BookOpen } from 'lucide-react';

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [userVotes, setUserVotes] = useState<Set<string>>(new Set());
  const [votingPending, setVotingPending] = useState<Set<string>>(new Set());
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null);
  const [userFavorites, setUserFavorites] = useState<Set<string>>(new Set());

  // Determine current page from URL for sidebar highlighting
  const currentPage = location.pathname === '/profile' ? 'profile' : location.pathname === '/admin' ? 'admin' : 'home';

  // Subscribe to Firestore projects
  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      unsub = subscribeToProjects((firestoreProjects) => {
        const isAdmin = profile?.isAdmin || false;
        const filtered = firestoreProjects.filter(project => {
          if (isAdmin) return true;
          if (user?.uid && project.authorUid === user.uid) return true;
          return project.approvalStatus === 'approved';
        });

        if (filtered.length > 0) {
          setProjects(filtered);
        } else if (!firestoreReady) {
          seedProjects(INITIAL_PROJECTS).then(() => setFirestoreReady(true)).catch(console.error);
          return;
        }
        setFirestoreReady(true);
      }, 'all', profile?.isAdmin || false, user?.uid);
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

  // Hide custom loading screen when Firebase is ready
  useEffect(() => {
    if (firestoreReady) {
      const loadingScreen = document.getElementById('loading-screen');
      if (loadingScreen) {
        loadingScreen.classList.add('hidden');
      }
    }
  }, [firestoreReady]);

  const requireAuth = useCallback((action: () => void) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    action();
  }, [user]);

  const handleAddProject = async (newProjectData: Omit<Project, 'id' | 'likes' | 'datePosted' | 'comments' | 'screenshots'>) => {
    if (!user) return;
    try {
      await createProject(newProjectData, user.uid);
      toast('Project submitted for review!', 'success');
    } catch (err) {
      console.error('Failed to create project:', err);
      toast('Failed to submit project. Try again.', 'error');
      const newProject: Project = {
        ...newProjectData,
        id: Date.now().toString(),
        likes: 0,
        datePosted: new Date().toISOString(),
        comments: [],
        screenshots: [],
        status: newProjectData.status || 'idea',
        updates: [],
      };
      setProjects(prev => [newProject, ...prev]);
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
  };

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans text-neutral-900">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-neutral-200/60">
        <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between">

          <div className="flex items-center gap-8">
            <button className="lg:hidden p-1.5 -ml-1.5 text-neutral-500 hover:text-neutral-900" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              <Menu className="w-5 h-5" />
            </button>

            <div
              className="flex items-center gap-2.5 cursor-pointer"
              onClick={() => navigate('/browse')}
            >
              <div className="w-8 h-8 bg-gouni-dark rounded-lg flex items-center justify-center">
                <GraduationCap className="w-4.5 h-4.5 text-white" />
              </div>
              <span className="hidden sm:block text-[15px] font-bold tracking-tight text-neutral-900">
                GoBoard
              </span>
            </div>

            {/* Desktop Search */}
            <div className="hidden md:block relative w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search projects, students, tech..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-gouni-primary/20 focus:border-gouni-primary/40 text-sm transition-all bg-neutral-50/50 focus:bg-white placeholder:text-neutral-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
             <Button
               variant="primary"
               className="text-sm h-9 rounded-xl px-5"
               onClick={() => requireAuth(() => setIsSubmitModalOpen(true))}
             >
               <Plus className="w-4 h-4 mr-1.5" />
               Submit
             </Button>

             {user && (
               <NotificationBell
                 onProjectClick={(projectId) => {
                   navigate(`/project/${projectId}`);
                 }}
               />
             )}

             {/* Auth area */}
             {authLoading ? (
               <div className="w-8 h-8 rounded-full bg-neutral-100 animate-pulse" />
             ) : user ? (
               <div className="relative">
                 <button
                   onClick={() => setShowUserMenu(!showUserMenu)}
                   className="flex items-center gap-2 p-1 rounded-xl hover:bg-neutral-100 transition-colors"
                 >
                   {user.photoURL ? (
                     <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full object-cover" />
                   ) : (
                     <div className="w-8 h-8 rounded-full bg-gouni-secondary flex items-center justify-center text-[12px] font-bold text-gouni-dark">
                       {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                     </div>
                   )}
                 </button>

                 {showUserMenu && (
                   <>
                     <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                     <div className="absolute right-0 top-12 z-50 w-56 bg-white rounded-xl border border-neutral-200 shadow-float overflow-hidden animate-fade-up">
                       <div className="p-4 border-b border-neutral-100">
                         <div className="text-[13px] font-semibold text-neutral-900 truncate">{user.displayName || 'Student'}</div>
                         <div className="text-[11px] text-neutral-400 truncate">{user.email}</div>
                         {profile && (
                           <div className="mt-2 flex items-center gap-2">
                             <span className="text-[11px] font-medium text-gouni-primary bg-blue-50 px-2 py-0.5 rounded-md">{profile.xp} XP</span>
                             <span className="text-[11px] text-neutral-400">{profile.rank}</span>
                           </div>
                         )}
                       </div>
                       <div className="p-1">
                         <button
                           onClick={() => { setShowUserMenu(false); navigate('/profile'); }}
                           className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-neutral-600 hover:bg-neutral-50 rounded-lg transition-colors"
                         >
                           <User className="w-4 h-4" /> My Profile
                         </button>
                         {profile?.isAdmin && (
                           <button
                             onClick={() => { setShowUserMenu(false); navigate('/admin'); }}
                             className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                           >
                             <Shield className="w-4 h-4" /> Admin Queue
                           </button>
                         )}
                         <button
                           onClick={() => { setShowUserMenu(false); signOut(); }}
                           className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                         >
                           <LogOut className="w-4 h-4" /> Sign Out
                         </button>
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
      {isMobileMenuOpen && (
         <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileMenuOpen(false)}>
           <div className="absolute left-0 top-0 h-full w-72 bg-white p-6 overflow-y-auto shadow-float" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-8">
                <span className="font-bold text-lg">Menu</span>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-1 hover:bg-neutral-100 rounded-lg">
                  <X className="w-5 h-5"/>
                </button>
              </div>
              <div className="mb-6 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 text-sm"
                />
              </div>
              <nav className="space-y-1">
                <button
                  onClick={() => { navigate('/browse'); setIsMobileMenuOpen(false); }}
                  className={`flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 font-medium rounded-xl text-sm ${
                    currentPage === 'home' ? 'text-neutral-900 bg-neutral-100' : 'text-neutral-500 hover:bg-neutral-50'
                  }`}
                >
                  <Home className="w-4 h-4" /> All Projects
                </button>
                <div className="pt-4 pb-2 px-3.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest">Categories</div>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => { navigate('/browse'); setIsMobileMenuOpen(false); }}
                    className="flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 text-sm text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 rounded-xl"
                  >
                    {CATEGORY_ICONS[cat] || <Tag className="w-4 h-4" />}
                    {cat}
                  </button>
                ))}
                {user && (
                  <>
                    <div className="pt-4 pb-2 px-3.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest">Account</div>
                    <button
                      onClick={() => { navigate('/profile'); setIsMobileMenuOpen(false); }}
                      className={`flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 text-sm rounded-xl ${
                        currentPage === 'profile' ? 'text-neutral-900 bg-neutral-100 font-medium' : 'text-neutral-500 hover:bg-neutral-50'
                      }`}
                    >
                      <User className="w-4 h-4" /> My Profile
                    </button>
                    {profile?.isAdmin && (
                      <button
                        onClick={() => { navigate('/admin'); setIsMobileMenuOpen(false); }}
                        className={`flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 text-sm rounded-xl ${
                          currentPage === 'admin' ? 'text-amber-800 bg-amber-50 font-medium' : 'text-amber-700 hover:bg-amber-50'
                        }`}
                      >
                        <Shield className="w-4 h-4" /> Admin Queue
                      </button>
                    )}
                  </>
                )}
              </nav>
           </div>
         </div>
      )}

      {/* ── Page Content ── */}
      <div className="max-w-[1440px] mx-auto px-6 py-8">
        <Outlet context={outletContext} />
      </div>

      {/* Modals */}
      {isSubmitModalOpen && (
        <SubmitProjectModal
          onClose={() => setIsSubmitModalOpen(false)}
          onSubmit={handleAddProject}
        />
      )}

      {isAuthModalOpen && (
        <AuthModal onClose={() => setIsAuthModalOpen(false)} />
      )}

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

export default App;
