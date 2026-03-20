// ─────────────────────────────────────────────────────────────────
// UpgradeScreen.js — PRO előfizetés oldal
// Stripe Subscription 25€/hó
// ─────────────────────────────────────────────────────────────────
import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Linking,
} from "react-native";
import { colors } from "../theme/colors";
import { shared } from "../theme/styles";
import { TRIAL_LIMITS, getLicenseBadge } from "../services/licenseService";

const STRIPE_SUBSCRIPTION_FUNCTION =
  "https://europe-west1-registless.cloudfunctions.net/createStripeSubscription";

const FEATURES_FREE = [
  "✅ Vevő mód teljes hozzáférés",
  "✅ Időpont kérés",
  "✅ Üzenetküldés",
  "✅ Fizetési kérés fogadása",
  "❌ Eladó mód",
  "❌ Számlázás",
  "❌ Partner kezelés",
];

const FEATURES_PRO = [
  "✅ Korlátlan partner",
  "✅ Korlátlan számla",
  "✅ Korlátlan üzenet",
  "✅ PDF export",
  "✅ Push értesítések",
  "✅ NFC partner kapcsolat",
  "✅ OCR névjegy import",
  "✅ Stripe + Revolut + Simple fizetés",
  "✅ Minden jövőbeli funkció",
];

export default function UpgradeScreen({
  licenseStatus,
  userEmail,
  userId,
  onBack,
  onUpgradeSuccess,
}) {
  const [loading, setLoading] = useState(false);
  const badge = getLicenseBadge(licenseStatus);

  async function handleSubscribe() {
    if (!userId || !userEmail) {
      Alert.alert("Hiba", "Kérjük jelentkezz be a folytatáshoz.");
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(STRIPE_SUBSCRIPTION_FUNCTION, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, userEmail }),
      });
      const data = await resp.json();
      if (data.url) {
        await Linking.openURL(data.url);
        Alert.alert(
          "✅ Köszönjük!",
          "Fizetés után automatikusan aktiválódik a PRO hozzáférésed.",
          [{ text: "OK", onPress: onUpgradeSuccess }]
        );
      } else {
        Alert.alert("Hiba", data.error || "Nem sikerült létrehozni a fizetési oldalt.");
      }
    } catch (e) {
      Alert.alert("Hiba", "Nem sikerült kapcsolódni a fizetési rendszerhez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={st.container}
    >
      {/* Header */}
      <Text style={st.title}>REGISTLESS PRO</Text>
      <Text style={st.subtitle}>Válassz a lehetőségek közül</Text>

      {/* Jelenlegi státusz */}
      <View style={st.statusBox}>
        <Text style={[st.statusBadge, { color: badge.color }]}>{badge.text}</Text>
        {licenseStatus?.daysLeft > 0 && (
          <Text style={st.statusSub}>
            {licenseStatus.daysLeft} nap maradt a próbaidőből
          </Text>
        )}
        {licenseStatus?.plan === "trial" && !licenseStatus?.isActive && (
          <Text style={[st.statusSub, { color: "#f44336" }]}>
            A próbaidő lejárt — frissíts PRO-ra a folytatáshoz!
          </Text>
        )}
      </View>

      {/* Ingyenes kártya */}
      <View style={st.card}>
        <Text style={st.planName}>INGYENES</Text>
        <Text style={st.planPrice}>0 €<Text style={st.planPer}> / hó</Text></Text>
        <Text style={st.planDesc}>Vevő mód — mindig ingyenes</Text>
        {FEATURES_FREE.map((f, i) => (
          <Text key={i} style={[st.feature, f.startsWith("❌") && st.featureNo]}>{f}</Text>
        ))}
      </View>

      {/* Trial kártya */}
      <View style={[st.card, st.cardTrial]}>
        <Text style={[st.planName, { color: "#00BCD4" }]}>PRÓBA</Text>
        <Text style={[st.planPrice, { color: "#00BCD4" }]}>
          0 €<Text style={st.planPer}> / 30 nap</Text>
        </Text>
        <Text style={st.planDesc}>Korlátozott ELADÓ mód</Text>
        <Text style={st.trialLimit}>👥 Max {TRIAL_LIMITS.partners} partner</Text>
        <Text style={st.trialLimit}>📄 Max {TRIAL_LIMITS.invoices} számla</Text>
        <Text style={st.trialLimit}>💬 Max {TRIAL_LIMITS.messages} üzenet</Text>
        <Text style={st.trialLimit}>📑 Max {TRIAL_LIMITS.pdfExport} PDF export</Text>
      </View>

      {/* PRO kártya */}
      <View style={[st.card, st.cardPro]}>
        <View style={st.proTag}><Text style={st.proTagText}>LEGJOBB VÁLASZTÁS</Text></View>
        <Text style={[st.planName, { color: "#ff7a1a" }]}>PRO</Text>
        <Text style={[st.planPrice, { color: "#ff7a1a" }]}>
          25 €<Text style={st.planPer}> / hó</Text>
        </Text>
        <Text style={st.planDesc}>Korlátlan ELADÓ mód</Text>
        {FEATURES_PRO.map((f, i) => (
          <Text key={i} style={st.feature}>{f}</Text>
        ))}

        <TouchableOpacity
          style={[st.upgradeBtn, loading && { opacity: 0.6 }]}
          onPress={handleSubscribe}
          disabled={loading}
        >
          <Text style={st.upgradeBtnText}>
            {loading ? "⏳ Betöltés..." : "🚀  PRO aktiválása — 25€/hó"}
          </Text>
        </TouchableOpacity>
        <Text style={st.cancelNote}>Bármikor lemondható · Azonnali hozzáférés</Text>
      </View>

      <TouchableOpacity style={[shared.btnOutline, { marginTop: 8 }]} onPress={onBack}>
        <Text style={shared.btnTextSecondary}>VISSZA</Text>
      </TouchableOpacity>

      <Text style={st.footer}>
        A fizetés biztonságos Stripe rendszeren keresztül történik.{"\n"}
        Powered by Star Labs Kft.
      </Text>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  title: { color: "#fff", fontSize: 26, fontWeight: "bold", textAlign: "center" },
  subtitle: { color: colors.textSecondary, fontSize: 15, textAlign: "center", marginBottom: 20 },
  statusBox: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14, padding: 14, alignItems: "center", marginBottom: 20,
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  statusBadge: { fontSize: 16, fontWeight: "bold" },
  statusSub: { color: colors.textSecondary, fontSize: 13, marginTop: 4, textAlign: "center" },
  card: {
    backgroundColor: "rgba(20,20,20,0.7)",
    borderRadius: 20, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  cardTrial: { borderColor: "rgba(0,188,212,0.3)" },
  cardPro: { borderColor: "rgba(255,122,26,0.4)", position: "relative" },
  proTag: {
    backgroundColor: "#ff7a1a", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 4,
    alignSelf: "flex-start", marginBottom: 8,
  },
  proTagText: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  planName: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  planPrice: { color: "#fff", fontSize: 32, fontWeight: "bold", marginVertical: 4 },
  planPer: { fontSize: 16, fontWeight: "normal", color: colors.textSecondary },
  planDesc: { color: colors.textSecondary, fontSize: 13, marginBottom: 12 },
  feature: { color: colors.textPrimary, fontSize: 14, marginBottom: 4 },
  featureNo: { color: colors.textSecondary },
  trialLimit: { color: "#00BCD4", fontSize: 14, marginBottom: 4 },
  upgradeBtn: {
    backgroundColor: "#ff7a1a", borderRadius: 16,
    padding: 16, alignItems: "center", marginTop: 16,
  },
  upgradeBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  cancelNote: { color: colors.textSecondary, fontSize: 12, textAlign: "center", marginTop: 8 },
  footer: { color: "rgba(255,255,255,0.3)", fontSize: 11, textAlign: "center", marginTop: 24 },
});
