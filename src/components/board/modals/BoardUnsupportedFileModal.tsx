'use client';

import BaseModal from '@/components/common/BaseModal';

type BoardUnsupportedFileModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function BoardUnsupportedFileModal({
  open,
  onClose,
}: BoardUnsupportedFileModalProps) {
  return (
    <BaseModal open={open} onClose={onClose} title="지원하지 않는 파일 형식">
      <div className="space-y-1 text-sm text-neutral-600">
        <p>첨부 가능한 형식은 PDF, JPG, JPEG, PNG입니다.</p>
        <p>다른 파일을 선택해 주세요.</p>
      </div>
    </BaseModal>
  );
}
