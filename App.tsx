import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Project, Category } from './types';
import { INITIAL_PROJECTS, CATEGORIES } from './constants';
import { ProjectCard } from './components/ProjectCard';
import { ProjectDetailView } from './components/ProjectDetailView';
import { SubmitProjectModal } from './components/SubmitProjectModal';
import { AuthModal } from './components/AuthModal';
import { UserProfile } from './components/UserProfile';
import { AdminQueue } from './components/AdminQueue';
import { Button } from './components/Button';
import { useAuth } from './contexts/AuthContext';
import { useToast } from './components/Toast';
import {
  subscribeToProjects,
  createProject,
  toggleVote,
  getUserVotes,
  seedProjects,
  awardXP,
  XP_VALUES,
} from './services/firestoreService';
import { Search, Plus, GraduationCap, Menu, X, Tag, Home, TrendingUp, Clock, MessageCircle, Trophy, Zap, Layers, LogOut, User, Shield } from 'lucide-react';

type PageView = 'home' | 'profile' | 'admin';
type SortOption = 'newest' | 'votes' | 'comments';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  [Category.WEB]: <Layers className="w-4 h-4" />,
  [Category.MOBILE]: <Zap className="w-4 h-4" />,
  [Category.AI]: <Zap className="w-4 h-4" />,
  [Category.IOT]: <Zap className="w-4 h-4" />,
  [Category.GAME]: <Zap className="w-4 h-4" />,
  [Category.DATA]: <Zap className="w-4 h-4" />,
};

const App: React.FC = () => {
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [firestoreReady, setFirestoreReady] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [currentPage, setCurrentPage] = useState<PageView>('home');
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [userVotes, setUserVotes] = useState<Set<string>>(new Set());

  const navigateTo = useCallback((page: PageView) => {
    setCurrentPage(page);
    setSelectedProject(null);
  }, []);

  const navigateToProject = useCallback((project: Project) => {
    setSelectedProject(project);
    setCurrentPage('home');
  }, []);

  // Subscribe to Firestore projects (falls back to seed data if Firebase not configured)
  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      unsub = subscribeToProjects((firestoreProjects) => {
        if (firestoreProjects.length > 0) {
          setProjects(firestoreProjects);
          setFirestoreReady(true);
        } else if (!firestoreReady) {
          // Firestore empty — seed it with initial data
          seedProjects(INITIAL_PROJECTS).catch(console.error);
        }
      });
    } catch (err) {
      console.warn('Firestore not available, using local data:', err);
    }
    return () => unsub?.();
  }, []);

  // Load user's votes when they sign in
  useEffect(() => {
    if (user) {
      getUserVotes(user.uid).then(setUserVotes).catch(console.error);
    } else {
      setUserVotes(new Set());
    }
  }, [user]);

  // Keep selectedProject in sync with project list updates
  useEffect(() => {
    if (selectedProject) {
      const updated = projects.find(p => p.id === selectedProject.id);
      if (updated && updated !== selectedProject) {
        setSelectedProject(updated);
      }
    }
  }, [projects]);

  // Helper: require auth before an action
  const requireAuth = useCallback((action: () => void) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    action();
  }, [user]);

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

  const topStudents = useMemo(() => {
    const stats: Record<string, { likes: number, projects: number }> = {};
    projects.forEach(p => {
        if (!stats[p.studentName]) stats[p.studentName] = { likes: 0, projects: 0 };
        stats[p.studentName].likes += p.likes;
        stats[p.studentName].projects += 1;
    });

    return Object.entries(stats)
        .sort(([, a], [, b]) => b.likes - a.likes)
        .slice(0, 5)
        .map(([name, data]) => ({ name, ...data }));
  }, [projects]);

  const handleAddProject = async (newProjectData: Omit<Project, 'id' | 'likes' | 'datePosted' | 'comments' | 'screenshots'>) => {
    if (!user) return;
    try {
      await createProject(newProjectData, user.uid);
      await awardXP(user.uid, XP_VALUES.SUBMIT_PROJECT);
      toast('Project submitted for review!', 'success');
    } catch (err) {
      console.error('Failed to create project:', err);
      toast('Failed to submit project. Try again.', 'error');
      // Fallback: add locally
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

  const handleUpdateProject = useCallback((updatedProject: Project) => {
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
    if (selectedProject && selectedProject.id === updatedProject.id) {
      setSelectedProject(updatedProject);
    }
  }, [selectedProject]);

  const handleVote = useCallback((e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    requireAuth(async () => {
      if (!user) return;

      // Optimistic UI
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
        await toggleVote(projectId, user.uid);
      } catch (err) {
        console.error('Vote failed:', err);
        toast('Vote failed. Try again.', 'error');
        // Rollback
        setUserVotes(userVotes);
        setProjects(prev => prev.map(p =>
          p.id === projectId
            ? { ...p, likes: p.likes + (wasVoted ? 1 : -1) }
            : p
        ));
      }
    });
  }, [user, userVotes, requireAuth]);

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
              onClick={() => navigateTo('home')}
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

                 {/* User dropdown */}
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
                           onClick={() => { setShowUserMenu(false); navigateTo('profile'); }}
                           className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-neutral-600 hover:bg-neutral-50 rounded-lg transition-colors"
                         >
                           <User className="w-4 h-4" /> My Profile
                         </button>
                         {profile?.isAdmin && (
                           <button
                             onClick={() => { setShowUserMenu(false); navigateTo('admin'); }}
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

      {/* ── Main Layout ── */}
      <div className="max-w-[1440px] mx-auto px-6 py-8 flex gap-8">

        {/* ── Left Sidebar (Desktop) ── */}
        <nav className="hidden lg:block w-52 shrink-0 sticky top-24 h-fit">
          <div className="space-y-1">
            <button
              onClick={() => { navigateTo('home'); setSelectedCategory('All'); }}
              className={`flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] font-medium rounded-xl transition-all ${
                currentPage === 'home' && !selectedProject && selectedCategory === 'All'
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
                onClick={() => { navigateTo('home'); setSelectedCategory(cat); }}
                className={`flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] rounded-xl transition-all ${
                  currentPage === 'home' && selectedCategory === cat
                    ? 'bg-neutral-900 text-white shadow-sm'
                    : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
                }`}
              >
                {CATEGORY_ICONS[cat] || <Tag className="w-4 h-4" />}
                <span className="truncate">{cat}</span>
              </button>
            ))}

            {/* User pages */}
            {user && (
              <>
                <div className="pt-5 pb-2 px-3.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest">Account</div>
                <button
                  onClick={() => navigateTo('profile')}
                  className={`flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] rounded-xl transition-all ${
                    currentPage === 'profile'
                      ? 'bg-neutral-900 text-white shadow-sm'
                      : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
                  }`}
                >
                  <User className="w-4 h-4" />
                  My Profile
                </button>
                {profile?.isAdmin && (
                  <button
                    onClick={() => navigateTo('admin')}
                    className={`flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] rounded-xl transition-all ${
                      currentPage === 'admin'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'text-amber-700 hover:bg-amber-50 hover:text-amber-800'
                    }`}
                  >
                    <Shield className="w-4 h-4" />
                    Admin Queue
                  </button>
                )}
              </>
            )}
          </div>
        </nav>

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
                    onClick={() => { navigateTo('home'); setSelectedCategory('All'); setIsMobileMenuOpen(false); }}
                    className={`flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 font-medium rounded-xl text-sm ${
                      currentPage === 'home' && selectedCategory === 'All' ? 'text-neutral-900 bg-neutral-100' : 'text-neutral-500 hover:bg-neutral-50'
                    }`}
                  >
                    <Home className="w-4 h-4" /> All Projects
                  </button>
                  <div className="pt-4 pb-2 px-3.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest">Categories</div>
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => { navigateTo('home'); setSelectedCategory(cat); setIsMobileMenuOpen(false); }}
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
                        onClick={() => { navigateTo('profile'); setIsMobileMenuOpen(false); }}
                        className={`flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 text-sm rounded-xl ${
                          currentPage === 'profile' ? 'text-neutral-900 bg-neutral-100 font-medium' : 'text-neutral-500 hover:bg-neutral-50'
                        }`}
                      >
                        <User className="w-4 h-4" /> My Profile
                      </button>
                      {profile?.isAdmin && (
                        <button
                          onClick={() => { navigateTo('admin'); setIsMobileMenuOpen(false); }}
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

        {/* ── Main Content Area ── */}
        <main className="flex-grow min-w-0">

          {currentPage === 'profile' ? (
            <UserProfile
              onBack={() => navigateTo('home')}
              onProjectClick={navigateToProject}
            />
          ) : currentPage === 'admin' ? (
            <AdminQueue
              onBack={() => navigateTo('home')}
              onProjectClick={navigateToProject}
            />
          ) : selectedProject ? (
            <ProjectDetailView
              project={selectedProject}
              onBack={() => setSelectedProject(null)}
              onUpdateProject={handleUpdateProject}
              allProjects={projects}
              onProjectClick={setSelectedProject}
              onVote={handleVote}
              onRequireAuth={() => setIsAuthModalOpen(true)}
            />
          ) : (
            <div>
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

              {/* Project Grid */}
              {filteredProjects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-10">
                  {filteredProjects.map((project, idx) => (
                    <div key={project.id} className={idx > 0 ? `animate-fade-up animate-fade-up-delay-${Math.min(idx, 3)}` : 'animate-fade-up'}>
                      <ProjectCard
                        project={project}
                        onClick={setSelectedProject}
                        onVote={handleVote}
                        voted={userVotes.has(project.id)}
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
            </div>
          )}

        </main>

        {/* ── Right Sidebar (Desktop) ── */}
        <aside className="hidden xl:block w-72 shrink-0 space-y-6">

           {/* Leaderboard */}
           <div className="bg-white rounded-2xl border border-neutral-200/60 overflow-hidden">
             <div className="px-5 py-4 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span className="text-[13px] font-bold text-neutral-900">Top Contributors</span>
             </div>
             <div className="px-2 pb-2">
                {topStudents.map((student, idx) => (
                  <div key={student.name} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-neutral-50 transition-colors">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx === 0 ? 'bg-amber-100 text-amber-700'
                      : idx === 1 ? 'bg-neutral-100 text-neutral-600'
                      : idx === 2 ? 'bg-orange-100 text-orange-700'
                      : 'bg-neutral-50 text-neutral-400'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="text-[13px] font-medium text-neutral-900 truncate">{student.name}</div>
                      <div className="text-[11px] text-neutral-400">{student.likes} votes · {student.projects} project{student.projects !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                ))}
             </div>
           </div>

           {/* Notice */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200/60 p-5">
            <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider mb-2">Faculty Notice</div>
            <p className="text-[13px] text-neutral-700 leading-relaxed mb-3">
              The annual hackathon "GoUni Hacks 2024" is scheduled for next month. Start forming your teams!
            </p>
            <a href="#" className="text-[12px] font-semibold text-amber-700 hover:text-amber-900 transition-colors">Learn more →</a>
          </div>

          {/* Trending Tech */}
          <div className="bg-white rounded-2xl border border-neutral-200/60 p-5">
            <div className="text-[13px] font-bold text-neutral-900 mb-4">Trending Technologies</div>
            <div className="flex flex-wrap gap-2">
               {['React', 'Python', 'Flutter', 'AI/ML', 'Arduino', 'Vue'].map(t => (
                 <span key={t} className="px-3 py-1.5 bg-neutral-50 text-neutral-600 text-[12px] font-medium rounded-lg border border-neutral-100 hover:border-neutral-300 hover:bg-white transition-all cursor-default">
                   {t}
                 </span>
               ))}
            </div>
          </div>
        </aside>

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
    </div>
  );
};

export default App;
