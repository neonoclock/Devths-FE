'use client';

import clsx from 'clsx';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { BOARD_TAGS } from '@/constants/board';

import type { BoardTag } from '@/types/board';

type BoardTagFilterProps = {
  open: boolean;
  onToggleOpen: () => void;
  selected: BoardTag[];
  onChangeSelected: (next: BoardTag[]) => void;
  max: number;
};

export default function BoardTagFilter({
  open,
  onToggleOpen,
  selected,
  onChangeSelected,
  max,
}: BoardTagFilterProps) {
  const handleToggleTag = (tag: BoardTag) => {
    const isSelected = selected.includes(tag);
    if (isSelected) {
      onChangeSelected(selected.filter((value) => value !== tag));
      return;
    }

    if (selected.length >= max) {
      return;
    }

    onChangeSelected([...selected, tag]);
  };

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white px-3 py-2">
      <button
        type="button"
        onClick={onToggleOpen}
        className="flex w-full items-center justify-between text-sm font-semibold text-neutral-700"
      >
        태그 필터
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open ? (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {BOARD_TAGS.map((tag) => {
              const isActive = selected.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleToggleTag(tag)}
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
          <p className="mt-2 text-xs text-neutral-400">최대 {max}개까지 선택할 수 있어요.</p>
        </>
      ) : null}
    </section>
  );
}
