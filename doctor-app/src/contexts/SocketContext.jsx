import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { WS_BASE_URL } from '../api';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [lastMessage, setLastMessage] = useState(null);
    const reconnectTimer = useRef(null);

    const connect = () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        const ws = new WebSocket(`${WS_BASE_URL}/ws/${token}`);

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
            reconnectTimer.current = setTimeout(connect, 3000);
        };
    };

    useEffect(() => {
        connect();
        return () => {
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            if (socket) socket.close();
        };
    }, []);

    return (
        <SocketContext.Provider value={{ socket, lastMessage }}>
            {children}
        </SocketContext.Provider>
    );
};
