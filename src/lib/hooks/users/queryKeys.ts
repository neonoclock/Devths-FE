type CursorListParams = {
  size?: number | null;
};

type FollowingListParams = {
  size?: number | null;
  nickname?: string | null;
};

const normalizeCursorListParams = (params?: CursorListParams) => ({
  size: params?.size ?? null,
});

const normalizeFollowingListParams = (params?: FollowingListParams) => ({
  size: params?.size ?? null,
  nickname: params?.nickname ?? null,
});

export const userKeys = {
  all: ['users'] as const,
  me: () => [...userKeys.all, 'me'] as const,
  myPosts: (params?: CursorListParams) =>
    [...userKeys.all, 'myPosts', normalizeCursorListParams(params)] as const,
  myComments: (params?: CursorListParams) =>
    [...userKeys.all, 'myComments', normalizeCursorListParams(params)] as const,
  myFollowers: (params?: CursorListParams) =>
    [...userKeys.all, 'myFollowers', normalizeCursorListParams(params)] as const,
  myFollowings: (params?: FollowingListParams) =>
    [...userKeys.all, 'myFollowings', normalizeFollowingListParams(params)] as const,
  profile: (userId: number) => [...userKeys.all, 'profile', userId] as const,
};
