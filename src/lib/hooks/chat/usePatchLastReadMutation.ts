import { useMutation, useQueryClient } from '@tanstack/react-query';

import { patchLastRead } from '@/lib/api/chatRooms';
import { chatKeys } from '@/lib/hooks/chat/queryKeys';

export function usePatchLastReadMutation(roomId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lastReadMsgId: number) => {
      const result = await patchLastRead(roomId, { lastReadMsgId });

      if (!result.ok) {
        const error = new Error('Failed to update last read message') as Error & {
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
      queryClient.setQueryData<Record<number, boolean>>(chatKeys.realtimeUnreadRooms(), (prev) => {
        if (roomId <= 0) {
          return prev ?? {};
        }

        return {
          ...(prev ?? {}),
          [roomId]: false,
        };
      });
      void queryClient.invalidateQueries({ queryKey: chatKeys.roomDetail(roomId) });
      void queryClient.invalidateQueries({ queryKey: chatKeys.rooms() });
    },
  });
}
