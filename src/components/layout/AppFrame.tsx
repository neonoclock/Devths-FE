'use client';

import { useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AppFrameContext, type AppFrameOptions } from '@/components/layout/AppFrameContext';
import BottomNav from '@/components/layout/BottomNav';
import Header from '@/components/layout/Header';
import { HeaderContext, type HeaderOptions } from '@/components/layout/HeaderContext';
import { NavigationGuardContext } from '@/components/layout/NavigationGuardContext';
import LlmAnalysisTaskWatcher from '@/components/llm/analysis/LlmAnalysisTaskWatcher';
import { ensureAccessToken } from '@/lib/api/client';
import { getAccessToken, getUserIdFromAccessToken, setAuthRedirect } from '@/lib/auth/token';
import { applyRealtimeRoomNotification } from '@/lib/chat/realtimeRoomCache';
import { chatKeys } from '@/lib/hooks/chat/queryKeys';
import { useChatRealtimeConnection } from '@/lib/hooks/chat/useChatRealtimeConnection';
import { useChatSubscriptions } from '@/lib/hooks/chat/useChatSubscriptions';
import { toast } from '@/lib/toast/store';

import type { ChatRoomNotificationResponse } from '@/lib/api/chatMessages';
import type { IMessage } from '@stomp/stompjs';
import type { CSSProperties, ReactNode } from 'react';

const CHAT_NOTIFICATION_TOAST_COOLDOWN_MS = 3000;

function parseStompJson<T>(body: string): T | null {
  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}

function resolveCurrentChatRoomId(pathname: string): number | null {
  const match = pathname.match(/^\/chat\/(\d+)$/);
  if (!match) {
    return null;
  }

  const roomId = Number(match[1]);
  return Number.isInteger(roomId) && roomId > 0 ? roomId : null;
}

type AppFrameProps = {
  children: ReactNode;
  headerTitle?: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
  rightSlot?: ReactNode;
};

export default function AppFrame({
  children,
  headerTitle = 'Devths',
  showBackButton = false,
  onBackClick,
  rightSlot,
}: AppFrameProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const currentUserId = getUserIdFromAccessToken();
  const currentChatRoomId = useMemo(() => resolveCurrentChatRoomId(pathname), [pathname]);
  const lastChatNotificationToastRef = useRef<Readonly<{ roomId: number; at: number }> | null>(
    null,
  );
  const defaultOptions = useMemo<HeaderOptions>(
    () => ({
      title: headerTitle,
      showBackButton,
      onBackClick,
      rightSlot,
    }),
    [headerTitle, onBackClick, rightSlot, showBackButton],
  );

  const [options, setOptions] = useState<HeaderOptions>(defaultOptions);
  const defaultFrameOptions = useMemo<AppFrameOptions>(() => ({ showBottomNav: true }), []);
  const [frameOptions, setFrameOptions] = useState<AppFrameOptions>(defaultFrameOptions);
  const isBottomNavVisible = true;
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [isNavigationBlocked, setIsNavigationBlocked] = useState(false);
  const [blockMessage, setBlockMessage] = useState('답변 생성 중에는 이동할 수 없습니다.');
  const [blockedNavigationHandler, setBlockedNavigationHandler] = useState<
    ((action: () => void) => void) | null
  >(null);

  useChatRealtimeConnection({ enabled: isAuthed === true && currentUserId !== null });

  const handleChatUserNotification = useCallback(
    (frame: IMessage) => {
      const notification = parseStompJson<ChatRoomNotificationResponse>(frame.body);
      if (!notification || typeof notification.roomId !== 'number') {
        return;
      }

      const roomUpdated = applyRealtimeRoomNotification(queryClient, notification);
      if (!roomUpdated) {
        void queryClient.invalidateQueries({ queryKey: chatKeys.rooms() });
      }

      if (currentChatRoomId !== null && notification.roomId === currentChatRoomId) {
        return;
      }

      queryClient.setQueryData<Record<number, boolean>>(chatKeys.realtimeUnreadRooms(), (prev) => ({
        ...(prev ?? {}),
        [notification.roomId]: true,
      }));

      queryClient.setQueryData<number>(chatKeys.realtimeUnread(), (prev) =>
        typeof prev === 'number' ? prev + 1 : 1,
      );

      const now = Date.now();
      const last = lastChatNotificationToastRef.current;
      if (
        !last ||
        last.roomId !== notification.roomId ||
        now - last.at > CHAT_NOTIFICATION_TOAST_COOLDOWN_MS
      ) {
        toast('새 메시지가 도착했습니다.');
        lastChatNotificationToastRef.current = { roomId: notification.roomId, at: now };
      }
    },
    [currentChatRoomId, queryClient],
  );

  useChatSubscriptions({
    enabled: isAuthed === true && currentUserId !== null,
    roomId: null,
    userId: currentUserId,
    onUserNotification: handleChatUserNotification,
  });

  useEffect(() => {
    setOptions(defaultOptions);
  }, [defaultOptions]);
  useEffect(() => {
    setFrameOptions(defaultFrameOptions);
  }, [defaultFrameOptions]);

  useEffect(() => {
    let isCancelled = false;

    const checkAuth = async () => {
      const token = getAccessToken();
      if (token) {
        if (!isCancelled) {
          setIsAuthed(true);
        }
        return;
      }

      const restored = await ensureAccessToken();
      if (isCancelled) {
        return;
      }

      if (restored) {
        setIsAuthed(true);
        return;
      }

      const query = searchParams?.toString() ?? '';
      const redirectPath = `${pathname}${query ? `?${query}` : ''}`;
      setAuthRedirect(redirectPath);
      setIsAuthed(false);
      router.replace(`/?redirect=${encodeURIComponent(redirectPath)}`);
    };

    void checkAuth();

    return () => {
      isCancelled = true;
    };
  }, [pathname, router, searchParams]);

  const resetOptions = useCallback(() => {
    setOptions(defaultOptions);
  }, [defaultOptions]);
  const resetFrameOptions = useCallback(() => {
    setFrameOptions(defaultFrameOptions);
  }, [defaultFrameOptions]);

  useEffect(() => {
    if (!isNavigationBlocked) return;

    const handlePopState = () => {
      if (!isNavigationBlocked) return;
      window.history.pushState(null, '', window.location.href);
      toast(blockMessage);
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isNavigationBlocked) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [blockMessage, isNavigationBlocked]);

  const requestNavigation = useCallback(
    (action: () => void) => {
      if (!isNavigationBlocked) {
        action();
        return;
      }
      if (blockedNavigationHandler) {
        blockedNavigationHandler(action);
        return;
      }
      toast(blockMessage);
    },
    [blockMessage, blockedNavigationHandler, isNavigationBlocked],
  );

  return isAuthed ? (
    <AppFrameContext.Provider
      value={{
        options: frameOptions,
        setOptions: setFrameOptions,
        resetOptions: resetFrameOptions,
        defaultOptions: defaultFrameOptions,
      }}
    >
      <NavigationGuardContext.Provider
        value={{
          isBlocked: isNavigationBlocked,
          setBlocked: setIsNavigationBlocked,
          blockMessage,
          setBlockMessage,
          requestNavigation,
          setBlockedNavigationHandler,
        }}
      >
        <HeaderContext.Provider value={{ options, setOptions, resetOptions, defaultOptions }}>
          <div
            className="min-h-dvh w-full bg-transparent"
            style={
              {
                '--bottom-nav-h': frameOptions.showBottomNav ? '64px' : '0px',
              } as CSSProperties
            }
          >
            <LlmAnalysisTaskWatcher />
            <div className="mx-auto min-h-dvh w-full bg-white sm:max-w-[430px] sm:shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
              <Header
                title={options.title}
                showBackButton={options.showBackButton}
                onBackClick={options.onBackClick}
                rightSlot={options.rightSlot}
              />
              <div className="px-4 pb-[var(--bottom-nav-h)] sm:px-6">{children}</div>
            </div>

            {frameOptions.showBottomNav ? <BottomNav hidden={!isBottomNavVisible} /> : null}
          </div>
        </HeaderContext.Provider>
      </NavigationGuardContext.Provider>
    </AppFrameContext.Provider>
  ) : null;
}
