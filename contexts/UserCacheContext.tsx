import React, { createContext, useContext, useRef, useCallback, useState } from 'react';
import { getUserProfile } from '../services/firestoreService';

interface CachedUser {
  displayName: string;
  photoURL: string | null;
}

interface UserCacheContextValue {
  getUser: (uid: string) => CachedUser | null;
  fetchUser: (uid: string) => void;
}

const UserCacheContext = createContext<UserCacheContextValue>({
  getUser: () => null,
  fetchUser: () => {},
});

export const useUserCache = () => useContext(UserCacheContext);

export const UserCacheProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const cache = useRef<Record<string, CachedUser>>({});
  const pending = useRef<Set<string>>(new Set());
  const [, setTick] = useState(0);

  const fetchUser = useCallback((uid: string) => {
    if (!uid || cache.current[uid] || pending.current.has(uid)) return;
    pending.current.add(uid);

    getUserProfile(uid).then((data) => {
      pending.current.delete(uid);
      if (data) {
        cache.current[uid] = {
          displayName: (data as any).displayName || 'Student',
          photoURL: (data as any).photoURL || null,
        };
        setTick((t) => t + 1);
      }
    }).catch(() => {
      pending.current.delete(uid);
    });
  }, []);

  const getUser = useCallback((uid: string): CachedUser | null => {
    return cache.current[uid] || null;
  }, []);

  return (
    <UserCacheContext.Provider value={{ getUser, fetchUser }}>
      {children}
    </UserCacheContext.Provider>
  );
};
