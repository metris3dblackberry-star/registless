// ─────────────────────────────────────────────────────────────────
// licenseService.js — Trial + PRO licensz kezelés
// ─────────────────────────────────────────────────────────────────
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";

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

// ── Default státusz (null esetén) ─────────────────────────────────
const DEFAULT_STATUS = { plan: PLANS.free, isActive: false, daysLeft: 0 };

// ── Licensz lekérése ──────────────────────────────────────────────
export async function getLicense(uid) {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, "licenses", uid));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.log("getLicense hiba:", e.message);
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
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(db, "licenses", uid), license, { merge: true });
  return license;
}

// ── PRO aktiválás ─────────────────────────────────────────────────
export async function activatePro(uid, stripeSubscriptionId, periodEnd) {
  if (!uid) return;
  await setDoc(doc(db, "licenses", uid), {
    plan: PLANS.pro,
    stripeSubscriptionId,
    proStartedAt: Date.now(),
    proEndsAt: periodEnd,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ── Licensz státusz ───────────────────────────────────────────────
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

// ── Feature gate — null-safe ───────────────────────────────────────
export function canAddPartner(licenseStatus, currentPartnerCount) {
  if (!licenseStatus) return false;
  if (licenseStatus.plan === PLANS.pro && licenseStatus.isActive) return true;
  if (licenseStatus.plan === PLANS.trial && licenseStatus.isActive) {
    return currentPartnerCount < TRIAL_LIMITS.partners;
  }
  return false;
}

export function canAddInvoice(licenseStatus, currentInvoiceCount) {
  if (!licenseStatus) return false;
  if (licenseStatus.plan === PLANS.pro && licenseStatus.isActive) return true;
  if (licenseStatus.plan === PLANS.trial && licenseStatus.isActive) {
    return currentInvoiceCount < TRIAL_LIMITS.invoices;
  }
  return false;
}

export function canSendMessage(licenseStatus, currentMessageCount) {
  if (!licenseStatus) return false;
  if (licenseStatus.plan === PLANS.pro && licenseStatus.isActive) return true;
  if (licenseStatus.plan === PLANS.trial && licenseStatus.isActive) {
    return currentMessageCount < TRIAL_LIMITS.messages;
  }
  return false;
}

export function canExportPdf(licenseStatus, currentPdfCount) {
  if (!licenseStatus) return false;
  if (licenseStatus.plan === PLANS.pro && licenseStatus.isActive) return true;
  if (licenseStatus.plan === PLANS.trial && licenseStatus.isActive) {
    return currentPdfCount < TRIAL_LIMITS.pdfExport;
  }
  return false;
}

// ── Badge ─────────────────────────────────────────────────────────
export function getLicenseBadge(licenseStatus) {
  if (!licenseStatus) return { text: "BETÖLTÉS...", color: "#888" };
  if (licenseStatus.plan === PLANS.pro && licenseStatus.isActive) {
    return { text: "PRO", color: "#ff7a1a" };
  }
  if (licenseStatus.plan === PLANS.trial && licenseStatus.isActive) {
    return { text: `TRIAL · ${licenseStatus.daysLeft} nap`, color: "#00BCD4" };
  }
  if (licenseStatus.plan === PLANS.trial && !licenseStatus.isActive) {
    return { text: "LEJÁRT", color: "#f44336" };
  }
  return { text: "INGYENES", color: "#888" };
}
