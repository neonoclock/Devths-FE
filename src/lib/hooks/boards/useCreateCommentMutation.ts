import { useMutation } from '@tanstack/react-query';

import { createBoardComment } from '@/lib/api/boards';

import type { CommentCreatePayload } from '@/types/boardDetail';

export function useCreateCommentMutation() {
  return useMutation({
    mutationFn: async (payload: CommentCreatePayload) => {
      return createBoardComment(payload.postId, {
        parentId: payload.parentId ?? null,
        content: payload.content,
      });
    },
  });
}
