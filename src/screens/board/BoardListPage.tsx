'use client';

import { useQuery } from '@tanstack/react-query';
import { Bell, Loader2, Plus, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BoardPostCard from '@/components/board/BoardPostCard';
import BoardSortTabs from '@/components/board/BoardSortTabs';
import BoardTagFilter from '@/components/board/BoardTagFilter';
import BoardUserMiniProfile from '@/components/board/BoardUserMiniProfile';
import { useHeader } from '@/components/layout/HeaderContext';
import { useNavigationGuard } from '@/components/layout/NavigationGuardContext';
import ListLoadMoreSentinel from '@/components/llm/rooms/ListLoadMoreSentinel';
import { BOARD_TAG_MAX, POPULAR_MIN_LIKES } from '@/constants/board';
import { fetchMyFollowings, fetchUserProfile } from '@/lib/api/users';
import { getUserIdFromAccessToken } from '@/lib/auth/token';
import { useBoardListInfiniteQuery } from '@/lib/hooks/boards/useBoardListInfiniteQuery';
import { useUnreadCountQuery } from '@/lib/hooks/notifications/useUnreadCountQuery';
import { userKeys } from '@/lib/hooks/users/queryKeys';
import { useFollowUserMutation } from '@/lib/hooks/users/useFollowUserMutation';
import { useUnfollowUserMutation } from '@/lib/hooks/users/useUnfollowUserMutation';
import { toast } from '@/lib/toast/store';

import type { BoardSort, BoardTag } from '@/types/board';

const PAGE_SIZE = 10;
const FOLLOWINGS_FETCH_SIZE = 100;
const PULL_MAX = 120;
const PULL_THRESHOLD = 72;

export default function BoardListPage() {
  const router = useRouter();
  const currentUserId = getUserIdFromAccessToken();
  const { setOptions, resetOptions } = useHeader();
  const { requestNavigation } = useNavigationGuard();
  const { data: unreadCount } = useUnreadCountQuery();
  const showBadge = typeof unreadCount === 'number' && unreadCount > 0;
  const [sort, setSort] = useState<BoardSort>('LATEST');
  const [selectedTags, setSelectedTags] = useState<BoardTag[]>([]);
  const [isTagOpen, setIsTagOpen] = useState(false);
  const [isMiniProfileOpen, setIsMiniProfileOpen] = useState(false);
  const [selectedAuthorId, setSelectedAuthorId] = useState<number | null>(null);
  const [followStateOverrides, setFollowStateOverrides] = useState<Record<number, boolean>>({});
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isReadyToRefresh, setIsReadyToRefresh] = useState(false);
  const isRefreshingRef = useRef(false);
  const isReadyToRefreshRef = useRef(false);
  const followMutation = useFollowUserMutation();
  const unfollowMutation = useUnfollowUserMutation();

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useBoardListInfiniteQuery({
      size: PAGE_SIZE,
      sort,
      tags: selectedTags,
    });

  const rawPosts = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);
  const {
    data: followingAuthorIds,
    isLoading: isFollowingAuthorIdsLoading,
    isError: isFollowingAuthorIdsError,
    refetch: refetchFollowingAuthorIds,
  } = useQuery({
    queryKey: [...userKeys.all, 'myFollowingAuthorIds'],
    queryFn: async () => {
      const ids = new Set<number>();
      let lastId: number | null | undefined = undefined;

      while (true) {
        const result = await fetchMyFollowings({
          size: FOLLOWINGS_FETCH_SIZE,
          lastId,
        });

        if (!result.ok || !result.json) {
          throw new Error('Failed to fetch my following users');
        }

        if (!('data' in result.json) || !result.json.data) {
          throw new Error('Invalid response format');
        }

        for (const following of result.json.data.followings) {
          ids.add(following.userId);
        }

        if (!result.json.data.hasNext || result.json.data.lastId === null) {
          break;
        }

        lastId = result.json.data.lastId;
      }

      return Array.from(ids);
    },
    enabled: sort === 'FOLLOWING',
  });

  const filteredPosts = useMemo(() => {
    let filtered = rawPosts;

    if (selectedTags.length > 0) {
      filtered = filtered.filter((post) => selectedTags.some((tag) => post.tags.includes(tag)));
    }

    if (sort === 'POPULAR') {
      filtered = filtered
        .filter((post) => post.stats.likeCount >= POPULAR_MIN_LIKES)
        .sort((a, b) => {
          if (b.stats.likeCount !== a.stats.likeCount) {
            return b.stats.likeCount - a.stats.likeCount;
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }

    if (sort === 'FOLLOWING') {
      const followingAuthorIdSet = new Set(followingAuthorIds ?? []);
      filtered = filtered.filter((post) => followingAuthorIdSet.has(post.author.userId));
    }

    return filtered;
  }, [rawPosts, selectedTags, sort, followingAuthorIds]);

  const selectedAuthor = useMemo(
    () => rawPosts.find((post) => post.author.userId === selectedAuthorId)?.author ?? null,
    [rawPosts, selectedAuthorId],
  );
  const { data: selectedAuthorProfile, refetch: refetchSelectedAuthorProfile } = useQuery({
    queryKey: userKeys.profile(selectedAuthorId ?? -1),
    queryFn: async () => {
      const result = await fetchUserProfile(selectedAuthorId!);

      if (!result.ok || !result.json) {
        throw new Error('Failed to fetch user profile');
      }

      if ('data' in result.json && result.json.data) {
        return result.json.data;
      }

      throw new Error('Invalid response format');
    },
    enabled: selectedAuthorId !== null,
  });

  const modalUser = selectedAuthor
    ? {
        userId: selectedAuthor.userId,
        nickname: selectedAuthorProfile?.user.nickname ?? selectedAuthor.nickname,
        profileImageUrl:
          selectedAuthorProfile?.profileImage?.url ?? selectedAuthor.profileImageUrl ?? null,
        interests: selectedAuthorProfile?.interests ?? selectedAuthor.interests ?? [],
      }
    : null;
  const modalUserId = modalUser?.userId ?? null;
  const isMine = Boolean(
    modalUserId !== null && currentUserId !== null && modalUserId === currentUserId,
  );
  const profileIsFollowing = selectedAuthorProfile?.isFollowing ?? false;
  const isFollowing =
    modalUserId !== null && followStateOverrides[modalUserId] !== undefined
      ? followStateOverrides[modalUserId]
      : profileIsFollowing;
  const isFollowPending = followMutation.isPending || unfollowMutation.isPending;

  const handleCreatePost = useCallback(() => {
    requestNavigation(() => router.push('/board/create'));
  }, [requestNavigation, router]);

  const handleSearchClick = useCallback(() => {
    requestNavigation(() => router.push('/board/search'));
  }, [requestNavigation, router]);

  const handleNotificationsClick = useCallback(() => {
    requestNavigation(() => router.push('/notifications'));
  }, [requestNavigation, router]);

  const handleAuthorClick = (userId: number) => {
    setSelectedAuthorId(userId);
    setIsMiniProfileOpen(true);
  };

  const handleToggleFollow = async () => {
    if (modalUserId === null || isMine || isFollowPending) return;

    try {
      if (isFollowing) {
        await unfollowMutation.mutateAsync(modalUserId);
        setFollowStateOverrides((prev) => ({ ...prev, [modalUserId]: false }));
      } else {
        await followMutation.mutateAsync(modalUserId);
        setFollowStateOverrides((prev) => ({ ...prev, [modalUserId]: true }));
      }
      void refetchSelectedAuthorProfile();
    } catch (error) {
      const err = error as Error & { serverMessage?: string };
      toast(err.serverMessage ?? '팔로우 처리에 실패했습니다.');
    }
  };

  const handlePostClick = useCallback(
    (postId: number) => {
      requestNavigation(() => router.push(`/board/${postId}`));
    },
    [requestNavigation, router],
  );

  const triggerRefresh = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    setPullDistance(PULL_THRESHOLD);
    try {
      await refetch();
    } finally {
      isRefreshingRef.current = false;
      isReadyToRefreshRef.current = false;
      setIsRefreshing(false);
      setIsReadyToRefresh(false);
      setPullDistance(0);
    }
  }, [refetch]);

  const rightSlot = useMemo(
    () => (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleSearchClick}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-neutral-100"
          aria-label="게시글 검색"
        >
          <Search className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={handleNotificationsClick}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-neutral-100"
          aria-label="알림"
        >
          <Bell className="h-5 w-5" />
          {showBadge ? (
            <span className="absolute top-[0.5px] right-[0.5px] h-2.5 w-2.5 rounded-full bg-red-500" />
          ) : null}
        </button>
      </div>
    ),
    [handleNotificationsClick, handleSearchClick, showBadge],
  );

  useEffect(() => {
    setOptions({
      title: 'Devths',
      showBackButton: false,
      rightSlot,
    });

    return () => resetOptions();
  }, [resetOptions, rightSlot, setOptions]);

  useEffect(() => {
    if (isLoading || isError) return;
    if (sort === 'FOLLOWING' && isFollowingAuthorIdsLoading) return;
    if (sort === 'FOLLOWING' && isFollowingAuthorIdsError) return;
    if (sort === 'FOLLOWING' && followingAuthorIds && followingAuthorIds.length === 0) return;
    if (!hasNextPage || isFetchingNextPage) return;
    if (filteredPosts.length > 0) return;
    void fetchNextPage();
  }, [
    fetchNextPage,
    filteredPosts.length,
    hasNextPage,
    isError,
    isFetchingNextPage,
    isLoading,
    sort,
    isFollowingAuthorIdsLoading,
    isFollowingAuthorIdsError,
    followingAuthorIds,
  ]);

  useEffect(() => {
    const getScrollTop = () =>
      window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;

    let startY = 0;
    let tracking = false;

    const handleTouchStart = (event: TouchEvent) => {
      if (isRefreshingRef.current) return;
      if (getScrollTop() > 1) return;
      const touch = event.touches[0];
      if (!touch) return;
      tracking = true;
      startY = touch.clientY;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!tracking) return;
      const touch = event.touches[0];
      if (!touch) return;
      const delta = touch.clientY - startY;
      if (delta <= 0) {
        setPullDistance(0);
        setIsPulling(false);
        isReadyToRefreshRef.current = false;
        setIsReadyToRefresh(false);
        return;
      }
      if (getScrollTop() > 1) {
        setIsPulling(false);
        return;
      }
      const distance = Math.min(delta * 0.6, PULL_MAX);
      setPullDistance(distance);
      setIsPulling(true);
      isReadyToRefreshRef.current = distance >= PULL_THRESHOLD;
      setIsReadyToRefresh(isReadyToRefreshRef.current);
      if (event.cancelable) event.preventDefault();
    };

    const handleTouchEnd = () => {
      if (!tracking) return;
      tracking = false;
      setIsPulling(false);
      if (isReadyToRefreshRef.current) {
        void triggerRefresh();
        return;
      }
      setPullDistance(0);
      isReadyToRefreshRef.current = false;
      setIsReadyToRefresh(false);
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [triggerRefresh]);

  return (
    <>
      <main className="px-3 pt-4 pb-3">
        <div className="flex flex-col gap-3">
          <BoardSortTabs value={sort} onChange={setSort} />
          <BoardTagFilter
            open={isTagOpen}
            onToggleOpen={() => setIsTagOpen((prev) => !prev)}
            selected={selectedTags}
            onChangeSelected={setSelectedTags}
            max={BOARD_TAG_MAX}
          />
        </div>

        <div className="relative mt-4">
          <div
            className="absolute right-0 left-0 flex items-center justify-center gap-2 text-xs text-neutral-500"
            style={{
              transform: `translateY(${Math.min(pullDistance, PULL_THRESHOLD)}px)`,
              opacity: pullDistance > 0 || isRefreshing ? 1 : 0,
              transition: isPulling ? 'none' : 'opacity 150ms ease, transform 150ms ease',
            }}
          >
            <Loader2 className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>
              {isRefreshing
                ? '새로고침 중...'
                : isReadyToRefresh
                  ? '놓으면 새로고침'
                  : '당겨서 새로고침'}
            </span>
          </div>

          <div
            className="space-y-3"
            style={{
              transform: pullDistance ? `translateY(${pullDistance}px)` : undefined,
              transition: isPulling || isRefreshing ? 'none' : 'transform 180ms ease',
            }}
          >
            {isLoading ? (
              <div className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-neutral-500 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
                게시글을 불러오는 중...
              </div>
            ) : isError ? (
              <div className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-neutral-500 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
                <p>네트워크 오류가 발생했어요.</p>
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="mt-3 rounded-full border border-neutral-200 bg-white px-4 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  다시 시도
                </button>
              </div>
            ) : sort === 'FOLLOWING' && isFollowingAuthorIdsLoading ? (
              <div className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-neutral-500 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
                팔로잉 목록을 불러오는 중...
              </div>
            ) : sort === 'FOLLOWING' && isFollowingAuthorIdsError ? (
              <div className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-neutral-500 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
                <p>팔로잉 목록을 불러오지 못했어요.</p>
                <button
                  type="button"
                  onClick={() => void refetchFollowingAuthorIds()}
                  className="mt-3 rounded-full border border-neutral-200 bg-white px-4 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  다시 시도
                </button>
              </div>
            ) : filteredPosts.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-neutral-500">
                {sort === 'FOLLOWING'
                  ? (followingAuthorIds?.length ?? 0) === 0
                    ? '아직 팔로우한 사용자가 없어요.'
                    : '팔로우한 사용자의 게시글이 없어요.'
                  : selectedTags.length > 0
                    ? '선택한 태그에 해당하는 글이 없어요.'
                    : '아직 게시글이 없어요.'}
              </p>
            ) : (
              <>
                {filteredPosts.map((post) => (
                  <BoardPostCard
                    key={post.postId}
                    post={post}
                    onClick={handlePostClick}
                    onAuthorClick={handleAuthorClick}
                  />
                ))}
                <div className="px-4 pt-2">
                  <ListLoadMoreSentinel
                    onLoadMore={() => void fetchNextPage()}
                    hasNextPage={hasNextPage ?? false}
                    isFetchingNextPage={isFetchingNextPage}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      <div className="fixed bottom-[calc(var(--bottom-nav-h)+16px)] left-1/2 z-50 w-full max-w-[430px] -translate-x-1/2 px-4 sm:px-6">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleCreatePost}
            className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-b from-[#1CD48A] to-[#05C075] text-white shadow-[0_12px_24px_rgba(5,192,117,0.35)] ring-1 ring-white/60 transition hover:scale-105 hover:from-[#2DE09A] hover:to-[#07B374] active:translate-y-0.5"
            aria-label="게시글 작성"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>

      <BoardUserMiniProfile
        open={isMiniProfileOpen}
        onClose={() => setIsMiniProfileOpen(false)}
        user={modalUser}
        isMine={isMine}
        isFollowing={isFollowing}
        isFollowPending={isFollowPending}
        onGoMyPage={() => {
          setIsMiniProfileOpen(false);
          requestNavigation(() => router.push('/profile'));
        }}
        onStartChat={() => {
          if (modalUserId === null || isMine) return;
          setIsMiniProfileOpen(false);
          const params = new URLSearchParams();
          params.set('targetUserId', String(modalUserId));
          params.set('from', 'board');
          if (modalUser?.nickname) {
            params.set('targetNickname', modalUser.nickname);
          }
          requestNavigation(() => router.push(`/chat?${params.toString()}`));
        }}
        onToggleFollow={() => void handleToggleFollow()}
      />
    </>
  );
}
