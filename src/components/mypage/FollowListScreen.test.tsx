import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import FollowListScreen from '@/components/mypage/FollowListScreen';
import { useFollowUserMutation } from '@/lib/hooks/users/useFollowUserMutation';
import { useMyFollowersInfiniteQuery } from '@/lib/hooks/users/useMyFollowersInfiniteQuery';
import { useMyFollowingsInfiniteQuery } from '@/lib/hooks/users/useMyFollowingsInfiniteQuery';
import { useUnfollowUserMutation } from '@/lib/hooks/users/useUnfollowUserMutation';

const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockUseQuery = vi.fn();
const mockRefetchProfile = vi.fn();

let currentTab: 'followers' | 'followings' = 'followers';
let intersectionCallback: IntersectionObserverCallback | null = null;

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  usePathname: () => '/profile/follows',
  useSearchParams: () => new URLSearchParams(`tab=${currentTab}`),
}));

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt} />,
}));

vi.mock('@/components/common/ConfirmModal', () => ({
  default: () => null,
}));

vi.mock('@/components/mypage/FollowUserProfileModal', () => ({
  default: ({
    open,
    user,
    onClickFollow,
  }: {
    open: boolean;
    user: { nickname: string; isFollowing?: boolean } | null;
    onClickFollow?: () => void;
  }) =>
    open && user ? (
      <div data-testid="profile-modal">
        <p>{user.nickname}</p>
        <p data-testid="follow-state">{user.isFollowing ? '언팔로잉' : '팔로잉'}</p>
        <button type="button" onClick={onClickFollow}>
          follow-action
        </button>
      </div>
    ) : null,
}));

vi.mock('@/lib/toast/store', () => ({
  toast: vi.fn(),
}));

vi.mock('@/lib/hooks/users/useMyFollowersInfiniteQuery', () => ({
  useMyFollowersInfiniteQuery: vi.fn(),
}));

vi.mock('@/lib/hooks/users/useMyFollowingsInfiniteQuery', () => ({
  useMyFollowingsInfiniteQuery: vi.fn(),
}));

vi.mock('@/lib/hooks/users/useFollowUserMutation', () => ({
  useFollowUserMutation: vi.fn(),
}));

vi.mock('@/lib/hooks/users/useUnfollowUserMutation', () => ({
  useUnfollowUserMutation: vi.fn(),
}));

const mockedUseMyFollowersInfiniteQuery = vi.mocked(useMyFollowersInfiniteQuery);
const mockedUseMyFollowingsInfiniteQuery = vi.mocked(useMyFollowingsInfiniteQuery);
const mockedUseFollowUserMutation = vi.mocked(useFollowUserMutation);
const mockedUseUnfollowUserMutation = vi.mocked(useUnfollowUserMutation);

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

function createFollowersHookValue(
  overrides?: Partial<ReturnType<typeof useMyFollowersInfiniteQuery>>,
) {
  return {
    data: {
      pages: [{ followers: [], hasNext: false, lastId: null }],
      pageParams: [],
    },
    isLoading: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useMyFollowersInfiniteQuery>;
}

function createFollowingsHookValue(
  overrides?: Partial<ReturnType<typeof useMyFollowingsInfiniteQuery>>,
) {
  return {
    data: {
      pages: [{ followings: [], hasNext: false, lastId: null }],
      pageParams: [],
    },
    isLoading: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useMyFollowingsInfiniteQuery>;
}

describe('FollowListScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentTab = 'followers';
    intersectionCallback = null;
    mockIntersectionObserver();

    mockReplace.mockImplementation((url: string) => {
      const tab = new URLSearchParams(url.split('?')[1] ?? '').get('tab');
      currentTab = tab === 'followings' ? 'followings' : 'followers';
    });

    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      refetch: mockRefetchProfile,
    });

    mockedUseMyFollowersInfiniteQuery.mockReturnValue(createFollowersHookValue());
    mockedUseMyFollowingsInfiniteQuery.mockReturnValue(createFollowingsHookValue());
    mockedUseFollowUserMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useFollowUserMutation>);
    mockedUseUnfollowUserMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUnfollowUserMutation>);
  });

  it('팔로워/팔로잉 탭 클릭 시 탭 쿼리가 전환된다', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<FollowListScreen />);

    await user.click(screen.getByRole('button', { name: '팔로잉' }));

    expect(mockReplace).toHaveBeenCalledWith('/profile/follows?tab=followings');

    rerender(<FollowListScreen />);

    expect(screen.getByText('현재 탭: 팔로잉')).toBeInTheDocument();
  });

  it('활성 탭에 맞는 인피니트 스크롤 fetchNextPage를 호출한다', async () => {
    const user = userEvent.setup();
    const fetchFollowersNextPage = vi.fn();
    const fetchFollowingsNextPage = vi.fn();

    mockedUseMyFollowersInfiniteQuery.mockReturnValue(
      createFollowersHookValue({
        data: {
          pages: [
            {
              followers: [
                {
                  id: 1,
                  userId: 101,
                  nickname: 'follower-1',
                  profileImage: null,
                  isFollowing: false,
                },
              ],
              hasNext: true,
              lastId: 1,
            },
          ],
          pageParams: [],
        },
        hasNextPage: true,
        fetchNextPage: fetchFollowersNextPage,
      }),
    );

    mockedUseMyFollowingsInfiniteQuery.mockReturnValue(
      createFollowingsHookValue({
        data: {
          pages: [
            {
              followings: [
                {
                  id: 2,
                  userId: 202,
                  nickname: 'following-1',
                  profileImage: null,
                  isFollowing: true,
                },
              ],
              hasNext: true,
              lastId: 2,
            },
          ],
          pageParams: [],
        },
        hasNextPage: true,
        fetchNextPage: fetchFollowingsNextPage,
      }),
    );

    const { rerender } = render(<FollowListScreen />);

    await waitFor(() => {
      expect(intersectionCallback).not.toBeNull();
    });

    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(fetchFollowersNextPage).toHaveBeenCalledTimes(1);
    expect(fetchFollowingsNextPage).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '팔로잉' }));
    rerender(<FollowListScreen />);

    await waitFor(() => {
      expect(intersectionCallback).not.toBeNull();
    });

    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(fetchFollowingsNextPage).toHaveBeenCalledTimes(1);
  });

  it('프로필 모달 팔로우 상태가 팔로잉 -> 언팔로잉으로 변경된다', async () => {
    const user = userEvent.setup();
    const followMutateAsync = vi.fn().mockResolvedValue({});

    mockedUseMyFollowersInfiniteQuery.mockReturnValue(
      createFollowersHookValue({
        data: {
          pages: [
            {
              followers: [
                {
                  id: 1,
                  userId: 101,
                  nickname: 'follower-1',
                  profileImage: null,
                  isFollowing: false,
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

    mockedUseFollowUserMutation.mockReturnValue({
      mutateAsync: followMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useFollowUserMutation>);

    render(<FollowListScreen />);

    await user.click(screen.getByRole('button', { name: /follower-1/i }));

    expect(screen.getByTestId('follow-state')).toHaveTextContent('팔로잉');

    await user.click(screen.getByRole('button', { name: 'follow-action' }));

    await waitFor(() => {
      expect(followMutateAsync).toHaveBeenCalledWith(101);
    });

    await waitFor(() => {
      expect(screen.getByTestId('follow-state')).toHaveTextContent('언팔로잉');
    });
  });
});
