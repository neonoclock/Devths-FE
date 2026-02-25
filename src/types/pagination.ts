export type CursorMeta = {
  lastId: number | null;
  hasNext: boolean;
};

export type CursorPage<T> = CursorMeta & {
  items: T[];
};

export type CursorListResponse<T, TListKey extends string> = CursorMeta & {
  [K in TListKey]: T[];
};
