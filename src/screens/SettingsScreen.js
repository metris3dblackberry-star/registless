// ─────────────────────────────────────────────────────────────────
// SettingsScreen.js — Beállítások / Eszközök képernyő
// Tartalmaz: céges adatok, QR profil, payment setup, share app
// ─────────────────────────────────────────────────────────────────
import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, Image, Alert, Dimensions,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { colors } from "../theme/colors";
import { shared } from "../theme/styles";

const SECTIONS = ["Céges adatok", "QR profil", "Fizetési beállítások", "App megosztása"];

export default function SettingsScreen({
  // Seller adatok
  sellerName, setSellerName,
  sellerAddress, setSellerAddress,
  sellerCompany, setSellerCompany,
  sellerTaxNumber, setSellerTaxNumber,
  sellerBankAccount, setSellerBankAccount,
  // Buyer adatok
  buyerName, setBuyerName,
  buyerAddress, setBuyerAddress,
  buyerCompany, setBuyerCompany,
  // QR
  sellerQrPayload,
  buyerQrPayload,
  // Payment
  selectedPaymentMethod, setSelectedPaymentMethod,
  // Callbacks
  onOcr,
  onResetAll,
  onRestartOnboarding,
  onBack,
  initialSection = null,
}) {
  const [activeSection, setActiveSection] = useState(initialSection || SECTIONS[0]);
  const sectionScrollRef = React.useRef(null);
  const screenWidth = Dimensions.get('window').width;

  function scrollToSection(sec) {
    const index = SECTIONS.indexOf(sec);
    if (index >= 0 && sectionScrollRef.current) {
      sectionScrollRef.current.scrollTo({ x: index * screenWidth, animated: true });
    }
  }

  function handleSectionSwipe(event) {
    const x = event.nativeEvent.contentOffset.x;
    const index = Math.round(x / screenWidth);
    const sec = SECTIONS[index];
    if (sec && sec !== activeSection) setActiveSection(sec);
  }
  const [qrRole, setQrRole] = useState("seller");

  function renderCegAdatok() {
    return (
      <View>
        <Text style={shared.label}>Eladó neve</Text>
        <TextInput style={shared.input} value={sellerName} onChangeText={setSellerName} placeholder="Teljes név" placeholderTextColor={colors.placeholder} />

        <Text style={shared.label}>Cím</Text>
        <TextInput style={shared.input} value={sellerAddress} onChangeText={setSellerAddress} placeholder="Cím" placeholderTextColor={colors.placeholder} />

        <Text style={shared.label}>Cégnév</Text>
        <TextInput style={shared.input} value={sellerCompany} onChangeText={setSellerCompany} placeholder="Cégnév (opcionális)" placeholderTextColor={colors.placeholder} />

        <Text style={shared.label}>Adószám</Text>
        <TextInput style={shared.input} value={sellerTaxNumber} onChangeText={setSellerTaxNumber} placeholder="Adószám" placeholderTextColor={colors.placeholder} />

        <Text style={shared.label}>Bankszámlaszám / Revolut</Text>
        <TextInput style={shared.input} value={sellerBankAccount} onChangeText={setSellerBankAccount} placeholder="8-8-8 formátum  vagy  @revolut_username" placeholderTextColor={colors.placeholder} />
        <Text style={{ color: "#888", fontSize: 11, marginTop: -8, marginBottom: 8, marginLeft: 4 }}>
          💜 Revolut fizetési kéréshez add meg: @felhasználónév
        </Text>

        <View style={st.divider} />
        <Text style={[shared.label, { marginTop: 0 }]}>Vevő profilom</Text>

        <Text style={shared.labelSmall}>Vevő neve</Text>
        <TextInput style={shared.input} value={buyerName} onChangeText={setBuyerName} placeholder="Teljes név" placeholderTextColor={colors.placeholder} />

        <Text style={shared.labelSmall}>Vevő cím</Text>
        <TextInput style={shared.input} value={buyerAddress} onChangeText={setBuyerAddress} placeholder="Cím" placeholderTextColor={colors.placeholder} />

        <Text style={shared.labelSmall}>Vevő cégnév</Text>
        <TextInput style={shared.input} value={buyerCompany} onChangeText={setBuyerCompany} placeholder="Cégnév (opcionális)" placeholderTextColor={colors.placeholder} />

        <TouchableOpacity style={shared.btnOutline} onPress={onOcr}>
          <Text style={shared.btnTextSecondary}>🔍  OCR importálás képből</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderQrProfil() {
    const payload = qrRole === "seller" ? sellerQrPayload() : buyerQrPayload();
    return (
      <View style={{ alignItems: "center" }}>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
          <TouchableOpacity
            style={[st.roleBtn, qrRole === "seller" && st.roleBtnActive]}
            onPress={() => setQrRole("seller")}
          >
            <Text style={[st.roleBtnText, qrRole === "seller" && { color: colors.accent }]}>ELADÓ QR</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[st.roleBtn, qrRole === "buyer" && st.roleBtnActive]}
            onPress={() => setQrRole("buyer")}
          >
            <Text style={[st.roleBtnText, qrRole === "buyer" && { color: colors.accent }]}>VEVŐ QR</Text>
          </TouchableOpacity>
        </View>

        <View style={st.qrWrap}>
          <QRCode value={payload || "empty"} size={220} />
        </View>

        <Text style={[shared.labelSmall, { textAlign: "center", marginTop: 12 }]}>
          {qrRole === "seller"
            ? `${sellerName || "Eladó profil"} · ${sellerCompany || ""}`
            : `${buyerName || "Vevő profil"} · ${buyerCompany || ""}`}
        </Text>
      </View>
    );
  }

  function renderPayment() {
    const methods = [
      { id: "stripe", label: "Stripe", icon: "🔵" },
      { id: "simple", label: "Simple (OTP)", icon: "🟠" },
      { id: "revolut", label: "Revolut", icon: "💜" },
    ];
    return (
      <View>
        {methods.map((m) => (
          <TouchableOpacity
            key={m.id}
            style={[shared.panelBtn, selectedPaymentMethod === m.id && { borderColor: colors.accentBorder }]}
            onPress={() => setSelectedPaymentMethod(m.id)}
          >
            <Text style={shared.panelBtnTitle}>{m.icon} {m.label}</Text>
            <Text style={shared.panelBtnSub}>
              {selectedPaymentMethod === m.id ? "✓ Aktív" : "Inaktív"}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={[shared.card, { marginTop: 8 }]}>
          <Text style={shared.value}>
            A valódi merchant flow (Revolut business API, Stripe checkout) a következő verzióban érkezik.
          </Text>
        </View>
      </View>
    );
  }

  function renderShare() {
    const shareUrl = "https://registless.ai";
    return (
      <View style={{ alignItems: "center" }}>
        <View style={st.qrWrap}>
          <QRCode value={shareUrl} size={200} />
        </View>
        <Text style={[shared.value, { textAlign: "center", marginTop: 12 }]}>
          Registless Letöltése
        </Text>
        <Text style={[shared.labelSmall, { textAlign: "center" }]}>{shareUrl}</Text>
        <Text style={[shared.hint, { textAlign: "center", marginTop: 16 }]}>
          Powered by Star Labs Kft. · All rights reserved
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Title */}
      <Text style={[shared.title, { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 }]}>BEÁLLÍTÁSOK</Text>

      {/* Section tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, paddingHorizontal: 16, marginBottom: 12 }}
        contentContainerStyle={{ paddingRight: 16 }}
      >
        {SECTIONS.map((s) => (
          <TouchableOpacity
            key={s}
            style={[st.sectionTab, activeSection === s && st.sectionTabActive]}
            onPress={() => {
              setActiveSection(s);
              scrollToSection(s);
            }}
          >
            <Text style={[st.sectionTabText, activeSection === s && { color: colors.accent }]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Swipeable pages */}
      <ScrollView
        ref={sectionScrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleSectionSwipe}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
      >
        {/* Céges adatok */}
        <ScrollView style={{ width: screenWidth }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {renderCegAdatok()}
          <TouchableOpacity style={[shared.btnOutline, { marginTop: 24, borderColor: "rgba(255,152,0,0.4)" }]} onPress={onRestartOnboarding}>
            <Text style={[shared.btnTextSecondary, { color: "#FF9800" }]}>🎬  App bemutató újraindítása</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[shared.btnOutline, { marginTop: 12, borderColor: "rgba(244,67,54,0.4)" }]} onPress={onResetAll}>
            <Text style={[shared.btnTextSecondary, { color: "#f44336" }]}>🗑️  Összes adat törlése</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[shared.btnOutline, { marginTop: 12 }]} onPress={onBack}>
            <Text style={shared.btnTextSecondary}>VISSZA</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* QR profil */}
        <ScrollView style={{ width: screenWidth }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          {renderQrProfil()}
          <TouchableOpacity style={[shared.btnOutline, { marginTop: 24 }]} onPress={onBack}>
            <Text style={shared.btnTextSecondary}>VISSZA</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Fizetési beállítások */}
        <ScrollView style={{ width: screenWidth }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          {renderPayment()}
          <TouchableOpacity style={[shared.btnOutline, { marginTop: 24 }]} onPress={onBack}>
            <Text style={shared.btnTextSecondary}>VISSZA</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* App megosztása */}
        <ScrollView style={{ width: screenWidth }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          {renderShare()}
          <TouchableOpacity style={[shared.btnOutline, { marginTop: 24 }]} onPress={onBack}>
            <Text style={shared.btnTextSecondary}>VISSZA</Text>
          </TouchableOpacity>
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  divider: {
    width: "100%",
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginVertical: 20,
  },
  sectionTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  sectionTabActive: {
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentSoft,
  },
  sectionTabText: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
  roleBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  roleBtnActive: { borderColor: colors.accentBorder, backgroundColor: colors.accentSoft },
  roleBtnText: { color: colors.textSecondary, fontSize: 14, fontWeight: "bold" },
  qrWrap: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 24,
    marginBottom: 12,
  },
});
