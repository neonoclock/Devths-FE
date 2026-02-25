import {
  BOARD_CONTENT_MAX_LENGTH,
  BOARD_CONTENT_MIN_LENGTH,
  BOARD_TITLE_MAX_LENGTH,
  BOARD_TITLE_MIN_LENGTH,
} from '@/constants/boardCreate';

export type BoardCreateValidationResult = {
  ok: boolean;
  titleError?: string;
  contentError?: string;
};

export function validateBoardCreateTitle(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < BOARD_TITLE_MIN_LENGTH) {
    return '제목을 입력해 주세요.';
  }
  if (trimmed.length > BOARD_TITLE_MAX_LENGTH) {
    return `제목은 최대 ${BOARD_TITLE_MAX_LENGTH}자까지 입력할 수 있습니다.`;
  }
  return null;
}

export function validateBoardCreateContent(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < BOARD_CONTENT_MIN_LENGTH) {
    return '내용을 10자 이상 입력해 주세요.';
  }
  if (trimmed.length > BOARD_CONTENT_MAX_LENGTH) {
    return `내용은 최대 ${BOARD_CONTENT_MAX_LENGTH}자까지 입력할 수 있습니다.`;
  }
  return null;
}

export function validateBoardCreateForm(
  title: string,
  content: string,
): BoardCreateValidationResult {
  const titleError = validateBoardCreateTitle(title);
  const contentError = validateBoardCreateContent(content);

  return {
    ok: !titleError && !contentError,
    titleError: titleError ?? undefined,
    contentError: contentError ?? undefined,
  };
}
