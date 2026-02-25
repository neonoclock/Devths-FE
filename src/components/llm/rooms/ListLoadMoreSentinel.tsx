'use client';

import { useEffect, useRef } from 'react';

type Props = {
  onLoadMore: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  loadingText?: string;
  hasNextText?: string;
  endText?: string;
};

export default function ListLoadMoreSentinel({
  onLoadMore,
  hasNextPage,
  isFetchingNextPage,
  loadingText = '로딩 중...',
  hasNextText = '스크롤로 더 보기',
  endText = '모든 대화를 불러왔습니다',
}: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = sentinelRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          onLoadMore();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [onLoadMore, hasNextPage, isFetchingNextPage]);

  return (
    <div ref={sentinelRef} className="mt-4 pb-6 text-center">
      {isFetchingNextPage ? (
        <div className="rounded-2xl border border-dashed border-neutral-200 bg-white px-3 py-3 text-[11px] text-neutral-500">
          {loadingText}
        </div>
      ) : hasNextPage ? (
        <div className="rounded-2xl border border-dashed border-neutral-200 bg-white px-3 py-3 text-[11px] text-neutral-500">
          {hasNextText}
        </div>
      ) : (
        <div className="px-3 py-1 text-[11px] text-neutral-400">{endText}</div>
      )}
    </div>
  );
}
