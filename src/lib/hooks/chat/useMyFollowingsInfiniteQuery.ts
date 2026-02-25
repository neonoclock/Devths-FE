import { useInfiniteQuery } from '@tanstack/react-query';

import { fetchChatFollowings } from '@/lib/api/chatFollowings';
import { chatKeys } from '@/lib/hooks/chat/queryKeys';

type UseMyFollowingsInfiniteQueryParams = Readonly<{
  submittedNickname?: string;
}>;

const PAGE_SIZE = 10;

export function useMyFollowingsInfiniteQuery({
  submittedNickname,
}: UseMyFollowingsInfiniteQueryParams = {}) {
  return useInfiniteQuery({
    queryKey: chatKeys.followings({
      nickname: submittedNickname ?? null,
      size: PAGE_SIZE,
      lastId: null,
    }),
    queryFn: async ({ pageParam }) => {
      const result = await fetchChatFollowings({
        size: PAGE_SIZE,
        lastId: pageParam ?? null,
        nickname: submittedNickname ?? null,
      });

      if (!result.ok || !result.json) {
        throw new Error('Failed to fetch my followings');
      }

      if ('data' in result.json && result.json.data) {
        return result.json.data;
      }

      throw new Error('Invalid response format');
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasNext) return undefined;
      return lastPage.lastId ?? undefined;
    },
  });
}
