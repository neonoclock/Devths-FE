'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Check, Search } from 'lucide-react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import { useHeader } from '@/components/layout/HeaderContext';
import ListLoadMoreSentinel from '@/components/llm/rooms/ListLoadMoreSentinel';
import { applyRejoinedRoomUiOverride } from '@/lib/chat/rejoinedRoomUiCache';
import { useCreatePrivateRoomMutation } from '@/lib/hooks/chat/useCreatePrivateRoomMutation';
import { useMyFollowingsInfiniteQuery } from '@/lib/hooks/chat/useMyFollowingsInfiniteQuery';
import { toast } from '@/lib/toast/store';

import type { ChatFollowingSummaryResponse } from '@/lib/api/chatFollowings';

const MIN_NICKNAME_LENGTH = 2;
const MAX_NICKNAME_LENGTH = 10;

function sortByNickname(a: ChatFollowingSummaryResponse, b: ChatFollowingSummaryResponse) {
  const nicknameCompare = a.nickname.localeCompare(b.nickname, 'ko');
  if (nicknameCompare !== 0) {
    return nicknameCompare;
  }

  return a.userId - b.userId;
}

export default function ChatCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { setOptions, resetOptions } = useHeader();
  const [inputValue, setInputValue] = useState('');
  const [submittedNickname, setSubmittedNickname] = useState<string | undefined>(undefined);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [successModal, setSuccessModal] = useState<{
    roomId: number;
    message: string;
  } | null>(null);
  const createPrivateRoomMutation = useCreatePrivateRoomMutation();
  const initializedFromQueryRef = useRef(false);
  const routeSource = searchParams.get('from');
  const createBackPath =
    routeSource === 'notifications'
      ? '/notifications'
      : routeSource === 'board'
        ? '/board'
        : '/chat';

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMyFollowingsInfiniteQuery({ submittedNickname });

  const followings = useMemo(() => {
    const merged = data?.pages.flatMap((page) => page.followings) ?? [];
    const byUserId = new Map<number, ChatFollowingSummaryResponse>();

    for (const following of merged) {
      if (!byUserId.has(following.userId)) {
        byUserId.set(following.userId, following);
      }
    }

    return Array.from(byUserId.values()).sort(sortByNickname);
  }, [data]);

  const activeSelectedUserId = useMemo(() => {
    if (selectedUserId === null) {
      return null;
    }

    const hasSelectedUser = followings.some((following) => following.userId === selectedUserId);
    return hasSelectedUser ? selectedUserId : null;
  }, [followings, selectedUserId]);

  const selectedFollowing = useMemo(
    () =>
      activeSelectedUserId === null
        ? null
        : (followings.find((following) => following.userId === activeSelectedUserId) ?? null),
    [activeSelectedUserId, followings],
  );

  useEffect(() => {
    if (initializedFromQueryRef.current) {
      return;
    }

    const targetUserIdParam = searchParams.get('targetUserId');
    const targetNicknameParam = searchParams.get('targetNickname')?.trim() ?? '';

    const targetUserId = targetUserIdParam ? Number(targetUserIdParam) : null;
    if (targetUserId !== null && Number.isInteger(targetUserId) && targetUserId > 0) {
      setSelectedUserId(targetUserId);
    }

    if (targetNicknameParam) {
      setInputValue(targetNicknameParam);
      setSubmittedNickname(targetNicknameParam);
    }

    initializedFromQueryRef.current = true;
  }, [searchParams]);

  useEffect(() => {
    setOptions({
      title: '채팅방 생성',
      showBackButton: true,
      onBackClick: () => {
        router.replace(createBackPath);
      },
    });

    return () => resetOptions();
  }, [createBackPath, resetOptions, router, setOptions]);

  useEffect(() => {
    if (!successModal) {
      return;
    }

    const timer = window.setTimeout(() => {
      const { roomId } = successModal;
      setSuccessModal(null);
      const params = new URLSearchParams();
      if (routeSource) {
        params.set('from', routeSource);
      }
      const suffix = params.toString();
      router.push(`/chat/${roomId}${suffix ? `?${suffix}` : ''}`);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [routeSource, router, successModal]);

  const handleSearch = useCallback(() => {
    const trimmed = inputValue.trim();

    if (!trimmed) {
      toast('검색어를 입력해 주세요.');
      return;
    }

    if (trimmed.length < MIN_NICKNAME_LENGTH) {
      toast(`검색어는 ${MIN_NICKNAME_LENGTH}자 이상 입력해 주세요.`);
      return;
    }

    if (trimmed.length > MAX_NICKNAME_LENGTH) {
      toast(`검색어는 ${MAX_NICKNAME_LENGTH}자 이하로 입력해 주세요.`);
      return;
    }

    if (submittedNickname === trimmed) {
      void refetch();
      return;
    }

    setSubmittedNickname(trimmed);
    setSelectedUserId(null);
  }, [inputValue, refetch, submittedNickname]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleSearch();
  };

  const handleSelectUser = (userId: number) => {
    if (activeSelectedUserId === userId) {
      setSelectedUserId(null);
      return;
    }

    if (activeSelectedUserId !== null && activeSelectedUserId !== userId) {
      toast('1명만 선택할 수 있습니다.');
      return;
    }

    setSelectedUserId(userId);
  };

  const handleComplete = async () => {
    if (activeSelectedUserId === null) {
      toast('채팅할 유저를 1명 선택해 주세요.');
      return;
    }

    if (createPrivateRoomMutation.isPending) {
      return;
    }

    try {
      const result = await createPrivateRoomMutation.mutateAsync({
        userId: activeSelectedUserId,
      });
      const responseData = result.json && 'data' in result.json ? result.json.data : null;

      if (!responseData) {
        throw new Error('Invalid response');
      }

      if (!responseData.isNew) {
        applyRejoinedRoomUiOverride(
          queryClient,
          responseData.roomId,
          selectedFollowing?.profileImage ?? null,
        );
      }

      setSuccessModal({
        roomId: responseData.roomId,
        message: responseData.isNew ? '채팅방이 생성되었습니다.' : '기존 채팅방으로 이동합니다.',
      });
    } catch (error) {
      const err = error as Error & { serverMessage?: string };
      toast(err.serverMessage ?? '채팅방 생성에 실패했습니다.');
    }
  };

  const isCompleteEnabled = !createPrivateRoomMutation.isPending && activeSelectedUserId !== null;

  return (
    <main className="px-4 pt-4 pb-24">
      <section>
        <p className="px-1 text-sm font-semibold text-[#191F28]">유저 검색</p>
        <form onSubmit={handleSearchSubmit} className="mt-2">
          <div className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3">
            <input
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="이름을 입력하세요"
              className="h-6 w-full border-0 bg-transparent text-sm text-[#191F28] outline-none placeholder:text-[#8B95A1]"
              maxLength={MAX_NICKNAME_LENGTH}
            />
            <button
              type="submit"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#00C473]/10 text-[#00C473] transition hover:bg-[#00C473]/15"
              aria-label="유저 검색"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
        </form>
      </section>

      <section className="mt-6">
        <p className="px-1 text-sm font-semibold text-[#191F28]">
          팔로잉 유저 목록 <span className="text-red-500">*</span>
        </p>

        {isLoading ? (
          <div className="mt-3 space-y-1.5">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 rounded-2xl px-2 py-3">
                <div className="h-10 w-10 animate-pulse rounded-full bg-neutral-200" />
                <div className="h-4 w-28 animate-pulse rounded bg-neutral-200" />
              </div>
            ))}
          </div>
        ) : null}

        {!isLoading && isError ? (
          <div className="mt-4 px-2 py-8 text-center">
            <p className="text-sm text-[#6B7684]">팔로잉 목록을 불러오지 못했습니다.</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-3 rounded-xl bg-[#191F28] px-4 py-2 text-xs font-semibold text-white"
            >
              다시 시도
            </button>
          </div>
        ) : null}

        {!isLoading && !isError && followings.length === 0 ? (
          <p className="mt-4 px-2 py-8 text-center text-sm text-[#8B95A1]">
            조건에 맞는 팔로잉 유저가 없습니다.
          </p>
        ) : null}

        {!isLoading && !isError && followings.length > 0 ? (
          <div className="mt-2">
            <ul className="divide-y divide-neutral-200">
              {followings.map((following) => {
                const isSelected = activeSelectedUserId === following.userId;
                return (
                  <li key={following.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectUser(following.userId)}
                      className={[
                        'flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left transition',
                        isSelected ? 'bg-[#00C473]/5' : 'hover:bg-neutral-50',
                      ].join(' ')}
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
                        <div className="h-10 w-10 rounded-full bg-neutral-200" />
                      )}

                      <p className="min-w-0 flex-1 truncate text-sm font-medium text-[#191F28]">
                        {following.nickname}
                      </p>

                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full border transition ${
                          isSelected
                            ? 'border-[#00C473] bg-white text-[#00C473]'
                            : 'border-neutral-300 bg-white text-transparent'
                        }`}
                        aria-hidden="true"
                      >
                        <Check className="h-4 w-4" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <ListLoadMoreSentinel
              onLoadMore={() => void fetchNextPage()}
              hasNextPage={hasNextPage ?? false}
              isFetchingNextPage={isFetchingNextPage}
              loadingText="팔로잉 유저를 더 불러오는 중..."
              hasNextText="스크롤하면 더 볼 수 있습니다"
              endText=""
            />
          </div>
        ) : null}
      </section>

      <section className="mt-6">
        <button
          type="button"
          onClick={handleComplete}
          disabled={!isCompleteEnabled}
          className={[
            'block h-14 w-full rounded-2xl text-[17px] font-semibold text-white transition-colors',
            isCompleteEnabled
              ? 'bg-[#00C473] active:bg-[#00A85F]'
              : 'cursor-not-allowed bg-[#C8CDD2]',
          ].join(' ')}
        >
          {createPrivateRoomMutation.isPending ? '생성 중...' : '완료'}
        </button>
      </section>

      {successModal ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/45" />
          <div className="relative z-10 mx-4 w-full max-w-[280px] rounded-2xl bg-white px-5 py-6 text-center shadow-xl">
            <p className="text-base font-semibold text-neutral-900">{successModal.message}</p>
          </div>
        </div>
      ) : null}
    </main>
  );
}
