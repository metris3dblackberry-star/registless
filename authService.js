// authService.js — AsyncStorage fake auth (Firebase-mentes)
// Registless 2026-03-22 checkpoint
import AsyncStorage from "@react-native-async-storage/async-storage";

const USERS_KEY = "registless_users";
const SESSION_KEY = "registless_session";

// ─────────────────────────────────────────────
// REGISZTRÁCIÓ
// ─────────────────────────────────────────────
export async function registerWithEmail(email, password, name) {
  try {
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

    // Jelszó nélküli session objektum visszaadása
    const { password: _pw, ...safeUser } = user;
    return safeUser;
  } catch (error) {
    throw error;
  }
}

// ─────────────────────────────────────────────
// BEJELENTKEZÉS
// ─────────────────────────────────────────────
export async function loginWithEmail(email, password) {
  try {
    const raw = await AsyncStorage.getItem(USERS_KEY);
    const users = raw ? JSON.parse(raw) : {};

    const normalizedEmail = email.toLowerCase().trim();
    const user = users[normalizedEmail];

    if (!user || user.password !== password) {
      throw new Error("Hibás email cím vagy jelszó.");
    }

    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(user));

    const { password: _pw, ...safeUser } = user;
    return safeUser;
  } catch (error) {
    throw error;
  }
}

// ─────────────────────────────────────────────
// JELSZÓ VISSZAÁLLÍTÁS (szimulált)
// ─────────────────────────────────────────────
export async function resetPassword(email) {
  // Fake implementáció — éles verzióban Firebase / SMTP
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
}
