export type UploadToPresignedUrlArgs = {
  presignedUrl: string;
  file: File;
  mimeType?: string;
};

export async function uploadToPresignedUrl({
  presignedUrl,
  file,
  mimeType,
}: UploadToPresignedUrlArgs): Promise<void> {
  const normalizedMimeType = mimeType?.trim() || file.type || 'application/octet-stream';
  const res = await fetch(presignedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': normalizedMimeType,
    },
    body: file,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      text ? `S3 업로드 실패: ${res.status} ${text}` : `S3 업로드 실패: ${res.status}`,
    );
  }
}
