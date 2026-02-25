import { useQuery } from '@tanstack/react-query';

import { listBoardComments } from '@/lib/api/boards';
import { boardsKeys } from '@/lib/hooks/boards/queryKeys';

export function useBoardCommentsQuery(postId: number | null, size = 50) {
  return useQuery({
    queryKey: postId ? boardsKeys.comments(postId, size) : ['boards', 'comments', 'unknown'],
    queryFn: async () => {
      if (!postId) {
        throw new Error('댓글을 불러올 수 없습니다.');
      }
      return listBoardComments(postId, size);
    },
    enabled: Boolean(postId),
    refetchOnWindowFocus: true,
  });
}
