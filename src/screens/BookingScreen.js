// ─────────────────────────────────────────────────────────────────
// BookingScreen.js — Időpontfoglalás vevő szemszögből
// Havi naptár → óra négyzetek (zöld=szabad, szürke=foglalt)
// Telefon naptár integrációval + multi-select
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, Dimensions,
} from "react-native";
import * as Calendar from "expo-calendar";
import { colors } from "../theme/colors";
import { shared } from "../theme/styles";

const { width: SW } = Dimensions.get("window");
const DAYS     = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];
const MONTHS   = ["Január","Február","Március","Április","Május","Június","Július","Augusztus","Szeptember","Október","November","December"];
const WORK_START = 8;
const WORK_END   = 20;

function pad(n) { return String(n).padStart(2, "0"); }
function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDayOfMonth(y, m) {
  const d = new Date(y, m, 1).getDay();
  return d === 0 ? 6 : d - 1;
}
function dateStr(y, m, d) { return `${y}-${pad(m+1)}-${pad(d)}`; }

export default function BookingScreen({ contact, onSubmit, onBack }) {
  const today = new Date();
  const [year, setYear]         = useState(today.getFullYear());
  const [month, setMonth]       = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedHours, setSelectedHours] = useState([]); // multi-select
  const [phoneEvents, setPhoneEvents]     = useState([]); // telefon naptár

  const sellerAppts = contact?.appointments || [];

  // ── Telefon naptár betöltés ───────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Calendar.requestCalendarPermissionsAsync();
        if (status !== "granted") return;
        const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        const calIds = cals.map(c => c.id);
        // Kicsit tágabb range timezone biztonság miatt
        const start = new Date(year, month, 1, 0, 0, 0, 0);
        const end   = new Date(year, month + 1, 1, 0, 0, 0, 0); // következő hónap eleje
        const events = await Calendar.getEventsAsync(calIds, start, end);
        console.log("[CAL] Events found:", events.length, "for", year, month+1);
        setPhoneEvents(events);
      } catch {}
    })();
  }, [year, month]);

  // ── Foglalt órák az adott napra ───────────────────────────────
  function getBusyHours(day) {
    const busy = new Set();
    const ds = `${pad(month+1)}.${pad(day)}`;

    // Eladó időpontjai
    sellerAppts.forEach(a => {
      if (a.datum === ds || a.datum?.endsWith(ds)) {
        const h = parseInt(a.ido?.split(":")?.[0] || "0");
        const dur = Math.ceil((a.duration || 60) / 60);
        for (let i = 0; i < dur; i++) busy.add(h + i);
      }
    });

    // Telefon naptár — lokális dátum alapján szűrés
    phoneEvents.forEach(e => {
      const evStart = new Date(e.startDate);
      const evEnd   = new Date(e.endDate);
      // Lokális dátum komponensek
      if (evStart.getFullYear() === year &&
          evStart.getMonth() === month &&
          evStart.getDate() === day) {
        const startH = evStart.getHours();
        const endH   = evEnd.getHours() + (evEnd.getMinutes() > 0 ? 1 : 0);
        for (let h = startH; h < Math.max(endH, startH + 1); h++) busy.add(h);
      }
    });

    return busy;
  }

  // ── Óra toggle ────────────────────────────────────────────────
  function toggleHour(h, busyHours) {
    if (busyHours.has(h)) return;
    setSelectedHours(prev =>
      prev.includes(h) ? prev.filter(x => x !== h) : [...prev, h].sort((a,b) => a-b)
    );
  }

  // ── Küldés ────────────────────────────────────────────────────
  function handleSend() {
    if (!selectedDay || selectedHours.length === 0) {
      Alert.alert("Hiányzó adat", "Válassz napot és legalább egy időpontot!");
      return;
    }
    const sorted = [...selectedHours].sort((a,b) => a-b);
    const startH = sorted[0];
    const endH   = sorted[sorted.length - 1] + 1;
    const dateLabel = `${pad(month+1)}.${pad(selectedDay)}`;

    Alert.alert(
      "Időpont kérés küldése",
      `${contact?.name || "Partner"}\n${dateLabel} ${pad(startH)}:00 – ${pad(endH)}:00\n(${sorted.length} óra)`,
      [
        {
          text: "✅ Elküldöm",
          onPress: () => onSubmit?.({
            datum: dateLabel,
            ido: `${pad(startH)}:00`,
            duration: sorted.length * 60,
            endTime: `${pad(endH)}:00`,
            contactId: contact?.id,
          }),
        },
        { text: "Mégse", style: "cancel" },
      ]
    );
  }

  // ── Naptár navigáció ──────────────────────────────────────────
  function prevMonth() {
    if (month === 0) { setYear(y => y-1); setMonth(11); }
    else setMonth(m => m-1);
    setSelectedDay(null); setSelectedHours([]);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y+1); setMonth(0); }
    else setMonth(m => m+1);
    setSelectedDay(null); setSelectedHours([]);
  }

  const daysInMonth  = getDaysInMonth(year, month);
  const firstDay     = getFirstDayOfMonth(year, month);
  const busyHours    = selectedDay ? getBusyHours(selectedDay) : new Set();
  const hours        = Array.from({ length: WORK_END - WORK_START }, (_, i) => WORK_START + i);

  // Napok amelyeken van foglalt időpont
  function hasBusy(day) {
    const ds = `${pad(month+1)}.${pad(day)}`;
    return sellerAppts.some(a => a.datum === ds || a.datum?.endsWith(ds));
  }

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>📅 Időpont kérés</Text>
          {contact?.name && <Text style={s.subtitle}>→ {contact.name}</Text>}
        </View>

        {/* Havi naptár */}
        <View style={s.calendarBox}>
          <View style={s.calNav}>
            <TouchableOpacity onPress={prevMonth} style={s.navBtn}>
              <Text style={s.navBtnText}>‹</Text>
            </TouchableOpacity>
            <Text style={s.calTitle}>{MONTHS[month]} {year}</Text>
            <TouchableOpacity onPress={nextMonth} style={s.navBtn}>
              <Text style={s.navBtnText}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Nap fejlécek */}
          <View style={s.dayHeaders}>
            {DAYS.map(d => (
              <Text key={d} style={s.dayHeader}>{d}</Text>
            ))}
          </View>

          {/* Naptár grid */}
          <View style={s.calGrid}>
            {Array.from({ length: firstDay }).map((_, i) => (
              <View key={`e${i}`} style={s.dayCell} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const isSelected = selectedDay === day;
              const isPast = new Date(year, month, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
              const busy = hasBusy(day);
              return (
                <TouchableOpacity
                  key={day}
                  style={[
                    s.dayCell,
                    isToday && s.dayCellToday,
                    isSelected && s.dayCellSelected,
                    isPast && s.dayCellPast,
                  ]}
                  onPress={() => {
                    if (isPast) return;
                    setSelectedDay(day);
                    setSelectedHours([]);
                  }}
                  disabled={isPast}
                >
                  <Text style={[
                    s.dayCellText,
                    isSelected && { color: "#000", fontWeight: "bold" },
                    isPast && { color: "#333" },
                    isToday && !isSelected && { color: colors.accent },
                  ]}>{day}</Text>
                  {busy && !isPast && <View style={s.busyDot} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Óra négyzetek */}
        {selectedDay && (
          <View style={s.slotsBox}>
            <Text style={s.slotsTitle}>
              {pad(month+1)}.{pad(selectedDay)} — Válassz szabad órákat
            </Text>
            <Text style={s.slotsLegend}>
              🟩 Szabad  🟥 Foglalt  🟧 Kiválasztott
            </Text>

            <View style={s.slotsGrid}>
              {hours.map(h => {
                const isBusy     = busyHours.has(h);
                const isSelected = selectedHours.includes(h);
                return (
                  <TouchableOpacity
                    key={h}
                    style={[
                      s.slot,
                      isBusy     && s.slotBusy,
                      isSelected && s.slotSelected,
                    ]}
                    onPress={() => toggleHour(h, busyHours)}
                    disabled={isBusy}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      s.slotText,
                      isBusy     && s.slotTextBusy,
                      isSelected && s.slotTextSelected,
                    ]}>
                      {pad(h)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedHours.length > 0 && (
              <View style={s.selectionInfo}>
                <Text style={s.selectionText}>
                  ✅ {pad(selectedHours[0])}:00 – {pad(selectedHours[selectedHours.length-1]+1)}:00
                  {"  "}({selectedHours.length} óra)
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Telefon naptár info */}
        {phoneEvents.length > 0 && selectedDay && (
          <View style={s.phoneCalInfo}>
            <Text style={s.phoneCalTitle}>📱 Telefon naptárból importálva:</Text>
            {phoneEvents
              .filter(e => {
                const evDate = new Date(e.startDate);
                return evDate.getFullYear() === year &&
                       evDate.getMonth() === month &&
                       evDate.getDate() === selectedDay;
              })
              .slice(0, 5)
              .map((e, i) => (
                <Text key={i} style={s.phoneCalEvent}>
                  🔴 {new Date(e.startDate).getHours()}:00 – {new Date(e.endDate).getHours()}:00  {e.title}
                </Text>
              ))
            }
          </View>
        )}
      </ScrollView>

      {/* Küldés gomb */}
      {selectedHours.length > 0 && (
        <TouchableOpacity style={s.sendBtn} onPress={handleSend}>
          <Text style={s.sendBtnText}>📨 Időpont kérés elküldése</Text>
        </TouchableOpacity>
      )}

      {/* Vissza */}
      <TouchableOpacity style={s.backBtn} onPress={onBack}>
        <Text style={s.backBtnText}>← Vissza</Text>
      </TouchableOpacity>
    </View>
  );
}

const CELL = (SW - 40) / 7;
const SLOT_SIZE = (SW - 48) / 6;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a0a0a", paddingTop: 52 },
  header: { paddingHorizontal: 20, marginBottom: 16 },
  title: { color: "#fff", fontSize: 24, fontWeight: "bold" },
  subtitle: { color: colors.accent, fontSize: 14, marginTop: 4 },

  // Naptár
  calendarBox: { marginHorizontal: 16, backgroundColor: "rgba(20,20,20,0.9)", borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#2a2a2a" },
  calNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  navBtn: { padding: 8, backgroundColor: "rgba(255,122,26,0.1)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,122,26,0.3)" },
  navBtnText: { color: colors.accent, fontSize: 20, fontWeight: "bold" },
  calTitle: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  dayHeaders: { flexDirection: "row", marginBottom: 6 },
  dayHeader: { width: CELL, textAlign: "center", color: "#666", fontSize: 12, fontWeight: "600" },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: CELL, height: CELL, alignItems: "center", justifyContent: "center" },
  dayCellToday: { backgroundColor: "rgba(255,122,26,0.15)", borderRadius: CELL/2 },
  dayCellSelected: { backgroundColor: colors.accent, borderRadius: CELL/2 },
  dayCellPast: { opacity: 0.3 },
  dayCellText: { color: "#fff", fontSize: 14 },
  busyDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent, position: "absolute", bottom: 4 },

  // Slots
  slotsBox: { marginHorizontal: 16, backgroundColor: "rgba(20,20,20,0.9)", borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#2a2a2a" },
  slotsTitle: { color: "#fff", fontSize: 15, fontWeight: "700", marginBottom: 6 },
  slotsLegend: { color: "#666", fontSize: 11, marginBottom: 12 },
  slotsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slot: { width: SLOT_SIZE, height: SLOT_SIZE, borderRadius: 12, backgroundColor: "#1a3a1a", borderWidth: 1, borderColor: "#2ecc71", alignItems: "center", justifyContent: "center" },
  slotBusy: { backgroundColor: "#2a1a1a", borderColor: "#c0392b" },
  slotSelected: { backgroundColor: "#ff7a1a", borderColor: "#ff7a1a" },
  slotText: { color: "#2ecc71", fontSize: 13, fontWeight: "700" },
  slotTextBusy: { color: "#c0392b" },
  slotTextSelected: { color: "#fff" },
  selectionInfo: { marginTop: 12, backgroundColor: "rgba(255,122,26,0.1)", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "rgba(255,122,26,0.3)" },
  selectionText: { color: colors.accent, fontSize: 14, fontWeight: "600", textAlign: "center" },

  // Telefon naptár
  phoneCalInfo: { marginHorizontal: 16, backgroundColor: "rgba(192,57,43,0.08)", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "rgba(192,57,43,0.2)", marginBottom: 12 },
  phoneCalTitle: { color: "#e74c3c", fontSize: 12, fontWeight: "700", marginBottom: 6 },
  phoneCalEvent: { color: "#aaa", fontSize: 12, marginBottom: 3 },

  // Gombok
  sendBtn: { position: "absolute", bottom: 84, left: 16, right: 16, backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  sendBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  backBtn: { position: "absolute", bottom: 120, left: 20, backgroundColor: "rgba(255,122,26,0.15)", borderWidth: 1, borderColor: "#ff7a1a", borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 },
  backBtnText: { color: "#ff7a1a", fontSize: 15, fontWeight: "600" },
});
