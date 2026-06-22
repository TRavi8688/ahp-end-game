/**
 * AppointmentBookingScreen.js
 * Phase 6 Fix: Patient App — Missing appointment booking flow
 *
 * APPLY TO: patient-app/src/screens/AppointmentBookingScreen.js
 *
 * Register in your navigator (AppNavigator.js or similar):
 *   import AppointmentBookingScreen from "./screens/AppointmentBookingScreen";
 *   ...
 *   <Stack.Screen name="AppointmentBooking" component={AppointmentBookingScreen} />
 *   <Stack.Screen name="TimeSlotPicker" component={TimeSlotPickerScreen} />
 *   <Stack.Screen name="BookingConfirmation" component={BookingConfirmationScreen} />
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = process.env.API_BASE_URL || "http://localhost:8000";

export default function AppointmentBookingScreen() {
  const navigation = useNavigation();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("All");
  const [specialties, setSpecialties] = useState(["All"]);

  const fetchDoctors = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const token = await AsyncStorage.getItem("access_token");
      const res = await fetch(`${API_BASE}/api/v1/healthcare/doctors?available=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load doctors");
      const data = await res.json();
      const doctorList = Array.isArray(data) ? data : data.doctors || [];
      setDoctors(doctorList);
      // Extract unique specialties
      const uniqueSpecialties = ["All", ...new Set(doctorList.map((d) => d.specialization).filter(Boolean))];
      setSpecialties(uniqueSpecialties);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDoctors(true);
  };

  const filtered = doctors.filter((d) => {
    const matchSearch =
      d.name?.toLowerCase().includes(search.toLowerCase()) ||
      d.specialization?.toLowerCase().includes(search.toLowerCase());
    const matchSpecialty = specialtyFilter === "All" || d.specialization === specialtyFilter;
    return matchSearch && matchSpecialty;
  });

  const renderDoctorCard = ({ item: doctor }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate("TimeSlotPicker", { doctor })}
      activeOpacity={0.7}
    >
      <View style={styles.cardLeft}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(doctor.name || "D")[0].toUpperCase()}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.doctorName}>{doctor.name || "Unknown Doctor"}</Text>
          <Text style={styles.specialty}>{doctor.specialization || "General Practitioner"}</Text>
          {doctor.experience_years && (
            <Text style={styles.experience}>{doctor.experience_years} years experience</Text>
          )}
          <View style={styles.availBadge}>
            <View style={styles.greenDot} />
            <Text style={styles.availText}>Available Today</Text>
          </View>
        </View>
      </View>
      <View style={styles.cardRight}>
        {doctor.consultation_fee && (
          <Text style={styles.fee}>₹{doctor.consultation_fee}</Text>
        )}
        <Text style={styles.bookBtn}>Book →</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Finding available doctors...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>⚠️ {error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => fetchDoctors()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Book Appointment</Text>
        <Text style={styles.subtitle}>Choose a doctor to book a consultation</Text>
      </View>

      {/* Search */}
      <TextInput
        style={styles.searchInput}
        placeholder="Search doctors or specializations..."
        value={search}
        onChangeText={setSearch}
        placeholderTextColor="#9ca3af"
      />

      {/* Specialty filter chips */}
      <FlatList
        data={specialties}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item}
        style={styles.chips}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.chip, specialtyFilter === item && styles.chipActive]}
            onPress={() => setSpecialtyFilter(item)}
          >
            <Text style={[styles.chipText, specialtyFilter === item && styles.chipTextActive]}>
              {item}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Doctor list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id || item.user_id}
        renderItem={renderDoctorCard}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No doctors available matching your search.</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  header: { padding: 20, paddingBottom: 12, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 14, color: "#6b7280", marginTop: 4 },
  searchInput: {
    margin: 16,
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    fontSize: 14,
    color: "#111827",
  },
  chips: { paddingHorizontal: 16, marginBottom: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginRight: 8,
  },
  chipActive: { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
  chipText: { fontSize: 13, color: "#374151" },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  card: {
    margin: 12,
    marginVertical: 6,
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardLeft: { flexDirection: "row", flex: 1, gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 20, fontWeight: "700", color: "#1d4ed8" },
  cardInfo: { flex: 1 },
  doctorName: { fontSize: 16, fontWeight: "600", color: "#111827" },
  specialty: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  experience: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  availBadge: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 4 },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#16a34a" },
  availText: { fontSize: 12, color: "#16a34a", fontWeight: "500" },
  cardRight: { alignItems: "flex-end", gap: 4 },
  fee: { fontSize: 14, fontWeight: "700", color: "#111827" },
  bookBtn: { fontSize: 13, color: "#3b82f6", fontWeight: "600" },
  loadingText: { color: "#6b7280", fontSize: 14 },
  errorText: { color: "#dc2626", fontSize: 14 },
  retryBtn: { padding: "10px 20px", backgroundColor: "#3b82f6", borderRadius: 8 },
  retryText: { color: "#fff", fontWeight: "600" },
  empty: { padding: 40, alignItems: "center" },
  emptyText: { color: "#9ca3af", textAlign: "center" },
});
