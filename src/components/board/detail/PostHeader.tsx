'use client';

import { MoreVertical } from 'lucide-react';
import Image from 'next/image';

import { formatRelativeTime } from '@/lib/utils/board';

import type { BoardAuthor } from '@/types/board';

type PostHeaderProps = {
  author: BoardAuthor;
  createdAt: string;
  onAuthorClick?: (userId: number) => void;
  showOptions?: boolean;
  onOptionsClick?: () => void;
  optionsButtonRef?: React.Ref<HTMLButtonElement>;
};

export default function PostHeader({
  author,
  createdAt,
  onAuthorClick,
  showOptions = false,
  onOptionsClick,
  optionsButtonRef,
}: PostHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <button
        type="button"
        onClick={() => onAuthorClick?.(author.userId)}
        className="flex min-w-0 items-center gap-3 text-left"
        aria-label={`${author.nickname} 프로필 보기`}
      >
        <div className="relative flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-neutral-200 text-sm font-semibold text-neutral-600">
          {author.profileImageUrl ? (
            <Image
              src={author.profileImageUrl}
              alt={`${author.nickname} 프로필 이미지`}
              fill
              sizes="40px"
              className="rounded-full object-cover"
            />
          ) : (
            <span>{author.nickname.slice(0, 1)}</span>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-neutral-900">{author.nickname}</span>
            <span className="text-xs text-neutral-400">{formatRelativeTime(createdAt)}</span>
          </div>
          {author.interests && author.interests.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-neutral-400">
              {author.interests.map((interest) => (
                <span key={interest}>#{interest}</span>
              ))}
            </div>
          ) : null}
        </div>
      </button>

      {showOptions ? (
        <button
          type="button"
          onClick={onOptionsClick}
          ref={optionsButtonRef}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-neutral-100"
          aria-label="게시글 옵션"
        >
          <MoreVertical className="h-4 w-4 text-neutral-500" />
        </button>
      ) : null}
    </div>
  );
}
