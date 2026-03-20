// ─────────────────────────────────────────────────────────────────
// FeatureGate.js — Plan gating komponens
// Ha a user nem jogosult: upgrade prompt
// ─────────────────────────────────────────────────────────────────
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors } from "../theme/colors";
import { shared } from "../theme/styles";
import { PLAN_DISPLAY, Plan } from "../models/accountModel";

const FEATURE_LABELS = {
  canPublicProfile:   { label: "Publikus profil", requiredPlan: Plan.TRIAL, icon: "👤" },
  canChat:            { label: "Üzenetküldés",    requiredPlan: Plan.TRIAL, icon: "💬" },
  canVideos:          { label: "Videók",           requiredPlan: Plan.TRIAL, icon: "🎬" },
  canPortfolio:       { label: "Portfolio képek",  requiredPlan: Plan.TRIAL, icon: "📷" },
  canSearch:          { label: "Kereshetőség",     requiredPlan: Plan.TRIAL, icon: "🔍" },
  canCustomBranding:  { label: "Egyéni branding",  requiredPlan: Plan.PRO,   icon: "🎨" },
  canAnalytics:       { label: "Analitika",        requiredPlan: Plan.PRO,   icon: "📊" },
};

/**
 * FeatureGate — Ha nincs jogosultság: upgrade prompt jelenik meg
 * children helyett
 *
 * Használat:
 * <FeatureGate feature="canVideos" can={auth.can} onUpgrade={...}>
 *   <VideoSection />
 * </FeatureGate>
 */
export function FeatureGate({ feature, can, onUpgrade, children, compact = false }) {
  const hasAccess = can(feature);
  if (hasAccess) return children;

  const info = FEATURE_LABELS[feature] || { label: feature, icon: "🔒" };
  const planInfo = PLAN_DISPLAY[info.requiredPlan] || PLAN_DISPLAY[Plan.TRIAL];

  if (compact) {
    return (
      <TouchableOpacity style={fg.compactWrap} onPress={onUpgrade}>
        <Text style={fg.compactIcon}>🔒</Text>
        <Text style={fg.compactText}>{info.label} — {planInfo.label} szükséges</Text>
        <Text style={[fg.compactUpgrade, { color: planInfo.color }]}>Frissítés →</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={fg.wrap}>
      <Text style={fg.icon}>{info.icon}</Text>
      <Text style={fg.title}>{info.label}</Text>
      <Text style={fg.desc}>
        Ez a funkció {planInfo.icon} {planInfo.label} előfizetéssel érhető el.
      </Text>
      <TouchableOpacity
        style={[fg.upgradeBtn, { borderColor: planInfo.color + "66", backgroundColor: planInfo.color + "22" }]}
        onPress={onUpgrade}
      >
        <Text style={[fg.upgradeBtnText, { color: planInfo.color }]}>
          {planInfo.icon}  {planInfo.label} aktiválása
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/**
 * TrialBanner — Trial visszaszámláló banner
 */
export function TrialBanner({ daysLeft, onUpgrade }) {
  if (daysLeft <= 0) return null;
  const isUrgent = daysLeft <= 3;
  return (
    <TouchableOpacity
      style={[fg.trialBanner, isUrgent && fg.trialBannerUrgent]}
      onPress={onUpgrade}
    >
      <Text style={fg.trialIcon}>{isUrgent ? "⚠️" : "⏳"}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[fg.trialTitle, isUrgent && { color: "#ff6b6b" }]}>
          Trial: még {daysLeft} nap
        </Text>
        <Text style={fg.trialSub}>
          {isUrgent ? "Hamarosan lejár! Frissíts Pro-ra." : "Minden funkció elérhető."}
        </Text>
      </View>
      <Text style={[fg.trialUpgrade, isUrgent && { color: "#ff6b6b" }]}>Pro →</Text>
    </TouchableOpacity>
  );
}

/**
 * PlanBadge — Kis badge a plan jelzéséhez
 */
export function PlanBadge({ plan, size = "sm" }) {
  const info = PLAN_DISPLAY[plan] || PLAN_DISPLAY[Plan.FREE];
  return (
    <View style={[fg.planBadge, { backgroundColor: info.color + "22", borderColor: info.color + "55" }]}>
      <Text style={{ fontSize: size === "sm" ? 12 : 14 }}>{info.icon}</Text>
      <Text style={[fg.planBadgeText, { color: info.color, fontSize: size === "sm" ? 11 : 13 }]}>
        {info.label}
      </Text>
    </View>
  );
}

const fg = StyleSheet.create({
  wrap: {
    alignItems: "center", paddingVertical: 32, paddingHorizontal: 24,
    backgroundColor: colors.bgCard, borderRadius: 20,
    borderWidth: 1, borderColor: colors.borderSubtle, margin: 16,
  },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { color: colors.textPrimary, fontSize: 18, fontWeight: "bold", marginBottom: 8 },
  desc: { color: colors.textSecondary, fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 20 },
  upgradeBtn: {
    paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: 20, borderWidth: 1.5,
  },
  upgradeBtnText: { fontSize: 15, fontWeight: "bold" },
  compactWrap: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.bgCard, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  compactIcon: { fontSize: 16 },
  compactText: { flex: 1, color: colors.textSecondary, fontSize: 13 },
  compactUpgrade: { fontSize: 12, fontWeight: "bold" },
  trialBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(255,152,0,0.12)",
    borderRadius: 16, padding: 14, marginHorizontal: 16, marginBottom: 12,
    borderWidth: 1, borderColor: "rgba(255,152,0,0.3)",
  },
  trialBannerUrgent: {
    backgroundColor: "rgba(255,70,70,0.12)",
    borderColor: "rgba(255,70,70,0.3)",
  },
  trialIcon: { fontSize: 24 },
  trialTitle: { color: "#FF9800", fontSize: 14, fontWeight: "bold" },
  trialSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  trialUpgrade: { color: "#FF9800", fontSize: 13, fontWeight: "bold" },
  planBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 10, borderWidth: 1,
  },
  planBadgeText: { fontWeight: "600" },
});
