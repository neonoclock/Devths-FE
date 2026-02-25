import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { applyRealtimeRoomMessage } from '@/lib/chat/realtimeMessageCache';
import { applyRealtimeRoomNotification } from '@/lib/chat/realtimeRoomCache';
import { chatKeys } from '@/lib/hooks/chat/queryKeys';

import type { ChatMessageListResponse, ChatMessageResponse } from '@/lib/api/chatMessages';
import type { ChatRoomListResponse } from '@/lib/api/chatRooms';
import type { InfiniteData } from '@tanstack/react-query';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function makeRoomsData(): InfiniteData<ChatRoomListResponse> {
  return {
    pages: [
      {
        chatRooms: [
          {
            roomId: 1,
            title: '테스트 방',
            profileImage: null,
            lastMessageContent: 'old message',
            lastMessageAt: '2026-02-19T10:00:00',
            currentCount: 2,
            tag: null,
          },
        ],
        cursor: null,
        hasNext: false,
      },
    ],
    pageParams: [undefined],
  };
}

function makeMessage(messageId: number, content: string): ChatMessageResponse {
  return {
    messageId,
    sender: {
      userId: 101,
      nickname: 'tester',
      profileImage: null,
    },
    type: 'TEXT',
    content,
    s3Key: null,
    createdAt: '2026-02-19T10:10:00',
    isDeleted: false,
  };
}

function makeMessagesData(): InfiniteData<ChatMessageListResponse> {
  return {
    pages: [
      {
        messages: [makeMessage(1, 'first')],
        lastReadMsgId: 1,
        nextCursor: null,
        hasNext: false,
      },
    ],
    pageParams: [undefined],
  };
}

describe('realtime cache updaters', () => {
  it('rooms 캐시의 lastMessageContent/lastMessageAt을 갱신한다', () => {
    const queryClient = createQueryClient();
    const key = chatKeys.rooms({ size: 10, cursor: null });
    queryClient.setQueryData(key, makeRoomsData());

    const updated = applyRealtimeRoomNotification(queryClient, {
      roomId: 1,
      lastMessageContent: 'new message',
      lastMessageAt: '2026-02-19T10:30:00',
    });

    expect(updated).toBe(true);

    const next = queryClient.getQueryData<InfiniteData<ChatRoomListResponse>>(key);
    expect(next?.pages[0].chatRooms[0].lastMessageContent).toBe('new message');
    expect(next?.pages[0].chatRooms[0].lastMessageAt).toBe('2026-02-19T10:30:00');
  });

  it('rooms 캐시에 roomId가 없으면 false를 반환한다', () => {
    const queryClient = createQueryClient();
    const key = chatKeys.rooms({ size: 10, cursor: null });
    queryClient.setQueryData(key, makeRoomsData());

    const updated = applyRealtimeRoomNotification(queryClient, {
      roomId: 999,
      lastMessageContent: 'new message',
      lastMessageAt: '2026-02-19T10:30:00',
    });

    expect(updated).toBe(false);
    const next = queryClient.getQueryData<InfiniteData<ChatRoomListResponse>>(key);
    expect(next?.pages[0].chatRooms[0].lastMessageContent).toBe('old message');
  });

  it('messages 캐시에 신규 메시지를 append한다', () => {
    const queryClient = createQueryClient();
    const key = chatKeys.messages({ roomId: 1, size: 20, lastId: null });
    queryClient.setQueryData(key, makeMessagesData());

    const inserted = applyRealtimeRoomMessage(queryClient, {
      roomId: 1,
      size: 20,
      message: makeMessage(2, 'second'),
    });

    expect(inserted).toBe(true);
    const next = queryClient.getQueryData<InfiniteData<ChatMessageListResponse>>(key);
    expect(next?.pages[0].messages).toHaveLength(2);
    expect(next?.pages[0].messages[1].messageId).toBe(2);
    expect(next?.pages[0].messages[1].content).toBe('second');
  });

  it('messages 캐시에 중복 messageId는 append하지 않는다', () => {
    const queryClient = createQueryClient();
    const key = chatKeys.messages({ roomId: 1, size: 20, lastId: null });
    queryClient.setQueryData(key, makeMessagesData());

    const inserted = applyRealtimeRoomMessage(queryClient, {
      roomId: 1,
      size: 20,
      message: makeMessage(1, 'duplicated'),
    });

    expect(inserted).toBe(false);
    const next = queryClient.getQueryData<InfiniteData<ChatMessageListResponse>>(key);
    expect(next?.pages[0].messages).toHaveLength(1);
    expect(next?.pages[0].messages[0].content).toBe('first');
  });
});
