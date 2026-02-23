'use client';

import { useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { Bell, Heart, MessageCircle, Search, Share2 } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BoardUserMiniProfile from '@/components/board/BoardUserMiniProfile';
import BoardShareModal from '@/components/board/detail/BoardShareModal';
import CommentComposer from '@/components/board/detail/CommentComposer';
import CommentList from '@/components/board/detail/CommentList';
import PostContent from '@/components/board/detail/PostContent';
import PostHeader from '@/components/board/detail/PostHeader';
import ConfirmModal from '@/components/common/ConfirmModal';
import { useAppFrame } from '@/components/layout/AppFrameContext';
import { useHeader } from '@/components/layout/HeaderContext';
import { useNavigationGuard } from '@/components/layout/NavigationGuardContext';
import { deleteBoardPost, likeBoardPost, unlikeBoardPost } from '@/lib/api/boards';
import { fetchUserProfile } from '@/lib/api/users';
import { getUserIdFromAccessToken } from '@/lib/auth/token';
import { boardsKeys } from '@/lib/hooks/boards/queryKeys';
import { useBoardCommentsQuery } from '@/lib/hooks/boards/useBoardCommentsQuery';
import { useBoardDetailQuery } from '@/lib/hooks/boards/useBoardDetailQuery';
import { useCreateCommentMutation } from '@/lib/hooks/boards/useCreateCommentMutation';
import { useDeleteCommentMutation } from '@/lib/hooks/boards/useDeleteCommentMutation';
import { useUpdateCommentMutation } from '@/lib/hooks/boards/useUpdateCommentMutation';
import { userKeys } from '@/lib/hooks/users/queryKeys';
import { useFollowUserMutation } from '@/lib/hooks/users/useFollowUserMutation';
import { useUnfollowUserMutation } from '@/lib/hooks/users/useUnfollowUserMutation';
import { toast } from '@/lib/toast/store';
import { formatCountCompact } from '@/lib/utils/board';
import { groupCommentsByThread } from '@/lib/utils/comments';
import BoardPostDetailSkeleton from '@/screens/board/detail/BoardPostDetailSkeleton';

import type { BoardPostSummary } from '@/types/board';
import type { CommentItem, PostDetail } from '@/types/boardDetail';
import type { CursorPage } from '@/types/pagination';

export default function BoardDetailPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setOptions: setFrameOptions, resetOptions: resetFrameOptions } = useAppFrame();
  const { setOptions, resetOptions } = useHeader();
  const { requestNavigation } = useNavigationGuard();
  const searchParams = useSearchParams();
  const params = useParams();
  const postIdParam = Array.isArray(params?.postId) ? params?.postId[0] : params?.postId;
  const postId = postIdParam ? Number(postIdParam) : null;
  const currentUserId = getUserIdFromAccessToken();
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [likeOverride, setLikeOverride] = useState<{
    postId: number;
    isLiked: boolean;
    likeCount: number;
  } | null>(null);
  const [isLikePending, setIsLikePending] = useState(false);
  const optionsButtonRef = useRef<HTMLButtonElement>(null);
  const optionsMenuRef = useRef<HTMLDivElement>(null);
  const {
    data: post,
    isLoading,
    isError,
    refetch,
  } = useBoardDetailQuery(Number.isFinite(postId) ? postId : null);
  const {
    data: commentsPage,
    isLoading: isCommentsLoading,
    isError: isCommentsError,
    refetch: refetchComments,
  } = useBoardCommentsQuery(Number.isFinite(postId) ? postId : null, 50);
  const commentThreads = useMemo(
    () => groupCommentsByThread(commentsPage?.items ?? []),
    [commentsPage?.items],
  );
  const { mutateAsync: createComment, isPending: isCommentSubmitting } = useCreateCommentMutation();
  const { mutateAsync: deleteComment, isPending: isCommentDeleting } = useDeleteCommentMutation();
  const { mutateAsync: updateComment, isPending: isCommentUpdating } = useUpdateCommentMutation();
  const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState<number | null>(null);
  const [isCommentDeleteOpen, setIsCommentDeleteOpen] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [replyTargetId, setReplyTargetId] = useState<number | null>(null);
  const [isMiniProfileOpen, setIsMiniProfileOpen] = useState(false);
  const [selectedCommentAuthorId, setSelectedCommentAuthorId] = useState<number | null>(null);
  const [followStateOverrides, setFollowStateOverrides] = useState<Record<number, boolean>>({});
  const followMutation = useFollowUserMutation();
  const unfollowMutation = useUnfollowUserMutation();

  const handleSearchClick = useCallback(() => {
    requestNavigation(() => router.push('/board/search'));
  }, [requestNavigation, router]);

  const handleNotificationsClick = useCallback(() => {
    requestNavigation(() => router.push('/notifications'));
  }, [requestNavigation, router]);

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
          className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-neutral-100"
          aria-label="알림"
        >
          <Bell className="h-5 w-5" />
        </button>
      </div>
    ),
    [handleNotificationsClick, handleSearchClick],
  );

  const selectedAuthor = useMemo(() => {
    if (selectedCommentAuthorId === null) return null;

    if (post && post.author.userId === selectedCommentAuthorId) {
      return {
        userId: post.author.userId,
        nickname: post.author.nickname,
        profileImageUrl: post.author.profileImageUrl ?? null,
        interests: post.author.interests ?? [],
      };
    }

    for (const thread of commentThreads) {
      if (thread.comment.author.userId === selectedCommentAuthorId) {
        return {
          userId: thread.comment.author.userId,
          nickname: thread.comment.author.nickname,
          profileImageUrl: thread.comment.author.profileImageUrl ?? null,
          interests: [],
        };
      }

      const selectedReply = thread.replies.find(
        (reply) => reply.author.userId === selectedCommentAuthorId,
      );
      if (selectedReply) {
        return {
          userId: selectedReply.author.userId,
          nickname: selectedReply.author.nickname,
          profileImageUrl: selectedReply.author.profileImageUrl ?? null,
          interests: [],
        };
      }
    }

    return null;
  }, [commentThreads, post, selectedCommentAuthorId]);

  const { data: selectedAuthorProfile, refetch: refetchSelectedAuthorProfile } = useQuery({
    queryKey: userKeys.profile(selectedCommentAuthorId ?? -1),
    queryFn: async () => {
      const result = await fetchUserProfile(selectedCommentAuthorId!);

      if (!result.ok || !result.json) {
        throw new Error('Failed to fetch user profile');
      }

      if ('data' in result.json && result.json.data) {
        return result.json.data;
      }

      throw new Error('Invalid response format');
    },
    enabled: selectedCommentAuthorId !== null,
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

  const handleAuthorClick = (userId: number) => {
    setSelectedCommentAuthorId(userId);
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

  const handleBackClick = useCallback(() => {
    void queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === 'boards' && query.queryKey[1] === 'list',
    });

    const from = searchParams?.get('from');
    if (from === 'edit') {
      router.push('/board');
      return;
    }

    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/board');
  }, [queryClient, router, searchParams]);

  useEffect(() => {
    setFrameOptions({ showBottomNav: false });
    setOptions({
      title: '',
      showBackButton: true,
      onBackClick: handleBackClick,
      rightSlot,
    });

    return () => {
      resetOptions();
      resetFrameOptions();
    };
  }, [handleBackClick, resetFrameOptions, resetOptions, rightSlot, setFrameOptions, setOptions]);

  const isAuthor = Boolean(post && currentUserId !== null && currentUserId === post.author.userId);

  const handleOptionsToggle = () => {
    if (!isAuthor) return;
    setIsOptionsOpen((prev) => !prev);
  };

  const updateCommentCountCache = useCallback(
    (targetPostId: number, nextCount: number) => {
      queryClient.setQueryData<PostDetail>(boardsKeys.detail(targetPostId), (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          stats: {
            ...prev.stats,
            commentCount: nextCount,
          },
        };
      });

      queryClient.setQueriesData<InfiniteData<CursorPage<BoardPostSummary>>>(
        {
          predicate: (query) => query.queryKey[0] === 'boards' && query.queryKey[1] === 'list',
        },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.postId === targetPostId
                  ? {
                      ...item,
                      stats: {
                        ...item.stats,
                        commentCount: nextCount,
                      },
                    }
                  : item,
              ),
            })),
          };
        },
      );
    },
    [queryClient],
  );

  const updateLikeCache = useCallback(
    (targetPostId: number, nextLiked: boolean, nextCount: number) => {
      queryClient.setQueryData<PostDetail>(boardsKeys.detail(targetPostId), (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          isLiked: nextLiked,
          stats: {
            ...prev.stats,
            likeCount: nextCount,
          },
        };
      });

      queryClient.setQueriesData<InfiniteData<CursorPage<BoardPostSummary>>>(
        {
          predicate: (query) => query.queryKey[0] === 'boards' && query.queryKey[1] === 'list',
        },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.postId === targetPostId
                  ? {
                      ...item,
                      stats: {
                        ...item.stats,
                        likeCount: nextCount,
                      },
                    }
                  : item,
              ),
            })),
          };
        },
      );
    },
    [queryClient],
  );

  const updateCommentContentCache = useCallback(
    (targetPostId: number, targetCommentId: number, content: string) => {
      queryClient.setQueriesData<CursorPage<CommentItem>>(
        {
          predicate: (query) =>
            query.queryKey[0] === 'boards' &&
            query.queryKey[1] === 'comments' &&
            query.queryKey[2] === targetPostId,
        },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((item) =>
              item.commentId === targetCommentId ? { ...item, content } : item,
            ),
          };
        },
      );
    },
    [queryClient],
  );

  const handleLikeToggle = async () => {
    if (!post) return;
    if (isLikePending) return;

    const resolvedIsLiked =
      likeOverride?.postId === post.postId ? likeOverride.isLiked : post.isLiked;
    const resolvedLikeCount =
      likeOverride?.postId === post.postId ? likeOverride.likeCount : post.stats.likeCount;
    const nextLiked = !resolvedIsLiked;
    const nextCount = nextLiked ? resolvedLikeCount + 1 : Math.max(0, resolvedLikeCount - 1);

    const detailSnapshot = queryClient.getQueryData<PostDetail>(boardsKeys.detail(post.postId));
    const listSnapshots = queryClient.getQueriesData<InfiniteData<CursorPage<BoardPostSummary>>>({
      predicate: (query) => query.queryKey[0] === 'boards' && query.queryKey[1] === 'list',
    });

    setLikeOverride({ postId: post.postId, isLiked: nextLiked, likeCount: nextCount });
    setIsLikePending(true);
    updateLikeCache(post.postId, nextLiked, nextCount);

    try {
      if (nextLiked) {
        const result = await likeBoardPost(post.postId);
        if (result?.likeCount !== undefined) {
          updateLikeCache(post.postId, true, result.likeCount);
          setLikeOverride({
            postId: post.postId,
            isLiked: true,
            likeCount: result.likeCount,
          });
        }
      } else {
        await unlikeBoardPost(post.postId);
      }
    } catch (error) {
      setLikeOverride({
        postId: post.postId,
        isLiked: resolvedIsLiked,
        likeCount: resolvedLikeCount,
      });
      if (detailSnapshot) {
        queryClient.setQueryData(boardsKeys.detail(post.postId), detailSnapshot);
      }
      listSnapshots.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      toast(error instanceof Error ? error.message : '좋아요 처리에 실패했습니다.');
    } finally {
      setIsLikePending(false);
    }
  };

  const handleEditClick = () => {
    setIsOptionsOpen(false);
    if (!post) return;
    requestNavigation(() => router.push(`/board/${post.postId}/edit`));
  };

  const handleDeleteClick = () => {
    setIsOptionsOpen(false);
    setIsDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!post) return;
    try {
      await deleteBoardPost(post.postId);
      queryClient.setQueriesData<InfiniteData<CursorPage<BoardPostSummary>>>(
        {
          predicate: (query) => query.queryKey[0] === 'boards' && query.queryKey[1] === 'list',
        },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.filter((item) => item.postId !== post.postId),
            })),
          };
        },
      );
      toast('게시글이 삭제되었습니다.');
      setIsDeleteConfirmOpen(false);
      requestNavigation(() => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
          router.back();
          return;
        }
        router.push('/board');
      });
    } catch (error) {
      toast(error instanceof Error ? error.message : '게시글 삭제에 실패했습니다.');
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteConfirmOpen(false);
  };

  const handleShareOpen = () => {
    setIsShareOpen(true);
  };

  const handleShareClose = () => {
    setIsShareOpen(false);
  };

  const handleShareCopy = async () => {
    if (!shareUrl) {
      toast('공유 링크를 만들 수 없습니다.');
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!ok) {
          throw new Error('copy_failed');
        }
      }

      toast('링크가 복사되었습니다.');
      setIsShareOpen(false);
    } catch {
      toast('링크 복사에 실패했습니다.');
    }
  };

  const handleCommentDeleteOpen = (commentId: number) => {
    if (isCommentDeleting) return;
    setEditingCommentId(null);
    setReplyTargetId(null);
    setPendingDeleteCommentId(commentId);
    setIsCommentDeleteOpen(true);
  };

  const handleCommentDeleteCancel = () => {
    setPendingDeleteCommentId(null);
    setIsCommentDeleteOpen(false);
  };

  const handleCommentDeleteConfirm = async () => {
    if (!post || pendingDeleteCommentId === null) return;
    try {
      await deleteComment({ postId: post.postId, commentId: pendingDeleteCommentId });
      const detailSnapshot = queryClient.getQueryData<PostDetail>(boardsKeys.detail(post.postId));
      const nextCount = Math.max(
        0,
        (detailSnapshot?.stats.commentCount ?? post.stats.commentCount) - 1,
      );
      updateCommentCountCache(post.postId, nextCount);
      await refetchComments();
      toast('댓글이 삭제되었습니다.');
      setIsCommentDeleteOpen(false);
      setPendingDeleteCommentId(null);
    } catch (error) {
      toast(error instanceof Error ? error.message : '댓글 삭제에 실패했습니다.');
    }
  };

  const handleCommentEditOpen = (commentId: number, _content: string | null) => {
    if (isCommentDeleting) return;
    setPendingDeleteCommentId(null);
    setIsCommentDeleteOpen(false);
    setEditingCommentId(commentId);
    setReplyTargetId(null);
  };

  const handleCommentEditCancel = () => {
    setEditingCommentId(null);
  };

  const handleReplyToggle = (commentId: number) => {
    if (editingCommentId !== null || isCommentUpdating || isCommentDeleting) return;
    setPendingDeleteCommentId(null);
    setIsCommentDeleteOpen(false);
    setReplyTargetId((prev) => (prev === commentId ? null : commentId));
  };

  useEffect(() => {
    if (!isOptionsOpen) return;

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (optionsMenuRef.current?.contains(target)) return;
      if (optionsButtonRef.current?.contains(target)) return;
      setIsOptionsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOptionsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOptionsOpen]);

  if (isLoading) {
    return <BoardPostDetailSkeleton />;
  }

  if (isError || !post) {
    return (
      <main className="px-1 pt-0 pb-6 sm:px-2">
        <div className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-neutral-500 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <p>게시글을 불러오지 못했습니다.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-3 rounded-full border border-neutral-200 bg-white px-4 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            다시 시도
          </button>
        </div>
      </main>
    );
  }

  const resolvedIsLiked =
    likeOverride?.postId === post.postId ? likeOverride.isLiked : post.isLiked;
  const resolvedLikeCount =
    likeOverride?.postId === post.postId ? likeOverride.likeCount : post.stats.likeCount;
  const shareUrl =
    typeof window === 'undefined'
      ? ''
      : `${window.location.origin}/board/${encodeURIComponent(post.postId)}`;

  return (
    <>
      <main className="px-1 pt-4 pb-6 sm:px-2" style={{ paddingBottom: '84px' }}>
        <div className="space-y-3">
          <article className="border-b border-neutral-200 px-0 pt-3 pb-4">
            <div className="relative">
              <PostHeader
                author={post.author}
                createdAt={post.createdAt}
                onAuthorClick={handleAuthorClick}
                showOptions={isAuthor}
                onOptionsClick={handleOptionsToggle}
                optionsButtonRef={optionsButtonRef}
              />
              {isAuthor && isOptionsOpen ? (
                <div
                  ref={optionsMenuRef}
                  className="absolute top-9 right-0 z-10 w-32 rounded-xl border border-neutral-200 bg-white py-1 text-sm text-neutral-700 shadow-[0_10px_30px_rgba(15,23,42,0.12)]"
                >
                  <button
                    type="button"
                    onClick={handleEditClick}
                    className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-neutral-50"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteClick}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-red-500 hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
              ) : null}
            </div>
            <PostContent
              title={post.title}
              content={post.content}
              tags={post.tags}
              attachments={post.attachments}
            />

            <div className="mt-4 flex items-center gap-5 text-[11px] text-neutral-500">
              <button
                type="button"
                className={`flex items-center gap-1 ${
                  resolvedIsLiked ? 'text-[#05C075]' : 'text-neutral-500'
                }`}
                aria-label="좋아요"
                onClick={handleLikeToggle}
              >
                <Heart className={`h-3.5 w-3.5 ${resolvedIsLiked ? 'fill-[#05C075]' : ''}`} />
                <span>{formatCountCompact(resolvedLikeCount)}</span>
              </button>
              <div className="flex items-center gap-1">
                <MessageCircle className="h-3.5 w-3.5" />
                <span>{formatCountCompact(post.stats.commentCount)}</span>
              </div>
              <button
                type="button"
                className="flex items-center gap-1"
                aria-label="공유"
                onClick={handleShareOpen}
              >
                <Share2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </article>

          <div className="bg-[#F1F5F9] px-0 py-2 text-xs text-neutral-500">
            개인정보(연락처, 계좌번호 등) 공유에 주의하세요
          </div>

          <section className="space-y-2 px-0">
            <p className="text-sm font-semibold text-neutral-800">
              댓글 {formatCountCompact(post.stats.commentCount)}개
            </p>
            {isCommentsLoading ? (
              <p className="rounded-2xl bg-white px-4 py-4 text-center text-xs text-neutral-500">
                댓글을 불러오는 중...
              </p>
            ) : isCommentsError ? (
              <div className="rounded-2xl bg-white px-4 py-4 text-center text-xs text-neutral-500">
                <p>댓글을 불러오지 못했습니다.</p>
                <button
                  type="button"
                  onClick={() => void refetchComments()}
                  className="mt-3 rounded-full border border-neutral-200 bg-white px-3 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  다시 시도
                </button>
              </div>
            ) : (
              <CommentList
                threads={commentThreads}
                onAuthorClick={handleAuthorClick}
                onReplyClick={handleReplyToggle}
                currentUserId={currentUserId}
                onDeleteClick={handleCommentDeleteOpen}
                onEditClick={handleCommentEditOpen}
                isEditingCommentId={editingCommentId}
                disableActions={
                  editingCommentId !== null ||
                  isCommentUpdating ||
                  isCommentDeleting ||
                  isCommentDeleteOpen
                }
                renderEditor={(commentId, _content, depth) => (
                  <div className={depth === 2 ? 'ml-6' : undefined}>
                    <CommentComposer
                      className="mt-2"
                      defaultValue={_content ?? ''}
                      maxLength={500}
                      submitLabel="저장"
                      onCancel={handleCommentEditCancel}
                      isSubmitting={isCommentUpdating}
                      onSubmit={async (nextContent) => {
                        if (!post) return false;
                        const previousContent = _content ?? '';
                        updateCommentContentCache(post.postId, commentId, nextContent);
                        try {
                          await updateComment({
                            postId: post.postId,
                            commentId,
                            content: nextContent,
                          });
                          await refetchComments();
                          handleCommentEditCancel();
                          return true;
                        } catch (error) {
                          updateCommentContentCache(post.postId, commentId, previousContent);
                          toast(
                            error instanceof Error ? error.message : '댓글 수정에 실패했습니다.',
                          );
                          return false;
                        }
                      }}
                    />
                  </div>
                )}
                renderReplyEditor={(commentId) => (
                  <div className="ml-6">
                    <CommentComposer
                      className="mt-2"
                      placeholder="답글을 입력하세요..."
                      maxLength={500}
                      submitLabel="등록"
                      isSubmitting={isCommentSubmitting}
                      onCancel={() => setReplyTargetId(null)}
                      onSubmit={async (content) => {
                        if (!post) return false;
                        try {
                          await createComment({
                            postId: post.postId,
                            content,
                            parentId: commentId,
                          });
                          const detailSnapshot = queryClient.getQueryData<PostDetail>(
                            boardsKeys.detail(post.postId),
                          );
                          const nextCount =
                            (detailSnapshot?.stats.commentCount ?? post.stats.commentCount) + 1;
                          updateCommentCountCache(post.postId, nextCount);
                          await refetchComments();
                          setReplyTargetId(null);
                          return true;
                        } catch (error) {
                          toast(
                            error instanceof Error ? error.message : '답글 등록에 실패했습니다.',
                          );
                          return false;
                        }
                      }}
                    />
                  </div>
                )}
                replyTargetId={replyTargetId}
              />
            )}
          </section>
        </div>

        <ConfirmModal
          isOpen={isDeleteConfirmOpen}
          title="게시글 삭제"
          message="게시글을 삭제할까요? 삭제된 게시글은 복구할 수 없습니다."
          confirmText="삭제"
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
        <ConfirmModal
          isOpen={isCommentDeleteOpen}
          title="댓글 삭제"
          message="댓글을 삭제할까요? 삭제된 댓글은 복구할 수 없습니다."
          confirmText="삭제"
          onConfirm={handleCommentDeleteConfirm}
          onCancel={handleCommentDeleteCancel}
        />
      </main>
      <BoardShareModal
        open={isShareOpen}
        onClose={handleShareClose}
        shareUrl={shareUrl}
        onCopy={handleShareCopy}
      />
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
      <div className="fixed bottom-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 bg-white px-3 py-3 shadow-[0_-6px_16px_rgba(15,23,42,0.08)] sm:px-4">
        <CommentComposer
          className="mt-0"
          maxLength={500}
          isSubmitting={isCommentSubmitting}
          onSubmit={async (content) => {
            if (!post) return false;
            try {
              await createComment({ postId: post.postId, content });
              const detailSnapshot = queryClient.getQueryData<PostDetail>(
                boardsKeys.detail(post.postId),
              );
              const nextCount = (detailSnapshot?.stats.commentCount ?? post.stats.commentCount) + 1;
              updateCommentCountCache(post.postId, nextCount);
              await refetchComments();
              return true;
            } catch (error) {
              toast(error instanceof Error ? error.message : '댓글 등록에 실패했습니다.');
              return false;
            }
          }}
        />
      </div>
    </>
  );
}
