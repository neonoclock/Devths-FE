'use client';

import BaseModal from '@/components/common/BaseModal';

type BoardPartialAttachFailModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function BoardPartialAttachFailModal({
  open,
  onClose,
}: BoardPartialAttachFailModalProps) {
  return (
    <BaseModal open={open} onClose={onClose} title="일부 파일 첨부 실패">
      <div className="space-y-1 text-sm text-neutral-600">
        <p>선택한 파일 중 일부는 첨부할 수 없어요.</p>
        <p>(최대 10MB / PDF, JPG, JPEG, PNG만 가능)</p>
      </div>
    </BaseModal>
  );
}
