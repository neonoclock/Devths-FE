import { useInfiniteQuery } from '@tanstack/react-query';

import { searchBoardPosts } from '@/lib/api/boards';
import { boardsKeys } from '@/lib/hooks/boards/queryKeys';

type UseBoardSearchInfiniteQueryParams = {
  keyword: string;
  size?: number;
};

const DEFAULT_SEARCH_PAGE_SIZE = 20;

export function useBoardSearchInfiniteQuery({ keyword, size }: UseBoardSearchInfiniteQueryParams) {
  const normalizedKeyword = keyword.trim();
  const pageSize = size ?? DEFAULT_SEARCH_PAGE_SIZE;

  return useInfiniteQuery({
    queryKey:
      normalizedKeyword.length > 0
        ? boardsKeys.searchInfinite({
            size: pageSize,
            keyword: normalizedKeyword,
          })
        : ['boards', 'search', 'infinite', 'idle'],
    queryFn: async ({ pageParam }) =>
      searchBoardPosts({
        size: pageSize,
        keyword: normalizedKeyword,
        lastId: pageParam ?? null,
      }),
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) => (lastPage.hasNext ? lastPage.lastId : null),
    enabled: normalizedKeyword.length > 0,
    refetchOnWindowFocus: true,
  });
}
