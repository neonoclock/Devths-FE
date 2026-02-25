import { clearAccessToken, getAccessToken, setAccessToken } from '@/lib/auth/token';

import type { ApiErrorResponse, ApiResponse } from '@/types/api';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (!BASE_URL) return false;

  try {
    const res = await fetch(new URL('/api/auth/tokens', BASE_URL).toString(), {
      method: 'POST',
      credentials: 'include',
    });

    if (!res.ok) {
      clearAccessToken();
      return false;
    }

    const authHeader = res.headers.get('authorization');
    const newToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (newToken) {
      setAccessToken(newToken);
      return true;
    }

    return false;
  } catch {
    clearAccessToken();
    return false;
  }
}

export async function ensureAccessToken(): Promise<boolean> {
  const token = getAccessToken();
  if (token) {
    return true;
  }

  if (!isRefreshing) {
    isRefreshing = true;
    refreshPromise = refreshAccessToken().finally(() => {
      isRefreshing = false;
      refreshPromise = null;
    });
  }

  return refreshPromise ?? false;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type RequestOptions = {
  method: HttpMethod;
  path: string;
  body?: unknown;

  withAuth?: boolean;

  credentials?: RequestCredentials;

  headers?: Record<string, string>;
};

export type ApiClientResult<T> = {
  ok: boolean;
  status: number;
  json: (ApiResponse<T> | ApiErrorResponse) | null;
  res: Response;
};

function buildUrl(path: string) {
  if (!BASE_URL) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL is not set in .env.local');
  }
  return new URL(path, BASE_URL).toString();
}

export function buildApiUrl(path: string) {
  return buildUrl(path);
}

export async function apiStreamRequest(
  options: RequestOptions & { accept?: string },
  isRetry = false,
) {
  const {
    method,
    path,
    body,
    withAuth = true,
    credentials = 'include',
    headers = {},
    accept,
  } = options;

  const url = buildUrl(path);
  const finalHeaders: Record<string, string> = {
    ...headers,
  };

  if (accept) {
    finalHeaders.Accept = accept;
  }

  const hasBody = body !== undefined && body !== null;
  let requestBody: BodyInit | undefined;

  if (hasBody) {
    finalHeaders['Content-Type'] = finalHeaders['Content-Type'] ?? 'application/json';
    requestBody = JSON.stringify(body);
  }

  if (withAuth) {
    const token = getAccessToken();
    if (token) {
      finalHeaders.Authorization = `Bearer ${token}`;
    }
  }

  const res = await fetch(url, {
    method,
    headers: finalHeaders,
    credentials,
    body: requestBody,
  });

  if (res.status === 401 && withAuth && !isRetry) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshAccessToken().finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });
    }

    const refreshed = await (refreshPromise ?? Promise.resolve(false));

    if (refreshed) {
      return apiStreamRequest(options, true);
    }
  }

  return res;
}

export async function apiRequest<T>(
  options: RequestOptions,
  isRetry = false,
): Promise<ApiClientResult<T>> {
  const { method, path, body, withAuth = true, credentials = 'include', headers = {} } = options;

  const url = buildUrl(path);

  const finalHeaders: Record<string, string> = {
    ...headers,
  };

  const hasBody = body !== undefined && body !== null;
  let requestBody: BodyInit | undefined;

  if (hasBody) {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const isUrlSearchParams =
      typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams;
    const isBlob = typeof Blob !== 'undefined' && body instanceof Blob;
    const isArrayBuffer = body instanceof ArrayBuffer;
    const isString = typeof body === 'string';

    if (isFormData || isUrlSearchParams || isBlob || isArrayBuffer || isString) {
      requestBody = body as BodyInit;
    } else {
      finalHeaders['Content-Type'] = finalHeaders['Content-Type'] ?? 'application/json';
      requestBody = JSON.stringify(body);
    }
  }

  if (withAuth) {
    const token = getAccessToken();
    if (token) {
      finalHeaders.Authorization = `Bearer ${token}`;
    }
  }

  const res = await fetch(url, {
    method,
    headers: finalHeaders,
    credentials,
    body: requestBody,
  });

  // 401 에러 시 토큰 갱신 후 재시도
  if (res.status === 401 && withAuth && !isRetry) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshAccessToken().finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });
    }

    const refreshed = await (refreshPromise ?? Promise.resolve(false));

    if (refreshed) {
      return apiRequest<T>(options, true);
    }
  }

  const contentType = res.headers.get('content-type') ?? '';
  const json =
    res.status === 204 || !contentType.includes('application/json')
      ? null
      : ((await res.json().catch(() => null)) as (ApiResponse<T> | ApiErrorResponse) | null);

  return {
    ok: res.ok,
    status: res.status,
    json,
    res,
  };
}

export const api = {
  get<T>(path: string, opts?: Omit<RequestOptions, 'method' | 'path'>) {
    return apiRequest<T>({ method: 'GET', path, ...opts });
  },
  post<T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'path' | 'body'>) {
    return apiRequest<T>({ method: 'POST', path, body, ...opts });
  },
  put<T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'path' | 'body'>) {
    return apiRequest<T>({ method: 'PUT', path, body, ...opts });
  },
  delete<T>(path: string, opts?: Omit<RequestOptions, 'method' | 'path'>) {
    return apiRequest<T>({ method: 'DELETE', path, ...opts });
  },
};
