import type { CursorListResponse } from '@/types/pagination';

export type NotificationResponse = {
  notificationId: number;
  sender: {
    senderId: number;
    senderName: string;
  } | null;
  category: 'AI' | 'CALENDAR' | 'ACTIVITY' | 'BOARD';
  type: 'REPORT' | 'SCHEDULE' | 'FOLLOW' | 'COMMENT';
  content: string;
  targetPath: string;
  resourceId: number;
  createdAt: string;
  isRead: boolean;
};

export type NotificationListResponse = CursorListResponse<NotificationResponse, 'notifications'>;

export type UnreadCountResponse = {
  unreadCount: number;
};
