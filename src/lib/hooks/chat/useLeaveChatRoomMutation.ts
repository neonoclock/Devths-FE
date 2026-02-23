import { type InfiniteData, useMutation, useQueryClient } from '@tanstack/react-query';

import { leaveChatRoom } from '@/lib/api/chatRooms';
import { chatKeys } from '@/lib/hooks/chat/queryKeys';

import type { ChatRoomListResponse } from '@/lib/api/chatRooms';

export function useLeaveChatRoomMutation(roomId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const result = await leaveChatRoom(roomId);

      if (!result.ok) {
        const error = new Error('Failed to leave chat room') as Error & {
          status?: number;
          serverMessage?: string;
        };
        error.status = result.status;

        if (result.json && 'message' in result.json) {
          error.serverMessage = result.json.message;
        }

        throw error;
      }

      return result;
    },
    onSuccess: () => {
      // 방에서 나간 직후 현재 화면의 상세/메시지 쿼리를 재조회하면 403이 발생할 수 있으므로 제거합니다.
      queryClient.removeQueries({ queryKey: chatKeys.roomDetail(roomId) });
      queryClient.removeQueries({
        predicate: (query) => {
          const [scope, key, params] = query.queryKey as [
            unknown,
            unknown,
            { roomId?: unknown } | undefined,
          ];
          return scope === 'chat' && key === 'messages' && params?.roomId === roomId;
        },
      });

      // 목록 화면은 캐시를 먼저 렌더링하므로, invalidate만 하면 삭제된 방이 잠시 남아 보일 수 있습니다.
      queryClient.setQueriesData<InfiniteData<ChatRoomListResponse>>(
        {
          predicate: (query) =>
            Array.isArray(query.queryKey) &&
            query.queryKey[0] === 'chat' &&
            query.queryKey[1] === 'rooms',
        },
        (old) => {
          if (!old) {
            return old;
          }

          let pagesChanged = false;

          const nextPages = old.pages.map((page) => {
            const nextChatRooms = page.chatRooms.filter((room) => room.roomId !== roomId);
            if (nextChatRooms.length === page.chatRooms.length) {
              return page;
            }

            pagesChanged = true;
            return {
              ...page,
              chatRooms: nextChatRooms,
            };
          });

          if (!pagesChanged) {
            return old;
          }

          return {
            ...old,
            pages: nextPages,
          };
        },
      );

      queryClient.setQueryData<Record<number, boolean>>(chatKeys.realtimeUnreadRooms(), (prev) => ({
        ...(prev ?? {}),
        [roomId]: false,
      }));

      void queryClient.invalidateQueries({ queryKey: chatKeys.rooms() });
      void queryClient.invalidateQueries({ queryKey: chatKeys.realtimeUnread() });
    },
  });
}
