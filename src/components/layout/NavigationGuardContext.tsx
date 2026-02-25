'use client';

import { createContext, useContext } from 'react';

type NavigationGuardContextValue = {
  isBlocked: boolean;
  setBlocked: (blocked: boolean) => void;
  blockMessage: string;
  setBlockMessage: (message: string) => void;
  requestNavigation: (action: () => void) => void;
  setBlockedNavigationHandler: (handler: ((action: () => void) => void) | null) => void;
};

const NavigationGuardContext = createContext<NavigationGuardContextValue | null>(null);

export function useNavigationGuard(): NavigationGuardContextValue {
  const context = useContext(NavigationGuardContext);
  if (context) return context;

  return {
    isBlocked: false,
    setBlocked: () => {},
    blockMessage: '답변 생성 중에는 이동할 수 없습니다.',
    setBlockMessage: () => {},
    requestNavigation: (action: () => void) => action(),
    setBlockedNavigationHandler: () => {},
  };
}

export { NavigationGuardContext };
