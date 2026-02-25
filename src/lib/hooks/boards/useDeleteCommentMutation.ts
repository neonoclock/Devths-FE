import { useMutation } from '@tanstack/react-query';

import { deleteBoardComment } from '@/lib/api/boards';

import type { CommentDeletePayload } from '@/types/boardDetail';

export function useDeleteCommentMutation() {
  return useMutation({
    mutationFn: async (payload: CommentDeletePayload) => {
      return deleteBoardComment(payload.postId, payload.commentId);
    },
  });
}
