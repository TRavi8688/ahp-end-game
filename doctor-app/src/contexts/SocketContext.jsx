import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { WS_BASE_URL } from '../api';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [lastMessage, setLastMessage] = useState(null);
    const reconnectTimer = useRef(null);
    const socketRef = useRef(null); // Keep a reference to the active socket

    const connect = () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        // Prevent duplicate connections if we already have one active
        if (socketRef.current && (socketRef.current.readyState === WebSocket.CONNECTING || socketRef.current.readyState === WebSocket.OPEN)) {
            return;
        }

        const ws = new WebSocket(`${WS_BASE_URL}/ws/${token}`);
        socketRef.current = ws;

        ws.onopen = () => {
            console.log('WebSocket Connected');
            setSocket(ws);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('WS Message:', data);
                setLastMessage(data);
            } catch (e) {
                console.error('WS Parse Error:', e);
            }
        };

        ws.onerror = (err) => {
            console.error('WebSocket Error:', err);
            ws.close();
        };

        ws.onclose = (event) => {
            if (event.code === 1008) {
                console.error('WebSocket Authentication Failed (1008). Stopping retry.');
                return;
            }
            console.log('WebSocket Disconnected. Retrying in 3s...');
            setSocket(null);
            socketRef.current = null;
            reconnectTimer.current = setTimeout(connect, 3000);
        };
    };

    useEffect(() => {
        connect();

        // Late-login check: Automatically connect WebSocket when token is stored in localStorage!
        const checkTokenInterval = setInterval(() => {
            if (!socketRef.current && localStorage.getItem('token')) {
                console.log("DEBUG: Late login or active token detected, connecting WebSocket...");
                connect();
            }
        }, 3000);

        return () => {
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            clearInterval(checkTokenInterval);
            if (socketRef.current) {
                try {
                    socketRef.current.close();
                } catch (e) {}
            }
        };
    }, []); // Empty dependency array: runs only ONCE on mount!

    return (
        <SocketContext.Provider value={{ socket, lastMessage }}>
            {children}
        </SocketContext.Provider>
    );
};
