import { useEffect, useRef } from 'react';

const IDLE_TIMEOUT = 15 * 60 * 1000; // 15 minutes

export const useIdleLogout = (onLogout, enabled = true) => {
    const timeoutRef = useRef(null);

    const resetTimer = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        if (enabled) {
            timeoutRef.current = setTimeout(() => {
                console.log('User idle for 15 minutes, logging out...');
                onLogout();
            }, IDLE_TIMEOUT);
        }
    };

    useEffect(() => {
        if (!enabled) return;

        // Events to monitor for activity
        const events = [
            'mousedown',
            'mousemove',
            'keypress',
            'scroll',
            'touchstart'
        ];

        // Initialize timer
        resetTimer();

        // Add listeners
        events.forEach(event => {
            window.addEventListener(event, resetTimer);
        });

        // Cleanup
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            events.forEach(event => {
                window.removeEventListener(event, resetTimer);
            });
        };
    }, [enabled, onLogout]);

    return { resetTimer };
};
