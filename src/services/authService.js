// ─────────────────────────────────────────────────────────────────
// authService.js — AsyncStorage auth (Expo Go + EAS Build)
// A Firebase Auth JS SDK nem kompatibilis New Architecture-val
// ─────────────────────────────────────────────────────────────────
import AsyncStorage from "@react-native-async-storage/async-storage";
import { saveUserProfile } from "../../firebase";
import { startTrial } from "./licenseService";

const DEV_USER_KEY = "registless_user";
let _listeners = [];

function makeUid(email) {
  return "user-" + email.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function makeUser(email, name) {
  return {
    uid: makeUid(email),
    email,
    displayName: name || email.split("@")[0],
    emailVerified: true,
  };
}

function _notify(user) {
  _listeners.forEach(cb => cb(user));
}

export async function registerWithEmail(email, password, name) {
  const user = makeUser(email, name);
  await AsyncStorage.setItem(DEV_USER_KEY, JSON.stringify({ email, password, name }));
  await saveUserProfile(user.uid, {
    email, name: name || "", role: "seller", createdAt: Date.now(),
  }).catch(() => {});
  await startTrial(user.uid).catch(() => {});
  _notify(user);
  return user;
}

export async function loginWithEmail(email, password) {
  const raw = await AsyncStorage.getItem(DEV_USER_KEY);
  let user;
  if (raw) {
    const saved = JSON.parse(raw);
    if (saved.email === email && saved.password === password) {
      user = makeUser(email, saved.name);
    } else {
      throw new Error("Helytelen jelszó.");
    }
  } else {
    user = makeUser(email, "");
    await AsyncStorage.setItem(DEV_USER_KEY, JSON.stringify({ email, password, name: "" }));
    await saveUserProfile(user.uid, {
      email, name: "", role: "seller", createdAt: Date.now(),
    }).catch(() => {});
    await startTrial(user.uid).catch(() => {});
  }
  _notify(user);
  return user;
}

export async function resetPassword(email) {
  return Promise.resolve();
}

export async function loginWithGoogle() {
  throw new Error("Google bejelentkezés hamarosan elérhető.");
}

export async function logout() {
  await AsyncStorage.removeItem(DEV_USER_KEY);
  _notify(null);
}

export function onAuthChange(callback) {
  _listeners.push(callback);
  AsyncStorage.getItem(DEV_USER_KEY).then(raw => {
    if (raw) {
      const saved = JSON.parse(raw);
      callback(makeUser(saved.email, saved.name));
    } else {
      callback(null);
    }
  }).catch(() => callback(null));
  return () => {
    _listeners = _listeners.filter(cb => cb !== callback);
  };
}

export function getCurrentUser() {
  return null;
}
