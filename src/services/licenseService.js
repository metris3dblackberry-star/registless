// licenseService.js — AsyncStorage alapú licensz kezelés (Firebase-mentes)
// Registless 2026-03-22
import AsyncStorage from "@react-native-async-storage/async-storage";

const LICENSE_KEY_PREFIX = "registless_license_";

export const TRIAL_LIMITS = {
  partners:  10,
  invoices:  40,
  messages:  150,
  pdfExport: 5,
  trialDays: 30,
};

export const PLANS = {
  free:  "free",
  trial: "trial",
  pro:   "pro",
};

const DEFAULT_STATUS = { plan: PLANS.free, isActive: true, daysLeft: null };

// ── Licensz lekérése ──────────────────────────────────────────────
export async function getLicense(uid) {
  if (!uid) return null;
  try {
    const raw = await AsyncStorage.getItem(LICENSE_KEY_PREFIX + uid);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ── Trial indítása ────────────────────────────────────────────────
export async function startTrial(uid) {
  if (!uid) return null;
  const now = Date.now();
  const trialEnd = now + TRIAL_LIMITS.trialDays * 24 * 60 * 60 * 1000;
  const license = {
    uid,
    plan: PLANS.trial,
    trialStartedAt: now,
    trialEndsAt: trialEnd,
    proStartedAt: null,
    proEndsAt: null,
    stripeSubscriptionId: null,
    createdAt: now,
    updatedAt: now,
  };
  await AsyncStorage.setItem(LICENSE_KEY_PREFIX + uid, JSON.stringify(license));
  return license;
}

// ── PRO aktiválás (Stripe webhook után hívandó) ───────────────────
export async function activatePro(uid, stripeSubscriptionId, periodEnd) {
  if (!uid) return;
  const existing = await getLicense(uid);
  const updated = {
    ...(existing || {}),
    uid,
    plan: PLANS.pro,
    stripeSubscriptionId,
    proStartedAt: Date.now(),
    proEndsAt: periodEnd || null,
    updatedAt: Date.now(),
  };
  await AsyncStorage.setItem(LICENSE_KEY_PREFIX + uid, JSON.stringify(updated));
}

// ── Licensz státusz számítása ─────────────────────────────────────
export function getLicenseStatus(license) {
  if (!license) return DEFAULT_STATUS;

  const now = Date.now();

  if (license.plan === PLANS.pro) {
    const proActive = !license.proEndsAt || license.proEndsAt > now;
    return {
      plan: PLANS.pro,
      isActive: proActive,
      daysLeft: null,
      stripeSubscriptionId: license.stripeSubscriptionId,
    };
  }

  if (license.plan === PLANS.trial) {
    const trialActive = license.trialEndsAt > now;
    const daysLeft = Math.max(0, Math.ceil((license.trialEndsAt - now) / (24 * 60 * 60 * 1000)));
    return {
      plan: PLANS.trial,
      isActive: trialActive,
      daysLeft,
      trialEndsAt: license.trialEndsAt,
    };
  }

  return { plan: PLANS.free, isActive: true, daysLeft: null };
}

// ── Feature gate-ek ───────────────────────────────────────────────
export function canAddPartner(licenseStatus, currentCount) {
  if (!licenseStatus) return false;
  if (licenseStatus.plan === PLANS.pro && licenseStatus.isActive) return true;
  if (licenseStatus.plan === PLANS.trial && licenseStatus.isActive) {
    return currentCount < TRIAL_LIMITS.partners;
  }
  return false;
}

export function canAddInvoice(licenseStatus, currentCount) {
  if (!licenseStatus) return false;
  if (licenseStatus.plan === PLANS.pro && licenseStatus.isActive) return true;
  if (licenseStatus.plan === PLANS.trial && licenseStatus.isActive) {
    return currentCount < TRIAL_LIMITS.invoices;
  }
  return false;
}

export function canSendMessage(licenseStatus, currentCount) {
  if (!licenseStatus) return false;
  if (licenseStatus.plan === PLANS.pro && licenseStatus.isActive) return true;
  if (licenseStatus.plan === PLANS.trial && licenseStatus.isActive) {
    return currentCount < TRIAL_LIMITS.messages;
  }
  return false;
}

export function canExportPdf(licenseStatus, currentCount) {
  if (!licenseStatus) return false;
  if (licenseStatus.plan === PLANS.pro && licenseStatus.isActive) return true;
  if (licenseStatus.plan === PLANS.trial && licenseStatus.isActive) {
    return currentCount < TRIAL_LIMITS.pdfExport;
  }
  return false;
}

// ── Badge ─────────────────────────────────────────────────────────
export function getLicenseBadge(licenseStatus) {
  if (!licenseStatus) return { text: "BETÖLTÉS...", color: "#888" };
  if (licenseStatus.plan === PLANS.pro && licenseStatus.isActive) {
    return { text: "✅ PRO", color: "#ff7a1a" };
  }
  if (licenseStatus.plan === PLANS.trial && licenseStatus.isActive) {
    return { text: `⏳ TRIAL · ${licenseStatus.daysLeft} nap`, color: "#00BCD4" };
  }
  if (licenseStatus.plan === PLANS.trial && !licenseStatus.isActive) {
    return { text: "❌ LEJÁRT", color: "#f44336" };
  }
  return { text: "INGYENES", color: "#888" };
}
