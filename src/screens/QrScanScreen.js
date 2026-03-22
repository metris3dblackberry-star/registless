// ─────────────────────────────────────────────────────────────────
// QrScanScreen.js — QR kód beolvasó képernyő
// Expo Camera v14 (SDK 54) — CameraView + onBarcodeScanned
// Registless 2026-03-22
// ─────────────────────────────────────────────────────────────────
import React, { useState, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, SafeAreaView,
} from "react-native";
import { CameraView } from "expo-camera";
import { colors } from "../theme/colors";
import { shared } from "../theme/styles";

export default function QrScanScreen({
  permission,
  requestPermission,
  role = "seller",
  onScanned,
  onBack,
}) {
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  // ── Engedély kérés ────────────────────────────────────────────
  if (!permission?.granted) {
    return (
      <SafeAreaView style={st.center}>
        <Text style={st.title}>📷  Kamera engedély szükséges</Text>
        <Text style={st.sub}>QR kód beolvasáshoz engedélyezd a kamera hozzáférést.</Text>
        <TouchableOpacity style={[shared.btnPrimary, { marginTop: 24 }]} onPress={requestPermission}>
          <Text style={shared.btnTextPrimary}>Engedély megadása</Text>
        </TouchableOpacity>
        <TouchableOpacity style={shared.btnOutline} onPress={onBack}>
          <Text style={shared.btnTextSecondary}>VISSZA</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── QR beolvasás kezelése ─────────────────────────────────────
  async function handleBarCodeScanned({ type, data }) {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);

    try {
      // Próbáljuk JSON-ként parse-olni (Registless QR formátum)
      let parsed = null;
      try {
        parsed = JSON.parse(data);
      } catch {
        // Nem JSON → egyszerű szöveg / URL → névként kezeljük
        parsed = { name: data, uid: null };
      }

      onScanned?.(parsed);
    } catch (e) {
      Alert.alert("Hiba", "Nem sikerült feldolgozni a QR kódot.", [
        { text: "Újra", onPress: () => { setScanned(false); setLoading(false); } },
        { text: "Vissza", onPress: onBack },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // ── Camera nézet ──────────────────────────────────────────────
  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={st.header}>
        <Text style={st.headerTitle}>
          {role === "seller" ? "📱  Új partner beolvasása" : "📷  Eladó QR scan"}
        </Text>
        <Text style={st.headerSub}>Irányítsd a kamerát a partner QR kódjára</Text>
      </View>

      {/* Kamera */}
      <View style={{ flex: 1 }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        />

        {/* Célkeret overlay */}
        <View pointerEvents="none" style={st.overlay}>
          {/* Sötétítés - felső */}
          <View style={st.overlayTop} />
          <View style={{ flexDirection: "row" }}>
            {/* Sötétítés - bal */}
            <View style={st.overlaySide} />
            {/* Átlátszó keret */}
            <View style={st.scanFrame}>
              {/* Sarok díszítők */}
              <View style={[st.corner, st.cornerTL]} />
              <View style={[st.corner, st.cornerTR]} />
              <View style={[st.corner, st.cornerBL]} />
              <View style={[st.corner, st.cornerBR]} />
              {/* Scan vonal animáció helyett egyszerű jelző */}
              {!scanned && <View style={st.scanLine} />}
            </View>
            {/* Sötétítés - jobb */}
            <View style={st.overlaySide} />
          </View>
          {/* Sötétítés - alsó */}
          <View style={st.overlayBottom} />
        </View>

        {/* Loading overlay */}
        {loading && (
          <View style={st.loadingOverlay}>
            <ActivityIndicator size="large" color="#ff7a1a" />
            <Text style={st.loadingText}>Feldolgozás...</Text>
          </View>
        )}
      </View>

      {/* Footer */}
      <View style={st.footer}>
        {scanned && !loading ? (
          <TouchableOpacity
            style={shared.btnPrimary}
            onPress={() => setScanned(false)}
          >
            <Text style={shared.btnTextPrimary}>🔄  Újra beolvasás</Text>
          </TouchableOpacity>
        ) : (
          <Text style={st.hint}>
            A QR kód automatikusan felismeri a Registless partnert
          </Text>
        )}
        <TouchableOpacity style={shared.btnOutline} onPress={onBack}>
          <Text style={shared.btnTextSecondary}>VISSZA</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const FRAME_SIZE = 240;

const st = StyleSheet.create({
  center: {
    flex: 1, justifyContent: "center", alignItems: "center", padding: 32,
  },
  title: { color: "#fff", fontSize: 20, fontWeight: "bold", textAlign: "center", marginBottom: 8 },
  sub:   { color: colors.textSecondary, fontSize: 14, textAlign: "center" },

  header: {
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center",
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  headerSub:   { color: colors.textSecondary, fontSize: 13, marginTop: 4 },

  footer: { padding: 20, backgroundColor: "rgba(0,0,0,0.5)" },
  hint:   { color: colors.textSecondary, fontSize: 13, textAlign: "center", marginBottom: 12 },

  // Overlay rétegek
  overlay: { ...StyleSheet.absoluteFillObject },
  overlayTop:    { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  overlayBottom: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  overlaySide:   { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },

  // Scan keret
  scanFrame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    position: "relative",
  },

  // Sarok díszítők
  corner: {
    position: "absolute",
    width: 32, height: 32,
    borderColor: "#ff7a1a",
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 4 },

  // Scan vonal
  scanLine: {
    position: "absolute",
    top: "50%",
    left: 8, right: 8,
    height: 2,
    backgroundColor: "rgba(255,122,26,0.8)",
    borderRadius: 1,
  },

  // Loading
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center", alignItems: "center",
  },
  loadingText: { color: "#fff", marginTop: 12, fontSize: 16 },
});
