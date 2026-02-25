'use client';

import { Loader2, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BoardPostCard from '@/components/board/BoardPostCard';
import { useHeader } from '@/components/layout/HeaderContext';
import ListLoadMoreSentinel from '@/components/llm/rooms/ListLoadMoreSentinel';
import { useBoardSearchInfiniteQuery } from '@/lib/hooks/boards/useBoardSearchInfiniteQuery';

const RECENT_SEARCH_STORAGE_KEY = 'devths_board_recent_searches';
const MAX_RECENT_SEARCH_COUNT = 10;
const SEARCH_PAGE_SIZE = 20;
const SEARCH_QUERY_PARAM_KEY = 'q';

type KeywordValidationResult = {
  isValid: boolean;
  helperText: string | null;
  normalizedKeyword: string;
};

function readRecentKeywords(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(RECENT_SEARCH_STORAGE_KEY);
    if (raw === null) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .slice(0, MAX_RECENT_SEARCH_COUNT);
  } catch {
    return [];
  }
}

function writeRecentKeywords(keywords: string[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(RECENT_SEARCH_STORAGE_KEY, JSON.stringify(keywords));
}

function addRecentKeyword(previousKeywords: string[], keyword: string) {
  const deduplicated = previousKeywords.filter((item) => item !== keyword);
  return [keyword, ...deduplicated].slice(0, MAX_RECENT_SEARCH_COUNT);
}

function readKeywordFromLocation() {
  if (typeof window === 'undefined') {
    return '';
  }

  return (new URLSearchParams(window.location.search).get(SEARCH_QUERY_PARAM_KEY) ?? '').trim();
}

function buildSearchPageUrl(keyword: string) {
  if (typeof window === 'undefined') {
    return '/board/search';
  }

  const url = new URL(window.location.href);
  const normalizedKeyword = keyword.trim();
  if (normalizedKeyword.length > 0) {
    url.searchParams.set(SEARCH_QUERY_PARAM_KEY, normalizedKeyword);
  } else {
    url.searchParams.delete(SEARCH_QUERY_PARAM_KEY);
  }

  return url.searchParams.toString()
    ? `${url.pathname}?${url.searchParams.toString()}`
    : url.pathname;
}

function validateKeyword(value: string): KeywordValidationResult {
  const normalizedKeyword = value.trim();

  if (normalizedKeyword.length === 0) {
    return {
      isValid: false,
      helperText: '검색어를 입력해 주세요.',
      normalizedKeyword,
    };
  }

  if (normalizedKeyword.length < 2) {
    return {
      isValid: false,
      helperText: '검색어는 2자 이상 입력해 주세요.',
      normalizedKeyword,
    };
  }

  if (normalizedKeyword.length > 30) {
    return {
      isValid: false,
      helperText: '검색어는 최대 30자까지 입력할 수 있습니다.',
      normalizedKeyword,
    };
  }

  return {
    isValid: true,
    helperText: null,
    normalizedKeyword,
  };
}

export default function BoardSearchPage() {
  const router = useRouter();
  const { setOptions, resetOptions } = useHeader();
  const searchSectionRef = useRef<HTMLElement | null>(null);
  const [keywordInput, setKeywordInput] = useState(() => readKeywordFromLocation());
  const [submittedKeyword, setSubmittedKeyword] = useState(() => readKeywordFromLocation());
  const [helperText, setHelperText] = useState<string | null>(null);
  const [recentKeywords, setRecentKeywords] = useState<string[]>(() => readRecentKeywords());
  const [isSearchInputActive, setIsSearchInputActive] = useState(false);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useBoardSearchInfiniteQuery({
    keyword: submittedKeyword,
    size: SEARCH_PAGE_SIZE,
  });
  const posts = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);
  const hasSubmittedKeyword = submittedKeyword.length > 0;
  const resultCount = posts.length;

  const handleBackClick = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/board');
  }, [router]);

  useEffect(() => {
    setOptions({
      title: '게시글 검색',
      showBackButton: true,
      onBackClick: handleBackClick,
    });

    return () => resetOptions();
  }, [handleBackClick, resetOptions, setOptions]);

  useEffect(() => {
    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (searchSectionRef.current?.contains(target)) {
        return;
      }

      setIsSearchInputActive(false);
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);

    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown);
    };
  }, []);

  const executeSearch = useCallback(
    (rawKeyword: string) => {
      const validation = validateKeyword(rawKeyword);
      if (!validation.isValid) {
        setHelperText(validation.helperText);
        return;
      }

      setHelperText(null);
      setSubmittedKeyword(validation.normalizedKeyword);
      router.replace(buildSearchPageUrl(validation.normalizedKeyword), { scroll: false });
      setRecentKeywords((previousKeywords) => {
        const nextKeywords = addRecentKeyword(previousKeywords, validation.normalizedKeyword);
        writeRecentKeywords(nextKeywords);
        return nextKeywords;
      });
    },
    [router],
  );

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      executeSearch(keywordInput);
    },
    [executeSearch, keywordInput],
  );

  const handleKeywordChange = useCallback(
    (value: string) => {
      setKeywordInput(value);

      const normalizedInput = value.trim();
      if (submittedKeyword.length > 0 && normalizedInput !== submittedKeyword) {
        setSubmittedKeyword('');
        router.replace(buildSearchPageUrl(''), { scroll: false });
      }

      if (helperText === null) {
        return;
      }

      const validation = validateKeyword(value);
      setHelperText(validation.helperText);
    },
    [helperText, router, submittedKeyword],
  );

  const handleRecentKeywordClick = useCallback(
    (keyword: string) => {
      setKeywordInput(keyword);
      executeSearch(keyword);
    },
    [executeSearch],
  );

  const handleRecentKeywordDelete = useCallback((keyword: string) => {
    setRecentKeywords((previousKeywords) => {
      const nextKeywords = previousKeywords.filter((item) => item !== keyword);
      writeRecentKeywords(nextKeywords);
      return nextKeywords;
    });
  }, []);

  const handlePostClick = useCallback(
    (postId: number) => {
      router.push(`/board/${postId}`);
    },
    [router],
  );

  const handleLoadMore = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) {
      return;
    }
    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <main className="px-3 pt-4 pb-3">
      <div className="space-y-4">
        <section ref={searchSectionRef} className="rounded-2xl bg-white px-4 py-4">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search"
                value={keywordInput}
                onFocus={() => setIsSearchInputActive(true)}
                onClick={() => setIsSearchInputActive(true)}
                onChange={(event) => handleKeywordChange(event.target.value)}
                className="h-10 w-full rounded-xl border border-neutral-200 bg-white pr-3 pl-9 text-sm text-neutral-900 transition outline-none focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              aria-label="게시글 검색"
              className="h-10 shrink-0 rounded-xl bg-emerald-600 px-3 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              검색
            </button>
          </form>
          {helperText !== null ? <p className="mt-2 text-xs text-red-500">{helperText}</p> : null}

          {isSearchInputActive && recentKeywords.length > 0 ? (
            <div className="mt-3 rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-3">
              <p className="text-sm font-semibold text-neutral-900">최근 검색어</p>
              <ul className="mt-2 space-y-2">
                {recentKeywords.map((keyword) => (
                  <li key={keyword} className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleRecentKeywordClick(keyword)}
                      className="min-w-0 flex-1 truncate text-left text-sm text-neutral-700 transition hover:text-emerald-700"
                    >
                      {keyword}
                    </button>
                    <button
                      type="button"
                      aria-label={`${keyword} 최근 검색어 삭제`}
                      onClick={() => handleRecentKeywordDelete(keyword)}
                      className="rounded-md px-1 text-sm text-neutral-400 transition hover:text-neutral-700"
                    >
                      X
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl bg-white px-4 py-4">
          <p className="text-sm font-semibold text-neutral-900">게시글 ({resultCount})</p>
          <div className="mt-3">
            {!hasSubmittedKeyword ? (
              <div className="px-3 py-6 text-center text-xs text-neutral-500">
                검색어를 입력하고 검색해 주세요.
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-200 px-3 py-6 text-xs text-neutral-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>검색 결과를 불러오는 중...</span>
              </div>
            ) : isError ? (
              <div className="rounded-xl border border-dashed border-neutral-200 px-3 py-6 text-center text-xs text-neutral-500">
                <p>{error instanceof Error ? error.message : '검색 결과를 불러오지 못했습니다.'}</p>
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="mt-3 rounded-full border border-neutral-200 bg-white px-4 py-1 text-[11px] font-semibold text-neutral-700 transition hover:bg-neutral-50"
                >
                  다시 시도
                </button>
              </div>
            ) : resultCount === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-200 px-3 py-6 text-center text-xs text-neutral-500">
                검색 결과가 없습니다.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-3">
                  {posts.map((post) => (
                    <BoardPostCard key={post.postId} post={post} onClick={handlePostClick} />
                  ))}
                </div>
                <ListLoadMoreSentinel
                  onLoadMore={handleLoadMore}
                  hasNextPage={hasNextPage ?? false}
                  isFetchingNextPage={isFetchingNextPage}
                  hasNextText="스크롤로 더 보기"
                  loadingText="추가 검색 결과를 불러오는 중..."
                  endText="모든 검색 결과를 불러왔습니다"
                />
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
