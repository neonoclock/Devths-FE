import { api, apiRequest } from '@/lib/api/client';

import type { ApiErrorResponse, ApiResponse } from '@/types/api';
import type { CursorListResponse } from '@/types/pagination';

export type MeData = {
  userId?: number;
  id?: number;
  nickname: string;
  profileImage: { id: number; url: string } | null;
  stats: { followerCount: number; followingCount: number };
  interests: string[];
};

export type FetchMeResult = {
  ok: boolean;
  status: number;
  json: (ApiResponse<MeData> | ApiErrorResponse) | null;
};

export async function fetchMe(): Promise<FetchMeResult> {
  const { ok, status, json } = await api.get<MeData>('/api/users/me');
  return { ok, status, json };
}

export type MyPostSummaryData = {
  id: number;
  title: string;
  content: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  createdAt: string;
};

export type MyPostListData = CursorListResponse<MyPostSummaryData, 'posts'>;

export type FetchMyPostsParams = {
  size?: number;
  lastId?: number | null;
};

export type FetchMyPostsResult = {
  ok: boolean;
  status: number;
  json: (ApiResponse<MyPostListData> | ApiErrorResponse) | null;
};

export async function fetchMyPosts(params?: FetchMyPostsParams): Promise<FetchMyPostsResult> {
  const queryParams = new URLSearchParams();

  const size = params?.size;
  if (size !== null && size !== undefined) {
    queryParams.set('size', String(size));
  }

  const lastId = params?.lastId;
  if (lastId !== null && lastId !== undefined) {
    queryParams.set('lastId', String(lastId));
  }

  const queryString = queryParams.toString();
  const path = queryString ? `/api/users/me/posts?${queryString}` : '/api/users/me/posts';

  const { ok, status, json } = await api.get<MyPostListData>(path);
  return { ok, status, json };
}

export type MyCommentSummaryData = {
  id: number;
  postId: number;
  postTitle: string;
  content: string;
  createdAt: string;
};

export type MyCommentListData = CursorListResponse<MyCommentSummaryData, 'comments'>;

export type FetchMyCommentsParams = {
  size?: number;
  lastId?: number | null;
};

export type FetchMyCommentsResult = {
  ok: boolean;
  status: number;
  json: (ApiResponse<MyCommentListData> | ApiErrorResponse) | null;
};

export async function fetchMyComments(
  params?: FetchMyCommentsParams,
): Promise<FetchMyCommentsResult> {
  const queryParams = new URLSearchParams();

  const size = params?.size;
  if (size !== null && size !== undefined) {
    queryParams.set('size', String(size));
  }

  const lastId = params?.lastId;
  if (lastId !== null && lastId !== undefined) {
    queryParams.set('lastId', String(lastId));
  }

  const queryString = queryParams.toString();
  const path = queryString ? `/api/users/me/comments?${queryString}` : '/api/users/me/comments';

  const { ok, status, json } = await api.get<MyCommentListData>(path);
  return { ok, status, json };
}

export type FollowerSummaryData = {
  id: number;
  userId: number;
  nickname: string;
  profileImage: string | null;
  isFollowing: boolean;
};

export type FollowerListData = CursorListResponse<FollowerSummaryData, 'followers'>;

export type FetchMyFollowersParams = {
  size?: number;
  lastId?: number | null;
};

export type FetchMyFollowersResult = {
  ok: boolean;
  status: number;
  json: (ApiResponse<FollowerListData> | ApiErrorResponse) | null;
};

export async function fetchMyFollowers(
  params?: FetchMyFollowersParams,
): Promise<FetchMyFollowersResult> {
  const queryParams = new URLSearchParams();

  const size = params?.size;
  if (size !== null && size !== undefined) {
    queryParams.set('size', String(size));
  }

  const lastId = params?.lastId;
  if (lastId !== null && lastId !== undefined) {
    queryParams.set('lastId', String(lastId));
  }

  const queryString = queryParams.toString();
  const path = queryString ? `/api/users/me/followers?${queryString}` : '/api/users/me/followers';

  const { ok, status, json } = await api.get<FollowerListData>(path);
  return { ok, status, json };
}

export type FollowingSummaryData = {
  id: number;
  userId: number;
  nickname: string;
  profileImage: string | null;
  isFollowing: boolean;
};

export type FollowingListData = CursorListResponse<FollowingSummaryData, 'followings'>;

export type FetchMyFollowingsParams = {
  size?: number;
  lastId?: number | null;
  nickname?: string;
};

export type FetchMyFollowingsResult = {
  ok: boolean;
  status: number;
  json: (ApiResponse<FollowingListData> | ApiErrorResponse) | null;
};

export async function fetchMyFollowings(
  params?: FetchMyFollowingsParams,
): Promise<FetchMyFollowingsResult> {
  const queryParams = new URLSearchParams();

  const size = params?.size;
  if (size !== null && size !== undefined) {
    queryParams.set('size', String(size));
  }

  const lastId = params?.lastId;
  if (lastId !== null && lastId !== undefined) {
    queryParams.set('lastId', String(lastId));
  }

  const nickname = params?.nickname;
  if (nickname) {
    queryParams.set('nickname', nickname);
  }

  const queryString = queryParams.toString();
  const path = queryString ? `/api/users/me/followings?${queryString}` : '/api/users/me/followings';

  const { ok, status, json } = await api.get<FollowingListData>(path);
  return { ok, status, json };
}

export type UserProfileData = {
  user: {
    id: number;
    nickname: string;
  };
  profileImage: { id: number; url: string } | null;
  interests: string[];
  isFollowing: boolean;
};

export type FetchUserProfileResult = {
  ok: boolean;
  status: number;
  json: (ApiResponse<UserProfileData> | ApiErrorResponse) | null;
};

export async function fetchUserProfile(userId: number): Promise<FetchUserProfileResult> {
  const { ok, status, json } = await api.get<UserProfileData>(`/api/users/${userId}`);
  return { ok, status, json };
}

export type FollowData = {
  targetUserId: number;
  followingCount: number;
};

export type FollowUserResult = {
  ok: boolean;
  status: number;
  json: (ApiResponse<FollowData> | ApiErrorResponse) | null;
};

export async function followUser(userId: number): Promise<FollowUserResult> {
  const { ok, status, json } = await api.post<FollowData>(`/api/users/${userId}/followers`);
  return { ok, status, json };
}

export type UnfollowUserResult = {
  ok: boolean;
  status: number;
  json: (ApiResponse<void> | ApiErrorResponse) | null;
};

export async function unfollowUser(userId: number): Promise<UnfollowUserResult> {
  const { ok, status, json } = await api.delete<void>(`/api/users/${userId}/followers`);
  return { ok, status, json };
}

export type UpdateMeRequest = {
  nickname: string;
  interests?: string[];
};

export type UpdateMeData = {
  nickname: string;
  interests: string[];
  updatedAt: string;
};

export type UpdateMeResult = {
  ok: boolean;
  status: number;
  json: (ApiResponse<UpdateMeData> | ApiErrorResponse) | null;
};

export async function updateMe(body: UpdateMeRequest): Promise<UpdateMeResult> {
  const uniqueInterests = body.interests
    ? [...new Set(body.interests.map((i) => i.toLowerCase()))]
    : undefined;

  const payload = {
    nickname: body.nickname,
    ...(uniqueInterests ? { interests: uniqueInterests } : {}),
  };
  const { ok, status, json } = await api.put<UpdateMeData>('/api/users/me', payload);
  return { ok, status, json };
}

export type SignupRequest = {
  email: string;
  nickname: string;
  interests?: string[];
  tempToken: string;
  profileImageS3Key?: string;
};

type SignupPayload = {
  email: string;
  nickname: string;
  interests: string[];
  tempToken: string;
  profileImageS3Key?: string;
};

export type SignupData = {
  nickname: string;
  profileImage: { id: number; url: string } | null;
  stats: { followerCount: number; followingCount: number };
  interests: string[];
};

export type PostSignupResult = {
  ok: boolean;
  status: number;
  json: (ApiResponse<SignupData> | ApiErrorResponse) | null;
  accessToken: string | null;
};

// 회원 탈퇴 (DELETE /api/users)
export async function deleteUser() {
  const { ok, status, json } = await api.delete<void>('/api/users');
  return { ok, status, json };
}

export async function postSignup(body: SignupRequest): Promise<PostSignupResult> {
  const payload: SignupPayload = {
    email: body.email,
    nickname: body.nickname,
    tempToken: body.tempToken,
    interests: body.interests ?? [],
    ...(body.profileImageS3Key ? { profileImageS3Key: body.profileImageS3Key } : {}),
  };

  const { ok, status, json, res } = await apiRequest<SignupData>({
    method: 'POST',
    path: '/api/users',
    body: payload,
    withAuth: false,
  });

  const authHeader = res.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  return { ok, status, json, accessToken };
}
