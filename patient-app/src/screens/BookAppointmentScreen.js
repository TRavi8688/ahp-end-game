import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, SafeAreaView, StatusBar, Alert, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { appointmentService } from '../services/appointmentService';
import { patientService } from '../services/patientService';

function formatDate(d) {
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// BUG FIX: this screen used to call appointmentService.getDoctorSlots(),
// which always throws — there is no real-time slot-availability backend
// (no `doctor_availability` table provisioned), so the slot grid was always
// empty and nobody could ever finish booking. Until that's built for real,
// we offer standard half-hour clinic slots and let the backend's own
// scheduling-conflict check (409 on an exact doctor+time clash) be the
// source of truth — if a slot turns out to be taken, the user sees a clear
// error and can pick another time instead of the booking silently failing.
function generateStandardSlots(date) {
  const slots = [];
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  for (let hour = 9; hour < 18; hour++) {
    for (const minute of [0, 30]) {
      const slotTime = new Date(date);
      slotTime.setHours(hour, minute, 0, 0);
      if (isToday && slotTime <= now) continue;
      slots.push({
        label: slotTime.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }),
        iso: slotTime.toISOString(),
      });
    }
  }
  return slots;
}

export default function BookAppointmentScreen({ navigation, route }) {
  const { doctor } = route.params;

  const today   = new Date();
  const dates   = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const [selectedDate,   setSelectedDate]   = useState(dates[0]);
  const [slots,          setSlots]          = useState([]);
  const [selectedSlot,   setSelectedSlot]   = useState(null);
  const [notes,          setNotes]          = useState('');
  const [booking,        setBooking]        = useState(false);

  // Regenerate the candidate time list whenever the selected date changes
  useEffect(() => {
    setSlots(generateStandardSlots(selectedDate));
    setSelectedSlot(null);
  }, [selectedDate]);

  const handleBook = async () => {
    if (!selectedSlot) {
      Alert.alert('Select a time', 'Please choose a time for your visit first.');
      return;
    }
    setBooking(true);
    try {
      const profile = await patientService.getProfile();
      if (!profile?.id) {
        throw new Error('Could not load your patient profile. Please try again.');
      }

      const result = await appointmentService.bookAppointment({
        patient_id:       profile.id,
        doctor_id:        doctor.id,
        hospital_id:      doctor.hospital_id,
        scheduled_at:     selectedSlot,
        chief_complaint:  notes.trim() || undefined,
      });

      Alert.alert(
        'Appointment Booked',
        `Your appointment with Dr. ${doctor.full_name} on ${formatDate(selectedDate)} is confirmed.`,
        [{ text: 'OK', onPress: () => navigation.replace('Appointments') }]
      );
    } catch (e) {
      const detail = e?.response?.data?.detail || e?.response?.data?.message;
      if (e?.response?.status === 409) {
        Alert.alert('Time Unavailable', 'That slot was just taken. Please pick another time.');
      } else {
        Alert.alert('Booking Failed', detail || e.message || 'Something went wrong. Please try again.');
      }
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
        <Text style={styles.sectionLabel}>Select a Time — {formatDate(selectedDate)}</Text>
        {slots.length === 0 ? (
          <Text style={styles.noSlots}>No times available today — try another date.</Text>
        ) : (
          <View style={styles.slotsGrid}>
            {slots.map((slot, i) => {
              const isSelected = slot.iso === selectedSlot;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.slot, isSelected && styles.slotSelected]}
                  onPress={() => setSelectedSlot(slot.iso)}
                >
                  <Text style={[styles.slotText, isSelected && styles.slotTextSelected]}>
                    {slot.label}
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

        <Text style={styles.payAtClinicNote}>
          ₹{doctor.consultation_fee} consultation fee — payable at the hospital/clinic.
        </Text>
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
  container:          { flex: 1, backgroundColor: '#070D17' },
  header:             { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 8 },
  backBtn:            { marginRight: 12, padding: 4 },
  title:              { fontSize: 20, fontWeight: '800', color: '#fff' },

  doctorCard:         { flexDirection: 'row', alignItems: 'center', margin: 16,
                        backgroundColor: '#0F172A', borderRadius: 16, padding: 16,
                        borderWidth: 1, borderColor: '#1E293B', gap: 14 },
  avatar:             { width: 52, height: 52, borderRadius: 26, backgroundColor: '#1E293B',
                        justifyContent: 'center', alignItems: 'center' },
  avatarText:         { color: '#5B9BD5', fontSize: 22, fontWeight: '800' },
  doctorName:         { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 2 },
  doctorSub:          { color: '#64748B', fontSize: 12, marginBottom: 4 },
  fee:                { color: '#0D9488', fontSize: 13, fontWeight: '600' },

  sectionLabel:       { color: '#94A3B8', fontSize: 12, fontWeight: '700', letterSpacing: 1,
                        paddingHorizontal: 16, marginTop: 20, marginBottom: 10, textTransform: 'uppercase' },

  dateRow:            { paddingHorizontal: 16, marginBottom: 4 },
  dateChip:           { width: 56, height: 64, borderRadius: 14, backgroundColor: '#0F172A',
                        justifyContent: 'center', alignItems: 'center', marginRight: 10,
                        borderWidth: 1, borderColor: '#1E293B' },
  dateChipActive:     { backgroundColor: '#5B9BD5', borderColor: '#5B9BD5' },
  dateDay:            { color: '#64748B', fontSize: 11, fontWeight: '600', marginBottom: 4 },
  dateNum:            { color: '#fff', fontSize: 18, fontWeight: '800' },
  dateTextActive:     { color: '#fff' },

  noSlots:            { color: '#475569', textAlign: 'center', marginVertical: 16, paddingHorizontal: 16 },
  slotsGrid:          { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10 },
  slot:               { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
                        backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#1E293B' },
  slotUnavailable:    { opacity: 0.35 },
  slotSelected:       { backgroundColor: '#5B9BD5', borderColor: '#5B9BD5' },
  slotText:           { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  slotTextUnavailable:{ textDecorationLine: 'line-through' },
  slotTextSelected:   { color: '#fff' },

  notesInput:         { marginHorizontal: 16, backgroundColor: '#0F172A', borderRadius: 12,
                        borderWidth: 1, borderColor: '#1E293B', color: '#fff', padding: 14,
                        fontSize: 14, textAlignVertical: 'top', minHeight: 80 },
  payAtClinicNote:    { color: '#64748B', fontSize: 12, textAlign: 'center',
                        marginTop: 18, marginHorizontal: 24 },

  payRow:             { flexDirection: 'row', paddingHorizontal: 16, gap: 10 },
  payChip:            { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                        gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: '#0F172A',
                        borderWidth: 1, borderColor: '#1E293B' },
  payChipActive:      { backgroundColor: '#5B9BD5', borderColor: '#5B9BD5' },
  payText:            { color: '#64748B', fontSize: 13, fontWeight: '600' },
  payTextActive:      { color: '#fff' },

  footer:             { position: 'absolute', bottom: 0, left: 0, right: 0,
                        padding: 20, backgroundColor: '#070D17',
                        borderTopWidth: 1, borderTopColor: '#0F172A' },
  bookBtn:            { backgroundColor: '#5B9BD5', borderRadius: 14, height: 52,
                        justifyContent: 'center', alignItems: 'center' },
  bookBtnText:        { color: '#fff', fontSize: 16, fontWeight: '800' },
});
