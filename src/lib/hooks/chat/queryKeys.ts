import type { ChatroomsCursor } from '@/types/chat';

type ChatRoomsKeyParams = Readonly<{
  size?: number | null;
  cursor?: ChatroomsCursor | null;
}>;

type ChatMessagesKeyParams = Readonly<{
  roomId: number;
  size?: number | null;
  lastId?: number | null;
}>;

type ChatFollowingsKeyParams = Readonly<{
  nickname?: string | null;
  size?: number | null;
  lastId?: number | null;
}>;

const normalizeRoomsParams = (params?: ChatRoomsKeyParams) => ({
  size: params?.size ?? null,
  cursor: params?.cursor ?? null,
});

const normalizeMessagesParams = (params: ChatMessagesKeyParams) => ({
  roomId: params.roomId,
  size: params.size ?? null,
  lastId: params.lastId ?? null,
});

const normalizeFollowingsParams = (params?: ChatFollowingsKeyParams) => ({
  nickname: params?.nickname?.trim() || null,
  size: params?.size ?? null,
  lastId: params?.lastId ?? null,
});

/**
 * invalidate 규칙
 * - 방 목록 갱신: chatKeys.rooms(...)
 * - 방 상세 갱신: chatKeys.roomDetail(roomId)
 * - 메시지 갱신: chatKeys.messages(...)
 * - 팔로잉 목록 갱신: chatKeys.followings(...)
 * - 실시간 뱃지 갱신: chatKeys.realtimeUnread()
 */
export const chatKeys = {
  all: ['chat'] as const,
  rooms: (params?: ChatRoomsKeyParams) =>
    [...chatKeys.all, 'rooms', normalizeRoomsParams(params)] as const,
  roomDetail: (roomId: number) => [...chatKeys.all, 'roomDetail', roomId] as const,
  messages: (params: ChatMessagesKeyParams) =>
    [...chatKeys.all, 'messages', normalizeMessagesParams(params)] as const,
  followings: (params?: ChatFollowingsKeyParams) =>
    [...chatKeys.all, 'followings', normalizeFollowingsParams(params)] as const,
  realtimeUnread: () => [...chatKeys.all, 'realtimeUnread'] as const,
  realtimeUnreadRooms: () => [...chatKeys.all, 'realtimeUnreadRooms'] as const,
  rejoinedRoomUiOverrides: () => [...chatKeys.all, 'rejoinedRoomUiOverrides'] as const,
};
