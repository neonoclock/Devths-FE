import { useInfiniteQuery } from '@tanstack/react-query';

import { fetchMyFollowings } from '@/lib/api/users';
import { userKeys } from '@/lib/hooks/users/queryKeys';

type UseMyFollowingsInfiniteQueryParams = {
  size?: number;
  nickname?: string;
};

const DEFAULT_PAGE_SIZE = 12;

export function useMyFollowingsInfiniteQuery({
  size = DEFAULT_PAGE_SIZE,
  nickname,
}: UseMyFollowingsInfiniteQueryParams = {}) {
  return useInfiniteQuery({
    queryKey: userKeys.myFollowings({ size, nickname }),
    queryFn: async ({ pageParam }) => {
      const result = await fetchMyFollowings({
        size,
        lastId: pageParam,
        nickname,
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
