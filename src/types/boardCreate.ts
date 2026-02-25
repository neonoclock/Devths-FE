export type BoardAttachmentType = 'IMAGE' | 'PDF';
export type BoardAttachmentStatus = 'PENDING' | 'READY' | 'FAILED';

export type BoardAttachment = {
  id: string;
  type: BoardAttachmentType;
  name: string;
  size: number;
  file: File;
  previewUrl?: string;
  fileId?: number;
  status: BoardAttachmentStatus;
};
