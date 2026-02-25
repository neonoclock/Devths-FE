'use client';

import { MoreVertical } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils/board';

import type { CommentAuthor } from '@/types/boardDetail';

type ReplyItemProps = {
  author: CommentAuthor;
  createdAt: string;
  content: string | null;
  isDeleted?: boolean;
  onAuthorClick?: (userId: number) => void;
  showOptions?: boolean;
  onDeleteClick?: () => void;
  onEditClick?: () => void;
  isEditing?: boolean;
  isLast?: boolean;
};

export default function ReplyItem({
  author,
  createdAt,
  content,
  isDeleted,
  onAuthorClick,
  showOptions = false,
  onDeleteClick,
  onEditClick,
  isEditing = false,
  isLast = false,
}: ReplyItemProps) {
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const optionsButtonRef = useRef<HTMLButtonElement>(null);
  const optionsMenuRef = useRef<HTMLDivElement>(null);
  const canShowOptions = showOptions && !isDeleted && !isEditing;

  useEffect(() => {
    if (!isOptionsOpen) return;

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (optionsMenuRef.current?.contains(target)) return;
      if (optionsButtonRef.current?.contains(target)) return;
      setIsOptionsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOptionsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOptionsOpen]);

  return (
    <div className={cn('border-b border-neutral-200 py-3', (isLast || isEditing) && 'border-b-0')}>
      <div className="ml-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => onAuthorClick?.(author.userId)}
            className="flex items-center gap-2 text-left"
            aria-label={`${author.nickname} 프로필 보기`}
          >
            <div className="relative flex h-6 w-6 items-center justify-center rounded-full border border-neutral-200 bg-neutral-200 text-[10px] font-semibold text-neutral-600">
              {author.profileImageUrl ? (
                <Image
                  src={author.profileImageUrl}
                  alt={`${author.nickname} 프로필 이미지`}
                  fill
                  sizes="24px"
                  className="rounded-full object-cover"
                />
              ) : (
                <span>{author.nickname.slice(0, 1)}</span>
              )}
            </div>
            <div>
              <div className="text-[11px] font-semibold text-neutral-800">{author.nickname}</div>
              <div className="text-[10px] text-neutral-400">{formatRelativeTime(createdAt)}</div>
            </div>
          </button>
          {canShowOptions ? (
            <div className="relative">
              <button
                type="button"
                ref={optionsButtonRef}
                onClick={() => setIsOptionsOpen((prev) => !prev)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-neutral-100"
                aria-label="댓글 옵션"
              >
                <MoreVertical className="h-3.5 w-3.5 text-neutral-500" />
              </button>
              {isOptionsOpen ? (
                <div
                  ref={optionsMenuRef}
                  className="absolute top-7 right-0 z-10 w-24 rounded-xl border border-neutral-200 bg-white py-1 text-sm text-neutral-700 shadow-[0_8px_20px_rgba(15,23,42,0.12)]"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setIsOptionsOpen(false);
                      onEditClick?.();
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-neutral-50"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOptionsOpen(false);
                      onDeleteClick?.();
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-red-500 hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        {isEditing ? null : (
          <p className={cn('mt-2 text-xs', isDeleted ? 'text-neutral-400' : 'text-neutral-600')}>
            {isDeleted ? '삭제된 댓글입니다.' : content}
          </p>
        )}
      </div>
    </div>
  );
}
