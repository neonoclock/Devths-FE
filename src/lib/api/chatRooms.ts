import { api, apiRequest, type ApiClientResult } from '@/lib/api/client';

import type { ChatRoomType, ChatroomsCursor, PatchLastReadBody } from '@/types/chat';

type ChatRoomSummaryResponse = Readonly<{
  roomId: number;
  title: string;
  profileImage: string | null;
  lastMessageContent: string | null;
  lastMessageAt: string | null;
  currentCount: number;
  tag: string | null;
}>;

export type ChatRoomListResponse = Readonly<{
  chatRooms: ReadonlyArray<ChatRoomSummaryResponse>;
  cursor: ChatroomsCursor | null;
  hasNext: boolean;
}>;

export type FetchChatRoomsParams = Readonly<{
  type?: ChatRoomType | null;
  size?: number | null;
  cursor?: ChatroomsCursor | null;
}>;

export type PrivateChatRoomCreateRequest = Readonly<{
  userId: number;
}>;

export type PrivateChatRoomCreateResponse = Readonly<{
  roomId: number;
  isNew: boolean;
  type: ChatRoomType;
  title: string | null;
  inviteCode: string | null;
  createdAt: string;
}>;

export type ChatRoomRecentImageResponse = Readonly<{
  attachmentId: number;
  s3Key: string;
  originalName: string;
  createdAt: string;
}>;

export type ChatRoomDetailResponse = Readonly<{
  roomId: number;
  type: ChatRoomType;
  title: string | null;
  isAlarmOn: boolean;
  roomName: string | null;
  inviteCode: string | null;
  createdAt: string;
  recentImages: ReadonlyArray<ChatRoomRecentImageResponse>;
}>;

export type PutRoomSettingsRequest = Readonly<{
  roomName?: string;
  isAlarmOn: boolean;
}>;

export type PutRoomSettingsResponse = Readonly<{
  roomId: number;
  roomName: string | null;
}>;

export async function fetchChatRooms(
  params?: FetchChatRoomsParams,
): Promise<ApiClientResult<ChatRoomListResponse>> {
  const queryParams = new URLSearchParams();

  const type = params?.type;
  if (type) {
    queryParams.set('type', type);
  }

  const size = params?.size;
  if (size !== null && size !== undefined) {
    queryParams.set('size', String(size));
  }

  const cursor = params?.cursor;
  if (cursor) {
    queryParams.set('cursor', cursor);
  }

  const queryString = queryParams.toString();
  const path = queryString ? `/api/chatrooms?${queryString}` : '/api/chatrooms';

  return api.get<ChatRoomListResponse>(path);
}

export async function createPrivateChatRoom(
  body: PrivateChatRoomCreateRequest,
): Promise<ApiClientResult<PrivateChatRoomCreateResponse>> {
  return api.post<PrivateChatRoomCreateResponse>('/api/chatrooms/private', body);
}

export async function fetchChatRoomDetail(
  roomId: number,
): Promise<ApiClientResult<ChatRoomDetailResponse>> {
  return api.get<ChatRoomDetailResponse>(`/api/chatrooms/${roomId}`);
}

export async function putRoomSettings(
  roomId: number,
  body: PutRoomSettingsRequest,
): Promise<ApiClientResult<PutRoomSettingsResponse>> {
  return api.put<PutRoomSettingsResponse>(`/api/chatrooms/${roomId}`, body);
}

export async function leaveChatRoom(roomId: number): Promise<ApiClientResult<void>> {
  return api.delete<void>(`/api/chatrooms/${roomId}`);
}

export async function patchLastRead(
  roomId: number,
  body: PatchLastReadBody,
): Promise<ApiClientResult<void>> {
  return apiRequest<void>({
    method: 'PATCH',
    path: `/api/chatrooms/${roomId}`,
    body,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
