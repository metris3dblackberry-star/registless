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

// ── Push token ────────────────────────────────────────────────────
export async function savePushToken(uid, token) {
  if (!uid || !token) return;
  await firestore().collection("users").doc(uid).set(
    { pushToken: token, updatedAt: firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
}

export async function getPushToken(uid) {
  if (!uid) return null;
  const snap = await firestore().collection("users").doc(uid).get();
  return snap.exists ? snap.data()?.pushToken || null : null;
}

export { firestore, storage, database };
