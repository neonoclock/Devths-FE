import { useQuery } from '@tanstack/react-query';

import { fetchChatRoomDetail } from '@/lib/api/chatRooms';
import { chatKeys } from '@/lib/hooks/chat/queryKeys';

export function useChatRoomDetailQuery(roomId: number | null) {
  return useQuery({
    queryKey: roomId ? chatKeys.roomDetail(roomId) : ['chat', 'roomDetail', 'unknown'],
    queryFn: async () => {
      if (!roomId) {
        throw new Error('채팅방 정보를 불러올 수 없습니다.');
      }

      const result = await fetchChatRoomDetail(roomId);

      if (!result.ok || !result.json) {
        throw new Error('Failed to fetch chat room detail');
      }

      if ('data' in result.json && result.json.data) {
        return result.json.data;
      }

      throw new Error('Invalid response format');
    },
    enabled: Boolean(roomId),
  });
}
