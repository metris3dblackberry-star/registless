// ─────────────────────────────────────────────────────────────────
// authService.js — EAS Build ready (Firebase Auth)
// ─────────────────────────────────────────────────────────────────
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import { auth } from "../../firebase";
import { saveUserProfile } from "../../firebase";
import { startTrial } from "./licenseService";
import { initKeyPair } from "./cryptoService";

export async function registerWithEmail(email, password, name) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const user = cred.user;
  if (name) await updateProfile(user, { displayName: name });
  await saveUserProfile(user.uid, {
    email: user.email, name: name || "", role: "seller", createdAt: Date.now(),
  });
  await startTrial(user.uid);
  await initKeyPair(user.uid);
  return user;
}

export async function loginWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  await initKeyPair(cred.user.uid);
  return cred.user;
}

export async function loginWithGoogle() {
  throw new Error("Google bejelentkezés hamarosan elérhető.");
}

export async function logout() {
  await signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser() {
  return auth.currentUser;
}
