import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToUserNotifications, markNotificationAsViewed } from '../services/firestoreService';
import { Notification } from '../types';
import { NotificationItem } from './NotificationItem';

interface NotificationBellProps {
  onProjectClick?: (projectId: string) => void;
  onWritingClick?: (writingId: string) => void;
  onProfileClick?: () => void;
  onCampaignClick?: (paperId?: string) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  onProjectClick,
  onWritingClick,
  onProfileClick,
  onCampaignClick,
}) => {
  const { user } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const unsub = subscribeToUserNotifications(user.uid, (notifs) => {
      setNotifications(notifs);
      setLoading(false);
    });

    return unsub;
  }, [user]);

  // Mark all unread as viewed when dropdown is opened
  useEffect(() => {
    if (!user || !showDropdown) return;
    const unread = notifications.filter(n => !n.viewedAt);
    if (unread.length > 0) {
      unread.forEach(n => {
        markNotificationAsViewed(user.uid, n.id).catch(err =>
          console.error('Failed to mark notification as viewed:', err)
        );
      });
    }
  }, [user, showDropdown, notifications]);

  const unreadCount = notifications.filter(n => !n.viewedAt).length;

  return (
    <div className="relative">
      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
            <motion.span
              animate={{ scale: [1, 2, 1], opacity: [0.8, 0, 0.8] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inline-flex h-full w-full rounded-full bg-red-400"
            />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {showDropdown && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setShowDropdown(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="absolute top-12 z-50 w-80 max-w-[calc(100vw-1rem)] md:w-96 right-0 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-float max-h-96 overflow-y-auto"
            >
            {loading ? (
              <div className="p-4 text-center text-neutral-400 dark:text-neutral-500">
                <div className="inline-block animate-spin">
                  <Bell className="w-5 h-5" />
                </div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-neutral-400 dark:text-neutral-500">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {notifications.map(notif => (
                  <NotificationItem
                    key={notif.id}
                    notification={notif}
                    onNavigate={(notification) => {
                      if (notification.link?.type === 'writing' && notification.link.id) {
                        onWritingClick?.(notification.link.id);
                        setShowDropdown(false);
                      } else if (notification.link?.type === 'project' && notification.link.id) {
                        onProjectClick?.(notification.link.id);
                        setShowDropdown(false);
                      } else if (notification.link?.type === 'profile') {
                        onProfileClick?.();
                        setShowDropdown(false);
                      } else if (notification.link?.type === 'campaign') {
                        onCampaignClick?.(notification.link.id);
                        setShowDropdown(false);
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  </div>
);
};
