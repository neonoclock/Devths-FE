'use client';

import { MessageCircle, UserPlus } from 'lucide-react';
import Image from 'next/image';

import BaseModal from '@/components/common/BaseModal';

export type FollowUserProfileModalData = {
  userId: number;
  nickname: string;
  profileImage: string | null;
  interests?: string[];
  isFollowing?: boolean;
};

type FollowUserProfileModalProps = {
  open: boolean;
  onClose: () => void;
  user: FollowUserProfileModalData | null;
  isLoading?: boolean;
  isError?: boolean;
  isFollowPending?: boolean;
  onRetry?: () => void;
  onClickChat?: () => void;
  onClickFollow?: () => void;
};

export default function FollowUserProfileModal({
  open,
  onClose,
  user,
  isLoading = false,
  isError = false,
  isFollowPending = false,
  onRetry,
  onClickChat,
  onClickFollow,
}: FollowUserProfileModalProps) {
  if (!user) return null;

  const followButtonClass = user.isFollowing
    ? 'bg-[#E5484D] hover:bg-[#D6383C]'
    : 'bg-[#05C075] hover:bg-[#04A865]';
  const followButtonLabel = user.isFollowing ? '언팔로잉' : '팔로잉';

  if (isLoading) {
    return (
      <BaseModal open={open} onClose={onClose} contentClassName="pt-8">
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-neutral-200 border-t-[#05C075]" />
          <p className="text-sm font-semibold text-neutral-800">프로필 정보를 불러오는 중...</p>
        </div>
      </BaseModal>
    );
  }

  if (isError) {
    return (
      <BaseModal open={open} onClose={onClose} contentClassName="pt-8">
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-sm font-semibold text-neutral-800">
            프로필 정보를 불러오지 못했습니다.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full bg-[#05C075] px-4 py-2 text-sm font-semibold text-white hover:bg-[#04A865]"
          >
            다시 시도
          </button>
        </div>
      </BaseModal>
    );
  }

  return (
    <BaseModal open={open} onClose={onClose} contentClassName="pt-8">
      <div className="flex flex-col items-center gap-3">
        {user.profileImage ? (
          <Image
            src={user.profileImage}
            alt={`${user.nickname} 프로필`}
            width={72}
            height={72}
            className="h-18 w-18 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-18 w-18 items-center justify-center rounded-full bg-neutral-200 text-lg font-semibold text-neutral-600">
            {user.nickname.slice(0, 1)}
          </div>
        )}

        <div className="text-center">
          <p className="text-base font-semibold text-neutral-900">{user.nickname}</p>
          {user.interests && user.interests.length > 0 ? (
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {user.interests.map((interest) => (
                <span
                  key={interest}
                  className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-semibold text-neutral-700"
                >
                  #{interest}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex w-full gap-2">
          <button
            type="button"
            onClick={onClickChat}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            <MessageCircle className="h-4 w-4" />
            채팅
          </button>
          <button
            type="button"
            onClick={onClickFollow}
            disabled={isFollowPending}
            className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${followButtonClass}`}
          >
            <UserPlus className="h-4 w-4" />
            {isFollowPending ? '처리 중...' : followButtonLabel}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
