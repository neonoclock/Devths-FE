import { useMutation, useQueryClient } from '@tanstack/react-query';

import { deleteChatMessage } from '@/lib/api/chatMessages';

import type { ChatMessageListResponse } from '@/lib/api/chatMessages';
import type { ChatRoomListResponse } from '@/lib/api/chatRooms';
import type { InfiniteData, QueryKey } from '@tanstack/react-query';

function isRoomMessagesQuery(queryKey: QueryKey, roomId: number) {
  return (
    Array.isArray(queryKey) &&
    queryKey[0] === 'chat' &&
    queryKey[1] === 'messages' &&
    typeof queryKey[2] === 'object' &&
    queryKey[2] !== null &&
    'roomId' in queryKey[2] &&
    (queryKey[2] as { roomId?: unknown }).roomId === roomId
  );
}

function isRoomsQuery(queryKey: QueryKey) {
  return Array.isArray(queryKey) && queryKey[0] === 'chat' && queryKey[1] === 'rooms';
}

export function useDeleteMessageMutation(roomId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: number) => {
      const result = await deleteChatMessage(roomId, messageId);

      if (!result.ok) {
        const error = new Error('Failed to delete chat message') as Error & {
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
    onMutate: async (messageId) => {
      await queryClient.cancelQueries({
        predicate: (query) => isRoomMessagesQuery(query.queryKey, roomId),
      });
      await queryClient.cancelQueries({
        predicate: (query) => isRoomsQuery(query.queryKey),
      });

      const previousQueries = queryClient.getQueriesData<InfiniteData<ChatMessageListResponse>>({
        predicate: (query) => isRoomMessagesQuery(query.queryKey, roomId),
      });
      const previousRoomListQueries = queryClient.getQueriesData<
        InfiniteData<ChatRoomListResponse>
      >({
        predicate: (query) => isRoomsQuery(query.queryKey),
      });

      let isDeletingLatestMessage = false;
      let latestMessageCreatedAt: string | null = null;

      for (const [, data] of previousQueries) {
        if (!data) {
          continue;
        }

        const flattened = data.pages.flatMap((page) => page.messages);
        if (flattened.length === 0) {
          continue;
        }

        const latestMessage = flattened.reduce((latest, current) =>
          current.messageId > latest.messageId ? current : latest,
        );

        if (latestMessage.messageId === messageId) {
          isDeletingLatestMessage = true;
          latestMessageCreatedAt = latestMessage.createdAt;
          break;
        }
      }

      previousQueries.forEach(([queryKey]) => {
        queryClient.setQueryData<InfiniteData<ChatMessageListResponse>>(queryKey, (old) => {
          if (!old) {
            return old;
          }

          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: page.messages.map((message) =>
                message.messageId === messageId
                  ? {
                      ...message,
                      content: null,
                      s3Key: null,
                      isDeleted: true,
                    }
                  : message,
              ),
            })),
          };
        });
      });

      if (isDeletingLatestMessage) {
        previousRoomListQueries.forEach(([queryKey]) => {
          queryClient.setQueryData<InfiniteData<ChatRoomListResponse>>(queryKey, (old) => {
            if (!old) {
              return old;
            }

            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                chatRooms: page.chatRooms.map((room) =>
                  room.roomId === roomId
                    ? {
                        ...room,
                        lastMessageContent: '삭제된 메시지입니다.',
                        lastMessageAt: latestMessageCreatedAt ?? room.lastMessageAt,
                      }
                    : room,
                ),
              })),
            };
          });
        });
      }

      return { previousQueries, previousRoomListQueries };
    },
    onError: (_error, _messageId, context) => {
      context?.previousQueries.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      context?.previousRoomListQueries?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },
  });
}
