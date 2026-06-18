import { useEffect, useRef, useState, useCallback } from "react";

const BASE_DELAY = 1000;
const MAX_DELAY = 30000;

/**
 * useQueueWebSocket
 * Connects to ws://[API_BASE]/ws/queue/{hospital_id}?token=JWT
 * Handles: queue_update | patient_called | patient_completed
 * Auto-reconnects with exponential backoff (1s → 2s → 4s … 30s max)
 */
export function useQueueWebSocket(hospitalId) {
  const [queueData, setQueueData] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("disconnected"); // "connected" | "disconnected" | "reconnecting"

  const wsRef = useRef(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef(null);
  const isMountedRef = useRef(true);

  const getToken = () =>
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token") ||
    "";

  const getWsUrl = useCallback(() => {
    const apiBase =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
    // Convert http(s) → ws(s)
    const wsBase = apiBase.replace(/^http/, "ws");
    const token = getToken();
    return `${wsBase}/ws/queue/${hospitalId}?token=${token}`;
  }, [hospitalId]);

  const connect = useCallback(() => {
    if (!isMountedRef.current || !hospitalId) return;

    const url = getWsUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isMountedRef.current) return;
      retryCountRef.current = 0;
      setIsConnected(true);
      setConnectionStatus("connected");
    };

    ws.onmessage = (event) => {
      if (!isMountedRef.current) return;
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          // New patient added to queue
          case "queue_update":
            setQueueData((prev) => {
              // Avoid duplicates
              const exists = prev.find((p) => p.id === msg.patient.id);
              if (exists) {
                return prev.map((p) =>
                  p.id === msg.patient.id ? { ...p, ...msg.patient } : p
                );
              }
              // Prepend new patient (slide-in from top)
              return [{ ...msg.patient, _isNew: true }, ...prev];
            });
            break;

          // Doctor calls a patient
          case "patient_called":
            setQueueData((prev) =>
              prev.map((p) =>
                p.id === msg.patient_id
                  ? { ...p, status: "with_doctor", _isNew: false }
                  : p
              )
            );
            break;

          // Visit completed — remove from queue
          case "patient_completed":
            setQueueData((prev) =>
              prev.filter((p) => p.id !== msg.patient_id)
            );
            break;

          // Full queue snapshot (e.g. on first connect)
          case "queue_snapshot":
            setQueueData(msg.patients || []);
            break;

          default:
            break;
        }
      } catch (err) {
        console.warn("[useQueueWebSocket] Failed to parse message:", err);
      }
    };

    ws.onerror = () => {
      // onerror is always followed by onclose — handle reconnect there
    };

    ws.onclose = (event) => {
      if (!isMountedRef.current) return;
      setIsConnected(false);

      // 1000 = normal closure (unmount), don't reconnect
      if (event.code === 1000) {
        setConnectionStatus("disconnected");
        return;
      }

      setConnectionStatus("reconnecting");
      const delay = Math.min(
        BASE_DELAY * Math.pow(2, retryCountRef.current),
        MAX_DELAY
      );
      retryCountRef.current += 1;

      retryTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) connect();
      }, delay);
    };
  }, [getWsUrl, hospitalId]);

  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      clearTimeout(retryTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close(1000, "component unmounted");
      }
    };
  }, [connect]);

  return { queueData, isConnected, connectionStatus };
}
