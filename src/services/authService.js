// authService.js — Firebase Auth email/jelszó
// @react-native-firebase/auth
import auth from "@react-native-firebase/auth";

export function onAuthChange(callback) {
  return auth().onAuthStateChanged((user) => {
    callback(user ? {
      uid:          user.uid,
      email:        user.email,
      displayName:  user.displayName,
      emailVerified: user.emailVerified,
    } : null);
  });
}

export async function registerWithEmail(email, password, name) {
  const cred = await auth().createUserWithEmailAndPassword(email.trim(), password);
  if (name) await cred.user.updateProfile({ displayName: name });
  return {
    uid:         cred.user.uid,
    email:       cred.user.email,
    displayName: name || email.split("@")[0],
  };
}

export async function loginWithEmail(email, password) {
  const cred = await auth().signInWithEmailAndPassword(email.trim(), password);
  return {
    uid:         cred.user.uid,
    email:       cred.user.email,
    displayName: cred.user.displayName,
  };
}

export async function resetPassword(email) {
  await auth().sendPasswordResetEmail(email.trim());
  return { success: true };
}

export async function getCurrentUser() {
  const user = auth().currentUser;
  if (!user) return null;
  return { uid: user.uid, email: user.email, displayName: user.displayName };
}

export async function logout() {
  await auth().signOut();
}
