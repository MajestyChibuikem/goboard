import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  updateProfile,
  linkWithRedirect,
  reauthenticateWithRedirect,
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
  saveUserGitHubProfile,
  disconnectUserGitHubProfile,
} from '../services/firestoreService';
import { reportXpEvent } from '../services/xpClient';
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
  bannerCustomGradient?: string | null;
  bio?: string;
  department?: string;
  academicLevel?: string;
  accentColor?: string;
  // GitHub Integration
  githubProfile?: GitHubProfileData | null;
  githubUsernameLower?: string | null;
  // Onboarding
  onboardingCompletedAt?: string | null;
  interests?: string[];
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfilePhoto: (file: File) => Promise<void>;
  connectGitHubWithOAuth: () => Promise<{ profile: GitHubProfileData; xpAwarded: number }>;
  connectGitHubByUsername: (username: string) => Promise<{ profile: GitHubProfileData; xpAwarded: number }>;
  syncGitHubProfile: () => Promise<{ profile: GitHubProfileData; xpAwarded: number } | null>;
  disconnectGitHub: () => Promise<void>;
  togglePinnedRepo: (repoName: string) => Promise<void>;
  redirectError: string | null;
  clearRedirectError: () => void;
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

    // Ensure uid field exists (fix for users created before uid was stored on doc)
    if (!('uid' in data)) {
      await setDoc(ref, { uid: user.uid }, { merge: true });
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
      bannerCustomGradient: data.bannerCustomGradient || null,
      bio: data.bio || '',
      department: data.department || '',
      academicLevel: data.academicLevel || '',
      accentColor: data.accentColor || '#1e3a8a',
      // GitHub Integration
      githubProfile: data.githubProfile || null,
      githubUsernameLower: data.githubUsernameLower || null,
      // Onboarding
      onboardingCompletedAt: data.onboardingCompletedAt?.toDate?.()?.toISOString() || data.onboardingCompletedAt || null,
      interests: Array.isArray(data.interests) ? data.interests : [],
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
    bannerCustomGradient: null,
    bio: '',
    department: '',
    academicLevel: '',
    accentColor: '#1e3a8a',
    githubProfile: null,
    githubUsernameLower: null,
    interests: [],
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
    bannerCustomGradient: null,
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

export const getDateString = (date = new Date()) => date.toISOString().split('T')[0];

export const getYesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getDateString(d);
};

export const getEffectiveStreak = (streakDays: number, lastLoginDate?: string | null): number => {
  if (!streakDays || streakDays <= 0 || !lastLoginDate) return 0;
  const today = getDateString();
  const yesterday = getYesterday();
  if (lastLoginDate !== today && lastLoginDate !== yesterday) {
    return 0;
  }
  return streakDays;
};

async function trackLoginStreak(userId: string) {
  // Delegate daily login streak tracking and XP award to server-authoritative engine
  await reportXpEvent({ type: 'DAILY_LOGIN' }).catch((err) => {
    console.warn('Failed to record daily login streak on server:', err);
  });
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirectError, setRedirectError] = useState<string | null>(null);

  const clearRedirectError = () => setRedirectError(null);

  // Handle redirect sign-in / account linking results on page load (same window)
  useEffect(() => {
    let isMounted = true;
    getRedirectResult(auth)
      .then(async (result) => {
        if (!result || !isMounted) return;
        const credential = GithubAuthProvider.credentialFromResult(result);
        const accessToken = credential?.accessToken;
        const currentUser = result.user;
        if (currentUser) {
          const hasGitHub = currentUser.providerData.some((p) => p.providerId === 'github.com');
          if (hasGitHub || accessToken) {
            try {
              const ghData = await fetchGitHubUserBundle({ accessToken }, true);
              const { updatedProfile } = await saveUserGitHubProfile(currentUser.uid, ghData);
              if (isMounted) {
                setProfile((prev) =>
                  prev
                    ? {
                        ...prev,
                        githubProfile: updatedProfile,
                        githubUsernameLower: updatedProfile.username.toLowerCase(),
                      }
                    : prev
                );
              }
            } catch (ghErr) {
              console.warn('Auto-sync GitHub on redirect failed:', ghErr);
            }
          }
        }
      })
      .catch((err: any) => {
        console.error('Redirect authentication error:', err);
        if (isMounted) {
          setRedirectError(err?.code || err?.message || 'Authentication redirect error');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Handle auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const p = await ensureUserProfile(firebaseUser);
          setProfile(p);
        } catch (err) {
          console.error('Failed to load user profile, using safe fallback:', err);
          // Safe fallback profile so the user is never left with null profile when logged in
          setProfile((prev) => prev || {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || 'Student',
            email: firebaseUser.email || '',
            photoURL: cleanOldFirebaseUrl(firebaseUser.photoURL),
            xp: 0,
            seasonXp: 0,
            rank: 'Freshman Coder',
            streakDays: 0,
            lastLoginDate: '',
            isAdmin: false,
            joinedAt: new Date().toISOString(),
            hasEditedDisplayName: false,
            goCoins: 0,
            totalGoCoinsEarned: 0,
            verificationStatus: 'none',
            studentIdCardUrl: null,
            bannerPreset: 'gradient-blue',
            bannerUrl: null,
            bannerCustomGradient: null,
            bio: '',
            department: '',
            academicLevel: '',
            accentColor: '#1e3a8a',
            githubProfile: null,
            githubUsernameLower: null,
          });
        }

        // Background tasks that must NOT block or fail the auth session
        trackLoginStreak(firebaseUser.uid).catch((err) =>
          console.warn('Failed to track login streak:', err)
        );
        deleteViewedNotifications(firebaseUser.uid).catch((err) =>
          console.warn('Failed to cleanup notifications:', err)
        );
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
    const unsubProfile = onSnapshot(
      userDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProfile((prevProfile) => {
            const base = prevProfile || {
              uid: user.uid,
              displayName: user.displayName || 'Student',
              email: user.email || '',
              photoURL: cleanOldFirebaseUrl(user.photoURL),
              xp: 0,
              seasonXp: 0,
              rank: 'Freshman Coder',
              streakDays: 0,
              lastLoginDate: '',
              isAdmin: false,
              joinedAt: new Date().toISOString(),
              hasEditedDisplayName: false,
              goCoins: 0,
              totalGoCoinsEarned: 0,
              verificationStatus: 'none',
              studentIdCardUrl: null,
              bannerPreset: 'gradient-blue',
              bannerUrl: null,
              bannerCustomGradient: null,
              bio: '',
              department: '',
              academicLevel: '',
              accentColor: '#1e3a8a',
              githubProfile: null,
              githubUsernameLower: null,
            };

            return {
              ...base,
              displayName: data.displayName || base.displayName,
              hasEditedDisplayName: data.hasEditedDisplayName ?? base.hasEditedDisplayName,
              displayNameEditedAt: data.displayNameEditedAt || base.displayNameEditedAt,
              photoURL: cleanOldFirebaseUrl(data.photoURL) ?? base.photoURL,
              isAdmin: data.isAdmin ?? base.isAdmin,
              xp: data.xp ?? base.xp,
              seasonXp: data.seasonXp ?? base.seasonXp,
              rank: getRank(data.xp ?? base.xp ?? 0),
              streakDays: getEffectiveStreak(
                data.streakDays ?? base.streakDays,
                data.lastLoginDate || base.lastLoginDate
              ),
              lastLoginDate: data.lastLoginDate || base.lastLoginDate,
              goCoins: data.goCoins ?? base.goCoins ?? 0,
              totalGoCoinsEarned: data.totalGoCoinsEarned ?? base.totalGoCoinsEarned ?? 0,
              verificationStatus: data.verificationStatus ?? base.verificationStatus ?? 'none',
              studentIdCardUrl: cleanOldFirebaseUrl(data.studentIdCardUrl) ?? base.studentIdCardUrl ?? null,
              verificationRejectionReason: data.verificationRejectionReason ?? base.verificationRejectionReason,
              bankDetails: data.bankDetails ?? base.bankDetails,
              bannerPreset: data.bannerPreset ?? base.bannerPreset ?? 'gradient-blue',
              bannerUrl: cleanOldFirebaseUrl(data.bannerUrl) ?? base.bannerUrl ?? null,
              bannerCustomGradient: data.bannerCustomGradient ?? base.bannerCustomGradient ?? null,
              bio: data.bio ?? base.bio ?? '',
              department: data.department ?? base.department ?? '',
              academicLevel: data.academicLevel ?? base.academicLevel ?? '',
              accentColor: data.accentColor ?? base.accentColor ?? '#1e3a8a',
              githubProfile: 'githubProfile' in data ? data.githubProfile : base.githubProfile ?? null,
              githubUsernameLower:
                'githubUsernameLower' in data
                  ? data.githubUsernameLower
                  : base.githubUsernameLower ?? null,
              onboardingCompletedAt:
                'onboardingCompletedAt' in data
                  ? data.onboardingCompletedAt?.toDate?.()?.toISOString() || data.onboardingCompletedAt || null
                  : base.onboardingCompletedAt ?? null,
              interests: Array.isArray(data.interests) ? data.interests : base.interests ?? [],
            };
          });
        }
      },
      (err) => {
        console.warn('Realtime profile listener error:', err);
      }
    );

    return unsubProfile;
  }, [user]);

  // Sign in with Google using same-window redirect (no popup window)
  const signInWithGoogle = async () => {
    await signInWithRedirect(auth, googleProvider);
  };

  // Sign in with GitHub using same-window redirect (no popup window)
  const signInWithGitHub = async () => {
    await signInWithRedirect(auth, githubProvider);
  };

  const updateProfilePhoto = async (file: File) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      const photoURL = await uploadUserAvatar(currentUser.uid, file);
      await updateProfile(currentUser, { photoURL });
      await updateDoc(doc(db, 'users', currentUser.uid), { photoURL });

      setProfile((prev) => (prev ? { ...prev, photoURL } : prev));
    } catch (err) {
      console.error('Failed to update profile photo:', err);
      throw err;
    }
  };

  // Connect GitHub in the same window via redirect (or reauthenticate)
  const connectGitHubWithOAuth = async (): Promise<{ profile: GitHubProfileData; xpAwarded: number }> => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('You must be signed in to connect your GitHub account.');
    }

    const alreadyLinked = currentUser.providerData.some((p) => p.providerId === 'github.com');
    if (alreadyLinked) {
      await reauthenticateWithRedirect(currentUser, githubProvider);
    } else {
      await linkWithRedirect(currentUser, githubProvider);
    }

    // Since the browser redirects in the same window to GitHub,
    // execution pauses until page returns with getRedirectResult
    return { profile: profile?.githubProfile!, xpAwarded: 0 };
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
      {
        username: cleanUsername,
        customPinnedRepoNames: profile?.githubProfile?.customPinnedRepoNames,
      },
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
      {
        username: existingGh.displayUsername || existingGh.username,
        customPinnedRepoNames: existingGh.customPinnedRepoNames,
      },
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

  const togglePinnedRepo = async (repoName: string): Promise<void> => {
    const currentUser = auth.currentUser;
    const currentGh = profile?.githubProfile;
    if (!currentUser || !currentGh) return;

    const repoLower = repoName.toLowerCase().trim();
    const currentPinned = new Set(
      (currentGh.customPinnedRepoNames || []).map((n) => n.toLowerCase().trim())
    );

    if (currentPinned.has(repoLower)) {
      currentPinned.delete(repoLower);
    } else {
      currentPinned.add(repoLower);
    }

    const updatedPinnedList = Array.from(currentPinned);

    // Re-sort topRepos
    const updatedTopRepos = (currentGh.topRepos || [])
      .map((r) => ({
        ...r,
        isPinned: currentPinned.has(r.name.toLowerCase().trim()),
      }))
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        const timeA = new Date(a.pushedAt || a.updatedAt).getTime();
        const timeB = new Date(b.pushedAt || b.updatedAt).getTime();
        return timeB - timeA;
      });

    const updatedProfile: GitHubProfileData = {
      ...currentGh,
      customPinnedRepoNames: updatedPinnedList,
      topRepos: updatedTopRepos,
    };

    await updateDoc(doc(db, 'users', currentUser.uid), {
      githubProfile: updatedProfile,
    });

    setProfile((prev) => (prev ? { ...prev, githubProfile: updatedProfile } : prev));
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
        signInWithGitHub,
        signOut,
        updateProfilePhoto,
        connectGitHubWithOAuth,
        connectGitHubByUsername,
        syncGitHubProfile,
        disconnectGitHub,
        togglePinnedRepo,
        redirectError,
        clearRedirectError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

