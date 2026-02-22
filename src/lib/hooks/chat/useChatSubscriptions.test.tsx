import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useChatSubscriptions } from '@/lib/hooks/chat/useChatSubscriptions';

import type { IMessage } from '@stomp/stompjs';

const { subscribeMock } = vi.hoisted(() => ({
  subscribeMock: vi.fn(),
}));

vi.mock('@/lib/chat/stompManager', () => ({
  chatStompManager: {
    subscribe: subscribeMock,
  },
}));

describe('useChatSubscriptions', () => {
  afterEach(() => {
    subscribeMock.mockReset();
  });

  it('room/user 채널을 각각 구독한다', () => {
    const roomUnsubscribe = vi.fn();
    const userUnsubscribe = vi.fn();

    subscribeMock.mockReturnValueOnce(roomUnsubscribe).mockReturnValueOnce(userUnsubscribe);

    const onRoomMessage = vi.fn();
    const onUserNotification = vi.fn();

    const { unmount } = renderHook(() =>
      useChatSubscriptions({
        enabled: true,
        roomId: 10,
        userId: 101,
        onRoomMessage,
        onUserNotification,
      }),
    );

    expect(subscribeMock).toHaveBeenCalledTimes(2);
    expect(subscribeMock).toHaveBeenNthCalledWith(1, '/topic/chatroom/10', expect.any(Function));
    expect(subscribeMock).toHaveBeenNthCalledWith(
      2,
      '/topic/user/101/notifications',
      expect.any(Function),
    );

    const roomCallback = subscribeMock.mock.calls[0][1] as (message: IMessage) => void;
    const userCallback = subscribeMock.mock.calls[1][1] as (message: IMessage) => void;
    const fakeFrame = { body: '{"ok":true}' } as IMessage;

    roomCallback(fakeFrame);
    userCallback(fakeFrame);

    expect(onRoomMessage).toHaveBeenCalledWith(fakeFrame);
    expect(onUserNotification).toHaveBeenCalledWith(fakeFrame);

    unmount();

    expect(roomUnsubscribe).toHaveBeenCalledTimes(1);
    expect(userUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('enabled=false면 구독하지 않는다', () => {
    renderHook(() =>
      useChatSubscriptions({
        enabled: false,
        roomId: 10,
        userId: 101,
      }),
    );

    expect(subscribeMock).not.toHaveBeenCalled();
  });

  it('roomId 또는 userId가 없으면 해당 채널은 구독하지 않는다', () => {
    subscribeMock.mockReturnValue(vi.fn());

    renderHook(() =>
      useChatSubscriptions({
        enabled: true,
        roomId: null,
        userId: 101,
      }),
    );

    expect(subscribeMock).toHaveBeenCalledTimes(1);
    expect(subscribeMock).toHaveBeenCalledWith(
      '/topic/user/101/notifications',
      expect.any(Function),
    );
  });

  it('콜백 참조가 바뀌어도 destination이 같으면 재구독하지 않는다', () => {
    const roomUnsubscribe = vi.fn();
    const userUnsubscribe = vi.fn();
    subscribeMock.mockReturnValueOnce(roomUnsubscribe).mockReturnValueOnce(userUnsubscribe);

    const firstRoomHandler = vi.fn();
    const firstUserHandler = vi.fn();

    const { rerender } = renderHook(
      ({
        onRoomMessage,
        onUserNotification,
      }: {
        onRoomMessage?: (message: IMessage) => void;
        onUserNotification?: (message: IMessage) => void;
      }) =>
        useChatSubscriptions({
          enabled: true,
          roomId: 3,
          userId: 101,
          onRoomMessage,
          onUserNotification,
        }),
      {
        initialProps: {
          onRoomMessage: firstRoomHandler,
          onUserNotification: firstUserHandler,
        },
      },
    );

    expect(subscribeMock).toHaveBeenCalledTimes(2);

    const roomCallback = subscribeMock.mock.calls[0][1] as (message: IMessage) => void;
    const userCallback = subscribeMock.mock.calls[1][1] as (message: IMessage) => void;

    const nextRoomHandler = vi.fn();
    const nextUserHandler = vi.fn();

    rerender({
      onRoomMessage: nextRoomHandler,
      onUserNotification: nextUserHandler,
    });

    expect(subscribeMock).toHaveBeenCalledTimes(2);

    const fakeFrame = { body: '{"ok":true}' } as IMessage;
    roomCallback(fakeFrame);
    userCallback(fakeFrame);

    expect(firstRoomHandler).not.toHaveBeenCalled();
    expect(firstUserHandler).not.toHaveBeenCalled();
    expect(nextRoomHandler).toHaveBeenCalledWith(fakeFrame);
    expect(nextUserHandler).toHaveBeenCalledWith(fakeFrame);
  });
});
