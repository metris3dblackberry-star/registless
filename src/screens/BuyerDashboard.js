// ─────────────────────────────────────────────────────────────────
// BuyerDashboard.js — Redesign v3
// Bottom nav + glassmorphism + lerövidített flow
// ─────────────────────────────────────────────────────────────────
import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from "react-native";
import { colors } from "../theme/colors";
import { searchContacts } from "../models/Contact";

const glass = {
  bg:           "rgba(255,255,255,0.07)",
  border:       "rgba(255,255,255,0.11)",
  bgAccent:     "rgba(229,90,30,0.15)",
  borderAccent: "rgba(229,90,30,0.35)",
};

// ── Bottom Nav ────────────────────────────────────────────────
function BottomNav({ onHome, onPartners, onScan, onAppointments, onInvoices }) {
  const tabs = [
    { id: "home",    icon: "⊞",  label: "Főoldal",   onPress: onHome },
    { id: "sellers", icon: "🏪", label: "Eladók",     onPress: onPartners },
    { id: "fab",     icon: "+",  label: "",           onPress: onScan, isFab: true },
    { id: "appts",   icon: "📅", label: "Időpontok",  onPress: onAppointments },
    { id: "invoice", icon: "📄", label: "Számlák",    onPress: onInvoices },
  ];
  return (
    <View style={bn.wrap}>
      {tabs.map(tab => tab.isFab ? (
        <TouchableOpacity key="fab" style={bn.fab} onPress={tab.onPress} activeOpacity={0.85}>
          <Text style={bn.fabIcon}>+</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity key={tab.id} style={bn.tab} onPress={tab.onPress} activeOpacity={0.7}>
          <Text style={bn.tabIcon}>{tab.icon}</Text>
          <Text style={bn.tabLabel}>{tab.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const bn = StyleSheet.create({
  wrap: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    height: 72, flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(12,12,12,0.96)",
    borderTopWidth: 0.5, borderTopColor: "rgba(255,255,255,0.08)",
    paddingBottom: 8,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 8 },
  tabIcon: { fontSize: 18, color: "#555" },
  tabLabel: { fontSize: 9, color: "#555", marginTop: 3 },
  fab: {
    width: 52, height: 52, borderRadius: 18,
    backgroundColor: "#e55a1e",
    alignItems: "center", justifyContent: "center",
    marginBottom: 10,
    shadowColor: "#e55a1e", shadowOpacity: 0.5, shadowRadius: 12, elevation: 10,
  },
  fabIcon: { color: "#fff", fontSize: 28, fontWeight: "300", lineHeight: 32, marginTop: -2 },
});

export default function BuyerDashboard({
  contacts = [],
  buyerName = "",
  onPartner,
  onNewPartner,
  onAppointments,
  onInvoices,
  onMessages,
  onSettings,
  onHome,
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const upcomingAppts = contacts.reduce((acc, c) =>
    acc + (c.calendar||[]).filter(a => a.statusz === "elfogadva").length, 0);
  const totalInvoices = contacts.reduce((acc, c) => acc + (c.invoices||[]).length, 0);
  const filteredContacts = searchQuery.trim() ? searchContacts(contacts, searchQuery) : contacts;
  const firstName = buyerName ? buyerName.split(" ").slice(-1)[0] : "Vevő";

  return (
    <View style={s.root}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 52, paddingBottom: 90 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ──────────────────────────────────────── */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.greeting}>Szia, {firstName}! 👋</Text>
            <Text style={s.subGreeting}>Vevő mód</Text>
          </View>
          <TouchableOpacity style={s.settingsBtn} onPress={() => onSettings(null)}>
            <Text style={{ fontSize: 18 }}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* ── Stat row ─────────────────────────────────────── */}
        <View style={s.statsRow}>
          <View style={[s.statCard, contacts.length > 0 && s.statCardAccent]}>
            <Text style={[s.statValue, contacts.length > 0 && { color: "#e55a1e" }]}>{contacts.length}</Text>
            <Text style={s.statLabel}>Eladóm</Text>
          </View>
          <View style={[s.statCard, upcomingAppts > 0 && s.statCardAccent]}>
            <Text style={[s.statValue, upcomingAppts > 0 && { color: "#e55a1e" }]}>{upcomingAppts}</Text>
            <Text style={s.statLabel}>Közelgő</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statValue}>{totalInvoices}</Text>
            <Text style={s.statLabel}>Számla</Text>
          </View>
        </View>

        {/* ── Quick actions ─────────────────────────────────── */}
        <View style={s.quickRow}>
          <TouchableOpacity style={[s.quickBtn, s.quickBtnAccent]} onPress={onNewPartner}>
            <Text style={s.quickIcon}>📷</Text>
            <Text style={[s.quickLabel, { color: "#e55a1e" }]}>QR Scan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.quickBtn} onPress={onMessages}>
            <Text style={s.quickIcon}>💬</Text>
            <Text style={s.quickLabel}>Üzenetek</Text>
          </TouchableOpacity>
        </View>

        {/* ── Keresés ──────────────────────────────────────── */}
        <View style={s.searchWrap}>
          <Text style={{ fontSize: 15, marginRight: 8 }}>🔍</Text>
          <TextInput
            style={s.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Eladó keresése..."
            placeholderTextColor="#555"
          />
          {!!searchQuery && (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={{ padding: 8 }}>
              <Text style={{ color: "#666" }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Partner lista ────────────────────────────────── */}
        {filteredContacts.length === 0 && searchQuery ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>Nincs találat: „{searchQuery}"</Text>
          </View>
        ) : filteredContacts.map(c => (
          <TouchableOpacity key={c.id} style={s.partnerRow} onPress={() => onPartner(c)} activeOpacity={0.75}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{(c.name||"?")[0].toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.partnerName}>{c.name}</Text>
              {!!c.company && <Text style={s.partnerCompany}>{c.company}</Text>}
            </View>
            {c.channels?.chat && <Text style={{ fontSize: 14, marginRight: 8 }}>💬</Text>}
            <Text style={{ color: "#444", fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        ))}

        {/* ── Eszközök ─────────────────────────────────────── */}
        <Text style={s.sectionLabel}>Eszközök</Text>
        <View style={s.utilRow}>
          {[
            { icon: "📱", label: "QR profil",    action: () => onSettings("QR profil") },
            { icon: "🔍", label: "OCR",          action: () => onSettings("ocr") },
            { icon: "📷", label: "QR scan",      action: onNewPartner },
            { icon: "⚙️", label: "Beállítások",  action: () => onSettings(null) },
          ].map(item => (
            <TouchableOpacity key={item.label} style={s.utilBtn} onPress={item.action}>
              <Text style={{ fontSize: 18, marginBottom: 4 }}>{item.icon}</Text>
              <Text style={s.utilLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* ── Bottom Nav ───────────────────────────────────── */}
      <BottomNav
        onHome={onHome}
        onPartners={() => onPartner(null)}
        onScan={onNewPartner}
        onAppointments={onAppointments}
        onInvoices={onInvoices}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, width: "100%" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  greeting: { color: "#f0f0f0", fontSize: 22, fontWeight: "700" },
  subGreeting: { color: "#666", fontSize: 11, marginTop: 2 },
  settingsBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: glass.bg, borderWidth: 0.5, borderColor: glass.border, alignItems: "center", justifyContent: "center" },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  statCard: { flex: 1, backgroundColor: glass.bg, borderRadius: 14, padding: 12, alignItems: "center", borderWidth: 0.5, borderColor: glass.border },
  statCardAccent: { borderColor: glass.borderAccent, backgroundColor: glass.bgAccent },
  statValue: { color: "#f0f0f0", fontSize: 18, fontWeight: "700" },
  statLabel: { color: "#666", fontSize: 9, marginTop: 3, textAlign: "center" },
  quickRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  quickBtn: { flex: 1, backgroundColor: glass.bg, borderRadius: 16, borderWidth: 0.5, borderColor: glass.border, paddingVertical: 14, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 8 },
  quickBtnAccent: { backgroundColor: glass.bgAccent, borderColor: glass.borderAccent },
  quickIcon: { fontSize: 18 },
  quickLabel: { color: "#ccc", fontSize: 13, fontWeight: "600", flex: 1 },
  searchWrap: { flexDirection: "row", alignItems: "center", backgroundColor: glass.bg, borderRadius: 14, borderWidth: 0.5, borderColor: glass.border, paddingHorizontal: 12, marginBottom: 12 },
  searchInput: { flex: 1, color: "#e0e0e0", paddingVertical: 13, fontSize: 14 },
  emptyCard: { backgroundColor: glass.bg, borderRadius: 14, padding: 18, borderWidth: 0.5, borderColor: glass.border },
  emptyText: { color: "#888", fontSize: 13 },
  partnerRow: { flexDirection: "row", alignItems: "center", backgroundColor: glass.bg, borderRadius: 16, padding: 13, marginBottom: 7, borderWidth: 0.5, borderColor: glass.border },
  avatar: { width: 42, height: 42, borderRadius: 13, backgroundColor: "rgba(100,100,255,0.15)", borderWidth: 0.5, borderColor: "rgba(100,100,255,0.3)", justifyContent: "center", alignItems: "center", marginRight: 11 },
  avatarText: { color: "#aaaaff", fontSize: 17, fontWeight: "700" },
  partnerName: { color: "#f0f0f0", fontSize: 15, fontWeight: "600" },
  partnerCompany: { color: "#777", fontSize: 11, marginTop: 2 },
  sectionLabel: { color: "#555", fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase", marginTop: 20, marginBottom: 8 },
  utilRow: { flexDirection: "row", gap: 8 },
  utilBtn: { flex: 1, backgroundColor: glass.bg, borderRadius: 13, padding: 12, alignItems: "center", borderWidth: 0.5, borderColor: glass.border },
  utilLabel: { color: "#777", fontSize: 10 },
});
