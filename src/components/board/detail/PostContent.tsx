'use client';

import { renderMarkdownToHtml } from '@/lib/utils/markdown';

import type { BoardTag } from '@/types/board';
import type { PostDetailAttachment } from '@/types/boardDetail';

type PostContentProps = {
  title: string;
  content: string;
  tags?: BoardTag[];
  attachments?: PostDetailAttachment[];
};

function formatFileSize(bytes: number) {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    return `${mb.toFixed(2)}MB`;
  }
  const kb = bytes / 1024;
  return `${kb.toFixed(1)}KB`;
}

export default function PostContent({
  title,
  content,
  tags = [],
  attachments = [],
}: PostContentProps) {
  const trimmed = content.trim();
  const html = trimmed.length > 0 ? renderMarkdownToHtml(content) : '';
  const sortedAttachments = [...attachments].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="mt-3">
      <h1 className="text-xl font-semibold text-neutral-900">{title}</h1>
      {trimmed.length > 0 ? (
        <div className="markdown-preview mt-2 text-sm" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className="mt-2 text-sm text-neutral-400">내용이 없습니다.</p>
      )}

      {sortedAttachments.length > 0 ? (
        <div className="mt-3 space-y-2">
          {sortedAttachments.map((attachment) => {
            if (attachment.fileType === 'IMAGE') {
              return (
                <div
                  key={attachment.fileId}
                  className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={attachment.fileUrl}
                    alt={attachment.fileName}
                    className="w-full object-cover"
                  />
                </div>
              );
            }

            if (attachment.fileType === 'VIDEO') {
              return (
                <div
                  key={attachment.fileId}
                  className="overflow-hidden rounded-xl border border-neutral-200 bg-black"
                >
                  <video controls src={attachment.fileUrl} className="w-full" />
                </div>
              );
            }

            return (
              <a
                key={attachment.fileId}
                href={attachment.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700"
              >
                <span className="truncate">{attachment.fileName}</span>
                <span className="ml-3 text-xs text-neutral-400">
                  {formatFileSize(attachment.fileSize)}
                </span>
              </a>
            );
          })}
        </div>
      ) : null}

      {tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[#1FAE73]">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md border border-[#BFEFDB] bg-[#E9F9F1] px-2 py-0.5 font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
