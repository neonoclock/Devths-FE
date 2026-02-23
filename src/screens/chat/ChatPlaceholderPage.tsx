'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef } from 'react';

import { useHeader } from '@/components/layout/HeaderContext';
import { useNavigationGuard } from '@/components/layout/NavigationGuardContext';
import ListLoadMoreSentinel from '@/components/llm/rooms/ListLoadMoreSentinel';
import { fetchChatRooms } from '@/lib/api/chatRooms';
import { chatKeys } from '@/lib/hooks/chat/queryKeys';
import { useChatRoomsInfiniteQuery } from '@/lib/hooks/chat/useChatRoomsInfiniteQuery';

import type { ChatRoomListResponse } from '@/lib/api/chatRooms';
import type { RejoinedRoomUiOverrideMap } from '@/lib/chat/rejoinedRoomUiCache';

const ROOM_PAGE_SIZE = 10;
const ROOM_NAME_MAX_LENGTH = 6;

function parseKstDateTime(value: string): Date {
  const normalized = value.includes(' ') ? value.replace(' ', 'T') : value;
  const hasTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(normalized);
  if (hasTimezone) {
    return new Date(normalized);
  }
  // Backend chat timestamps are currently serialized without timezone info but represent UTC.
  return new Date(`${normalized}Z`);
}

function formatRoomTime(isoString: string | null): string {
  if (!isoString) {
    return '';
  }

  const date = parseKstDateTime(isoString);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const now = new Date();
  const sameYear = now.getFullYear() === date.getFullYear();
  const sameMonth = now.getMonth() === date.getMonth();
  const sameDate = now.getDate() === date.getDate();

  if (sameYear && sameMonth && sameDate) {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    yesterday.getFullYear() === date.getFullYear() &&
    yesterday.getMonth() === date.getMonth() &&
    yesterday.getDate() === date.getDate();

  if (isYesterday) {
    return '어제';
  }

  if (sameYear) {
    return `${date.getMonth() + 1}월 ${date.getDate()}일`;
  }

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}

function truncateRoomName(title: string | null): string {
  const trimmed = title?.trim();
  if (!trimmed) {
    return '채팅방';
  }
  if (trimmed.length <= ROOM_NAME_MAX_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, ROOM_NAME_MAX_LENGTH)}…`;
}

function resolveTimestamp(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = parseKstDateTime(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.getTime();
}

type ChatRoomCard = ChatRoomListResponse['chatRooms'][number];

function compareRoomsByLastMessage(a: ChatRoomCard, b: ChatRoomCard): number {
  const aTimestamp = resolveTimestamp(a.lastMessageAt);
  const bTimestamp = resolveTimestamp(b.lastMessageAt);

  if (aTimestamp !== null && bTimestamp !== null && aTimestamp !== bTimestamp) {
    return bTimestamp - aTimestamp;
  }

  if (aTimestamp === null && bTimestamp !== null) {
    return 1;
  }

  if (aTimestamp !== null && bTimestamp === null) {
    return -1;
  }

  return b.roomId - a.roomId;
}

export default function ChatPlaceholderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { setOptions, resetOptions } = useHeader();
  const { requestNavigation } = useNavigationGuard();
  const handledTargetRouteRef = useRef<string | null>(null);
  const { data: roomUnreadFlags = {} } = useQuery<Record<number, boolean>>({
    queryKey: chatKeys.realtimeUnreadRooms(),
    queryFn: () =>
      queryClient.getQueryData<Record<number, boolean>>(chatKeys.realtimeUnreadRooms()) ?? {},
    enabled: false,
    initialData: {},
  });
  const { data: rejoinedRoomUiOverrides = {} } = useQuery<RejoinedRoomUiOverrideMap>({
    queryKey: chatKeys.rejoinedRoomUiOverrides(),
    queryFn: () =>
      queryClient.getQueryData<RejoinedRoomUiOverrideMap>(chatKeys.rejoinedRoomUiOverrides()) ?? {},
    enabled: false,
    initialData: {},
  });
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useChatRoomsInfiniteQuery({
      size: ROOM_PAGE_SIZE,
      type: 'PRIVATE',
    });

  const rooms = useMemo(() => {
    const merged = data?.pages.flatMap((page) => page.chatRooms) ?? [];
    const seen = new Set<number>();
    return merged
      .filter((room) => {
        if (seen.has(room.roomId)) {
          return false;
        }
        seen.add(room.roomId);
        return true;
      })
      .sort(compareRoomsByLastMessage);
  }, [data]);

  useEffect(() => {
    setOptions({
      title: '채팅',
      showBackButton: false,
    });

    return () => resetOptions();
  }, [resetOptions, setOptions]);

  useEffect(() => {
    queryClient.setQueryData<number>(chatKeys.realtimeUnread(), 0);
  }, [queryClient]);

  useEffect(() => {
    const targetUserIdParam = searchParams.get('targetUserId');
    if (!targetUserIdParam) {
      handledTargetRouteRef.current = null;
      return;
    }

    const targetUserId = Number(targetUserIdParam);
    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return;
    }

    const targetNickname = searchParams.get('targetNickname')?.trim() ?? '';
    const from = searchParams.get('from')?.trim() ?? '';
    const targetKey = `${targetUserId}:${targetNickname}:${from}`;
    if (handledTargetRouteRef.current === targetKey) {
      return;
    }
    handledTargetRouteRef.current = targetKey;

    let cancelled = false;

    const routeToTargetChat = async () => {
      if (!targetNickname) {
        const params = new URLSearchParams();
        params.set('targetUserId', String(targetUserId));
        if (from) {
          params.set('from', from);
        }
        requestNavigation(() => router.push(`/chat/new?${params.toString()}`));
        return;
      }

      const normalizedTargetNickname = targetNickname.trim();
      let cursor: ChatRoomListResponse['cursor'] = null;
      let matchedRoomId: number | null = null;

      do {
        const result = await fetchChatRooms({
          type: 'PRIVATE',
          size: 100,
          cursor,
        });

        const page = result.ok && result.json && 'data' in result.json ? result.json.data : null;
        if (!page) {
          break;
        }

        const matchedRoom = page.chatRooms.find(
          (room) => room.title?.trim() === normalizedTargetNickname,
        );

        if (matchedRoom) {
          matchedRoomId = matchedRoom.roomId;
          break;
        }

        if (!page.hasNext || !page.cursor) {
          break;
        }

        cursor = page.cursor;
      } while (!cancelled);

      if (cancelled) {
        return;
      }

      if (matchedRoomId !== null) {
        const params = new URLSearchParams();
        if (from) {
          params.set('from', from);
        }
        const suffix = params.toString();
        requestNavigation(() => router.push(`/chat/${matchedRoomId}${suffix ? `?${suffix}` : ''}`));
        return;
      }

      const params = new URLSearchParams();
      params.set('targetUserId', String(targetUserId));
      params.set('targetNickname', normalizedTargetNickname);
      if (from) {
        params.set('from', from);
      }
      requestNavigation(() => router.push(`/chat/new?${params.toString()}`));
    };

    void routeToTargetChat();

    return () => {
      cancelled = true;
    };
  }, [requestNavigation, router, searchParams]);

  return (
    <>
      <main className="px-3 pt-4 pb-24">
        <section className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
          <p className="text-sm font-semibold text-neutral-900">참여중인 채팅방 목록</p>
          <span className="mt-2 inline-flex rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-white">
            개인
          </span>
        </section>

        {isLoading ? (
          <div className="mt-4 flex h-[40vh] items-center justify-center rounded-2xl border border-neutral-200 bg-white text-sm text-neutral-500">
            채팅방 목록을 불러오는 중입니다...
          </div>
        ) : null}

        {!isLoading && isError ? (
          <div className="mt-4 flex h-[40vh] flex-col items-center justify-center gap-3 rounded-2xl border border-neutral-200 bg-white">
            <p className="text-sm font-semibold text-neutral-900">
              채팅방 목록을 불러올 수 없습니다
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white"
            >
              다시 시도
            </button>
          </div>
        ) : null}

        {!isLoading && !isError && rooms.length === 0 ? (
          <div className="mt-4 flex h-[40vh] items-center justify-center rounded-2xl border border-neutral-200 bg-white text-sm text-neutral-500">
            참여 중인 채팅방이 없습니다
          </div>
        ) : null}

        {!isLoading && !isError && rooms.length > 0 ? (
          <section className="mt-3 space-y-2">
            {rooms.map((room) => {
              const rejoinedUiOverride = rejoinedRoomUiOverrides[room.roomId];
              const shouldHideLastMessagePreview = Boolean(
                rejoinedUiOverride?.hideLastMessagePreview,
              );
              const previewText = shouldHideLastMessagePreview
                ? '최근 채팅방 내용이 없습니다.'
                : room.lastMessageContent?.trim() || '최근 채팅방 내용이 없습니다.';
              const formattedTime = shouldHideLastMessagePreview
                ? ''
                : formatRoomTime(room.lastMessageAt);
              const showUnreadDot = Boolean(roomUnreadFlags[room.roomId]);
              const roomProfileImage =
                rejoinedUiOverride?.profileImage ?? room.profileImage ?? null;

              return (
                <button
                  key={room.roomId}
                  type="button"
                  onClick={() => requestNavigation(() => router.push(`/chat/${room.roomId}`))}
                  className="flex w-full items-start gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-left transition hover:bg-neutral-50"
                >
                  {roomProfileImage ? (
                    <Image
                      src={roomProfileImage}
                      alt={`${truncateRoomName(room.title)} 프로필`}
                      width={48}
                      height={48}
                      className="mt-0.5 h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="mt-0.5 h-12 w-12 rounded-full bg-neutral-200" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-neutral-900">
                      {truncateRoomName(room.title)}
                    </p>
                    <p className="mt-1 truncate text-sm text-neutral-500">{previewText}</p>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {showUnreadDot ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                    ) : null}
                    <span className="text-[11px] text-neutral-400">{formattedTime}</span>
                  </div>
                </button>
              );
            })}

            <ListLoadMoreSentinel
              onLoadMore={() => void fetchNextPage()}
              hasNextPage={hasNextPage ?? false}
              isFetchingNextPage={isFetchingNextPage}
              loadingText="채팅방을 더 불러오는 중..."
              hasNextText="스크롤하면 더 볼 수 있습니다"
              endText=""
            />
          </section>
        ) : null}
      </main>

      <div className="pointer-events-none fixed bottom-20 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 px-4">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => requestNavigation(() => router.push('/chat/new'))}
            aria-label="채팅방 생성"
            className="pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-b from-[#1CD48A] to-[#05C075] text-white shadow-[0_12px_24px_rgba(5,192,117,0.35)] ring-1 ring-white/60 transition hover:scale-105 hover:from-[#2DE09A] hover:to-[#07B374] active:translate-y-0.5"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>
    </>
  );
}
