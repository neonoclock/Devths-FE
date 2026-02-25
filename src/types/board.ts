import type { CursorPage } from '@/types/pagination';

export type BoardSort = 'LATEST' | 'POPULAR' | 'FOLLOWING';

export type BoardTag = '이력서' | '포트폴리오' | '면접' | '코딩테스트';

export type BoardInterest = '프론트엔드' | '백엔드' | '인공지능' | '클라우드';

export type BoardAuthor = {
  userId: number;
  nickname: string;
  profileImageUrl?: string | null;
  interests?: BoardInterest[];
};

export type BoardPostStats = {
  likeCount: number;
  commentCount: number;
  shareCount: number;
};

export type BoardPostSummary = {
  postId: number;
  title: string;
  preview: string;
  tags: BoardTag[];
  createdAt: string;
  author: BoardAuthor;
  stats: BoardPostStats;
};

export type BoardPostSummaryPage = CursorPage<BoardPostSummary>;
