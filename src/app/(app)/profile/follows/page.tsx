'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';

import { useHeader } from '@/components/layout/HeaderContext';
import FollowListScreen from '@/components/mypage/FollowListScreen';
import { useMeQuery } from '@/lib/hooks/users/useMeQuery';

export default function FollowListPage() {
  const router = useRouter();
  const { setOptions, resetOptions } = useHeader();
  const { data: me } = useMeQuery();

  const handleBackClick = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/profile');
  }, [router]);

  const title = me?.nickname?.trim() ? me.nickname : '팔로워/팔로잉';

  useEffect(() => {
    setOptions({
      title,
      showBackButton: true,
      onBackClick: handleBackClick,
    });

    return () => resetOptions();
  }, [handleBackClick, resetOptions, setOptions, title]);

  return <FollowListScreen />;
}
