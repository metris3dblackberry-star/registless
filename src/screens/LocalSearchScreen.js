// ─────────────────────────────────────────────────────────────────
// LocalSearchScreen.js — Helyi szolgáltató keresés
// GPS + Claude AI + WhatsApp/Viber/SMS + 18 találat + 7km
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, Alert, Linking,
  ActivityIndicator,
} from "react-native";
import * as Location from "expo-location";

const CATEGORIES = [
  "Fodrász", "Körmös", "Masszőr", "Személyi edző",
  "Edzőterem", "Étterem", "Cukrászda", "Pékség",
  "Kazánszerelő", "Autószerelő", "Villanyszerelő",
  "Vízszerelő", "Kertész", "Festő", "Ács",
  "Fogorvos", "Szemész", "Gyógytornász", "Pszichológus",
  "Könyvelő", "Ügyvéd", "Ingatlanközvetítő",
];

const CATEGORY_EMOJI = {
  "Fodrász": "✂️", "Körmös": "💅", "Masszőr": "💆", "Személyi edző": "🏋️",
  "Edzőterem": "🏋️", "Étterem": "🍽️", "Cukrászda": "🍰", "Pékség": "🥐",
  "Kazánszerelő": "🔧", "Autószerelő": "🚗", "Villanyszerelő": "⚡",
  "Vízszerelő": "🚿", "Kertész": "🌿", "Festő": "🎨", "Ács": "🪚",
  "Fogorvos": "🦷", "Szemész": "👁️", "Gyógytornász": "🏥", "Pszichológus": "🧠",
  "Könyvelő": "📊", "Ügyvéd": "⚖️", "Ingatlanközvetítő": "🏠",
};

const PROXY_URL = "https://ocranalyze-y4fietykka-uc.a.run.app";
const RADIUS_KM = 7;
const RESULT_COUNT = 18;

async function searchWithAI(query, lat, lon) {
  const res = await fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "search",
      query,
      lat,
      lon,
      radius: RADIUS_KM,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (Array.isArray(data)) return data;
  throw new Error("Érvénytelen válasz");
}

// WhatsApp / SMS — Viber nem támogat előre kitöltött szöveget
function sendMessage(phone, name) {
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, "");
  const intlPhone = cleanPhone.startsWith("06")
    ? "+36" + cleanPhone.slice(2)
    : cleanPhone;
  const msgText = `Üdvözlöm! Időpontot szeretnék foglalni Önnél. Mikor van szabad helye a következő napokban? Köszönettel. (Registless app - www.registless.ai)`;
  const msgEncoded = encodeURIComponent(msgText);

  Alert.alert(
    "Üzenet küldése",
    `${name || phone}`,
    [
      {
        text: "💚 WhatsApp",
        onPress: () => Linking.openURL(`https://wa.me/${intlPhone.replace("+", "")}?text=${msgEncoded}`)
          .catch(() => Alert.alert("WhatsApp nem elérhető", "Nincs telepítve a WhatsApp.")),
      },
      {
        text: "💬 SMS",
        onPress: () => {
          // smsto: séma jobban működik Google Messages-szel
          const smsUrl = `smsto:${cleanPhone}?body=${msgEncoded}`;
          Linking.openURL(smsUrl).catch(() =>
            Linking.openURL(`sms:${cleanPhone}?body=${msgEncoded}`).catch(() =>
              Alert.alert("Hiba", "Nem sikerült az SMS app megnyitása.")
            )
          );
        },
      },
      {
        text: "💜 Viber",
        onPress: () => Linking.openURL(`viber://chat?number=${intlPhone}`)
          .catch(() => Alert.alert("Viber nem elérhető", "Nincs telepítve a Viber.")),
      },
      { text: "Mégse", style: "cancel" },
    ]
  );
}

function renderStars(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  return "★".repeat(full) + (half ? "½" : "") + "☆".repeat(5 - full - (half ? 1 : 0));
}

export default function LocalSearchScreen({ contacts = [], onBack, onBooking }) {
  const [query, setQuery]         = useState("");
  const [results, setResults]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [location, setLocation]   = useState(null);
  const [locationError, setLocationError] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setLocationError(true); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation(loc.coords);
    })();
  }, []);

  async function handleSearch(searchQuery) {
    const q = (searchQuery || query).trim();
    if (!q) return;
    if (!location) {
      Alert.alert("GPS szükséges", "Engedélyezd a helymeghatározást a kereséshez!");
      return;
    }
    setLoading(true);
    setResults([]);
    try {
      const all = await searchWithAI(q, location.latitude, location.longitude);

      const enhanced = all.map(r => {
        const rc = contacts.find(c =>
          c.name?.toLowerCase().includes(r.name?.toLowerCase()) ||
          r.name?.toLowerCase().includes(c.name?.toLowerCase())
        );
        return { ...r, isRegistless: !!rc, registlessContact: rc };
      });
      enhanced.sort((a, b) => (b.isRegistless ? 1 : 0) - (a.isRegistless ? 1 : 0));
      setResults(enhanced);
    } catch (e) {
      Alert.alert("Hiba", "Keresés sikertelen: " + e.message);
    }
    setLoading(false);
  }

  function handleCall(phone, name) {
    Alert.alert(
      name || "Kapcsolatfelvétel", phone,
      [
        { text: "📞 Hívás", onPress: () => Linking.openURL(`tel:${phone.replace(/\s/g, "")}`) },
        { text: "💬 Üzenet (WA/Viber/SMS)", onPress: () => sendMessage(phone, name) },
        { text: "Mégse", style: "cancel" },
      ]
    );
  }

  function handleMaps(address, useWaze = false) {
    const encoded = encodeURIComponent(address);
    if (useWaze) {
      Linking.openURL(`waze://?q=${encoded}`).catch(() =>
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encoded}`)
      );
    } else {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encoded}`);
    }
  }

  const emoji = CATEGORY_EMOJI[query] || "🔍";

  return (
    <View style={st.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">

        <View style={st.header}>
          <Text style={st.title}>🔍 Helyi Keresés</Text>
          <Text style={st.subtitle}>Találd meg a legjobb szolgáltatókat {RADIUS_KM} km-en belül</Text>
        </View>

        {locationError && (
          <View style={st.gpsWarn}>
            <Text style={{ color: "#FF9800", fontSize: 13 }}>⚠️ GPS nem elérhető</Text>
            <TouchableOpacity onPress={() => Linking.openSettings()}>
              <Text style={{ color: "#ff7a1a", fontSize: 12, marginTop: 4 }}>Beállítások megnyitása →</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={st.searchWrap}>
          <TextInput
            style={st.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="pl. fodrász, autószerelő, masszőr..."
            placeholderTextColor="#555"
            onSubmitEditing={() => handleSearch()}
            returnKeyType="search"
          />
          <TouchableOpacity style={[st.searchBtn, loading && { opacity: 0.5 }]} onPress={() => handleSearch()} disabled={loading}>
            {loading
              ? <ActivityIndicator size="small" color="#000" />
              : <Text style={{ color: "#000", fontWeight: "bold", fontSize: 16 }}>→</Text>
            }
          </TouchableOpacity>
        </View>

        <View style={st.catGrid}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[st.catBtn, query === cat && st.catBtnActive]}
              onPress={() => { setQuery(cat); handleSearch(cat); }}
            >
              <Text style={[st.catText, query === cat && { color: "#000" }]}>
                {CATEGORY_EMOJI[cat] || ""} {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {results.length > 0 && (
          <View style={st.results}>
            <View style={st.aiLabel}>
              <Text style={st.aiLabelText}>✨ Claude AI keresés eredménye</Text>
              <Text style={st.aiLabelSub}>{results.length} találat · {query} · {RADIUS_KM} km</Text>
            </View>

            {results.map((r, i) => (
              <View key={i} style={[st.card, r.isRegistless && st.cardRegistless]}>

                {r.isRegistless && (
                  <View style={st.registlessBadge}>
                    <Text style={st.registlessBadgeText}>✦ Registless</Text>
                  </View>
                )}

                {/* Emoji thumbnail helyettesítő */}
                <View style={st.cardTop}>
                  <View style={st.thumbPlaceholder}>
                    <Text style={{ fontSize: 28 }}>{emoji}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={st.cardName}>{r.name}</Text>
                    <Text style={st.cardType}>{r.type} · {r.distance}</Text>
                    <View style={st.ratingWrap}>
                      <Text style={st.ratingStars}>{renderStars(r.rating || 4)}</Text>
                      <Text style={st.ratingNum}> {r.rating}</Text>
                    </View>
                  </View>
                </View>

                {r.description && <Text style={st.cardDesc}>{r.description}</Text>}

                <View style={st.addressRow}>
                  <Text style={st.cardAddress} numberOfLines={1}>📍 {r.address}</Text>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <TouchableOpacity style={st.mapBtn} onPress={() => handleMaps(r.address, false)}>
                      <Text style={st.mapBtnText}>Maps</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[st.mapBtn, { borderColor: "#00BCD4" }]} onPress={() => handleMaps(r.address, true)}>
                      <Text style={[st.mapBtnText, { color: "#00BCD4" }]}>Waze</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={st.cardActions}>
                  {r.phone && (
                    <TouchableOpacity style={st.actionBtn} onPress={() => handleCall(r.phone, r.name)}>
                      <Text style={st.actionBtnText}>📞 {r.phone}</Text>
                    </TouchableOpacity>
                  )}
                  {r.phone && (
                    <TouchableOpacity style={[st.actionBtn, { borderColor: "#25D366" }]} onPress={() => sendMessage(r.phone, r.name)}>
                      <Text style={[st.actionBtnText, { color: "#25D366" }]}>💬 Üzenet időpontért</Text>
                    </TouchableOpacity>
                  )}
                  {r.isRegistless && r.registlessContact && (
                    <TouchableOpacity
                      style={[st.actionBtn, { borderColor: "#ff7a1a", backgroundColor: "rgba(255,122,26,0.1)" }]}
                      onPress={() => onBooking?.(r.registlessContact)}
                    >
                      <Text style={[st.actionBtnText, { color: "#ff7a1a" }]}>📅 Időpontfoglalás</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {!loading && results.length === 0 && (
          <View style={st.emptyState}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🗺️</Text>
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "bold", textAlign: "center" }}>
              Találd meg a körülötted lévő szolgáltatókat
            </Text>
            <Text style={{ color: "#888", fontSize: 14, textAlign: "center", marginTop: 8 }}>
              Írj be egy szakmát vagy válassz a kategóriák közül
            </Text>
            <Text style={{ color: "#555", fontSize: 12, textAlign: "center", marginTop: 12 }}>
              ✨ Claude AI alapú helyi keresés
            </Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={st.backBtn} onPress={onBack}>
        <Text style={{ color: "#ff7a1a", fontSize: 15, fontWeight: "600" }}>← Vissza</Text>
      </TouchableOpacity>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: "transparent", paddingTop: 52, paddingHorizontal: 16 },
  header: { marginBottom: 16 },
  title: { color: "#fff", fontSize: 26, fontWeight: "bold" },
  subtitle: { color: "#888", fontSize: 13, marginTop: 4 },
  gpsWarn: { backgroundColor: "rgba(255,152,0,0.1)", borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "rgba(255,152,0,0.3)" },
  searchWrap: { flexDirection: "row", gap: 8, marginBottom: 12 },
  searchInput: { flex: 1, backgroundColor: "rgba(20,20,20,0.8)", borderRadius: 14, padding: 14, color: "#fff", fontSize: 15, borderWidth: 1, borderColor: "#333" },
  searchBtn: { backgroundColor: "#ff7a1a", borderRadius: 14, width: 50, alignItems: "center", justifyContent: "center" },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  catBtn: { backgroundColor: "rgba(20,20,20,0.7)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: "#333" },
  catBtnActive: { backgroundColor: "#ff7a1a", borderColor: "#ff7a1a" },
  catText: { color: "#ccc", fontSize: 12 },
  results: { gap: 12 },
  aiLabel: { backgroundColor: "rgba(100,60,200,0.15)", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "rgba(150,100,255,0.3)", marginBottom: 4 },
  aiLabelText: { color: "#b39ddb", fontSize: 13, fontWeight: "700" },
  aiLabelSub: { color: "#888", fontSize: 11, marginTop: 2 },
  card: { backgroundColor: "rgba(20,20,20,0.8)", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#2a2a2a" },
  cardRegistless: { borderColor: "rgba(255,122,26,0.5)", backgroundColor: "rgba(255,122,26,0.05)" },
  registlessBadge: { backgroundColor: "rgba(255,122,26,0.15)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start", marginBottom: 8, borderWidth: 1, borderColor: "rgba(255,122,26,0.3)" },
  registlessBadgeText: { color: "#ff7a1a", fontSize: 11, fontWeight: "bold" },
  cardTop: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  thumbPlaceholder: { width: 56, height: 56, borderRadius: 14, backgroundColor: "rgba(255,122,26,0.1)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,122,26,0.2)" },
  cardName: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  cardType: { color: "#888", fontSize: 12, marginTop: 2 },
  ratingWrap: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  ratingStars: { color: "#FFD700", fontSize: 12 },
  ratingNum: { color: "#888", fontSize: 11 },
  cardDesc: { color: "#aaa", fontSize: 13, marginBottom: 10, lineHeight: 18 },
  addressRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  cardAddress: { color: "#888", fontSize: 12, flex: 1, marginRight: 8 },
  mapBtn: { borderRadius: 8, borderWidth: 1, borderColor: "#4CAF50", paddingHorizontal: 8, paddingVertical: 4 },
  mapBtnText: { color: "#4CAF50", fontSize: 11, fontWeight: "600" },
  cardActions: { gap: 8 },
  actionBtn: { borderRadius: 12, borderWidth: 1, borderColor: "#333", padding: 10, alignItems: "center" },
  actionBtnText: { color: "#ccc", fontSize: 13 },
  emptyState: { alignItems: "center", paddingTop: 60 },
  backBtn: { position: "absolute", bottom: 75, left: 20, backgroundColor: "rgba(255,122,26,0.15)", borderWidth: 1, borderColor: "#ff7a1a", borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 },
});
