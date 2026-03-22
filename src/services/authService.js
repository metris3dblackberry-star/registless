// authService.js — AsyncStorage fake auth, reaktív onAuthChange
// Registless 2026-03-22
import AsyncStorage from "@react-native-async-storage/async-storage";

const USERS_KEY = "registless_users";
const SESSION_KEY = "registless_session";

// ─────────────────────────────────────────────
// BELSŐ EVENT EMITTER — reaktív auth változás
// ─────────────────────────────────────────────
const listeners = new Set();

function notifyListeners(user) {
  listeners.forEach((cb) => cb(user));
}

// ─────────────────────────────────────────────
// AUTH CHANGE LISTENER (App.js useEffect-nek)
// Firebase onAuthStateChanged-szerű viselkedés
// ─────────────────────────────────────────────
export function onAuthChange(callback) {
  // 1. Azonnal meghívja az aktuális session-nel
  AsyncStorage.getItem(SESSION_KEY)
    .then((raw) => {
      if (!raw) { callback(null); return; }
      const user = JSON.parse(raw);
      const { password: _pw, ...safeUser } = user;
      callback(safeUser);
    })
    .catch(() => callback(null));

  // 2. Feliratkozik a jövőbeli változásokra (login/register/logout)
  listeners.add(callback);

  // 3. Visszaad egy unsubscribe függvényt (App.js cleanup-nak)
  return () => listeners.delete(callback);
}

// ─────────────────────────────────────────────
// REGISZTRÁCIÓ
// ─────────────────────────────────────────────
export async function registerWithEmail(email, password, name) {
  const raw = await AsyncStorage.getItem(USERS_KEY);
  const users = raw ? JSON.parse(raw) : {};
  const normalizedEmail = email.toLowerCase().trim();

  if (users[normalizedEmail]) {
    throw new Error("Ez az email cím már regisztrált.");
  }
  if (password.length < 6) {
    throw new Error("A jelszónak legalább 6 karakter hosszúnak kell lennie.");
  }

  const user = {
    uid: `uid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    email: normalizedEmail,
    name: name || normalizedEmail.split("@")[0],
    password,
    createdAt: new Date().toISOString(),
  };

  users[normalizedEmail] = user;
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(user));

  const { password: _pw, ...safeUser } = user;
  notifyListeners(safeUser); // 🔔 App.js auth state frissül
  return safeUser;
}

// ─────────────────────────────────────────────
// BEJELENTKEZÉS
// ─────────────────────────────────────────────
export async function loginWithEmail(email, password) {
  const raw = await AsyncStorage.getItem(USERS_KEY);
  const users = raw ? JSON.parse(raw) : {};
  const normalizedEmail = email.toLowerCase().trim();
  const user = users[normalizedEmail];

  if (!user || user.password !== password) {
    throw new Error("Hibás email cím vagy jelszó.");
  }

  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(user));

  const { password: _pw, ...safeUser } = user;
  notifyListeners(safeUser); // 🔔 App.js auth state frissül
  return safeUser;
}

// ─────────────────────────────────────────────
// JELSZÓ VISSZAÁLLÍTÁS (szimulált)
// ─────────────────────────────────────────────
export async function resetPassword(email) {
  return {
    success: true,
    message: "Ha létezik a fiók, hamarosan megérkezik a visszaállító email.",
  };
}

// ─────────────────────────────────────────────
// JELENLEGI FELHASZNÁLÓ
// ─────────────────────────────────────────────
export async function getCurrentUser() {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw);
    const { password: _pw, ...safeUser } = user;
    return safeUser;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// KIJELENTKEZÉS
// ─────────────────────────────────────────────
export async function logout() {
  await AsyncStorage.removeItem(SESSION_KEY);
  notifyListeners(null); // 🔔 App.js auth state frissül
}
