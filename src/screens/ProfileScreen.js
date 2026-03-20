// ─────────────────────────────────────────────────────────────────
// ProfileScreen.js — Eladó profil szerkesztő
// Profilkép, borító, bio, kategóriák, YouTube videók, nyitvatartás
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Image, StyleSheet, Alert, Switch,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { colors } from "../theme/colors";
import { shared } from "../theme/styles";
import {
  uploadImage, savePublicProfile, createDefaultProfile,
  extractYouTubeId, getYouTubeThumbnail,
} from "../services/profileService";

const DAYS = [
  { key: "mon", label: "Hétfő" },
  { key: "tue", label: "Kedd" },
  { key: "wed", label: "Szerda" },
  { key: "thu", label: "Csütörtök" },
  { key: "fri", label: "Péntek" },
  { key: "sat", label: "Szombat" },
  { key: "sun", label: "Vasárnap" },
];

const PRICE_OPTIONS = [
  { value: "budget", label: "💚 Kedvező", desc: "Megfizethető árak" },
  { value: "medium", label: "💛 Közepes", desc: "Átlagos piaci árak" },
  { value: "premium", label: "🔴 Prémium", desc: "Magasabb árszint" },
];

const SECTIONS = ["Alap", "Média", "Videók", "Nyitvatartás", "Egyéb"];

export default function ProfileScreen({
  sellerUid,
  initialProfile,
  onSave,
  onBack,
  onPreview,
}) {
  const [profile, setProfile] = useState(initialProfile || createDefaultProfile());
  const [activeSection, setActiveSection] = useState("Alap");
  const [saving, setSaving] = useState(false);
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [newVideoTitle, setNewVideoTitle] = useState("");
  const [newCategory, setNewCategory] = useState("");

  function update(key, value) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await savePublicProfile(sellerUid, profile);
      onSave?.(profile);
      Alert.alert("✅ Mentve", "A profilod frissítve lett.");
    } catch (e) {
      Alert.alert("Hiba", "Nem sikerült menteni: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function pickImage(type) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Engedély szükséges"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === "avatar" ? [1, 1] : [16, 9],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.length) return;
    const uri = result.assets[0].uri;
    try {
      if (!sellerUid) { update(type + "Url", uri); return; }
      const url = await uploadImage(sellerUid, type, uri);
      update(type + "Url", url);
    } catch (e) {
      update(type + "Url", uri); // lokális fallback
    }
  }

  async function pickPortfolioImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Engedély szükséges"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.length) return;
    const uri = result.assets[0].uri;
    try {
      const url = sellerUid ? await uploadImage(sellerUid, "portfolio", uri) : uri;
      update("portfolioImages", [
        ...(profile.portfolioImages || []),
        { url, caption: "", uploadedAt: Date.now() },
      ]);
    } catch (e) {
      Alert.alert("Feltöltési hiba", e.message);
    }
  }

  function addVideo() {
    const id = extractYouTubeId(newVideoUrl);
    if (!id) {
      Alert.alert("Hibás URL", "Adj meg egy érvényes YouTube linket.\nPl: https://youtu.be/VIDEO_ID");
      return;
    }
    if ((profile.videos || []).length >= 5) {
      Alert.alert("Maximum 5 videó", "Távolíts el egyet mielőtt újat adsz hozzá.");
      return;
    }
    update("videos", [
      ...(profile.videos || []),
      { youtubeUrl: newVideoUrl, videoId: id, title: newVideoTitle || "Videó", description: "" },
    ]);
    setNewVideoUrl("");
    setNewVideoTitle("");
  }

  function removeVideo(index) {
    const updated = [...(profile.videos || [])];
    updated.splice(index, 1);
    update("videos", updated);
  }

  function addCategory() {
    if (!newCategory.trim()) return;
    update("categories", [...(profile.categories || []), newCategory.trim()]);
    setNewCategory("");
  }

  function updateOpeningHours(day, field, value) {
    update("openingHours", {
      ...(profile.openingHours || {}),
      [day]: { ...(profile.openingHours?.[day] || {}), [field]: value },
    });
  }

  // ── Alap szekció ──────────────────────────────────────────────
  function renderAlap() {
    return (
      <View>
        {/* Bio */}
        <Text style={shared.label}>Bemutatkozás</Text>
        <TextInput
          style={[shared.textArea, { minHeight: 100 }]}
          value={profile.bio || ""}
          onChangeText={(v) => update("bio", v)}
          placeholder="Mutatkozz be röviden — ki vagy, mit csinálsz, mi a specialitásod..."
          placeholderTextColor={colors.placeholder}
          multiline
          textAlignVertical="top"
          maxLength={500}
        />
        <Text style={[shared.labelSmall, { textAlign: "right" }]}>
          {(profile.bio || "").length}/500
        </Text>

        {/* Kategóriák */}
        <Text style={shared.label}>Szolgáltatási kategóriák</Text>
        <View style={s.tagRow}>
          {(profile.categories || []).map((cat, i) => (
            <TouchableOpacity
              key={i}
              style={s.tag}
              onPress={() => {
                const updated = [...profile.categories];
                updated.splice(i, 1);
                update("categories", updated);
              }}
            >
              <Text style={s.tagText}>{cat} ✕</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={s.addRow}>
          <TextInput
            style={[shared.input, { flex: 1, marginBottom: 0 }]}
            value={newCategory}
            onChangeText={setNewCategory}
            placeholder="pl. Személyi edző"
            placeholderTextColor={colors.placeholder}
            returnKeyType="done"
            onSubmitEditing={addCategory}
          />
          <TouchableOpacity style={s.addBtn} onPress={addCategory}>
            <Text style={s.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Árkategória */}
        <Text style={[shared.label, { marginTop: 16 }]}>Árkategória</Text>
        {PRICE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[s.priceOption, profile.priceRange === opt.value && s.priceOptionActive]}
            onPress={() => update("priceRange", opt.value)}
          >
            <Text style={s.priceLabel}>{opt.label}</Text>
            <Text style={s.priceSub}>{opt.desc}</Text>
          </TouchableOpacity>
        ))}

        {/* Helyszín */}
        <Text style={[shared.label, { marginTop: 16 }]}>Város</Text>
        <TextInput
          style={shared.input}
          value={profile.city || ""}
          onChangeText={(v) => update("city", v)}
          placeholder="Budapest"
          placeholderTextColor={colors.placeholder}
        />

        {/* Elérhetőségek */}
        <Text style={[shared.label, { marginTop: 8 }]}>Weboldal</Text>
        <TextInput
          style={shared.input}
          value={profile.website || ""}
          onChangeText={(v) => update("website", v)}
          placeholder="https://..."
          placeholderTextColor={colors.placeholder}
          autoCapitalize="none"
          keyboardType="url"
        />
        <Text style={shared.label}>Instagram</Text>
        <TextInput
          style={shared.input}
          value={profile.instagram || ""}
          onChangeText={(v) => update("instagram", v)}
          placeholder="@felhasználónév"
          placeholderTextColor={colors.placeholder}
          autoCapitalize="none"
        />
      </View>
    );
  }

  // ── Média szekció ─────────────────────────────────────────────
  function renderMedia() {
    return (
      <View>
        {/* Borítókép */}
        <Text style={shared.label}>Borítókép</Text>
        <TouchableOpacity style={s.coverPicker} onPress={() => pickImage("cover")}>
          {profile.coverUrl ? (
            <Image source={{ uri: profile.coverUrl }} style={s.coverImage} />
          ) : (
            <View style={s.coverPlaceholder}>
              <Text style={{ fontSize: 32 }}>🖼️</Text>
              <Text style={shared.labelSmall}>Borítókép hozzáadása</Text>
              <Text style={[shared.labelSmall, { fontSize: 11 }]}>Ajánlott: 1200×400px</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Profilkép */}
        <Text style={[shared.label, { marginTop: 16 }]}>Profilkép</Text>
        <View style={{ alignItems: "flex-start" }}>
          <TouchableOpacity onPress={() => pickImage("avatar")}>
            {profile.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.avatarPlaceholder]}>
                <Text style={{ fontSize: 36 }}>👤</Text>
              </View>
            )}
            <View style={s.avatarEditBadge}>
              <Text style={{ fontSize: 12 }}>✏️</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Portfolio képek */}
        <Text style={[shared.label, { marginTop: 20 }]}>
          Portfolio képek ({(profile.portfolioImages || []).length})
        </Text>
        <View style={s.portfolioGrid}>
          {(profile.portfolioImages || []).map((img, i) => (
            <View key={i} style={s.portfolioItem}>
              <Image source={{ uri: img.url }} style={s.portfolioImg} />
              <TouchableOpacity
                style={s.portfolioDelete}
                onPress={() => {
                  const updated = [...profile.portfolioImages];
                  updated.splice(i, 1);
                  update("portfolioImages", updated);
                }}
              >
                <Text style={{ color: "#fff", fontSize: 12 }}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          {(profile.portfolioImages || []).length < 10 && (
            <TouchableOpacity style={s.portfolioAdd} onPress={pickPortfolioImage}>
              <Text style={{ fontSize: 28, color: colors.textSecondary }}>+</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // ── Videók szekció ────────────────────────────────────────────
  function renderVideos() {
    return (
      <View>
        <Text style={[shared.labelSmall, { marginBottom: 16 }]}>
          Adj hozzá YouTube videókat (max 5). Töltsd fel YouTube-ra (akár "Unlisted" beállítással), 
          majd illeszd be a linket.
        </Text>

        {/* Meglévő videók */}
        {(profile.videos || []).map((video, i) => {
          const thumb = getYouTubeThumbnail(video.videoId || video.youtubeUrl);
          return (
            <View key={i} style={s.videoItem}>
              {thumb && (
                <Image source={{ uri: thumb }} style={s.videoThumb} resizeMode="cover" />
              )}
              <View style={{ flex: 1, padding: 12 }}>
                <Text style={shared.value} numberOfLines={2}>{video.title}</Text>
                <Text style={[shared.labelSmall, { marginTop: 4 }]}>
                  youtube.com/watch?v={video.videoId}
                </Text>
              </View>
              <TouchableOpacity
                style={s.videoDelete}
                onPress={() => removeVideo(i)}
              >
                <Text style={{ color: "#ff6b6b", fontSize: 18 }}>🗑</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {/* Új videó hozzáadása */}
        {(profile.videos || []).length < 5 && (
          <View style={s.addVideoWrap}>
            <Text style={[shared.label, { marginBottom: 8 }]}>Új videó hozzáadása</Text>
            <TextInput
              style={shared.input}
              value={newVideoTitle}
              onChangeText={setNewVideoTitle}
              placeholder="Videó neve (pl. Bemutatko videóm)"
              placeholderTextColor={colors.placeholder}
            />
            <TextInput
              style={shared.input}
              value={newVideoUrl}
              onChangeText={setNewVideoUrl}
              placeholder="YouTube link: https://youtu.be/..."
              placeholderTextColor={colors.placeholder}
              autoCapitalize="none"
              keyboardType="url"
            />
            {newVideoUrl.length > 0 && extractYouTubeId(newVideoUrl) && (
              <View style={s.videoPreview}>
                <Image
                  source={{ uri: getYouTubeThumbnail(extractYouTubeId(newVideoUrl)) }}
                  style={s.videoPreviewThumb}
                  resizeMode="cover"
                />
                <Text style={[shared.labelSmall, { padding: 8 }]}>✅ Érvényes YouTube link</Text>
              </View>
            )}
            <TouchableOpacity style={shared.btnPrimary} onPress={addVideo}>
              <Text style={shared.btnTextPrimary}>▶️  Videó hozzáadása</Text>
            </TouchableOpacity>
          </View>
        )}

        {(profile.videos || []).length >= 5 && (
          <View style={[shared.card, { alignItems: "center" }]}>
            <Text style={shared.value}>Maximum 5 videó lett elérve.</Text>
            <Text style={shared.labelSmall}>Törölj egyet, hogy újat adhass hozzá.</Text>
          </View>
        )}
      </View>
    );
  }

  // ── Nyitvatartás szekció ──────────────────────────────────────
  function renderOpeningHours() {
    return (
      <View>
        {DAYS.map((day) => {
          const hours = profile.openingHours?.[day.key] || { open: "09:00", close: "18:00", closed: false };
          return (
            <View key={day.key} style={s.dayRow}>
              <View style={s.dayLabel}>
                <Text style={shared.value}>{day.label}</Text>
              </View>
              <Switch
                value={!hours.closed}
                onValueChange={(v) => updateOpeningHours(day.key, "closed", !v)}
                trackColor={{ false: colors.borderSubtle, true: colors.accentSoft }}
                thumbColor={!hours.closed ? colors.accent : colors.textSecondary}
              />
              {!hours.closed ? (
                <View style={s.hoursRow}>
                  <TextInput
                    style={s.hourInput}
                    value={hours.open}
                    onChangeText={(v) => updateOpeningHours(day.key, "open", v)}
                    placeholder="09:00"
                    placeholderTextColor={colors.placeholder}
                  />
                  <Text style={{ color: colors.textSecondary }}>–</Text>
                  <TextInput
                    style={s.hourInput}
                    value={hours.close}
                    onChangeText={(v) => updateOpeningHours(day.key, "close", v)}
                    placeholder="18:00"
                    placeholderTextColor={colors.placeholder}
                  />
                </View>
              ) : (
                <Text style={[shared.labelSmall, { marginLeft: 12 }]}>Zárva</Text>
              )}
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Fejléc */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
          <TouchableOpacity onPress={onBack} style={{ padding: 8, marginRight: 8 }}>
            <Text style={{ color: "#fff", fontSize: 22 }}>←</Text>
          </TouchableOpacity>
          <Text style={[shared.title, { marginBottom: 0, flex: 1 }]}>PROFIL SZERKESZTÉSE</Text>
          <TouchableOpacity style={s.previewBtn} onPress={onPreview}>
            <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "bold" }}>👁 Előnézet</Text>
          </TouchableOpacity>
        </View>

        {/* Section tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
          {SECTIONS.map((sec) => (
            <TouchableOpacity
              key={sec}
              style={[s.sectionTab, activeSection === sec && s.sectionTabActive]}
              onPress={() => setActiveSection(sec)}
            >
              <Text style={[s.sectionTabText, activeSection === sec && { color: colors.accent }]}>
                {sec}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {activeSection === "Alap" && renderAlap()}
        {activeSection === "Média" && renderMedia()}
        {activeSection === "Videók" && renderVideos()}
        {activeSection === "Nyitvatartás" && renderOpeningHours()}
        {activeSection === "Egyéb" && (
          <View>
            <Text style={shared.label}>Facebook</Text>
            <TextInput
              style={shared.input}
              value={profile.facebook || ""}
              onChangeText={(v) => update("facebook", v)}
              placeholder="Facebook profil link"
              placeholderTextColor={colors.placeholder}
              autoCapitalize="none"
            />
          </View>
        )}

        {/* Mentés */}
        <TouchableOpacity
          style={[shared.btnPrimary, { marginTop: 24 }, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={shared.btnTextPrimary}>
            {saving ? "⏳ Mentés..." : "💾  PROFIL MENTÉSE"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[shared.btnOutline, { marginTop: 12 }]} onPress={onBack}>
          <Text style={shared.btnTextSecondary}>VISSZA</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  previewBtn: {
    backgroundColor: colors.accentSoft, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: colors.accentBorder,
  },
  sectionTab: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, marginRight: 8,
    backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  sectionTabActive: { borderColor: colors.accentBorder, backgroundColor: colors.accentSoft },
  sectionTabText: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  tag: {
    backgroundColor: colors.accentSoft, borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: colors.accentBorder,
  },
  tagText: { color: colors.accent, fontSize: 13 },
  addRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  addBtn: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: colors.accentSoft, borderWidth: 1,
    borderColor: colors.accentBorder, justifyContent: "center", alignItems: "center",
  },
  addBtnText: { color: colors.accent, fontSize: 24, fontWeight: "bold" },
  priceOption: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: colors.bgCard, borderRadius: 16, padding: 16, marginBottom: 8,
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  priceOptionActive: { borderColor: colors.accentBorder, backgroundColor: colors.accentSoft },
  priceLabel: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
  priceSub: { color: colors.textSecondary, fontSize: 13 },
  coverPicker: { width: "100%", height: 160, borderRadius: 16, overflow: "hidden" },
  coverImage: { width: "100%", height: "100%" },
  coverPlaceholder: {
    width: "100%", height: "100%",
    backgroundColor: colors.bgCard, borderRadius: 16,
    justifyContent: "center", alignItems: "center", gap: 8,
    borderWidth: 1, borderColor: colors.borderSubtle, borderStyle: "dashed",
  },
  avatar: { width: 90, height: 90, borderRadius: 45 },
  avatarPlaceholder: {
    backgroundColor: colors.bgCard, justifyContent: "center",
    alignItems: "center", borderWidth: 1, borderColor: colors.borderSubtle,
  },
  avatarEditBadge: {
    position: "absolute", bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.accent, justifyContent: "center", alignItems: "center",
  },
  portfolioGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  portfolioItem: { width: 100, height: 100, borderRadius: 12, overflow: "hidden" },
  portfolioImg: { width: "100%", height: "100%" },
  portfolioDelete: {
    position: "absolute", top: 4, right: 4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center",
  },
  portfolioAdd: {
    width: 100, height: 100, borderRadius: 12,
    backgroundColor: colors.bgCard, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: colors.borderSubtle, borderStyle: "dashed",
  },
  videoItem: {
    flexDirection: "row", backgroundColor: colors.bgCard,
    borderRadius: 16, marginBottom: 10, overflow: "hidden",
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  videoThumb: { width: 120, height: 80 },
  videoDelete: {
    justifyContent: "center", alignItems: "center",
    paddingHorizontal: 16,
  },
  addVideoWrap: {
    backgroundColor: colors.bgCard, borderRadius: 20,
    padding: 16, borderWidth: 1, borderColor: colors.borderSubtle,
  },
  videoPreview: {
    borderRadius: 12, overflow: "hidden", marginBottom: 12,
    borderWidth: 1, borderColor: colors.accentBorder,
  },
  videoPreviewThumb: { width: "100%", height: 160 },
  dayRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
  },
  dayLabel: { width: 80 },
  hoursRow: { flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 12 },
  hourInput: {
    width: 64, backgroundColor: colors.bgInput,
    color: colors.textPrimary, padding: 8,
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    textAlign: "center", fontSize: 14,
  },
});
