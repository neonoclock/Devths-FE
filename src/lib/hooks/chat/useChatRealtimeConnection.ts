'use client';

import { useEffect } from 'react';

import { chatStompManager } from '@/lib/chat/stompManager';

type UseChatRealtimeConnectionParams = Readonly<{
  enabled?: boolean;
}>;

export function useChatRealtimeConnection({
  enabled = true,
}: UseChatRealtimeConnectionParams = {}) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    chatStompManager.connect();

    return () => {
      chatStompManager.disconnect();
    };
  }, [enabled]);
}
