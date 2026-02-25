import { useInfiniteQuery } from '@tanstack/react-query';

import { listBoardPosts } from '@/lib/api/boards';
import { boardsKeys } from '@/lib/hooks/boards/queryKeys';

import type { BoardSort, BoardTag } from '@/types/board';

type UseBoardListInfiniteQueryParams = {
  size: number;
  sort: BoardSort;
  tags?: BoardTag[];
};

export function useBoardListInfiniteQuery(params: UseBoardListInfiniteQueryParams) {
  const { size, sort, tags } = params;

  return useInfiniteQuery({
    queryKey: boardsKeys.list({ size, sort, tags }),
    queryFn: async ({ pageParam }) => {
      const result = await listBoardPosts({
        size,
        sort,
        tags,
        lastId: pageParam ?? null,
      });

      return result;
    },
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) => (lastPage.hasNext ? lastPage.lastId : null),
  });
}
