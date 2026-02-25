'use client';

import { useParams } from 'next/navigation';

import ChatRoomPage from '@/screens/chat/ChatRoomPage';

export default function Page() {
  const params = useParams();
  const roomIdParam = Array.isArray(params.roomId) ? params.roomId[0] : params.roomId;
  const parsedRoomId = Number(roomIdParam);
  const roomId = Number.isInteger(parsedRoomId) && parsedRoomId > 0 ? parsedRoomId : null;

  return <ChatRoomPage roomId={roomId} />;
}
