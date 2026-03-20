// ─────────────────────────────────────────────────────────────────
// profileService.js — Profil kezelés
// Firebase Storage: profilkép, borítókép, portfolio képek
// YouTube: embed URL generálás, video ID kinyerés
// ─────────────────────────────────────────────────────────────────
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db } from "../../firebase";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";

const storage = getStorage();

// ── YouTube utils ─────────────────────────────────────────────────

/**
 * YouTube video ID kinyerése bármilyen YouTube URL-ből
 * Támogatott formátumok:
 *   https://www.youtube.com/watch?v=VIDEO_ID
 *   https://youtu.be/VIDEO_ID
 *   https://www.youtube.com/embed/VIDEO_ID
 *   https://youtube.com/shorts/VIDEO_ID
 */
export function extractYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([A-Za-z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * YouTube embed URL generálása — tiszta lejátszó, nincs YouTube branding
 */
export function buildEmbedUrl(videoIdOrUrl) {
  const id = videoIdOrUrl?.length === 11
    ? videoIdOrUrl
    : extractYouTubeId(videoIdOrUrl);
  if (!id) return null;
  return `https://www.youtube.com/embed/${id}?autoplay=0&showinfo=0&controls=1&modestbranding=1&rel=0&fs=1&color=white`;
}

/**
 * YouTube thumbnail URL
 */
export function getYouTubeThumbnail(videoIdOrUrl) {
  const id = videoIdOrUrl?.length === 11
    ? videoIdOrUrl
    : extractYouTubeId(videoIdOrUrl);
  if (!id) return null;
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

// ── Firebase Storage upload ───────────────────────────────────────

/**
 * Kép feltöltése Firebase Storage-ba
 * @param {string} uid — seller UID
 * @param {string} type — "avatar" | "cover" | "portfolio"
 * @param {string} imageUri — lokális URI
 * @param {string} filename — opcionális fájlnév
 * @returns {Promise<string>} download URL
 */
export async function uploadImage(uid, type, imageUri, filename = null) {
  const name = filename || `${type}_${Date.now()}.jpg`;
  const path = `users/${uid}/${type}/${name}`;
  const storageRef = ref(storage, path);

  const response = await fetch(imageUri);
  const blob = await response.blob();
  await uploadBytes(storageRef, blob);
  return await getDownloadURL(storageRef);
}

/**
 * Kép törlése Storage-ból
 */
export async function deleteImage(uid, type, filename) {
  const path = `users/${uid}/${type}/${filename}`;
  const storageRef = ref(storage, path);
  await deleteObject(storageRef).catch(() => {});
}

// ── Firestore profil mentés ───────────────────────────────────────

/**
 * Teljes seller profil mentése Firestore-ba
 * (publikusan olvasható a partner számára is)
 */
export async function savePublicProfile(uid, profile) {
  if (!uid) return;
  const ref = doc(db, "publicProfiles", uid);
  await setDoc(ref, {
    ...profile,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

/**
 * Publikus profil lekérése UID alapján
 */
export async function getPublicProfile(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, "publicProfiles", uid));
  return snap.exists() ? snap.data() : null;
}

// ── Default profil struktúra ──────────────────────────────────────

export function createDefaultProfile(sellerData = {}) {
  return {
    // Alap adatok
    name: sellerData.name || "",
    company: sellerData.company || "",
    address: sellerData.address || "",
    email: sellerData.email || "",
    phone: sellerData.phone || "",
    taxNumber: sellerData.taxNumber || "",
    bankAccount: sellerData.bankAccount || "",

    // Publikus profil
    bio: "",
    categories: [],        // ["Személyi edző", "Masszőr", ...]
    avatarUrl: null,
    coverUrl: null,

    // Portfolio képek (Firebase Storage URL-ek)
    portfolioImages: [],   // [{ url, caption, uploadedAt }]

    // YouTube videók (max 5)
    videos: [],            // [{ youtubeUrl, title, description }]

    // Elérhetőség
    website: "",
    instagram: "",
    facebook: "",

    // Helyszín
    city: "",
    country: "Magyarország",

    // Nyitvatartás
    openingHours: {
      mon: { open: "09:00", close: "18:00", closed: false },
      tue: { open: "09:00", close: "18:00", closed: false },
      wed: { open: "09:00", close: "18:00", closed: false },
      thu: { open: "09:00", close: "18:00", closed: false },
      fri: { open: "09:00", close: "18:00", closed: false },
      sat: { open: "10:00", close: "14:00", closed: false },
      sun: { open: "", close: "", closed: true },
    },

    // Árkategória
    priceRange: "medium",  // "budget" | "medium" | "premium"

    // Meta
    isPublic: true,
    createdAt: new Date().toISOString(),
  };
}
