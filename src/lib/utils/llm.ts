import { getRoomStorageMode } from '@/lib/storage/aiChatroomStorage';

import type { LlmRoom } from '@/components/llm/rooms/types';
import type { AiChatRoom, ChatMessage } from '@/types/llm';

export type MessageStatus = 'sending' | 'sent' | 'failed';

export type UIAttachment = {
  type: 'image' | 'file';
  name: string;
  url?: string;
};

export type UIMessage = {
  id: string;
  role: 'USER' | 'AI' | 'SYSTEM';
  text: string;
  time?: string;
  attachments?: UIAttachment[];
  status?: MessageStatus;
  interviewId?: number | null;
  isInterviewEvaluation?: boolean;
};

export function parseLlmDateTime(value: string): Date {
  const normalized = value.includes(' ') ? value.replace(' ', 'T') : value;
  const hasTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(normalized);
  if (hasTimezone) {
    return new Date(normalized);
  }

  // AI chatbot timestamps are serialized without timezone info but represent UTC.
  return new Date(`${normalized}Z`);
}

export function formatUpdatedAt(isoString: string): string {
  const date = parseLlmDateTime(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) {
    return `${diffMins}분 전`;
  }

  if (diffHours < 24) {
    const hour = date.getHours();
    const period = hour < 12 ? '오전' : '오후';
    const displayHour = hour % 12 || 12;
    return `${period} ${displayHour}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  if (diffDays === 1) {
    return '어제';
  }

  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
}

export function mapAiChatRoomToLlmRoom(room: AiChatRoom): LlmRoom {
  return {
    id: room.roomUuid,
    numericId: room.roomId,
    title: room.title,
    updatedAt: formatUpdatedAt(room.updatedAt),
    storage: getRoomStorageMode(room.roomUuid),
  };
}

function mapRole(role: ChatMessage['role']): UIMessage['role'] {
  switch (role) {
    case 'ASSISTANT':
      return 'AI';
    case 'SYSTEM':
      return 'SYSTEM';
    default:
      return 'USER';
  }
}

export function toUIMessage(msg: ChatMessage): UIMessage {
  const isInterviewEvaluation =
    msg.role === 'ASSISTANT' && msg.type === 'INTERVIEW' && msg.metadata?.evaluation === true;

  return {
    id: String(msg.messageId),
    role: mapRole(msg.role),
    text: msg.content,
    time: formatMessageTime(msg.createdAt),
    interviewId: msg.interviewId,
    isInterviewEvaluation,
  };
}

function formatMessageTime(isoString: string): string {
  const date = parseLlmDateTime(isoString);
  return date.toLocaleTimeString('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
