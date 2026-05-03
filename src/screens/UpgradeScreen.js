// ─────────────────────────────────────────────────────────────────
// UpgradeScreen.js — PRO előfizetés oldal
// Ár: 18€/hó
// Registless 2026-03-22
// ─────────────────────────────────────────────────────────────────
import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Linking,
} from "react-native";
import { colors } from "../theme/colors";
import { shared } from "../theme/styles";
import {
  TRIAL_LIMITS, getLicenseBadge, PLANS,
  startTrial, getLicenseStatus, getLicense,
} from "../services/licenseService";

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

const FEATURES_TRIAL = [
  `✅ Max ${TRIAL_LIMITS.partners} partner`,
  `✅ Max ${TRIAL_LIMITS.invoices} számla`,
  `✅ Max ${TRIAL_LIMITS.messages} üzenet`,
  `✅ Max ${TRIAL_LIMITS.pdfExport} PDF export`,
  "✅ Eladó mód alapfunkciók",
  "❌ NFC, OCR, Push",
  "❌ Korlátlan funkciók",
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
  onTrialActivated,
}) {
  const [loading, setLoading]           = useState(false);
  const [trialLoading, setTrialLoading] = useState(false);
  const badge = getLicenseBadge(licenseStatus);

  const isTrialActive  = licenseStatus?.plan === PLANS.trial && licenseStatus?.isActive;
  const isTrialExpired = licenseStatus?.plan === PLANS.trial && !licenseStatus?.isActive;
  const isPro          = licenseStatus?.plan === PLANS.pro && licenseStatus?.isActive;
  const canStartTrial  = !licenseStatus || licenseStatus.plan === PLANS.free;

  // ── Trial aktiválás ───────────────────────────────────────────
  async function handleStartTrial() {
    if (!userId) { Alert.alert("Hiba", "Kérjük jelentkezz be a folytatáshoz."); return; }
    setTrialLoading(true);
    try {
      await startTrial(userId);
      const newLicense = await getLicense(userId);
      const newStatus  = getLicenseStatus(newLicense);
      Alert.alert(
        "🎉 Trial aktiválva!",
        `${TRIAL_LIMITS.trialDays} napos ingyenes próbaidő elindult.\nEladó mód korlátozott funkcióval elérhető!`,
        [{ text: "Kezdjük!", onPress: () => onTrialActivated?.(newStatus) }]
      );
    } catch (e) {
      Alert.alert("Hiba", "Nem sikerült aktiválni a trial-t.");
    } finally {
      setTrialLoading(false);
    }
  }

  // ── PRO előfizetés ────────────────────────────────────────────
  async function handleSubscribe() {
    if (!userId || !userEmail) { Alert.alert("Hiba", "Kérjük jelentkezz be a folytatáshoz."); return; }
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
    <ScrollView style={{ flex: 1 }} contentContainerStyle={st.container}>
      <Text style={st.title}>REGISTLESS PRO</Text>
      <Text style={st.subtitle}>Válassz a lehetőségek közül</Text>

      {/* Jelenlegi státusz */}
      <View style={st.statusBox}>
        <Text style={[st.statusBadge, { color: badge.color }]}>{badge.text}</Text>
        {isTrialActive && (
          <Text style={st.statusSub}>{licenseStatus.daysLeft} nap maradt a próbaidőből</Text>
        )}
        {isTrialExpired && (
          <Text style={[st.statusSub, { color: "#f44336" }]}>
            A próbaidő lejárt — frissíts PRO-ra a folytatáshoz!
          </Text>
        )}
        {isPro && (
          <Text style={[st.statusSub, { color: "#4CAF50" }]}>PRO előfizetésed aktív 🎉</Text>
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
        <Text style={[st.planName, { color: "#00BCD4" }]}>30 NAPOS PRÓBA</Text>
        <Text style={[st.planPrice, { color: "#00BCD4" }]}>
          0 €<Text style={st.planPer}> / 30 nap</Text>
        </Text>
        <Text style={st.planDesc}>Korlátozott ELADÓ mód — ingyenesen</Text>
        {FEATURES_TRIAL.map((f, i) => (
          <Text key={i} style={[st.feature, f.startsWith("❌") && st.featureNo]}>{f}</Text>
        ))}

        {canStartTrial && (
          <TouchableOpacity
            style={[st.trialBtn, trialLoading && { opacity: 0.6 }]}
            onPress={handleStartTrial}
            disabled={trialLoading}
          >
            <Text style={st.trialBtnText}>
              {trialLoading ? "⏳ Aktiválás..." : "🎯  30 napos trial indítása — ingyenes"}
            </Text>
          </TouchableOpacity>
        )}
        {isTrialActive && (
          <View style={st.trialActiveBox}>
            <Text style={st.trialActiveText}>✅ Trial aktív · {licenseStatus.daysLeft} nap maradt</Text>
          </View>
        )}
        {isTrialExpired && (
          <View style={[st.trialActiveBox, { borderColor: "#f44336" }]}>
            <Text style={[st.trialActiveText, { color: "#f44336" }]}>❌ Trial lejárt — válts PRO-ra!</Text>
          </View>
        )}
      </View>

      {/* PRO kártya — 18€/hó */}
      <View style={[st.card, st.cardPro]}>
        <View style={st.proTag}><Text style={st.proTagText}>LEGJOBB VÁLASZTÁS</Text></View>
        <Text style={[st.planName, { color: "#ff7a1a" }]}>PRO</Text>
        {/* ✅ 18€ */}
        <Text style={[st.planPrice, { color: "#ff7a1a" }]}>
          18 €<Text style={st.planPer}> / hó</Text>
        </Text>
        <Text style={st.planDesc}>Korlátlan ELADÓ mód</Text>
        {FEATURES_PRO.map((f, i) => (
          <Text key={i} style={st.feature}>{f}</Text>
        ))}

        {!isPro ? (
          <>
            <TouchableOpacity
              style={[st.upgradeBtn, loading && { opacity: 0.6 }]}
              onPress={handleSubscribe}
              disabled={loading}
            >
              <Text style={st.upgradeBtnText}>
                {loading ? "⏳ Betöltés..." : "🚀  PRO aktiválása — 18€/hó"}
              </Text>
            </TouchableOpacity>
            <Text style={st.cancelNote}>Bármikor lemondható · Azonnali hozzáférés</Text>
          </>
        ) : (
          <View style={[st.trialActiveBox, { borderColor: "#ff7a1a" }]}>
            <Text style={[st.trialActiveText, { color: "#ff7a1a" }]}>✅ PRO előfizetés aktív</Text>
          </View>
        )}
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
  container:    { padding: 20, paddingTop: 60, paddingBottom: 40 },
  title:        { color: "#fff", fontSize: 26, fontWeight: "bold", textAlign: "center" },
  subtitle:     { color: colors.textSecondary, fontSize: 15, textAlign: "center", marginBottom: 20 },
  statusBox:    { backgroundColor: "rgba(45,45,45,0.92)", borderRadius: 14, padding: 14, alignItems: "center", marginBottom: 20, borderWidth: 1, borderColor: colors.borderSubtle },
  statusBadge:  { fontSize: 16, fontWeight: "bold" },
  statusSub:    { color: colors.textSecondary, fontSize: 13, marginTop: 4, textAlign: "center" },
  card:         { backgroundColor: "rgba(45,45,45,0.92)", borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.borderSubtle },
  cardTrial:    { borderColor: "rgba(0,188,212,0.35)" },
  cardPro:      { borderColor: "rgba(255,122,26,0.4)" },
  proTag:       { backgroundColor: "#ff7a1a", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, alignSelf: "flex-start", marginBottom: 8 },
  proTagText:   { color: "#fff", fontSize: 11, fontWeight: "bold" },
  planName:     { color: "#fff", fontSize: 18, fontWeight: "bold" },
  planPrice:    { color: "#fff", fontSize: 32, fontWeight: "bold", marginVertical: 4 },
  planPer:      { fontSize: 16, fontWeight: "normal", color: colors.textSecondary },
  planDesc:     { color: colors.textSecondary, fontSize: 13, marginBottom: 12 },
  feature:      { color: colors.textPrimary, fontSize: 14, marginBottom: 4 },
  featureNo:    { color: colors.textSecondary },
  trialBtn:     { backgroundColor: "#00BCD4", borderRadius: 16, padding: 14, alignItems: "center", marginTop: 16 },
  trialBtnText: { color: "#fff", fontSize: 15, fontWeight: "bold" },
  trialActiveBox:  { borderWidth: 1, borderColor: "#00BCD4", borderRadius: 12, padding: 12, alignItems: "center", marginTop: 14 },
  trialActiveText: { color: "#00BCD4", fontSize: 14, fontWeight: "600" },
  upgradeBtn:    { backgroundColor: "#ff7a1a", borderRadius: 16, padding: 16, alignItems: "center", marginTop: 16 },
  upgradeBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  cancelNote:   { color: colors.textSecondary, fontSize: 12, textAlign: "center", marginTop: 8 },
  footer:       { color: "rgba(255,255,255,0.3)", fontSize: 11, textAlign: "center", marginTop: 24 },
});
