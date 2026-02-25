import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createPrivateChatRoom } from '@/lib/api/chatRooms';
import { chatKeys } from '@/lib/hooks/chat/queryKeys';

import type { PrivateChatRoomCreateRequest } from '@/lib/api/chatRooms';

export function useCreatePrivateRoomMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: PrivateChatRoomCreateRequest) => {
      const result = await createPrivateChatRoom(body);

      if (!result.ok) {
        const error = new Error('Failed to create private chat room') as Error & {
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
      void queryClient.invalidateQueries({ queryKey: chatKeys.all });
      void queryClient.invalidateQueries({ queryKey: chatKeys.rooms() });
      void queryClient.refetchQueries({ queryKey: chatKeys.rooms(), type: 'all' });
    },
  });
}
