import { useMutation } from '@tanstack/react-query';

import { updateBoardComment } from '@/lib/api/boards';

import type { CommentUpdatePayload } from '@/types/boardDetail';

export function useUpdateCommentMutation() {
  return useMutation({
    mutationFn: async (payload: CommentUpdatePayload) => {
      return updateBoardComment(payload.postId, payload.commentId, { content: payload.content });
    },
  });
}
