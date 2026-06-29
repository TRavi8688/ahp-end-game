import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  TouchableOpacity, ActivityIndicator, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { appointmentService } from '../services/appointmentService';

const WS_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.hospin.in')
  .replace('https://', 'wss://')
  .replace('http://', 'ws://');

export default function QueueStatusScreen({ navigation, route }) {
  const { queueToken, appointmentId, doctor } = route.params;

  const [position, setPosition]     = useState(null);
  const [waitMins, setWaitMins]     = useState(null);
  const [status,   setStatus]       = useState('WAITING'); // WAITING | IN_PROGRESS | DONE | ERROR
  const [wsState,  setWsState]      = useState('connecting'); // connecting | open | closed

  const wsRef     = useRef(null);
  const pollRef   = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for the queue badge
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const applyUpdate = useCallback((data) => {
    if (data.position  !== undefined) setPosition(data.position);
    if (data.estimated_wait_minutes !== undefined) setWaitMins(data.estimated_wait_minutes);
    if (data.status    !== undefined) setStatus(data.status);
  }, []);

  // Polling fallback — used when WebSocket is closed/unavailable
  const startPolling = useCallback(() => {
    pollRef.current = setInterval(async () => {
      try {
        const data = await appointmentService.getQueueStatus(queueToken);
        applyUpdate(data);
        if (data.status === 'DONE') clearInterval(pollRef.current);
      } catch { /* silent */ }
    }, 15000); // every 15s
  }, [queueToken, applyUpdate]);

  // WebSocket setup
  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(`${WS_BASE}/ws/queue/${queueToken}`);
      wsRef.current = ws;

      ws.onopen  = () => { setWsState('open'); };
      ws.onclose = () => {
        setWsState('closed');
        startPolling(); // fall back to polling
      };
      ws.onerror = () => {
        setWsState('closed');
        ws.close();
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          applyUpdate(data);
        } catch { /* bad frame */ }
      };
    };

    connect();

    return () => {
      wsRef.current?.close();
      clearInterval(pollRef.current);
    };
  }, [queueToken, applyUpdate, startPolling]);

  // Initial poll so we show data immediately
  useEffect(() => {
    appointmentService.getQueueStatus(queueToken)
      .then(applyUpdate)
      .catch(() => {});
  }, []);

  const isDone       = status === 'DONE' || status === 'COMPLETED';
  const isInProgress = status === 'IN_PROGRESS';

  const statusColor = isDone       ? '#0D9488'
                    : isInProgress ? '#F59E0B'
                    : '#5B9BD5';

  const statusLabel = isDone       ? "It's your turn!"
                    : isInProgress ? 'Doctor is ready for you'
                    : 'Waiting in queue';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.popToTop()} style={styles.backBtn}>
          <Ionicons name="home-outline" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Queue Status</Text>
        <View style={[styles.dot, { backgroundColor: wsState === 'open' ? '#0D9488' : '#F59E0B' }]} />
      </View>

      {/* Doctor info */}
      <View style={styles.doctorRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{doctor?.full_name?.[0] ?? 'D'}</Text>
        </View>
        <View>
          <Text style={styles.doctorName}>Dr. {doctor?.full_name}</Text>
          <Text style={styles.doctorSub}>{doctor?.specialty} · {doctor?.hospital_name}</Text>
        </View>
      </View>

      {/* Main badge */}
      <View style={styles.center}>
        {position === null ? (
          <ActivityIndicator size="large" color="#5B9BD5" />
        ) : (
          <>
            <Animated.View style={[styles.badge, { borderColor: statusColor, transform: [{ scale: pulseAnim }] }]}>
              {isDone || isInProgress ? (
                <Ionicons name="checkmark-circle" size={72} color={statusColor} />
              ) : (
                <>
                  <Text style={[styles.posLabel, { color: statusColor }]}>YOUR POSITION</Text>
                  <Text style={[styles.posNumber, { color: statusColor }]}>{position}</Text>
                </>
              )}
            </Animated.View>

            <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>

            {waitMins !== null && !isDone && (
              <Text style={styles.wait}>
                Estimated wait: <Text style={{ color: '#fff', fontWeight: '700' }}>{waitMins} min</Text>
              </Text>
            )}
          </>
        )}
      </View>

      {/* Info cards */}
      <View style={styles.cards}>
        <View style={styles.card}>
          <Ionicons name="refresh-outline" size={20} color="#5B9BD5" />
          <Text style={styles.cardTitle}>Auto-updating</Text>
          <Text style={styles.cardSub}>
            {wsState === 'open' ? 'Live via WebSocket' : 'Polling every 15s'}
          </Text>
        </View>
        <View style={styles.card}>
          <Ionicons name="notifications-outline" size={20} color="#5B9BD5" />
          <Text style={styles.cardTitle}>Push alert</Text>
          <Text style={styles.cardSub}>We'll notify you when it's your turn</Text>
        </View>
      </View>

      {isDone && (
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => navigation.navigate('MainTabs')}
        >
          <Text style={styles.doneBtnText}>Back to Home</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#070D17' },
  header:       { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 8 },
  backBtn:      { marginRight: 12, padding: 4 },
  title:        { flex: 1, fontSize: 20, fontWeight: '800', color: '#fff' },
  dot:          { width: 8, height: 8, borderRadius: 4 },

  doctorRow:    { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 32,
                  backgroundColor: '#0F172A', borderRadius: 14, padding: 14,
                  borderWidth: 1, borderColor: '#1E293B', gap: 12 },
  avatar:       { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1E293B',
                  justifyContent: 'center', alignItems: 'center' },
  avatarText:   { color: '#5B9BD5', fontSize: 18, fontWeight: '800' },
  doctorName:   { color: '#fff', fontSize: 15, fontWeight: '700' },
  doctorSub:    { color: '#64748B', fontSize: 12 },

  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  badge:        { width: 160, height: 160, borderRadius: 80, borderWidth: 3,
                  justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  posLabel:     { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 4 },
  posNumber:    { fontSize: 72, fontWeight: '900', lineHeight: 80 },
  statusLabel:  { fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  wait:         { color: '#64748B', fontSize: 14, textAlign: 'center' },

  cards:        { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 24 },
  card:         { flex: 1, backgroundColor: '#0F172A', borderRadius: 14, padding: 14,
                  borderWidth: 1, borderColor: '#1E293B', gap: 6 },
  cardTitle:    { color: '#fff', fontSize: 13, fontWeight: '700' },
  cardSub:      { color: '#64748B', fontSize: 11 },

  doneBtn:      { marginHorizontal: 16, marginBottom: 32, backgroundColor: '#0D9488',
                  borderRadius: 14, height: 52, justifyContent: 'center', alignItems: 'center' },
  doneBtnText:  { color: '#fff', fontSize: 16, fontWeight: '800' },
});
