'use client';

import { Paperclip } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import LlmAttachmentSheet from '@/components/llm/analysis/LlmAttachmentSheet';
import LlmLoadingModal from '@/components/llm/analysis/LlmLoadingModal';
import LlmTextAreaCard from '@/components/llm/analysis/LlmTextAreaCard';
import {
  IMAGE_MIME_TYPES,
  FILE_MIME_TYPES,
  LLM_ATTACHMENT_CONSTRAINTS,
  LLM_PDF_MAX_PAGES,
} from '@/constants/attachment';
import { createRoom, startAnalysis } from '@/lib/api/llmRooms';
import { useAnalysisTaskStore } from '@/lib/llm/analysisTaskStore';
import { toast } from '@/lib/toast/store';
import { uploadFile } from '@/lib/upload/uploadFile';
import { getPdfPageCount } from '@/lib/utils/pdf';
import { getAnalysisDisabledReason } from '@/lib/validators/analysisForm';
import { validateFiles } from '@/lib/validators/attachment';

import type { ApiResponse } from '@/types/api';
import type {
  AnalysisDocumentInput,
  AnalysisFormState,
  CreateRoomResponse,
  DocumentInput,
  StartAnalysisResponse,
} from '@/types/llm';

type Target = 'RESUME' | 'JOB' | null;

type Props = {
  roomId: string;
  numericRoomId?: number;
};

const EMPTY_DOCUMENT: DocumentInput = {
  text: '',
  images: [],
  pdf: null,
};

export default function LlmAnalysisPage({ roomId, numericRoomId: propNumericRoomId }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<AnalysisFormState>({
    resume: { ...EMPTY_DOCUMENT },
    jobPosting: { ...EMPTY_DOCUMENT },
    model: 'GEMINI',
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [target, setTarget] = useState<Target>(null);
  const [isLoading, setIsLoading] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { activeTask, setActiveTask, clearActiveTask } = useAnalysisTaskStore();
  const isAnalysisActive =
    activeTask !== null && activeTask.status !== 'COMPLETED' && activeTask.status !== 'FAILED';

  const baseDisabledReason = getAnalysisDisabledReason(form.resume, form.jobPosting);
  const disabledReason =
    isAnalysisActive && !isLoading
      ? '분석이 진행 중입니다. 잠시만 기다려주세요.'
      : baseDisabledReason;
  const isSubmitDisabled = isLoading || disabledReason !== null;

  const [currentTaskId, setCurrentTaskId] = useState<number | null>(null);
  useEffect(() => {
    if (!activeTask && currentTaskId) {
      setIsLoading(false);
    }
  }, [activeTask, currentTaskId]);

  const handleCloseLoading = useCallback(() => {
    setIsLoading(false);
    router.push('/llm');
  }, [router]);

  const updateResume = useCallback((updates: Partial<DocumentInput>) => {
    setForm((prev) => ({
      ...prev,
      resume: { ...prev.resume, ...updates },
    }));
  }, []);

  const updateJobPosting = useCallback((updates: Partial<DocumentInput>) => {
    setForm((prev) => ({
      ...prev,
      jobPosting: { ...prev.jobPosting, ...updates },
    }));
  }, []);

  const getCurrentDoc = useCallback(() => {
    return target === 'RESUME' ? form.resume : form.jobPosting;
  }, [target, form.resume, form.jobPosting]);

  const getUpdateFn = useCallback(() => {
    return target === 'RESUME' ? updateResume : updateJobPosting;
  }, [target, updateResume, updateJobPosting]);

  const handlePickImages = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const handlePickFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      const doc = getCurrentDoc();
      const updateFn = getUpdateFn();

      const { okFiles, errors } = validateFiles(
        files,
        LLM_ATTACHMENT_CONSTRAINTS,
        doc.images.length,
        0,
      );

      if (errors.length > 0) {
        toast(errors[0].message);
      }

      if (okFiles.length > 0) {
        updateFn({ images: [...doc.images, ...okFiles] });
      }

      e.target.value = '';
    },
    [getCurrentDoc, getUpdateFn],
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const files = Array.from(input.files || []);
      if (files.length === 0) return;

      try {
        const doc = getCurrentDoc();
        const updateFn = getUpdateFn();

        const { okFiles, errors } = validateFiles(
          files,
          LLM_ATTACHMENT_CONSTRAINTS,
          0,
          doc.pdf ? 1 : 0,
        );

        if (errors.length > 0) {
          toast(errors[0].message);
        }

        if (okFiles.length > 0) {
          const file = okFiles[0];
          try {
            const pageCount = await getPdfPageCount(file);
            if (pageCount > LLM_PDF_MAX_PAGES) {
              toast(`PDF는 최대 ${LLM_PDF_MAX_PAGES}장까지 첨부할 수 있습니다.`);
              return;
            }
          } catch {
            toast('PDF를 확인할 수 없습니다. 잠금 상태인 파일은 첨부할 수 없습니다.');
            return;
          }

          updateFn({ pdf: file });
        }
      } finally {
        input.value = '';
      }
    },
    [getCurrentDoc, getUpdateFn],
  );

  const handlePasteBlocked = useCallback(() => {
    toast('파일은 첨부 버튼을 이용해 주세요.');
  }, []);

  const handleRemoveResumeImage = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      resume: {
        ...prev.resume,
        images: prev.resume.images.filter((_, i) => i !== index),
      },
    }));
  }, []);

  const handleRemoveResumePdf = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      resume: { ...prev.resume, pdf: null },
    }));
  }, []);

  const handleRemoveJobImage = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      jobPosting: {
        ...prev.jobPosting,
        images: prev.jobPosting.images.filter((_, i) => i !== index),
      },
    }));
  }, []);

  const handleRemoveJobPdf = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      jobPosting: { ...prev.jobPosting, pdf: null },
    }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (isAnalysisActive) {
      toast('분석 중입니다. 잠시만 기다려주세요.');
      return;
    }
    setIsLoading(true);

    try {
      const startedAt = Date.now();
      let numericRoomId = propNumericRoomId || 0;
      let roomUuid = roomId;
      let roomTitle = 'AI 분석';

      if (roomId === 'new') {
        const createResult = await createRoom();
        if (!createResult.ok || !createResult.json) {
          throw new Error('채팅방 생성에 실패했습니다.');
        }
        const createJson = createResult.json as ApiResponse<CreateRoomResponse>;
        numericRoomId = createJson.data.roomId;
        roomUuid = createJson.data.roomUuid;
        roomTitle = createJson.data.title || 'AI 분석';
        setActiveTask({
          taskId: 0,
          roomId: numericRoomId,
          roomUuid,
          roomTitle,
          status: 'PENDING',
          model: form.model,
          startedAt,
        });
      } else {
        setActiveTask({
          taskId: 0,
          roomId: numericRoomId,
          roomUuid,
          roomTitle,
          status: 'PENDING',
          model: form.model,
          startedAt,
        });
      }

      // 이력서 파일 업로드 (PDF 또는 이미지)
      const resumeInput: AnalysisDocumentInput = {
        fileId: null,
        s3Key: null,
        fileType: null,
        text: form.resume.text || null,
      };

      if (form.resume.pdf) {
        const result = await uploadFile({
          file: form.resume.pdf,
          category: 'RESUME',
          refType: 'CHATROOM',
          refId: numericRoomId,
        });
        resumeInput.fileId = result.fileId;
        resumeInput.s3Key = result.s3Key;
        resumeInput.fileType = form.resume.pdf.type;
      } else if (form.resume.images.length > 0) {
        const result = await uploadFile({
          file: form.resume.images[0],
          category: 'RESUME',
          refType: 'CHATROOM',
          refId: numericRoomId,
        });
        resumeInput.fileId = result.fileId;
        resumeInput.s3Key = result.s3Key;
        resumeInput.fileType = form.resume.images[0].type;
      }

      const jobPostInput: AnalysisDocumentInput = {
        fileId: null,
        s3Key: null,
        fileType: null,
        text: form.jobPosting.text || null,
      };

      if (form.jobPosting.pdf) {
        const result = await uploadFile({
          file: form.jobPosting.pdf,
          category: 'JOB_POSTING',
          refType: 'CHATROOM',
          refId: numericRoomId,
        });
        jobPostInput.fileId = result.fileId;
        jobPostInput.s3Key = result.s3Key;
        jobPostInput.fileType = form.jobPosting.pdf.type;
      } else if (form.jobPosting.images.length > 0) {
        const result = await uploadFile({
          file: form.jobPosting.images[0],
          category: 'JOB_POSTING',
          refType: 'CHATROOM',
          refId: numericRoomId,
        });
        jobPostInput.fileId = result.fileId;
        jobPostInput.s3Key = result.s3Key;
        jobPostInput.fileType = form.jobPosting.images[0].type;
      }

      const analysisResult = await startAnalysis(numericRoomId, {
        model: form.model,
        resume: resumeInput,
        jobPost: jobPostInput,
      });

      if (!analysisResult.ok || !analysisResult.json) {
        throw new Error('분석 요청에 실패했습니다.');
      }

      const analysisJson = analysisResult.json as ApiResponse<StartAnalysisResponse>;
      const { taskId } = analysisJson.data;

      setCurrentTaskId(taskId);
      setActiveTask({
        taskId,
        roomId: numericRoomId,
        roomUuid,
        roomTitle,
        status: analysisJson.data.status ?? 'PENDING',
        model: form.model,
        startedAt,
      });
    } catch (err) {
      setIsLoading(false);
      clearActiveTask();
      toast(err instanceof Error ? err.message : '분석 요청 중 오류가 발생했습니다.');
    }
  }, [
    form.resume.pdf,
    form.resume.images,
    form.resume.text,
    form.jobPosting.pdf,
    form.jobPosting.images,
    form.jobPosting.text,
    form.model,
    roomId,
    propNumericRoomId,
    isAnalysisActive,
    setActiveTask,
    clearActiveTask,
  ]);

  return (
    <main className="flex min-h-[calc(100dvh-56px-64px)] flex-col bg-transparent px-5 pt-6 pb-5">
      <input
        ref={imageInputRef}
        type="file"
        accept={IMAGE_MIME_TYPES.join(',')}
        multiple
        className="hidden"
        onChange={handleImageChange}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={FILE_MIME_TYPES.join(',')}
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="divide-y divide-neutral-200">
        <div className="pb-5">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-neutral-500">
            <span className="h-1.5 w-1.5 rounded-full bg-[#05C075]" />
            AI ANALYSIS
          </div>
          <h1 className="mt-2 text-[22px] font-bold text-neutral-900">AI 분석</h1>
          <p className="mt-2 text-sm text-neutral-500">
            이력서와 채용 공고를 입력하면
            <br />
            핵심 요약과 개선 포인트를 알려드려요.
          </p>
        </div>

        <LlmTextAreaCard
          label="이력서 및 포트폴리오"
          placeholder={`이력서/포트폴리오 내용을 붙여 넣거나 직접 입력하세요. 잠금 상태인 파일은 첨부할 수 없습니다.`}
          value={form.resume.text}
          onChange={(text) => updateResume({ text })}
          onPasteBlocked={handlePasteBlocked}
          helperText={null}
          attachments={{ images: form.resume.images, pdf: form.resume.pdf }}
          onRemoveImage={handleRemoveResumeImage}
          onRemovePdf={handleRemoveResumePdf}
          textDisabled={form.resume.images.length > 0 || form.resume.pdf !== null}
          headerRight={
            <button
              type="button"
              onClick={() => {
                setTarget('RESUME');
                setSheetOpen(true);
              }}
              disabled={form.resume.text.trim().length > 0}
              className={[
                'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors',
                form.resume.text.trim().length > 0
                  ? 'cursor-not-allowed bg-[#E5E8EB] text-[#ADB5BD]'
                  : 'bg-[#05C075]/10 text-[#05C075] active:bg-[#05C075]/20',
              ].join(' ')}
            >
              <Paperclip className="h-4 w-4" strokeWidth={2} />
              첨부
            </button>
          }
        />

        <LlmTextAreaCard
          label="채용 공고"
          placeholder="채용 공고 내용을 붙여 넣거나 직접 입력하세요"
          value={form.jobPosting.text}
          onChange={(text) => updateJobPosting({ text })}
          onPasteBlocked={handlePasteBlocked}
          attachments={{ images: form.jobPosting.images, pdf: form.jobPosting.pdf }}
          onRemoveImage={handleRemoveJobImage}
          onRemovePdf={handleRemoveJobPdf}
          textDisabled={form.jobPosting.images.length > 0 || form.jobPosting.pdf !== null}
          headerRight={
            <button
              type="button"
              onClick={() => {
                setTarget('JOB');
                setSheetOpen(true);
              }}
              disabled={form.jobPosting.text.trim().length > 0}
              className={[
                'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors',
                form.jobPosting.text.trim().length > 0
                  ? 'cursor-not-allowed bg-[#E5E8EB] text-[#ADB5BD]'
                  : 'bg-[#05C075]/10 text-[#05C075] active:bg-[#05C075]/20',
              ].join(' ')}
            >
              <Paperclip className="h-4 w-4" strokeWidth={2} />
              첨부
            </button>
          }
        />
      </div>

      <div className="mt-auto pt-8 pb-8">
        {disabledReason && (
          <p className="mb-3 text-center text-[13px] text-[#8B95A1]">{disabledReason}</p>
        )}
        <button
          type="button"
          disabled={isSubmitDisabled}
          onClick={handleSubmit}
          className={[
            'w-full rounded-2xl py-4 text-[17px] font-semibold transition-colors',
            isSubmitDisabled
              ? 'cursor-not-allowed bg-[#E5E8EB] text-[#ADB5BD]'
              : 'bg-[#05C075] text-white active:bg-[#049e61]',
          ].join(' ')}
        >
          종합 분석하기
        </button>
      </div>

      <LlmAttachmentSheet
        open={sheetOpen}
        title={target === 'RESUME' ? '이력서/포트폴리오 첨부' : '채용 공고 첨부'}
        onClose={() => setSheetOpen(false)}
        onPickImages={handlePickImages}
        onPickFile={handlePickFile}
      />

      {isLoading ? <LlmLoadingModal onClose={handleCloseLoading} /> : null}
    </main>
  );
}
