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
import { doc, getDoc, getDocFromServer, setDoc, serverTimestamp, updateDoc, runTransaction, onSnapshot } from 'firebase/firestore';
import { auth, googleProvider, githubProvider, db } from '../services/firebase';
import {
  uploadUserAvatar,
  deleteViewedNotifications,
  saveUserGitHubProfile,
  disconnectUserGitHubProfile,
} from '../services/firestoreService';
import { reportXpEvent, reconcileMissingUserXp } from '../services/xpClient';
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
  // Onboarding & Quests
  onboardingCompletedAt?: string | null;
  interests?: string[];
  completedQuests?: string[];
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
  updateLocalProfile: (updates: Partial<UserProfile>) => void;
  refreshProfile: (forceServer?: boolean) => Promise<UserProfile | null>;
  redirectError: string | null;
  clearRedirectError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export function markWelcomeDoneLocally(uid: string) {
  try {
    localStorage.setItem(`goboard_welcome_done_${uid}`, 'true');
  } catch {
    // ignore storage errors
  }
}

export function isWelcomeDoneLocally(uid: string): boolean {
  try {
    return localStorage.getItem(`goboard_welcome_done_${uid}`) === 'true';
  } catch {
    return false;
  }
}

function resolveEffectiveOnboardingCompletedAt(
  uid: string,
  data: any,
  fallback?: string | null
): string | null {
  const explicit =
    data?.onboardingCompletedAt?.toDate?.()?.toISOString() ||
    data?.onboardingCompletedAt ||
    fallback ||
    null;

  if (explicit) {
    markWelcomeDoneLocally(uid);
    return explicit;
  }

  // Treat user as already onboarded/skipped if they dismissed it locally, filled out department & level, or are an existing active user
  const alreadyActiveOrSkipped =
    isWelcomeDoneLocally(uid) ||
    Boolean(data?.department && data?.academicLevel) ||
    Boolean(
      data?.isAdmin ||
      (Number(data?.xp) || 0) >= 25 ||
      data?.githubProfile?.username ||
      data?.hasEditedDisplayName
    );

  if (alreadyActiveOrSkipped) {
    markWelcomeDoneLocally(uid);
    return 'completed';
  }

  return null;
}

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

    const xp = Number(data.xp) || 0;
    const seasonXp = Number(data.seasonXp) || 0;

    return {
      uid: user.uid,
      displayName: data.displayName || user.displayName || 'Student',
      email: data.email || user.email || '',
      photoURL,
      xp,
      seasonXp,
      rank: getRank(xp),
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
      // Onboarding & Quests
      onboardingCompletedAt: resolveEffectiveOnboardingCompletedAt(user.uid, data, null),
      interests: Array.isArray(data.interests) ? data.interests : [],
      completedQuests: Array.isArray(data.completedQuests) ? data.completedQuests : [],
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

  const refreshProfile = async (forceServer = true): Promise<UserProfile | null> => {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    const userDocRef = doc(db, 'users', currentUser.uid);
    try {
      const snap = forceServer
        ? await getDocFromServer(userDocRef).catch(() => getDoc(userDocRef))
        : await getDoc(userDocRef);
      if (snap.exists()) {
        const data = snap.data();
        let freshProfile: UserProfile | null = null;
        setProfile((prevProfile) => {
          const base = prevProfile || {
            uid: currentUser.uid,
            displayName: currentUser.displayName || 'Student',
            email: currentUser.email || '',
            photoURL: cleanOldFirebaseUrl(currentUser.photoURL),
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

          const xp = Number(data.xp) || 0;
          const seasonXp = Number(data.seasonXp) || 0;

          freshProfile = {
            ...base,
            displayName: data.displayName || base.displayName,
            hasEditedDisplayName: data.hasEditedDisplayName ?? base.hasEditedDisplayName,
            displayNameEditedAt: data.displayNameEditedAt || base.displayNameEditedAt,
            photoURL: cleanOldFirebaseUrl(data.photoURL) ?? base.photoURL,
            isAdmin: data.isAdmin ?? base.isAdmin,
            xp,
            seasonXp,
            rank: getRank(xp),
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
            onboardingCompletedAt: resolveEffectiveOnboardingCompletedAt(
              currentUser.uid,
              data,
              base.onboardingCompletedAt
            ),
            interests: Array.isArray(data.interests) ? data.interests : base.interests ?? [],
            completedQuests: Array.isArray(data.completedQuests)
              ? data.completedQuests
              : base.completedQuests ?? [],
          };
          return freshProfile;
        });
        return freshProfile;
      }
    } catch (err) {
      console.warn('Profile refresh warning:', err);
    }
    return null;
  };

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
              const { updatedProfile } = await saveUserGitHubProfile(currentUser.uid, ghData, accessToken);
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
            onboardingCompletedAt: isWelcomeDoneLocally(firebaseUser.uid) ? 'completed' : null,
          });
        }

        // Background tasks that must NOT block or fail the auth session
        trackLoginStreak(firebaseUser.uid).catch((err) =>
          console.warn('Failed to track login streak:', err)
        );
        reconcileMissingUserXp(firebaseUser.uid)
          .then((reconciled) => {
            if (reconciled > 0) {
              refreshProfile(true);
            }
          })
          .catch((err) =>
            console.warn('Failed to reconcile missing XP:', err)
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

  // Set up real-time listener for profile changes with resilient fallback polling
  useEffect(() => {
    if (!user) return;

    let pollInterval: any = null;
    const startFallbackPolling = () => {
      if (pollInterval) return;
      pollInterval = setInterval(() => {
        refreshProfile(true);
      }, 10000);
    };

    const userDocRef = doc(db, 'users', user.uid);
    let unsubProfile = () => {};

    try {
      unsubProfile = onSnapshot(
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

              const xp = Number(data.xp) || 0;
              const seasonXp = Number(data.seasonXp) || 0;

              return {
                ...base,
                displayName: data.displayName || base.displayName,
                hasEditedDisplayName: data.hasEditedDisplayName ?? base.hasEditedDisplayName,
                displayNameEditedAt: data.displayNameEditedAt || base.displayNameEditedAt,
                photoURL: cleanOldFirebaseUrl(data.photoURL) ?? base.photoURL,
                isAdmin: data.isAdmin ?? base.isAdmin,
                xp,
                seasonXp,
                rank: getRank(xp),
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
                onboardingCompletedAt: resolveEffectiveOnboardingCompletedAt(
                  user.uid,
                  data,
                  base.onboardingCompletedAt
                ),
                interests: Array.isArray(data.interests) ? data.interests : base.interests ?? [],
                completedQuests: Array.isArray(data.completedQuests)
                  ? data.completedQuests
                  : base.completedQuests ?? [],
              };
            });
          }
        },
        (err) => {
          console.warn('Realtime profile listener error, activating resilient polling:', err);
          startFallbackPolling();
          refreshProfile(true);
        }
      );
    } catch (subErr) {
      console.warn('Could not attach profile listener, starting polling:', subErr);
      startFallbackPolling();
    }

    // Refresh when user returns to the tab
    const handleFocus = () => {
      refreshProfile(true);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshProfile(true);
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unsubProfile();
      if (pollInterval) clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user]);

  // Globally ensure #loading-screen is dismissed once auth state resolves on any route
  useEffect(() => {
    if (!loading) {
      const loadingScreen = document.getElementById('loading-screen');
      if (loadingScreen && !loadingScreen.classList.contains('hidden')) {
        loadingScreen.classList.add('hidden');
        setTimeout(() => {
          try {
            loadingScreen.remove();
          } catch (e) {}
        }, 400);
      }
    }
  }, [loading]);

  // Sign in with Google using Popup first, falling back to Redirect if popup is blocked
  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      const code = err?.code || '';
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      throw err;
    }
  };

  // Sign in with GitHub using Popup first, falling back to Redirect if popup is blocked
  const signInWithGitHub = async () => {
    try {
      const result = await signInWithPopup(auth, githubProvider);
      const credential = GithubAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken;
      if (result.user) {
        fetchGitHubUserBundle({ accessToken }, true)
          .then((ghData) => saveUserGitHubProfile(result.user.uid, ghData, accessToken))
          .then(({ updatedProfile }) => {
            setProfile((prev) =>
              prev
                ? {
                    ...prev,
                    githubProfile: updatedProfile,
                    githubUsernameLower: updatedProfile.username.toLowerCase(),
                  }
                : prev
            );
          })
          .catch((ghErr) => console.warn('Auto-sync GitHub after popup sign-in failed:', ghErr));
      }
    } catch (err: any) {
      const code = err?.code || '';
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        await signInWithRedirect(auth, githubProvider);
        return;
      }
      throw err;
    }
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

  // Connect GitHub via Popup first (so multi-step wizards like /welcome never reload), with Redirect fallback
  const connectGitHubWithOAuth = async (): Promise<{ profile: GitHubProfileData; xpAwarded: number }> => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('You must be signed in to connect your GitHub account.');
    }

    const alreadyLinked = currentUser.providerData.some((p) => p.providerId === 'github.com');

    try {
      const result = alreadyLinked
        ? await reauthenticateWithPopup(currentUser, githubProvider)
        : await linkWithPopup(currentUser, githubProvider);

      const credential = GithubAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken;
      const ghData = await fetchGitHubUserBundle(
        {
          accessToken,
          customPinnedRepoNames: profile?.githubProfile?.customPinnedRepoNames,
        },
        true,
        profile?.githubProfile?.lastRewardedCodingDate
      );

      const { xpAwarded, updatedProfile } = await saveUserGitHubProfile(currentUser.uid, ghData, accessToken);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              githubProfile: updatedProfile,
              githubUsernameLower: updatedProfile.username.toLowerCase(),
              ...(xpAwarded > 0
                ? {
                    xp: (prev.xp || 0) + xpAwarded,
                    seasonXp: (prev.seasonXp || 0) + xpAwarded,
                    rank: getRank((prev.xp || 0) + xpAwarded),
                  }
                : {}),
            }
          : prev
      );

      return { profile: updatedProfile, xpAwarded };
    } catch (err: any) {
      const code = err?.code || '';
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        if (alreadyLinked) {
          await reauthenticateWithRedirect(currentUser, githubProvider);
        } else {
          await linkWithRedirect(currentUser, githubProvider);
        }
        return { profile: profile?.githubProfile!, xpAwarded: 0 };
      }
      if (code === 'auth/credential-already-in-use') {
        throw new Error('This GitHub account is already linked to another GoBoard user.');
      }
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        throw new Error('GitHub connection popup was closed before completing.');
      }
      throw err;
    }
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
            ...(xpAwarded > 0
              ? {
                  xp: (prev.xp || 0) + xpAwarded,
                  seasonXp: (prev.seasonXp || 0) + xpAwarded,
                  rank: getRank((prev.xp || 0) + xpAwarded),
                }
              : {}),
          }
        : prev
    );
    if (xpAwarded > 0) {
      refreshProfile(true).catch(() => {});
    }

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
            ...(xpAwarded > 0
              ? {
                  xp: (prev.xp || 0) + xpAwarded,
                  seasonXp: (prev.seasonXp || 0) + xpAwarded,
                  rank: getRank((prev.xp || 0) + xpAwarded),
                }
              : {}),
          }
        : prev
    );
    if (xpAwarded > 0) {
      refreshProfile(true).catch(() => {});
    }

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

  const updateLocalProfile = (updates: Partial<UserProfile>) => {
    setProfile((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      if (typeof updates.xp === 'number') {
        next.rank = getRank(updates.xp);
      }
      return next;
    });
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
        updateLocalProfile,
        refreshProfile,
        redirectError,
        clearRedirectError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

