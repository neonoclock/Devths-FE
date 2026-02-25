'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import GoogleLoginButton from '@/components/auth/GoogleLoginButton';
import LandingCarousel from '@/components/common/LandingCarousel';
import { ensureAccessToken } from '@/lib/api/client';
import { getAccessToken } from '@/lib/auth/token';

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    let isCancelled = false;

    const restoreSession = async () => {
      const redirect = new URLSearchParams(window.location.search).get('redirect');
      const fallback = '/llm';
      const targetPath = redirect && redirect.startsWith('/') ? redirect : fallback;

      if (getAccessToken()) {
        if (!isCancelled) {
          router.replace(targetPath);
        }
        return;
      }

      const restored = await ensureAccessToken();
      if (isCancelled) return;

      if (restored) {
        router.replace(targetPath);
      }
    };

    void restoreSession();

    return () => {
      isCancelled = true;
    };
  }, [router]);

  return (
    <main className="min-h-dvh bg-transparent">
      <div className="mx-auto flex min-h-dvh w-full items-center justify-center bg-white px-6 py-10 sm:max-w-[430px] sm:shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
        <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-8">
          <header className="flex flex-col items-center gap-3 text-center">
            <h1 className="flex items-center">
              <span className="sr-only">Devths</span>
              <Image
                src="/icons/Devths.png"
                alt="Devths"
                width={420}
                height={108}
                className="h-[108px] w-auto"
                priority
              />
            </h1>
            <p className="text-sm font-medium text-black/45">
              취업 준비를 한 곳에서 관리하는, AI로 취준 올인원!
            </p>
          </header>

          <LandingCarousel />

          <section className="w-full">
            <GoogleLoginButton />
          </section>

          <footer className="w-full text-center">
            <div className="flex flex-col items-center gap-1">
              <Link
                href="/privacy"
                className="text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-700"
              >
                개인정보 처리방침
              </Link>
              <Link
                href="/terms"
                className="text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-700"
              >
                서비스 이용약관
              </Link>
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}
