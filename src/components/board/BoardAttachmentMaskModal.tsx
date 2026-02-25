'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BaseModal from '@/components/common/BaseModal';

import type { BoardAttachment } from '@/types/boardCreate';

type MaskRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type BoardAttachmentMaskModalProps = {
  attachment: BoardAttachment;
  onClose: () => void;
  onComplete: (file: File, previewUrl: string) => void;
};

const BLOCK_SIZE = 12;
const MIN_RECT_SIZE = 6;

function applyMosaic(ctx: CanvasRenderingContext2D, rect: MaskRect) {
  const { x, y, width, height } = rect;
  const startX = Math.max(0, Math.floor(x));
  const startY = Math.max(0, Math.floor(y));
  const endX = Math.min(ctx.canvas.width, Math.floor(x + width));
  const endY = Math.min(ctx.canvas.height, Math.floor(y + height));

  for (let py = startY; py < endY; py += BLOCK_SIZE) {
    for (let px = startX; px < endX; px += BLOCK_SIZE) {
      const imageData = ctx.getImageData(px, py, 1, 1).data;
      ctx.fillStyle = `rgba(${imageData[0]}, ${imageData[1]}, ${imageData[2]}, ${
        imageData[3] / 255
      })`;
      ctx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
    }
  }
}

export default function BoardAttachmentMaskModal({
  attachment,
  onClose,
  onComplete,
}: BoardAttachmentMaskModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [rects, setRects] = useState<MaskRect[]>([]);
  const [currentRect, setCurrentRect] = useState<MaskRect | null>(null);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);

  const isReady = attachment.type === 'IMAGE';

  useEffect(() => {
    if (!isReady) {
      imageRef.current = null;
      return;
    }

    let tempUrl: string | null = null;
    const image = new Image();
    if (attachment.previewUrl) {
      image.src = attachment.previewUrl;
    } else {
      tempUrl = URL.createObjectURL(attachment.file);
      image.src = tempUrl;
    }
    image.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(image, 0, 0);
      imageRef.current = image;
    };

    return () => {
      if (tempUrl) {
        URL.revokeObjectURL(tempUrl);
      }
    };
  }, [attachment, isReady]);

  const redraw = useCallback(
    (previewRect?: MaskRect | null) => {
      const canvas = canvasRef.current;
      const image = imageRef.current;
      if (!canvas || !image) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0);

      rects.forEach((rect) => applyMosaic(ctx, rect));

      if (previewRect) {
        ctx.save();
        ctx.strokeStyle = '#05C075';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(previewRect.x, previewRect.y, previewRect.width, previewRect.height);
        ctx.restore();
      }
    },
    [rects],
  );

  useEffect(() => {
    if (!isReady) return;
    redraw(currentRect);
  }, [currentRect, isReady, redraw]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isReady) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;
      startPointRef.current = { x, y };
      setCurrentRect({ x, y, width: 0, height: 0 });
    },
    [isReady],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isReady) return;
      if (!startPointRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;
      const start = startPointRef.current;
      const nextRect = {
        x: Math.min(start.x, x),
        y: Math.min(start.y, y),
        width: Math.abs(x - start.x),
        height: Math.abs(y - start.y),
      };
      setCurrentRect(nextRect);
    },
    [isReady],
  );

  const finalizeRect = useCallback(() => {
    if (!startPointRef.current || !currentRect) return;
    if (currentRect.width < MIN_RECT_SIZE || currentRect.height < MIN_RECT_SIZE) {
      setCurrentRect(null);
      startPointRef.current = null;
      return;
    }
    setRects((prev) => [...prev, currentRect]);
    setCurrentRect(null);
    startPointRef.current = null;
  }, [currentRect]);

  const handlePointerUp = useCallback(() => {
    if (!isReady) return;
    finalizeRect();
  }, [finalizeRect, isReady]);

  const handlePointerLeave = useCallback(() => {
    if (!isReady) return;
    finalizeRect();
  }, [finalizeRect, isReady]);

  const handleReset = useCallback(() => {
    setRects([]);
    setCurrentRect(null);
    startPointRef.current = null;
  }, []);

  const handleComplete = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((result) => resolve(result), 'image/png'),
    );
    if (!blob || !attachment) return;
    const fileName = attachment.name.endsWith('.png')
      ? attachment.name
      : `${attachment.name.replace(/\.[^/.]+$/, '')}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });
    const previewUrl = URL.createObjectURL(file);
    onComplete(file, previewUrl);
  }, [attachment, onComplete]);

  const bodyText = useMemo(() => {
    if (attachment.type !== 'IMAGE') return null;
    return (
      <p className="text-xs text-neutral-500">
        마스킹할 영역을 드래그해 주세요. 여러 영역을 선택할 수 있습니다.
      </p>
    );
  }, [attachment.type]);

  if (attachment.type !== 'IMAGE') return null;

  return (
    <BaseModal open onClose={onClose} title="개인정보 가리기" contentClassName="space-y-4">
      {bodyText}
      <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-3">
        <canvas
          ref={canvasRef}
          className="max-h-[360px] w-full touch-none rounded-xl bg-white"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleReset}
          className="flex-1 rounded-full border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
        >
          초기화
        </button>
        <button
          type="button"
          onClick={handleComplete}
          className="flex-1 rounded-full bg-[#05C075] px-3 py-2 text-sm font-semibold text-white shadow-sm shadow-[#05C075]/30 hover:bg-[#04A865]"
        >
          완료
        </button>
      </div>
    </BaseModal>
  );
}
