import type { BoardSort, BoardTag } from '@/types/board';

export const BOARD_TAGS = [
  '이력서',
  '포트폴리오',
  '면접',
  '코딩테스트',
] as const satisfies readonly BoardTag[];

export const BOARD_TAG_MAX = 4;

export const BOARD_SORT_OPTIONS = [
  { key: 'LATEST', label: '최신순' },
  { key: 'POPULAR', label: '인기순' },
  { key: 'FOLLOWING', label: '팔로잉' },
] as const satisfies readonly { key: BoardSort; label: string }[];

export const POPULAR_MIN_LIKES = 500;
