/**
 * useLiveQueue
 * Manages WebSocket connection to the queue engine.
 * Falls back to polling every 15 s if WS is not available.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { createQueueSocket, getLiveQueue } from "../services/receptionApi";

export const useLiveQueue = (hospitalId) => {
  const [queue, setQueue] = useState([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef(null);
  const pollRef = useRef(null);

  const fetchQueue = useCallback(async () => {
    if (!hospitalId) return;
    try {
      const data = await getLiveQueue(hospitalId);
      setQueue(data || []);
    } catch (e) {
      console.error("Queue fetch failed:", e);
    } finally {
      setLoading(false);
    }
  }, [hospitalId]);

  useEffect(() => {
    if (!hospitalId) return;

    // Initial load
    fetchQueue();

    // Try WebSocket
    try {
      const ws = createQueueSocket(
        hospitalId,
        (msg) => {
          // Server sends { event: "queue_update", data: [...] }
          if (msg.event === "queue_update" && Array.isArray(msg.data)) {
            setQueue(msg.data);
            setLoading(false);
          }
          if (msg.event === "token_issued" || msg.event === "token_called") {
            fetchQueue(); // lightweight re-sync
          }
        },
        () => {
          setConnected(false);
          // Fall back to polling
          pollRef.current = setInterval(fetchQueue, 15000);
        }
      );

      ws.onopen = () => setConnected(true);
      wsRef.current = ws;
    } catch {
      // WS not available (dev / HTTP) — poll
      pollRef.current = setInterval(fetchQueue, 15000);
    }

    return () => {
      wsRef.current?.close();
      clearInterval(pollRef.current);
    };
  }, [hospitalId, fetchQueue]);

  return { queue, connected, loading, refetch: fetchQueue };
};
