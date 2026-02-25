declare module 'sockjs-client' {
  export default class SockJS {
    constructor(url: string);
    close(code?: number, reason?: string): void;
    send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
    onopen: ((event: Event) => void) | null;
    onclose: ((event: CloseEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    onmessage: ((event: MessageEvent) => void) | null;
    readyState: number;
    protocol: string;
    url: string;
  }
}
