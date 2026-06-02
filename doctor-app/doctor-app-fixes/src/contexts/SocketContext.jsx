import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { WS_BASE_URL } from '../api';

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
        const token = localStorage.getItem('token');
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

        const ws = new WebSocket(`${WS_BASE_URL}/ws`);
        socketRef.current = ws;

        ws.onopen = () => {
            console.log('[WS] Connected — completing handshake');
            reconnectAttempts.current = 0;
            // Send auth token as first message (backend expects this)
            ws.send(JSON.stringify({ token }));
            setSocket(ws);
            setIsConnected(true);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                // Silently handle auth confirmation
                if (data.type === 'auth_success' || data.type === 'connected') {
                    console.log('[WS] Auth confirmed');
                    return;
                }
                // Ping/pong keepalive
                if (data.type === 'ping') {
                    ws.send(JSON.stringify({ type: 'pong' }));
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

        ws.onclose = (event) => {
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
            if (!socketRef.current && localStorage.getItem('token')) {
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
