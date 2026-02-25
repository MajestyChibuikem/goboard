import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc, runTransaction } from 'firebase/firestore';
import { auth, googleProvider, db } from '../services/firebase';
import { uploadUserAvatar } from '../services/firestoreService';
import { XP_VALUES } from '../services/firestoreService';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  xp: number;
  seasonXp: number;
  rank: string;
  streakDays: number;
  lastLoginDate: string;
  isAdmin: boolean;
  joinedAt: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfilePhoto: (file: File) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

const RANK_THRESHOLDS = [
  { min: 2000, rank: 'Hall of Fame' },
  { min: 1000, rank: 'Campus Legend' },
  { min: 600, rank: 'Campus Builder' },
  { min: 300, rank: 'Code Ninja' },
  { min: 100, rank: 'Rising Dev' },
  { min: 0, rank: 'Freshman Coder' },
];

export const RANK_EMOJIS: Record<string, string> = {
  'Freshman Coder': '🎓',
  'Rising Dev': '🚀',
  'Code Ninja': '🥷',
  'Campus Builder': '🏗️',
  'Campus Legend': '🌟',
  'Hall of Fame': '🏆',
};

export const getRank = (xp: number): string => {
  return RANK_THRESHOLDS.find(t => xp >= t.min)?.rank || 'Freshman Coder';
};

async function ensureUserProfile(user: User): Promise<UserProfile> {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data();
    return {
      uid: user.uid,
      displayName: data.displayName || user.displayName || 'Student',
      email: data.email || user.email || '',
      photoURL: data.photoURL || user.photoURL,
      xp: data.xp || 0,
      seasonXp: data.seasonXp || 0,
      rank: getRank(data.xp || 0),
      streakDays: data.streakDays || 0,
      lastLoginDate: data.lastLoginDate || '',
      isAdmin: data.isAdmin || false,
      joinedAt: data.joinedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    };
  }

  // First time user — create their profile
  const newProfile = {
    displayName: user.displayName || 'Student',
    email: user.email || '',
    photoURL: user.photoURL || null,
    xp: 0,
    seasonXp: 0,
    streakDays: 0,
    lastLoginDate: '',
    commentXpToday: 0,
    lastCommentXpDate: '',
    isAdmin: false,
    joinedAt: serverTimestamp(),
  };
  await setDoc(ref, newProfile);

  return {
    uid: user.uid,
    displayName: newProfile.displayName,
    email: newProfile.email,
    photoURL: newProfile.photoURL,
    xp: 0,
    seasonXp: 0,
    rank: 'Freshman Coder',
    streakDays: 0,
    lastLoginDate: '',
    isAdmin: false,
    joinedAt: new Date().toISOString(),
  };
}

// ─── Login Streak ───

const getDateString = (date = new Date()) => date.toISOString().split('T')[0];

const getYesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getDateString(d);
};

async function trackLoginStreak(userId: string) {
  const userRef = doc(db, 'users', userId);
  const today = getDateString();
  const yesterday = getYesterday();

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(userRef);
    if (!snapshot.exists()) return;

    const data = snapshot.data();

    // Already logged in today — no-op
    if (data.lastLoginDate === today) return;

    let newStreak = 1;
    if (data.lastLoginDate === yesterday) {
      newStreak = (data.streakDays || 1) + 1;
    }

    const updates: Record<string, any> = {
      lastLoginDate: today,
      streakDays: newStreak,
    };

    // Award 10 XP every time the streak hits a multiple of 3
    if (newStreak % 3 === 0) {
      updates.xp = (data.xp || 0) + XP_VALUES.LOGIN_STREAK;
      updates.seasonXp = (data.seasonXp || 0) + XP_VALUES.LOGIN_STREAK;
    }

    transaction.update(userRef, updates);
  });
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const p = await ensureUserProfile(firebaseUser);
          setProfile(p);

          // Login streak tracking
          await trackLoginStreak(firebaseUser.uid);
        } catch (err) {
          console.error('Failed to load user profile:', err);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
  };

  const updateProfilePhoto = async (file: File) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      const photoURL = await uploadUserAvatar(currentUser.uid, file);
      await updateProfile(currentUser, { photoURL });
      await updateDoc(doc(db, 'users', currentUser.uid), { photoURL });

      setUser(prev => (prev ? { ...prev, photoURL } : prev));
      setProfile(prev => (prev ? { ...prev, photoURL } : prev));
    } catch (err) {
      console.error('Failed to update profile photo:', err);
      throw err;
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        updateProfilePhoto,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
