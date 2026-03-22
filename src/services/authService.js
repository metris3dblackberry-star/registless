// ─────────────────────────────────────────────────────────────────
// authService.js — @react-native-firebase/auth
// Natív SDK — New Architecture kompatibilis
// ─────────────────────────────────────────────────────────────────
import auth from "@react-native-firebase/auth";
import { saveUserProfile } from "../../firebase";
import { startTrial } from "./licenseService";

export async function registerWithEmail(email, password, name) {
  const cred = await auth().createUserWithEmailAndPassword(email, password);
  const user = cred.user;
  if (name) await user.updateProfile({ displayName: name });
  await saveUserProfile(user.uid, {
    email: user.email, name: name || "", role: "seller", createdAt: Date.now(),
  });
  await startTrial(user.uid);
  return user;
}

export async function loginWithEmail(email, password) {
  const cred = await auth().signInWithEmailAndPassword(email, password);
  return cred.user;
}

export async function resetPassword(email) {
  await auth().sendPasswordResetEmail(email);
}

export async function loginWithGoogle() {
  throw new Error("Google bejelentkezés hamarosan elérhető.");
}

export async function logout() {
  await auth().signOut();
}

export function onAuthChange(callback) {
  return auth().onAuthStateChanged(callback);
}

export function getCurrentUser() {
  return auth().currentUser;
}
