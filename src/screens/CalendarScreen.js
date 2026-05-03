// ─────────────────────────────────────────────────────────────────
// CalendarScreen.js — Havi naptár nézet + natív naptár import
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Platform,
} from "react-native";
import * as Calendar from "expo-calendar";
import { colors } from "../theme/colors";
import { shared } from "../theme/styles";

const DAYS = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];
const MONTHS = ["Január","Február","Március","Április","Május","Június","Július","Augusztus","Szeptember","Október","November","December"];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  // 0=Vasárnap → átrendezzük H=0
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

export default function CalendarScreen({ contacts = [], activeRole = "seller", onDayPress, onBack }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [nativeEvents, setNativeEvents] = useState([]);
  const [loadingNative, setLoadingNative] = useState(false);

  // Registless időpontok
  const allAppts = contacts.flatMap(c => {
    const appts = activeRole === "seller" ? (c.appointments || []) : (c.calendar || []);
    return appts.map(a => ({ ...a, contactName: c.name, contactId: c.id, source: "registless" }));
  });

  // Napra eső időpontok
  function getApptsForDay(day) {
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    const dateStr = `${mm}.${dd}`;
    const registless = allAppts.filter(a => a.datum === dateStr || a.datum?.endsWith(dateStr));
    const native = nativeEvents.filter(e => {
      const d = new Date(e.startDate);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
    return [...registless, ...native.map(e => ({ id: e.id, serviceName: e.title, ido: new Date(e.startDate).toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" }), source: "native", contactName: e.location || "" }))];
  }

  // Natív naptár betöltés
  const loadNativeCalendar = useCallback(async () => {
    setLoadingNative(true);
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Engedély szükséges", "A natív naptár importáláshoz engedélyezd a naptár hozzáférést.");
        setLoadingNative(false);
        return;
      }
      // Android: getCalendarsAsync paraméter nélkül, iOS: EntityTypes.EVENT
      const calendars = Platform.OS === "ios"
        ? await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT)
        : await Calendar.getCalendarsAsync();
      if (!calendars || calendars.length === 0) {
        setNativeEvents([]);
        setLoadingNative(false);
        return;
      }
      const start = new Date(year, month, 1, 0, 0, 0);
      const end   = new Date(year, month + 1, 0, 23, 59, 59);
      const events = await Calendar.getEventsAsync(
        calendars.map(c => c.id),
        start,
        end
      );
      setNativeEvents(events || []);
    } catch (e) {
      console.warn("Naptár betöltési hiba:", e.message);
      setNativeEvents([]);
    }
    setLoadingNative(false);
  }, [year, month]);

  useEffect(() => {
    loadNativeCalendar();
  }, [loadNativeCalendar]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const todayStr = `${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDay(1);
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDay(1);
  }

  const selectedAppts = getApptsForDay(selectedDay);

  // Napok előállítása
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <View style={st.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={st.header}>
          <Text style={st.title}>📅 Naptár</Text>
          <TouchableOpacity onPress={loadNativeCalendar} style={st.syncBtn}>
            {loadingNative
              ? <ActivityIndicator size="small" color={colors.accent} />
              : <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "600" }}>⟳ Szinkron</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Hónap navigáció */}
        <View style={st.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={st.navBtn}>
            <Text style={st.navBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={st.monthTitle}>{year}. {MONTHS[month]}</Text>
          <TouchableOpacity onPress={nextMonth} style={st.navBtn}>
            <Text style={st.navBtnText}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Napok fejléce */}
        <View style={st.daysHeader}>
          {DAYS.map(d => (
            <Text key={d} style={[st.dayHeader, (d === "Szo" || d === "V") && { color: "#f44336" }]}>{d}</Text>
          ))}
        </View>

        {/* Naptár rács */}
        <View style={st.grid}>
          {cells.map((day, i) => {
            if (!day) return <View key={`empty-${i}`} style={st.cell} />;
            const mm = String(month + 1).padStart(2, "0");
            const dd = String(day).padStart(2, "0");
            const dateStr = `${mm}.${dd}`;
            const hasAppt = allAppts.some(a => a.datum === dateStr || a.datum?.endsWith(dateStr));
            const hasNative = nativeEvents.some(e => {
              const d = new Date(e.startDate);
              return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
            });
            const isToday = year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
            const isSelected = day === selectedDay;
            const isWeekend = ((i % 7) === 5 || (i % 7) === 6);

            return (
              <TouchableOpacity
                key={day}
                style={[
                  st.cell,
                  isSelected && st.cellSelected,
                  isToday && !isSelected && st.cellToday,
                ]}
                onPress={() => setSelectedDay(day)}
              >
                <Text style={[
                  st.cellText,
                  isSelected && { color: "#000", fontWeight: "bold" },
                  isToday && !isSelected && { color: colors.accent, fontWeight: "bold" },
                  isWeekend && !isSelected && { color: "#f44336" },
                ]}>
                  {day}
                </Text>
                <View style={st.dotRow}>
                  {hasAppt && <View style={[st.dot, { backgroundColor: colors.accent }]} />}
                  {hasNative && <View style={[st.dot, { backgroundColor: "#4CAF50" }]} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Jelmagyarázat */}
        <View style={st.legend}>
          <View style={st.legendItem}>
            <View style={[st.dot, { backgroundColor: colors.accent }]} />
            <Text style={st.legendText}>Registless időpont</Text>
          </View>
          <View style={st.legendItem}>
            <View style={[st.dot, { backgroundColor: "#4CAF50" }]} />
            <Text style={st.legendText}>Telefon naptár</Text>
          </View>
        </View>

        {/* Kiválasztott nap időpontjai */}
        <View style={st.dayDetail}>
          <Text style={st.dayDetailTitle}>
            {year}. {MONTHS[month]} {selectedDay}.
          </Text>
          {selectedAppts.length === 0 ? (
            <View style={[shared.card, { alignItems: "center", paddingVertical: 20 }]}>
              <Text style={{ fontSize: 28, marginBottom: 8 }}>📭</Text>
              <Text style={{ color: colors.textSecondary, textAlign: "center" }}>Nincs időpont ezen a napon.</Text>
            </View>
          ) : (
            selectedAppts.map((a, i) => (
              <TouchableOpacity
                key={a.id || i}
                style={[st.apptCard, { borderColor: a.source === "native" ? "rgba(76,175,80,0.4)" : "rgba(255,122,26,0.3)" }]}
                onPress={() => onDayPress?.(a)}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={{ fontSize: 18 }}>{a.source === "native" ? "📱" : "⚡"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>{a.serviceName || a.title || "Időpont"}</Text>
                    {!!a.ido && <Text style={{ color: colors.accent, fontSize: 13, marginTop: 2 }}>🕐 {a.ido}</Text>}
                    {!!a.contactName && <Text style={{ color: "#888", fontSize: 12, marginTop: 2 }}>👤 {a.contactName}</Text>}
                  </View>
                  {a.amount > 0 && (
                    <Text style={{ color: "#ff7a1a", fontSize: 13, fontWeight: "bold" }}>
                      {a.amount.toLocaleString("hu-HU")} Ft
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Vissza gomb */}
      <TouchableOpacity style={st.backBtn} onPress={onBack}>
        <Text style={{ color: "#ff7a1a", fontSize: 15, fontWeight: "600" }}>← Vissza</Text>
      </TouchableOpacity>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, paddingTop: 52, paddingHorizontal: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { color: "#fff", fontSize: 24, fontWeight: "bold" },
  syncBtn: { backgroundColor: "rgba(255,122,26,0.12)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(255,122,26,0.3)" },
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  navBtn: { padding: 10 },
  navBtnText: { color: "#fff", fontSize: 28, fontWeight: "300" },
  monthTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  daysHeader: { flexDirection: "row", marginBottom: 4 },
  dayHeader: { flex: 1, textAlign: "center", color: "#888", fontSize: 12, fontWeight: "600", paddingVertical: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "14.28%", aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  cellSelected: { backgroundColor: "#ff7a1a" },
  cellToday: { backgroundColor: "rgba(255,122,26,0.15)", borderWidth: 1, borderColor: "rgba(255,122,26,0.4)" },
  cellText: { color: "#fff", fontSize: 14 },
  dotRow: { flexDirection: "row", gap: 2, marginTop: 1 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  legend: { flexDirection: "row", gap: 16, marginTop: 8, marginBottom: 16, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendText: { color: "#888", fontSize: 11 },
  dayDetail: { marginTop: 8 },
  dayDetailTitle: { color: "#fff", fontSize: 16, fontWeight: "bold", marginBottom: 10 },
  apptCard: { backgroundColor: "rgba(20,20,20,0.6)", borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1 },
  backBtn: { position: "absolute", bottom: 49, left: 20, backgroundColor: "rgba(255,122,26,0.15)", borderWidth: 1, borderColor: "#ff7a1a", borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 },
});
