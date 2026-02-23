'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import FollowUserProfileModal, {
  type FollowUserProfileModalData,
} from '@/components/mypage/FollowUserProfileModal';
import NotificationList from '@/components/notifications/NotificationList';
import { fetchUserProfile } from '@/lib/api/users';
import { notificationKeys } from '@/lib/hooks/notifications/queryKeys';
import { useNotificationsInfiniteQuery } from '@/lib/hooks/notifications/useNotificationsInfiniteQuery';
import { userKeys } from '@/lib/hooks/users/queryKeys';
import { useFollowUserMutation } from '@/lib/hooks/users/useFollowUserMutation';
import { useUnfollowUserMutation } from '@/lib/hooks/users/useUnfollowUserMutation';
import { toast } from '@/lib/toast/store';

export default function NotificationsPage() {
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);
  const [seenIds, setSeenIds] = useState<number[]>([]);
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<FollowUserProfileModalData | null>(null);
  const followMutation = useFollowUserMutation();
  const unfollowMutation = useUnfollowUserMutation();
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useNotificationsInfiniteQuery({ size: 10 });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const notifications = data?.pages.flatMap((page) => page.notifications) ?? [];
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pendingSeenRef = useRef<Set<number>>(new Set());
  const selectedUserId = selectedUser?.userId;

  const {
    data: selectedUserProfile,
    isLoading: isSelectedUserProfileLoading,
    isError: isSelectedUserProfileError,
    refetch: refetchSelectedUserProfile,
  } = useQuery({
    queryKey: userKeys.profile(selectedUserId ?? -1),
    queryFn: async () => {
      const result = await fetchUserProfile(selectedUserId!);

      if (!result.ok || !result.json) {
        throw new Error('Failed to fetch user profile');
      }

      if ('data' in result.json && result.json.data) {
        return result.json.data;
      }

      throw new Error('Invalid response format');
    },
    enabled: selectedUserId !== undefined,
  });

  const modalUser: FollowUserProfileModalData | null = selectedUser
    ? {
        userId: selectedUser.userId,
        nickname: selectedUserProfile?.user.nickname ?? selectedUser.nickname,
        profileImage: selectedUserProfile?.profileImage?.url ?? selectedUser.profileImage,
        interests: selectedUserProfile?.interests ?? selectedUser.interests,
        isFollowing: selectedUserProfile?.isFollowing ?? selectedUser.isFollowing,
      }
    : null;

  const seenIdSet = useMemo(() => new Set(seenIds), [seenIds]);

  useEffect(() => {
    const syncId = window.setTimeout(() => {
      setIsHydrated(true);
      try {
        const stored = window.localStorage.getItem('devths_seen_notifications');
        const parsed = stored ? (JSON.parse(stored) as number[]) : [];
        setSeenIds(Array.isArray(parsed) ? parsed : []);
      } catch {
        setSeenIds([]);
      }
    }, 0);
    return () => window.clearTimeout(syncId);
  }, []);

  useEffect(() => {
    if (!isHydrated || notifications.length === 0) return;
    for (const notification of notifications) {
      if (!notification.isRead && !seenIdSet.has(notification.notificationId)) {
        pendingSeenRef.current.add(notification.notificationId);
      }
    }
  }, [isHydrated, notifications, seenIdSet]);

  useEffect(() => {
    return () => {
      if (pendingSeenRef.current.size === 0) return;
      try {
        const stored = window.localStorage.getItem('devths_seen_notifications');
        const parsed = stored ? (JSON.parse(stored) as number[]) : [];
        const existing = new Set(Array.isArray(parsed) ? parsed : []);
        // eslint-disable-next-line react-hooks/exhaustive-deps
        pendingSeenRef.current.forEach((id) => existing.add(id));
        window.localStorage.setItem('devths_seen_notifications', JSON.stringify([...existing]));
      } catch {}

      const currentUnread = queryClient.getQueryData<number>(notificationKeys.unreadCount());
      if (typeof currentUnread === 'number') {
        queryClient.setQueryData(notificationKeys.unreadCount(), 0);
      }
      pendingSeenRef.current.clear();
    };
  }, [queryClient]);

  useEffect(() => {
    const element = sentinelRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.2, rootMargin: '200px' },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const displayNotifications = useMemo(
    () =>
      notifications.map((notification) => ({
        ...notification,
        isRead: notification.isRead || seenIdSet.has(notification.notificationId),
      })),
    [notifications, seenIdSet],
  );

  const handleNotificationClick = (notification: (typeof displayNotifications)[number]) => {
    if (notification.type !== 'FOLLOW') return false;

    const targetUserId = notification.sender?.senderId ?? notification.resourceId;
    if (!targetUserId || targetUserId <= 0) return false;

    setSelectedUser({
      userId: targetUserId,
      nickname: notification.sender?.senderName ?? '사용자',
      profileImage: null,
      isFollowing: false,
    });

    return true;
  };

  const handleFollowInModal = async () => {
    if (!modalUser) return;
    const wasFollowing = Boolean(modalUser.isFollowing);
    try {
      if (wasFollowing) {
        await unfollowMutation.mutateAsync(modalUser.userId);
        setSelectedUser((prev) => (prev ? { ...prev, isFollowing: false } : prev));
      } else {
        await followMutation.mutateAsync(modalUser.userId);
        setSelectedUser((prev) => (prev ? { ...prev, isFollowing: true } : prev));
      }
      void refetchSelectedUserProfile();
    } catch (error) {
      const err = error as Error & { serverMessage?: string };
      toast(
        err.serverMessage ??
          (wasFollowing ? '언팔로우 처리에 실패했습니다.' : '팔로우 처리에 실패했습니다.'),
      );
    }
  };

  const handleStartChatInModal = () => {
    if (!modalUser) return;

    const params = new URLSearchParams();
    params.set('targetUserId', String(modalUser.userId));
    params.set('from', 'notifications');
    router.push(`/chat?${params.toString()}`);
  };

  return (
    <main className="px-3 pt-4 pb-3">
      <NotificationList
        notifications={displayNotifications}
        isLoading={!isHydrated || isLoading}
        isError={isError}
        errorMessage={error instanceof Error ? error.message : '알림을 불러오지 못했습니다.'}
        onClickNotification={handleNotificationClick}
      />

      {isError ? (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700"
          >
            다시 시도
          </button>
        </div>
      ) : null}

      {!isError ? (
        <div ref={sentinelRef} className="mt-4 flex justify-center">
          {isFetchingNextPage ? (
            <span className="text-xs text-neutral-400">불러오는 중...</span>
          ) : hasNextPage ? (
            <span className="text-xs text-neutral-400">스크롤로 더 보기</span>
          ) : notifications.length > 0 ? (
            <div className="flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-semibold text-neutral-600">
              <span className="h-1.5 w-1.5 rounded-full bg-[#05C075]" />
              모든 알림을 확인했어요
            </div>
          ) : null}
        </div>
      ) : null}

      <FollowUserProfileModal
        open={Boolean(selectedUser)}
        onClose={() => {
          setSelectedUser(null);
        }}
        user={modalUser}
        isLoading={isSelectedUserProfileLoading}
        isError={isSelectedUserProfileError}
        isFollowPending={followMutation.isPending || unfollowMutation.isPending}
        onRetry={() => void refetchSelectedUserProfile()}
        onClickFollow={() => void handleFollowInModal()}
        onClickChat={handleStartChatInModal}
      />
    </main>
  );
}
