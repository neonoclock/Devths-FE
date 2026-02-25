import type { BoardSort, BoardTag } from '@/types/board';

type BoardListParams = {
  size: number;
  sort: BoardSort;
  tags?: BoardTag[];
};

type BoardSearchParams = {
  size: number;
  keyword: string;
  lastId?: number | null;
};

type BoardSearchInfiniteParams = {
  size: number;
  keyword: string;
};

const normalizeBoardSearchParams = (params: BoardSearchParams) => ({
  size: params.size,
  keyword: params.keyword.trim(),
  lastId: params.lastId ?? null,
});

const normalizeBoardSearchInfiniteParams = (params: BoardSearchInfiniteParams) => ({
  size: params.size,
  keyword: params.keyword.trim(),
});

export const boardsKeys = {
  all: ['boards'] as const,
  list: (params: BoardListParams) => [...boardsKeys.all, 'list', params] as const,
  search: (params: BoardSearchParams) =>
    [...boardsKeys.all, 'search', normalizeBoardSearchParams(params)] as const,
  searchInfinite: (params: BoardSearchInfiniteParams) =>
    [...boardsKeys.all, 'search', 'infinite', normalizeBoardSearchInfiniteParams(params)] as const,
  detail: (postId: number) => [...boardsKeys.all, 'detail', postId] as const,
  comments: (postId: number, size: number) =>
    [...boardsKeys.all, 'comments', postId, size] as const,
};
