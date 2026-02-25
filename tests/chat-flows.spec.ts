import { expect, test, type Locator, type Page, type Route } from '@playwright/test';

type MockRoomType = 'PRIVATE' | 'GROUP';
type MockMessageType = 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM';

type MockRoom = {
  roomId: number;
  type: MockRoomType;
  title: string | null;
  roomName: string | null;
  isAlarmOn: boolean;
  inviteCode: string | null;
  createdAt: string;
  currentCount: number;
  lastMessageContent: string | null;
  lastMessageAt: string | null;
  tag: string | null;
};

type MockMessage = {
  messageId: number;
  sender: {
    userId: number;
    nickname: string;
    profileImage: string | null;
  } | null;
  type: MockMessageType;
  content: string | null;
  s3Key: string | null;
  createdAt: string;
  isDeleted: boolean;
};

type MockFollowing = {
  id: number;
  userId: number;
  nickname: string;
  profileImage: string | null;
  isFollowing: boolean;
};

type MockState = {
  rooms: MockRoom[];
  leftRoomsById: Record<number, MockRoom>;
  messagesByRoomId: Record<number, MockMessage[]>;
  followings: MockFollowing[];
  nextRoomId: number;
  lastReadByRoomId: Record<number, number | null>;
  privateRoomByTargetUserId: Record<number, number>;
  putRoomSettingsBodies: Array<{
    roomId: number;
    roomName?: string;
    isAlarmOn: boolean;
  }>;
  leaveRoomIds: number[];
  deleteMessageIds: Array<{ roomId: number; messageId: number }>;
};

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
const ACCESS_TOKEN_KEY = 'devths_access_token';
const CURRENT_USER_ID = 101;

function nowIso() {
  return new Date('2026-02-19T12:00:00+09:00').toISOString();
}

function toBase64Url(value: string) {
  return Buffer.from(value).toString('base64url');
}

function createFakeJwt(userId: number) {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = toBase64Url(
    JSON.stringify({
      userId,
      sub: String(userId),
      exp: 2_000_000_000,
    }),
  );
  return `${header}.${payload}.signature`;
}

function sortRoomsForList(rooms: MockRoom[]) {
  return [...rooms].sort((a, b) => {
    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : Number.NEGATIVE_INFINITY;
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : Number.NEGATIVE_INFINITY;
    if (aTime !== bTime) {
      return bTime - aTime;
    }
    return b.roomId - a.roomId;
  });
}

function createInitialState(): MockState {
  const createdAt = nowIso();

  const room1: MockRoom = {
    roomId: 1,
    type: 'PRIVATE',
    title: '스터디방',
    roomName: '민수',
    isAlarmOn: true,
    inviteCode: 'ROOM0001',
    createdAt,
    currentCount: 2,
    lastMessageContent: '삭제 테스트 메시지',
    lastMessageAt: '2026-02-19T11:59:00',
    tag: null,
  };

  const room2: MockRoom = {
    roomId: 2,
    type: 'GROUP',
    title: '그룹채팅',
    roomName: '프로젝트',
    isAlarmOn: true,
    inviteCode: 'ROOM0002',
    createdAt,
    currentCount: 3,
    lastMessageContent: '설정 테스트',
    lastMessageAt: '2026-02-19T11:20:00',
    tag: null,
  };

  return {
    rooms: [room1, room2],
    leftRoomsById: {},
    messagesByRoomId: {
      1: [
        {
          messageId: 1000,
          sender: {
            userId: 202,
            nickname: '민수',
            profileImage: null,
          },
          type: 'TEXT',
          content: '이전 메시지',
          s3Key: null,
          createdAt: '2026-02-19T11:58:00',
          isDeleted: false,
        },
        {
          messageId: 1001,
          sender: {
            userId: CURRENT_USER_ID,
            nickname: '나',
            profileImage: null,
          },
          type: 'TEXT',
          content: '삭제 테스트 메시지',
          s3Key: null,
          createdAt: '2026-02-19T11:59:00',
          isDeleted: false,
        },
      ],
      2: [
        {
          messageId: 2000,
          sender: {
            userId: CURRENT_USER_ID,
            nickname: '나',
            profileImage: null,
          },
          type: 'TEXT',
          content: '설정 테스트',
          s3Key: null,
          createdAt: '2026-02-19T11:20:00',
          isDeleted: false,
        },
      ],
    },
    followings: [
      { id: 1, userId: 202, nickname: '유저 닉네임 1', profileImage: null, isFollowing: true },
      { id: 2, userId: 203, nickname: '유저 닉네임 2', profileImage: null, isFollowing: true },
    ],
    nextRoomId: 10,
    lastReadByRoomId: {
      1: 1000,
      2: 2000,
    },
    privateRoomByTargetUserId: {},
    putRoomSettingsBodies: [],
    leaveRoomIds: [],
    deleteMessageIds: [],
  };
}

function jsonApiResponse(data: unknown) {
  return {
    message: 'OK',
    data,
    timestamp: nowIso(),
  };
}

function corsHeaders(route: Route) {
  const origin = route.request().headers().origin ?? BASE_URL;
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type',
    'content-type': 'application/json',
  };
}

async function fulfillJson(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    status,
    headers: corsHeaders(route),
    body: JSON.stringify(jsonApiResponse(data)),
  });
}

async function fulfillNoContent(route: Route) {
  await route.fulfill({
    status: 204,
    headers: corsHeaders(route),
  });
}

async function installMockBackend(page: Page) {
  const state = createInitialState();

  await page.route(`${API_BASE_URL}/**`, async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = new URL(request.url());
    const path = url.pathname;

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders(route) });
      return;
    }

    if (path.startsWith('/ws/chat')) {
      await route.fulfill({ status: 404, headers: corsHeaders(route), body: '' });
      return;
    }

    if (method === 'GET' && path === '/api/notifications/unread') {
      await fulfillJson(route, { unreadCount: 0 });
      return;
    }

    if (method === 'GET' && path === '/api/chatrooms') {
      const type = (url.searchParams.get('type') ?? 'PRIVATE').toUpperCase();
      const filtered = state.rooms.filter((room) => room.type === type);
      const sorted = sortRoomsForList(filtered);
      await fulfillJson(route, {
        chatRooms: sorted.map((room) => ({
          roomId: room.roomId,
          title: room.title ?? '채팅방',
          lastMessageContent: room.lastMessageContent,
          lastMessageAt: room.lastMessageAt,
          currentCount: room.currentCount,
          tag: room.tag,
        })),
        cursor: null,
        hasNext: false,
      });
      return;
    }

    if (method === 'GET' && path === '/api/users/me/followings') {
      const nickname = (url.searchParams.get('nickname') ?? '').trim();
      const size = Number(url.searchParams.get('size') ?? '10');
      const lastId = Number(url.searchParams.get('lastId') ?? '0');

      const filtered = state.followings.filter((following) =>
        nickname ? following.nickname.includes(nickname) : true,
      );
      const sorted = [...filtered].sort((a, b) => a.id - b.id);
      const paged = sorted.filter((following) => (lastId > 0 ? following.id > lastId : true));
      const items = paged.slice(0, size);
      const hasNext = paged.length > size;
      await fulfillJson(route, {
        followings: items,
        lastId: items.length > 0 ? items[items.length - 1].id : null,
        hasNext,
      });
      return;
    }

    if (method === 'POST' && path === '/api/chatrooms/private') {
      const body = (request.postDataJSON() as { userId?: number } | null) ?? null;
      const targetUserId = body?.userId;
      if (!targetUserId) {
        await route.fulfill({
          status: 400,
          headers: corsHeaders(route),
          body: JSON.stringify({ message: 'userId required', data: null, timestamp: nowIso() }),
        });
        return;
      }

      const existingRoomId = state.privateRoomByTargetUserId[targetUserId];
      if (existingRoomId) {
        const room = state.rooms.find((candidate) => candidate.roomId === existingRoomId);
        await fulfillJson(route, {
          roomId: existingRoomId,
          isNew: false,
          type: 'PRIVATE',
          title: room?.title ?? null,
          inviteCode: room?.inviteCode ?? null,
          createdAt: room?.createdAt ?? nowIso(),
        });
        return;
      }

      const following = state.followings.find((candidate) => candidate.userId === targetUserId);
      const roomId = state.nextRoomId++;
      const title = following?.nickname ?? `유저 ${targetUserId}`;
      const createdAt = nowIso();

      state.privateRoomByTargetUserId[targetUserId] = roomId;
      state.rooms.push({
        roomId,
        type: 'PRIVATE',
        title,
        roomName: title,
        isAlarmOn: true,
        inviteCode: `ROOM${roomId}`,
        createdAt,
        currentCount: 2,
        lastMessageContent: null,
        lastMessageAt: null,
        tag: null,
      });
      state.messagesByRoomId[roomId] = [];
      state.lastReadByRoomId[roomId] = null;

      await fulfillJson(route, {
        roomId,
        isNew: true,
        type: 'PRIVATE',
        title,
        inviteCode: `ROOM${roomId}`,
        createdAt,
      });
      return;
    }

    const roomMessagesDeleteMatch = path.match(/^\/api\/chatrooms\/(\d+)\/messages\/(\d+)$/);
    if (roomMessagesDeleteMatch && method === 'DELETE') {
      const roomId = Number(roomMessagesDeleteMatch[1]);
      const messageId = Number(roomMessagesDeleteMatch[2]);
      state.deleteMessageIds.push({ roomId, messageId });
      const messages = state.messagesByRoomId[roomId] ?? [];
      const target = messages.find((message) => message.messageId === messageId);
      if (target) {
        target.isDeleted = true;
        target.content = null;
        target.s3Key = null;
      }
      await fulfillNoContent(route);
      return;
    }

    const roomMessagesMatch = path.match(/^\/api\/chatrooms\/(\d+)\/messages$/);
    if (roomMessagesMatch && method === 'GET') {
      const roomId = Number(roomMessagesMatch[1]);
      const size = Number(url.searchParams.get('size') ?? '20');
      const lastId = Number(url.searchParams.get('lastId') ?? '0');
      const messages = [...(state.messagesByRoomId[roomId] ?? [])].sort(
        (a, b) => b.messageId - a.messageId,
      );
      const filtered = messages.filter((message) =>
        lastId > 0 ? message.messageId < lastId : true,
      );
      const pageItemsDesc = filtered.slice(0, size);
      const pageItemsAsc = [...pageItemsDesc].reverse();
      const hasNext = filtered.length > size;
      const nextCursor = hasNext && pageItemsAsc.length > 0 ? pageItemsAsc[0].messageId : null;

      await fulfillJson(route, {
        messages: pageItemsAsc,
        lastReadMsgId: state.lastReadByRoomId[roomId] ?? null,
        nextCursor,
        hasNext,
      });
      return;
    }

    const roomMatch = path.match(/^\/api\/chatrooms\/(\d+)$/);
    if (roomMatch && method === 'GET') {
      const roomId = Number(roomMatch[1]);
      const room =
        state.rooms.find((candidate) => candidate.roomId === roomId) ?? state.leftRoomsById[roomId];
      if (!room) {
        await route.fulfill({
          status: 404,
          headers: corsHeaders(route),
          body: JSON.stringify({ message: 'not found', data: null, timestamp: nowIso() }),
        });
        return;
      }

      await fulfillJson(route, {
        roomId: room.roomId,
        type: room.type,
        title: room.title,
        isAlarmOn: room.isAlarmOn,
        roomName: room.roomName,
        inviteCode: room.inviteCode,
        createdAt: room.createdAt,
        recentImages: [],
      });
      return;
    }

    if (roomMatch && method === 'PATCH') {
      const roomId = Number(roomMatch[1]);
      const body = (request.postDataJSON() as { lastReadMsgId?: number } | null) ?? null;
      state.lastReadByRoomId[roomId] = body?.lastReadMsgId ?? null;
      await fulfillJson(route, {
        roomId,
        lastReadMsgId: state.lastReadByRoomId[roomId],
      });
      return;
    }

    if (roomMatch && method === 'PUT') {
      const roomId = Number(roomMatch[1]);
      const body =
        (request.postDataJSON() as { roomName?: string; isAlarmOn?: boolean } | null) ?? null;
      const room = state.rooms.find((candidate) => candidate.roomId === roomId);
      if (room) {
        if (typeof body?.isAlarmOn === 'boolean') {
          room.isAlarmOn = body.isAlarmOn;
        }
        if (typeof body?.roomName === 'string') {
          room.roomName = body.roomName;
        }
      }
      state.putRoomSettingsBodies.push({
        roomId,
        roomName: body?.roomName,
        isAlarmOn: Boolean(body?.isAlarmOn),
      });
      await fulfillJson(route, {
        roomId,
        roomName: room?.roomName ?? null,
      });
      return;
    }

    if (roomMatch && method === 'DELETE') {
      const roomId = Number(roomMatch[1]);
      state.leaveRoomIds.push(roomId);
      const room = state.rooms.find((candidate) => candidate.roomId === roomId);
      if (room) {
        state.leftRoomsById[roomId] = room;
      }
      state.rooms = state.rooms.filter((candidate) => candidate.roomId !== roomId);
      await fulfillNoContent(route);
      return;
    }

    await route.fulfill({
      status: 404,
      headers: corsHeaders(route),
      body: JSON.stringify({
        message: `Unhandled mock: ${method} ${path}`,
        data: null,
        timestamp: nowIso(),
      }),
    });
  });

  return state;
}

async function bootstrapAuthedSession(page: Page) {
  const token = createFakeJwt(CURRENT_USER_ID);
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [ACCESS_TOKEN_KEY, token],
  );
}

async function openMenuSettings(page: Page) {
  await page.getByRole('button', { name: '채팅방 설정' }).click();
  await expect(page.getByRole('heading', { name: '채팅방 설정' })).toBeVisible();
}

async function longPress(locator: Locator, page: Page, ms = 2100) {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Target element bounding box is not available for long press.');
  }

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

test.describe('채팅 핵심 플로우', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapAuthedSession(page);
  });

  test('목록에서 방 클릭 시 상세로 이동한다', async ({ page }) => {
    await installMockBackend(page);
    await page.goto(`${BASE_URL}/chat`);

    await expect(page.getByText('스터디방')).toBeVisible();
    await page.getByRole('button', { name: /스터디방/ }).click();

    await expect(page).toHaveURL(/\/chat\/1$/);
    await expect(page.getByRole('heading', { name: '민수' })).toBeVisible();
    await expect(page.getByText('삭제 테스트 메시지')).toBeVisible();
  });

  test('채팅 생성 완료 후 생성된 방 상세로 이동한다', async ({ page }) => {
    await installMockBackend(page);
    await page.goto(`${BASE_URL}/chat/new`);

    await expect(page.getByText('팔로잉 유저 목록')).toBeVisible();
    await page.getByRole('button', { name: /유저 닉네임 1/ }).click();
    await page.getByRole('button', { name: '완료' }).click();

    await expect(page.getByText('채팅방이 생성되었습니다.')).toBeVisible();
    await expect(page).toHaveURL(/\/chat\/10$/);
    await expect(page.getByRole('heading', { name: '유저 닉네임 1' })).toBeVisible();
  });

  test('채팅방 설정 저장 요청을 보낸다', async ({ page }) => {
    const state = await installMockBackend(page);
    await page.goto(`${BASE_URL}/chat/2`);

    await openMenuSettings(page);

    const toggle = page.getByRole('button', { name: '알림 토글' });
    await toggle.click();
    const input = page.getByPlaceholder('채팅방 이름을 입력하세요');
    await input.fill('팀채팅');
    await page.getByRole('button', { name: '저장' }).click();

    await expect(page.getByText('채팅방 설정이 저장되었습니다.')).toBeVisible();
    await expect.poll(() => state.putRoomSettingsBodies.length).toBe(1);
    await expect
      .poll(() => state.putRoomSettingsBodies[0])
      .toEqual({
        roomId: 2,
        roomName: '팀채팅',
        isAlarmOn: false,
      });
  });

  test('채팅방 나가기 성공 시 목록으로 이동한다', async ({ page }) => {
    const state = await installMockBackend(page);
    await page.goto(`${BASE_URL}/chat/1`);

    await openMenuSettings(page);
    await page.getByRole('button', { name: '채팅방 나가기' }).click();
    await expect(page.getByText('채팅방에서 나가시겠어요?')).toBeVisible();
    await page.getByRole('button', { name: '나가기', exact: true }).click();

    await expect(page).toHaveURL(`${BASE_URL}/chat`);
    await expect(page.getByText('참여 중인 채팅방이 없습니다')).toBeVisible();
    await expect.poll(() => state.leaveRoomIds).toEqual([1]);
  });

  test('내 메시지 롱프레스 후 삭제한다', async ({ page }) => {
    const state = await installMockBackend(page);
    await page.goto(`${BASE_URL}/chat/1`);

    const ownMessage = page.getByText('삭제 테스트 메시지').first();
    await expect(ownMessage).toBeVisible();
    await longPress(ownMessage, page);

    await expect(page.getByText('메시지를 삭제하시겠어요?')).toBeVisible();
    await page.getByRole('button', { name: '삭제' }).click();

    await expect(page.getByText('삭제된 메시지입니다.')).toBeVisible();
    await expect.poll(() => state.deleteMessageIds).toEqual([{ roomId: 1, messageId: 1001 }]);
  });
});
