import { useInfiniteQuery } from '@tanstack/react-query';

import { fetchMyComments } from '@/lib/api/users';
import { userKeys } from '@/lib/hooks/users/queryKeys';

type UseMyCommentsInfiniteQueryParams = {
  size?: number;
};

const DEFAULT_PAGE_SIZE = 5;

export function useMyCommentsInfiniteQuery({
  size = DEFAULT_PAGE_SIZE,
}: UseMyCommentsInfiniteQueryParams = {}) {
  return useInfiniteQuery({
    queryKey: userKeys.myComments({ size }),
    queryFn: async ({ pageParam }) => {
      const result = await fetchMyComments({
        size,
        lastId: pageParam,
      });

      if (!result.ok || !result.json) {
        throw new Error('Failed to fetch my comments');
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
