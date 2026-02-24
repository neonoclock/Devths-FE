'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import ConfirmModal from '@/components/common/ConfirmModal';
import ListLoadMoreSentinel from '@/components/llm/rooms/ListLoadMoreSentinel';
import LlmRoomCreateCard from '@/components/llm/rooms/LlmRoomCreateCard';
import LlmRoomEmptyState from '@/components/llm/rooms/LlmRoomEmptyState';
import LlmRoomList from '@/components/llm/rooms/LlmRoomList';
import { useDeleteRoomMutation } from '@/lib/hooks/llm/useDeleteRoomMutation';
import { useRoomsInfiniteQuery } from '@/lib/hooks/llm/useRoomsInfiniteQuery';
import { useAnalysisTaskStore } from '@/lib/llm/analysisTaskStore';
import { toast } from '@/lib/toast/store';
import { formatUpdatedAt, mapAiChatRoomToLlmRoom, parseLlmDateTime } from '@/lib/utils/llm';

export default function LlmRoomsPage() {
  const router = useRouter();
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    useRoomsInfiniteQuery();

  useEffect(() => {
    // Ensure latest room titles are loaded when entering the list page.
    void refetch();
  }, [refetch]);

  const deleteMutation = useDeleteRoomMutation();
  const activeTask = useAnalysisTaskStore((state) => state.activeTask);
  const isAnalysisActive =
    activeTask !== null && activeTask.status !== 'COMPLETED' && activeTask.status !== 'FAILED';

  const [deleteTarget, setDeleteTarget] = useState<{ uuid: string; id: number } | null>(null);

  const handleDeleteRoom = (roomUuid: string) => {
    const targetRoom = data?.pages
      .flatMap((page) => (page ? page.rooms : []))
      .find((room) => room.roomUuid === roomUuid);

    if (!targetRoom) return;

    setDeleteTarget({ uuid: roomUuid, id: targetRoom.roomId });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;

    deleteMutation.mutate(deleteTarget.id, {
      onError: () => {
        toast('대화 삭제에 실패했습니다. 다시 시도해주세요.');
      },
      onSuccess: () => {
        setDeleteTarget(null);
      },
    });
  };

  if (isLoading) {
    return (
      <main className="px-3 pt-4 pb-3">
        <div className="flex h-[60vh] items-center justify-center">
          <p className="text-sm text-neutral-500">로딩 중...</p>
        </div>
      </main>
    );
  }

  if (isError) {
    return (
      <main className="px-3 pt-4 pb-3">
        <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
          <p className="text-sm font-semibold text-neutral-900">데이터를 불러올 수 없습니다</p>
          <p className="text-xs text-neutral-500">네트워크 연결을 확인해주세요</p>
        </div>
      </main>
    );
  }

  // 서버에서 받아온 rooms를 최신순(updatedAt 기준 내림차순)으로 정렬
  let rooms =
    data?.pages
      .flatMap((page) => (page ? page.rooms : []))
      .sort((a, b) => {
        // Backend timestamps may be timezone-less LocalDateTime strings that represent UTC.
        return parseLlmDateTime(b.updatedAt).getTime() - parseLlmDateTime(a.updatedAt).getTime();
      })
      .map(mapAiChatRoomToLlmRoom) ?? [];

  if (isAnalysisActive && activeTask) {
    const hasActiveRoom = rooms.some((room) => room.numericId === activeTask.roomId);
    if (!hasActiveRoom) {
      rooms = [
        {
          id: activeTask.roomUuid,
          numericId: activeTask.roomId,
          title: activeTask.roomTitle || 'AI 분석',
          updatedAt: formatUpdatedAt(new Date(activeTask.startedAt).toISOString()),
          storage: 'TEMP',
        },
        ...rooms,
      ];
    }
  }
  const hasRooms = rooms.length > 0;

  if (!hasRooms) {
    return <LlmRoomEmptyState href="/llm/analysis" />;
  }

  return (
    <>
      <main className="px-3 pt-4 pb-3">
        <LlmRoomCreateCard
          href="/llm/analysis"
          disabled={isAnalysisActive}
          onDisabledClick={() => toast('분석 진행 중입니다. 완료 후 확인해주세요.')}
        />

        <div className="mt-4">
          <p className="mb-3 px-1 text-sm font-semibold text-neutral-900">대화 목록</p>
          <LlmRoomList
            rooms={rooms}
            activeAnalysisRoomId={isAnalysisActive ? activeTask?.roomId : null}
            onEnterRoom={(id, numericId) =>
              router.push(`/llm/${encodeURIComponent(id)}?rid=${numericId}`)
            }
            onAnalyzingRoomClick={() => toast('분석 진행 중입니다. 완료 후 확인해주세요.')}
            onDeleteRoom={handleDeleteRoom}
          />

          <ListLoadMoreSentinel
            onLoadMore={() => void fetchNextPage()}
            hasNextPage={hasNextPage ?? false}
            isFetchingNextPage={isFetchingNextPage}
          />
        </div>
      </main>

      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="대화를 삭제하시겠어요?"
        message="삭제된 대화는 복구할 수 없습니다."
        confirmText="삭제"
        cancelText="취소"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
