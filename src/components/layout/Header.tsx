'use client';

import clsx from 'clsx';
import { Bell, ChevronLeft } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

import { useNavigationGuard } from '@/components/layout/NavigationGuardContext';
import { useUnreadCountQuery } from '@/lib/hooks/notifications/useUnreadCountQuery';

import type { ReactNode } from 'react';

type HeaderProps = {
  title?: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
  rightSlot?: ReactNode;
};

export default function Header({
  title = 'Devths',
  showBackButton = false,
  onBackClick,
  rightSlot,
}: HeaderProps) {
  const router = useRouter();
  const { data: unreadCount } = useUnreadCountQuery();
  const { requestNavigation } = useNavigationGuard();
  const showBadge = typeof unreadCount === 'number' && unreadCount > 0;

  const handleBackClick = () => {
    if (!onBackClick) return;
    requestNavigation(() => onBackClick());
  };

  const handleHomeClick = () => {
    requestNavigation(() => router.push('/llm'));
  };

  const handleNotificationsClick = () => {
    requestNavigation(() => router.push('/notifications'));
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white">
      <div className="flex h-14 items-center px-4 sm:px-6">
        <div className="flex items-center gap-2">
          {showBackButton ? (
            <button
              type="button"
              onClick={handleBackClick}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-neutral-100"
              aria-label="뒤로가기"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : null}
          {title === 'Devths' ? (
            <button
              type="button"
              onClick={handleHomeClick}
              className="inline-flex items-center rounded-md transition hover:opacity-80"
              aria-label="Devths 홈 이동"
            >
              <Image
                src="/icons/Devths.png"
                alt="Devths"
                width={156}
                height={48}
                className="h-12 w-auto"
                priority
              />
            </button>
          ) : title ? (
            <h1 className="text-base font-semibold text-neutral-900">{title}</h1>
          ) : null}
        </div>

        <div
          className={clsx(
            'ml-auto flex items-center justify-end',
            rightSlot ? 'w-auto gap-1' : 'w-10',
          )}
        >
          {rightSlot ?? (
            <button
              type="button"
              onClick={handleNotificationsClick}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-neutral-100"
              aria-label="알림"
            >
              <Bell className="h-5 w-5" />
              {showBadge ? (
                <span className="absolute top-[0.5px] right-[0.5px] h-2.5 w-2.5 rounded-full bg-red-500" />
              ) : null}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
