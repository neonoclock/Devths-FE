import type { LocalDateString, LocalDateTimeString } from '@/types/calendar';
import type { DatesSetArg } from '@fullcalendar/core';

const SEOUL_TIMEZONE = 'Asia/Seoul';
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const seoulFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SEOUL_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  hour12: false,
});

const localDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?$/;

type SeoulParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
};

function getSeoulParts(date: Date): SeoulParts {
  const parts = seoulFormatter.formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));

  return {
    year: map.get('year') ?? '0000',
    month: map.get('month') ?? '01',
    day: map.get('day') ?? '01',
    hour: map.get('hour') ?? '00',
    minute: map.get('minute') ?? '00',
    second: map.get('second') ?? '00',
  };
}

export function toLocalDate(date: Date): LocalDateString {
  const { year, month, day } = getSeoulParts(date);
  return `${year}-${month}-${day}`;
}

export function toLocalDateTime(date: Date): LocalDateTimeString {
  const { year, month, day, hour, minute, second } = getSeoulParts(date);
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

// 백엔드에서 LocalDateTime으로 바인딩되는 쿼리 파라미터 전용 직렬화 함수입니다.
// 커서 페이지네이션에서는 새 Date를 만들지 말고 서버가 내려준 cursor 문자열을 우선 재사용하세요.
export function toLocalDateTimeParam(date: Date): LocalDateTimeString {
  return date.toISOString().slice(0, 19);
}

export function parseLocalDateTime(value: string): Date {
  const match = value.match(localDateTimePattern);
  if (!match) {
    return new Date(NaN);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);

  const utcMillis = Date.UTC(year, month - 1, day, hour, minute, second) - SEOUL_OFFSET_MS;
  return new Date(utcMillis);
}

export function getSeoulDateRangeFromDatesSet(arg: Pick<DatesSetArg, 'start' | 'end'>): {
  startDate: LocalDateString;
  endDate: LocalDateString;
} {
  const startDate = toLocalDate(arg.start);
  const endInclusive = new Date(arg.end.getTime() - DAY_MS);
  const endDate = toLocalDate(endInclusive);

  return { startDate, endDate };
}
