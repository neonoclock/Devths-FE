'use client';

import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import FollowUserProfileModal, {
  type FollowUserProfileModalData,
} from '@/components/mypage/FollowUserProfileModal';
import { fetchUserProfile } from '@/lib/api/users';
import { userKeys } from '@/lib/hooks/users/queryKeys';
import { useFollowUserMutation } from '@/lib/hooks/users/useFollowUserMutation';
import { useMyFollowersInfiniteQuery } from '@/lib/hooks/users/useMyFollowersInfiniteQuery';
import { useMyFollowingsInfiniteQuery } from '@/lib/hooks/users/useMyFollowingsInfiniteQuery';
import { useUnfollowUserMutation } from '@/lib/hooks/users/useUnfollowUserMutation';
import { toast } from '@/lib/toast/store';

export default function FollowListScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    data: followerData,
    isLoading: isFollowersLoading,
    isError: isFollowersError,
    hasNextPage: hasFollowersNextPage,
    isFetchingNextPage: isFollowersFetchingNextPage,
    fetchNextPage: fetchFollowersNextPage,
  } = useMyFollowersInfiniteQuery({ size: 12 });
  const {
    data: followingData,
    isLoading: isFollowingsLoading,
    isError: isFollowingsError,
    hasNextPage: hasFollowingsNextPage,
    isFetchingNextPage: isFollowingsFetchingNextPage,
    fetchNextPage: fetchFollowingsNextPage,
  } = useMyFollowingsInfiniteQuery({ size: 12 });
  const infiniteScrollTriggerRef = useRef<HTMLDivElement | null>(null);
  const [selectedUser, setSelectedUser] = useState<FollowUserProfileModalData | null>(null);
  const followMutation = useFollowUserMutation();
  const unfollowMutation = useUnfollowUserMutation();
  const selectedUserId = selectedUser?.userId;
  const activeTab = searchParams.get('tab') === 'followings' ? 'followings' : 'followers';
  const followers = followerData?.pages.flatMap((page) => page.followers) ?? [];
  const followings = followingData?.pages.flatMap((page) => page.followings) ?? [];
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

  const handleChangeTab = (tab: 'followers' | 'followings') => {
    if (tab === activeTab) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);

    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleOpenProfileModal = (user: FollowUserProfileModalData) => {
    setSelectedUser(user);
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
    router.push(`/chat?${params.toString()}`);
  };

  useEffect(() => {
    const target = infiniteScrollTriggerRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;

        if (activeTab === 'followers') {
          if (!hasFollowersNextPage || isFollowersFetchingNextPage) return;
          void fetchFollowersNextPage();
          return;
        }

        if (!hasFollowingsNextPage || isFollowingsFetchingNextPage) return;
        void fetchFollowingsNextPage();
      },
      { rootMargin: '120px 0px' },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [
    activeTab,
    hasFollowersNextPage,
    isFollowersFetchingNextPage,
    fetchFollowersNextPage,
    hasFollowingsNextPage,
    isFollowingsFetchingNextPage,
    fetchFollowingsNextPage,
  ]);

  return (
    <main className="-mx-4 flex flex-col pb-4 sm:-mx-6">
      <section className="bg-white px-6 py-4">
        <div className="-mx-6 flex border-b border-neutral-200">
          <button
            type="button"
            onClick={() => handleChangeTab('followers')}
            className={`flex-1 border-b-2 px-6 py-2 text-sm font-semibold transition-colors ${
              activeTab === 'followers'
                ? 'border-[#05C075] text-neutral-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            팔로워
          </button>
          <button
            type="button"
            onClick={() => handleChangeTab('followings')}
            className={`flex-1 border-b-2 px-6 py-2 text-sm font-semibold transition-colors ${
              activeTab === 'followings'
                ? 'border-[#05C075] text-neutral-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            팔로잉
          </button>
        </div>

        {activeTab === 'followers' ? (
          <div className="mt-4 space-y-2">
            {isFollowersLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3"
                >
                  <div className="h-10 w-10 animate-pulse rounded-full bg-neutral-200" />
                  <div className="h-4 w-24 animate-pulse rounded bg-neutral-200" />
                </div>
              ))
            ) : isFollowersError ? (
              <p className="py-8 text-center text-sm text-red-500">
                팔로워 목록을 불러오지 못했습니다.
              </p>
            ) : followers.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-500">팔로워가 없습니다.</p>
            ) : (
              <>
                {followers.map((follower) => (
                  <button
                    key={follower.id}
                    type="button"
                    onClick={() =>
                      handleOpenProfileModal({
                        userId: follower.userId,
                        nickname: follower.nickname,
                        profileImage: follower.profileImage,
                        isFollowing: follower.isFollowing,
                      })
                    }
                    className="flex w-full items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left hover:border-[#05C075]"
                  >
                    {follower.profileImage ? (
                      <Image
                        src={follower.profileImage}
                        alt={`${follower.nickname} 프로필`}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-200 text-sm font-semibold text-neutral-600">
                        {follower.nickname.slice(0, 1)}
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-900">
                        {follower.nickname}
                      </p>
                    </div>
                  </button>
                ))}
                {hasFollowersNextPage ? (
                  <div ref={infiniteScrollTriggerRef} className="h-1" />
                ) : null}
                {isFollowersFetchingNextPage ? (
                  <p className="py-2 text-center text-xs text-neutral-400">
                    팔로워를 불러오는 중...
                  </p>
                ) : null}
              </>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {isFollowingsLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3"
                >
                  <div className="h-10 w-10 animate-pulse rounded-full bg-neutral-200" />
                  <div className="h-4 w-24 animate-pulse rounded bg-neutral-200" />
                </div>
              ))
            ) : isFollowingsError ? (
              <p className="py-8 text-center text-sm text-red-500">
                팔로잉 목록을 불러오지 못했습니다.
              </p>
            ) : followings.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-500">팔로잉이 없습니다.</p>
            ) : (
              <>
                {followings.map((following) => (
                  <button
                    key={following.id}
                    type="button"
                    onClick={() =>
                      handleOpenProfileModal({
                        userId: following.userId,
                        nickname: following.nickname,
                        profileImage: following.profileImage,
                        isFollowing: following.isFollowing,
                      })
                    }
                    className="flex w-full items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left hover:border-[#05C075]"
                  >
                    {following.profileImage ? (
                      <Image
                        src={following.profileImage}
                        alt={`${following.nickname} 프로필`}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-200 text-sm font-semibold text-neutral-600">
                        {following.nickname.slice(0, 1)}
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-900">
                        {following.nickname}
                      </p>
                    </div>
                  </button>
                ))}
                {hasFollowingsNextPage ? (
                  <div ref={infiniteScrollTriggerRef} className="h-1" />
                ) : null}
                {isFollowingsFetchingNextPage ? (
                  <p className="py-2 text-center text-xs text-neutral-400">
                    팔로잉을 불러오는 중...
                  </p>
                ) : null}
              </>
            )}
          </div>
        )}
      </section>

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
