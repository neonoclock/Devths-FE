import { chatKeys } from '@/lib/hooks/chat/queryKeys';

import type { QueryClient } from '@tanstack/react-query';

export type RejoinedRoomUiOverride = Readonly<{
  hideLastMessagePreview: boolean;
  profileImage: string | null;
}>;

export type RejoinedRoomUiOverrideMap = Record<number, RejoinedRoomUiOverride>;

export function applyRejoinedRoomUiOverride(
  queryClient: QueryClient,
  roomId: number,
  profileImage: string | null,
) {
  queryClient.setQueryData<RejoinedRoomUiOverrideMap>(
    chatKeys.rejoinedRoomUiOverrides(),
    (prev) => ({
      ...(prev ?? {}),
      [roomId]: {
        hideLastMessagePreview: true,
        profileImage,
      },
    }),
  );
}

export function clearRejoinedRoomUiOverride(queryClient: QueryClient, roomId: number) {
  queryClient.setQueryData<RejoinedRoomUiOverrideMap>(
    chatKeys.rejoinedRoomUiOverrides(),
    (prev) => {
      if (!prev || !(roomId in prev)) {
        return prev ?? {};
      }

      const next = { ...prev };
      delete next[roomId];
      return next;
    },
  );
}
