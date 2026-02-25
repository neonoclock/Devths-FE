export const BOARD_TITLE_MIN_LENGTH = 1;
export const BOARD_TITLE_MAX_LENGTH = 50;
export const BOARD_CONTENT_MIN_LENGTH = 10;
export const BOARD_CONTENT_MAX_LENGTH = 5000;
export const BOARD_TAG_MAX = 4;

export const BOARD_FILE_MAX_SIZE_MB = 10;
export const BOARD_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'] as const;
export const BOARD_FILE_MIME_TYPES = ['application/pdf'] as const;

export const BOARD_ATTACHMENT_CONSTRAINTS = {
  maxImages: 10,
  maxFiles: 5,
  maxSizeMB: BOARD_FILE_MAX_SIZE_MB,
  imageMimeTypes: BOARD_IMAGE_MIME_TYPES,
  fileMimeTypes: BOARD_FILE_MIME_TYPES,
} as const;
