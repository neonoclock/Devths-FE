import { useMutation, useQueryClient } from '@tanstack/react-query';

import { leaveChatRoom } from '@/lib/api/chatRooms';
import { chatKeys } from '@/lib/hooks/chat/queryKeys';

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

      queryClient.setQueryData<Record<number, boolean>>(chatKeys.realtimeUnreadRooms(), (prev) => ({
        ...(prev ?? {}),
        [roomId]: false,
      }));

      void queryClient.invalidateQueries({ queryKey: chatKeys.rooms() });
      void queryClient.invalidateQueries({ queryKey: chatKeys.realtimeUnread() });
    },
  });
}
