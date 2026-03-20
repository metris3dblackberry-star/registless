// ─────────────────────────────────────────────────────────────────
// SellerDashboard.js v3 — Prioritás-rendezés + státusz indikátorok
// + Draft recovery banner
// ─────────────────────────────────────────────────────────────────
import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput,
} from "react-native";
import { colors } from "../theme/colors";
import { shared } from "../theme/styles";
import { formatCurrency } from "../services/invoice";
import { searchContacts } from "../models/Contact";
import { sortContactsByPriority, getContactStatuses, STATUS_CONFIG } from "../utils/contactPriority";

function getTodayStr() {
  const d = new Date();
  return `${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`;
}

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
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const today = getTodayStr();
  const todayAppts = contacts.reduce((acc, c) =>
    acc + (c.appointments||[]).filter((a) => a.datum === today).length, 0);
  const openItemsCount = contacts.reduce((acc, c) => acc + (c.openItems||[]).length, 0);
  const todayRevenue = contacts.reduce((acc, c) =>
    acc + (c.appointments||[]).filter((a) => a.datum === today)
      .reduce((s, a) => s + Number(a.amount||0), 0), 0);

  const sortedContacts = sortContactsByPriority(contacts);
  const displayContacts = searchQuery.trim()
    ? searchContacts(contacts, searchQuery)
    : sortedContacts;

  return (
    <View style={s.root}>
      <ScrollView
        style={{ width: "100%" }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 48, paddingBottom: 90 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.greeting}>
              {sellerName ? `Szia, ${sellerName.split(" ")[0]}! 👋` : "ELADÓ 👋"}
            </Text>
            <Text style={s.subGreeting}>
              {new Date().toLocaleDateString("hu-HU", { weekday: "long", month: "long", day: "numeric" })}
            </Text>
          </View>
          <TouchableOpacity style={{ padding: 8 }} onPress={() => onSettings(null)}>
            <Text style={{ fontSize: 24 }}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Draft recovery banner */}
        {drafts.length > 0 && (
          <TouchableOpacity style={s.draftBanner} onPress={() => onResumeDraft?.(drafts[0])}>
            <Text style={s.draftIcon}>⏸️</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.draftTitle}>Félbehagyott művelet</Text>
              <Text style={s.draftSub}>{drafts[0].summary || "Folytatás"}</Text>
            </View>
            <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "bold" }}>Folytat →</Text>
          </TouchableOpacity>
        )}

        {/* Stat kártyák */}
        <View style={s.statsRow}>
          {[
            { value: todayAppts, label: "Mai időpont", accent: todayAppts > 0 },
            { value: openItemsCount, label: "Nyitott tétel", accent: openItemsCount > 0 },
            { value: contacts.length, label: "Partner" },
            { value: formatCurrency(todayRevenue), label: "Mai bevétel", small: true, accent: todayRevenue > 0 },
          ].map((stat) => (
            <View key={stat.label} style={[s.statCard, stat.accent && s.statCardAccent]}>
              <Text style={[s.statValue, stat.accent && { color: colors.accent }, stat.small && { fontSize: 12 }]}>
                {stat.value}
              </Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* 4 fő gomb */}
        <View style={s.mainGrid}>
          {[
            { icon: "👥", label: "Partnerek", badge: contacts.length, onPress: () => onPartner(null) },
            { icon: "📅", label: "Mai nap", badge: todayAppts > 0 ? todayAppts : null, onPress: onTodaySchedule },
            { icon: "⚡", label: "Új szolgáltatás", accent: true, onPress: onNewService },
            { icon: "📄", label: "Számlák", onPress: onInvoices },
          ].map((btn) => (
            <TouchableOpacity
              key={btn.label}
              style={[s.mainBtn, btn.accent && s.mainBtnAccent]}
              onPress={btn.onPress}
            >
              <Text style={s.mainBtnIcon}>{btn.icon}</Text>
              <Text style={s.mainBtnText}>{btn.label}</Text>
              {btn.badge > 0 && <Text style={s.mainBtnBadge}>{btn.badge}</Text>}
            </TouchableOpacity>
          ))}
        </View>

        {/* Search */}
        <View style={s.searchWrap}>
          <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
          <TextInput
            style={s.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Partner keresése — név, cég, email..."
            placeholderTextColor={colors.placeholder}
          />
          {!!searchQuery && (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={{ padding: 8 }}>
              <Text style={{ color: colors.textSecondary }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Partner lista — prioritás-rendezve */}
        {displayContacts.length === 0 && searchQuery ? (
          <View style={shared.card}>
            <Text style={shared.value}>Nincs találat: „{searchQuery}"</Text>
          </View>
        ) : (
          displayContacts.slice(0, searchQuery ? 20 : 8).map((c) => {
            const statuses = getContactStatuses(c);
            const isToday = (c.appointments||[]).some((a) => a.datum === today);
            return (
              <TouchableOpacity
                key={c.id}
                style={[s.partnerRow, isToday && s.partnerRowToday]}
                onPress={() => onPartner(c)}
              >
                {/* Avatar */}
                <View style={[s.avatar, {
                  backgroundColor: isToday ? colors.accentSoft : c.channels?.chat ? "rgba(0,188,212,0.15)" : "rgba(80,80,80,0.3)",
                  borderColor: isToday ? colors.accentBorder : c.channels?.chat ? "#00BCD4" : "transparent",
                  borderWidth: isToday || c.channels?.chat ? 1 : 0,
                }]}>
                  <Text style={[s.avatarText, { color: isToday ? colors.accent : c.channels?.chat ? "#00BCD4" : colors.textSecondary }]}>
                    {(c.name || "?")[0].toUpperCase()}
                  </Text>
                </View>

                {/* Info */}
                <View style={{ flex: 1 }}>
                  <Text style={s.partnerName}>{c.name || "Partner"}</Text>
                  {!!c.company && <Text style={s.partnerCompany}>{c.company}</Text>}

                  {/* Státusz indikátorok */}
                  {statuses.length > 0 && (
                    <View style={s.statusRow}>
                      {statuses.map((st) => {
                        const cfg = STATUS_CONFIG[st.type];
                        return cfg ? (
                          <View key={st.type} style={[s.statusChip, { backgroundColor: cfg.color + "22", borderColor: cfg.color + "55" }]}>
                            <Text style={{ fontSize: 10 }}>{cfg.icon}</Text>
                            <Text style={[s.statusChipText, { color: cfg.color }]}>
                              {st.count > 1 ? `${st.count} ` : ""}{cfg.label}
                            </Text>
                          </View>
                        ) : null;
                      })}
                    </View>
                  )}
                </View>

                <Text style={{ color: colors.textSecondary, fontSize: 18, marginLeft: 8 }}>›</Text>
              </TouchableOpacity>
            );
          })
        )}

        {!searchQuery && contacts.length > 8 && (
          <TouchableOpacity onPress={() => onPartner(null)} style={{ marginTop: 8 }}>
            <Text style={[shared.labelSmall, { textAlign: "center" }]}>
              + {contacts.length - 8} további partner
            </Text>
          </TouchableOpacity>
        )}

        {/* Utility */}
        <Text style={[shared.labelSmall, { marginTop: 24, marginBottom: 8 }]}>Eszközök</Text>
        <View style={s.utilRow}>
          {[
            { icon: "🔍", label: "OCR", action: () => onSettings("ocr") },
            { icon: "📱", label: "QR profil", action: () => onSettings("QR profil") },
            { icon: "💳", label: "Fizetés", action: () => onSettings("Fizetési beállítások") },
            { icon: "🏢", label: "Cégadatok", action: () => onSettings("Céges adatok") },
          ].map((item) => (
            <TouchableOpacity key={item.label} style={s.utilBtn} onPress={item.action}>
              <Text style={{ fontSize: 20, marginBottom: 4 }}>{item.icon}</Text>
              <Text style={s.utilLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={[shared.btnOutline, { marginTop: 24 }]} onPress={onHome}>
          <Text style={shared.btnTextSecondary}>HOME</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, width: "100%" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  greeting: { color: colors.textPrimary, fontSize: 24, fontWeight: "bold" },
  subGreeting: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  draftBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(255,152,0,0.12)",
    borderRadius: 16, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: "rgba(255,152,0,0.3)",
  },
  draftIcon: { fontSize: 24 },
  draftTitle: { color: "#FF9800", fontSize: 13, fontWeight: "bold" },
  draftSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: colors.bgCard, borderRadius: 16, padding: 12, alignItems: "center", borderWidth: 1, borderColor: colors.borderSubtle },
  statCardAccent: { borderColor: "rgba(255,122,26,0.3)", backgroundColor: "rgba(255,122,26,0.08)" },
  statValue: { color: colors.textPrimary, fontSize: 18, fontWeight: "bold" },
  statLabel: { color: colors.textSecondary, fontSize: 10, marginTop: 4, textAlign: "center" },
  mainGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  mainBtn: { width: "47%", backgroundColor: colors.bgCard, borderRadius: 20, padding: 20, alignItems: "center", borderWidth: 1, borderColor: colors.borderSubtle, minHeight: 100, justifyContent: "center" },
  mainBtnAccent: { borderColor: colors.accentBorder, backgroundColor: colors.accentSoft },
  mainBtnIcon: { fontSize: 28, marginBottom: 8 },
  mainBtnText: { color: colors.textPrimary, fontSize: 15, fontWeight: "bold", textAlign: "center" },
  mainBtnBadge: { color: colors.accent, fontSize: 12, marginTop: 4, fontWeight: "bold" },
  searchWrap: { flexDirection: "row", alignItems: "center", backgroundColor: colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: colors.borderSubtle, paddingHorizontal: 12, marginBottom: 12 },
  searchInput: { flex: 1, color: colors.textPrimary, paddingVertical: 14, fontSize: 14 },
  partnerRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.bgCard, borderRadius: 16, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.borderSubtle },
  partnerRowToday: { borderColor: "rgba(255,122,26,0.4)", backgroundColor: "rgba(255,122,26,0.06)" },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", marginRight: 12 },
  avatarText: { fontSize: 18, fontWeight: "bold" },
  partnerName: { color: colors.textPrimary, fontSize: 16, fontWeight: "600" },
  partnerCompany: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  statusChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  statusChipText: { fontSize: 10, fontWeight: "600" },
  utilRow: { flexDirection: "row", gap: 8 },
  utilBtn: { flex: 1, backgroundColor: colors.bgCard, borderRadius: 14, padding: 12, alignItems: "center", borderWidth: 1, borderColor: colors.borderSubtle },
  utilLabel: { color: colors.textSecondary, fontSize: 11 },
});
