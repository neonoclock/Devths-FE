import { MessageCircle, Share2, ThumbsUp } from 'lucide-react';

export default function BoardPostDetailSkeleton() {
  return (
    <>
      <main className="px-1 pt-0 pb-6 sm:px-2" style={{ paddingBottom: '84px' }}>
        <div className="space-y-3">
          <div className="border-b border-neutral-200 px-0 pt-3 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-full bg-neutral-100" />
                <div className="space-y-1">
                  <div className="h-3 w-16 rounded-full bg-neutral-100" />
                  <div className="h-2 w-20 rounded-full bg-neutral-100" />
                </div>
              </div>
              <div className="h-6 w-6 rounded-full bg-neutral-100" />
            </div>

            <div className="mt-4 space-y-2">
              <div className="h-4 w-2/3 rounded-full bg-neutral-100" />
              <div className="h-3 w-full rounded-full bg-neutral-100" />
              <div className="h-3 w-5/6 rounded-full bg-neutral-100" />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <div className="h-6 w-16 rounded-full bg-neutral-100" />
              <div className="h-6 w-12 rounded-full bg-neutral-100" />
              <div className="h-6 w-14 rounded-full bg-neutral-100" />
            </div>

            <div className="mt-4 flex items-center gap-4 text-xs text-neutral-400">
              <div className="inline-flex items-center gap-1">
                <ThumbsUp className="h-4 w-4" />
                <span className="h-3 w-6 rounded-full bg-neutral-100" />
              </div>
              <div className="inline-flex items-center gap-1">
                <MessageCircle className="h-4 w-4" />
                <span className="h-3 w-6 rounded-full bg-neutral-100" />
              </div>
              <div className="inline-flex items-center gap-1">
                <Share2 className="h-4 w-4" />
              </div>
            </div>
          </div>

          <div className="bg-[#F1F5F9] px-0 py-2 text-xs text-neutral-500">
            개인정보(연락처, 계좌번호 등) 공유에 주의하세요
          </div>

          <div className="space-y-2 px-0">
            <div className="h-3 w-20 rounded-full bg-neutral-100" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`comment-skeleton-${index}`}
                  className="rounded-2xl border border-neutral-100 bg-white px-3 py-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-neutral-100" />
                      <div className="space-y-1">
                        <div className="h-3 w-14 rounded-full bg-neutral-100" />
                        <div className="h-2 w-10 rounded-full bg-neutral-100" />
                      </div>
                    </div>
                    <div className="h-5 w-5 rounded-full bg-neutral-100" />
                  </div>
                  <div className="mt-2 h-3 w-4/5 rounded-full bg-neutral-100" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <div className="fixed bottom-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 bg-white px-3 py-3 shadow-[0_-6px_16px_rgba(15,23,42,0.08)] sm:px-4">
        <div className="flex items-center gap-2">
          <div className="h-9 flex-1 rounded-full border border-neutral-200 bg-neutral-50" />
          <div className="h-9 w-14 rounded-full bg-neutral-200" />
        </div>
      </div>
    </>
  );
}
