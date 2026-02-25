import { chatKeys } from '@/lib/hooks/chat/queryKeys';

import type { ChatMessageListResponse, ChatMessageResponse } from '@/lib/api/chatMessages';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';

type ApplyRealtimeRoomMessageParams = Readonly<{
  roomId: number;
  size: number;
  message: ChatMessageResponse;
}>;

export function applyRealtimeRoomMessage(
  queryClient: QueryClient,
  params: ApplyRealtimeRoomMessageParams,
): boolean {
  const { roomId, size, message } = params;
  let inserted = false;

  queryClient.setQueryData<InfiniteData<ChatMessageListResponse>>(
    chatKeys.messages({ roomId, size, lastId: null }),
    (old) => {
      if (!old) {
        return old;
      }

      const alreadyExists = old.pages.some((page) =>
        page.messages.some((candidate) => candidate.messageId === message.messageId),
      );

      if (alreadyExists) {
        return old;
      }

      const firstPage = old.pages[0];
      inserted = true;

      if (!firstPage) {
        return {
          ...old,
          pages: [
            {
              messages: [message],
              lastReadMsgId: null,
              nextCursor: null,
              hasNext: false,
            },
          ],
        };
      }

      return {
        ...old,
        pages: [
          {
            ...firstPage,
            messages: [...firstPage.messages, message],
          },
          ...old.pages.slice(1),
        ],
      };
    },
  );

  return inserted;
}
