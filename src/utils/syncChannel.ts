/**
 * Cross-device and real-time network synchronization channel
 * Connects physical mobile phones (Motorola, Samsung, etc.) with desktop browsers
 * via Server-Sent Events (SSE), HTTP Relay, BroadcastChannel and LocalStorage.
 */

export interface RealTouchData {
  xRatio: number; // 0.0 to 1.0 (relative to phone screen)
  yRatio: number;
  isDrawing: boolean;
  nodeIndex?: number | null;
  activeTrail?: number[];
}

export interface SyncMessage {
  type:
    | 'HELLO'
    | 'PING'
    | 'PATTERN_STEP'
    | 'PATTERN_COMPLETE'
    | 'UNLOCK_SUCCESS'
    | 'LOCK_DEVICE'
    | 'DEVICE_CONNECTED'
    | 'REAL_TOUCH_MOVE'
    | 'STREAM_STATE'
    | 'DISCONNECT';
  sessionId: string;
  payload?: any;
  timestamp: number;
  deviceInfo?: string;
  senderId?: string;
  touchData?: RealTouchData;
}

// Unique client identifier to avoid echo loops
const CLIENT_ID = `client-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`;

export function getMyClientId(): string {
  return CLIENT_ID;
}

let channel: BroadcastChannel | null = null;

try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    channel = new BroadcastChannel('patternlock_sync_hub');
  }
} catch {
  channel = null;
}

/**
 * Send real-time synchronization message across devices (Phone <-> PC)
 */
export function sendSyncMessage(msg: Omit<SyncMessage, 'timestamp'>) {
  const fullMsg: SyncMessage = {
    ...msg,
    senderId: msg.senderId || CLIENT_ID,
    timestamp: Date.now(),
  };

  // 1. BroadcastChannel (fast local tab sync)
  try {
    channel?.postMessage(fullMsg);
  } catch {
    // ignore
  }

  // 2. LocalStorage event (for same-origin tabs)
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('patternlock_last_sync_event', JSON.stringify(fullMsg));
    }
  } catch {
    // ignore
  }

  // 3. Server HTTP Relay (Real Cross-Device across the internet / Wi-Fi)
  if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
    fetch('/api/sync/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fullMsg),
    }).catch(() => {
      // Network retry handled quietly
    });
  }
}

/**
 * Subscribe to real-time events from any connected device
 */
export function subscribeToSyncMessages(
  callback: (msg: SyncMessage) => void,
  sessionId?: string
): () => void {
  if (typeof window === 'undefined') return () => {};

  // Handlers for deduping
  let lastProcessedTimestamp = 0;
  const processMessage = (data: SyncMessage) => {
    if (!data || typeof data !== 'object') return;
    // Prevent processing the exact same event multiple times if received from both local and SSE
    if (data.senderId === CLIENT_ID) return;
    if (data.timestamp && data.timestamp <= lastProcessedTimestamp && data.type !== 'REAL_TOUCH_MOVE') {
      return;
    }
    lastProcessedTimestamp = data.timestamp || Date.now();
    callback(data);
  };

  // 1. BroadcastChannel listener
  const handleBcMessage = (event: MessageEvent<SyncMessage>) => {
    if (event.data) {
      processMessage(event.data);
    }
  };

  if (channel) {
    channel.addEventListener('message', handleBcMessage);
  }

  // 2. Storage listener (cross-window on same host)
  const handleStorage = (event: StorageEvent) => {
    if (event.key === 'patternlock_last_sync_event' && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue) as SyncMessage;
        processMessage(parsed);
      } catch {
        // ignore
      }
    }
  };

  window.addEventListener('storage', handleStorage);

  // 3. Real Server-Sent Events (SSE) Stream across devices and networks
  let eventSource: EventSource | null = null;
  const currentSessionId = sessionId || 'default';

  try {
    const sseUrl = `/api/sync/events?sessionId=${encodeURIComponent(currentSessionId)}`;
    eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === 'CONNECTED') {
          // Handshake ack
          return;
        }
        processMessage(parsed as SyncMessage);
      } catch {
        // Non-JSON or heartbeat
      }
    };

    eventSource.onerror = () => {
      // SSE auto-reconnects natively
    };
  } catch (err) {
    console.warn('Could not initialize SSE sync stream:', err);
  }

  return () => {
    if (channel) {
      channel.removeEventListener('message', handleBcMessage);
    }
    window.removeEventListener('storage', handleStorage);
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };
}

/**
 * Check session pairing status on server
 */
export async function checkSessionStatus(sessionId: string): Promise<{
  connectedClients: number;
  hasRealPhone: boolean;
  lastDevice: string | null;
  lastSeen: number | null;
}> {
  try {
    const res = await fetch(`/api/sync/status?sessionId=${encodeURIComponent(sessionId)}`);
    if (!res.ok) throw new Error('Status error');
    return await res.json();
  } catch {
    return {
      connectedClients: 1,
      hasRealPhone: false,
      lastDevice: null,
      lastSeen: null,
    };
  }
}

/**
 * Detect client device type and model details
 */
export function getClientDeviceName(): string {
  if (typeof navigator === 'undefined') return 'Dispositivo';
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return 'Apple iPhone';
  if (/iPad/i.test(ua)) return 'Apple iPad';
  if (/Android/i.test(ua)) {
    if (/Moto|Motorola/i.test(ua)) {
      if (/edge/i.test(ua)) return 'Motorola Edge';
      if (/razr/i.test(ua)) return 'Motorola Razr';
      if (/thinkphone/i.test(ua)) return 'Motorola ThinkPhone';
      if (/moto\s*g/i.test(ua)) return 'Motorola Moto G';
      if (/moto\s*e/i.test(ua)) return 'Motorola Moto E';
      return 'Motorola Smartphone';
    }
    if (/Samsung/i.test(ua)) return 'Samsung Galaxy';
    if (/Pixel/i.test(ua)) return 'Google Pixel';
    if (/Xiaomi/i.test(ua)) return 'Xiaomi';
    return 'Teléfono Android';
  }
  if (/Macintosh/i.test(ua)) return 'MacBook / Mac';
  if (/Windows/i.test(ua)) return 'PC Windows';
  return 'Navegador Web';
}
