import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import MyPageScreen from '@/components/mypage/MyPageScreen';
import { useMeQuery } from '@/lib/hooks/users/useMeQuery';
import { useMyCommentsInfiniteQuery } from '@/lib/hooks/users/useMyCommentsInfiniteQuery';
import { useMyPostsInfiniteQuery } from '@/lib/hooks/users/useMyPostsInfiniteQuery';

import type { MeData } from '@/lib/api/users';

const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockClear = vi.fn();

let intersectionCallback: IntersectionObserverCallback | null = null;

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}));

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt} />,
}));

vi.mock('@/components/common/ConfirmModal', () => ({
  default: () => null,
}));

vi.mock('@/components/mypage/EditProfileModal', () => ({
  default: () => null,
}));

vi.mock('@/components/mypage/WithdrawModal', () => ({
  default: () => null,
}));

vi.mock('@/lib/api/auth', () => ({
  postLogout: vi.fn(),
}));

vi.mock('@/lib/auth/token', () => ({
  clearAccessToken: vi.fn(),
}));

vi.mock('@/lib/toast/store', () => ({
  toast: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    clear: mockClear,
  }),
}));

vi.mock('@/lib/hooks/users/useMeQuery', () => ({
  useMeQuery: vi.fn(),
}));

vi.mock('@/lib/hooks/users/useMyPostsInfiniteQuery', () => ({
  useMyPostsInfiniteQuery: vi.fn(),
}));

vi.mock('@/lib/hooks/users/useMyCommentsInfiniteQuery', () => ({
  useMyCommentsInfiniteQuery: vi.fn(),
}));

const mockedUseMeQuery = vi.mocked(useMeQuery);
const mockedUseMyPostsInfiniteQuery = vi.mocked(useMyPostsInfiniteQuery);
const mockedUseMyCommentsInfiniteQuery = vi.mocked(useMyCommentsInfiniteQuery);

const meData: MeData = {
  id: 1,
  nickname: 'tester',
  profileImage: null,
  stats: {
    followerCount: 12,
    followingCount: 3,
  },
  interests: [],
};

function mockIntersectionObserver() {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds = [];

    constructor(cb: IntersectionObserverCallback) {
      intersectionCallback = cb;
    }

    disconnect = vi.fn();
    observe = vi.fn();
    takeRecords = vi.fn(() => []);
    unobserve = vi.fn();
  }

  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
}

function createPostsHookValue(overrides?: Partial<ReturnType<typeof useMyPostsInfiniteQuery>>) {
  return {
    data: {
      pages: [{ posts: [], hasNext: false, lastId: null }],
      pageParams: [],
    },
    isLoading: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useMyPostsInfiniteQuery>;
}

function createCommentsHookValue(
  overrides?: Partial<ReturnType<typeof useMyCommentsInfiniteQuery>>,
) {
  return {
    data: {
      pages: [{ comments: [], hasNext: false, lastId: null }],
      pageParams: [],
    },
    isLoading: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useMyCommentsInfiniteQuery>;
}

describe('MyPageScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    intersectionCallback = null;
    mockIntersectionObserver();

    mockedUseMeQuery.mockReturnValue({
      data: meData,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useMeQuery>);

    mockedUseMyPostsInfiniteQuery.mockReturnValue(createPostsHookValue());
    mockedUseMyCommentsInfiniteQuery.mockReturnValue(createCommentsHookValue());
  });

  it('내가 쓴 글/댓글 탭 토글 시 목록이 전환된다', async () => {
    const user = userEvent.setup();

    mockedUseMyPostsInfiniteQuery.mockReturnValue(
      createPostsHookValue({
        data: {
          pages: [
            {
              posts: [
                {
                  id: 11,
                  title: '내가 쓴 글 제목',
                  content: '본문',
                  likeCount: 0,
                  commentCount: 0,
                  shareCount: 0,
                  createdAt: '2026-01-01T10:20:00',
                },
              ],
              hasNext: false,
              lastId: null,
            },
          ],
          pageParams: [],
        },
      }),
    );

    mockedUseMyCommentsInfiniteQuery.mockReturnValue(
      createCommentsHookValue({
        data: {
          pages: [
            {
              comments: [
                {
                  id: 21,
                  postId: 11,
                  postTitle: '댓글 단 글 제목',
                  content: '내 댓글 내용',
                  createdAt: '2026-01-01T11:30:00',
                },
              ],
              hasNext: false,
              lastId: null,
            },
          ],
          pageParams: [],
        },
      }),
    );

    render(<MyPageScreen />);

    expect(screen.getByText('내가 쓴 글 제목')).toBeInTheDocument();
    expect(screen.queryByText('내 댓글 내용')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '내가 쓴 댓글' }));

    expect(screen.getByText('댓글 단 글 제목')).toBeInTheDocument();
    expect(screen.getByText('내 댓글 내용')).toBeInTheDocument();
    expect(screen.queryByText('내가 쓴 글 제목')).not.toBeInTheDocument();
  });

  it('글/댓글 목록이 비어 있으면 빈 상태 문구를 보여준다', async () => {
    const user = userEvent.setup();

    render(<MyPageScreen />);

    expect(screen.getByText('아직 작성한 게시글이 없습니다.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '내가 쓴 댓글' }));

    expect(screen.getByText('아직 작성한 댓글이 없습니다.')).toBeInTheDocument();
  });

  it('하단 도달 시 활성 탭의 다음 페이지를 요청한다', async () => {
    const user = userEvent.setup();
    const fetchMyPostsNextPage = vi.fn();
    const fetchMyCommentsNextPage = vi.fn();

    mockedUseMyPostsInfiniteQuery.mockReturnValue(
      createPostsHookValue({
        data: {
          pages: [
            {
              posts: [
                {
                  id: 11,
                  title: '글1',
                  content: '본문',
                  likeCount: 0,
                  commentCount: 0,
                  shareCount: 0,
                  createdAt: '2026-01-01T10:20:00',
                },
              ],
              hasNext: true,
              lastId: 11,
            },
          ],
          pageParams: [],
        },
        hasNextPage: true,
        fetchNextPage: fetchMyPostsNextPage,
      }),
    );

    mockedUseMyCommentsInfiniteQuery.mockReturnValue(
      createCommentsHookValue({
        data: {
          pages: [
            {
              comments: [
                {
                  id: 21,
                  postId: 11,
                  postTitle: '댓글 글',
                  content: '댓글',
                  createdAt: '2026-01-01T11:30:00',
                },
              ],
              hasNext: true,
              lastId: 21,
            },
          ],
          pageParams: [],
        },
        hasNextPage: true,
        fetchNextPage: fetchMyCommentsNextPage,
      }),
    );

    render(<MyPageScreen />);

    await waitFor(() => {
      expect(intersectionCallback).not.toBeNull();
    });

    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(fetchMyPostsNextPage).toHaveBeenCalledTimes(1);
    expect(fetchMyCommentsNextPage).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '내가 쓴 댓글' }));

    await waitFor(() => {
      expect(intersectionCallback).not.toBeNull();
    });

    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(fetchMyCommentsNextPage).toHaveBeenCalledTimes(1);
  });
});
