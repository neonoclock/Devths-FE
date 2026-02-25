import { useInfiniteQuery } from '@tanstack/react-query';

import { fetchMyFollowers } from '@/lib/api/users';
import { userKeys } from '@/lib/hooks/users/queryKeys';

type UseMyFollowersInfiniteQueryParams = {
  size?: number;
};

const DEFAULT_PAGE_SIZE = 12;

export function useMyFollowersInfiniteQuery({
  size = DEFAULT_PAGE_SIZE,
}: UseMyFollowersInfiniteQueryParams = {}) {
  return useInfiniteQuery({
    queryKey: userKeys.myFollowers({ size }),
    queryFn: async ({ pageParam }) => {
      const result = await fetchMyFollowers({
        size,
        lastId: pageParam,
      });

      if (!result.ok || !result.json) {
        throw new Error('Failed to fetch my followers');
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
