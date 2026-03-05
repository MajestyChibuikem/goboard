import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToUserNotifications, markNotificationAsViewed } from '../services/firestoreService';
import { Notification } from '../types';
import { NotificationItem } from './NotificationItem';

interface NotificationBellProps {
  onProjectClick?: (projectId: string) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onProjectClick }) => {
  const { user } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const unsub = subscribeToUserNotifications(user.uid, (notifs) => {
      setNotifications(notifs);

      // Mark all as viewed when dropdown opens
      if (showDropdown && notifs.some(n => !n.viewedAt)) {
        notifs.forEach(n => {
          if (!n.viewedAt) {
            markNotificationAsViewed(user.uid, n.id).catch(err =>
              console.error('Failed to mark notification as viewed:', err)
            );
          }
        });
      }

      setLoading(false);
    });

    return unsub;
  }, [user, showDropdown]);

  const unreadCount = notifications.filter(n => !n.viewedAt).length;

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        )}
      </button>

      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 top-12 z-50 w-96 bg-white rounded-xl border border-neutral-200 shadow-float max-h-96 overflow-y-auto animate-fade-up">
            {loading ? (
              <div className="p-4 text-center text-neutral-400">
                <div className="inline-block animate-spin">
                  <Bell className="w-5 h-5" />
                </div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-neutral-400">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {notifications.map(notif => (
                  <NotificationItem
                    key={notif.id}
                    notification={notif}
                    onNavigate={(notification) => {
                      if (notification.link?.type === 'project' && notification.link.id) {
                        onProjectClick?.(notification.link.id);
                        setShowDropdown(false);
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
