// ─────────────────────────────────────────────────────────────────
// AuthScreen.js — Bejelentkezés / Regisztráció
// Email + jelszó, Google Sign-In
// ─────────────────────────────────────────────────────────────────
import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, Image,
} from "react-native";
import { colors } from "../theme/colors";
import { shared } from "../theme/styles";

export default function AuthScreen({ onAuthSuccess }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleEmailAuth() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Hiányzó adat", "Add meg az email címet és jelszót!");
      return;
    }
    if (mode === "register" && !name.trim()) {
      Alert.alert("Hiányzó adat", "Add meg a neved!");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Gyenge jelszó", "A jelszó legalább 6 karakter legyen!");
      return;
    }

    setLoading(true);
    try {
      const { loginWithEmail, registerWithEmail } = await import(
        "../services/authService"
      );
      let user;
      if (mode === "login") {
        user = await loginWithEmail(email.trim(), password);
      } else {
        user = await registerWithEmail(email.trim(), password, name.trim());
      }
      onAuthSuccess?.(user);
    } catch (e) {
      const msg = e.code === "auth/user-not-found" ? "Nem találunk ilyen felhasználót." :
                  e.code === "auth/wrong-password" ? "Helytelen jelszó." :
                  e.code === "auth/email-already-in-use" ? "Ez az email cím már foglalt." :
                  e.code === "auth/invalid-email" ? "Érvénytelen email cím." :
                  e.message || "Ismeretlen hiba";
      Alert.alert("Hiba", msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const { loginWithGoogle } = await import("../services/authService");
      const user = await loginWithGoogle();
      onAuthSuccess?.(user);
    } catch (e) {
      Alert.alert("Google bejelentkezés hiba", e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={st.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <Image
          source={require("../../assets/logo.png")}
          style={st.logo}
          resizeMode="contain"
        />
        <Text style={st.title}>REGISTLESS</Text>
        <Text style={st.subtitle}>
          {mode === "login" ? "Bejelentkezés" : "Fiók létrehozása"}
        </Text>

        {/* Form */}
        {mode === "register" && (
          <>
            <Text style={shared.label}>Neved</Text>
            <TextInput
              style={shared.input}
              value={name}
              onChangeText={setName}
              placeholder="Teljes név"
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
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={shared.label}>Jelszó</Text>
        <TextInput
          style={shared.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Minimum 6 karakter"
          placeholderTextColor={colors.placeholder}
          secureTextEntry
        />

        {/* Submit */}
        <TouchableOpacity
          style={[shared.btnPrimary, loading && { opacity: 0.6 }]}
          onPress={handleEmailAuth}
          disabled={loading}
        >
          <Text style={shared.btnTextPrimary}>
            {loading ? "⏳ Betöltés..." :
             mode === "login" ? "🔑  Bejelentkezés" : "✅  Fiók létrehozása"}
          </Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={st.divider}>
          <View style={st.dividerLine} />
          <Text style={st.dividerText}>vagy</Text>
          <View style={st.dividerLine} />
        </View>

        {/* Google */}
        <TouchableOpacity
          style={[shared.btnOutline, st.googleBtn]}
          onPress={handleGoogle}
          disabled={loading}
        >
          <Text style={st.googleIcon}>G</Text>
          <Text style={shared.btnTextSecondary}>Folytatás Google-lal</Text>
        </TouchableOpacity>

        {/* Switch mode */}
        <TouchableOpacity
          style={{ marginTop: 24, alignItems: "center" }}
          onPress={() => setMode(mode === "login" ? "register" : "login")}
        >
          <Text style={st.switchText}>
            {mode === "login"
              ? "Még nincs fiókod? Regisztrálj!"
              : "Van már fiókod? Jelentkezz be!"}
          </Text>
        </TouchableOpacity>

        {/* Trial info */}
        {mode === "register" && (
          <View style={st.trialBox}>
            <Text style={st.trialTitle}>🎉 30 napos ingyenes próba</Text>
            <Text style={st.trialText}>
              Regisztráció után azonnal hozzáférsz az összes ELADÓ funkcióhoz.{"\n"}
              Próbaidő után: 25€/hó · VEVŐ mód mindig ingyenes.
            </Text>
          </View>
        )}

        <Text style={st.footer}>
          Powered by Star Labs Kft. · All rights reserved
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
    minHeight: "100%",
  },
  logo: { width: 160, height: 80, alignSelf: "center", marginBottom: 8 },
  title: {
    color: "#fff", fontSize: 28, fontWeight: "bold",
    textAlign: "center", marginBottom: 4,
  },
  subtitle: {
    color: colors.textSecondary, fontSize: 16,
    textAlign: "center", marginBottom: 28,
  },
  divider: {
    flexDirection: "row", alignItems: "center",
    marginVertical: 20, gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.borderSubtle },
  dividerText: { color: colors.textSecondary, fontSize: 13 },
  googleBtn: { flexDirection: "row", gap: 10, justifyContent: "center" },
  googleIcon: {
    color: "#fff", fontSize: 16, fontWeight: "bold",
    backgroundColor: "#4285F4", width: 24, height: 24,
    borderRadius: 12, textAlign: "center", lineHeight: 24,
  },
  switchText: { color: colors.accent, fontSize: 14, fontWeight: "600" },
  trialBox: {
    backgroundColor: "rgba(255,122,26,0.1)",
    borderRadius: 16, padding: 16, marginTop: 24,
    borderWidth: 1, borderColor: "rgba(255,122,26,0.3)",
  },
  trialTitle: {
    color: "#ff7a1a", fontSize: 15, fontWeight: "bold", marginBottom: 6,
  },
  trialText: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  footer: {
    color: "rgba(255,255,255,0.3)", fontSize: 11,
    textAlign: "center", marginTop: 32,
  },
});
