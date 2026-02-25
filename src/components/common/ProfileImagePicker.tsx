'use client';

import { Plus } from 'lucide-react';
import { useRef } from 'react';

import { cn } from '@/lib/utils';

const MAX_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'] as const;

type ProfileImagePickerProps = {
  previewUrl?: string | null;
  fallbackInitial?: string;

  onSelect: (file: File) => void;

  onFileTooLarge?: () => void;

  onInvalidType?: () => void;

  size?: 'sm' | 'md';
  compact?: boolean;
};

export default function ProfileImagePicker({
  previewUrl,
  fallbackInitial,
  onSelect,
  onFileTooLarge,
  onInvalidType,
  size = 'md',
  compact = false,
}: ProfileImagePickerProps) {
  const hasPreview = Boolean(previewUrl);
  const trimmedFallbackInitial = fallbackInitial?.trim() ?? '';
  const initialChar = Array.from(trimmedFallbackInitial)[0] ?? '';
  const hasFallbackInitial = !hasPreview && initialChar.length > 0;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const buttonSizeClass = size === 'sm' ? 'h-32 w-32' : 'h-44 w-44';
  const iconWrapClass = size === 'sm' ? 'h-10 w-10' : 'h-12 w-12';
  const iconClass = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6';
  const initialTextClass = size === 'sm' ? 'text-[44px]' : 'text-[56px]';
  const marginTopClass = compact ? 'mt-0' : 'mt-4';

  const openPicker = () => {
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    e.target.value = '';

    if (!file) return;

    const isAllowedType = (ALLOWED_MIME_TYPES as readonly string[]).includes(file.type);
    if (!isAllowedType) {
      onInvalidType?.();
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      onFileTooLarge?.();
      return;
    }

    onSelect(file);
  };

  return (
    <section className="flex flex-col items-center">
      <button
        type="button"
        onClick={openPicker}
        className={cn(
          'relative grid place-items-center overflow-hidden rounded-full shadow-sm transition',
          buttonSizeClass,
          marginTopClass,
          hasPreview || hasFallbackInitial
            ? 'bg-zinc-900 hover:bg-zinc-800'
            : 'bg-zinc-200 hover:bg-zinc-300',
        )}
        aria-label="프로필 사진 추가"
      >
        {hasPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl!}
            alt="프로필 사진 미리보기"
            className="h-full w-full object-cover"
          />
        ) : null}

        {hasPreview ? <span className="absolute inset-0 bg-black/50" /> : null}

        {hasFallbackInitial ? (
          <span
            className={cn(
              'pointer-events-none absolute inset-0 grid place-items-center font-semibold text-white',
              initialTextClass,
            )}
          >
            {initialChar.toUpperCase()}
          </span>
        ) : null}

        <span
          className={cn(
            'absolute grid place-items-center rounded-full',
            iconWrapClass,
            hasPreview || hasFallbackInitial ? 'bg-black/30' : 'bg-white/60',
            hasFallbackInitial ? 'right-3 bottom-3' : 'inset-0 m-auto',
          )}
        >
          <Plus
            className={cn(
              iconClass,
              hasPreview || hasFallbackInitial ? 'text-white' : 'text-zinc-700',
            )}
          />
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
        onChange={handleChange}
      />
    </section>
  );
}
