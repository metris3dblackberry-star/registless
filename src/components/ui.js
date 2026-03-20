// ─────────────────────────────────────────────────────────────────
// ui.js — Premium dark UI komponensek
// Egységes spacing, shadow, animáció, üres állapotok
// ─────────────────────────────────────────────────────────────────
import React from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, ActivityIndicator,
} from "react-native";
import { colors } from "../theme/colors";

// ── Spacing konstansok ────────────────────────────────────────────
export const spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
};

// ── Shadow presets ────────────────────────────────────────────────
export const shadows = {
  accent: {
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  none: {},
};

// ── PremiumCard ───────────────────────────────────────────────────
export function PremiumCard({ children, style, accent = false, onPress }) {
  const content = (
    <View style={[ui.card, accent && ui.cardAccent, style]}>
      {children}
    </View>
  );
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

// ── PremiumButton ─────────────────────────────────────────────────
export function PremiumButton({ label, icon, onPress, variant = "primary", disabled = false, style }) {
  const styles = {
    primary: ui.btnPrimary,
    outline: ui.btnOutline,
    danger: ui.btnDanger,
    ghost: ui.btnGhost,
  };
  const textStyles = {
    primary: ui.btnTextPrimary,
    outline: ui.btnTextOutline,
    danger: ui.btnTextDanger,
    ghost: ui.btnTextGhost,
  };
  return (
    <TouchableOpacity
      style={[styles[variant], disabled && { opacity: 0.4 }, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
    >
      {icon && <Text style={ui.btnIcon}>{icon}</Text>}
      <Text style={textStyles[variant]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── EmptyState ────────────────────────────────────────────────────
export function EmptyState({ icon, title, subtitle, action, actionLabel }) {
  return (
    <View style={ui.emptyWrap}>
      <Text style={ui.emptyIcon}>{icon || "📭"}</Text>
      <Text style={ui.emptyTitle}>{title}</Text>
      {!!subtitle && <Text style={ui.emptySub}>{subtitle}</Text>}
      {!!action && (
        <TouchableOpacity style={[ui.btnPrimary, { marginTop: spacing.lg, paddingHorizontal: spacing.xl }]} onPress={action}>
          <Text style={ui.btnTextPrimary}>{actionLabel || "Hozzáadás"}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── SectionHeader ─────────────────────────────────────────────────
export function SectionHeader({ title, action, actionLabel }) {
  return (
    <View style={ui.sectionHeader}>
      <Text style={ui.sectionTitle}>{title}</Text>
      {!!action && (
        <TouchableOpacity onPress={action}>
          <Text style={ui.sectionAction}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── StatCard ──────────────────────────────────────────────────────
export function StatCard({ value, label, accent = false, icon, onPress }) {
  const content = (
    <View style={[ui.statCard, accent && ui.statCardAccent]}>
      {icon && <Text style={ui.statIcon}>{icon}</Text>}
      <Text style={[ui.statValue, accent && { color: colors.accent }]}>{value}</Text>
      <Text style={ui.statLabel}>{label}</Text>
    </View>
  );
  if (onPress) return <TouchableOpacity onPress={onPress} activeOpacity={0.75}>{content}</TouchableOpacity>;
  return content;
}

// ── LoadingSpinner ────────────────────────────────────────────────
export function LoadingSpinner({ label }) {
  return (
    <View style={ui.loadingWrap}>
      <ActivityIndicator size="large" color={colors.accent} />
      {!!label && <Text style={ui.loadingLabel}>{label}</Text>}
    </View>
  );
}

// ── Divider ───────────────────────────────────────────────────────
export function Divider({ style }) {
  return <View style={[ui.divider, style]} />;
}

// ── Styles ────────────────────────────────────────────────────────
const ui = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.card,
  },
  cardAccent: {
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentSoft,
  },
  btnPrimary: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(88,88,88,0.34)",
    padding: spacing.md, borderRadius: 22,
    borderWidth: 1, borderColor: colors.border,
    ...shadows.accent,
  },
  btnOutline: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1.4, borderColor: colors.border,
    padding: spacing.md - 2, borderRadius: 22,
    backgroundColor: colors.bgButtonOutline,
  },
  btnDanger: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1.4, borderColor: colors.border,
    padding: spacing.md - 2, borderRadius: 22,
    backgroundColor: "#180b0b",
  },
  btnGhost: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  btnIcon: { fontSize: 18 },
  btnTextPrimary: { color: colors.textPrimary, fontSize: 17, fontWeight: "bold" },
  btnTextOutline: { color: colors.textPrimary, fontSize: 15 },
  btnTextDanger: { color: "#ff6b6b", fontSize: 15 },
  btnTextGhost: { color: colors.textSecondary, fontSize: 14 },
  emptyWrap: {
    alignItems: "center", paddingVertical: 48, paddingHorizontal: 32,
  },
  emptyIcon: { fontSize: 56, marginBottom: spacing.md },
  emptyTitle: {
    color: colors.textPrimary, fontSize: 20,
    fontWeight: "bold", textAlign: "center", marginBottom: spacing.sm,
  },
  emptySub: {
    color: colors.textSecondary, fontSize: 15,
    textAlign: "center", lineHeight: 22,
  },
  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  sectionTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: "700" },
  sectionAction: { color: colors.accent, fontSize: 13, fontWeight: "600" },
  statCard: {
    flex: 1, backgroundColor: colors.bgCard,
    borderRadius: 16, padding: 12,
    alignItems: "center", borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  statCardAccent: {
    borderColor: "rgba(255,122,26,0.35)",
    backgroundColor: "rgba(255,122,26,0.08)",
  },
  statIcon: { fontSize: 18, marginBottom: 4 },
  statValue: { color: colors.textPrimary, fontSize: 18, fontWeight: "bold" },
  statLabel: { color: colors.textSecondary, fontSize: 10, marginTop: 4, textAlign: "center" },
  loadingWrap: { alignItems: "center", paddingVertical: 32 },
  loadingLabel: { color: colors.textSecondary, marginTop: 12, fontSize: 14 },
  divider: { height: 1, backgroundColor: colors.borderSubtle, marginVertical: spacing.md },
});
