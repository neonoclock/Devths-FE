'use client';

import Image from 'next/image';

import { setAuthRedirect } from '@/lib/auth/token';

import type { ButtonHTMLAttributes, MouseEventHandler } from 'react';

type GoogleLoginButtonProps = {
  fullWidth?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export default function GoogleLoginButton({
  fullWidth = true,
  disabled,
  className,
  onClick,
  ...props
}: GoogleLoginButtonProps) {
  const handleClick: MouseEventHandler<HTMLButtonElement> = (e) => {
    onClick?.(e);

    if (e.defaultPrevented) return;

    const redirect = new URL(window.location.href).searchParams.get('redirect');
    if (redirect) {
      setAuthRedirect(redirect);
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';
    const redirectUri = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI ?? '';

    if (!clientId) {
      alert('NEXT_PUBLIC_GOOGLE_CLIENT_ID가 설정되지 않았어요. (.env.local 확인)');
      return;
    }
    if (!redirectUri) {
      alert('NEXT_PUBLIC_GOOGLE_REDIRECT_URI가 설정되지 않았어요. (.env.local 확인)');
      return;
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope:
        'openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/tasks',
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
    });

    window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      className={[
        fullWidth ? 'w-full' : 'w-auto',
        'max-w-sm',
        'rounded-xl border border-transparent',
        'px-4 py-3',
        'text-sm font-semibold',
        'bg-[#05C075] text-white hover:bg-[#04A865] active:bg-[#039F62]',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className ?? '',
      ].join(' ')}
      {...props}
    >
      <span className="flex items-center justify-center gap-2">
        <Image src="/icons/google.png" alt="Google" width={18} height={18} priority />
        <span>Google 계정으로 계속하기</span>
      </span>
    </button>
  );
}
