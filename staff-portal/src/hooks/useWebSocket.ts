/// <reference types="vite/client" />
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

type WSMessage = { type: string; payload: any };

/**
 * FIXED:
 * 1. Reconnect timer was not cleared on unmount — caused memory leaks + double connections.
 * 2. Token was read from localStorage.getItem('token') — that key is never written
 *    anywhere in this app (AuthContext stores it in sessionStorage under
 *    'hospyn_access_token'), so the socket never had a token and never connected.
 * 3. URL was /api/v1/ws/{hospitalId} — no such backend route exists. The only
 *    websocket endpoint is ws_endpoint.py's "/ws/reception", mounted at
 *    /api/v1/healthcare/ws/reception, and it derives hospital_id from the
 *    JWT server-side — it doesn't take one in the URL.
 */
export const useWebSocket = (hospitalId: string | undefined) => {
  const { token } = useAuth();
  const socketRef = useRef<WebSocket | null>(null);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);

  const connect = useCallback(() => {
    // FIXED: read from sessionStorage (the actual store) under the actual key
    const liveToken = sessionStorage.getItem('hospyn_access_token');
    if (!liveToken) return;
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    const httpBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    const wsBase   = httpBase.replace(/^http/, 'ws');
    // FIXED: real route is /api/v1/healthcare/ws/reception — hospital is
    // resolved server-side from the token, not passed in the URL.
    const wsUrl    = `${wsBase}/api/v1/healthcare/ws/reception?token=${liveToken}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      // Clear any pending reconnect timer
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };

    ws.onmessage = (event) => {
      try { setLastMessage(JSON.parse(event.data)); } catch { /* ignore */ }
    };

    ws.onclose = () => {
      setIsConnected(false);
      // FIXED: schedule reconnect, but store the timer so it can be cancelled
      timerRef.current = setTimeout(connect, 3_000);
    };

    ws.onerror = () => { ws.close(); };

    socketRef.current = ws;
  }, [hospitalId]); // token deliberately omitted — read live from localStorage

  useEffect(() => {
    if (token) connect(); // only attempt if we have a token
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current); // FIXED: clear timer
      socketRef.current?.close();
    };
  }, [connect, token]);

  const sendMessage = (msg: WSMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  };

  return { isConnected, lastMessage, sendMessage };
};
