import React, { useEffect } from 'react';
import { useUserCache } from '../contexts/UserCacheContext';

interface UserAvatarProps {
  uid?: string;
  fallbackName?: string;
  photoURL?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-9 h-9 text-[13px]',
  lg: 'w-11 h-11 text-lg',
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  uid,
  fallbackName = '?',
  photoURL,
  size = 'sm',
  className = '',
}) => {
  const { getUser, fetchUser } = useUserCache();

  useEffect(() => {
    if (uid && !photoURL) {
      fetchUser(uid);
    }
  }, [uid, photoURL, fetchUser]);

  const cached = uid ? getUser(uid) : null;
  const resolvedPhoto = photoURL || cached?.photoURL;
  const resolvedName = cached?.displayName || fallbackName;
  const sizeClass = SIZES[size];

  if (resolvedPhoto) {
    return (
      <img
        src={resolvedPhoto}
        alt=""
        className={`${sizeClass.split(' ').slice(0, 2).join(' ')} rounded-full object-cover shrink-0 ${className}`}
      />
    );
  }

  return (
    <div className={`${sizeClass} rounded-full bg-gouni-secondary flex items-center justify-center font-bold text-gouni-dark shrink-0 ${className}`}>
      {resolvedName.charAt(0).toUpperCase()}
    </div>
  );
};
