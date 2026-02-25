import { api, type ApiClientResult } from '@/lib/api/client';

import type { ChatMessageType } from '@/types/chat';

export type ChatMessageSenderResponse = Readonly<{
  userId: number;
  nickname: string;
  profileImage: string | null;
}>;

export type ChatMessageResponse = Readonly<{
  messageId: number;
  sender: ChatMessageSenderResponse | null;
  type: ChatMessageType;
  content: string | null;
  s3Key: string | null;
  createdAt: string;
  isDeleted: boolean;
}>;

export type ChatMessageListResponse = Readonly<{
  messages: ReadonlyArray<ChatMessageResponse>;
  lastReadMsgId: number | null;
  nextCursor: number | null;
  hasNext: boolean;
}>;

export type SendChatMessagePayload = Readonly<{
  roomId: number;
  type: ChatMessageType;
  content: string | null;
  s3Key: string | null;
}>;

export type ChatRoomNotificationResponse = Readonly<{
  roomId: number;
  lastMessageContent: string;
  lastMessageAt: string;
}>;

export type FetchChatMessagesParams = Readonly<{
  size?: number | null;
  lastId?: number | null;
}>;

export async function fetchChatMessages(
  roomId: number,
  params?: FetchChatMessagesParams,
): Promise<ApiClientResult<ChatMessageListResponse>> {
  const queryParams = new URLSearchParams();

  const size = params?.size;
  if (size !== null && size !== undefined) {
    queryParams.set('size', String(size));
  }

  const lastId = params?.lastId;
  if (lastId !== null && lastId !== undefined) {
    queryParams.set('lastId', String(lastId));
  }

  const queryString = queryParams.toString();
  const path = queryString
    ? `/api/chatrooms/${roomId}/messages?${queryString}`
    : `/api/chatrooms/${roomId}/messages`;

  return api.get<ChatMessageListResponse>(path);
}

export async function deleteChatMessage(
  roomId: number,
  messageId: number,
): Promise<ApiClientResult<void>> {
  return api.delete<void>(`/api/chatrooms/${roomId}/messages/${messageId}`);
}
