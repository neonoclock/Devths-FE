'use client';

import { FileText, X } from 'lucide-react';

import type { BoardAttachment } from '@/types/boardCreate';

type BoardAttachmentCardProps = {
  attachment: BoardAttachment;
  onRemove: (id: string) => void;
  onPreview?: (attachment: BoardAttachment) => void;
  onMask?: (attachment: BoardAttachment) => void;
};

function formatFileSize(bytes: number) {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    return `${mb.toFixed(2)}MB`;
  }
  const kb = bytes / 1024;
  return `${kb.toFixed(1)}KB`;
}

export default function BoardAttachmentCard({
  attachment,
  onRemove,
  onPreview,
  onMask,
}: BoardAttachmentCardProps) {
  const isPdf = attachment.type === 'PDF';
  const pdfPreviewUrl = attachment.previewUrl
    ? `${attachment.previewUrl}#page=1&zoom=60&toolbar=0&navpanes=0&scrollbar=0`
    : null;

  return (
    <div className="relative flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
      <button
        type="button"
        onClick={() => onRemove(attachment.id)}
        className="absolute top-3 right-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
        aria-label="첨부 삭제"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {isPdf ? (
        <div className="flex h-36 items-center justify-center overflow-hidden rounded-xl border border-dashed border-neutral-200 bg-neutral-50">
          {pdfPreviewUrl ? (
            <iframe
              src={pdfPreviewUrl}
              title={`${attachment.name} 미리보기`}
              className="h-full w-full"
              aria-hidden="true"
              tabIndex={-1}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-xs text-neutral-400">
              <FileText className="h-6 w-6 text-neutral-500" />
              <span className="text-xs font-semibold text-neutral-600">PDF 문서</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-36 items-center justify-center overflow-hidden rounded-xl border border-dashed border-neutral-200 bg-neutral-50 text-xs text-neutral-400">
          {attachment.previewUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attachment.previewUrl}
                alt={attachment.name}
                className="h-full w-full object-cover"
              />
            </>
          ) : (
            '이미지 미리보기'
          )}
        </div>
      )}

      <div className="space-y-1">
        <p className="text-sm font-semibold text-neutral-900">{attachment.name}</p>
        <p className="text-xs text-neutral-400">{formatFileSize(attachment.size)}</p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPreview?.(attachment)}
          className="flex-1 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
        >
          {isPdf ? '보기' : '크게 보기'}
        </button>
        <button
          type="button"
          onClick={() => onMask?.(attachment)}
          disabled={!onMask}
          className="flex-1 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-300"
        >
          개인정보 가리기
        </button>
      </div>
    </div>
  );
}
