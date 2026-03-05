import React from 'react';
import { Check, X, MessageCircle, AtSign, ArrowDownRight } from 'lucide-react';
import { Notification } from '../types';

interface NotificationItemProps {
  notification: Notification;
  onNavigate?: (notification: Notification) => void;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onNavigate,
}) => {
  const getTypeIcon = (type: Notification['type']) => {
    switch (type) {
      case 'approval':
        return <Check className="w-4 h-4 text-emerald-600" />;
      case 'rejection':
        return <X className="w-4 h-4 text-red-600" />;
      case 'comment':
        return <MessageCircle className="w-4 h-4 text-blue-600" />;
      case 'reply':
        return <ArrowDownRight className="w-4 h-4 text-purple-600" />;
      case 'mention':
        return <AtSign className="w-4 h-4 text-orange-600" />;
      default:
        return <MessageCircle className="w-4 h-4 text-neutral-600" />;
    }
  };

  const getTypeLabel = (type: Notification['type']) => {
    switch (type) {
      case 'approval':
        return 'Project Approved';
      case 'rejection':
        return 'Project Rejected';
      case 'comment':
        return 'New Comment';
      case 'reply':
        return 'New Reply';
      case 'mention':
        return 'You were mentioned';
      default:
        return 'Notification';
    }
  };

  const handleClick = () => {
    onNavigate?.(notification);
  };

  const timeAgo = (date: string) => {
    const now = new Date();
    const notifDate = new Date(date);
    const diffMs = now.getTime() - notifDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 2) return '1d ago';
    return `${diffDays}d ago`;
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full p-4 text-left hover:bg-neutral-50 transition-colors ${
        !notification.viewedAt ? 'bg-blue-50' : ''
      }`}
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center">
          {getTypeIcon(notification.type)}
        </div>

        <div className="flex-grow min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-neutral-900">
                {notification.message}
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                by {notification.triggerDisplayName}
              </p>
            </div>
            {!notification.viewedAt && (
              <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
            )}
          </div>

          <p className="text-xs text-neutral-600 line-clamp-2 mt-1.5">
            {notification.previewText}
          </p>

          <p className="text-xs text-neutral-400 mt-2">
            {timeAgo(notification.createdAt)}
          </p>
        </div>
      </div>
    </button>
  );
};
