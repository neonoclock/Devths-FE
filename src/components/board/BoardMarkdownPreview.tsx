'use client';

import { BOARD_CONTENT_MIN_LENGTH } from '@/constants/boardCreate';
import { renderMarkdownToHtml } from '@/lib/utils/markdown';

type BoardMarkdownPreviewProps = {
  content: string;
};

export default function BoardMarkdownPreview({ content }: BoardMarkdownPreviewProps) {
  const trimmed = content.trim();

  if (trimmed.length === 0) {
    return (
      <p className="text-sm text-neutral-400">
        미리보기할 내용이 없습니다. 편집 탭에서 내용을 입력하세요.
      </p>
    );
  }

  if (trimmed.length < BOARD_CONTENT_MIN_LENGTH) {
    return (
      <p className="text-sm text-neutral-400">내용을 조금 더 작성한 후 미리보기를 확인해 주세요.</p>
    );
  }

  const html = renderMarkdownToHtml(content);

  return <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: html }} />;
}
