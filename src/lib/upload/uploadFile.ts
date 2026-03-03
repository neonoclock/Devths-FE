import { postPresigned, postFileMeta, type FileCategory, type FileRefType } from '@/lib/api/files';
import { uploadToPresignedUrl } from '@/lib/upload/s3Presigned';

import type { ApiResponse } from '@/types/api';

export type UploadFileOptions = {
  file: File;
  category?: FileCategory | null;
  refType: FileRefType;
  refId?: number | null;
  sortOrder?: number;
  mimeType?: string;
};

export type UploadFileResult = {
  fileId: number;
  s3Key: string;
};

export async function uploadFile(options: UploadFileOptions): Promise<UploadFileResult> {
  const { file, category, refType, refId, sortOrder = 1, mimeType } = options;
  const normalizedMimeType = mimeType?.trim() || file.type || 'application/octet-stream';

  const presignedResult = await postPresigned({
    fileName: file.name,
    mimeType: normalizedMimeType,
  });

  if (!presignedResult.ok || !presignedResult.json) {
    throw new Error('Presigned URL 발급에 실패했습니다.');
  }

  const presignedJson = presignedResult.json as ApiResponse<{
    presignedUrl: string;
    s3Key: string;
  }>;
  const { presignedUrl, s3Key } = presignedJson.data;

  await uploadToPresignedUrl({ presignedUrl, file, mimeType: normalizedMimeType });

  const metaResult = await postFileMeta({
    originalName: file.name,
    s3Key,
    mimeType: normalizedMimeType,
    ...(category !== undefined ? { category } : {}),
    fileSize: file.size,
    refType,
    refId,
    sortOrder,
  });

  if (!metaResult.ok || !metaResult.json) {
    throw new Error('파일 메타 등록에 실패했습니다.');
  }

  const metaJson = metaResult.json as ApiResponse<{
    fileId: number;
    s3Key: string;
    createdAt: string;
  }>;

  return {
    fileId: metaJson.data.fileId,
    s3Key: metaJson.data.s3Key,
  };
}
