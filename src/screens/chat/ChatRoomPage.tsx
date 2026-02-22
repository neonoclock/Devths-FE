'use client';

import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Menu } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';

import ConfirmModal from '@/components/common/ConfirmModal';
import { useHeader } from '@/components/layout/HeaderContext';
import { fetchMyFollowings } from '@/lib/api/users';
import { getUserIdFromAccessToken } from '@/lib/auth/token';
import { applyRealtimeRoomMessage } from '@/lib/chat/realtimeMessageCache';
import { applyRealtimeRoomNotification } from '@/lib/chat/realtimeRoomCache';
import { chatStompManager } from '@/lib/chat/stompManager';
import { chatKeys } from '@/lib/hooks/chat/queryKeys';
import { useChatMessagesInfiniteQuery } from '@/lib/hooks/chat/useChatMessagesInfiniteQuery';
import { useChatRoomDetailQuery } from '@/lib/hooks/chat/useChatRoomDetailQuery';
import { useChatSubscriptions } from '@/lib/hooks/chat/useChatSubscriptions';
import { useCreatePrivateRoomMutation } from '@/lib/hooks/chat/useCreatePrivateRoomMutation';
import { useDeleteMessageMutation } from '@/lib/hooks/chat/useDeleteMessageMutation';
import { useLeaveChatRoomMutation } from '@/lib/hooks/chat/useLeaveChatRoomMutation';
import { usePatchLastReadMutation } from '@/lib/hooks/chat/usePatchLastReadMutation';
import { usePutRoomSettingsMutation } from '@/lib/hooks/chat/usePutRoomSettingsMutation';
import { useFollowUserMutation } from '@/lib/hooks/users/useFollowUserMutation';
import { useUnfollowUserMutation } from '@/lib/hooks/users/useUnfollowUserMutation';
import { toast } from '@/lib/toast/store';

import type { ChatMessageResponse, SendChatMessagePayload } from '@/lib/api/chatMessages';
import type { IMessage } from '@stomp/stompjs';

type ChatRoomPageProps = Readonly<{
  roomId: number | null;
}>;

type ParticipantUser = Readonly<{
  userId: number;
  nickname: string;
  profileImage: string | null;
}>;

const MESSAGE_PAGE_SIZE = 20;
const LONG_MESSAGE_THRESHOLD = 300;
const TOP_FETCH_THRESHOLD = 80;
const BOTTOM_CONFIRM_THRESHOLD = 32;
const DELETE_LONG_PRESS_MS = 2000;
const MESSAGE_SEND_DESTINATION = '/app/chat/message';

function resolveTitle(roomName: string | null, title: string | null) {
  const trimmedRoomName = roomName?.trim();
  if (trimmedRoomName) {
    return trimmedRoomName;
  }

  const trimmedTitle = title?.trim();
  if (trimmedTitle) {
    return trimmedTitle;
  }

  return '채팅방';
}

function parseKstDateTime(value: string): Date {
  const normalized = value.includes(' ') ? value.replace(' ', 'T') : value;
  const hasTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(normalized);
  if (hasTimezone) {
    return new Date(normalized);
  }

  // Backend chat timestamps are currently serialized without timezone info but represent UTC.
  return new Date(`${normalized}Z`);
}

function formatDateKey(value: string): string {
  const date = parseKstDateTime(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatStickyDateLabel(value: string): string {
  const date = parseKstDateTime(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

function formatMessageTime(value: string): string {
  const date = parseKstDateTime(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function resolveMessageContent(message: ChatMessageResponse): string {
  if (message.type === 'IMAGE') {
    return '[이미지]';
  }

  if (message.type === 'FILE') {
    return '[파일]';
  }

  return message.content ?? '';
}

function resolveLastMessagePreview(message: ChatMessageResponse): string {
  const preview = resolveMessageContent(message).trim();
  return preview || '(내용 없음)';
}

function parseStompJson<T>(body: string): T | null {
  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}

export default function ChatRoomPage({ roomId }: ChatRoomPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setOptions, resetOptions } = useHeader();
  const { data, isLoading, isError, refetch } = useChatRoomDetailQuery(roomId);
  const currentUserId = getUserIdFromAccessToken();
  const [messageInput, setMessageInput] = useState('');
  const [expandedMessageIds, setExpandedMessageIds] = useState<Set<number>>(new Set());
  const [deleteTargetMessageId, setDeleteTargetMessageId] = useState<number | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false);
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);
  const [roomNameInput, setRoomNameInput] = useState('');
  const [isAlarmOnInput, setIsAlarmOnInput] = useState(true);
  const [followingUserIds, setFollowingUserIds] = useState<Set<number>>(new Set());
  const [followStateOverrides, setFollowStateOverrides] = useState<Record<number, boolean>>({});
  const [activeParticipantUserId, setActiveParticipantUserId] = useState<number | null>(null);
  const [isFollowingsLoading, setIsFollowingsLoading] = useState(false);
  const hasLoadedFollowingsRef = useRef(false);
  const messageListRef = useRef<HTMLDivElement>(null);
  const unreadDividerRef = useRef<HTMLDivElement>(null);
  const deleteLongPressTimerRef = useRef<number | null>(null);
  const hasInitialScrollRef = useRef(false);
  const isLoadingOlderRef = useRef(false);
  const prevScrollHeightRef = useRef(0);
  const hasPatchedOnEntryRef = useRef(false);
  const lastPatchedMsgIdRef = useRef<number | null>(null);
  const patchLastReadMutation = usePatchLastReadMutation(roomId ?? 0);
  const deleteMessageMutation = useDeleteMessageMutation(roomId ?? 0);
  const putRoomSettingsMutation = usePutRoomSettingsMutation(roomId ?? 0);
  const leaveChatRoomMutation = useLeaveChatRoomMutation(roomId ?? 0);
  const createPrivateRoomMutation = useCreatePrivateRoomMutation();
  const followUserMutation = useFollowUserMutation();
  const unfollowUserMutation = useUnfollowUserMutation();

  const {
    data: messageData,
    isLoading: isMessagesLoading,
    isError: isMessagesError,
    refetch: refetchMessages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useChatMessagesInfiniteQuery({
    roomId: roomId ?? 0,
    size: MESSAGE_PAGE_SIZE,
  });

  const headerTitle = useMemo(
    () => resolveTitle(data?.roomName ?? null, data?.title ?? null),
    [data?.roomName, data?.title],
  );

  const messages = useMemo(() => {
    const pages = messageData?.pages ?? [];
    const merged = [...pages].reverse().flatMap((page) => page.messages);
    const seen = new Set<number>();

    return merged.filter((message) => {
      if (seen.has(message.messageId)) {
        return false;
      }
      seen.add(message.messageId);
      return true;
    });
  }, [messageData?.pages]);

  const serverLastReadMsgId = messageData?.pages[0]?.lastReadMsgId ?? null;
  const latestMessageId = messages.length > 0 ? messages[messages.length - 1].messageId : null;
  const unreadStartIndex = useMemo(() => {
    if (serverLastReadMsgId === null) {
      return -1;
    }

    return messages.findIndex((message) => message.messageId > serverLastReadMsgId);
  }, [messages, serverLastReadMsgId]);

  const participants = useMemo<ParticipantUser[]>(() => {
    const participantMap = new Map<number, ParticipantUser>();

    for (const message of messages) {
      if (!message.sender) {
        continue;
      }

      const participant = participantMap.get(message.sender.userId);
      if (!participant) {
        participantMap.set(message.sender.userId, {
          userId: message.sender.userId,
          nickname: message.sender.nickname,
          profileImage: message.sender.profileImage,
        });
      }
    }

    return Array.from(participantMap.values()).sort((a, b) => {
      if (currentUserId !== null) {
        if (a.userId === currentUserId && b.userId !== currentUserId) return -1;
        if (a.userId !== currentUserId && b.userId === currentUserId) return 1;
      }

      const nicknameCompare = a.nickname.localeCompare(b.nickname, 'ko');
      if (nicknameCompare !== 0) {
        return nicknameCompare;
      }

      return a.userId - b.userId;
    });
  }, [currentUserId, messages]);

  const isPrivateRoom = data?.type === 'PRIVATE';

  const toggleExpandedMessage = useCallback((messageId: number) => {
    setExpandedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  }, []);

  const patchLastReadOnce = useCallback(
    (targetMessageId: number) => {
      if (roomId === null) {
        return;
      }

      if (targetMessageId <= 0 || patchLastReadMutation.isPending) {
        return;
      }

      if (lastPatchedMsgIdRef.current !== null && targetMessageId <= lastPatchedMsgIdRef.current) {
        return;
      }

      patchLastReadMutation.mutate(targetMessageId, {
        onSuccess: () => {
          lastPatchedMsgIdRef.current = targetMessageId;
        },
      });
    },
    [patchLastReadMutation, roomId],
  );

  const handleRealtimeRoomMessage = useCallback(
    (frame: IMessage) => {
      if (roomId === null) {
        return;
      }

      const incomingMessage = parseStompJson<ChatMessageResponse>(frame.body);
      if (!incomingMessage || typeof incomingMessage.messageId !== 'number') {
        return;
      }

      const roomUpdated = applyRealtimeRoomNotification(queryClient, {
        roomId,
        lastMessageContent: resolveLastMessagePreview(incomingMessage),
        lastMessageAt: incomingMessage.createdAt,
      });
      if (!roomUpdated) {
        void queryClient.invalidateQueries({ queryKey: chatKeys.rooms() });
      }

      const container = messageListRef.current;
      const shouldStickToBottom =
        !container ||
        container.scrollHeight - (container.scrollTop + container.clientHeight) <=
          BOTTOM_CONFIRM_THRESHOLD;

      applyRealtimeRoomMessage(queryClient, {
        roomId,
        size: MESSAGE_PAGE_SIZE,
        message: incomingMessage,
      });

      if (shouldStickToBottom) {
        requestAnimationFrame(() => {
          const updatedContainer = messageListRef.current;
          if (!updatedContainer) {
            return;
          }

          updatedContainer.scrollTop = updatedContainer.scrollHeight;
          patchLastReadOnce(incomingMessage.messageId);
        });
      }
    },
    [patchLastReadOnce, queryClient, roomId],
  );

  const handleSendMessage = useCallback(
    (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();

      if (roomId === null) {
        return;
      }

      const trimmedContent = messageInput.trim();
      if (!trimmedContent) {
        return;
      }

      const payload: SendChatMessagePayload = {
        roomId,
        type: 'TEXT',
        content: trimmedContent,
        s3Key: null,
      };

      const published = chatStompManager.publishJson(MESSAGE_SEND_DESTINATION, payload);
      if (!published) {
        toast('메시지 전송에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }

      setMessageInput('');
    },
    [messageInput, roomId],
  );

  useChatSubscriptions({
    enabled: roomId !== null,
    roomId,
    userId: null,
    onRoomMessage: handleRealtimeRoomMessage,
  });

  const clearDeleteLongPressTimer = useCallback(() => {
    if (deleteLongPressTimerRef.current !== null) {
      window.clearTimeout(deleteLongPressTimerRef.current);
      deleteLongPressTimerRef.current = null;
    }
  }, []);

  const startDeleteLongPress = useCallback(
    (messageId: number) => {
      clearDeleteLongPressTimer();
      deleteLongPressTimerRef.current = window.setTimeout(() => {
        setDeleteTargetMessageId(messageId);
      }, DELETE_LONG_PRESS_MS);
    },
    [clearDeleteLongPressTimer],
  );

  const handleDeleteMessage = useCallback(async () => {
    if (deleteTargetMessageId === null || deleteMessageMutation.isPending) {
      return;
    }

    try {
      await deleteMessageMutation.mutateAsync(deleteTargetMessageId);
      toast('메시지가 삭제되었습니다.');
      setDeleteTargetMessageId(null);
    } catch (error) {
      const err = error as Error & { serverMessage?: string };
      toast(err.serverMessage ?? '메시지 삭제에 실패했습니다.');
    }
  }, [deleteMessageMutation, deleteTargetMessageId]);

  const loadMyFollowings = useCallback(async () => {
    if (isFollowingsLoading) {
      return;
    }

    setIsFollowingsLoading(true);
    try {
      const ids = new Set<number>();
      let lastId: number | null | undefined = undefined;

      while (true) {
        const result = await fetchMyFollowings({
          size: 100,
          lastId,
        });

        if (!result.ok || !result.json || !('data' in result.json) || !result.json.data) {
          throw new Error('팔로잉 목록 조회 실패');
        }

        for (const following of result.json.data.followings) {
          ids.add(following.userId);
        }

        if (!result.json.data.hasNext || result.json.data.lastId === null) {
          break;
        }

        lastId = result.json.data.lastId;
      }

      setFollowingUserIds(ids);
      hasLoadedFollowingsRef.current = true;
    } catch {
      toast('팔로우 상태를 불러오지 못했습니다.');
    } finally {
      setIsFollowingsLoading(false);
    }
  }, [isFollowingsLoading]);

  const isParticipantFollowing = useCallback(
    (userId: number) => {
      if (followStateOverrides[userId] !== undefined) {
        return followStateOverrides[userId];
      }
      return followingUserIds.has(userId);
    },
    [followStateOverrides, followingUserIds],
  );

  const handleToggleParticipantFollow = useCallback(
    async (userId: number) => {
      if (activeParticipantUserId !== null) {
        return;
      }

      const currentlyFollowing = isParticipantFollowing(userId);
      setActiveParticipantUserId(userId);

      try {
        if (currentlyFollowing) {
          await unfollowUserMutation.mutateAsync(userId);
          setFollowStateOverrides((prev) => ({ ...prev, [userId]: false }));
          setFollowingUserIds((prev) => {
            const next = new Set(prev);
            next.delete(userId);
            return next;
          });
          toast('언팔로우했습니다.');
        } else {
          await followUserMutation.mutateAsync(userId);
          setFollowStateOverrides((prev) => ({ ...prev, [userId]: true }));
          setFollowingUserIds((prev) => {
            const next = new Set(prev);
            next.add(userId);
            return next;
          });
          toast('팔로우했습니다.');
        }
      } catch (error) {
        const err = error as Error & { serverMessage?: string };
        toast(err.serverMessage ?? '팔로우 처리에 실패했습니다.');
      } finally {
        setActiveParticipantUserId(null);
      }
    },
    [activeParticipantUserId, followUserMutation, isParticipantFollowing, unfollowUserMutation],
  );

  const handleCreatePrivateChatWithParticipant = useCallback(
    async (userId: number) => {
      if (activeParticipantUserId !== null) {
        return;
      }

      setActiveParticipantUserId(userId);
      try {
        const result = await createPrivateRoomMutation.mutateAsync({ userId });
        const responseData = result.json && 'data' in result.json ? result.json.data : null;

        if (!responseData) {
          throw new Error('Invalid response');
        }

        setIsParticipantsModalOpen(false);
        setIsSettingsOpen(false);
        router.push(`/chat/${responseData.roomId}`);
      } catch (error) {
        const err = error as Error & { serverMessage?: string };
        toast(err.serverMessage ?? '1:1 채팅방 이동에 실패했습니다.');
      } finally {
        setActiveParticipantUserId(null);
      }
    },
    [activeParticipantUserId, createPrivateRoomMutation, router],
  );

  const handleOpenParticipantsModal = useCallback(() => {
    setIsParticipantsModalOpen(true);
    if (!hasLoadedFollowingsRef.current) {
      void loadMyFollowings();
    }
  }, [loadMyFollowings]);

  const handleSaveRoomSettings = useCallback(async () => {
    if (roomId === null || putRoomSettingsMutation.isPending) {
      return;
    }

    const trimmedRoomName = roomNameInput.trim();

    try {
      await putRoomSettingsMutation.mutateAsync({
        isAlarmOn: isAlarmOnInput,
        roomName: isPrivateRoom ? undefined : trimmedRoomName || undefined,
      });
      toast('채팅방 설정이 저장되었습니다.');
      setIsSettingsOpen(false);
    } catch (error) {
      const err = error as Error & { serverMessage?: string };
      toast(err.serverMessage ?? '채팅방 설정 저장에 실패했습니다.');
    }
  }, [isAlarmOnInput, isPrivateRoom, putRoomSettingsMutation, roomId, roomNameInput]);

  const handleLeaveChatRoom = useCallback(async () => {
    if (roomId === null || leaveChatRoomMutation.isPending) {
      return;
    }

    try {
      await leaveChatRoomMutation.mutateAsync();
      setIsLeaveConfirmOpen(false);
      setIsSettingsOpen(false);
      toast('채팅방에서 나갔습니다.');
      router.push('/chat');
    } catch (error) {
      const err = error as Error & { serverMessage?: string };
      toast(err.serverMessage ?? '채팅방 나가기에 실패했습니다.');
    }
  }, [leaveChatRoomMutation, roomId, router]);

  const handleCloseSettings = useCallback(() => {
    if (putRoomSettingsMutation.isPending) {
      return;
    }
    setIsParticipantsModalOpen(false);
    setIsSettingsOpen(false);
  }, [putRoomSettingsMutation.isPending]);

  const handleBackClick = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: chatKeys.rooms() });
    router.replace('/chat');
  }, [queryClient, router]);

  const handleSettingsClick = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const rightSlot = useMemo(
    () => (
      <button
        type="button"
        onClick={handleSettingsClick}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-neutral-100"
        aria-label="채팅방 설정"
      >
        <Menu className="h-5 w-5" />
      </button>
    ),
    [handleSettingsClick],
  );

  useEffect(() => {
    setOptions({
      title: headerTitle,
      showBackButton: true,
      onBackClick: handleBackClick,
      rightSlot,
    });

    return () => resetOptions();
  }, [handleBackClick, headerTitle, resetOptions, rightSlot, setOptions]);

  useEffect(() => {
    hasInitialScrollRef.current = false;
    isLoadingOlderRef.current = false;
    prevScrollHeightRef.current = 0;
    hasPatchedOnEntryRef.current = false;
    lastPatchedMsgIdRef.current = null;
    setMessageInput('');
  }, [roomId]);

  useEffect(() => {
    if (roomId === null) {
      return;
    }

    queryClient.setQueryData<Record<number, boolean>>(chatKeys.realtimeUnreadRooms(), (prev) => ({
      ...(prev ?? {}),
      [roomId]: false,
    }));
  }, [queryClient, roomId]);

  useEffect(() => {
    setRoomNameInput(data?.roomName ?? '');
    setIsAlarmOnInput(data?.isAlarmOn ?? true);
  }, [data?.isAlarmOn, data?.roomName, roomId]);

  useEffect(() => {
    return () => {
      clearDeleteLongPressTimer();
    };
  }, [clearDeleteLongPressTimer]);

  useEffect(() => {
    if (serverLastReadMsgId === null) {
      return;
    }

    if (lastPatchedMsgIdRef.current === null) {
      lastPatchedMsgIdRef.current = serverLastReadMsgId;
    }
  }, [serverLastReadMsgId]);

  useLayoutEffect(() => {
    const container = messageListRef.current;
    if (!container || messages.length === 0) {
      return;
    }

    if (!hasInitialScrollRef.current) {
      if (unreadStartIndex >= 0 && unreadDividerRef.current) {
        const dividerTop = unreadDividerRef.current.offsetTop;
        container.scrollTop = Math.max(0, dividerTop - container.clientHeight * 0.35);
      } else {
        container.scrollTop = container.scrollHeight;
      }
      hasInitialScrollRef.current = true;
      return;
    }

    if (isLoadingOlderRef.current) {
      const newScrollHeight = container.scrollHeight;
      const scrollDiff = newScrollHeight - prevScrollHeightRef.current;
      container.scrollTop += scrollDiff;
      isLoadingOlderRef.current = false;
    }
  }, [messages, unreadStartIndex]);

  useEffect(() => {
    if (roomId === null || isMessagesLoading || isMessagesError || latestMessageId === null) {
      return;
    }

    if (hasPatchedOnEntryRef.current) {
      return;
    }

    hasPatchedOnEntryRef.current = true;
    patchLastReadOnce(latestMessageId);
  }, [isMessagesError, isMessagesLoading, latestMessageId, patchLastReadOnce, roomId]);

  const handleMessageScroll = useCallback(() => {
    const container = messageListRef.current;
    if (!container) {
      return;
    }

    const distanceFromBottom =
      container.scrollHeight - (container.scrollTop + container.clientHeight);
    if (distanceFromBottom <= BOTTOM_CONFIRM_THRESHOLD && latestMessageId !== null) {
      patchLastReadOnce(latestMessageId);
    }

    if (!hasNextPage || isFetchingNextPage) {
      return;
    }

    if (container.scrollTop > TOP_FETCH_THRESHOLD) {
      return;
    }

    prevScrollHeightRef.current = container.scrollHeight;
    isLoadingOlderRef.current = true;
    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, latestMessageId, patchLastReadOnce]);

  if (roomId === null) {
    return (
      <main className="px-3 pt-4 pb-3">
        <div className="flex h-[50vh] flex-col items-center justify-center gap-3 rounded-2xl border border-neutral-200 bg-white">
          <p className="text-sm font-semibold text-neutral-900">유효하지 않은 채팅방입니다.</p>
          <button
            type="button"
            onClick={() => router.push('/chat')}
            className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white"
          >
            채팅 목록으로 이동
          </button>
        </div>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="px-3 pt-4 pb-3">
        <div className="space-y-2 rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="h-4 w-24 animate-pulse rounded bg-neutral-200" />
          <div className="h-4 w-40 animate-pulse rounded bg-neutral-200" />
          <div className="h-20 animate-pulse rounded-xl bg-neutral-100" />
        </div>
      </main>
    );
  }

  if (isError) {
    return (
      <main className="px-3 pt-4 pb-3">
        <div className="flex h-[50vh] flex-col items-center justify-center gap-3 rounded-2xl border border-neutral-200 bg-white">
          <p className="text-sm font-semibold text-neutral-900">
            채팅방 정보를 불러올 수 없습니다.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white"
          >
            다시 시도
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="px-3 pt-4 pb-3">
      <section
        ref={messageListRef}
        onScroll={handleMessageScroll}
        className="overflow-y-auto rounded-2xl border border-neutral-200 bg-neutral-50 p-3"
        style={{
          height: 'calc(100dvh - 56px - var(--bottom-nav-h) - 88px)',
        }}
      >
        {hasNextPage ? (
          <div className="pb-2 text-center text-[11px] text-neutral-400">
            {isFetchingNextPage
              ? '이전 메시지를 불러오는 중...'
              : '위로 스크롤하면 이전 메시지를 불러옵니다'}
          </div>
        ) : null}

        {isMessagesLoading ? (
          <div className="space-y-2 py-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className={clsx('flex', index % 2 === 0 ? 'justify-start' : 'justify-end')}
              >
                <div className="h-16 w-[70%] animate-pulse rounded-2xl bg-neutral-200" />
              </div>
            ))}
          </div>
        ) : null}

        {!isMessagesLoading && isMessagesError ? (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 rounded-2xl bg-white">
            <p className="text-sm font-semibold text-neutral-900">메시지를 불러올 수 없습니다.</p>
            <button
              type="button"
              onClick={() => void refetchMessages()}
              className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white"
            >
              다시 시도
            </button>
          </div>
        ) : null}

        {!isMessagesLoading && !isMessagesError && messages.length === 0 ? (
          <div className="flex h-full min-h-[240px] items-center justify-center rounded-2xl bg-white text-sm text-neutral-500">
            아직 메시지가 없습니다.
          </div>
        ) : null}

        {!isMessagesLoading && !isMessagesError && messages.length > 0 ? (
          <div className="space-y-2 pb-4">
            {messages.map((message, index) => {
              const prevMessage = index > 0 ? messages[index - 1] : null;
              const shouldShowDateSeparator =
                prevMessage === null ||
                formatDateKey(prevMessage.createdAt) !== formatDateKey(message.createdAt);
              const shouldShowLastReadDivider = index === unreadStartIndex;
              const isMine = message.sender?.userId === currentUserId;
              const canDeleteMessage = isMine && !message.isDeleted && message.type !== 'SYSTEM';
              const isLongText =
                !message.isDeleted &&
                message.type === 'TEXT' &&
                (message.content?.length ?? 0) > LONG_MESSAGE_THRESHOLD;
              const isExpanded = expandedMessageIds.has(message.messageId);
              const fullContent = resolveMessageContent(message);
              const displayedContent =
                isLongText && !isExpanded
                  ? `${fullContent.slice(0, LONG_MESSAGE_THRESHOLD)}...`
                  : fullContent;

              return (
                <div key={message.messageId}>
                  {shouldShowDateSeparator ? (
                    <div className="sticky top-0 z-10 -mx-3 my-2 flex justify-center bg-neutral-50/95 px-3 py-1 backdrop-blur-[1px]">
                      <span className="rounded-full border border-neutral-200 bg-white/95 px-3 py-1 text-[11px] font-medium text-neutral-600">
                        {formatStickyDateLabel(message.createdAt)}
                      </span>
                    </div>
                  ) : null}

                  {shouldShowLastReadDivider ? (
                    <div ref={unreadDividerRef} className="my-3 flex items-center gap-2">
                      <span className="h-px flex-1 bg-neutral-200" />
                      <span className="text-[11px] font-medium text-neutral-500">
                        여기까지 읽었습니다
                      </span>
                      <span className="h-px flex-1 bg-neutral-200" />
                    </div>
                  ) : null}

                  <div
                    className={clsx(
                      'flex',
                      shouldShowDateSeparator ? 'mt-3' : 'mt-2',
                      isMine ? 'justify-end' : 'justify-start',
                    )}
                  >
                    <div
                      className={clsx('max-w-[78%]', message.type === 'SYSTEM' ? 'max-w-full' : '')}
                    >
                      {!isMine && message.type !== 'SYSTEM' && message.sender?.nickname ? (
                        <p className="mb-1 px-1 text-[11px] text-neutral-500">
                          {message.sender.nickname}
                        </p>
                      ) : null}

                      {message.type === 'SYSTEM' ? (
                        <div className="mx-auto rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-center text-[11px] text-neutral-600">
                          {message.isDeleted ? '삭제된 시스템 메시지입니다.' : displayedContent}
                        </div>
                      ) : (
                        <div
                          className={clsx(
                            'rounded-2xl border px-3 py-2',
                            message.isDeleted
                              ? 'border-neutral-200 bg-neutral-100'
                              : isMine
                                ? 'border-[#0F172A] bg-[#0F172A] text-white'
                                : 'border-neutral-200 bg-white text-neutral-900',
                          )}
                          onMouseDown={
                            canDeleteMessage
                              ? () => startDeleteLongPress(message.messageId)
                              : undefined
                          }
                          onMouseUp={canDeleteMessage ? clearDeleteLongPressTimer : undefined}
                          onMouseLeave={canDeleteMessage ? clearDeleteLongPressTimer : undefined}
                          onTouchStart={
                            canDeleteMessage
                              ? () => startDeleteLongPress(message.messageId)
                              : undefined
                          }
                          onTouchEnd={canDeleteMessage ? clearDeleteLongPressTimer : undefined}
                          onTouchCancel={canDeleteMessage ? clearDeleteLongPressTimer : undefined}
                          onContextMenu={
                            canDeleteMessage
                              ? (event) => {
                                  event.preventDefault();
                                }
                              : undefined
                          }
                        >
                          <p
                            className={clsx(
                              'text-sm break-words whitespace-pre-wrap',
                              message.isDeleted ? 'text-neutral-400' : '',
                            )}
                          >
                            {message.isDeleted ? '삭제된 메시지입니다.' : displayedContent}
                          </p>

                          {!message.isDeleted && isLongText ? (
                            <button
                              type="button"
                              onClick={() => toggleExpandedMessage(message.messageId)}
                              className={clsx(
                                'mt-1 text-[11px] font-semibold',
                                isMine ? 'text-neutral-200' : 'text-neutral-500',
                              )}
                            >
                              {isExpanded ? '접기' : '더보기'}
                            </button>
                          ) : null}
                        </div>
                      )}

                      <p className="mt-1 px-1 text-right text-[11px] text-neutral-400">
                        {formatMessageTime(message.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      <form
        onSubmit={handleSendMessage}
        className="mt-2 flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 py-2"
      >
        <input
          value={messageInput}
          onChange={(event) => setMessageInput(event.target.value)}
          placeholder="메시지를 입력하세요."
          className="h-9 flex-1 border-0 bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
          maxLength={2000}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={!messageInput.trim()}
          className="rounded-lg bg-[#0F172A] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          전송
        </button>
      </form>

      {isSettingsOpen ? (
        <div className="fixed inset-0 z-[180] flex items-end justify-center">
          <button
            type="button"
            aria-label="설정 닫기"
            onClick={handleCloseSettings}
            className="absolute inset-0 bg-black/45"
          />
          <section className="relative z-10 w-full max-w-[430px] rounded-t-2xl bg-white p-4 shadow-2xl">
            <h2 className="text-base font-semibold text-neutral-900">채팅방 설정</h2>

            <div className="mt-4 rounded-xl border border-neutral-200 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-neutral-900">알림 설정</p>
                <button
                  type="button"
                  onClick={() => setIsAlarmOnInput((prev) => !prev)}
                  className={clsx(
                    'relative inline-flex h-7 w-12 items-center rounded-full transition',
                    isAlarmOnInput ? 'bg-[#0F172A]' : 'bg-neutral-300',
                  )}
                  aria-label="알림 토글"
                >
                  <span
                    className={clsx(
                      'inline-block h-5 w-5 rounded-full bg-white transition',
                      isAlarmOnInput ? 'translate-x-6' : 'translate-x-1',
                    )}
                  />
                </button>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-sm font-semibold text-neutral-900">채팅방 이름</p>
                <input
                  value={roomNameInput}
                  onChange={(event) => setRoomNameInput(event.target.value)}
                  disabled={isPrivateRoom}
                  placeholder={
                    isPrivateRoom
                      ? '1:1 채팅방은 이름 수정이 불가합니다.'
                      : '채팅방 이름을 입력하세요'
                  }
                  className="h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm text-neutral-900 placeholder:text-neutral-400 disabled:bg-neutral-100 disabled:text-neutral-400"
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleOpenParticipantsModal}
                className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
              >
                참여 유저 보기
              </button>
              <button
                type="button"
                onClick={() => setIsLeaveConfirmOpen(true)}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100"
              >
                채팅방 나가기
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCloseSettings}
                className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleSaveRoomSettings();
                }}
                disabled={putRoomSettingsMutation.isPending}
                className="rounded-lg bg-[#0F172A] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {putRoomSettingsMutation.isPending ? '저장 중...' : '저장'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isParticipantsModalOpen ? (
        <div className="fixed inset-0 z-[190] flex items-center justify-center px-4">
          <button
            type="button"
            aria-label="참여 유저 모달 닫기"
            onClick={() => setIsParticipantsModalOpen(false)}
            className="absolute inset-0 bg-black/45"
          />
          <section className="relative z-10 w-full max-w-[380px] rounded-2xl bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-neutral-900">참여 유저</h3>
              <button
                type="button"
                onClick={() => setIsParticipantsModalOpen(false)}
                className="rounded-md px-2 py-1 text-xs font-semibold text-neutral-500 hover:bg-neutral-100"
              >
                닫기
              </button>
            </div>

            {isFollowingsLoading ? (
              <p className="mt-3 text-xs text-neutral-500">팔로우 상태를 불러오는 중...</p>
            ) : null}

            {participants.length === 0 ? (
              <p className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-5 text-center text-sm text-neutral-500">
                아직 확인 가능한 참여 유저가 없습니다.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {participants.map((participant) => {
                  const isMine = participant.userId === currentUserId;
                  const isFollowing = isParticipantFollowing(participant.userId);
                  const isBusy = activeParticipantUserId !== null;

                  return (
                    <li
                      key={participant.userId}
                      className="rounded-xl border border-neutral-200 bg-white px-3 py-3"
                    >
                      <div className="flex items-center gap-3">
                        {participant.profileImage ? (
                          <Image
                            src={participant.profileImage}
                            alt={`${participant.nickname} 프로필`}
                            width={40}
                            height={40}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-200 text-sm font-semibold text-neutral-600">
                            {participant.nickname.slice(0, 1)}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-neutral-900">
                            {participant.nickname}
                          </p>
                        </div>

                        {isMine ? (
                          <span className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-semibold text-neutral-600">
                            나
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => {
                                void handleToggleParticipantFollow(participant.userId);
                              }}
                              className="rounded-md border border-neutral-200 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
                            >
                              {isFollowing ? '언팔로우' : '팔로우'}
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => {
                                void handleCreatePrivateChatWithParticipant(participant.userId);
                              }}
                              className="rounded-md bg-[#0F172A] px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60"
                            >
                              1:1 채팅
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      <ConfirmModal
        isOpen={deleteTargetMessageId !== null}
        title="메시지를 삭제하시겠어요?"
        message="삭제된 메시지는 복구할 수 없습니다."
        confirmText={deleteMessageMutation.isPending ? '삭제 중...' : '삭제'}
        cancelText="취소"
        onConfirm={() => {
          void handleDeleteMessage();
        }}
        onCancel={() => {
          if (deleteMessageMutation.isPending) {
            return;
          }
          setDeleteTargetMessageId(null);
        }}
      />

      <ConfirmModal
        isOpen={isLeaveConfirmOpen}
        title="채팅방에서 나가시겠어요?"
        message="나가면 이 채팅방의 메시지를 더 이상 확인할 수 없습니다."
        confirmText={leaveChatRoomMutation.isPending ? '나가는 중...' : '나가기'}
        cancelText="취소"
        onConfirm={() => {
          void handleLeaveChatRoom();
        }}
        onCancel={() => {
          if (leaveChatRoomMutation.isPending) {
            return;
          }
          setIsLeaveConfirmOpen(false);
        }}
      />
    </main>
  );
}
