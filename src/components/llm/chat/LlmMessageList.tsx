'use client';

import { Bot } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { UIMessage } from '@/lib/utils/llm';
import type { ReactNode } from 'react';

type Props = {
  messages: UIMessage[];
  streamingMessageId?: string | null;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onRetry?: (messageId: string) => void;
  onDeleteFailed?: (messageId: string) => void;
  retryEvaluationMessageId?: string | null;
  onRetryEvaluation?: (messageId: string) => void;
  onFinishInterview?: (messageId: string) => void;
  isRetryEvaluationLoading?: boolean;
  isInterviewEvaluationActionsDisabled?: boolean;
};

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 text-[12px] text-neutral-500">
      <span>답변 생성 중</span>
      <span className="inline-flex items-center gap-0.5" aria-hidden="true">
        <span className="typing-indicator-dot" style={{ animationDelay: '0s' }} />
        <span className="typing-indicator-dot" style={{ animationDelay: '0.2s' }} />
        <span className="typing-indicator-dot" style={{ animationDelay: '0.4s' }} />
      </span>
    </div>
  );
}

function TypingCursor() {
  return (
    <span
      className="ml-0.5 inline-block animate-pulse text-[12px] font-semibold text-[#05C075]"
      aria-hidden="true"
    >
      ▍
    </span>
  );
}

function TypewriterText({ text }: { text: string }) {
  const [displayLength, setDisplayLength] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const displayLengthRef = useRef(displayLength);
  const textLengthRef = useRef(text.length);

  useEffect(() => {
    displayLengthRef.current = displayLength;
  }, [displayLength]);

  useEffect(() => {
    textLengthRef.current = text.length;
    if (intervalRef.current !== null) return;
    if (displayLengthRef.current >= text.length) return;

    const charsPerTick = 2;
    intervalRef.current = window.setInterval(() => {
      setDisplayLength((prev) => {
        const next = Math.min(prev + charsPerTick, textLengthRef.current);
        if (next >= textLengthRef.current && intervalRef.current !== null) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return next;
      });
    }, 16);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [text.length]);

  return <>{renderMarkdown(text.slice(0, displayLength))}</>;
}

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(`[^`]*`)/g);
  const nodes: ReactNode[] = [];

  parts.forEach((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      nodes.push(
        <code
          key={`code-${index}`}
          className="rounded bg-neutral-100 px-1 font-mono text-[11px] text-neutral-800"
        >
          {part.slice(1, -1)}
        </code>,
      );
      return;
    }

    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    boldParts.forEach((boldPart, boldIndex) => {
      if (boldPart.startsWith('**') && boldPart.endsWith('**') && boldPart.length > 4) {
        nodes.push(
          <strong key={`bold-${index}-${boldIndex}`} className="font-semibold">
            {boldPart.slice(2, -2)}
          </strong>,
        );
      } else if (boldPart) {
        nodes.push(<span key={`text-${index}-${boldIndex}`}>{boldPart}</span>);
      }
    });
  });

  return nodes;
}

function renderMarkdown(text: string): ReactNode[] {
  const blocks: ReactNode[] = [];
  const lines = text.split('\n');
  let paragraphLines: string[] = [];
  let listItems: string[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const paragraph = paragraphLines.join('\n');
    blocks.push(
      <p key={`p-${blocks.length}`} className="leading-5 whitespace-pre-wrap">
        {renderInline(paragraph)}
      </p>,
    );
    paragraphLines = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="list-disc space-y-1 pl-5">
        {listItems.map((item, index) => (
          <li key={`li-${blocks.length}-${index}`} className="leading-5 whitespace-pre-wrap">
            {renderInline(item)}
          </li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  for (const rawLine of lines) {
    const fenceLine = rawLine.trimStart();
    if (fenceLine.startsWith('```')) {
      if (inCodeBlock) {
        blocks.push(
          <pre
            key={`pre-${blocks.length}`}
            className="overflow-x-auto rounded-lg bg-neutral-900 px-3 py-2 text-[11px] text-neutral-100"
          >
            <code className="font-mono whitespace-pre-wrap">{codeLines.join('\n')}</code>
          </pre>,
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        flushParagraph();
        flushList();
        inCodeBlock = true;
        codeLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      continue;
    }

    const trimmedLine = rawLine.trim();

    if (!trimmedLine) {
      flushParagraph();
      flushList();
      continue;
    }

    if (trimmedLine.startsWith('### ')) {
      flushParagraph();
      flushList();
      blocks.push(
        <h3 key={`h3-${blocks.length}`} className="text-sm font-semibold">
          {renderInline(trimmedLine.slice(4))}
        </h3>,
      );
      continue;
    }

    if (trimmedLine.startsWith('## ')) {
      flushParagraph();
      flushList();
      blocks.push(
        <h2 key={`h2-${blocks.length}`} className="text-sm font-semibold">
          {renderInline(trimmedLine.slice(3))}
        </h2>,
      );
      continue;
    }

    if (trimmedLine.startsWith('# ')) {
      flushParagraph();
      flushList();
      blocks.push(
        <h1 key={`h1-${blocks.length}`} className="text-base font-semibold">
          {renderInline(trimmedLine.slice(2))}
        </h1>,
      );
      continue;
    }

    if (trimmedLine.startsWith('- ')) {
      flushParagraph();
      listItems.push(trimmedLine.slice(2));
      continue;
    }

    flushList();
    paragraphLines.push(rawLine);
  }

  if (inCodeBlock) {
    blocks.push(
      <pre
        key={`pre-${blocks.length}`}
        className="overflow-x-auto rounded-lg bg-neutral-900 px-3 py-2 text-[11px] text-neutral-100"
      >
        <code className="font-mono whitespace-pre-wrap">{codeLines.join('\n')}</code>
      </pre>,
    );
  }

  flushParagraph();
  flushList();

  return blocks;
}

export default function LlmMessageList({
  messages,
  streamingMessageId,
  onLoadMore,
  hasMore,
  isLoadingMore,
  onRetry,
  onDeleteFailed,
  retryEvaluationMessageId,
  onRetryEvaluation,
  onFinishInterview,
  isRetryEvaluationLoading = false,
  isInterviewEvaluationActionsDisabled = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number>(0);
  const isLoadingRef = useRef(false);
  const ignoreNextAutoScrollRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const hasInitialScrollRef = useRef(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !isLoadingRef.current) return;

    const newScrollHeight = container.scrollHeight;
    const scrollDiff = newScrollHeight - prevScrollHeightRef.current;

    if (scrollDiff > 0) {
      container.scrollTop += scrollDiff;
    }

    isLoadingRef.current = false;
  }, [messages]);

  // 초기 로딩 시 맨 아래로 스크롤
  useEffect(() => {
    const container = containerRef.current;
    if (!container || hasInitialScrollRef.current || messages.length === 0) return;

    // DOM이 완전히 렌더링된 후 스크롤
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
    isNearBottomRef.current = true;
    hasInitialScrollRef.current = true;
    prevMessageCountRef.current = messages.length;
  }, [messages]);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const bottomThreshold = 120;
    const distanceFromBottom =
      container.scrollHeight - (container.scrollTop + container.clientHeight);
    const isNearBottom = distanceFromBottom <= bottomThreshold;
    isNearBottomRef.current = isNearBottom;
    setShowJumpToLatest((prev) => (isNearBottom ? false : prev));

    if (!onLoadMore || !hasMore || isLoadingMore) return;

    const threshold = 100; // 상단에서 100px 이내
    if (container.scrollTop < threshold) {
      prevScrollHeightRef.current = container.scrollHeight;
      isLoadingRef.current = true;
      ignoreNextAutoScrollRef.current = true;
      onLoadMore();
    }
  }, [onLoadMore, hasMore, isLoadingMore]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 초기 스크롤은 useLayoutEffect에서 처리
    if (!hasInitialScrollRef.current) return;

    const bottomThreshold = 120;
    const distanceFromBottom =
      container.scrollHeight - (container.scrollTop + container.clientHeight);
    isNearBottomRef.current = distanceFromBottom <= bottomThreshold;

    if (ignoreNextAutoScrollRef.current) {
      ignoreNextAutoScrollRef.current = false;
      prevMessageCountRef.current = messages.length;
      return;
    }

    if (isLoadingRef.current) {
      prevMessageCountRef.current = messages.length;
      return;
    }

    if (messages.length > prevMessageCountRef.current) {
      const newMessages = messages.slice(prevMessageCountRef.current);
      const hasUserMessage = newMessages.some((m) => m.role === 'USER');
      if (hasUserMessage || isNearBottomRef.current) {
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      } else {
        queueMicrotask(() => setShowJumpToLatest(true));
      }
    }

    prevMessageCountRef.current = messages.length;
  }, [messages]);

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={containerRef} className="h-full overflow-y-auto bg-white px-4 py-4">
        {isLoadingMore && (
          <div className="mb-3 flex justify-center">
            <span className="text-xs text-neutral-400">이전 메시지 불러오는 중...</span>
          </div>
        )}
        <div className="space-y-3">
          {messages.map((m) => {
            if (m.role === 'SYSTEM') {
              return (
                <div key={m.id} className="flex justify-center">
                  <span className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] text-neutral-600">
                    {m.text}
                  </span>
                </div>
              );
            }

            const isUser = m.role === 'USER';
            const isStreaming = m.id === streamingMessageId;

            return (
              <div key={m.id} className={isUser ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={
                    isUser ? 'flex max-w-[85%] items-end gap-2' : 'flex max-w-[85%] items-end gap-2'
                  }
                >
                  {!isUser ? (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#05C075]/30 bg-[#05C075]/10">
                      <Bot className="h-4 w-4 text-[#05C075]" aria-hidden="true" />
                    </div>
                  ) : null}

                  <div
                    className={
                      isUser
                        ? 'order-2 flex flex-col items-end'
                        : 'order-1 flex flex-col items-start'
                    }
                  >
                    <div
                      className={[
                        'relative rounded-2xl px-3 py-2 text-sm leading-5',
                        isUser
                          ? 'bg-[#05C075] text-white'
                          : 'border border-[#05C075] bg-white text-neutral-900',
                        m.status === 'sending' ? 'opacity-60' : '',
                        m.status === 'failed' ? 'border-red-300 bg-red-50' : '',
                      ].join(' ')}
                    >
                      {m.role === 'AI' && m.text.trim().length === 0 ? (
                        <TypingIndicator />
                      ) : (
                        <div className="space-y-2">
                          {!isUser && isStreaming ? (
                            <>
                              <TypewriterText text={m.text} />
                              <TypingCursor />
                            </>
                          ) : (
                            <>{renderMarkdown(m.text)}</>
                          )}
                        </div>
                      )}
                      {m.attachments && m.attachments.length > 0 ? (
                        <div className="mt-2 space-y-1">
                          {m.attachments.map((att, index) => (
                            <div
                              key={`${m.id}-att-${index}`}
                              className={[
                                'flex items-center gap-2 rounded-lg border px-2 py-1 text-[11px]',
                                isUser
                                  ? 'border-white/20 text-white/90'
                                  : 'border-neutral-300 text-neutral-700',
                              ].join(' ')}
                            >
                              <span
                                className={[
                                  'inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px]',
                                  isUser
                                    ? 'bg-white/20 text-white'
                                    : 'bg-neutral-300 text-neutral-600',
                                ].join(' ')}
                              >
                                {att.type === 'image' ? 'IMG' : 'PDF'}
                              </span>
                              <span className="truncate">{att.name}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {m.status === 'failed' ? (
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[10px] text-red-500">전송 실패</span>
                        <button
                          type="button"
                          onClick={() => onRetry?.(m.id)}
                          className="text-[10px] text-neutral-500 underline hover:text-neutral-700"
                        >
                          재전송
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteFailed?.(m.id)}
                          className="text-[10px] text-neutral-500 underline hover:text-neutral-700"
                        >
                          삭제
                        </button>
                      </div>
                    ) : m.time ? (
                      <span className="mt-1 text-[10px] text-neutral-400">{m.time}</span>
                    ) : null}
                    {!isUser &&
                    m.isInterviewEvaluation &&
                    m.id === retryEvaluationMessageId &&
                    onRetryEvaluation ? (
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onRetryEvaluation(m.id)}
                          disabled={
                            isRetryEvaluationLoading || isInterviewEvaluationActionsDisabled
                          }
                          className="rounded-lg border border-[#05C075] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#05C075] hover:bg-[#05C075]/5 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          면접 평가 다시받기
                        </button>
                        {onFinishInterview ? (
                          <button
                            type="button"
                            onClick={() => onFinishInterview(m.id)}
                            disabled={
                              isRetryEvaluationLoading || isInterviewEvaluationActionsDisabled
                            }
                            className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            면접 끝내기
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {showJumpToLatest ? (
        <button
          type="button"
          onClick={() => {
            const container = containerRef.current;
            if (!container) return;
            container.scrollTop = container.scrollHeight;
            setShowJumpToLatest(false);
          }}
          className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#05C075] px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#04A865]"
        >
          최근 메시지로 이동
        </button>
      ) : null}
    </div>
  );
}
