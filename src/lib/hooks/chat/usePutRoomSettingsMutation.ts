import { useMutation, useQueryClient } from '@tanstack/react-query';

import { putRoomSettings } from '@/lib/api/chatRooms';
import { chatKeys } from '@/lib/hooks/chat/queryKeys';

import type { PutRoomSettingsRequest } from '@/lib/api/chatRooms';

export function usePutRoomSettingsMutation(roomId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: PutRoomSettingsRequest) => {
      const result = await putRoomSettings(roomId, body);

      if (!result.ok) {
        const error = new Error('Failed to update room settings') as Error & {
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
      void queryClient.invalidateQueries({ queryKey: chatKeys.roomDetail(roomId) });
      void queryClient.invalidateQueries({ queryKey: chatKeys.all });
    },
  });
}
