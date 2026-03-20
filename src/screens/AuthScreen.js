// ─────────────────────────────────────────────────────────────────
// AuthScreen.js — Bejelentkezés + Regisztráció
// Email/jelszó, 14 napos trial automatikusan
// ─────────────────────────────────────────────────────────────────
import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, Alert, Image,
} from "react-native";
import { colors } from "../theme/colors";
import { shared } from "../theme/styles";
import { registerWithEmail, loginWithEmail, resetPassword } from "../services/authService";

const MODE = { LOGIN: "login", REGISTER: "register", RESET: "reset" };

export default function AuthScreen({ onSuccess, onSkip }) {
  const [mode, setMode] = useState(MODE.LOGIN);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email.trim()) { Alert.alert("Hiba", "Add meg az email címed."); return; }

    setLoading(true);
    try {
      if (mode === MODE.LOGIN) {
        if (!password) { Alert.alert("Hiba", "Add meg a jelszót."); return; }
        const result = await loginWithEmail(email.trim(), password);
        onSuccess?.(result);

      } else if (mode === MODE.REGISTER) {
        if (!password || password.length < 6) {
          Alert.alert("Hiba", "A jelszó legalább 6 karakter legyen.");
          return;
        }
        const result = await registerWithEmail(email.trim(), password, name.trim() || email.split("@")[0]);
        Alert.alert(
          "🎉 Üdvözlünk a REGISTLESS-ben!",
          "14 napos ingyenes trial aktiválva. Minden funkció elérhető."
        );
        onSuccess?.(result);

      } else if (mode === MODE.RESET) {
        await resetPassword(email.trim());
        Alert.alert("Email elküldve", "Ellenőrizd a postaládád a visszaállítási linkért.");
        setMode(MODE.LOGIN);
      }
    } catch (e) {
      const msg = e.code === "auth/user-not-found" ? "Nem található ez az email cím." :
                  e.code === "auth/wrong-password" ? "Hibás jelszó." :
                  e.code === "auth/email-already-in-use" ? "Ez az email cím már foglalt." :
                  e.code === "auth/invalid-email" ? "Érvénytelen email cím." :
                  e.message;
      Alert.alert("Hiba", msg);
    } finally {
      setLoading(false);
    }
  }

  const isRegister = mode === MODE.REGISTER;
  const isReset = mode === MODE.RESET;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bgDark }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={s.logoWrap}>
          <Text style={s.logoText}>REGISTLESS</Text>
          <Text style={s.logoSub}>Partner-központú üzleti platform</Text>
        </View>

        {/* Trial banner — csak regisztrációnál */}
        {isRegister && (
          <View style={s.trialBanner}>
            <Text style={s.trialIcon}>⏳</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.trialTitle}>14 napos ingyenes trial</Text>
              <Text style={s.trialSub}>Minden Pro funkció elérhető. Kártya nem szükséges.</Text>
            </View>
          </View>
        )}

        {/* Form */}
        <View style={s.form}>
          <Text style={s.formTitle}>
            {mode === MODE.LOGIN ? "Bejelentkezés" :
             mode === MODE.REGISTER ? "Fiók létrehozása" : "Jelszó visszaállítás"}
          </Text>

          {isRegister && (
            <>
              <Text style={shared.label}>Neved</Text>
              <TextInput
                style={shared.input}
                value={name}
                onChangeText={setName}
                placeholder="Teljes neved"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="words"
              />
            </>
          )}

          <Text style={shared.label}>Email cím</Text>
          <TextInput
            style={shared.input}
            value={email}
            onChangeText={setEmail}
            placeholder="email@example.com"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />

          {!isReset && (
            <>
              <Text style={shared.label}>Jelszó</Text>
              <TextInput
                style={shared.input}
                value={password}
                onChangeText={setPassword}
                placeholder={isRegister ? "Min. 6 karakter" : "Jelszó"}
                placeholderTextColor={colors.placeholder}
                secureTextEntry
                autoComplete={isRegister ? "new-password" : "current-password"}
              />
            </>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[shared.btnPrimary, { marginTop: 8 }, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={shared.btnTextPrimary}>
              {loading ? "⏳ Betöltés..." :
               mode === MODE.LOGIN ? "Bejelentkezés" :
               mode === MODE.REGISTER ? "🚀  Fiók létrehozása" : "Email küldése"}
            </Text>
          </TouchableOpacity>

          {/* Mode váltók */}
          {!isReset && (
            <TouchableOpacity
              style={{ marginTop: 16, alignItems: "center" }}
              onPress={() => setMode(isRegister ? MODE.LOGIN : MODE.REGISTER)}
            >
              <Text style={s.switchText}>
                {isRegister ? "Már van fiókod? Bejelentkezés" : "Nincs még fiókod? Regisztráció"}
              </Text>
            </TouchableOpacity>
          )}

          {mode === MODE.LOGIN && (
            <TouchableOpacity
              style={{ marginTop: 10, alignItems: "center" }}
              onPress={() => setMode(MODE.RESET)}
            >
              <Text style={[s.switchText, { fontSize: 13 }]}>Elfelejtett jelszó</Text>
            </TouchableOpacity>
          )}

          {isReset && (
            <TouchableOpacity
              style={{ marginTop: 16, alignItems: "center" }}
              onPress={() => setMode(MODE.LOGIN)}
            >
              <Text style={s.switchText}>Vissza a bejelentkezéshez</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Skip — ha van lehetőség */}
        {onSkip && (
          <TouchableOpacity style={s.skipBtn} onPress={onSkip}>
            <Text style={s.skipText}>Folytatás bejelentkezés nélkül</Text>
          </TouchableOpacity>
        )}

        <Text style={s.legalText}>
          A regisztrációval elfogadod a Felhasználási feltételeket és az Adatvédelmi nyilatkozatot.
          {"\n"}Powered by Star Labs Kft.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  scroll: {
    flexGrow: 1, justifyContent: "center",
    paddingHorizontal: 24, paddingVertical: 40,
  },
  logoWrap: { alignItems: "center", marginBottom: 32 },
  logoText: { color: colors.textPrimary, fontSize: 32, fontWeight: "900", letterSpacing: 2 },
  logoSub: { color: colors.textSecondary, fontSize: 14, marginTop: 6 },
  trialBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(255,152,0,0.12)",
    borderRadius: 16, padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: "rgba(255,152,0,0.3)",
  },
  trialIcon: { fontSize: 28 },
  trialTitle: { color: "#FF9800", fontSize: 14, fontWeight: "bold" },
  trialSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  form: {
    backgroundColor: colors.bgCard,
    borderRadius: 24, padding: 24,
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  formTitle: {
    color: colors.textPrimary, fontSize: 22,
    fontWeight: "bold", marginBottom: 20,
  },
  switchText: { color: colors.accent, fontSize: 14 },
  skipBtn: { marginTop: 24, alignItems: "center", padding: 12 },
  skipText: { color: colors.textSecondary, fontSize: 13 },
  legalText: {
    color: "rgba(255,255,255,0.3)", fontSize: 11,
    textAlign: "center", marginTop: 24, lineHeight: 16,
  },
});
