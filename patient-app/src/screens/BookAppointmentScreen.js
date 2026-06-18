import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, SafeAreaView, StatusBar, Alert, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { appointmentService } from '../services/appointmentService';
import { billingService }     from '../services/billingService';

const PAYMENT_METHODS = [
  { id: 'UPI',  label: 'UPI', icon: 'phone-portrait-outline' },
  { id: 'CARD', label: 'Card', icon: 'card-outline' },
  { id: 'CASH', label: 'Pay at clinic', icon: 'cash-outline' },
];

function formatDate(d) {
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export default function BookAppointmentScreen({ navigation, route }) {
  const { doctor } = route.params;

  const today   = new Date();
  const dates   = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const [selectedDate,   setSelectedDate]   = useState(dates[0]);
  const [slots,          setSlots]          = useState([]);
  const [selectedSlot,   setSelectedSlot]   = useState(null);
  const [paymentMethod,  setPaymentMethod]  = useState('UPI');
  const [notes,          setNotes]          = useState('');
  const [loadingSlots,   setLoadingSlots]   = useState(false);
  const [booking,        setBooking]        = useState(false);

  // Load slots whenever selected date changes
  useEffect(() => {
    let cancelled = false;
    const iso = selectedDate.toISOString().split('T')[0];
    setLoadingSlots(true);
    setSlots([]);
    setSelectedSlot(null);
    appointmentService.getDoctorSlots(doctor.id, iso)
      .then((data) => { if (!cancelled) setSlots(data.slots || []); })
      .catch(() => { if (!cancelled) setSlots([]); })
      .finally(() => { if (!cancelled) setLoadingSlots(false); });
    return () => { cancelled = true; };
  }, [selectedDate, doctor.id]);

  const handleBook = async () => {
    if (!selectedSlot) {
      Alert.alert('Select a slot', 'Please choose an available time slot first.');
      return;
    }
    setBooking(true);
    try {
      const result = await appointmentService.bookAppointment({
        doctor_id:      doctor.id,
        slot_time:      selectedSlot,
        notes:          notes.trim(),
        payment_method: paymentMethod,
      });

      // If UPI, initiate payment
      if (paymentMethod === 'UPI' && result.payment_url) {
        // Hand off to billing deep link — handled by OS UPI intent
        await billingService.payInvoice(result.invoice_id, doctor.consultation_fee, 'UPI');
      }

      // Navigate to live queue screen
      navigation.replace('QueueStatus', {
        queueToken:    result.queue_token,
        appointmentId: result.appointment_id,
        doctor,
      });
    } catch (e) {
      Alert.alert('Booking Failed', e?.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally {
      setBooking(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Book Appointment</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Doctor card */}
        <View style={styles.doctorCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{doctor.full_name?.[0] ?? 'D'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.doctorName}>Dr. {doctor.full_name}</Text>
            <Text style={styles.doctorSub}>{doctor.specialty} · {doctor.hospital_name}</Text>
            <Text style={styles.fee}>₹{doctor.consultation_fee} consultation fee</Text>
          </View>
        </View>

        {/* Date picker */}
        <Text style={styles.sectionLabel}>Select Date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateRow}>
          {dates.map((d, i) => {
            const isSelected = d.toDateString() === selectedDate.toDateString();
            return (
              <TouchableOpacity
                key={i}
                style={[styles.dateChip, isSelected && styles.dateChipActive]}
                onPress={() => setSelectedDate(d)}
              >
                <Text style={[styles.dateDay, isSelected && styles.dateTextActive]}>
                  {d.toLocaleDateString('en-IN', { weekday: 'short' })}
                </Text>
                <Text style={[styles.dateNum, isSelected && styles.dateTextActive]}>
                  {d.getDate()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Time slots */}
        <Text style={styles.sectionLabel}>Available Slots — {formatDate(selectedDate)}</Text>
        {loadingSlots ? (
          <ActivityIndicator color="#6366F1" style={{ marginVertical: 20 }} />
        ) : slots.length === 0 ? (
          <Text style={styles.noSlots}>No slots available on this date.</Text>
        ) : (
          <View style={styles.slotsGrid}>
            {slots.map((slot, i) => {
              const isSelected = slot.time === selectedSlot;
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.slot,
                    !slot.available && styles.slotUnavailable,
                    isSelected && styles.slotSelected,
                  ]}
                  onPress={() => slot.available && setSelectedSlot(slot.time)}
                  disabled={!slot.available}
                >
                  <Text style={[
                    styles.slotText,
                    !slot.available && styles.slotTextUnavailable,
                    isSelected && styles.slotTextSelected,
                  ]}>
                    {slot.time}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Notes */}
        <Text style={styles.sectionLabel}>Symptoms / Notes (optional)</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Describe symptoms or reason for visit…"
          placeholderTextColor="#475569"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />

        {/* Payment method */}
        <Text style={styles.sectionLabel}>Payment Method</Text>
        <View style={styles.payRow}>
          {PAYMENT_METHODS.map((pm) => (
            <TouchableOpacity
              key={pm.id}
              style={[styles.payChip, paymentMethod === pm.id && styles.payChipActive]}
              onPress={() => setPaymentMethod(pm.id)}
            >
              <Ionicons name={pm.icon} size={18} color={paymentMethod === pm.id ? '#fff' : '#64748B'} />
              <Text style={[styles.payText, paymentMethod === pm.id && styles.payTextActive]}>
                {pm.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Confirm button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.bookBtn} onPress={handleBook} disabled={booking}>
          {booking
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.bookBtnText}>Confirm Booking · ₹{doctor.consultation_fee}</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#050810' },
  header:             { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 8 },
  backBtn:            { marginRight: 12, padding: 4 },
  title:              { fontSize: 20, fontWeight: '800', color: '#fff' },

  doctorCard:         { flexDirection: 'row', alignItems: 'center', margin: 16,
                        backgroundColor: '#0F172A', borderRadius: 16, padding: 16,
                        borderWidth: 1, borderColor: '#1E293B', gap: 14 },
  avatar:             { width: 52, height: 52, borderRadius: 26, backgroundColor: '#1E293B',
                        justifyContent: 'center', alignItems: 'center' },
  avatarText:         { color: '#6366F1', fontSize: 22, fontWeight: '800' },
  doctorName:         { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 2 },
  doctorSub:          { color: '#64748B', fontSize: 12, marginBottom: 4 },
  fee:                { color: '#0D9488', fontSize: 13, fontWeight: '600' },

  sectionLabel:       { color: '#94A3B8', fontSize: 12, fontWeight: '700', letterSpacing: 1,
                        paddingHorizontal: 16, marginTop: 20, marginBottom: 10, textTransform: 'uppercase' },

  dateRow:            { paddingHorizontal: 16, marginBottom: 4 },
  dateChip:           { width: 56, height: 64, borderRadius: 14, backgroundColor: '#0F172A',
                        justifyContent: 'center', alignItems: 'center', marginRight: 10,
                        borderWidth: 1, borderColor: '#1E293B' },
  dateChipActive:     { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  dateDay:            { color: '#64748B', fontSize: 11, fontWeight: '600', marginBottom: 4 },
  dateNum:            { color: '#fff', fontSize: 18, fontWeight: '800' },
  dateTextActive:     { color: '#fff' },

  noSlots:            { color: '#475569', textAlign: 'center', marginVertical: 16, paddingHorizontal: 16 },
  slotsGrid:          { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10 },
  slot:               { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
                        backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#1E293B' },
  slotUnavailable:    { opacity: 0.35 },
  slotSelected:       { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  slotText:           { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  slotTextUnavailable:{ textDecorationLine: 'line-through' },
  slotTextSelected:   { color: '#fff' },

  notesInput:         { marginHorizontal: 16, backgroundColor: '#0F172A', borderRadius: 12,
                        borderWidth: 1, borderColor: '#1E293B', color: '#fff', padding: 14,
                        fontSize: 14, textAlignVertical: 'top', minHeight: 80 },

  payRow:             { flexDirection: 'row', paddingHorizontal: 16, gap: 10 },
  payChip:            { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                        gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: '#0F172A',
                        borderWidth: 1, borderColor: '#1E293B' },
  payChipActive:      { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  payText:            { color: '#64748B', fontSize: 13, fontWeight: '600' },
  payTextActive:      { color: '#fff' },

  footer:             { position: 'absolute', bottom: 0, left: 0, right: 0,
                        padding: 20, backgroundColor: '#050810',
                        borderTopWidth: 1, borderTopColor: '#0F172A' },
  bookBtn:            { backgroundColor: '#6366F1', borderRadius: 14, height: 52,
                        justifyContent: 'center', alignItems: 'center' },
  bookBtnText:        { color: '#fff', fontSize: 16, fontWeight: '800' },
});
