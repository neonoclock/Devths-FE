import type { ChatRoomNotificationResponse } from '@/lib/api/chatMessages';
import type { ChatRoomListResponse } from '@/lib/api/chatRooms';
import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';

function isRoomsQuery(queryKey: QueryKey) {
  return Array.isArray(queryKey) && queryKey[0] === 'chat' && queryKey[1] === 'rooms';
}

export function applyRealtimeRoomNotification(
  queryClient: QueryClient,
  notification: ChatRoomNotificationResponse,
): boolean {
  let updatedAny = false;

  queryClient.setQueriesData<InfiniteData<ChatRoomListResponse>>(
    {
      predicate: (query) => isRoomsQuery(query.queryKey),
    },
    (old) => {
      if (!old) {
        return old;
      }

      let pagesChanged = false;

      const nextPages = old.pages.map((page) => {
        let pageChanged = false;

        const nextChatRooms = page.chatRooms.map((room) => {
          if (room.roomId !== notification.roomId) {
            return room;
          }

          pageChanged = true;
          updatedAny = true;
          return {
            ...room,
            lastMessageContent: notification.lastMessageContent,
            lastMessageAt: notification.lastMessageAt,
          };
        });

        if (!pageChanged) {
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

  return updatedAny;
}
