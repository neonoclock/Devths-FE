import { useInfiniteQuery } from '@tanstack/react-query';

import { fetchChatRooms } from '@/lib/api/chatRooms';
import { chatKeys } from '@/lib/hooks/chat/queryKeys';

import type { ChatRoomType, ChatroomsCursor } from '@/types/chat';

type UseChatRoomsInfiniteQueryParams = Readonly<{
  size?: number;
  type?: ChatRoomType;
}>;

const DEFAULT_PAGE_SIZE = 10;

export function useChatRoomsInfiniteQuery({
  size = DEFAULT_PAGE_SIZE,
  type = 'PRIVATE',
}: UseChatRoomsInfiniteQueryParams = {}) {
  return useInfiniteQuery({
    queryKey: chatKeys.rooms({ size, cursor: null }),
    queryFn: async ({ pageParam }) => {
      const result = await fetchChatRooms({
        size,
        type,
        cursor: pageParam ?? null,
      });

      if (!result.ok || !result.json) {
        throw new Error('Failed to fetch chat rooms');
      }

      if ('data' in result.json && result.json.data) {
        return result.json.data;
      }

      throw new Error('Invalid response format');
    },
    initialPageParam: undefined as ChatroomsCursor | undefined,
    getNextPageParam: (lastPage) => {
      // 서버 응답 cursor를 그대로 재사용합니다. 새 Date를 생성해 커서를 만들지 않습니다.
      return lastPage.cursor ?? undefined;
    },
  });
}
