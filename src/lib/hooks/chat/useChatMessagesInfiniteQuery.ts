import { useInfiniteQuery } from '@tanstack/react-query';

import { fetchChatMessages } from '@/lib/api/chatMessages';
import { chatKeys } from '@/lib/hooks/chat/queryKeys';

const DEFAULT_PAGE_SIZE = 20;

type UseChatMessagesInfiniteQueryParams = Readonly<{
  roomId: number;
  size?: number;
}>;

export function useChatMessagesInfiniteQuery({
  roomId,
  size = DEFAULT_PAGE_SIZE,
}: UseChatMessagesInfiniteQueryParams) {
  return useInfiniteQuery({
    queryKey: chatKeys.messages({ roomId, size, lastId: null }),
    queryFn: async ({ pageParam }) => {
      const result = await fetchChatMessages(roomId, {
        size,
        lastId: pageParam ?? null,
      });

      if (!result.json) {
        const error = new Error('Failed to fetch chat messages');
        (error as Error & { status?: number }).status = result.status;
        throw error;
      }

      if (!result.ok) {
        const message =
          'message' in result.json && typeof result.json.message === 'string'
            ? result.json.message
            : 'Failed to fetch chat messages';
        const error = new Error(message);
        (error as Error & { status?: number }).status = result.status;
        throw error;
      }

      if ('data' in result.json && result.json.data) {
        return result.json.data;
      }

      const error = new Error('Invalid response format');
      (error as Error & { status?: number }).status = result.status;
      throw error;
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasNext) return undefined;
      return lastPage.nextCursor ?? undefined;
    },
    enabled: roomId > 0,
  });
}
