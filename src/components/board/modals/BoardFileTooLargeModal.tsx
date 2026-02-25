'use client';

import BaseModal from '@/components/common/BaseModal';

type BoardFileTooLargeModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function BoardFileTooLargeModal({ open, onClose }: BoardFileTooLargeModalProps) {
  return (
    <BaseModal open={open} onClose={onClose} title="파일 용량 초과">
      <div className="space-y-1 text-sm text-neutral-600">
        <p>첨부 가능한 최대 용량은 10MB입니다.</p>
        <p>다른 파일을 선택해 주세요.</p>
      </div>
    </BaseModal>
  );
}
