// ─────────────────────────────────────────────────────────────────
// OcrScreen.js — OCR képernyő
// 3 use case: saját profil / új partner / számla elemzés
// ─────────────────────────────────────────────────────────────────
import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet, Alert,
} from "react-native";
import { CameraView } from "expo-camera";
import { colors } from "../theme/colors";
import { shared } from "../theme/styles";
import { useOcr } from "../hooks/useOcr";

const USE_CASES = [
  { id: "profile", label: "Saját profil kitöltése", icon: "👤", desc: "Töltsd ki a profilod névjegyből vagy dokumentumból" },
  { id: "partner", label: "Új partner névjegyből", icon: "🏪", desc: "Adj hozzá új partnert fotóból vagy beillesztett szövegből" },
  { id: "invoice", label: "Számla / dokumentum", icon: "📄", desc: "Elemezz számlát vagy céges dokumentumot" },
];

export default function OcrScreen({
  permission,
  requestPermission,
  defaultUseCase = "partner",
  onApplyProfile,   // (parsed) => void — saját profil
  onApplyPartner,   // (parsed) => void — új partner
  onApplyInvoice,   // (parsed) => void — számla
  onBack,
}) {
  const [useCase, setUseCase] = useState(defaultUseCase);
  const [mode, setMode] = useState("text"); // "text" | "camera"
  const [parsed, setParsed] = useState(null);
  const cameraRef = useRef(null);
  const {
    rawText, setRawText, isProcessing,
    fromGallery, fromCameraPhoto,
    parseForProfile, parseForPartner, parseForInvoice,
  } = useOcr();

  async function handleAnalyze() {
    if (!rawText.trim()) {
      Alert.alert("OCR", "Nincs szöveg az elemzéshez.");
      return;
    }
    try {
      let result;
      if (useCase === "profile") result = await parseForProfile(rawText);
      else if (useCase === "partner") result = await parseForPartner(rawText);
      else result = await parseForInvoice(rawText);
      setParsed(result);
    } catch (e) {
      Alert.alert("Elemzési hiba", e.message);
    }
  }

  async function handleGallery() {
    const text = await fromGallery();
    if (text) setParsed(null);
  }

  async function handleCamera() {
    if (!permission?.granted) {
      await requestPermission();
      return;
    }
    setMode("camera");
  }

  async function handleTakePhoto() {
    try {
      const cam = cameraRef.current;
      if (!cam) return;
      const photo = await cam.takePictureAsync({ quality: 0.8, shutterSound: false });
      setMode("text");
      await fromCameraPhoto(photo.uri);
      setParsed(null);
    } catch (e) {
      Alert.alert("Fotó hiba", e.message);
      setMode("text");
    }
  }

  function handleApply() {
    if (!parsed) return;
    if (useCase === "profile") onApplyProfile?.(parsed);
    else if (useCase === "partner") onApplyPartner?.(parsed);
    else onApplyInvoice?.(parsed);
  }

  // ── Camera nézet ──────────────────────────────────────────────
  if (mode === "camera") {
    return (
      <View style={{ flex: 1 }}>
        <View style={ocr.scanHeader}>
          <Text style={ocr.scanTitle}>📷  Fényképezd le a dokumentumot</Text>
        </View>
        <View style={{ flex: 1, position: "relative" }}>
          <CameraView style={{ flex: 1 }} ref={cameraRef} />
          {/* Célkereszt */}
          <View pointerEvents="none" style={ocr.crosshairOverlay}>
            <View style={ocr.crosshairH} />
            <View style={ocr.crosshairV} />
            <View style={[ocr.crosshairDiag, { transform: [{ rotate: "34deg" }] }]} />
            <View style={[ocr.crosshairDiag, { transform: [{ rotate: "-34deg" }] }]} />
          </View>
        </View>
        <View style={ocr.scanFooter}>
          <TouchableOpacity style={shared.btnPrimary} onPress={handleTakePhoto}>
            <Text style={shared.btnTextPrimary}>📷  FOTÓ ÉS FELISMERÉS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={shared.btnOutline} onPress={() => setMode("text")}>
            <Text style={shared.btnTextSecondary}>VISSZA</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Fő OCR nézet ─────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={{ flex: 1 }}>
        <ScrollView
          style={shared.fullWidth}
          contentContainerStyle={[shared.formContent, { paddingHorizontal: 20, paddingTop: 20 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text style={shared.title}>OCR IMPORT</Text>

          {/* Use case választó */}
          {USE_CASES.map((uc) => (
            <TouchableOpacity
              key={uc.id}
              style={[ocr.useCaseBtn, useCase === uc.id && ocr.useCaseBtnActive]}
              onPress={() => { setUseCase(uc.id); setParsed(null); }}
            >
              <Text style={ocr.useCaseIcon}>{uc.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={ocr.useCaseLabel}>{uc.label}</Text>
                <Text style={ocr.useCaseDesc}>{uc.desc}</Text>
              </View>
              {useCase === uc.id && <Text style={{ color: colors.accent, fontSize: 18 }}>✓</Text>}
            </TouchableOpacity>
          ))}

          {/* Szöveg input */}
          <Text style={[shared.label, { marginTop: 16 }]}>
            Illeszd be a szöveget, vagy használj kamerát / galériát:
          </Text>
          <TextInput
            style={shared.textArea}
            multiline
            value={rawText}
            onChangeText={(t) => { setRawText(t); setParsed(null); }}
            placeholder="Illeszd be az OCR szöveget..."
            placeholderTextColor={colors.placeholder}
            textAlignVertical="top"
          />

          {/* Gombok */}
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
            <TouchableOpacity
              style={[shared.btnOutline, { flex: 1, marginTop: 0 }]}
              onPress={handleGallery}
            >
              <Text style={shared.btnTextSecondary}>🖼️  Galériából</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[shared.btnOutline, { flex: 1, marginTop: 0 }]}
              onPress={handleCamera}
            >
              <Text style={shared.btnTextSecondary}>📷  Kamerával</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[shared.btnPrimary, isProcessing && { opacity: 0.6 }]}
            onPress={handleAnalyze}
            disabled={isProcessing}
          >
            <Text style={shared.btnTextPrimary}>
              {isProcessing ? "⏳  Elemzés..." : "🤖  AI ELEMZÉS"}
            </Text>
          </TouchableOpacity>

          {/* Eredmény */}
          {parsed && (
            <View style={[shared.card, { marginTop: 16 }]}>
              <Text style={shared.sectionTitle}>FELISMERT ADATOK</Text>
              {Object.entries(parsed)
                .filter(([k, v]) => v && k !== "rawText" && k !== "amounts")
                .map(([key, val]) => (
                  <View key={key}>
                    <Text style={shared.labelSmall}>{key}</Text>
                    <Text style={shared.value}>{String(val)}</Text>
                  </View>
                ))}

                  {/* Direct partner creation — wow feature */}
              {useCase === "partner" && (
                <TouchableOpacity
                  style={[shared.btnPrimary, { marginTop: 12, backgroundColor: "rgba(255,122,26,0.25)", borderColor: "rgba(255,122,26,0.6)" }]}
                  onPress={() => {
                    onApplyPartner?.(parsed);
                  }}
                >
                  <Text style={[shared.btnTextPrimary, { color: "#ff7a1a" }]}>
                    ➕  Új partner létrehozása ezekből az adatokból
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={[shared.btnOutline, { marginTop: 10 }]} onPress={handleApply}>
                <Text style={shared.btnTextSecondary}>
                  {useCase === "profile" ? "✅  Profil frissítése" :
                   useCase === "invoice" ? "📄  Számla mentése" : "✅  Betöltés"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={shared.btnOutline} onPress={onBack}>
            <Text style={shared.btnTextSecondary}>VISSZA</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const ocr = StyleSheet.create({
  useCaseBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: 12,
  },
  useCaseBtnActive: {
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentSoft,
  },
  useCaseIcon: { fontSize: 24 },
  useCaseLabel: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
  useCaseDesc: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  scanHeader: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: "rgba(0,0,0,0.16)",
  },
  scanTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "bold", textAlign: "center" },
  scanFooter: { padding: 20, backgroundColor: "rgba(0,0,0,0.16)" },
  crosshairOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  crosshairH: {
    position: "absolute",
    width: "74%",
    height: 1.2,
    backgroundColor: "rgba(255,122,26,0.9)",
  },
  crosshairV: {
    position: "absolute",
    height: "58%",
    width: 1.2,
    backgroundColor: "rgba(255,77,77,0.9)",
  },
  crosshairDiag: {
    position: "absolute",
    width: "70%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.42)",
  },
});
