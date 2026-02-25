'use client';

import CommentComposer from '@/components/board/detail/CommentComposer';

type CommentEditorProps = {
  placeholder?: string;
  defaultValue?: string;
  onSubmit?: (content: string) => boolean | void | Promise<boolean | void>;
  className?: string;
  maxLength?: number;
  isSubmitting?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
};

export default function CommentEditor({
  placeholder,
  defaultValue,
  onSubmit,
  className,
  maxLength,
  isSubmitting,
  submitLabel,
  onCancel,
}: CommentEditorProps) {
  return (
    <CommentComposer
      placeholder={placeholder}
      defaultValue={defaultValue}
      onSubmit={onSubmit}
      className={className}
      maxLength={maxLength}
      isSubmitting={isSubmitting}
      submitLabel={submitLabel}
      onCancel={onCancel}
    />
  );
}
