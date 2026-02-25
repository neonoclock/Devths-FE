import { useCallback, useState } from 'react';

import type { BoardAttachment, BoardAttachmentType } from '@/types/boardCreate';

function createAttachmentId(file: File) {
  return `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`;
}

function createPreviewUrl(file: File) {
  return URL.createObjectURL(file);
}

export function useBoardAttachments() {
  const [attachments, setAttachments] = useState<BoardAttachment[]>([]);

  const addAttachments = useCallback((files: File[], type: BoardAttachmentType) => {
    const newAttachments = files.map((file) => ({
      id: createAttachmentId(file),
      type,
      name: file.name,
      size: file.size,
      file,
      previewUrl: type === 'IMAGE' || type === 'PDF' ? createPreviewUrl(file) : undefined,
      status: 'PENDING' as const,
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);
    return newAttachments;
  }, []);

  const updateAttachment = useCallback((id: string, patch: Partial<BoardAttachment>) => {
    setAttachments((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return { ...item, ...patch };
      }),
    );
  }, []);

  const replaceAttachmentFile = useCallback((id: string, file: File, previewUrl: string) => {
    let updated: BoardAttachment | null = null;
    setAttachments((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (item.previewUrl && item.previewUrl !== previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
        updated = {
          ...item,
          file,
          size: file.size,
          previewUrl,
          fileId: undefined,
          status: 'PENDING' as const,
        };
        return updated;
      }),
    );
    return updated;
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments((prev) => {
      prev.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
      return [];
    });
  }, []);

  return {
    attachments,
    setAttachments,
    addAttachments,
    updateAttachment,
    replaceAttachmentFile,
    removeAttachment,
    clearAttachments,
  };
}
