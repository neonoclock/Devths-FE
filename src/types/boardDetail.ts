import type { BoardAuthor, BoardTag } from '@/types/board';
import type { CursorListResponse } from '@/types/pagination';

export type ReactionCounts = {
  likeCount: number;
  commentCount: number;
  shareCount: number;
};

export type PostDetailAttachment = {
  fileId: number;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  fileType: 'IMAGE' | 'VIDEO' | 'FILE';
  sortOrder: number;
};

export type PostDetailResponse = {
  postId: number;
  title: string;
  content: string;
  attachments: PostDetailAttachment[];
  user: {
    userId: number;
    nickname: string;
    profileImage: string | null;
    interests: string[];
  };
  likeCount: number;
  commentCount: number;
  shareCount: number;
  tags: BoardTag[];
  createdAt: string;
  updatedAt: string;
  isLiked: boolean;
};

export type PostDetail = {
  postId: number;
  title: string;
  content: string;
  attachments: PostDetailAttachment[];
  author: BoardAuthor;
  stats: ReactionCounts;
  tags: BoardTag[];
  createdAt: string;
  updatedAt: string;
  isLiked: boolean;
};

export type CommentAuthor = {
  userId: number;
  nickname: string;
  profileImageUrl?: string | null;
};

export type CommentItemResponse = {
  commentId: number;
  parentId: number | null;
  content: string | null;
  user: {
    userId: number;
    nickname: string;
    profileImage: string | null;
  };
  createdAt: string;
  isDeleted: boolean;
};

export type CommentListResponse = CursorListResponse<CommentItemResponse, 'comments'>;

export type CommentItem = {
  commentId: number;
  parentId: number | null;
  content: string | null;
  author: CommentAuthor;
  createdAt: string;
  isDeleted: boolean;
};

export type CommentDepth = 1 | 2;

export type CommentCreatePayload = {
  postId: number;
  content: string;
  parentId?: number | null;
};

export type CommentUpdatePayload = {
  postId: number;
  commentId: number;
  content: string;
};

export type CommentDeletePayload = {
  postId: number;
  commentId: number;
};

export type CommentThread = {
  comment: CommentItem;
  replies: CommentItem[];
};
