import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { WS_BASE_URL } from '../api';

// IMPORTANT: WS_BASE_URL (see .env / api.jsx) must resolve to
// .../api/v1/healthcare — the only real-time endpoint on the backend is
// healthcare-core's GET /healthcare/ws/reception (despite the "reception"
// name, it authorizes any active Staff record via resolve_any_staff(),
// not reception-specific roles).
//
// KNOWN BACKEND LIMITATION (not fixable from this frontend): that endpoint
// resolves the connecting user against the `staff` table, but doctor
// onboarding only creates rows in the separate `doctors` table — the two
// are not currently linked. A doctor whose user_id was never separately
// added to `staff` will have every connection attempt closed with code
// 1008 (auth/policy violation) even with a perfectly valid JWT. This
// component already treats 1008 as terminal (no retry storm) and the rest
// of the app is built to keep working via REST polling when isConnected
// is false — see QueueScreen.jsx's "Reconnecting..." indicator — so this
// degrades gracefully rather than breaking the app, but live push updates
// won't actually arrive until that backend gap is closed.

const SocketContext = createContext({
    socket: null,
    lastMessage: null,
    isConnected: false,
    sendMessage: () => {},
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [lastMessage, setLastMessage] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const reconnectTimer = useRef(null);
    const socketRef = useRef(null);
    const reconnectAttempts = useRef(0);
    const MAX_RECONNECT_ATTEMPTS = 10;

    const connect = useCallback(() => {
        const token = sessionStorage.getItem('hospain_access_token');
        if (!token) return;

        // Prevent duplicate connections
        if (
            socketRef.current &&
            (socketRef.current.readyState === WebSocket.CONNECTING ||
                socketRef.current.readyState === WebSocket.OPEN)
        ) {
            return;
        }

        if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
            console.warn('[WS] Max reconnect attempts reached. Stopping.');
            return;
        }

        // FIXED: the backend's WebSocket endpoint (healthcare-core's
        // /healthcare/ws/reception) authenticates via a `token` query
        // parameter checked *before* accepting the connection — there is
        // no post-connect handshake message. Sending `{token}` as a first
        // message (the old approach) did nothing; the server was never
        // listening for it, and an unauthenticated connection attempt
        // without the query param closes immediately with code 1008.
        const ws = new WebSocket(`${WS_BASE_URL}/ws/reception?token=${encodeURIComponent(token)}`);
        socketRef.current = ws;

        ws.onopen = () => {
            console.log('[WS] Connected');
            reconnectAttempts.current = 0;
            setSocket(ws);
            setIsConnected(true);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                // Server replies to our ping with {"event": "pong", "data": {}}
                // — not the {"type": "pong"} shape this used to check for.
                if (data.event === 'pong') {
                    return;
                }
                setLastMessage(data);
            } catch (e) {
                console.error('[WS] Parse error:', e);
            }
        };

        ws.onerror = (err) => {
            console.error('[WS] Error:', err);
        };

        // The server only replies to pings (it never initiates them), so
        // send one periodically to detect half-open connections.
        const pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000);

        ws.onclose = (event) => {
            clearInterval(pingInterval);
            setSocket(null);
            setIsConnected(false);
            socketRef.current = null;

            // 1008 = auth failure — don't retry
            if (event.code === 1008) {
                console.error('[WS] Auth failed (1008). Not retrying.');
                return;
            }

            // 1000 = clean close (logout) — don't retry
            if (event.code === 1000) {
                return;
            }

            reconnectAttempts.current += 1;
            const delay = Math.min(3000 * reconnectAttempts.current, 30000);
            console.log(`[WS] Disconnected. Retrying in ${delay / 1000}s... (attempt ${reconnectAttempts.current})`);
            reconnectTimer.current = setTimeout(connect, delay);
        };
    }, []);

    const sendMessage = useCallback((data) => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify(data));
        } else {
            console.warn('[WS] Cannot send — not connected');
        }
    }, []);

    const disconnect = useCallback(() => {
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
        if (socketRef.current) {
            socketRef.current.close(1000, 'User logged out');
            socketRef.current = null;
        }
        setSocket(null);
        setIsConnected(false);
    }, []);

    useEffect(() => {
        connect();

        // Poll for late login (token added after mount)
        const tokenPoll = setInterval(() => {
            if (!socketRef.current && sessionStorage.getItem('hospain_access_token')) {
                connect();
            }
        }, 5000);

        return () => {
            clearInterval(tokenPoll);
            disconnect();
        };
    }, [connect, disconnect]);

    return (
        <SocketContext.Provider value={{ socket, lastMessage, isConnected, sendMessage }}>
            {children}
        </SocketContext.Provider>
    );
};
