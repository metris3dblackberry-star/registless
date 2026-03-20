// ─────────────────────────────────────────────────────────────────
// accountModel.js — User account + plan + permissions
// ─────────────────────────────────────────────────────────────────

export const Plan = {
  FREE:    "free",
  TRIAL:   "trial",
  PRO:     "pro",
  PREMIUM: "premium",
};

export const TRIAL_DAYS = 14;

// ── Plan limits ───────────────────────────────────────────────────
export const PLAN_LIMITS = {
  [Plan.FREE]: {
    maxContacts:     5,
    maxInvoices:     10,
    maxVideos:       0,
    maxPortfolioImages: 0,
    canPublicProfile:   false,
    canChat:            false,
    canSearch:          false,
    canCustomBranding:  false,
    canAnalytics:       false,
  },
  [Plan.TRIAL]: {
    maxContacts:     999,
    maxInvoices:     999,
    maxVideos:       5,
    maxPortfolioImages: 10,
    canPublicProfile:   true,
    canChat:            true,
    canSearch:          true,
    canCustomBranding:  false,
    canAnalytics:       false,
  },
  [Plan.PRO]: {
    maxContacts:     999,
    maxInvoices:     999,
    maxVideos:       5,
    maxPortfolioImages: 10,
    canPublicProfile:   true,
    canChat:            true,
    canSearch:          true,
    canCustomBranding:  true,
    canAnalytics:       true,
  },
  [Plan.PREMIUM]: {
    maxContacts:     999,
    maxInvoices:     999,
    maxVideos:       10,
    maxPortfolioImages: 20,
    canPublicProfile:   true,
    canChat:            true,
    canSearch:          true,
    canCustomBranding:  true,
    canAnalytics:       true,
    isVerified:         true,
    isFeatured:         true,
  },
};

// ── Account factory ───────────────────────────────────────────────
export function createAccount({
  uid,
  email = "",
  displayName = "",
  plan = Plan.TRIAL,
  trialEndsAt = Date.now() + TRIAL_DAYS * 86400000,
} = {}) {
  return {
    uid,
    email,
    displayName,
    plan,
    trialEndsAt,
    isVerified: false,
    isPublic: true,
    isSearchable: true,
    referralCode: generateReferralCode(uid),
    referredBy: null,
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  };
}

function generateReferralCode(uid = "") {
  return "RL-" + (uid.slice(-6) || Math.random().toString(36).slice(2, 8)).toUpperCase();
}

// ── Plan helpers ──────────────────────────────────────────────────
export function isTrialActive(account) {
  if (!account) return false;
  if (account.plan === Plan.TRIAL) {
    return Date.now() < (account.trialEndsAt || 0);
  }
  return false;
}

export function trialDaysLeft(account) {
  if (!isTrialActive(account)) return 0;
  return Math.max(0, Math.ceil((account.trialEndsAt - Date.now()) / 86400000));
}

export function getEffectivePlan(account) {
  if (!account) return Plan.FREE;
  if (account.plan === Plan.TRIAL && !isTrialActive(account)) return Plan.FREE;
  return account.plan;
}

export function getPermissions(account) {
  const plan = getEffectivePlan(account);
  return PLAN_LIMITS[plan] || PLAN_LIMITS[Plan.FREE];
}

export function canUseFeature(account, feature) {
  const perms = getPermissions(account);
  return !!perms[feature];
}

// ── Plan display ──────────────────────────────────────────────────
export const PLAN_DISPLAY = {
  [Plan.FREE]:    { label: "Ingyenes", color: "#888",    icon: "🔓" },
  [Plan.TRIAL]:   { label: "Trial",    color: "#FF9800", icon: "⏳" },
  [Plan.PRO]:     { label: "Pro",      color: "#2196F3", icon: "⚡" },
  [Plan.PREMIUM]: { label: "Prémium",  color: "#FFD700", icon: "👑" },
};
