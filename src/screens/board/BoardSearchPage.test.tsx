import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  pushMock,
  backMock,
  replaceMock,
  setOptionsMock,
  resetOptionsMock,
  useBoardSearchInfiniteQueryMock,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  backMock: vi.fn(),
  replaceMock: vi.fn(),
  setOptionsMock: vi.fn(),
  resetOptionsMock: vi.fn(),
  useBoardSearchInfiniteQueryMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    back: backMock,
    replace: replaceMock,
  }),
}));

vi.mock('@/components/layout/HeaderContext', () => ({
  useHeader: () => ({
    setOptions: setOptionsMock,
    resetOptions: resetOptionsMock,
  }),
}));

vi.mock('@/lib/hooks/boards/useBoardSearchInfiniteQuery', () => ({
  useBoardSearchInfiniteQuery: (params: unknown) => useBoardSearchInfiniteQueryMock(params),
}));

vi.mock('@/components/board/BoardPostCard', () => ({
  default: ({
    post,
    onClick,
  }: {
    post: { postId: number; title: string };
    onClick?: (postId: number) => void;
  }) => (
    <button type="button" onClick={() => onClick?.(post.postId)}>
      card-{post.title}
    </button>
  ),
}));

vi.mock('@/components/llm/rooms/ListLoadMoreSentinel', () => ({
  default: ({
    onLoadMore,
    hasNextPage,
    isFetchingNextPage,
  }: {
    onLoadMore: () => void;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
  }) => (
    <button type="button" onClick={onLoadMore} disabled={!hasNextPage || isFetchingNextPage}>
      load-more
    </button>
  ),
}));

import BoardSearchPage from '@/screens/board/BoardSearchPage';

const RECENT_SEARCH_STORAGE_KEY = 'devths_board_recent_searches';

type MockSearchInfiniteParams = {
  keyword: string;
  size?: number;
};

type MockPage = {
  items: Array<{ postId: number; title: string }>;
  lastId: number | null;
  hasNext: boolean;
};

type MockSearchInfiniteResult = {
  data: {
    pages: MockPage[];
  };
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: ReturnType<typeof vi.fn>;
  fetchNextPage: ReturnType<typeof vi.fn>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
};

function createQueryResult(
  overrides?: Partial<MockSearchInfiniteResult>,
): MockSearchInfiniteResult {
  return {
    data: {
      pages: [],
    },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    ...overrides,
  };
}

function createLocalStorageMock() {
  const store = new Map<string, string>();

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

describe('BoardSearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window, 'localStorage', {
      value: createLocalStorageMock(),
      configurable: true,
    });
    window.localStorage.clear();

    useBoardSearchInfiniteQueryMock.mockImplementation(() => createQueryResult());
  });

  it('입력 검증 헬퍼 텍스트를 노출한다', async () => {
    const user = userEvent.setup();
    render(<BoardSearchPage />);

    await user.click(screen.getByRole('button', { name: '게시글 검색' }));
    expect(screen.getByText('검색어를 입력해 주세요.')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Search'), 'a');
    await user.click(screen.getByRole('button', { name: '게시글 검색' }));
    expect(screen.getByText('검색어는 2자 이상 입력해 주세요.')).toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText('Search'));
    await user.type(screen.getByPlaceholderText('Search'), 'a'.repeat(31));
    await user.click(screen.getByRole('button', { name: '게시글 검색' }));
    expect(screen.getByText('검색어는 최대 30자까지 입력할 수 있습니다.')).toBeInTheDocument();
  });

  it('최근 검색어 클릭 재검색과 X 삭제가 동작한다', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(RECENT_SEARCH_STORAGE_KEY, JSON.stringify(['react', 'spring']));

    render(<BoardSearchPage />);

    await user.click(screen.getByPlaceholderText('Search'));
    await user.click(screen.getByRole('button', { name: 'react' }));
    expect(screen.getByPlaceholderText('Search')).toHaveValue('react');

    await user.click(screen.getByPlaceholderText('Search'));
    await user.click(screen.getByRole('button', { name: 'spring 최근 검색어 삭제' }));
    expect(screen.queryByRole('button', { name: 'spring' })).not.toBeInTheDocument();

    const stored = JSON.parse(
      window.localStorage.getItem(RECENT_SEARCH_STORAGE_KEY) ?? '[]',
    ) as string[];
    expect(stored).toEqual(['react']);
  });

  it('검색 결과 카드를 렌더링하고 클릭 시 상세로 이동한다', async () => {
    const user = userEvent.setup();

    useBoardSearchInfiniteQueryMock.mockImplementation((params: MockSearchInfiniteParams) => {
      if (params.keyword === 'react') {
        return createQueryResult({
          data: {
            pages: [
              {
                items: [
                  { postId: 101, title: 'React 제목' },
                  { postId: 102, title: 'React 두번째' },
                ],
                lastId: null,
                hasNext: false,
              },
            ],
          },
        });
      }
      return createQueryResult();
    });

    render(<BoardSearchPage />);

    await user.type(screen.getByPlaceholderText('Search'), 'react');
    await user.click(screen.getByRole('button', { name: '게시글 검색' }));

    expect(await screen.findByRole('button', { name: 'card-React 제목' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'card-React 두번째' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'card-React 제목' }));
    expect(pushMock).toHaveBeenCalledWith('/board/101');
  });

  it('무한 스크롤 load more 동작으로 다음 결과를 이어서 표시한다', async () => {
    const user = userEvent.setup();
    const fetchNextPageMock = vi.fn();

    useBoardSearchInfiniteQueryMock.mockImplementation((params: MockSearchInfiniteParams) => {
      if (params.keyword !== 'infinite') {
        return createQueryResult();
      }

      return createQueryResult({
        data: {
          pages: [
            {
              items: [{ postId: 1, title: 'page-1' }],
              lastId: 11,
              hasNext: true,
            },
            {
              items: [{ postId: 2, title: 'page-2' }],
              lastId: null,
              hasNext: false,
            },
          ],
        },
        hasNextPage: true,
        fetchNextPage: fetchNextPageMock,
      });
    });

    render(<BoardSearchPage />);

    await user.type(screen.getByPlaceholderText('Search'), 'infinite');
    await user.click(screen.getByRole('button', { name: '게시글 검색' }));

    expect(await screen.findByRole('button', { name: 'card-page-1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'card-page-2' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'load-more' }));
    expect(fetchNextPageMock).toHaveBeenCalledTimes(1);
  });
});
