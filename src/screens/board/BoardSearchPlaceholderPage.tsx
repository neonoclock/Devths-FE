'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';

import { useHeader } from '@/components/layout/HeaderContext';

export default function BoardSearchPlaceholderPage() {
  const router = useRouter();
  const { setOptions, resetOptions } = useHeader();

  const handleBackClick = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/board');
  }, [router]);

  useEffect(() => {
    setOptions({
      title: '게시글 검색',
      showBackButton: true,
      onBackClick: handleBackClick,
    });

    return () => resetOptions();
  }, [handleBackClick, resetOptions, setOptions]);

  return (
    <main className="px-3 pt-4 pb-3">
      <div className="rounded-2xl border border-dashed border-neutral-200 bg-white px-4 py-6 text-center text-sm text-neutral-500">
        게시글 검색 화면 준비 중
      </div>
    </main>
  );
}
