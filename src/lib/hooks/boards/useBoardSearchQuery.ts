import { useQuery } from '@tanstack/react-query';

import { searchBoardPosts } from '@/lib/api/boards';
import { boardsKeys } from '@/lib/hooks/boards/queryKeys';

type UseBoardSearchQueryParams = {
  keyword: string;
  size?: number;
  lastId?: number | null;
};

const DEFAULT_SEARCH_PAGE_SIZE = 20;

export function useBoardSearchQuery({ keyword, size, lastId }: UseBoardSearchQueryParams) {
  const normalizedKeyword = keyword.trim();
  const pageSize = size ?? DEFAULT_SEARCH_PAGE_SIZE;

  return useQuery({
    queryKey:
      normalizedKeyword.length > 0
        ? boardsKeys.search({
            size: pageSize,
            keyword: normalizedKeyword,
            lastId,
          })
        : ['boards', 'search', 'idle'],
    queryFn: async () =>
      searchBoardPosts({
        size: pageSize,
        keyword: normalizedKeyword,
        lastId: lastId ?? null,
      }),
    enabled: normalizedKeyword.length > 0,
    refetchOnWindowFocus: true,
  });
}
