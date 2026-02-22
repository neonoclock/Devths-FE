'use client';

import { useCallback, useEffect, useRef } from 'react';

import { chatStompManager } from '@/lib/chat/stompManager';

import type { IMessage } from '@stomp/stompjs';

type UseChatSubscriptionsParams = Readonly<{
  enabled?: boolean;
  roomId: number | null;
  userId: number | null;
  onRoomMessage?: (message: IMessage) => void;
  onUserNotification?: (message: IMessage) => void;
}>;

export function useChatSubscriptions({
  enabled = true,
  roomId,
  userId,
  onRoomMessage,
  onUserNotification,
}: UseChatSubscriptionsParams) {
  const onRoomMessageRef = useRef(onRoomMessage);
  const onUserNotificationRef = useRef(onUserNotification);

  useEffect(() => {
    onRoomMessageRef.current = onRoomMessage;
  }, [onRoomMessage]);

  useEffect(() => {
    onUserNotificationRef.current = onUserNotification;
  }, [onUserNotification]);

  const handleRoomMessage = useCallback((message: IMessage) => {
    onRoomMessageRef.current?.(message);
  }, []);

  const handleUserNotification = useCallback((message: IMessage) => {
    onUserNotificationRef.current?.(message);
  }, []);

  useEffect(() => {
    if (!enabled || roomId === null) {
      return;
    }

    const destination = `/topic/chatroom/${roomId}`;
    return chatStompManager.subscribe(destination, handleRoomMessage);
  }, [enabled, handleRoomMessage, roomId]);

  useEffect(() => {
    if (!enabled || userId === null) {
      return;
    }

    const destination = `/topic/user/${userId}/notifications`;
    return chatStompManager.subscribe(destination, handleUserNotification);
  }, [enabled, handleUserNotification, userId]);
}
