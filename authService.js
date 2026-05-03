// authService.js — Firebase Auth (Email/Password + Google)
// @react-native-firebase/auth + @react-native-google-signin/google-signin
import auth from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";

// Google Sign-In inicializálás — web client ID a Firebase konzolból
// Project Settings → Your apps → Web app → Client ID
GoogleSignin.configure({
  webClientId: "27530670886-hgscl3u1o49cetbf8p9ehkct5e4g2eih.apps.googleusercontent.com", // ← cseréld ki!
});

// ── Auth state listener ───────────────────────────────────────────
export function onAuthChange(callback) {
  return auth().onAuthStateChanged((user) => {
    callback(user ? {
      uid:          user.uid,
      email:        user.email,
      displayName:  user.displayName,
      photoURL:     user.photoURL,
      emailVerified: user.emailVerified,
    } : null);
  });
}

// ── Email + jelszó regisztráció ───────────────────────────────────
export async function registerWithEmail(email, password, name) {
  const cred = await auth().createUserWithEmailAndPassword(email.trim(), password);
  if (name) await cred.user.updateProfile({ displayName: name });
  return {
    uid:         cred.user.uid,
    email:       cred.user.email,
    displayName: name || email.split("@")[0],
  };
}

// ── Email + jelszó bejelentkezés ──────────────────────────────────
export async function loginWithEmail(email, password) {
  const cred = await auth().signInWithEmailAndPassword(email.trim(), password);
  return {
    uid:         cred.user.uid,
    email:       cred.user.email,
    displayName: cred.user.displayName,
  };
}

// ── Google bejelentkezés ──────────────────────────────────────────
export async function loginWithGoogle() {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const { data } = await GoogleSignin.signIn();
  const googleCred = auth.GoogleAuthProvider.credential(data.idToken);
  const cred = await auth().signInWithCredential(googleCred);
  return {
    uid:         cred.user.uid,
    email:       cred.user.email,
    displayName: cred.user.displayName,
    photoURL:    cred.user.photoURL,
  };
}

// ── Jelszó visszaállítás ──────────────────────────────────────────
export async function resetPassword(email) {
  await auth().sendPasswordResetEmail(email.trim());
  return { success: true };
}

// ── Jelenlegi felhasználó ─────────────────────────────────────────
export async function getCurrentUser() {
  const user = auth().currentUser;
  if (!user) return null;
  return {
    uid:         user.uid,
    email:       user.email,
    displayName: user.displayName,
  };
}

// ── Kijelentkezés ─────────────────────────────────────────────────
export async function logout() {
  try { await GoogleSignin.signOut(); } catch {}
  await auth().signOut();
}
