// ─────────────────────────────────────────────────────────────────
// PublicProfileScreen.js — Publikus profil nézet
// Ezt látja a partner QR beolvasás után
// Profilkép, borító, bio, videók, képek, chat, időpont gomb
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  Image, StyleSheet, Linking, Dimensions,
  Modal,
} from "react-native";
import { WebView } from "react-native-webview";
import { colors } from "../theme/colors";
import { shared } from "../theme/styles";
import { buildEmbedUrl, getYouTubeThumbnail, getPublicProfile } from "../services/profileService";

const { width } = Dimensions.get("window");

const PRICE_LABELS = {
  budget: "💚 Kedvező",
  medium: "💛 Közepes",
  premium: "🔴 Prémium",
};

const DAY_LABELS = {
  mon: "H", tue: "K", wed: "Sze", thu: "Cs", fri: "P", sat: "Szo", sun: "V",
};

export default function PublicProfileScreen({
  sellerUid,
  profileData,      // ha már betöltött adat van
  onBack,
  onChat,
  onBooking,
  onQrConnect,
  myRole = "buyer",
}) {
  const [profile, setProfile] = useState(profileData || null);
  const [loading, setLoading] = useState(!profileData);
  const [activeVideo, setActiveVideo] = useState(null);
  const [activeImage, setActiveImage] = useState(null);

  useEffect(() => {
    if (!profileData && sellerUid) {
      getPublicProfile(sellerUid)
        .then((p) => setProfile(p))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [sellerUid]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: colors.textSecondary, fontSize: 16 }}>⏳ Betöltés...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>👤</Text>
        <Text style={[shared.value, { textAlign: "center" }]}>
          Ez a partner még nem töltötte ki a profilját.
        </Text>
        <TouchableOpacity style={[shared.btnOutline, { marginTop: 24 }]} onPress={onBack}>
          <Text style={shared.btnTextSecondary}>VISSZA</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Borítókép */}
        <View style={pp.coverWrap}>
          {profile.coverUrl ? (
            <Image source={{ uri: profile.coverUrl }} style={pp.cover} resizeMode="cover" />
          ) : (
            <View style={[pp.cover, pp.coverPlaceholder]}>
              <Text style={{ fontSize: 48 }}>🏢</Text>
            </View>
          )}

          {/* Vissza gomb */}
          <TouchableOpacity style={pp.backBtn} onPress={onBack}>
            <Text style={{ color: "#fff", fontSize: 20 }}>←</Text>
          </TouchableOpacity>
        </View>

        {/* Profil header */}
        <View style={pp.headerWrap}>
          {/* Avatar */}
          {profile.avatarUrl ? (
            <Image source={{ uri: profile.avatarUrl }} style={pp.avatar} />
          ) : (
            <View style={[pp.avatar, pp.avatarPlaceholder]}>
              <Text style={{ fontSize: 32 }}>{(profile.name || "?")[0]}</Text>
            </View>
          )}

          <View style={{ flex: 1 }}>
            <Text style={pp.name}>{profile.name}</Text>
            {!!profile.company && <Text style={pp.company}>{profile.company}</Text>}

            {/* Kategóriák */}
            {(profile.categories || []).length > 0 && (
              <View style={pp.tagRow}>
                {profile.categories.map((cat, i) => (
                  <View key={i} style={pp.tag}>
                    <Text style={pp.tagText}>{cat}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Meta sor */}
        <View style={pp.metaRow}>
          {!!profile.city && (
            <View style={pp.metaItem}>
              <Text style={pp.metaIcon}>📍</Text>
              <Text style={pp.metaText}>{profile.city}</Text>
            </View>
          )}
          {!!profile.priceRange && (
            <View style={pp.metaItem}>
              <Text style={pp.metaText}>{PRICE_LABELS[profile.priceRange]}</Text>
            </View>
          )}
        </View>

        {/* Akció gombok — MINDIG MAGASAN */}
        <View style={pp.actionRow}>
          <TouchableOpacity style={[pp.actionBtn, pp.actionBtnPrimary]} onPress={onChat}>
            <Text style={pp.actionBtnIcon}>💬</Text>
            <Text style={pp.actionBtnText}>Üzenet</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[pp.actionBtn, pp.actionBtnAccent]} onPress={onBooking}>
            <Text style={pp.actionBtnIcon}>📅</Text>
            <Text style={pp.actionBtnText}>Időpont</Text>
          </TouchableOpacity>
          <TouchableOpacity style={pp.actionBtn} onPress={onQrConnect}>
            <Text style={pp.actionBtnIcon}>📱</Text>
            <Text style={pp.actionBtnText}>QR</Text>
          </TouchableOpacity>
        </View>

        {/* Bio — CTA UTÁN */}
        {!!profile.bio && (
          <View style={[shared.card, { marginHorizontal: 16, marginBottom: 8 }]}>
            <Text style={[shared.value, { lineHeight: 22 }]}>{profile.bio}</Text>
          </View>
        )}

        {/* Videók */}
        {(profile.videos || []).length > 0 && (
          <View style={pp.section}>
            <Text style={pp.sectionTitle}>🎬  Videók</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {profile.videos.map((video, i) => {
                const thumb = getYouTubeThumbnail(video.videoId || video.youtubeUrl);
                return (
                  <TouchableOpacity
                    key={i}
                    style={pp.videoCard}
                    onPress={() => setActiveVideo(video)}
                  >
                    {thumb ? (
                      <Image source={{ uri: thumb }} style={pp.videoThumb} resizeMode="cover" />
                    ) : (
                      <View style={[pp.videoThumb, { backgroundColor: colors.bgCard, justifyContent: "center", alignItems: "center" }]}>
                        <Text style={{ fontSize: 32 }}>▶️</Text>
                      </View>
                    )}
                    <View style={pp.videoPlayOverlay}>
                      <Text style={{ fontSize: 28 }}>▶️</Text>
                    </View>
                    <Text style={pp.videoTitle} numberOfLines={2}>{video.title}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Portfolio képek */}
        {(profile.portfolioImages || []).length > 0 && (
          <View style={pp.section}>
            <Text style={pp.sectionTitle}>📷  Portfolio</Text>
            <View style={pp.portfolioGrid}>
              {profile.portfolioImages.map((img, i) => (
                <TouchableOpacity
                  key={i}
                  style={pp.portfolioItem}
                  onPress={() => setActiveImage(img.url)}
                >
                  <Image source={{ uri: img.url }} style={pp.portfolioImg} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Nyitvatartás */}
        {profile.openingHours && (
          <View style={pp.section}>
            <Text style={pp.sectionTitle}>🕐  Nyitvatartás</Text>
            <View style={[shared.card, { marginHorizontal: 16 }]}>
              {Object.entries(profile.openingHours).map(([day, hours]) => (
                <View key={day} style={pp.dayRow}>
                  <Text style={[pp.dayLabel, { color: colors.textSecondary }]}>
                    {DAY_LABELS[day]}
                  </Text>
                  <Text style={[shared.value, hours.closed && { color: colors.textSecondary }]}>
                    {hours.closed ? "Zárva" : `${hours.open} – ${hours.close}`}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Social linkek */}
        {(profile.website || profile.instagram || profile.facebook) && (
          <View style={pp.section}>
            <Text style={pp.sectionTitle}>🔗  Elérhetőség</Text>
            <View style={pp.socialRow}>
              {profile.website && (
                <TouchableOpacity style={pp.socialBtn} onPress={() => Linking.openURL(profile.website)}>
                  <Text style={{ fontSize: 20 }}>🌐</Text>
                  <Text style={pp.socialText}>Weboldal</Text>
                </TouchableOpacity>
              )}
              {profile.instagram && (
                <TouchableOpacity style={pp.socialBtn} onPress={() => Linking.openURL(`https://instagram.com/${profile.instagram.replace("@", "")}`)}>
                  <Text style={{ fontSize: 20 }}>📸</Text>
                  <Text style={pp.socialText}>Instagram</Text>
                </TouchableOpacity>
              )}
              {profile.facebook && (
                <TouchableOpacity style={pp.socialBtn} onPress={() => Linking.openURL(profile.facebook)}>
                  <Text style={{ fontSize: 20 }}>👥</Text>
                  <Text style={pp.socialText}>Facebook</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Video lejátszó modal */}
      <Modal visible={!!activeVideo} animationType="fade" onRequestClose={() => setActiveVideo(null)}>
        <View style={pp.videoModal}>
          <TouchableOpacity style={pp.videoModalClose} onPress={() => setActiveVideo(null)}>
            <Text style={{ color: "#fff", fontSize: 22 }}>✕</Text>
          </TouchableOpacity>
          {activeVideo && (
            <>
              <Text style={pp.videoModalTitle}>{activeVideo.title}</Text>
              <View style={pp.webviewWrap}>
                <WebView
                  source={{ uri: buildEmbedUrl(activeVideo.videoId || activeVideo.youtubeUrl) }}
                  style={{ flex: 1 }}
                  allowsFullscreenVideo
                  javaScriptEnabled
                  allowsInlineMediaPlayback={false}
                />
              </View>
            </>
          )}
        </View>
      </Modal>

      {/* Kép teljes nézetű modal */}
      <Modal visible={!!activeImage} animationType="fade" transparent onRequestClose={() => setActiveImage(null)}>
        <View style={pp.imageModal}>
          <TouchableOpacity style={pp.videoModalClose} onPress={() => setActiveImage(null)}>
            <Text style={{ color: "#fff", fontSize: 22 }}>✕</Text>
          </TouchableOpacity>
          {activeImage && (
            <Image source={{ uri: activeImage }} style={pp.fullImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </View>
  );
}

const pp = StyleSheet.create({
  coverWrap: { width: "100%", height: 200, position: "relative" },
  cover: { width: "100%", height: "100%" },
  coverPlaceholder: { backgroundColor: colors.bgCard, justifyContent: "center", alignItems: "center" },
  backBtn: {
    position: "absolute", top: 48, left: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center", alignItems: "center",
  },
  headerWrap: {
    flexDirection: "row", alignItems: "flex-start",
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 12,
  },
  avatar: { width: 72, height: 72, borderRadius: 36, marginTop: -36, borderWidth: 3, borderColor: colors.bgDark },
  avatarPlaceholder: { backgroundColor: colors.bgCard, justifyContent: "center", alignItems: "center" },
  name: { color: colors.textPrimary, fontSize: 20, fontWeight: "bold" },
  company: { color: colors.textSecondary, fontSize: 14, marginTop: 2 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  tag: { backgroundColor: colors.accentSoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: colors.accentBorder },
  tagText: { color: colors.accent, fontSize: 12 },
  metaRow: { flexDirection: "row", gap: 16, paddingHorizontal: 16, marginBottom: 4 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaIcon: { fontSize: 14 },
  metaText: { color: colors.textSecondary, fontSize: 13 },
  actionRow: { flexDirection: "row", gap: 12, paddingHorizontal: 16, marginVertical: 16 },
  actionBtn: {
    flex: 1, backgroundColor: colors.bgCard,
    borderRadius: 16, padding: 14, alignItems: "center",
    borderWidth: 1, borderColor: colors.borderSubtle, gap: 6,
  },
  actionBtnPrimary: { borderColor: "rgba(0,188,212,0.4)", backgroundColor: "rgba(0,188,212,0.1)" },
  actionBtnAccent: { borderColor: colors.accentBorder, backgroundColor: colors.accentSoft },
  actionBtnIcon: { fontSize: 22 },
  actionBtnText: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
  section: { marginBottom: 24 },
  sectionTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: "bold", paddingHorizontal: 16, marginBottom: 12 },
  videoCard: { width: 200, marginLeft: 16, marginBottom: 4 },
  videoThumb: { width: 200, height: 120, borderRadius: 12 },
  videoPlayOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, height: 120,
    justifyContent: "center", alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 12,
  },
  videoTitle: { color: colors.textPrimary, fontSize: 13, marginTop: 8, paddingHorizontal: 4 },
  portfolioGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4, paddingHorizontal: 16 },
  portfolioItem: { width: (width - 44) / 3, height: (width - 44) / 3, borderRadius: 8, overflow: "hidden" },
  portfolioImg: { width: "100%", height: "100%" },
  dayRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  dayLabel: { width: 32, fontWeight: "bold" },
  socialRow: { flexDirection: "row", gap: 12, paddingHorizontal: 16 },
  socialBtn: { flex: 1, backgroundColor: colors.bgCard, borderRadius: 14, padding: 14, alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.borderSubtle },
  socialText: { color: colors.textSecondary, fontSize: 12 },
  videoModal: { flex: 1, backgroundColor: "#000", paddingTop: 60 },
  videoModalClose: { position: "absolute", top: 48, right: 20, zIndex: 10, padding: 8 },
  videoModalTitle: { color: "#fff", fontSize: 16, fontWeight: "bold", textAlign: "center", paddingHorizontal: 48, marginBottom: 16 },
  webviewWrap: { flex: 1, marginHorizontal: 0 },
  imageModal: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center" },
  fullImage: { width: "100%", height: "80%" },
});
