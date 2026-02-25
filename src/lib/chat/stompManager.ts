'use client';

import { Client, type IMessage, type StompHeaders, type StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

import { buildApiUrl, ensureAccessToken } from '@/lib/api/client';
import { getAccessToken } from '@/lib/auth/token';
import { toast } from '@/lib/toast/store';

export type ChatStompConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

type StatusListener = (status: ChatStompConnectionStatus) => void;

type SubscriptionEntry = {
  key: string;
  destination: string;
  callback: (message: IMessage) => void;
  headers?: StompHeaders;
  subscription?: StompSubscription;
};

const RETRY_BASE_DELAY_MS = 1000;
const RETRY_MAX_DELAY_MS = 30000;
const FAILURE_TOAST_COOLDOWN_MS = 15000;

class ChatStompManager {
  private client: Client | null = null;
  private status: ChatStompConnectionStatus = 'idle';
  private statusListeners = new Set<StatusListener>();
  private subscriptions = new Map<string, SubscriptionEntry>();
  private connectRequested = false;
  private retryAttempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private toastHistory = new Map<string, number>();
  private subscriptionSeq = 0;

  get connectionStatus() {
    return this.status;
  }

  connect() {
    this.connectRequested = true;
    this.clearRetryTimer();

    if (!this.client) {
      this.client = this.createClient();
    }

    if (this.client.active || this.client.connected) {
      this.logInfo('connect skipped: client already active');
      return;
    }

    this.setStatus(this.retryAttempt > 0 ? 'reconnecting' : 'connecting');
    this.logInfo('activate stomp client');
    this.client.activate();
  }

  disconnect() {
    this.connectRequested = false;
    this.retryAttempt = 0;
    this.clearRetryTimer();
    this.clearAllSubscriptions();

    if (!this.client) {
      this.setStatus('disconnected');
      return;
    }

    this.logInfo('deactivate stomp client');
    void this.client.deactivate();
    this.client = null;
    this.setStatus('disconnected');
  }

  subscribe(
    destination: string,
    callback: (message: IMessage) => void,
    headers?: StompHeaders,
  ): () => void {
    const key = `sub-${++this.subscriptionSeq}`;
    this.subscriptions.set(key, {
      key,
      destination,
      callback,
      headers,
    });

    this.bindSubscription(key);

    return () => {
      this.unsubscribe(key);
    };
  }

  publishJson(destination: string, payload: unknown, headers?: StompHeaders): boolean {
    if (!this.client?.connected) {
      this.logWarn(`publish skipped: not connected (destination=${destination})`);
      return false;
    }

    this.client.publish({
      destination,
      body: JSON.stringify(payload),
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
    });
    return true;
  }

  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);

    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private setStatus(status: ChatStompConnectionStatus) {
    if (this.status === status) {
      return;
    }
    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  private createClient(): Client {
    const client = new Client({
      reconnectDelay: 0,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      webSocketFactory: () => {
        try {
          const endpoint = buildApiUrl('/ws/chat');
          this.logInfo(`open SockJS endpoint: ${endpoint}`);
          return new SockJS(endpoint);
        } catch (error) {
          this.logError('failed to resolve SockJS endpoint', error);
          this.notifyFailureOnce('socket-config', '실시간 연결 설정을 확인해 주세요.');
          throw error;
        }
      },
      beforeConnect: async () => {
        await ensureAccessToken();
        const token = getAccessToken();

        if (!token) {
          this.logWarn('beforeConnect failed: access token not found');
          this.notifyFailureOnce('auth-missing', '실시간 연결 인증에 실패했습니다.');
          throw new Error('Missing access token for STOMP CONNECT');
        }

        client.connectHeaders = {
          Authorization: `Bearer ${token}`,
        };
        this.logInfo('beforeConnect injected latest Authorization header');
      },
      onConnect: () => {
        if (this.client !== client) {
          this.logInfo('ignore onConnect from stale client');
          return;
        }

        this.retryAttempt = 0;
        this.setStatus('connected');
        this.logInfo('stomp connected');
        this.rebindAllSubscriptions();
      },
      onDisconnect: () => {
        if (this.client !== client) {
          this.logInfo('ignore onDisconnect from stale client');
          return;
        }

        this.logInfo('stomp disconnected by client');
      },
      onStompError: (frame) => {
        if (this.client !== client) {
          this.logInfo('ignore onStompError from stale client');
          return;
        }

        this.setStatus('error');
        this.logError(`stomp error: ${frame.headers.message ?? 'unknown'}`, frame.body ?? '');
        this.notifyFailureOnce('stomp-error', '실시간 연결에 실패했습니다. 재시도합니다.');
      },
      onWebSocketError: (event) => {
        if (this.client !== client) {
          this.logInfo('ignore onWebSocketError from stale client');
          return;
        }

        this.logError('websocket error', event);
      },
      onWebSocketClose: (event) => {
        if (this.client !== client) {
          this.logInfo(
            `ignore websocket close from stale client (code=${event.code}, reason=${event.reason || 'none'})`,
          );
          return;
        }

        this.logWarn(`websocket closed (code=${event.code}, reason=${event.reason || 'none'})`);

        if (!this.connectRequested) {
          this.setStatus('disconnected');
          return;
        }

        this.scheduleReconnect();
      },
    });

    client.debug = (message) => {
      if (process.env.NODE_ENV !== 'production') {
        this.logDebug(message);
      }
    };

    return client;
  }

  private scheduleReconnect() {
    this.clearRetryTimer();
    this.retryAttempt += 1;

    const delay = Math.min(
      RETRY_BASE_DELAY_MS * 2 ** Math.max(0, this.retryAttempt - 1),
      RETRY_MAX_DELAY_MS,
    );

    this.setStatus('reconnecting');
    this.notifyFailureOnce('reconnect', '실시간 연결이 끊어졌습니다. 재연결 중입니다.');
    this.logWarn(`schedule reconnect attempt=${this.retryAttempt}, delay=${delay}ms`);

    this.retryTimer = setTimeout(() => {
      if (!this.connectRequested) {
        return;
      }

      if (!this.client) {
        this.client = this.createClient();
      }

      if (this.client.active || this.client.connected) {
        return;
      }

      this.setStatus('reconnecting');
      this.logInfo(`reconnect attempt #${this.retryAttempt}`);
      this.client.activate();
    }, delay);
  }

  private clearRetryTimer() {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private notifyFailureOnce(key: string, message: string) {
    const now = Date.now();
    const lastNotifiedAt = this.toastHistory.get(key) ?? 0;
    if (now - lastNotifiedAt < FAILURE_TOAST_COOLDOWN_MS) {
      return;
    }

    this.toastHistory.set(key, now);
    toast(message);
  }

  private bindSubscription(key: string) {
    const entry = this.subscriptions.get(key);
    if (!entry || !this.client?.connected) {
      return;
    }

    entry.subscription?.unsubscribe();
    entry.subscription = this.client.subscribe(entry.destination, entry.callback, entry.headers);
    this.logInfo(`subscribe destination=${entry.destination}`);
  }

  private unsubscribe(key: string) {
    const entry = this.subscriptions.get(key);
    if (!entry) {
      return;
    }

    entry.subscription?.unsubscribe();
    this.subscriptions.delete(key);
    this.logInfo(`unsubscribe destination=${entry.destination}`);
  }

  private clearAllSubscriptions() {
    this.subscriptions.forEach((entry) => {
      entry.subscription?.unsubscribe();
    });
    this.subscriptions.clear();
  }

  private rebindAllSubscriptions() {
    this.subscriptions.forEach((entry) => {
      this.bindSubscription(entry.key);
    });
  }

  private logDebug(message: string) {
    console.warn(`[ChatStomp][debug] ${message}`);
  }

  private logInfo(message: string) {
    console.warn(`[ChatStomp][info] ${message}`);
  }

  private logWarn(message: string) {
    console.warn(`[ChatStomp] ${message}`);
  }

  private logError(message: string, payload?: unknown) {
    console.error(`[ChatStomp] ${message}`, payload);
  }
}

export const chatStompManager = new ChatStompManager();
