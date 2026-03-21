// ─────────────────────────────────────────────────────────────────
// firebase.js — EAS Build ready
// ─────────────────────────────────────────────────────────────────
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore, collection, doc, setDoc, getDoc,
  onSnapshot, addDoc, query, orderBy, serverTimestamp, updateDoc,
} from "firebase/firestore";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { initializeAuth, getReactNativePersistence, getAuth } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey:            "AIzaSyDGuEn0AVRtEfXI_1P3MTIDxTl7RFID9Wo",
  authDomain:        "registless.firebaseapp.com",
  databaseURL:       "https://registless-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "registless",
  storageBucket:     "registless.firebasestorage.app",
  messagingSenderId: "27530670886",
  appId:             "1:27530670886:web:45d855b605edbd057807e7",
  measurementId:     "G-F0JQ1BZ73R",
};

let app, auth;
if (getApps().length === 0) {
  app  = initializeApp(firebaseConfig);
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} else {
  app  = getApp();
  auth = getAuth(app);
}

const db      = getFirestore(app);
const storage = getStorage(app);
const rtdb    = getDatabase(app);

export async function saveUserProfile(uid, data) {
  if (!uid) return;
  await setDoc(doc(db, "users", uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

export async function getUserProfile(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export async function createOrGetChannel(sellerUid, buyerUid) {
  const channelId = `${sellerUid}_${buyerUid}`;
  const ref = doc(db, "channels", channelId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { sellerUid, buyerUid, createdAt: serverTimestamp(), lastMessage: null, lastMessageAt: null });
  }
  return channelId;
}

export async function sendMessage(channelId, senderUid, text, type = "text", meta = {}) {
  await addDoc(collection(db, "channels", channelId, "messages"), { senderUid, text, type, meta, sentAt: serverTimestamp() });
  await updateDoc(doc(db, "channels", channelId), { lastMessage: text, lastMessageAt: serverTimestamp() });
}

export function listenMessages(channelId, callback) {
  const q = query(collection(db, "channels", channelId, "messages"), orderBy("sentAt", "asc"));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export function listenChannel(channelId, callback) {
  return onSnapshot(doc(db, "channels", channelId), (snap) => { if (snap.exists()) callback(snap.data()); });
}

export async function savePushToken(uid, token) {
  if (!uid || !token) return;
  await setDoc(doc(db, "users", uid), { pushToken: token, updatedAt: serverTimestamp() }, { merge: true });
}

export async function getPushToken(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data()?.pushToken || null : null;
}

export { db, storage, auth, rtdb };
