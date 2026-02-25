import { api } from '@/lib/api/client';

import type { BoardInterest, BoardPostSummary, BoardSort, BoardTag } from '@/types/board';
import type {
  CommentItem,
  CommentItemResponse,
  CommentListResponse,
  PostDetail,
  PostDetailResponse,
} from '@/types/boardDetail';
import type { CursorListResponse, CursorPage } from '@/types/pagination';

type ListBoardPostsParams = {
  size: number;
  lastId?: number | null;
  sort: BoardSort;
  tags?: BoardTag[];
  /**
   * Backend contract:
   * - query key: `tag`
   * - meaning: 통합 검색 키워드 (제목 + 내용 검색)
   */
  keyword?: string | null;
};

export type SearchBoardPostsParams = {
  size: number;
  lastId?: number | null;
  keyword: string;
};

type PostAuthorInfoResponse = {
  userId: number;
  nickname: string;
  profileImage: string | null;
  interests: string[];
};

type PostSummaryResponse = {
  postId: number;
  title: string;
  previewContent: string;
  user: PostAuthorInfoResponse;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  tags: string[];
  createdAt: string;
};

type PostListResponse = CursorListResponse<PostSummaryResponse, 'posts'>;

type CommentCreateRequest = {
  parentId?: number | null;
  content: string;
};

type CommentCreateResponse = {
  commentId: number;
};

type CommentUpdateRequest = {
  content: string;
};

type CommentUpdateResponse = {
  commentId: number;
};

type CommentDeleteResponse = void;

type PostLikeResponse = {
  postId: number;
  likeCount: number;
};

type BoardPostMutationResponse = {
  postId: number;
};

function getResponseData<T>(
  result: {
    ok: boolean;
    json: unknown;
  },
  requestErrorMessage: string,
): T {
  if (!result.ok || !result.json) {
    throw new Error(requestErrorMessage);
  }

  if (typeof result.json !== 'object' || result.json === null || !('data' in result.json)) {
    throw new Error('Invalid response format');
  }

  const data = (result.json as { data?: unknown }).data;
  if (data === undefined || data === null) {
    throw new Error('Invalid response format');
  }

  return data as T;
}

function mapPostDetail(detail: PostDetailResponse): PostDetail {
  return {
    postId: detail.postId,
    title: detail.title,
    content: detail.content,
    attachments: detail.attachments ?? [],
    author: {
      userId: detail.user.userId,
      nickname: detail.user.nickname,
      profileImageUrl: detail.user.profileImage ?? null,
      interests: (detail.user.interests ?? []) as BoardInterest[],
    },
    stats: {
      likeCount: detail.likeCount,
      commentCount: detail.commentCount,
      shareCount: detail.shareCount,
    },
    tags: (detail.tags ?? []) as BoardTag[],
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    isLiked: detail.isLiked,
  };
}

function mapCommentItem(comment: CommentItemResponse): CommentItem {
  return {
    commentId: comment.commentId,
    parentId: comment.parentId ?? null,
    content: comment.content ?? null,
    author: {
      userId: comment.user.userId,
      nickname: comment.user.nickname,
      profileImageUrl: comment.user.profileImage ?? null,
    },
    createdAt: comment.createdAt,
    isDeleted: comment.isDeleted,
  };
}

export type CreateBoardPostRequest = {
  title: string;
  content: string;
  tags?: BoardTag[];
  fileIds?: number[];
};

export type UpdateBoardPostRequest = {
  title: string;
  content: string;
  tags?: BoardTag[];
  fileIds?: number[];
};

function mapPostSummary(post: PostSummaryResponse): BoardPostSummary {
  return {
    postId: post.postId,
    title: post.title,
    preview: post.previewContent ?? '',
    tags: (post.tags ?? []) as BoardTag[],
    createdAt: post.createdAt,
    author: {
      userId: post.user.userId,
      nickname: post.user.nickname,
      profileImageUrl: post.user.profileImage ?? null,
      interests: (post.user.interests ?? []) as BoardInterest[],
    },
    stats: {
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      shareCount: post.shareCount,
    },
  };
}

function buildListBoardPostsPath(
  params: Pick<ListBoardPostsParams, 'size' | 'lastId' | 'keyword'>,
) {
  const { size, lastId, keyword } = params;
  const queryParams = new URLSearchParams();
  queryParams.set('size', size.toString());

  if (lastId !== null && lastId !== undefined) {
    queryParams.set('lastId', lastId.toString());
  }

  // NOTE:
  // Backend uses `tag` query parameter as unified title/content search keyword.
  const normalizedKeyword = keyword?.trim();
  if (normalizedKeyword) {
    queryParams.set('tag', normalizedKeyword);
  }

  return queryParams.toString() ? `/api/posts?${queryParams.toString()}` : '/api/posts';
}

function mapPostListToCursorPage(data: PostListResponse): CursorPage<BoardPostSummary> {
  return {
    items: data.posts.map(mapPostSummary),
    lastId: data.lastId ?? null,
    hasNext: data.hasNext,
  };
}

export async function listBoardPosts(
  params: ListBoardPostsParams,
): Promise<CursorPage<BoardPostSummary>> {
  const {
    size,
    lastId,
    keyword,
    // 현재 게시판 목록 화면에서는 sort/tags를 프론트에서만 사용 중.
    // (검색 페이지 연동 시 keyword -> `tag` 파라미터 사용 예정)
    sort: _sort,
    tags: _tags,
  } = params;

  const path = buildListBoardPostsPath({ size, lastId, keyword });
  const result = await api.get<PostListResponse>(path, { credentials: 'include' });
  const data = getResponseData<PostListResponse>(result, 'Failed to fetch posts');
  return mapPostListToCursorPage(data);
}

/**
 * 게시글 검색 API
 * - endpoint: GET /api/posts
 * - backend search param: `tag` (제목/내용 통합검색 키워드)
 */
export async function searchBoardPosts(
  params: SearchBoardPostsParams,
): Promise<CursorPage<BoardPostSummary>> {
  const normalizedKeyword = params.keyword.trim();
  if (!normalizedKeyword) {
    throw new Error('검색어를 입력해 주세요.');
  }

  const path = buildListBoardPostsPath({
    size: params.size,
    lastId: params.lastId,
    keyword: normalizedKeyword,
  });
  const result = await api.get<PostListResponse>(path, { credentials: 'include' });
  const data = getResponseData<PostListResponse>(result, '검색 결과를 불러오지 못했습니다.');
  return mapPostListToCursorPage(data);
}

export async function createBoardPost(payload: CreateBoardPostRequest) {
  const result = await api.post<BoardPostMutationResponse>('/api/posts', payload, {
    credentials: 'include',
  });

  return getResponseData<BoardPostMutationResponse>(result, '게시글 등록에 실패했습니다.');
}

export async function updateBoardPost(postId: number, payload: UpdateBoardPostRequest) {
  const result = await api.put<BoardPostMutationResponse>(`/api/posts/${postId}`, payload, {
    credentials: 'include',
  });

  return getResponseData<BoardPostMutationResponse>(result, '게시글 수정에 실패했습니다.');
}

export async function getBoardPostDetail(postId: number): Promise<PostDetail> {
  const result = await api.get<PostDetailResponse>(`/api/posts/${postId}`, {
    credentials: 'include',
  });
  const data = getResponseData<PostDetailResponse>(result, '게시글을 불러오지 못했습니다.');

  return mapPostDetail(data);
}

export async function listBoardComments(
  postId: number,
  size = 50,
  lastId?: number | null,
): Promise<CursorPage<CommentItem>> {
  const queryParams = new URLSearchParams();
  queryParams.set('size', size.toString());
  if (lastId !== null && lastId !== undefined) {
    queryParams.set('lastId', lastId.toString());
  }

  const path = queryParams.toString()
    ? `/api/posts/${postId}/comments?${queryParams.toString()}`
    : `/api/posts/${postId}/comments`;
  const result = await api.get<CommentListResponse>(path, { credentials: 'include' });
  const data = getResponseData<CommentListResponse>(result, '댓글을 불러오지 못했습니다.');
  const items = data.comments.map(mapCommentItem);

  return {
    items,
    lastId: data.lastId ?? null,
    hasNext: data.hasNext,
  };
}

export async function createBoardComment(
  postId: number,
  payload: CommentCreateRequest,
): Promise<CommentCreateResponse> {
  const result = await api.post<CommentCreateResponse>(`/api/posts/${postId}/comments`, payload, {
    credentials: 'include',
  });

  return getResponseData<CommentCreateResponse>(result, '댓글 등록에 실패했습니다.');
}

export async function updateBoardComment(
  postId: number,
  commentId: number,
  payload: CommentUpdateRequest,
): Promise<CommentUpdateResponse> {
  const result = await api.put<CommentUpdateResponse>(
    `/api/posts/${postId}/comments/${commentId}`,
    payload,
    {
      credentials: 'include',
    },
  );

  return getResponseData<CommentUpdateResponse>(result, '댓글 수정에 실패했습니다.');
}

export async function deleteBoardComment(postId: number, commentId: number): Promise<void> {
  const result = await api.delete<CommentDeleteResponse>(
    `/api/posts/${postId}/comments/${commentId}`,
    { credentials: 'include' },
  );

  if (!result.ok) {
    throw new Error('댓글 삭제에 실패했습니다.');
  }
}

export async function likeBoardPost(postId: number): Promise<PostLikeResponse> {
  const result = await api.post<PostLikeResponse>(`/api/posts/${postId}/likes`, undefined, {
    credentials: 'include',
  });

  return getResponseData<PostLikeResponse>(result, '좋아요에 실패했습니다.');
}

export async function unlikeBoardPost(postId: number): Promise<void> {
  const result = await api.delete<void>(`/api/posts/${postId}/likes`, { credentials: 'include' });

  if (!result.ok) {
    throw new Error('좋아요 취소에 실패했습니다.');
  }
}

export async function deleteBoardPost(postId: number): Promise<void> {
  const result = await api.delete<void>(`/api/posts/${postId}`, { credentials: 'include' });

  if (!result.ok) {
    throw new Error('게시글 삭제에 실패했습니다.');
  }
}
