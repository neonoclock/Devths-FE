import { api, type ApiClientResult } from '@/lib/api/client';

export type ChatFollowingSummaryResponse = Readonly<{
  id: number;
  userId: number;
  nickname: string;
  profileImage: string | null;
  isFollowing: boolean;
}>;

export type ChatFollowingListResponse = Readonly<{
  followings: ReadonlyArray<ChatFollowingSummaryResponse>;
  lastId: number | null;
  hasNext: boolean;
}>;

export type FetchChatFollowingsParams = Readonly<{
  size?: number | null;
  lastId?: number | null;
  nickname?: string | null;
}>;

export async function fetchChatFollowings(
  params?: FetchChatFollowingsParams,
): Promise<ApiClientResult<ChatFollowingListResponse>> {
  const queryParams = new URLSearchParams();

  const size = params?.size;
  if (size !== null && size !== undefined) {
    queryParams.set('size', String(size));
  }

  const lastId = params?.lastId;
  if (lastId !== null && lastId !== undefined) {
    queryParams.set('lastId', String(lastId));
  }

  const nickname = params?.nickname?.trim();
  if (nickname) {
    queryParams.set('nickname', nickname);
  }

  const queryString = queryParams.toString();
  const path = queryString ? `/api/users/me/followings?${queryString}` : '/api/users/me/followings';

  return api.get<ChatFollowingListResponse>(path);
}
