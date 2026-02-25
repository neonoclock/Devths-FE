import { useMutation, useQueryClient } from '@tanstack/react-query';

import { followUser } from '@/lib/api/users';
import { userKeys } from '@/lib/hooks/users/queryKeys';

export function useFollowUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: number) => {
      const result = await followUser(userId);

      if (!result.ok) {
        const error = new Error('Failed to follow user') as Error & {
          status?: number;
          serverMessage?: string;
        };
        error.status = result.status;

        if (result.json && 'message' in result.json) {
          error.serverMessage = result.json.message;
        }

        throw error;
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}
