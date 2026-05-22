import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Writing, WritingGenre, BoardNotice } from '../types';
import { WritingCard } from '../components/WritingCard';
import { SubmitWritingModal } from '../components/SubmitWritingModal';
import { PublicProfileModal } from '../components/PublicProfileModal';
import { ProjectGridSkeleton } from '../components/Skeleton';
import { Button } from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import {
  subscribeToWritings,
  subscribeToUserLitVotes,
  toggleWritingVote,
  getTopUsersByXP,
  getBoardNotice,
  updateBoardNotice,
  seedWritings,
} from '../services/firestoreService';
import { INITIAL_WRITINGS } from '../constants';
import {
  Search,
  Plus,
  Home,
  TrendingUp,
  Clock,
  MessageCircle,
  Trophy,
  BookOpen,
  Feather,
  ScrollText,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type SortOption = 'newest' | 'votes' | 'comments';

const GENRE_FILTERS: { label: string; value: 'All' | WritingGenre; icon: React.ReactNode }[] = [
  { label: 'All Writings', value: 'All', icon: <Home className="w-4 h-4" /> },
  { label: 'Short Stories', value: 'short-story', icon: <BookOpen className="w-4 h-4" /> },
  { label: 'Poems', value: 'poem', icon: <Feather className="w-4 h-4" /> },
  { label: 'Essays', value: 'essay', icon: <ScrollText className="w-4 h-4" /> },
];

const LitClubPage: React.FC = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [writings, setWritings] = useState<Writing[]>([]);
  const [ready, setReady] = useState(false);
  const [userLitVotes, setUserLitVotes] = useState<Set<string>>(new Set());
  const [votingPending, setVotingPending] = useState<Set<string>>(new Set());

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<'All' | WritingGenre>('All');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

  // Sidebar state
  const [topUsersByXP, setTopUsersByXP] = useState<any[]>([]);
  const [boardNotice, setBoardNotice] = useState<BoardNotice>({
    id: 'boardNotice',
    title: 'Board Notice',
    content: 'Welcome to the Literature Club board! Share your writing with the community.',
    updatedAt: new Date().toISOString(),
  });
  const [showEditNoticeModal, setShowEditNoticeModal] = useState(false);
  const [noticeEditText, setNoticeEditText] = useState(boardNotice.content);
  const [showMobileRightPanel, setShowMobileRightPanel] = useState(false);

  // Subscribe to writings, seed demo data if collection is empty
  useEffect(() => {
    const unsub = subscribeToWritings(
      (data) => {
        if (data.length === 0) {
          seedWritings(INITIAL_WRITINGS).catch(console.error);
        } else {
          setWritings(data);
          setReady(true);
        }
      },
      'all',
      profile?.isAdmin || false,
      user?.uid
    );
    return unsub;
  }, [profile?.isAdmin, user?.uid]);

  // Subscribe to user's lit votes
  useEffect(() => {
    if (!user) { setUserLitVotes(new Set()); return; }
    const unsub = subscribeToUserLitVotes(user.uid, setUserLitVotes);
    return unsub;
  }, [user]);

  // Sidebar data
  useEffect(() => {
    getTopUsersByXP(3).then(setTopUsersByXP).catch(console.warn);
    getBoardNotice().then(n => n && setBoardNotice(n)).catch(console.warn);
  }, []);

  const requireAuth = useCallback((action: () => void) => {
    if (!user) {
      toast('Sign in to interact with the community.', 'info');
      return;
    }
    action();
  }, [user, toast]);

  const handleVote = useCallback((e: React.MouseEvent, writingId: string) => {
    e.stopPropagation();
    requireAuth(async () => {
      if (!user) return;
      const writing = writings.find(w => w.id === writingId);
      if (writing?.authorUid && writing.authorUid === user.uid) {
        toast("You can't upvote your own writing.", 'info');
        return;
      }
      if (votingPending.has(writingId)) return;

      setVotingPending(prev => new Set(prev).add(writingId));

      const wasVoted = userLitVotes.has(writingId);
      setUserLitVotes(prev => {
        const next = new Set(prev);
        wasVoted ? next.delete(writingId) : next.add(writingId);
        return next;
      });
      setWritings(prev => prev.map(w =>
        w.id === writingId ? { ...w, likes: w.likes + (wasVoted ? -1 : 1) } : w
      ));

      try {
        const added = await toggleWritingVote(writingId, user.uid, writing?.authorUid);
        toast(added ? 'Upvoted!' : 'Removed vote.', 'success');
      } catch (err) {
        console.error('Vote failed:', err);
        toast('Vote failed. Try again.', 'error');
        setUserLitVotes(prev => {
          const next = new Set(prev);
          wasVoted ? next.add(writingId) : next.delete(writingId);
          return next;
        });
        setWritings(prev => prev.map(w =>
          w.id === writingId ? { ...w, likes: w.likes + (wasVoted ? 1 : -1) } : w
        ));
      } finally {
        setVotingPending(prev => {
          const next = new Set(prev);
          next.delete(writingId);
          return next;
        });
      }
    });
  }, [user, writings, userLitVotes, votingPending, requireAuth, toast]);

  const filteredWritings = useMemo(() => {
    let filtered = writings.filter(w => {
      // Non-admins see only approved (or their own)
      if (!profile?.isAdmin && w.approvalStatus !== 'approved' && w.authorUid !== user?.uid) return false;
      const matchesSearch = w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (w.displayName || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGenre = selectedGenre === 'All' || w.genre === selectedGenre;
      return matchesSearch && matchesGenre;
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'votes': return b.likes - a.likes;
        case 'comments': return b.comments.length - a.comments.length;
        default: return new Date(b.datePosted).getTime() - new Date(a.datePosted).getTime();
      }
    });
  }, [writings, searchQuery, selectedGenre, sortBy, profile?.isAdmin, user?.uid]);

  const leaderboardUI = (onClickUser?: () => void) => (
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
            onClick={() => { setSelectedProfileUserId(u.uid); onClickUser?.(); }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-neutral-50 transition-colors w-full text-left"
          >
            <div className="relative">
              {u.photoURL ? (
                <img src={u.photoURL} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gouni-secondary flex items-center justify-center text-[11px] font-bold text-gouni-dark">
                  {(u.displayName || 'A').charAt(0).toUpperCase()}
                </div>
              )}
              <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold border-2 border-white ${
                idx === 0 ? 'bg-amber-400 text-amber-900' : idx === 1 ? 'bg-neutral-300 text-neutral-700' : 'bg-orange-300 text-orange-800'
              }`}>
                {idx + 1}
              </span>
            </div>
            <div className="flex-grow min-w-0">
              <div className="text-[13px] font-medium text-neutral-900 truncate">{u.displayName || 'Anonymous'}</div>
              <div className="text-[11px] text-neutral-400">{u.xp || 0} XP · {u.rank || 'Freshman Coder'}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const noticeUI = (
    <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl border border-rose-200/60 p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">{boardNotice.title}</div>
        {profile?.isAdmin && (
          <button
            onClick={() => { setNoticeEditText(boardNotice.content); setShowEditNoticeModal(true); }}
            className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold"
          >
            Edit
          </button>
        )}
      </div>
      <p className="text-[13px] text-neutral-700 leading-relaxed">{boardNotice.content}</p>
    </div>
  );

  return (
    <div className="flex gap-8">

      {/* Left Sidebar */}
      <nav className="hidden lg:block w-52 shrink-0 sticky top-24 h-fit">
        <div className="space-y-1">
          {GENRE_FILTERS.map(({ label, value, icon }) => (
            <button
              key={value}
              onClick={() => setSelectedGenre(value)}
              className={`flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] font-medium rounded-xl transition-all ${
                selectedGenre === value
                  ? 'bg-neutral-900 text-white shadow-sm'
                  : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow min-w-0">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Literature Club</h1>
              <span className="px-2.5 py-1 bg-rose-100 text-rose-700 text-[11px] font-semibold rounded-full border border-rose-200">
                ✍️ Creative Writing
              </span>
            </div>
            <p className="text-sm text-neutral-400">
              {filteredWritings.length} piece{filteredWritings.length !== 1 ? 's' : ''} from our community
            </p>
          </div>

          <div className="flex items-center gap-3">
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

            <Button
              variant="primary"
              className="text-sm h-9 rounded-xl px-4 shrink-0"
              onClick={() => requireAuth(() => setIsSubmitModalOpen(true))}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Submit
            </Button>
          </div>
        </div>

        {/* Mobile search */}
        <div className="md:hidden mb-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search writings or authors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 text-sm bg-neutral-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gouni-primary/20"
          />
        </div>

        {/* Grid */}
        {!ready ? (
          <ProjectGridSkeleton count={4} />
        ) : filteredWritings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-10">
            {filteredWritings.map((writing) => (
              <WritingCard
                key={writing.id}
                writing={writing}
                onClick={(w) => navigate(`/writing/${w.id}`)}
                onVote={handleVote}
                voted={userLitVotes.has(writing.id)}
                disabled={votingPending.has(writing.id) || (!!user && user.uid === writing.authorUid)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-24">
            <div className="w-16 h-16 mx-auto mb-4 bg-rose-50 rounded-2xl flex items-center justify-center">
              <BookOpen className="w-7 h-7 text-rose-300" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 mb-1">No writings yet</h3>
            <p className="text-sm text-neutral-400 mb-6">Be the first to share your work with the club</p>
            <Button variant="primary" className="rounded-xl" onClick={() => requireAuth(() => setIsSubmitModalOpen(true))}>
              <Plus className="w-4 h-4 mr-1.5" /> Submit a Writing
            </Button>
          </div>
        )}
      </main>

      {/* Right Sidebar */}
      <aside className="hidden xl:block w-72 shrink-0">
        <div className="sticky top-24 space-y-6 max-h-[calc(100vh-7rem)] overflow-y-auto scrollbar-hide">
          {leaderboardUI()}
          {noticeUI}
        </div>
      </aside>

      {/* Mobile right-panel toggle */}
      <button
        onClick={() => setShowMobileRightPanel(true)}
        className="xl:hidden fixed bottom-6 right-6 z-40 w-12 h-12 bg-neutral-900 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-neutral-800 transition-colors"
        title="Leaderboard & Info"
      >
        <Trophy className="w-5 h-5" />
      </button>

      {/* Mobile right-panel sheet */}
      {showMobileRightPanel && (
        <div className="xl:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setShowMobileRightPanel(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 bg-[#fafafa] rounded-t-3xl max-h-[75vh] overflow-y-auto animate-slide-up p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center mb-2">
              <div className="w-10 h-1 bg-neutral-300 rounded-full" />
            </div>
            <button
              onClick={() => setShowMobileRightPanel(false)}
              className="absolute top-4 right-4 p-1.5 hover:bg-neutral-200 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-neutral-500" />
            </button>
            {leaderboardUI(() => setShowMobileRightPanel(false))}
            {noticeUI}
          </div>
        </div>
      )}

      {/* Edit Notice Modal */}
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
                    toast('Notice updated!', 'success');
                    setShowEditNoticeModal(false);
                  } catch (err) {
                    console.error(err);
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

      {/* Submit Modal */}
      {isSubmitModalOpen && (
        <SubmitWritingModal
          onClose={() => setIsSubmitModalOpen(false)}
          onSubmitted={() => setIsSubmitModalOpen(false)}
        />
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

export default LitClubPage;
