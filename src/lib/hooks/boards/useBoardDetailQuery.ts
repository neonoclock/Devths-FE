import { useQuery } from '@tanstack/react-query';

import { getBoardPostDetail } from '@/lib/api/boards';
import { boardsKeys } from '@/lib/hooks/boards/queryKeys';

export function useBoardDetailQuery(postId: number | null) {
  return useQuery({
    queryKey: postId ? boardsKeys.detail(postId) : ['boards', 'detail', 'unknown'],
    queryFn: async () => {
      if (!postId) {
        throw new Error('게시글 정보를 불러올 수 없습니다.');
      }
      return getBoardPostDetail(postId);
    },
    enabled: Boolean(postId),
  });
}
