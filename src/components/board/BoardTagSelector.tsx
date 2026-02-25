'use client';

import clsx from 'clsx';

import { BOARD_TAGS } from '@/constants/board';
import { BOARD_TAG_MAX } from '@/constants/boardCreate';

import type { BoardTag } from '@/types/board';

type BoardTagSelectorProps = {
  value: BoardTag[];
  onChange: (next: BoardTag[]) => void;
};

export default function BoardTagSelector({ value, onChange }: BoardTagSelectorProps) {
  const handleToggle = (tag: BoardTag) => {
    const isSelected = value.includes(tag);
    if (isSelected) {
      onChange(value.filter((item) => item !== tag));
      return;
    }

    if (value.length >= BOARD_TAG_MAX) {
      return;
    }

    onChange([...value, tag]);
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-neutral-900">태그</span>
        <span className="text-xs text-neutral-400">태그는 선택 사항입니다 (최대 4개)</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {BOARD_TAGS.map((tag) => {
          const isActive = value.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => handleToggle(tag)}
              className={clsx(
                'rounded-full border px-3 py-1 text-xs font-semibold transition',
                isActive
                  ? 'border-[#05C075] bg-[#E9F9F1] text-[#05C075]'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50',
              )}
              aria-pressed={isActive}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </section>
  );
}
