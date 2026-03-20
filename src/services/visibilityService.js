// ─────────────────────────────────────────────────────────────────
// visibilityService.js — Profil láthatóság és kereshetőség
// Ki látható, ki rejtett, trial/pro státusz, featured
// ─────────────────────────────────────────────────────────────────
import { db } from "../../firebase";
import {
  collection, query, where, getDocs, orderBy,
  limit, GeoPoint, doc, updateDoc,
} from "firebase/firestore";
import { getEffectivePlan, canUseFeature, Plan } from "../models/accountModel";

// ── Láthatóság státusz ────────────────────────────────────────────

export const VisibilityStatus = {
  PUBLIC:   "public",    // Mindenki láthatja
  TRIAL:    "trial",     // Trial alatt — látható, de badge mutatja
  PRO:      "pro",       // Pro — kiemelt megjelenés
  HIDDEN:   "hidden",    // Manuálisan elrejtett
  EXPIRED:  "expired",   // Trial lejárt, free planra esett vissza
};

/**
 * Profil láthatóság meghatározása account + beállítások alapján
 */
export function getVisibilityStatus(account, profileSettings = {}) {
  if (!account) return VisibilityStatus.HIDDEN;
  if (!profileSettings.isPublic) return VisibilityStatus.HIDDEN;

  const plan = getEffectivePlan(account);

  if (plan === Plan.FREE) return VisibilityStatus.EXPIRED;
  if (plan === Plan.TRIAL) return VisibilityStatus.TRIAL;
  if (plan === Plan.PRO || plan === Plan.PREMIUM) return VisibilityStatus.PRO;

  return VisibilityStatus.HIDDEN;
}

export const VISIBILITY_CONFIG = {
  [VisibilityStatus.PUBLIC]:  { icon: "🌐", label: "Publikus",  color: "#4CAF50" },
  [VisibilityStatus.TRIAL]:   { icon: "⏳", label: "Trial",    color: "#FF9800" },
  [VisibilityStatus.PRO]:     { icon: "⚡", label: "Pro",      color: "#2196F3" },
  [VisibilityStatus.HIDDEN]:  { icon: "🔒", label: "Rejtett",  color: "#888" },
  [VisibilityStatus.EXPIRED]: { icon: "⛔", label: "Lejárt",   color: "#f44336" },
};

/**
 * Láthatóság frissítése Firestore-ban
 */
export async function updateVisibility(uid, { isPublic, isSearchable }) {
  if (!uid) return;
  await updateDoc(doc(db, "publicProfiles", uid), {
    isPublic: !!isPublic,
    isSearchable: !!isSearchable,
    updatedAt: new Date().toISOString(),
  });
  await updateDoc(doc(db, "accounts", uid), {
    isPublic: !!isPublic,
    isSearchable: !!isSearchable,
  });
}

// ── Discovery keresés ─────────────────────────────────────────────

/**
 * Kereshető szolgáltatók lekérése
 * Szűrők: kategória, city, plan badge, van-e videó
 */
export async function searchProviders({
  category = null,
  city = null,
  hasVideos = false,
  onlyPro = false,
  limitCount = 20,
} = {}) {
  try {
    let q = query(
      collection(db, "publicProfiles"),
      where("isPublic", "==", true),
      where("isSearchable", "==", true),
      limit(limitCount)
    );

    const snap = await getDocs(q);
    let results = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));

    // Kliens oldali szűrés (Firestore compound index nélkül)
    if (category) {
      results = results.filter((p) =>
        (p.categories || []).some((c) =>
          c.toLowerCase().includes(category.toLowerCase())
        )
      );
    }
    if (city) {
      results = results.filter((p) =>
        (p.city || "").toLowerCase().includes(city.toLowerCase())
      );
    }
    if (hasVideos) {
      results = results.filter((p) => (p.videos || []).length > 0);
    }

    return results;
  } catch (e) {
    console.log("searchProviders error:", e);
    return [];
  }
}

/**
 * Nyitva van-e most?
 */
export function isOpenNow(openingHours) {
  if (!openingHours) return null;
  const now = new Date();
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const dayKey = days[now.getDay()];
  const hours = openingHours[dayKey];
  if (!hours || hours.closed) return false;
  const [openH, openM] = (hours.open || "00:00").split(":").map(Number);
  const [closeH, closeM] = (hours.close || "00:00").split(":").map(Number);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const openMin = openH * 60 + openM;
  const closeMin = closeH * 60 + closeM;
  return nowMin >= openMin && nowMin < closeMin;
}
