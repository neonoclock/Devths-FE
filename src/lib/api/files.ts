import { apiRequest } from '@/lib/api/client';

import type { ApiErrorResponse, ApiResponse } from '@/types/api';

export type PresignedSignupRequest = {
  fileName: string;
  mimeType: string;
};

export type PresignedSignupData = {
  presignedUrl: string;
  s3Key: string;
};

export type PostPresignedSignupResult = {
  ok: boolean;
  status: number;
  json: (ApiResponse<PresignedSignupData> | ApiErrorResponse) | null;
};

export async function postPresignedSignup(
  body: PresignedSignupRequest,
): Promise<PostPresignedSignupResult> {
  const { ok, status, json } = await apiRequest<PresignedSignupData>({
    method: 'POST',
    path: '/api/files/presigned/signup',
    body,
    withAuth: false,
  });

  return { ok, status, json };
}

export type PresignedRequest = {
  fileName: string;
  mimeType: string;
};

export type PresignedData = {
  presignedUrl: string;
  s3Key: string;
};

export async function postPresigned(body: PresignedRequest) {
  const { ok, status, json } = await apiRequest<PresignedData>({
    method: 'POST',
    path: '/api/files/presigned',
    body,
    withAuth: true,
  });

  return { ok, status, json };
}

export type FileCategory = 'RESUME' | 'PORTFOLIO' | 'JOB_POSTING' | 'AI_CHAT_ATTACHMENT';
export type FileRefType = 'CHATROOM' | 'POST' | 'MESSAGE' | 'USER';

export type PostFileMetaRequest = {
  originalName: string;
  s3Key: string;
  mimeType: string;
  category?: FileCategory | null;
  fileSize: number;
  refType: FileRefType;
  refId?: number | null;
  sortOrder?: number;
};

export type PostFileMetaData = {
  fileId: number;
  s3Key: string;
  createdAt: string;
};

export async function postFileMeta(body: PostFileMetaRequest) {
  const { ok, status, json } = await apiRequest<PostFileMetaData>({
    method: 'POST',
    path: '/api/files',
    body,
    withAuth: true,
  });

  return { ok, status, json };
}

export async function deleteFile(fileId: number) {
  const { ok, status, json } = await apiRequest<void>({
    method: 'DELETE',
    path: `/api/files/${fileId}`,
    withAuth: true,
  });

  return { ok, status, json };
}
