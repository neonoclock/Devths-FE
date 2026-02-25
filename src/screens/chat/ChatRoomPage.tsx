'use client';

import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  FileImage,
  FileText,
  Loader2,
  Menu,
  MessageSquarePlus,
  Paperclip,
  SendHorizonal,
  Trash2,
} from 'lucide-react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  useCallback,
  type ChangeEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';

import ConfirmModal from '@/components/common/ConfirmModal';
import { useAppFrame } from '@/components/layout/AppFrameContext';
import { useHeader } from '@/components/layout/HeaderContext';
import { getUserIdFromAccessToken } from '@/lib/auth/token';
import { applyRealtimeRoomMessage } from '@/lib/chat/realtimeMessageCache';
import { applyRealtimeRoomNotification } from '@/lib/chat/realtimeRoomCache';
import { clearRejoinedRoomUiOverride } from '@/lib/chat/rejoinedRoomUiCache';
import { chatStompManager } from '@/lib/chat/stompManager';
import { chatKeys } from '@/lib/hooks/chat/queryKeys';
import { useChatMessagesInfiniteQuery } from '@/lib/hooks/chat/useChatMessagesInfiniteQuery';
import { useChatRoomDetailQuery } from '@/lib/hooks/chat/useChatRoomDetailQuery';
import { useChatSubscriptions } from '@/lib/hooks/chat/useChatSubscriptions';
import { useDeleteMessageMutation } from '@/lib/hooks/chat/useDeleteMessageMutation';
import { useLeaveChatRoomMutation } from '@/lib/hooks/chat/useLeaveChatRoomMutation';
import { usePatchLastReadMutation } from '@/lib/hooks/chat/usePatchLastReadMutation';
import { usePutRoomSettingsMutation } from '@/lib/hooks/chat/usePutRoomSettingsMutation';
import { toast } from '@/lib/toast/store';
import { uploadFile } from '@/lib/upload/uploadFile';

import type { ChatMessageResponse, SendChatMessagePayload } from '@/lib/api/chatMessages';
import type { IMessage } from '@stomp/stompjs';

type ChatRoomPageProps = Readonly<{
  roomId: number | null;
  mode?: 'room' | 'settings';
}>;

const MESSAGE_PAGE_SIZE = 20;
const LONG_MESSAGE_THRESHOLD = 300;
const TOP_FETCH_THRESHOLD = 80;
const BOTTOM_CONFIRM_THRESHOLD = 32;
const DELETE_LONG_PRESS_MS = 2000;
const MESSAGE_SEND_DESTINATION = '/app/chat/message';
const MAX_IMAGE_ATTACHMENTS_PER_PICK = 9;
const MAX_ATTACHMENT_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const ALLOWED_FILE_MIME_TYPES = new Set(['application/pdf']);

function resolveChatAssetUrl(s3KeyOrUrl: string | null): string | null {
  if (!s3KeyOrUrl) {
    return null;
  }

  if (/^https?:\/\//i.test(s3KeyOrUrl)) {
    return s3KeyOrUrl;
  }

  const base = process.env.NEXT_PUBLIC_S3_URL?.trim();
  if (!base) {
    return null;
  }

  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const normalizedKey = s3KeyOrUrl.startsWith('/') ? s3KeyOrUrl.slice(1) : s3KeyOrUrl;
  return `${normalizedBase}/${normalizedKey}`;
}

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

export default function ChatRoomPage({ roomId, mode = 'room' }: ChatRoomPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { setOptions: setFrameOptions, resetOptions: resetFrameOptions } = useAppFrame();
  const { setOptions, resetOptions } = useHeader();
  const currentUserId = getUserIdFromAccessToken();
  const [messageInput, setMessageInput] = useState('');
  const [expandedMessageIds, setExpandedMessageIds] = useState<Set<number>>(new Set());
  const [deleteTargetMessageId, setDeleteTargetMessageId] = useState<number | null>(null);
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);
  const [isLeavingRoom, setIsLeavingRoom] = useState(false);
  const [roomNameInput, setRoomNameInput] = useState('');
  const [isAlarmOnInput, setIsAlarmOnInput] = useState(true);
  const [isAttachmentUploading, setIsAttachmentUploading] = useState(false);
  const [isAttachmentPickerOpen, setIsAttachmentPickerOpen] = useState(false);
  const [attachmentValidationMessage, setAttachmentValidationMessage] = useState<string | null>(
    null,
  );
  const [imagePreview, setImagePreview] = useState<{
    src: string;
    alt: string;
  } | null>(null);
  const isSettingsPage = mode === 'settings';
  const activeRoomId = isLeavingRoom ? null : roomId;
  const { data, isLoading, isError, refetch } = useChatRoomDetailQuery(activeRoomId);
  const messageListRef = useRef<HTMLDivElement>(null);
  const imageAttachmentInputRef = useRef<HTMLInputElement>(null);
  const fileAttachmentInputRef = useRef<HTMLInputElement>(null);
  const unreadDividerRef = useRef<HTMLDivElement>(null);
  const deleteLongPressTimerRef = useRef<number | null>(null);
  const isMessageInputComposingRef = useRef(false);
  const initialScrollResyncTimerRef = useRef<number | null>(null);
  const hasInitialScrollRef = useRef(false);
  const hasNoUnreadInitialBottomResyncedRef = useRef(false);
  const isLoadingOlderRef = useRef(false);
  const prevScrollHeightRef = useRef(0);
  const hasPatchedOnEntryRef = useRef(false);
  const lastPatchedMsgIdRef = useRef<number | null>(null);
  const patchLastReadMutation = usePatchLastReadMutation(roomId ?? 0);
  const deleteMessageMutation = useDeleteMessageMutation(roomId ?? 0);
  const putRoomSettingsMutation = usePutRoomSettingsMutation(roomId ?? 0);
  const leaveChatRoomMutation = useLeaveChatRoomMutation(roomId ?? 0);

  const {
    data: messageData,
    isLoading: isMessagesLoading,
    isError: isMessagesError,
    refetch: refetchMessages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useChatMessagesInfiniteQuery({
    roomId: isLeavingRoom ? 0 : (roomId ?? 0),
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
      clearRejoinedRoomUiOverride(queryClient, roomId);
      if (!roomUpdated) {
        void queryClient.invalidateQueries({ queryKey: chatKeys.rooms() });
        void queryClient.refetchQueries({ queryKey: chatKeys.rooms(), type: 'all' });
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

  const handleAttachmentButtonClick = useCallback(() => {
    if (isAttachmentUploading) {
      return;
    }

    setIsAttachmentPickerOpen(true);
  }, [isAttachmentUploading]);

  const openAttachmentValidationModal = useCallback((message: string) => {
    setIsAttachmentPickerOpen(false);
    setAttachmentValidationMessage(message);
  }, []);

  const handlePickImageAttachments = useCallback(() => {
    if (isAttachmentUploading) {
      return;
    }

    setIsAttachmentPickerOpen(false);
    imageAttachmentInputRef.current?.click();
  }, [isAttachmentUploading]);

  const handlePickFileAttachment = useCallback(() => {
    if (isAttachmentUploading) {
      return;
    }

    setIsAttachmentPickerOpen(false);
    fileAttachmentInputRef.current?.click();
  }, [isAttachmentUploading]);

  const handleAttachmentChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(event.target.files ?? []);
      event.target.value = '';

      if (selectedFiles.length === 0 || roomId === null || isAttachmentUploading) {
        return;
      }

      const imageFiles = selectedFiles.filter((file) => ALLOWED_IMAGE_MIME_TYPES.has(file.type));
      const nonImageFiles = selectedFiles.filter(
        (file) => !ALLOWED_IMAGE_MIME_TYPES.has(file.type),
      );

      if (imageFiles.length > 0 && nonImageFiles.length > 0) {
        openAttachmentValidationModal('이미지와 파일은 동시에 첨부할 수 없습니다.');
        return;
      }

      if (imageFiles.length > MAX_IMAGE_ATTACHMENTS_PER_PICK) {
        openAttachmentValidationModal(
          `이미지는 한 번에 최대 ${MAX_IMAGE_ATTACHMENTS_PER_PICK}장까지 첨부할 수 있습니다.`,
        );
        return;
      }

      if (nonImageFiles.length > 1) {
        openAttachmentValidationModal('파일은 한 번에 1개만 첨부할 수 있습니다.');
        return;
      }

      for (const file of selectedFiles) {
        if (file.size > MAX_ATTACHMENT_FILE_SIZE_BYTES) {
          openAttachmentValidationModal('파일 용량은 5MB 이하만 첨부할 수 있습니다.');
          return;
        }
      }

      if (
        nonImageFiles.length === 1 &&
        !ALLOWED_FILE_MIME_TYPES.has(nonImageFiles[0]?.type ?? '')
      ) {
        openAttachmentValidationModal('파일 첨부는 PDF 형식만 지원합니다.');
        return;
      }

      setIsAttachmentUploading(true);

      try {
        for (const file of selectedFiles) {
          const uploaded = await uploadFile({
            file,
            category: 'AI_CHAT_ATTACHMENT',
            refType: 'CHATROOM',
            refId: roomId,
          });

          const isImageAttachment = ALLOWED_IMAGE_MIME_TYPES.has(file.type);
          const payload: SendChatMessagePayload = isImageAttachment
            ? {
                roomId,
                type: 'IMAGE',
                content: null,
                s3Key: uploaded.s3Key,
              }
            : {
                roomId,
                type: 'FILE',
                // Backend FILE 저장 로직은 content 필드를 사용합니다.
                content: uploaded.s3Key,
                s3Key: uploaded.s3Key,
              };

          const published = chatStompManager.publishJson(MESSAGE_SEND_DESTINATION, payload);
          if (!published) {
            toast('첨부 메시지 전송에 실패했습니다. 잠시 후 다시 시도해 주세요.');
            return;
          }
        }
      } catch (error) {
        const err = error as Error;
        toast(err.message || '파일 업로드에 실패했습니다.');
      } finally {
        setIsAttachmentUploading(false);
      }
    },
    [isAttachmentUploading, openAttachmentValidationModal, roomId],
  );

  useChatSubscriptions({
    enabled: !isLeavingRoom && roomId !== null,
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
      const params = new URLSearchParams();
      const from = searchParams.get('from');
      if (from) {
        params.set('from', from);
      }
      const suffix = params.toString();
      router.push(`/chat/${roomId}${suffix ? `?${suffix}` : ''}`);
    } catch (error) {
      const err = error as Error & { serverMessage?: string };
      toast(err.serverMessage ?? '채팅방 설정 저장에 실패했습니다.');
    }
  }, [
    isAlarmOnInput,
    isPrivateRoom,
    putRoomSettingsMutation,
    roomId,
    roomNameInput,
    router,
    searchParams,
  ]);

  const handleLeaveChatRoom = useCallback(async () => {
    if (roomId === null || leaveChatRoomMutation.isPending) {
      return;
    }

    try {
      setIsLeavingRoom(true);
      await leaveChatRoomMutation.mutateAsync();
      setIsLeaveConfirmOpen(false);
      toast('채팅방에서 나갔습니다.');
      router.push('/chat');
    } catch (error) {
      setIsLeavingRoom(false);
      const err = error as Error & { serverMessage?: string };
      toast(err.serverMessage ?? '채팅방 나가기에 실패했습니다.');
    }
  }, [leaveChatRoomMutation, roomId, router]);

  const handleCloseSettings = useCallback(() => {
    if (putRoomSettingsMutation.isPending) {
      return;
    }
    if (roomId === null) {
      return;
    }

    const params = new URLSearchParams();
    const from = searchParams.get('from');
    if (from) {
      params.set('from', from);
    }
    const suffix = params.toString();
    router.push(`/chat/${roomId}${suffix ? `?${suffix}` : ''}`);
  }, [putRoomSettingsMutation.isPending, roomId, router, searchParams]);

  const handleBackClick = useCallback(() => {
    const from = searchParams.get('from');
    const backPath =
      from === 'notifications' ? '/notifications' : from === 'board' ? '/board' : '/chat';
    void queryClient.invalidateQueries({ queryKey: chatKeys.rooms() });
    router.replace(backPath);
  }, [queryClient, router, searchParams]);

  const handleSettingsClick = useCallback(() => {
    if (roomId === null) {
      return;
    }

    const params = new URLSearchParams();
    const from = searchParams.get('from');
    if (from) {
      params.set('from', from);
    }
    router.push(`/chat/${roomId}/settings${params.toString() ? `?${params.toString()}` : ''}`);
  }, [roomId, router, searchParams]);

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
  const settingsRightSlot = useMemo(() => <div className="h-9 w-9" aria-hidden="true" />, []);

  useEffect(() => {
    setFrameOptions({ showBottomNav: false });
    return () => resetFrameOptions();
  }, [resetFrameOptions, setFrameOptions]);

  useEffect(() => {
    setOptions({
      title: isSettingsPage ? '채팅방 설정' : headerTitle,
      showBackButton: true,
      onBackClick: isSettingsPage ? handleCloseSettings : handleBackClick,
      rightSlot: isSettingsPage ? settingsRightSlot : rightSlot,
    });

    return () => resetOptions();
  }, [
    handleBackClick,
    handleCloseSettings,
    headerTitle,
    isSettingsPage,
    resetOptions,
    rightSlot,
    settingsRightSlot,
    setOptions,
  ]);

  useEffect(() => {
    hasInitialScrollRef.current = false;
    hasNoUnreadInitialBottomResyncedRef.current = false;
    isLoadingOlderRef.current = false;
    prevScrollHeightRef.current = 0;
    hasPatchedOnEntryRef.current = false;
    lastPatchedMsgIdRef.current = null;
    setIsLeavingRoom(false);
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
      if (initialScrollResyncTimerRef.current !== null) {
        window.clearTimeout(initialScrollResyncTimerRef.current);
        initialScrollResyncTimerRef.current = null;
      }
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
        requestAnimationFrame(() => {
          const currentContainer = messageListRef.current;
          if (!currentContainer) {
            return;
          }
          currentContainer.scrollTop = currentContainer.scrollHeight;
        });
        if (initialScrollResyncTimerRef.current !== null) {
          window.clearTimeout(initialScrollResyncTimerRef.current);
        }
        initialScrollResyncTimerRef.current = window.setTimeout(() => {
          const currentContainer = messageListRef.current;
          if (!currentContainer) {
            return;
          }
          currentContainer.scrollTop = currentContainer.scrollHeight;
          initialScrollResyncTimerRef.current = null;
        }, 300);
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
    if (!hasInitialScrollRef.current) {
      return;
    }

    if (hasNoUnreadInitialBottomResyncedRef.current) {
      return;
    }

    if (messages.length === 0 || unreadStartIndex >= 0) {
      return;
    }

    const container = messageListRef.current;
    if (!container) {
      return;
    }

    hasNoUnreadInitialBottomResyncedRef.current = true;

    const timerId = window.setTimeout(() => {
      const currentContainer = messageListRef.current;
      if (!currentContainer) {
        return;
      }
      currentContainer.scrollTop = currentContainer.scrollHeight;
    }, 150);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [messages.length, unreadStartIndex]);

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
    <main className="-mx-4 flex h-[calc(100dvh-56px-var(--bottom-nav-h))] flex-col sm:-mx-6">
      <section
        ref={messageListRef}
        onScroll={handleMessageScroll}
        className="min-h-0 flex-1 overflow-y-auto bg-white px-4 py-4"
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
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center px-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#00C473]/10">
              <MessageSquarePlus className="h-8 w-8 text-[#00C473]" strokeWidth={1.75} />
            </div>
            <p className="mt-5 text-base font-semibold text-[#191F28]">아직 메시지가 없습니다.</p>
            <p className="mt-2 text-sm text-[#8B95A1]">첫 메시지를 보내 대화를 시작해보세요</p>
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
              const shouldShowCounterpartAvatar =
                isPrivateRoom && !isMine && message.type !== 'SYSTEM';
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
              const imageUrl =
                !message.isDeleted && message.type === 'IMAGE'
                  ? resolveChatAssetUrl(message.s3Key)
                  : null;
              const fileUrl =
                !message.isDeleted && message.type === 'FILE'
                  ? resolveChatAssetUrl(message.s3Key ?? message.content)
                  : null;

              return (
                <div key={message.messageId}>
                  {shouldShowDateSeparator ? (
                    <div className="-mx-4 my-2 flex justify-center px-4 py-1">
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
                      className={clsx(
                        'max-w-[78%] min-w-0',
                        message.type === 'SYSTEM' ? 'max-w-full' : '',
                      )}
                    >
                      {!isMine &&
                      !isPrivateRoom &&
                      message.type !== 'SYSTEM' &&
                      message.sender?.nickname ? (
                        <p className="mb-1 px-1 text-[11px] text-neutral-500">
                          {message.sender.nickname}
                        </p>
                      ) : null}

                      <div
                        className={clsx(
                          'flex items-start gap-2',
                          isMine ? 'justify-end' : 'justify-start',
                        )}
                      >
                        {isMine ? (
                          canDeleteMessage ? (
                            <button
                              type="button"
                              onClick={() => setDeleteTargetMessageId(message.messageId)}
                              className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 transition hover:bg-neutral-50 hover:text-red-500"
                              aria-label="메시지 삭제"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : null
                        ) : null}
                        {shouldShowCounterpartAvatar ? (
                          message.sender?.profileImage ? (
                            <Image
                              src={message.sender.profileImage}
                              alt={`${message.sender.nickname ?? '상대방'} 프로필`}
                              width={32}
                              height={32}
                              className="mt-1 h-8 w-8 shrink-0 rounded-full border border-neutral-200 object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 text-xs font-semibold text-neutral-600">
                              {(message.sender?.nickname ?? '?').slice(0, 1)}
                            </div>
                          )
                        ) : null}
                        <div
                          className={clsx(
                            'flex min-w-0 flex-col',
                            isMine ? 'items-end' : 'items-start',
                          )}
                        >
                          {message.type === 'SYSTEM' ? (
                            <div className="mx-auto rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-center text-[11px] text-neutral-600">
                              {message.isDeleted ? '삭제된 시스템 메시지입니다.' : displayedContent}
                            </div>
                          ) : message.type === 'IMAGE' && !message.isDeleted ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (!imageUrl) {
                                  toast('이미지를 불러올 수 없습니다.');
                                  return;
                                }
                                setImagePreview({
                                  src: imageUrl,
                                  alt: `${message.sender?.nickname ?? '채팅'} 이미지`,
                                });
                              }}
                              className={clsx(
                                'block overflow-hidden rounded-2xl border bg-white',
                                isMine ? 'border-[#05C075] bg-[#05C075]/5' : 'border-[#05C075]',
                              )}
                            >
                              {imageUrl ? (
                                <Image
                                  src={imageUrl}
                                  alt={`${message.sender?.nickname ?? '채팅'} 이미지`}
                                  width={240}
                                  height={240}
                                  className="max-h-[220px] w-auto max-w-[220px] object-cover"
                                  unoptimized
                                />
                              ) : (
                                <div className="flex h-[140px] w-[180px] items-center justify-center bg-neutral-100 text-xs font-medium text-neutral-500">
                                  이미지를 불러올 수 없습니다
                                </div>
                              )}
                            </button>
                          ) : message.type === 'FILE' && !message.isDeleted ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (!fileUrl) {
                                  toast('파일을 열 수 없습니다.');
                                  return;
                                }
                                window.open(fileUrl, '_blank', 'noopener,noreferrer');
                              }}
                              className={clsx(
                                'flex min-w-[180px] items-center gap-2 rounded-2xl border px-3 py-2 text-left',
                                isMine
                                  ? 'border-[#05C075] bg-[#05C075] text-white'
                                  : 'border-[#05C075] bg-white text-neutral-900',
                              )}
                            >
                              <span
                                className={clsx(
                                  'inline-flex h-8 w-8 items-center justify-center rounded-full',
                                  isMine ? 'bg-white/15' : 'bg-[#05C075]/10',
                                )}
                              >
                                <FileText
                                  className={clsx(
                                    'h-4 w-4',
                                    isMine ? 'text-white' : 'text-[#05C075]',
                                  )}
                                />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">PDF 파일</p>
                                <p
                                  className={clsx(
                                    'mt-0.5 text-[11px]',
                                    isMine ? 'text-white/80' : 'text-neutral-500',
                                  )}
                                >
                                  탭하여 열기
                                </p>
                              </div>
                            </button>
                          ) : (
                            <div
                              className={clsx(
                                'max-w-full rounded-2xl border px-3 py-2',
                                message.isDeleted
                                  ? 'border-neutral-200 bg-neutral-100'
                                  : isMine
                                    ? 'border-[#05C075] bg-[#05C075] text-white'
                                    : 'border-[#05C075] bg-white text-neutral-900',
                              )}
                              onMouseDown={
                                canDeleteMessage
                                  ? () => startDeleteLongPress(message.messageId)
                                  : undefined
                              }
                              onMouseUp={canDeleteMessage ? clearDeleteLongPressTimer : undefined}
                              onMouseLeave={
                                canDeleteMessage ? clearDeleteLongPressTimer : undefined
                              }
                              onTouchStart={
                                canDeleteMessage
                                  ? () => startDeleteLongPress(message.messageId)
                                  : undefined
                              }
                              onTouchEnd={canDeleteMessage ? clearDeleteLongPressTimer : undefined}
                              onTouchCancel={
                                canDeleteMessage ? clearDeleteLongPressTimer : undefined
                              }
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
                                  'text-sm [overflow-wrap:anywhere] break-words whitespace-pre-wrap',
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
                                    isMine ? 'text-white/80' : 'text-neutral-500',
                                  )}
                                >
                                  {isExpanded ? '접기' : '더보기'}
                                </button>
                              ) : null}
                            </div>
                          )}

                          {message.type !== 'SYSTEM' ? (
                            <span className="mt-1 px-1 text-[11px] text-neutral-400">
                              {formatMessageTime(message.createdAt)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      <div className="border-t border-neutral-200 bg-white px-3 pt-2 pb-5">
        <form onSubmit={handleSendMessage} className="flex items-end gap-2">
          <input
            ref={imageAttachmentInputRef}
            type="file"
            className="hidden"
            multiple
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={(event) => {
              void handleAttachmentChange(event);
            }}
          />
          <input
            ref={fileAttachmentInputRef}
            type="file"
            className="hidden"
            accept="application/pdf"
            onChange={(event) => {
              void handleAttachmentChange(event);
            }}
          />
          <button
            type="button"
            onClick={handleAttachmentButtonClick}
            disabled={isAttachmentUploading}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-neutral-700 shadow-sm transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-300"
            aria-label="파일 첨부"
          >
            {isAttachmentUploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Paperclip className="h-5 w-5" />
            )}
          </button>

          <div className="flex-1">
            <textarea
              value={messageInput}
              onChange={(event) => setMessageInput(event.target.value.slice(0, 2000))}
              placeholder="메시지를 입력하세요"
              className="h-11 w-full resize-none rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-900 transition outline-none placeholder:text-neutral-400 focus:border-[#05C075] focus:ring-2 focus:ring-[#05C075]/20"
              maxLength={2000}
              rows={1}
              onCompositionStart={() => {
                isMessageInputComposingRef.current = true;
              }}
              onCompositionEnd={() => {
                isMessageInputComposingRef.current = false;
              }}
              onKeyDown={(event) => {
                const isComposing =
                  isMessageInputComposingRef.current ||
                  (event.nativeEvent as KeyboardEvent).isComposing;
                if (isComposing) {
                  return;
                }

                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  if (!messageInput.trim() || isAttachmentUploading) {
                    return;
                  }
                  void handleSendMessage();
                }
              }}
            />
          </div>

          <div className="relative h-11 w-11 shrink-0">
            <button
              type="submit"
              disabled={!messageInput.trim() || isAttachmentUploading}
              className={clsx(
                'inline-flex h-11 w-11 items-center justify-center rounded-2xl transition',
                !messageInput.trim() || isAttachmentUploading
                  ? 'bg-neutral-200 text-neutral-500'
                  : 'bg-[#05C075] text-white hover:bg-[#049e61]',
              )}
              aria-label="전송"
            >
              <SendHorizonal className="h-5 w-5" />
            </button>
            <div className="absolute top-full left-1/2 mt-1 -translate-x-1/2 text-center text-[11px] text-neutral-400">
              {messageInput.length}/2000
            </div>
          </div>
        </form>
      </div>

      {imagePreview ? (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/80 p-4">
          <button
            type="button"
            aria-label="이미지 닫기"
            onClick={() => setImagePreview(null)}
            className="absolute inset-0"
          />
          <div className="relative z-10 flex max-h-full max-w-full items-center justify-center">
            <Image
              src={imagePreview.src}
              alt={imagePreview.alt}
              width={1280}
              height={1280}
              className="max-h-[85vh] w-auto max-w-[92vw] rounded-xl object-contain"
              unoptimized
            />
            <button
              type="button"
              onClick={() => setImagePreview(null)}
              className="absolute top-2 right-2 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white"
            >
              닫기
            </button>
          </div>
        </div>
      ) : null}

      {isAttachmentPickerOpen ? (
        <div className="fixed inset-0 z-[175] flex items-end justify-center">
          <button
            type="button"
            aria-label="첨부 모달 닫기"
            onClick={() => setIsAttachmentPickerOpen(false)}
            className="absolute inset-0 bg-black/45"
          />
          <section className="relative z-10 w-full max-w-[430px] rounded-t-2xl bg-white p-4 shadow-2xl">
            <h2 className="text-base font-semibold text-neutral-900">파일/이미지 첨부</h2>
            <p className="mt-1 text-xs text-neutral-500">
              이미지 최대 9장(5MB 이하, JPG/JPEG/PNG/WEBP), 파일 1개(PDF, 5MB 이하)
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handlePickImageAttachments}
                disabled={isAttachmentUploading}
                className="flex items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-60"
              >
                <FileImage className="h-4 w-4" />
                이미지 첨부
              </button>
              <button
                type="button"
                onClick={handlePickFileAttachment}
                disabled={isAttachmentUploading}
                className="flex items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-60"
              >
                <FileText className="h-4 w-4" />
                파일 첨부
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsAttachmentPickerOpen(false)}
              className="mt-3 w-full rounded-lg bg-neutral-900 px-3 py-2.5 text-sm font-semibold text-white"
            >
              닫기
            </button>
          </section>
        </div>
      ) : null}

      {attachmentValidationMessage ? (
        <div className="fixed inset-0 z-[205] flex items-center justify-center px-4">
          <button
            type="button"
            aria-label="유효성 검사 모달 닫기"
            onClick={() => setAttachmentValidationMessage(null)}
            className="absolute inset-0 bg-black/50"
          />
          <section className="relative z-10 w-full max-w-[360px] rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-neutral-900">유효성 검사 실패</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-600">{attachmentValidationMessage}</p>
            <button
              type="button"
              onClick={() => setAttachmentValidationMessage(null)}
              className="mt-5 w-full rounded-full bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white"
            >
              확인
            </button>
          </section>
        </div>
      ) : null}

      {isSettingsPage ? (
        <div className="fixed inset-x-0 top-14 bottom-0 z-40 overflow-y-auto bg-white">
          <section className="mx-auto min-h-full w-full max-w-[430px] bg-white">
            <div className="mx-auto flex min-h-full w-full max-w-[392px] flex-col px-5 pt-4 pb-6">
              <div>
                <div className="divide-y divide-neutral-200">
                  <section className="py-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-neutral-900">알림 설정</p>
                      <button
                        type="button"
                        onClick={() => setIsAlarmOnInput((prev) => !prev)}
                        className={clsx(
                          'relative inline-flex h-7 w-12 items-center rounded-full transition',
                          isAlarmOnInput ? 'bg-[#05C075]' : 'bg-neutral-300',
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
                  </section>

                  <section className="py-4">
                    <p className="text-sm font-semibold text-neutral-900">
                      최근 사진/파일 미리보기
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">최근 공유된 이미지 최대 4장</p>

                    {data?.recentImages?.length ? (
                      <ul className="mt-3 grid grid-cols-2 gap-2">
                        {data.recentImages.map((recentImage) => {
                          const imageSrc = resolveChatAssetUrl(recentImage.s3Key);

                          if (!imageSrc) {
                            return (
                              <li
                                key={recentImage.attachmentId}
                                className="flex aspect-square items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 px-1 text-center text-[10px] leading-4 text-neutral-400"
                              >
                                미리보기 불가
                              </li>
                            );
                          }

                          return (
                            <li key={recentImage.attachmentId}>
                              <button
                                type="button"
                                onClick={() =>
                                  setImagePreview({
                                    src: imageSrc,
                                    alt: recentImage.originalName || '최근 이미지 미리보기',
                                  })
                                }
                                className="block w-full overflow-hidden rounded-lg border border-neutral-200"
                                aria-label={`${recentImage.originalName || '최근 이미지'} 확대 보기`}
                              >
                                <Image
                                  src={imageSrc}
                                  alt={recentImage.originalName || '최근 이미지'}
                                  width={120}
                                  height={120}
                                  className="aspect-square h-auto w-full object-cover"
                                  unoptimized
                                />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="mt-3 px-1 py-2 text-xs text-neutral-500">
                        아직 공유된 이미지가 없습니다.
                      </p>
                    )}
                  </section>
                </div>
              </div>

              <div className="mt-auto pt-5">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsLeaveConfirmOpen(true)}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100"
                  >
                    채팅방 나가기
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleSaveRoomSettings();
                    }}
                    disabled={putRoomSettingsMutation.isPending}
                    className="rounded-lg bg-[#05C075] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#049e61] disabled:opacity-60"
                  >
                    {putRoomSettingsMutation.isPending ? '저장 중...' : '저장'}
                  </button>
                </div>
              </div>
            </div>
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
