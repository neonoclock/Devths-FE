'use client';

import { Check } from 'lucide-react';

import NotificationItem from '@/components/notifications/NotificationItem';

import type { NotificationResponse } from '@/types/notifications';

type NotificationListProps = {
  notifications: NotificationResponse[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onClickNotification?: (notification: NotificationResponse) => boolean | void;
};

function NotificationSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((idx) => (
        <div key={idx} className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="h-3 w-20 animate-pulse rounded bg-neutral-200" />
            <div className="h-3 w-12 animate-pulse rounded bg-neutral-200" />
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-3 w-full animate-pulse rounded bg-neutral-200" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-neutral-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function NotificationList({
  notifications,
  isLoading = false,
  isError = false,
  errorMessage,
  onClickNotification,
}: NotificationListProps) {
  if (isLoading) {
    return <NotificationSkeleton />;
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-600">
        {errorMessage ?? '알림을 불러오지 못했습니다.'}
      </div>
    );
  }

  if (!notifications || notifications.length === 0) {
    return (
      <div className="rounded-2xl bg-white px-5 py-7 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#05C075]/10">
          <Check className="h-5 w-5 text-[#05C075]" />
        </div>
        <p className="mt-3 text-sm font-semibold text-neutral-900">알림이 없어요</p>
        <p className="mt-1 text-xs text-neutral-500">새 소식이 도착하면 바로 알려드릴게요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.notificationId}
          notification={notification}
          onClickNotification={onClickNotification}
        />
      ))}
    </div>
  );
}
