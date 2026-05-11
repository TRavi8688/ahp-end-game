import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Alert } from 'react-native';
import { WS_BASE_URL } from '../api';
import { useAuth } from './AuthContext';
import { SecurityUtils } from '../utils/security';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const { isAuthenticated } = useAuth();
    const [socket, setSocket] = useState(null);
    const [lastMessage, setLastMessage] = useState(null);
    const [retryCount, setRetryCount] = useState(0);
    const reconnectTimer = useRef(null);
    const MAX_RETRIES = 5;

    // Connect/Disconnect based on global Auth State
    useEffect(() => {
        if (isAuthenticated) {
            connect();
        } else {
            if (socket) {
                socket.close();
                setSocket(null);
            }
        }
        return () => {
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
        };
    }, [isAuthenticated]);

    const connect = async () => {
        const latestToken = await SecurityUtils.getToken();

        if (!latestToken) {
            console.log('[Socket] No session token, skipping connection.');
            return;
        }

        if (socket && socket.readyState <= 1) {
            return;
        }

        if (retryCount >= MAX_RETRIES) {
            console.warn('[Socket] Max retries reached.');
            return;
        }

        console.log(`[Socket] Connecting to bridge... (Attempt ${retryCount + 1})`);

        try {
            const ws = new WebSocket(`${WS_BASE_URL}/ws/${latestToken}`);

            ws.onopen = () => {
                console.log('[Socket] Hospyn WebSocket Connected ✅');
                setSocket(ws);
                setRetryCount(0);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('[Socket] Event:', data.type);
                    if (data.type === 'consent_request') {
                        Alert.alert('New Access Request', data.message);
                    }
                    setLastMessage(data);
                } catch (e) {
                    console.error('[Socket] Data Error:', e);
                }
            };

            ws.onclose = (e) => {
                console.log(`[Socket] Bridge closed. Code: ${e.code}`);
                setSocket(null);
                const delay = e.code === 1008 ? 30000 : 5000;
                if (latestToken) {
                    setRetryCount(prev => prev + 1);
                    reconnectTimer.current = setTimeout(connect, delay);
                }
            };

            ws.onerror = (err) => {
                console.error('[Socket] Bridge Error:', err.message || err);
            };
        } catch (err) {
            console.error('[Socket] Init Error:', err);
        }
    };


    return (
        <SocketContext.Provider value={{ socket, lastMessage }}>
            {children}
        </SocketContext.Provider>
    );
};
