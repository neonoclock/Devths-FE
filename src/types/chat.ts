export type ChatRoomType = 'PRIVATE' | 'GROUP';

export type ChatMessageType = 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM';

export type ChatroomsCursor = string;
// Messages cursor is handled as `lastId`.
export type MessagesCursor = Readonly<{ lastId: number | null }>;

export type CursorPage<TCursor, TItem> = Readonly<{
  items: ReadonlyArray<TItem>;
  cursor: TCursor | null;
  hasNext: boolean;
}>;

export type SoftDeleteMeta = Readonly<{
  isDeleted: boolean;
  deletedAt: string | null;
}>;

export type ChatAttachmentBase = Readonly<{
  attachmentId: number;
  originalName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  url: string;
}>;

export type ChatImageAttachment = ChatAttachmentBase &
  Readonly<{
    attachmentType: 'IMAGE';
    thumbnailUrl?: string | null;
  }>;

export type ChatFileAttachment = ChatAttachmentBase &
  Readonly<{
    attachmentType: 'FILE';
  }>;

export type ChatAttachment = ChatImageAttachment | ChatFileAttachment;

export type ChatMessageSender = Readonly<{
  userId: number;
  nickname: string;
  profileImageUrl: string | null;
}>;

export type ChatRoom = Readonly<{
  roomId: number;
  type: ChatRoomType;
  title: string | null;
  roomName: string | null;
  inviteCode: string | null;
  currentCount: number;
  lastMessageContent: string | null;
  lastMessageAt: string | null;
  isAlarmOn?: boolean;
  createdAt: string;
}>;

export type ChatMessage = SoftDeleteMeta &
  Readonly<{
    messageId: number;
    roomId: number;
    sender: ChatMessageSender | null;
    type: ChatMessageType;
    content: string | null;
    s3Key: string | null;
    createdAt: string;
    attachments?: ReadonlyArray<ChatAttachment>;
  }>;

export type FollowingUser = Readonly<{
  userId: number;
  nickname: string;
  profileImageUrl: string | null;
}>;

export type PatchLastReadBody = Readonly<{ lastReadMsgId: number }>;
