// ─────────────────────────────────────────────────────────────────
// SellerDashboard.js — Redesign v4
// Bottom nav + glassmorphism + context FAB + lerövidített flow
// ─────────────────────────────────────────────────────────────────
import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, Animated,
} from "react-native";
import { colors } from "../theme/colors";
import { formatCurrency } from "../services/invoice";
import { searchContacts } from "../models/Contact";
import { sortContactsByPriority, getContactStatuses, STATUS_CONFIG } from "../utils/contactPriority";

// ── Solid dark grey csempék (a tan háttéren is olvashatóak) ───
const glass = {
  bg:     "rgba(45,45,45,0.92)",
  border: "rgba(255,255,255,0.10)",
  bgAccent: "rgba(229,90,30,0.22)",
  borderAccent: "rgba(229,90,30,0.50)",
};

function getTodayStr() {
  const d = new Date();
  return `${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`;
}

// ── Bottom Nav ────────────────────────────────────────────────
function BottomNav({ active, onHome, onPartners, onNewService, onCalendar, onFinance }) {
  const tabs = [
    { id: "home",     icon: "⊞",  label: "Főoldal",   onPress: onHome },
    { id: "partners", icon: "👥", label: "Partnerek", onPress: onPartners },
    { id: "fab",      icon: "+",  label: "",          onPress: onNewService, isFab: true },
    { id: "calendar", icon: "📅", label: "Naptár",    onPress: onCalendar },
    { id: "finance",  icon: "💰", label: "Pénzügyek", onPress: onFinance },
  ];
  return (
    <View style={bn.wrap}>
      {tabs.map(tab => tab.isFab ? (
        <TouchableOpacity key="fab" style={bn.fab} onPress={tab.onPress} activeOpacity={0.85}>
          <Text style={bn.fabIcon}>+</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity key={tab.id} style={bn.tab} onPress={tab.onPress} activeOpacity={0.7}>
          <Text style={[bn.tabIcon, active === tab.id && bn.tabIconActive]}>{tab.icon}</Text>
          <Text style={[bn.tabLabel, active === tab.id && bn.tabLabelActive]}>{tab.label}</Text>
          {active === tab.id && <View style={bn.dot} />}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const bn = StyleSheet.create({
  wrap: {
    position: "absolute", bottom: 35, left: 0, right: 0,
    height: 72,
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(12,12,12,0.96)",
    borderTopWidth: 0.5, borderTopColor: "rgba(255,255,255,0.08)",
    paddingBottom: 8,
    borderRadius: 24,
    marginHorizontal: 10,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 8 },
  tabIcon: { fontSize: 18, color: "#555" },
  tabIconActive: { color: "#e55a1e" },
  tabLabel: { fontSize: 9, color: "#555", marginTop: 3 },
  tabLabelActive: { color: "#e55a1e" },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#e55a1e", marginTop: 3 },
  fab: {
    width: 52, height: 52, borderRadius: 18,
    backgroundColor: "#e55a1e",
    alignItems: "center", justifyContent: "center",
    marginBottom: 10,
    shadowColor: "#e55a1e", shadowOpacity: 0.5, shadowRadius: 12, elevation: 10,
  },
  fabIcon: { color: "#fff", fontSize: 28, fontWeight: "300", lineHeight: 32, marginTop: -2 },
});

// ── Stat card ─────────────────────────────────────────────────
function StatCard({ value, label, accent, small }) {
  return (
    <View style={[s.statCard, accent && s.statCardAccent]}>
      <Text style={[s.statValue, accent && { color: "#e55a1e" }, small && { fontSize: 12 }]}>
        {value}
      </Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

// ── Main ─────────────────────────────────────────────────────
export default function SellerDashboard({
  contacts = [],
  sellerName = "",
  drafts = [],
  onPartner,
  onNewPartner,
  onTodaySchedule,
  onNewService,
  onInvoices,
  onSettings,
  onHome,
  onResumeDraft,
  onOcr,
  onQrProfile,
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const today = getTodayStr();
  const todayAppts    = contacts.reduce((acc, c) => acc + (c.appointments||[]).filter(a => a.datum === today).length, 0);
  const openItemsCount = contacts.reduce((acc, c) => acc + (c.openItems||[]).length, 0);
  const todayRevenue  = contacts.reduce((acc, c) =>
    acc + (c.appointments||[]).filter(a => a.datum === today).reduce((s, a) => s + Number(a.amount||0), 0), 0);

  const sortedContacts = sortContactsByPriority(contacts);
  const displayContacts = searchQuery.trim()
    ? searchContacts(contacts, searchQuery)
    : sortedContacts;

  const firstName = sellerName ? sellerName.split(" ").slice(-1)[0] : "Regist";

  return (
    <View style={s.root}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 52, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ──────────────────────────────────────── */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.greeting}>Szia, {firstName}! 👋</Text>
            <Text style={s.subGreeting}>
              {new Date().toLocaleDateString("hu-HU", { weekday: "long", month: "long", day: "numeric" })}
            </Text>
          </View>
          <TouchableOpacity style={s.settingsBtn} onPress={() => onSettings(null)}>
            <Text style={{ fontSize: 18 }}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* ── Draft banner ─────────────────────────────────── */}
        {drafts.length > 0 && (
          <TouchableOpacity style={s.draftBanner} onPress={() => onResumeDraft?.(drafts[0])}>
            <Text style={{ fontSize: 20 }}>⏸️</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.draftTitle}>Félbehagyott művelet</Text>
              <Text style={s.draftSub}>{drafts[0].summary || "Folytatás"}</Text>
            </View>
            <Text style={{ color: "#e55a1e", fontSize: 13, fontWeight: "bold" }}>Folytat →</Text>
          </TouchableOpacity>
        )}

        {/* ── Stat row ─────────────────────────────────────── */}
        <View style={s.statsRow}>
          <StatCard value={todayAppts}  label="Mai időpont" accent={todayAppts > 0} />
          <StatCard value={openItemsCount} label="Nyitott tétel" accent={openItemsCount > 0} />
          <StatCard value={contacts.length} label="Partner" />
          <StatCard value={formatCurrency(todayRevenue)} label="Mai bevétel" small accent={todayRevenue > 0} />
        </View>

        {/* ── Quick actions ─────────────────────────────────── */}
        <View style={s.quickRow}>
          <TouchableOpacity style={[s.quickBtn, s.quickBtnAccent]} onPress={onNewService}>
            <Text style={s.quickIcon}>⚡</Text>
            <Text style={[s.quickLabel, { color: "#e55a1e" }]}>Új szolgáltatás</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.quickBtn} onPress={onTodaySchedule}>
            <Text style={s.quickIcon}>📅</Text>
            <Text style={s.quickLabel}>
              Mai nap{todayAppts > 0 ? `  ·  ${todayAppts}` : ""}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Keresés ──────────────────────────────────────── */}
        <View style={s.searchWrap}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            style={s.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Partner keresése — név, cég, email..."
            placeholderTextColor="#555"
          />
          {!!searchQuery && (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={{ padding: 8 }}>
              <Text style={{ color: "#666" }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Partner lista ────────────────────────────────── */}
        {displayContacts.length === 0 && searchQuery ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>Nincs találat: „{searchQuery}"</Text>
          </View>
        ) : (
          displayContacts.slice(0, searchQuery ? 20 : 8).map(c => {
            const statuses = getContactStatuses(c);
            const isToday  = (c.appointments||[]).some(a => a.datum === today);
            return (
              <TouchableOpacity
                key={c.id}
                style={[s.partnerRow, isToday && s.partnerRowToday]}
                onPress={() => onPartner(c)}
                activeOpacity={0.75}
              >
                <View style={[s.avatar, {
                  backgroundColor: isToday ? glass.bgAccent : "rgba(60,60,60,0.85)",
                  borderColor: isToday ? glass.borderAccent : "rgba(255,255,255,0.12)",
                }]}>
                  <Text style={[s.avatarText, { color: isToday ? "#e55a1e" : "#bbb" }]}>
                    {(c.name || "?")[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.partnerName}>{c.name || "Partner"}</Text>
                  {!!c.company && <Text style={s.partnerCompany}>{c.company}</Text>}
                  {statuses.length > 0 && (
                    <View style={s.statusRow}>
                      {statuses.map(st => {
                        const cfg = STATUS_CONFIG[st.type];
                        return cfg ? (
                          <View key={st.type} style={[s.chip, { backgroundColor: cfg.color + "22", borderColor: cfg.color + "55" }]}>
                            <Text style={{ fontSize: 9 }}>{cfg.icon}</Text>
                            <Text style={[s.chipText, { color: cfg.color }]}>
                              {st.count > 1 ? `${st.count} ` : ""}{cfg.label}
                            </Text>
                          </View>
                        ) : null;
                      })}
                    </View>
                  )}
                </View>
                <Text style={{ color: "#444", fontSize: 18 }}>›</Text>
              </TouchableOpacity>
            );
          })
        )}

        {!searchQuery && contacts.length > 8 && (
          <TouchableOpacity onPress={() => onPartner(null)} style={{ marginTop: 6, marginBottom: 4 }}>
            <Text style={{ color: "#555", fontSize: 12, textAlign: "center" }}>
              + {contacts.length - 8} további partner
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Eszközök ─────────────────────────────────────── */}
        <Text style={s.sectionLabel}>Eszközök</Text>
        <View style={s.utilRow}>
          {[
            { icon: "🔍", label: "OCR",       action: onOcr },
            { icon: "📱", label: "QR profil", action: onQrProfile },
            { icon: "📷", label: "QR Scan",   action: onNewPartner },
            { icon: "🏢", label: "Cégadatok", action: () => onSettings("Céges adatok") },
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
        active="home"
        onHome={onHome}
        onPartners={() => onPartner(null)}
        onNewService={onNewService}
        onCalendar={onTodaySchedule}
        onFinance={onInvoices}
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

  draftBanner: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(255,152,0,0.1)", borderRadius: 14, padding: 12, marginBottom: 14, borderWidth: 0.5, borderColor: "rgba(255,152,0,0.3)" },
  draftTitle: { color: "#FF9800", fontSize: 13, fontWeight: "700" },
  draftSub: { color: "#777", fontSize: 11, marginTop: 2 },

  statsRow: { flexDirection: "row", gap: 7, marginBottom: 14 },
  statCard: { flex: 1, backgroundColor: glass.bg, borderRadius: 14, padding: 11, alignItems: "center", borderWidth: 0.5, borderColor: glass.border },
  statCardAccent: { borderColor: glass.borderAccent, backgroundColor: glass.bgAccent },
  statValue: { color: "#fff", fontSize: 17, fontWeight: "700" },
  statLabel: { color: "#bbb", fontSize: 9, marginTop: 3, textAlign: "center" },

  quickRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  quickBtn: { flex: 1, backgroundColor: glass.bg, borderRadius: 16, borderWidth: 0.5, borderColor: glass.border, paddingVertical: 14, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 8 },
  quickBtnAccent: { backgroundColor: glass.bgAccent, borderColor: glass.borderAccent },
  quickIcon: { fontSize: 18 },
  quickLabel: { color: "#fff", fontSize: 13, fontWeight: "600", flex: 1 },

  searchWrap: { flexDirection: "row", alignItems: "center", backgroundColor: glass.bg, borderRadius: 14, borderWidth: 0.5, borderColor: glass.border, paddingHorizontal: 12, marginBottom: 12 },
  searchIcon: { fontSize: 15, marginRight: 8 },
  searchInput: { flex: 1, color: "#fff", paddingVertical: 13, fontSize: 14 },

  emptyCard: { backgroundColor: glass.bg, borderRadius: 14, padding: 18, borderWidth: 0.5, borderColor: glass.border, marginBottom: 8 },
  emptyText: { color: "#bbb", fontSize: 13 },

  partnerRow: { flexDirection: "row", alignItems: "center", backgroundColor: glass.bg, borderRadius: 16, padding: 13, marginBottom: 7, borderWidth: 0.5, borderColor: glass.border },
  partnerRowToday: { borderColor: glass.borderAccent, backgroundColor: glass.bgAccent },
  avatar: { width: 42, height: 42, borderRadius: 13, justifyContent: "center", alignItems: "center", marginRight: 11, borderWidth: 0.5 },
  avatarText: { fontSize: 17, fontWeight: "700" },
  partnerName: { color: "#fff", fontSize: 15, fontWeight: "600" },
  partnerCompany: { color: "#bbb", fontSize: 11, marginTop: 2 },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 5 },
  chip: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, borderWidth: 0.5 },
  chipText: { fontSize: 9, fontWeight: "600" },

  sectionLabel: { color: "#555", fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase", marginTop: 20, marginBottom: 8 },
  utilRow: { flexDirection: "row", gap: 8 },
  utilBtn: { flex: 1, backgroundColor: glass.bg, borderRadius: 13, padding: 12, alignItems: "center", borderWidth: 0.5, borderColor: glass.border },
  utilLabel: { color: "#ddd", fontSize: 10 },
});
