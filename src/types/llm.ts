import type { CursorListResponse } from '@/types/pagination';

export type AiChatRoom = {
  roomId: number;
  roomUuid: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessageAttachment = {
  fileId: number;
  s3Key: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
};

export type MessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM';
export type MessageType = 'NORMAL' | 'REPORT' | 'INTERVIEW';

export type ChatMessage = {
  roomId: number;
  messageId: number;
  interviewId: number | null;
  role: MessageRole;
  content: string;
  type: MessageType;
  metadata: Record<string, unknown> | null;
  // attachments?: ChatMessageAttachment[];
  createdAt: string;
};

export type FetchRoomsResponse = CursorListResponse<AiChatRoom, 'rooms'>;

export type CreateRoomResponse = {
  roomId: number;
  roomUuid: string;
  title: string;
  createdAt: string;
};

export type FetchMessagesResponse = CursorListResponse<ChatMessage, 'messages'>;

export type FetchRoomsParams = {
  size?: number;
  lastId?: number;
};

export type FetchMessagesParams = {
  size?: number;
  lastId?: number;
};

export type SendMessageRequest = {
  content: string;
  model: LlmModel;
  interviewId: number | null;
};

export type InterviewType = 'TECH' | 'BEHAVIOR';

export type StartInterviewRequest = {
  interviewType: InterviewType;
  model: LlmModel;
};

export type StartInterviewResponse = {
  interviewId: number;
  interviewType: InterviewType;
  currentQuestionCount: number;
  isResumed: boolean;
};

export type EndInterviewRequest = {
  interviewId: number;
  retry?: boolean;
  content?: string;
};

export type LlmModel = 'GEMINI' | 'VLLM';

export type CurrentInterviewResponse = {
  interviewId: number;
  interviewType: InterviewType;
  currentQuestionCount: number;
  createdAt: string;
};

export type DocumentInput = {
  text: string;
  images: File[];
  pdf: File | null;
};

export type AnalysisFormState = {
  resume: DocumentInput;
  jobPosting: DocumentInput;
  model: LlmModel;
};

export type AnalysisDocumentInput = {
  fileId: number | null;
  s3Key: string | null;
  fileType: string | null;
  text: string | null;
};

export type StartAnalysisRequest = {
  model: LlmModel;
  resume: AnalysisDocumentInput;
  jobPost: AnalysisDocumentInput;
};

export type TaskStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export type StartAnalysisResponse = {
  taskId: number;
  status: TaskStatus;
};

export type AnalysisResultMessage = {
  roomId: number;
  messageId: number;
  interviewId: number | null;
  role: 'ASSISTANT';
  type: 'REPORT';
  content: string;
  metadata: {
    score?: number;
    summary?: string;
    strengths?: string[];
  } | null;
  createdAt: string;
};

export type TaskType = 'ANALYSIS' | 'MASKING' | 'EXTRACT';

export type TaskResultData = {
  taskId: number;
  taskType: TaskType;
  referenceId: number;
  status: TaskStatus;
  result: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  isNotified: boolean;
};

export type { CursorPage } from '@/types/pagination';
