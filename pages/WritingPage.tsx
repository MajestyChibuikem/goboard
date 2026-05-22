import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Writing } from '../types';
import { WritingDetailView } from '../components/WritingDetailView';
import { PublicProfileModal } from '../components/PublicProfileModal';
import { getWritingById, toggleWritingVote, subscribeToUserLitVotes } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';

const WritingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [writing, setWriting] = useState<Writing | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null);
  const [userLitVotes, setUserLitVotes] = useState<Set<string>>(new Set());
  const [votingPending, setVotingPending] = useState(false);

  useEffect(() => {
    if (!id) return;
    getWritingById(id)
      .then(w => { setWriting(w); setLoading(false); })
      .catch(err => { console.error('Failed to fetch writing:', err); setLoading(false); });
  }, [id]);

  useEffect(() => {
    if (!user) { setUserLitVotes(new Set()); return; }
    const unsub = subscribeToUserLitVotes(user.uid, setUserLitVotes);
    return unsub;
  }, [user]);

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
      if (!user || !writing || votingPending) return;
      if (writing.authorUid && writing.authorUid === user.uid) {
        toast("You can't upvote your own writing.", 'info');
        return;
      }
      setVotingPending(true);

      const wasVoted = userLitVotes.has(writingId);
      setUserLitVotes(prev => {
        const next = new Set(prev);
        wasVoted ? next.delete(writingId) : next.add(writingId);
        return next;
      });
      setWriting(prev => prev ? { ...prev, likes: prev.likes + (wasVoted ? -1 : 1) } : prev);

      try {
        const added = await toggleWritingVote(writingId, user.uid, writing.authorUid);
        toast(added ? 'Upvoted!' : 'Removed vote.', 'success');
      } catch (err) {
        console.error('Vote failed:', err);
        toast('Vote failed. Try again.', 'error');
        setUserLitVotes(prev => {
          const next = new Set(prev);
          wasVoted ? next.add(writingId) : next.delete(writingId);
          return next;
        });
        setWriting(prev => prev ? { ...prev, likes: prev.likes + (wasVoted ? 1 : -1) } : prev);
      } finally {
        setVotingPending(false);
      }
    });
  }, [user, writing, userLitVotes, votingPending, requireAuth, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-neutral-200 border-t-neutral-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!writing) {
    return (
      <div className="text-center py-24">
        <h2 className="text-xl font-semibold text-neutral-900 mb-2">Writing not found</h2>
        <p className="text-sm text-neutral-400 mb-6">This piece may have been removed or doesn't exist.</p>
        <button
          onClick={() => navigate('/lit-club')}
          className="text-sm font-medium text-gouni-primary hover:underline"
        >
          Back to Lit Club
        </button>
      </div>
    );
  }

  return (
    <>
      <WritingDetailView
        writing={writing}
        onBack={() => navigate('/lit-club')}
        onUpdateWriting={setWriting}
        onVote={handleVote}
        onRequireAuth={() => requireAuth(() => {})}
        onProfileClick={(userId) => setSelectedProfileUserId(userId)}
        voted={userLitVotes.has(writing.id)}
        disabled={votingPending}
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

export default WritingPage;
