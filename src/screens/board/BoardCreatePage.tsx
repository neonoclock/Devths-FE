'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BoardAttachmentCard from '@/components/board/BoardAttachmentCard';
import BoardAttachmentMaskModal from '@/components/board/BoardAttachmentMaskModal';
import BoardAttachmentPreviewModal from '@/components/board/BoardAttachmentPreviewModal';
import BoardMarkdownPreview from '@/components/board/BoardMarkdownPreview';
import BoardTagSelector from '@/components/board/BoardTagSelector';
import BoardFileTooLargeModal from '@/components/board/modals/BoardFileTooLargeModal';
import BoardPartialAttachFailModal from '@/components/board/modals/BoardPartialAttachFailModal';
import BoardUnsupportedFileModal from '@/components/board/modals/BoardUnsupportedFileModal';
import ConfirmModal from '@/components/common/ConfirmModal';
import { useHeader } from '@/components/layout/HeaderContext';
import { useNavigationGuard } from '@/components/layout/NavigationGuardContext';
import {
  BOARD_ATTACHMENT_CONSTRAINTS,
  BOARD_CONTENT_MAX_LENGTH,
  BOARD_FILE_MIME_TYPES,
  BOARD_IMAGE_MIME_TYPES,
  BOARD_TITLE_MAX_LENGTH,
} from '@/constants/boardCreate';
import { createBoardPost } from '@/lib/api/boards';
import { useBoardAttachments } from '@/lib/hooks/boards/useBoardAttachments';
import { toast } from '@/lib/toast/store';
import { uploadFile } from '@/lib/upload/uploadFile';
import { validateFiles } from '@/lib/validators/attachment';
import { validateBoardCreateContent, validateBoardCreateTitle } from '@/lib/validators/boardCreate';

import type { BoardTag } from '@/types/board';
import type { BoardAttachment } from '@/types/boardCreate';

export default function BoardCreatePage() {
  const router = useRouter();
  const { setOptions, resetOptions } = useHeader();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPreview, setIsPreview] = useState(false);
  const [tags, setTags] = useState<BoardTag[]>([]);
  const {
    attachments,
    addAttachments,
    updateAttachment,
    replaceAttachmentFile,
    removeAttachment,
    clearAttachments,
  } = useBoardAttachments();
  const [previewAttachment, setPreviewAttachment] = useState<BoardAttachment | null>(null);
  const [maskAttachment, setMaskAttachment] = useState<BoardAttachment | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleError = useMemo(() => validateBoardCreateTitle(title), [title]);
  const contentError = useMemo(() => validateBoardCreateContent(content), [content]);
  const isSubmitEnabled = useMemo(() => !titleError && !contentError, [contentError, titleError]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileTooLargeOpen, setFileTooLargeOpen] = useState(false);
  const [unsupportedFileOpen, setUnsupportedFileOpen] = useState(false);
  const [partialFailOpen, setPartialFailOpen] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const pendingNavigationRef = useRef<(() => void) | null>(null);
  const { setBlocked, setBlockMessage, setBlockedNavigationHandler } = useNavigationGuard();
  const queryClient = useQueryClient();

  const isDirty = useMemo(
    () => title.trim().length > 0 || content.trim().length > 0,
    [content, title],
  );

  const handleBackClick = useCallback(() => {
    router.push('/board');
  }, [router]);

  const handleSubmit = useCallback(async () => {
    if (!isSubmitEnabled || isSubmitting) return;
    const hasPending = attachments.some((attachment) => attachment.status === 'PENDING');
    if (hasPending) {
      toast('첨부 파일 업로드가 완료될 때까지 기다려 주세요.');
      return;
    }
    const hasFailed = attachments.some((attachment) => attachment.status === 'FAILED');
    if (hasFailed) {
      toast('업로드에 실패한 파일이 있습니다. 삭제 후 다시 시도해 주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const trimmedTitle = title.trim();
      const trimmedContent = content.trim();
      const fileIds = attachments
        .filter((attachment) => attachment.status === 'READY' && attachment.fileId)
        .map((attachment) => attachment.fileId!) as number[];

      await createBoardPost({
        title: trimmedTitle,
        content: trimmedContent,
        tags: tags.length > 0 ? tags : undefined,
        fileIds: fileIds.length > 0 ? fileIds : undefined,
      });

      toast('게시글이 등록되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['boards', 'list'], exact: false });
      router.push('/board');
    } catch (error) {
      const message = error instanceof Error ? error.message : '게시글 등록에 실패했습니다.';
      toast(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [attachments, isSubmitEnabled, isSubmitting, queryClient, router, tags, title, content]);

  const rightSlot = useMemo(
    () => (
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!isSubmitEnabled || isSubmitting}
        className={
          !isSubmitEnabled || isSubmitting
            ? 'rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-400'
            : 'rounded-full bg-[#05C075] px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-[#05C075]/30 transition hover:bg-[#04A865]'
        }
      >
        {isSubmitting ? '등록 중...' : '등록'}
      </button>
    ),
    [handleSubmit, isSubmitEnabled, isSubmitting],
  );

  useEffect(() => {
    setOptions({
      title: '게시글 작성',
      showBackButton: true,
      onBackClick: handleBackClick,
      rightSlot,
    });

    return () => resetOptions();
  }, [handleBackClick, resetOptions, rightSlot, setOptions]);

  useEffect(() => {
    setBlocked(isDirty);
    if (isDirty) {
      setBlockMessage('작성 중인 내용이 있습니다.');
    } else {
      setBlockMessage('답변 생성 중에는 이동할 수 없습니다.');
    }
    return () => {
      setBlocked(false);
      setBlockMessage('답변 생성 중에는 이동할 수 없습니다.');
    };
  }, [isDirty, setBlocked, setBlockMessage]);

  useEffect(() => {
    if (!isDirty) {
      setBlockedNavigationHandler(null);
      return;
    }

    setBlockedNavigationHandler(() => (action: () => void) => {
      pendingNavigationRef.current = action;
      setExitConfirmOpen(true);
    });

    return () => setBlockedNavigationHandler(null);
  }, [isDirty, setBlockedNavigationHandler]);

  const handleExitConfirm = useCallback(() => {
    setExitConfirmOpen(false);
    setTitle('');
    setContent('');
    setTags([]);
    setIsPreview(false);
    clearAttachments();
    const action = pendingNavigationRef.current;
    pendingNavigationRef.current = null;
    if (action) {
      action();
    }
  }, [clearAttachments]);

  const handleExitCancel = useCallback(() => {
    pendingNavigationRef.current = null;
    setExitConfirmOpen(false);
  }, []);

  const handlePickImages = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const handlePickFiles = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleCloseFileTooLarge = useCallback(() => setFileTooLargeOpen(false), []);
  const handleCloseUnsupportedFile = useCallback(() => setUnsupportedFileOpen(false), []);
  const handleClosePartialFail = useCallback(() => setPartialFailOpen(false), []);
  const handleClosePreview = useCallback(() => setPreviewAttachment(null), []);
  const handleCloseMask = useCallback(() => setMaskAttachment(null), []);
  const handlePreviewAttachment = useCallback((target: BoardAttachment) => {
    setPreviewAttachment(target);
  }, []);
  const handleMaskAttachment = useCallback((target: BoardAttachment) => {
    if (target.type !== 'IMAGE') {
      toast('이미지 파일만 마스킹할 수 있어요.');
      return;
    }
    setMaskAttachment(target);
  }, []);

  const uploadAttachments = useCallback(
    async (targets: BoardAttachment[]) => {
      await Promise.all(
        targets.map(async (attachment, index) => {
          try {
            const result = await uploadFile({
              file: attachment.file,
              category: 'AI_CHAT_ATTACHMENT',
              refType: 'POST',
              refId: null,
              sortOrder: index + 1,
            });
            updateAttachment(attachment.id, { fileId: result.fileId, status: 'READY' });
          } catch {
            updateAttachment(attachment.id, { status: 'FAILED' });
          }
        }),
      );
    },
    [updateAttachment],
  );

  const handleMaskComplete = useCallback(
    (file: File, previewUrl: string) => {
      if (!maskAttachment) return;
      const updated = replaceAttachmentFile(maskAttachment.id, file, previewUrl);
      setMaskAttachment(null);
      if (updated) {
        void uploadAttachments([updated]);
      }
    },
    [maskAttachment, replaceAttachmentFile, uploadAttachments],
  );

  const openErrorModal = useCallback((errors: Array<{ code: string }>, hasSuccess: boolean) => {
    if (hasSuccess && errors.length > 0) {
      setPartialFailOpen(true);
      return;
    }

    const hasTooLarge = errors.some((error) => error.code === 'FILE_TOO_LARGE');
    if (hasTooLarge) {
      setFileTooLargeOpen(true);
      return;
    }

    const hasInvalidType = errors.some((error) => error.code === 'INVALID_MIME_TYPE');
    if (hasInvalidType) {
      setUnsupportedFileOpen(true);
      return;
    }

    if (errors.length > 0) {
      setPartialFailOpen(true);
    }
  }, []);

  const handleImagesChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      if (files.length === 0) return;
      const existingImages = attachments.filter((item) => item.type === 'IMAGE').length;
      const existingFiles = attachments.filter((item) => item.type === 'PDF').length;
      const { okFiles, errors } = validateFiles(
        files,
        BOARD_ATTACHMENT_CONSTRAINTS,
        existingImages,
        existingFiles,
      );
      if (okFiles.length > 0) {
        const newAttachments = addAttachments(okFiles, 'IMAGE');
        void uploadAttachments(newAttachments);
      }
      if (errors.length > 0) {
        openErrorModal(errors, okFiles.length > 0);
      }
      event.target.value = '';
    },
    [addAttachments, attachments, openErrorModal, uploadAttachments],
  );

  const handleFilesChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      if (files.length === 0) return;
      const existingImages = attachments.filter((item) => item.type === 'IMAGE').length;
      const existingFiles = attachments.filter((item) => item.type === 'PDF').length;
      const { okFiles, errors } = validateFiles(
        files,
        BOARD_ATTACHMENT_CONSTRAINTS,
        existingImages,
        existingFiles,
      );
      if (okFiles.length > 0) {
        const newAttachments = addAttachments(okFiles, 'PDF');
        void uploadAttachments(newAttachments);
      }
      if (errors.length > 0) {
        openErrorModal(errors, okFiles.length > 0);
      }
      event.target.value = '';
    },
    [addAttachments, attachments, openErrorModal, uploadAttachments],
  );

  return (
    <main className="px-3 pt-4 pb-6">
      <section className="sticky top-14 z-10 rounded-2xl bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
        연락처, 계좌번호, 주민번호 등 개인정보 공유를 삼가해 주세요.
      </section>

      <section className="mt-4 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-neutral-900">제목</span>
            <span className="text-xs text-rose-500">*</span>
          </div>
          <input
            type="text"
            value={title}
            maxLength={BOARD_TITLE_MAX_LENGTH}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="제목을 입력하세요"
            className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#05C075] focus:ring-2 focus:ring-[#05C075]/20 focus:outline-none"
          />
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>{titleError ?? ' '}</span>
            <span>
              {title.trim().length}/{BOARD_TITLE_MAX_LENGTH}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-neutral-900">내용</span>
              <span className="text-xs text-rose-500">*</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPreview(false)}
                className={
                  isPreview
                    ? 'rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-500'
                    : 'rounded-full bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-white'
                }
              >
                편집
              </button>
              <button
                type="button"
                onClick={() => setIsPreview(true)}
                className={
                  isPreview
                    ? 'rounded-full bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-white'
                    : 'rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-500'
                }
              >
                미리보기
              </button>
            </div>
          </div>

          {isPreview ? (
            <div className="min-h-[180px] rounded-2xl border border-neutral-200 bg-white px-4 py-3">
              <BoardMarkdownPreview content={content} />
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={BOARD_CONTENT_MAX_LENGTH}
              placeholder="마크다운으로 작성해 보세요. 예: # 제목, - 목록, ```코드```"
              className="min-h-[180px] w-full resize-none rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#05C075] focus:ring-2 focus:ring-[#05C075]/20 focus:outline-none"
            />
          )}
          <div className="flex items-center justify-end text-xs text-neutral-400">
            <span>
              {content.length}/{BOARD_CONTENT_MAX_LENGTH}
            </span>
          </div>
        </div>

        <BoardTagSelector value={tags} onChange={setTags} />

        <div className="space-y-2">
          <span className="text-sm font-semibold text-neutral-900">첨부</span>
          <div className="rounded-2xl border border-dashed border-neutral-200 bg-white px-4 py-4">
            <div className="flex flex-col gap-2 text-sm text-neutral-500">
              <button
                type="button"
                onClick={handlePickImages}
                className="inline-flex items-center justify-between rounded-xl border border-neutral-200 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
              >
                사진 업로드
                <span className="text-xs text-neutral-400">
                  {BOARD_IMAGE_MIME_TYPES.join(', ')}
                </span>
              </button>
              <button
                type="button"
                onClick={handlePickFiles}
                className="inline-flex items-center justify-between rounded-xl border border-neutral-200 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
              >
                파일 업로드
                <span className="text-xs text-neutral-400">{BOARD_FILE_MIME_TYPES.join(', ')}</span>
              </button>
            </div>
            <p className="mt-3 text-xs text-neutral-400">
              사진(JPG/JPEG/PNG)은 최대 10장, 파일(PDF)은 최대 5개까지 첨부할 수 있으며 파일당 최대
              10MB를 지원합니다.
            </p>
            {attachments.length > 0 ? (
              <p className="mt-2 text-xs text-neutral-400">현재 첨부 {attachments.length}개</p>
            ) : null}
          </div>
          {attachments.length > 0 ? (
            <div className="mt-3 grid gap-3">
              {attachments.map((attachment) => (
                <BoardAttachmentCard
                  key={attachment.id}
                  attachment={attachment}
                  onRemove={removeAttachment}
                  onPreview={handlePreviewAttachment}
                  onMask={handleMaskAttachment}
                />
              ))}
            </div>
          ) : null}
          <input
            ref={imageInputRef}
            type="file"
            accept={BOARD_IMAGE_MIME_TYPES.join(',')}
            multiple
            onChange={handleImagesChange}
            className="hidden"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept={BOARD_FILE_MIME_TYPES.join(',')}
            multiple
            onChange={handleFilesChange}
            className="hidden"
          />
        </div>
      </section>

      <BoardFileTooLargeModal open={fileTooLargeOpen} onClose={handleCloseFileTooLarge} />
      <BoardUnsupportedFileModal open={unsupportedFileOpen} onClose={handleCloseUnsupportedFile} />
      <BoardPartialAttachFailModal open={partialFailOpen} onClose={handleClosePartialFail} />
      {previewAttachment ? (
        <BoardAttachmentPreviewModal
          key={previewAttachment.id}
          attachment={previewAttachment}
          onClose={handleClosePreview}
        />
      ) : null}
      {maskAttachment ? (
        <BoardAttachmentMaskModal
          key={maskAttachment.id}
          attachment={maskAttachment}
          onClose={handleCloseMask}
          onComplete={handleMaskComplete}
        />
      ) : null}
      <ConfirmModal
        isOpen={exitConfirmOpen}
        title="작성 중인 내용이 있습니다"
        message="작성 중인 내용을 저장하지 않고 나가시겠습니까?"
        confirmText="나가기"
        cancelText="취소"
        onConfirm={handleExitConfirm}
        onCancel={handleExitCancel}
      />
    </main>
  );
}
