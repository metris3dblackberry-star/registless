// ─────────────────────────────────────────────────────────────────
// NfcScreen.js — NFC partner csere képernyő
// Regisztrált: src/screens/NfcScreen.js
// Registless 2026-03-22
//
// Telepítés (ha még nincs):
//   npx expo install react-native-nfc-manager
// app.json-ba:
//   "plugins": ["react-native-nfc-manager"]
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, SafeAreaView, Animated,
} from "react-native";
import { colors } from "../theme/colors";
import { shared } from "../theme/styles";
import {
  initNfc, isNfcAvailable, readNfcTag, cancelNfc,
} from "../services/nfcService";

export default function NfcScreen({
  myProfile,   // { uid, name, company, phone, email, address }
  role = "seller",
  onPartnerScanned, // (partnerData) => void
  onBack,
}) {
  const [status, setStatus]   = useState("idle");
  // idle | checking | waiting | reading | success | error | unavailable
  const [message, setMessage] = useState("");
  const [partner, setPartner] = useState(null);
  const pulseAnim = new Animated.Value(1);

  // ── Pulzáló animáció ─────────────────────────────────────────
  useEffect(() => {
    if (status === "waiting") {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [status]);

  // ── NFC ellenőrzés indításkor ────────────────────────────────
  useEffect(() => {
    checkAndStart();
    return () => cancelNfc();
  }, []);

  async function checkAndStart() {
    setStatus("checking");
    setMessage("NFC ellenőrzése...");
    try {
      const available = await initNfc();
      if (!available) {
        setStatus("unavailable");
        setMessage("NFC nem elérhető vagy ki van kapcsolva.\nKapcsold be a Beállítások → NFC menüben.");
        return;
      }
      startReading();
    } catch (e) {
      setStatus("error");
      setMessage(`NFC hiba: ${e.message}`);
    }
  }

  async function startReading() {
    setStatus("waiting");
    setMessage("Tartsd a telefont a partner NFC-jéhez...");
    setPartner(null);
    try {
      const data = await readNfcTag();
      setStatus("success");
      setPartner(data);
      setMessage(`✅ Partner beolvasva!`);
    } catch (e) {
      setStatus("error");
      setMessage(`Nem sikerült beolvasni.\n${e.message}`);
    }
  }

  function handleConfirm() {
    if (!partner) return;
    onPartnerScanned?.(partner);
  }

  // ── UI ────────────────────────────────────────────────────────
  const statusConfig = {
    idle:        { icon: "📡", color: "#888" },
    checking:    { icon: "🔍", color: "#888" },
    waiting:     { icon: "📡", color: "#00BCD4" },
    reading:     { icon: "⚡", color: "#FF9800" },
    success:     { icon: "✅", color: "#4CAF50" },
    error:       { icon: "❌", color: "#f44336" },
    unavailable: { icon: "📵", color: "#888" },
  };
  const cfg = statusConfig[status] || statusConfig.idle;

  return (
     <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}>
      <View style={st.container}>

        {/* Header */}
        <Text style={st.title}>NFC PARTNER CSERE</Text>
        <Text style={st.subtitle}>
          {role === "seller"
            ? "Tartsd a telefonod a partner eszközéhez"
            : "Olvasd be az eladó NFC chipjét"}
        </Text>

        {/* NFC ikon — pulzál ha vár */}
        <Animated.View style={[
          st.nfcCircle,
          { borderColor: cfg.color, transform: [{ scale: status === "waiting" ? pulseAnim : 1 }] }
        ]}>
          {status === "checking" || status === "reading"
            ? <ActivityIndicator size="large" color={cfg.color} />
            : <Text style={st.nfcIcon}>{cfg.icon}</Text>
          }
        </Animated.View>

        {/* Státusz üzenet */}
        <Text style={[st.statusMsg, { color: cfg.color }]}>{message}</Text>

        {/* Partner adatok — siker után */}
        {status === "success" && partner && (
          <View style={st.partnerCard}>
            <Text style={st.partnerTitle}>Beolvasott partner:</Text>
            {partner.name    && <Text style={st.partnerRow}>👤 {partner.name}</Text>}
            {partner.company && <Text style={st.partnerRow}>🏢 {partner.company}</Text>}
            {partner.phone   && <Text style={st.partnerRow}>📞 {partner.phone}</Text>}
            {partner.email   && <Text style={st.partnerRow}>✉️  {partner.email}</Text>}

            <TouchableOpacity
              style={[shared.btnPrimary, { marginTop: 16 }]}
              onPress={handleConfirm}
            >
              <Text style={shared.btnTextPrimary}>➕  Partner hozzáadása</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Gombok */}
        <View style={st.btnRow}>
          {(status === "error" || status === "success") && (
            <TouchableOpacity
              style={[shared.btnOutline, { flex: 1 }]}
              onPress={startReading}
            >
              <Text style={shared.btnTextSecondary}>🔄  Újra</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[shared.btnOutline, { flex: 1 }]}
            onPress={onBack}
          >
            <Text style={shared.btnTextSecondary}>VISSZA</Text>
          </TouchableOpacity>
        </View>

        {/* NFC ki van kapcsolva */}
        {status === "unavailable" && (
          <TouchableOpacity
            style={[shared.btnPrimary, { marginTop: 8 }]}
            onPress={() => {
              const { Linking } = require("react-native");
              Linking.openSettings();
            }}
          >
            <Text style={shared.btnTextPrimary}>⚙️  Beállítások megnyitása</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: {
    flex: 1, alignItems: "center", justifyContent: "center",
    padding: 32,
  },
  title: {
    color: "#fff", fontSize: 22, fontWeight: "bold",
    textAlign: "center", marginBottom: 8,
  },
  subtitle: {
    color: colors.textSecondary, fontSize: 14,
    textAlign: "center", marginBottom: 40,
  },
  nfcCircle: {
    width: 140, height: 140, borderRadius: 70,
    borderWidth: 3, borderColor: "#00BCD4",
    justifyContent: "center", alignItems: "center",
    backgroundColor: "rgba(0,188,212,0.08)",
    marginBottom: 32,
  },
  nfcIcon:   { fontSize: 56 },
  statusMsg: {
    fontSize: 15, textAlign: "center",
    marginBottom: 24, lineHeight: 22,
  },
  partnerCard: {
    width: "100%",
    backgroundColor: "rgba(45,45,45,0.92)",
    borderRadius: 20, padding: 20, marginBottom: 24,
    borderWidth: 1, borderColor: "rgba(76,175,80,0.4)",
  },
  partnerTitle: {
    color: "#4CAF50", fontSize: 13,
    fontWeight: "bold", marginBottom: 10,
  },
  partnerRow: {
    color: colors.textPrimary, fontSize: 14,
    marginBottom: 6,
  },
  btnRow: {
    btnRow: { flexDirection: "row", gap: 12, width: "100%", marginTop: 8, marginBottom: 25 },
  },
});
