import { useInfiniteQuery } from '@tanstack/react-query';

import { fetchMyPosts } from '@/lib/api/users';
import { userKeys } from '@/lib/hooks/users/queryKeys';

type UseMyPostsInfiniteQueryParams = {
  size?: number;
};

const DEFAULT_PAGE_SIZE = 5;

export function useMyPostsInfiniteQuery({
  size = DEFAULT_PAGE_SIZE,
}: UseMyPostsInfiniteQueryParams = {}) {
  return useInfiniteQuery({
    queryKey: userKeys.myPosts({ size }),
    queryFn: async ({ pageParam }) => {
      const result = await fetchMyPosts({
        size,
        lastId: pageParam,
      });

      if (!result.ok || !result.json) {
        throw new Error('Failed to fetch my posts');
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
