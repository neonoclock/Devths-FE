'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Bot, Calendar, LayoutList, MessageCircle, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { useNavigationGuard } from '@/components/layout/NavigationGuardContext';
import { chatKeys } from '@/lib/hooks/chat/queryKeys';

type Tab = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  highlight?: boolean;
};

const TABS: Tab[] = [
  { label: '캘린더', href: '/calendar', icon: Calendar },
  { label: '게시판', href: '/board', icon: LayoutList },
  { label: 'AI', href: '/llm', icon: Bot, highlight: true },
  { label: '채팅', href: '/chat', icon: MessageCircle },
  { label: '프로필', href: '/profile', icon: User },
];

type BottomNavProps = {
  hidden?: boolean;
};

export default function BottomNav({ hidden = false }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isBlocked, requestNavigation } = useNavigationGuard();
  const { data: chatRealtimeUnread = 0 } = useQuery({
    queryKey: chatKeys.realtimeUnread(),
    queryFn: async () => 0,
    initialData: 0,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const handleNavigate =
    (href: string) => (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
      if (!isBlocked) return;
      event.preventDefault();
      requestNavigation(() => router.push(href));
    };

  return (
    <nav
      className={clsx(
        'fixed bottom-0 left-1/2 z-50 w-full -translate-x-1/2 bg-white transition-transform duration-200 sm:max-w-[430px]',
        hidden ? 'pointer-events-none translate-y-full' : 'translate-y-0',
      )}
    >
      <div className="border-t">
        <div className="grid h-16 grid-cols-5 px-2">
          {TABS.map((tab) => {
            const isActive = pathname.startsWith(tab.href);
            const Icon = tab.icon;

            if (tab.highlight) {
              return (
                <Link
                  key={tab.label}
                  href={tab.href}
                  onClick={handleNavigate(tab.href)}
                  className="flex flex-col items-center justify-center"
                >
                  <div className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-[#05C075] shadow-lg">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <span
                    className={clsx(
                      'mt-1 text-[11px]',
                      isActive ? 'font-medium text-neutral-900' : 'text-neutral-500',
                    )}
                  >
                    {tab.label}
                  </span>
                </Link>
              );
            }

            const baseClass = clsx(
              'flex flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-[11px]',
              tab.disabled ? 'opacity-40' : 'hover:bg-neutral-100',
            );

            const activeClass = clsx(
              isActive ? 'font-medium text-neutral-900' : 'text-neutral-500',
            );

            if (tab.disabled) {
              return (
                <div key={tab.label} className={clsx(baseClass, activeClass)} aria-disabled="true">
                  <Icon className="h-5 w-5" />
                  <span>{tab.label}</span>
                </div>
              );
            }

            return (
              <Link
                key={tab.label}
                href={tab.href}
                onClick={handleNavigate(tab.href)}
                className={clsx(baseClass, activeClass)}
              >
                <span className="relative inline-flex">
                  <Icon className="h-5 w-5" />
                  {tab.href === '/chat' && !isActive && chatRealtimeUnread > 0 ? (
                    <span className="absolute -top-1.5 -right-1.5 h-2.5 w-2.5 rounded-full bg-red-500" />
                  ) : null}
                </span>
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
