// ─────────────────────────────────────────────────────────────────
// firebase.js  –  Registless Firebase helper
// ─────────────────────────────────────────────────────────────────
// Csere előtt: hozz létre egy Firebase projektet a console.firebase.google.com-on,
// majd add meg az alábbi adatokat a saját projekt beállításaiból.
// ─────────────────────────────────────────────────────────────────

import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  addDoc,
  query,
  orderBy,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

// ── Firebase konfiguráció – cseréld le a saját adataiddal! ────────
const firebaseConfig = {
  apiKey:            "AIzaSyDGuEn0AVRtEfXI_1P3MTIDxTl7RFID9Wo",
  authDomain:        "registless.firebaseapp.com",
  projectId:         "registless",
  storageBucket:     "registless.firebasestorage.app",
  messagingSenderId: "27530670886",
  appId:             "1:27530670886:web:45d855b605edbd057807e7",
  measurementId:     "G-F0JQ1BZ73R",
};
// ─────────────────────────────────────────────────────────────────

// Csak egyszer inicializálunk
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db  = getFirestore(app);
const storage = getStorage(app);

// ─────────────────────────────────────────────────────────────────
// FELHASZNÁLÓI PROFIL
// ─────────────────────────────────────────────────────────────────

/**
 * Registless user profil mentése a Firestore-ba.
 * @param {string} uid  – AsyncStorage-ból érkező egyedi ID
 * @param {object} data – { role, name, company, address, taxNumber, bankAccount, email }
 */
export async function saveUserProfile(uid, data) {
  if (!uid) return;
  const ref = doc(db, "users", uid);
  await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

/**
 * Felhasználói profil lekérése UID alapján.
 */
export async function getUserProfile(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

// ─────────────────────────────────────────────────────────────────
// KAPCSOLAT (CHANNEL)
// ─────────────────────────────────────────────────────────────────

/**
 * Kapcsolat (channel) létrehozása eladó és vevő között.
 * Idempotens: ha már létezik, visszaadja a meglévőt.
 * channelId = sellerUid + "_" + buyerUid
 */
export async function createOrGetChannel(sellerUid, buyerUid) {
  const channelId = `${sellerUid}_${buyerUid}`;
  const ref = doc(db, "channels", channelId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      sellerUid,
      buyerUid,
      createdAt: serverTimestamp(),
      lastMessage: null,
      lastMessageAt: null,
    });
  }
  return channelId;
}

// ─────────────────────────────────────────────────────────────────
// ÜZENETKÜLDÉS
// ─────────────────────────────────────────────────────────────────

/**
 * Üzenet küldése egy channelbe.
 * @param {string} channelId
 * @param {string} senderUid
 * @param {string} text
 * @param {string} type  – "text" | "invoice" | "pdf"
 * @param {object} meta  – pl. { invoiceId, pdfUrl }
 */
export async function sendMessage(channelId, senderUid, text, type = "text", meta = {}) {
  const messagesRef = collection(db, "channels", channelId, "messages");
  await addDoc(messagesRef, {
    senderUid,
    text,
    type,
    meta,
    sentAt: serverTimestamp(),
  });
  // Frissítjük a channel lastMessage mezőjét
  await updateDoc(doc(db, "channels", channelId), {
    lastMessage: text,
    lastMessageAt: serverTimestamp(),
  });
}

/**
 * Valós idejű üzenet-figyelő.
 * @returns unsubscribe függvény
 */
export function listenMessages(channelId, callback) {
  const q = query(
    collection(db, "channels", channelId, "messages"),
    orderBy("sentAt", "asc")
  );
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(msgs);
  });
}

// ─────────────────────────────────────────────────────────────────
// SZÁMLA KÜLDÉS
// ─────────────────────────────────────────────────────────────────

/**
 * PDF buffer feltöltése Firebase Storage-ba, majd az URL küldése üzenetként.
 * @param {string} channelId
 * @param {string} senderUid
 * @param {Uint8Array|Blob} pdfData
 * @param {string} invoiceId
 */
export async function sendInvoicePdf(channelId, senderUid, pdfData, invoiceId) {
  const path = `invoices/${channelId}/${invoiceId}.pdf`;
  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, pdfData);
  const url = await getDownloadURL(fileRef);

  await sendMessage(
    channelId,
    senderUid,
    `📄 Számla: ${invoiceId}`,
    "invoice",
    { invoiceId, pdfUrl: url }
  );
  return url;
}

/**
 * Valós idejű channel-figyelő (pl. új számla értesítés).
 * @returns unsubscribe függvény
 */
export function listenChannel(channelId, callback) {
  return onSnapshot(doc(db, "channels", channelId), (snap) => {
    if (snap.exists()) callback(snap.data());
  });
}

export { db, storage };
