// ─────────────────────────────────────────────────────────────────
// firebase.js — @react-native-firebase (natív SDK)
// New Architecture kompatibilis
// ─────────────────────────────────────────────────────────────────
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import database from "@react-native-firebase/database";

// ── Felhasználói profil ───────────────────────────────────────────
export async function saveUserProfile(uid, data) {
  if (!uid) return;
  await firestore().collection("users").doc(uid).set(
    { ...data, updatedAt: firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
}

export async function getUserProfile(uid) {
  if (!uid) return null;
  const snap = await firestore().collection("users").doc(uid).get();
  return snap.exists ? snap.data() : null;
}

// ── Channel ───────────────────────────────────────────────────────
export async function createOrGetChannel(sellerUid, buyerUid) {
  const channelId = `${sellerUid}_${buyerUid}`;
  const ref = firestore().collection("channels").doc(channelId);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      sellerUid, buyerUid,
      createdAt: firestore.FieldValue.serverTimestamp(),
      lastMessage: null, lastMessageAt: null,
    });
  }
  return channelId;
}

// ── Üzenetküldés ──────────────────────────────────────────────────
export async function sendMessage(channelId, senderUid, text, type = "text", meta = {}) {
  await firestore()
    .collection("channels").doc(channelId).collection("messages")
    .add({ senderUid, text, type, meta, sentAt: firestore.FieldValue.serverTimestamp() });
  await firestore().collection("channels").doc(channelId).update({
    lastMessage: text,
    lastMessageAt: firestore.FieldValue.serverTimestamp(),
  });
}

export function listenMessages(channelId, callback) {
  return firestore()
    .collection("channels").doc(channelId).collection("messages")
    .orderBy("sentAt", "asc")
    .onSnapshot(snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export function listenChannel(channelId, callback) {
  return firestore()
    .collection("channels").doc(channelId)
    .onSnapshot(snap => { if (snap.exists) callback(snap.data()); });
}

// ── RTDB ─────────────────────────────────────────────────────────
export const rtdb = database();

// ── Push token ────────────────────────────────────────────────────
export async function savePushToken(uid, token) {
  if (!uid || !token) return;
  await rtdb.ref(`users/${uid}/pushToken`).set(token);
}

export async function getPushToken(uid) {
  if (!uid) return null;
  const snap = await rtdb.ref(`users/${uid}/pushToken`).once("value");
  return snap.val() || null;
}

// ── Booking requests (RTDB sync) ─────────────────────────────────
// Path: bookings/{chatId}/{requestId}
// chatId = sort([uid1, uid2]).join("_") — mindkét fél ugyanazt látja
export function buildBookingChatId(uid1, uid2) {
  if (!uid1 || !uid2) return null;
  return [String(uid1), String(uid2)].sort().join("_");
}

export async function saveBookingRequest(chatId, request) {
  if (!chatId || !request?.id) return;
  await rtdb.ref(`bookings/${chatId}/${request.id}`).set({
    ...request,
    updatedAt: Date.now(),
  });
}

export function listenBookingRequests(chatId, callback) {
  if (!chatId) return () => {};
  const ref = rtdb.ref(`bookings/${chatId}`);
  const handler = ref.on("value", (snap) => {
    const raw = snap.val() || {};
    const list = Object.entries(raw).map(([id, v]) => ({ ...v, id }));
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    callback(list);
  });
  return () => { try { ref.off("value", handler); } catch {} };
}

export async function updateBookingRequestStatus(chatId, requestId, statusz, extra = {}) {
  if (!chatId || !requestId) return;
  await rtdb.ref(`bookings/${chatId}/${requestId}`).update({
    statusz,
    ...extra,
    updatedAt: Date.now(),
  });
}

export { firestore, storage, database };
