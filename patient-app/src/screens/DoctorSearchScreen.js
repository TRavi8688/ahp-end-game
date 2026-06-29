import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, SafeAreaView, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { appointmentService } from '../services/appointmentService';

const SPECIALTIES = [
  'All', 'General', 'Cardiology', 'Dermatology',
  'Orthopedics', 'Pediatrics', 'Neurology', 'Gynecology',
];

export default function DoctorSearchScreen({ navigation }) {
  const [query, setQuery]           = useState('');
  const [specialty, setSpecialty]   = useState('All');
  const [doctors, setDoctors]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [searched, setSearched]     = useState(false);

  const search = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const params = {};
      if (query.trim())       params.name      = query.trim();
      if (specialty !== 'All') params.specialty = specialty;
      const data = await appointmentService.searchDoctors(params);
      setDoctors(data.doctors || []);
    } catch (e) {
      setError('Could not load doctors. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [query, specialty]);

  const renderDoctor = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('BookAppointment', { doctor: item })}
      activeOpacity={0.85}
    >
      <View style={styles.cardLeft}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.full_name?.[0] ?? 'D'}</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.doctorName}>Dr. {item.full_name}</Text>
        <Text style={styles.specialty}>{item.specialty}</Text>
        <Text style={styles.hospital}>{item.hospital_name}</Text>
        <View style={styles.meta}>
          <Ionicons name="star" size={12} color="#F59E0B" />
          <Text style={styles.metaText}>{item.rating ?? '—'}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText}>₹{item.consultation_fee ?? '—'}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText}>{item.experience_years ?? '—'} yrs exp</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#475569" style={{ alignSelf: 'center' }} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Find a Doctor</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color="#64748B" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Doctor name…"
            placeholderTextColor="#64748B"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={search}
            returnKeyType="search"
          />
        </View>
        <TouchableOpacity style={styles.searchBtn} onPress={search}>
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* Specialty chips */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={SPECIALTIES}
        keyExtractor={(s) => s}
        contentContainerStyle={styles.chips}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.chip, specialty === item && styles.chipActive]}
            onPress={() => setSpecialty(item)}
          >
            <Text style={[styles.chipText, specialty === item && styles.chipTextActive]}>
              {item}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Results */}
      {loading ? (
        <ActivityIndicator size="large" color="#5B9BD5" style={{ marginTop: 60 }} />
      ) : error ? (
        <View style={styles.empty}>
          <Ionicons name="wifi-outline" size={44} color="#334155" />
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={search}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : searched && doctors.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="person-outline" size={44} color="#334155" />
          <Text style={styles.emptyText}>No doctors found.</Text>
          <Text style={styles.emptySubText}>Try a different name or specialty.</Text>
        </View>
      ) : (
        <FlatList
          data={doctors}
          keyExtractor={(d) => String(d.id)}
          renderItem={renderDoctor}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#070D17' },
  header:         { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 8 },
  backBtn:        { marginRight: 12, padding: 4 },
  title:          { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },

  searchRow:      { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12, gap: 8 },
  searchBox:      { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A',
                    borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#1E293B' },
  searchInput:    { flex: 1, height: 44, color: '#fff', fontSize: 14 },
  searchBtn:      { backgroundColor: '#5B9BD5', borderRadius: 12, paddingHorizontal: 16,
                    justifyContent: 'center', alignItems: 'center', height: 44 },
  searchBtnText:  { color: '#fff', fontWeight: '700', fontSize: 14 },

  chips:          { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  chip:           { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                    backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#1E293B' },
  chipActive:     { backgroundColor: '#5B9BD5', borderColor: '#5B9BD5' },
  chipText:       { color: '#64748B', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  card:           { flexDirection: 'row', backgroundColor: '#0F172A', borderRadius: 16,
                    padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#1E293B' },
  cardLeft:       { marginRight: 12 },
  avatar:         { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1E293B',
                    justifyContent: 'center', alignItems: 'center' },
  avatarText:     { color: '#5B9BD5', fontSize: 20, fontWeight: '800' },
  cardBody:       { flex: 1 },
  doctorName:     { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  specialty:      { color: '#5B9BD5', fontSize: 12, fontWeight: '600', marginBottom: 2 },
  hospital:       { color: '#64748B', fontSize: 12, marginBottom: 6 },
  meta:           { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:       { color: '#94A3B8', fontSize: 11 },
  metaDot:        { color: '#334155', fontSize: 11 },

  empty:          { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText:      { color: '#94A3B8', fontSize: 16, fontWeight: '600', marginTop: 16, textAlign: 'center' },
  emptySubText:   { color: '#475569', fontSize: 13, marginTop: 6, textAlign: 'center' },
  retryBtn:       { marginTop: 20, backgroundColor: '#1E293B', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  retryText:      { color: '#5B9BD5', fontWeight: '700' },
});
