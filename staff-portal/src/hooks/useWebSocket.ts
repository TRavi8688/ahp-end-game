/// <reference types="vite/client" />
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

type WSMessage = { type: string; payload: any };

/**
 * FIXED:
 * 1. Reconnect timer was not cleared on unmount — caused memory leaks + double connections.
 * 2. `connect` captured stale `token` via closure — now reads from localStorage directly.
 * 3. WS URL now derived from VITE_API_BASE_URL (http→ws swap) instead of separate VITE_WS_URL.
 */
export const useWebSocket = (hospitalId: string | undefined) => {
  const { token } = useAuth();
  const socketRef = useRef<WebSocket | null>(null);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);

  const connect = useCallback(() => {
    // Read token from localStorage at call time (avoids stale closure)
    const liveToken = localStorage.getItem('token');
    if (!hospitalId || !liveToken) return;
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    const httpBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    const wsBase   = httpBase.replace(/^http/, 'ws');
    const wsUrl    = `${wsBase}/api/v1/ws/${hospitalId}?token=${liveToken}`;

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
