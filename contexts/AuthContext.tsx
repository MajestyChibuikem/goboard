import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  linkWithPopup,
  reauthenticateWithPopup,
  unlink,
  GithubAuthProvider,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc, runTransaction, onSnapshot } from 'firebase/firestore';
import { auth, googleProvider, githubProvider, db } from '../services/firebase';
import {
  uploadUserAvatar,
  deleteViewedNotifications,
  awardXP,
  XP_VALUES,
  saveUserGitHubProfile,
  disconnectUserGitHubProfile,
} from '../services/firestoreService';
import { fetchGitHubUserBundle } from '../services/githubService';
import { getRank, cleanOldFirebaseUrl } from '../services/utils';
import { StudentVerificationStatus, BankDetails, GitHubProfileData } from '../types';

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
  hasEditedDisplayName: boolean;
  displayNameEditedAt?: string;
  // Season 1 Economy & Verification
  goCoins: number;
  totalGoCoinsEarned: number;
  verificationStatus: StudentVerificationStatus;
  studentIdCardUrl?: string | null;
  verificationRejectionReason?: string;
  bankDetails?: BankDetails;
  // Discord Profile
  bannerPreset?: string;
  bannerUrl?: string | null;
  bio?: string;
  department?: string;
  academicLevel?: string;
  accentColor?: string;
  // GitHub Integration
  githubProfile?: GitHubProfileData | null;
  githubUsernameLower?: string | null;
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
  connectGitHubWithOAuth: () => Promise<{ profile: GitHubProfileData; xpAwarded: number }>;
  connectGitHubByUsername: (username: string) => Promise<{ profile: GitHubProfileData; xpAwarded: number }>;
  syncGitHubProfile: () => Promise<{ profile: GitHubProfileData; xpAwarded: number } | null>;
  disconnectGitHub: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

async function ensureUserProfile(user: User): Promise<UserProfile> {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data();

    // Ensure xp and uid fields exist (fix for users created before XP system)
    if (!('xp' in data) || !('uid' in data)) {
      await setDoc(ref, { xp: data.xp || 0, seasonXp: data.seasonXp || 0, uid: user.uid }, { merge: true });
    }

    let photoURL = data.photoURL || user.photoURL;
    photoURL = cleanOldFirebaseUrl(photoURL);

    return {
      uid: user.uid,
      displayName: data.displayName || user.displayName || 'Student',
      email: data.email || user.email || '',
      photoURL,
      xp: data.xp || 0,
      seasonXp: data.seasonXp || 0,
      rank: getRank(data.xp || 0),
      streakDays: data.streakDays || 0,
      lastLoginDate: data.lastLoginDate || '',
      isAdmin: data.isAdmin || false,
      joinedAt: data.joinedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      hasEditedDisplayName: data.hasEditedDisplayName || false,
      displayNameEditedAt: data.displayNameEditedAt,
      // Season 1 Economy & Verification
      goCoins: data.goCoins || 0,
      totalGoCoinsEarned: data.totalGoCoinsEarned || 0,
      verificationStatus: data.verificationStatus || 'none',
      studentIdCardUrl: cleanOldFirebaseUrl(data.studentIdCardUrl) || null,
      verificationRejectionReason: data.verificationRejectionReason || undefined,
      bankDetails: data.bankDetails || undefined,
      // Discord Profile
      bannerPreset: data.bannerPreset || 'gradient-blue',
      bannerUrl: cleanOldFirebaseUrl(data.bannerUrl) || null,
      bio: data.bio || '',
      department: data.department || '',
      academicLevel: data.academicLevel || '',
      accentColor: data.accentColor || '#1e3a8a',
      // GitHub Integration
      githubProfile: data.githubProfile || null,
      githubUsernameLower: data.githubUsernameLower || null,
    };
  }

  // First time user — create their profile
  const newProfile = {
    uid: user.uid,
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
    hasEditedDisplayName: false, // NEW: Initialize to false for new users
    // Season 1 Economy & Verification
    goCoins: 0,
    totalGoCoinsEarned: 0,
    verificationStatus: 'none',
    studentIdCardUrl: null,
    // Discord Profile
    bannerPreset: 'gradient-blue',
    bannerUrl: null,
    bio: '',
    department: '',
    academicLevel: '',
    accentColor: '#1e3a8a',
    githubProfile: null,
    githubUsernameLower: null,
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
    hasEditedDisplayName: false, // NEW
    goCoins: 0,
    totalGoCoinsEarned: 0,
    verificationStatus: 'none',
    studentIdCardUrl: null,
    bannerPreset: 'gradient-blue',
    bannerUrl: null,
    bio: '',
    department: '',
    academicLevel: '',
    accentColor: '#1e3a8a',
    githubProfile: null,
    githubUsernameLower: null,
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

  let shouldAwardStreakXp = false;

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

    if (newStreak % 3 === 0) {
      shouldAwardStreakXp = true;
    }

    transaction.update(userRef, updates);
  });

  if (shouldAwardStreakXp) {
    await awardXP(userId, XP_VALUES.LOGIN_STREAK, 'LOGIN_STREAK').catch((err) => {
      console.warn('Failed to award login streak XP:', err);
    });
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Handle Google redirect result on page load
  useEffect(() => {
    getRedirectResult(auth).catch((err) => {
      console.error('Google redirect sign-in error:', err);
    });
  }, []);

  // Handle auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const p = await ensureUserProfile(firebaseUser);
          setProfile(p);

          // Login streak tracking
          await trackLoginStreak(firebaseUser.uid);

          // Clean up expired notifications
          await deleteViewedNotifications(firebaseUser.uid).catch(err =>
            console.error('Failed to cleanup notifications:', err)
          );
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

  // Set up real-time listener for profile changes (separate effect)
  useEffect(() => {
    if (!user) return;

    const userDocRef = doc(db, 'users', user.uid);
    const unsubProfile = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfile(prevProfile => prevProfile ? {
          ...prevProfile,
          displayName: data.displayName || prevProfile.displayName,
          hasEditedDisplayName: data.hasEditedDisplayName ?? prevProfile.hasEditedDisplayName,
          displayNameEditedAt: data.displayNameEditedAt || prevProfile.displayNameEditedAt,
          photoURL: cleanOldFirebaseUrl(data.photoURL) ?? prevProfile.photoURL,
          isAdmin: data.isAdmin ?? prevProfile.isAdmin,
          xp: data.xp ?? prevProfile.xp,
          seasonXp: data.seasonXp ?? prevProfile.seasonXp,
          rank: getRank(data.xp ?? prevProfile.xp ?? 0),
          streakDays: data.streakDays ?? prevProfile.streakDays,
          // Season 1 Economy & Verification
          goCoins: data.goCoins ?? prevProfile.goCoins ?? 0,
          totalGoCoinsEarned: data.totalGoCoinsEarned ?? prevProfile.totalGoCoinsEarned ?? 0,
          verificationStatus: data.verificationStatus ?? prevProfile.verificationStatus ?? 'none',
          studentIdCardUrl: cleanOldFirebaseUrl(data.studentIdCardUrl) ?? prevProfile.studentIdCardUrl ?? null,
          verificationRejectionReason: data.verificationRejectionReason ?? prevProfile.verificationRejectionReason,
          bankDetails: data.bankDetails ?? prevProfile.bankDetails,
          // Discord Profile
          bannerPreset: data.bannerPreset ?? prevProfile.bannerPreset ?? 'gradient-blue',
          bannerUrl: cleanOldFirebaseUrl(data.bannerUrl) ?? prevProfile.bannerUrl ?? null,
          bio: data.bio ?? prevProfile.bio ?? '',
          department: data.department ?? prevProfile.department ?? '',
          academicLevel: data.academicLevel ?? prevProfile.academicLevel ?? '',
          accentColor: data.accentColor ?? prevProfile.accentColor ?? '#1e3a8a',
          // GitHub Integration
          githubProfile: 'githubProfile' in data ? data.githubProfile : prevProfile.githubProfile ?? null,
          githubUsernameLower:
            'githubUsernameLower' in data
              ? data.githubUsernameLower
              : prevProfile.githubUsernameLower ?? null,
        } : prevProfile);
      }
    });

    return unsubProfile;
  }, [user]);

  const signInWithGoogle = async () => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      // Mobile browsers have storage partitioning issues with popups — use redirect
      await signInWithRedirect(auth, googleProvider);
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      if (
        err.code === 'auth/popup-blocked' ||
        err.code === 'auth/popup-closed-by-user' ||
        err.code === 'auth/cancelled-popup-request' ||
        err.code === 'auth/internal-error'
      ) {
        await signInWithRedirect(auth, googleProvider);
      } else {
        throw err;
      }
    }
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

      setProfile(prev => (prev ? { ...prev, photoURL } : prev));
    } catch (err) {
      console.error('Failed to update profile photo:', err);
      throw err;
    }
  };

  const connectGitHubWithOAuth = async (): Promise<{ profile: GitHubProfileData; xpAwarded: number }> => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('You must be signed in to connect your GitHub account.');
    }

    const alreadyLinked = currentUser.providerData.some((p) => p.providerId === 'github.com');
    const result = alreadyLinked
      ? await reauthenticateWithPopup(currentUser, githubProvider)
      : await linkWithPopup(currentUser, githubProvider);

    const credential = GithubAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;

    const ghData = await fetchGitHubUserBundle(
      { accessToken },
      true,
      profile?.githubProfile?.lastRewardedCodingDate
    );

    const { xpAwarded, updatedProfile } = await saveUserGitHubProfile(currentUser.uid, ghData);
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            githubProfile: updatedProfile,
            githubUsernameLower: updatedProfile.username.toLowerCase(),
          }
        : prev
    );

    return { profile: updatedProfile, xpAwarded };
  };

  const connectGitHubByUsername = async (
    username: string
  ): Promise<{ profile: GitHubProfileData; xpAwarded: number }> => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('You must be signed in to connect your GitHub account.');
    }

    const cleanUsername = username.trim().replace(/^@/, '');
    if (!cleanUsername) {
      throw new Error('Please enter a valid GitHub username.');
    }

    const ghData = await fetchGitHubUserBundle(
      { username: cleanUsername },
      Boolean(profile?.githubProfile?.isVerifiedOAuth && profile.githubProfile.username === cleanUsername.toLowerCase()),
      profile?.githubProfile?.lastRewardedCodingDate
    );

    const { xpAwarded, updatedProfile } = await saveUserGitHubProfile(currentUser.uid, ghData);
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            githubProfile: updatedProfile,
            githubUsernameLower: updatedProfile.username.toLowerCase(),
          }
        : prev
    );

    return { profile: updatedProfile, xpAwarded };
  };

  const syncGitHubProfile = async (): Promise<{ profile: GitHubProfileData; xpAwarded: number } | null> => {
    const currentUser = auth.currentUser;
    const existingGh = profile?.githubProfile;
    if (!currentUser || !existingGh?.username) return null;

    const ghData = await fetchGitHubUserBundle(
      { username: existingGh.displayUsername || existingGh.username },
      existingGh.isVerifiedOAuth,
      existingGh.lastRewardedCodingDate
    );

    const { xpAwarded, updatedProfile } = await saveUserGitHubProfile(currentUser.uid, ghData);
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            githubProfile: updatedProfile,
            githubUsernameLower: updatedProfile.username.toLowerCase(),
          }
        : prev
    );

    return { profile: updatedProfile, xpAwarded };
  };

  const disconnectGitHub = async (): Promise<void> => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const isLinked = currentUser.providerData.some((p) => p.providerId === 'github.com');
    if (isLinked && currentUser.providerData.length > 1) {
      await unlink(currentUser, 'github.com').catch((err) => {
        console.warn('Failed to unlink GitHub provider from Firebase Auth:', err);
      });
    }

    await disconnectUserGitHubProfile(currentUser.uid);
    setProfile((prev) =>
      prev ? { ...prev, githubProfile: null, githubUsernameLower: null } : prev
    );
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
        connectGitHubWithOAuth,
        connectGitHubByUsername,
        syncGitHubProfile,
        disconnectGitHub,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

