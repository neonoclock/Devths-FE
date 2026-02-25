'use client';

import BaseModal from '@/components/common/BaseModal';

type BoardShareModalProps = {
  open: boolean;
  onClose: () => void;
  shareUrl: string;
  onCopy: () => void;
};

export default function BoardShareModal({ open, onClose, shareUrl, onCopy }: BoardShareModalProps) {
  return (
    <BaseModal open={open} onClose={onClose} title="게시물 공유" contentClassName="max-w-[380px]">
      <p className="text-xs text-neutral-500">게시물 링크를 복사하여 공유할 수 있습니다.</p>
      <div className="mt-3 rounded-lg bg-neutral-100 px-3 py-2 text-[11px] text-neutral-500">
        <input
          value={shareUrl}
          readOnly
          className="w-full bg-transparent outline-none"
          aria-label="공유 링크"
        />
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onCopy}
          className="flex-1 rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800"
        >
          링크 복사
        </button>
      </div>
    </BaseModal>
  );
}
