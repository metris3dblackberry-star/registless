// ─────────────────────────────────────────────────────────────────
// BuyerDashboard.js v2 — Global search
// ─────────────────────────────────────────────────────────────────
import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from "react-native";
import { colors } from "../theme/colors";
import { shared } from "../theme/styles";
import { searchContacts } from "../models/Contact";

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
    acc + (c.calendar||[]).filter((a) => a.statusz === "elfogadva").length, 0);
  const totalInvoices = contacts.reduce((acc, c) => acc + (c.invoices||[]).length, 0);

  const filteredContacts = searchQuery.trim()
    ? searchContacts(contacts, searchQuery)
    : contacts;

  return (
    <View style={s.root}>
      <ScrollView
        style={{ width: "100%" }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 48, paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.headerRow}>
          <View>
            <Text style={s.greeting}>{buyerName ? `Szia, ${buyerName.split(" ")[0]}! 👋` : "VEVŐ 👋"}</Text>
            <Text style={s.subGreeting}>Vevő mód</Text>
          </View>
          <TouchableOpacity style={{ padding: 8 }} onPress={() => onSettings(null)}>
            <Text style={{ fontSize: 24 }}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* 4 fő gomb */}
        <View style={s.mainGrid}>
          <TouchableOpacity style={s.mainBtn} onPress={() => onPartner(null)}>
            <Text style={s.mainBtnIcon}>🏪</Text>
            <Text style={s.mainBtnText}>Kapcsolataim</Text>
            {contacts.length > 0 && <Text style={s.mainBtnSub}>{contacts.length} eladó</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={s.mainBtn} onPress={onAppointments}>
            <Text style={s.mainBtnIcon}>📅</Text>
            <Text style={s.mainBtnText}>Időpontjaim</Text>
            {upcomingAppts > 0 && <Text style={s.mainBtnSub}>{upcomingAppts} közelgő</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={s.mainBtn} onPress={onInvoices}>
            <Text style={s.mainBtnIcon}>📄</Text>
            <Text style={s.mainBtnText}>Számláim</Text>
            {totalInvoices > 0 && <Text style={s.mainBtnSub}>{totalInvoices} db</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={s.mainBtn} onPress={onMessages}>
            <Text style={s.mainBtnIcon}>💬</Text>
            <Text style={s.mainBtnText}>Üzenetek</Text>
          </TouchableOpacity>
        </View>

        {/* Global search */}
        <View style={s.searchWrap}>
          <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
          <TextInput
            style={s.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Eladó keresése..."
            placeholderTextColor={colors.placeholder}
            returnKeyType="search"
          />
          {!!searchQuery && (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={{ padding: 8 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Kapcsolat lista */}
        {filteredContacts.length === 0 && searchQuery ? (
          <View style={shared.card}>
            <Text style={shared.value}>Nincs találat: „{searchQuery}"</Text>
          </View>
        ) : (
          filteredContacts.map((c) => (
            <TouchableOpacity key={c.id} style={s.partnerRow} onPress={() => onPartner(c)}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{(c.name||"?")[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.partnerName}>{c.name}</Text>
                {!!c.company && <Text style={s.partnerCompany}>{c.company}</Text>}
              </View>
              {c.channels?.chat && <Text style={{ fontSize: 14, marginRight: 8 }}>💬</Text>}
              <Text style={{ color: colors.textSecondary, fontSize: 18 }}>›</Text>
            </TouchableOpacity>
          ))
        )}

        {/* Utility */}
        <Text style={[shared.labelSmall, { marginTop: 24, marginBottom: 8 }]}>Eszközök</Text>
        <View style={s.utilRow}>
          {[
            { icon: "📱", label: "QR profil", action: () => onSettings("QR profil") },
            { icon: "🔍", label: "OCR", action: () => onSettings("ocr") },
            { icon: "📷", label: "QR scan", action: onNewPartner },
            { icon: "⚙️", label: "Beállítások", action: () => onSettings(null) },
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

      <TouchableOpacity style={s.fab} onPress={onNewPartner}>
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, width: "100%" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  greeting: { color: colors.textPrimary, fontSize: 24, fontWeight: "bold" },
  subGreeting: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  mainGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  mainBtn: { width: "47%", backgroundColor: colors.bgCard, borderRadius: 20, padding: 20, alignItems: "center", borderWidth: 1, borderColor: colors.borderSubtle, minHeight: 100, justifyContent: "center" },
  mainBtnIcon: { fontSize: 28, marginBottom: 8 },
  mainBtnText: { color: colors.textPrimary, fontSize: 15, fontWeight: "bold", textAlign: "center" },
  mainBtnSub: { color: colors.textSecondary, fontSize: 11, marginTop: 4 },
  searchWrap: { flexDirection: "row", alignItems: "center", backgroundColor: colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: colors.borderSubtle, paddingHorizontal: 12, marginBottom: 12 },
  searchInput: { flex: 1, color: colors.textPrimary, paddingVertical: 14, fontSize: 14 },
  partnerRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.bgCard, borderRadius: 16, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.borderSubtle },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(100,100,255,0.15)", borderWidth: 1, borderColor: "rgba(100,100,255,0.3)", justifyContent: "center", alignItems: "center", marginRight: 12 },
  avatarText: { color: "#aaaaff", fontSize: 18, fontWeight: "bold" },
  partnerName: { color: colors.textPrimary, fontSize: 16, fontWeight: "600" },
  partnerCompany: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  utilRow: { flexDirection: "row", gap: 8 },
  utilBtn: { flex: 1, backgroundColor: colors.bgCard, borderRadius: 14, padding: 12, alignItems: "center", borderWidth: 1, borderColor: colors.borderSubtle },
  utilLabel: { color: colors.textSecondary, fontSize: 11 },
  fab: { position: "absolute", right: 20, bottom: 30, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent, justifyContent: "center", alignItems: "center", shadowColor: colors.accent, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 },
  fabText: { color: "#fff", fontSize: 28, fontWeight: "bold", lineHeight: 32 },
});
