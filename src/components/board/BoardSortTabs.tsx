'use client';

import clsx from 'clsx';

import { BOARD_SORT_OPTIONS } from '@/constants/board';

import type { BoardSort } from '@/types/board';

type BoardSortTabsProps = {
  value: BoardSort;
  onChange: (value: BoardSort) => void;
};

export default function BoardSortTabs({ value, onChange }: BoardSortTabsProps) {
  return (
    <div className="flex gap-2">
      {BOARD_SORT_OPTIONS.map((option) => {
        const isActive = option.key === value;

        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={clsx(
              'rounded-full px-3 py-1 text-sm font-semibold transition',
              isActive
                ? 'bg-[#05C075] text-white'
                : 'border border-[#05C075] bg-white text-[#05C075] hover:bg-[#E9F9F1]',
            )}
            aria-pressed={isActive}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
