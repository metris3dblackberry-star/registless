// ─────────────────────────────────────────────────────────────────
// DiscoveryScreen.js — Kereshető szolgáltatók
// Kategória, város, nyitva, videó, trial/pro badge
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, Image, ActivityIndicator,
} from "react-native";
import { colors } from "../theme/colors";
import { shared } from "../theme/styles";
import { searchProviders, isOpenNow, VISIBILITY_CONFIG, VisibilityStatus } from "../services/visibilityService";
import { Plan, PLAN_DISPLAY } from "../models/accountModel";

const CATEGORIES = [
  "Személyi edző", "Masszőr", "Fodrász", "Kozmetikus",
  "Könyvelő", "Ügyvéd", "Fotós", "Oktató", "Egyéb",
];

export default function DiscoveryScreen({ onSelectProvider, onBack }) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [city, setCity] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterVideos, setFilterVideos] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    try {
      const res = await searchProviders({
        category: selectedCategory,
        city: city.trim() || null,
        hasVideos: filterVideos,
        limitCount: 30,
      });

      // Szöveges szűrés ha van query
      const filtered = query.trim()
        ? res.filter((p) =>
            (p.name || "").toLowerCase().includes(query.toLowerCase()) ||
            (p.company || "").toLowerCase().includes(query.toLowerCase()) ||
            (p.categories || []).some((c) => c.toLowerCase().includes(query.toLowerCase()))
          )
        : res;

      // Rendezés: Pro → Trial → többi
      filtered.sort((a, b) => {
        const planOrder = { [Plan.PRO]: 0, [Plan.PREMIUM]: 0, [Plan.TRIAL]: 1, [Plan.FREE]: 2 };
        return (planOrder[a.plan] || 2) - (planOrder[b.plan] || 2);
      });

      setResults(filtered);
    } finally {
      setLoading(false);
    }
  }, [query, selectedCategory, city, filterVideos]);

  // Auto search ha van kategória
  useEffect(() => {
    if (selectedCategory) doSearch();
  }, [selectedCategory]);

  function renderProviderCard(provider) {
    const isOpen = isOpenNow(provider.openingHours);
    const planDisplay = PLAN_DISPLAY[provider.plan] || PLAN_DISPLAY[Plan.FREE];
    const hasVideos = (provider.videos || []).length > 0;

    return (
      <TouchableOpacity
        key={provider.uid}
        style={[ds.card, provider.plan === Plan.PRO && ds.cardPro]}
        onPress={() => onSelectProvider?.(provider)}
      >
        {/* Borítókép */}
        {provider.coverUrl ? (
          <Image source={{ uri: provider.coverUrl }} style={ds.cover} resizeMode="cover" />
        ) : (
          <View style={[ds.cover, ds.coverPlaceholder]}>
            <Text style={{ fontSize: 32 }}>{(provider.name || "?")[0]}</Text>
          </View>
        )}

        {/* Plan badge */}
        <View style={[ds.planBadge, { backgroundColor: planDisplay.color + "dd" }]}>
          <Text style={ds.planBadgeText}>{planDisplay.icon} {planDisplay.label}</Text>
        </View>

        {/* Content */}
        <View style={ds.cardContent}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {provider.avatarUrl ? (
              <Image source={{ uri: provider.avatarUrl }} style={ds.avatar} />
            ) : (
              <View style={[ds.avatar, ds.avatarPlaceholder]}>
                <Text style={{ fontSize: 16 }}>{(provider.name || "?")[0]}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={ds.name} numberOfLines={1}>{provider.name}</Text>
              {!!provider.company && (
                <Text style={ds.company} numberOfLines={1}>{provider.company}</Text>
              )}
            </View>
          </View>

          {/* Kategóriák */}
          {(provider.categories || []).length > 0 && (
            <View style={ds.tagRow}>
              {provider.categories.slice(0, 3).map((cat, i) => (
                <View key={i} style={ds.tag}>
                  <Text style={ds.tagText}>{cat}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Meta sor */}
          <View style={ds.metaRow}>
            {!!provider.city && (
              <Text style={ds.metaText}>📍 {provider.city}</Text>
            )}
            {isOpen !== null && (
              <View style={[ds.openBadge, { backgroundColor: isOpen ? "rgba(76,175,80,0.2)" : "rgba(244,67,54,0.2)" }]}>
                <Text style={[ds.openText, { color: isOpen ? "#4CAF50" : "#f44336" }]}>
                  {isOpen ? "🟢 Nyitva" : "🔴 Zárva"}
                </Text>
              </View>
            )}
            {hasVideos && <Text style={ds.metaText}>🎬 Videók</Text>}
            {!!provider.priceRange && (
              <Text style={ds.metaText}>
                {provider.priceRange === "budget" ? "💚" : provider.priceRange === "premium" ? "🔴" : "💛"}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={ds.header}>
          <TouchableOpacity onPress={onBack} style={{ padding: 8 }}>
            <Text style={{ color: "#fff", fontSize: 22 }}>←</Text>
          </TouchableOpacity>
          <Text style={[shared.title, { marginBottom: 0, flex: 1 }]}>Felfedezés</Text>
        </View>

        {/* Keresőmező */}
        <View style={ds.searchWrap}>
          <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
          <TextInput
            style={ds.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Névjegy, cég, kategória..."
            placeholderTextColor={colors.placeholder}
            returnKeyType="search"
            onSubmitEditing={doSearch}
          />
          <TouchableOpacity style={ds.searchBtn} onPress={doSearch}>
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "bold" }}>Keresés</Text>
          </TouchableOpacity>
        </View>

        {/* Város szűrő */}
        <View style={[ds.searchWrap, { marginTop: 8 }]}>
          <Text style={{ fontSize: 16, marginRight: 8 }}>📍</Text>
          <TextInput
            style={ds.searchInput}
            value={city}
            onChangeText={setCity}
            placeholder="Város (pl. Budapest)"
            placeholderTextColor={colors.placeholder}
            returnKeyType="search"
            onSubmitEditing={doSearch}
          />
        </View>

        {/* Kategória szűrők */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12, paddingLeft: 16 }}>
          <TouchableOpacity
            style={[ds.catChip, !selectedCategory && ds.catChipActive]}
            onPress={() => { setSelectedCategory(null); setResults([]); setSearched(false); }}
          >
            <Text style={[ds.catChipText, !selectedCategory && { color: colors.accent }]}>Összes</Text>
          </TouchableOpacity>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[ds.catChip, selectedCategory === cat && ds.catChipActive]}
              onPress={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
            >
              <Text style={[ds.catChipText, selectedCategory === cat && { color: colors.accent }]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Extra szűrők */}
        <View style={ds.filterRow}>
          <TouchableOpacity
            style={[ds.filterChip, filterVideos && ds.filterChipActive]}
            onPress={() => { setFilterVideos(!filterVideos); }}
          >
            <Text style={[ds.filterChipText, filterVideos && { color: colors.accent }]}>🎬 Van videó</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[ds.filterChip, filterOpen && ds.filterChipActive]}
            onPress={() => { setFilterOpen(!filterOpen); }}
          >
            <Text style={[ds.filterChipText, filterOpen && { color: colors.accent }]}>🟢 Most nyitva</Text>
          </TouchableOpacity>
        </View>

        {/* Eredmények */}
        <View style={{ paddingHorizontal: 16 }}>
          {loading ? (
            <View style={{ paddingVertical: 48, alignItems: "center" }}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[shared.labelSmall, { marginTop: 12 }]}>Keresés...</Text>
            </View>
          ) : searched && results.length === 0 ? (
            <View style={[shared.card, { alignItems: "center", paddingVertical: 32 }]}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>🔍</Text>
              <Text style={shared.value}>Nincs találat</Text>
              <Text style={shared.labelSmall}>Próbálj más kategóriát vagy városnevet</Text>
            </View>
          ) : !searched ? (
            <View style={[shared.card, { alignItems: "center", paddingVertical: 32 }]}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>🏪</Text>
              <Text style={shared.value}>Keress szolgáltatókat</Text>
              <Text style={shared.labelSmall}>Válassz kategóriát vagy írj be egy nevet</Text>
            </View>
          ) : (
            <>
              <Text style={[shared.labelSmall, { marginBottom: 12 }]}>
                {results.length} találat
              </Text>
              {results.map(renderProviderCard)}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const ds = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
  searchWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.bgCard, borderRadius: 16,
    borderWidth: 1, borderColor: colors.borderSubtle,
    paddingHorizontal: 12, marginHorizontal: 16,
  },
  searchInput: { flex: 1, color: colors.textPrimary, paddingVertical: 14, fontSize: 14 },
  searchBtn: {
    backgroundColor: colors.accent, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, marginRight: 8,
    backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  catChipActive: { borderColor: colors.accentBorder, backgroundColor: colors.accentSoft },
  catChipText: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 16 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.borderSubtle,
  },
  filterChipActive: { borderColor: colors.accentBorder, backgroundColor: colors.accentSoft },
  filterChipText: { color: colors.textSecondary, fontSize: 13 },
  card: {
    backgroundColor: colors.bgCard, borderRadius: 20,
    marginBottom: 14, borderWidth: 1, borderColor: colors.borderSubtle,
    overflow: "hidden",
  },
  cardPro: { borderColor: "rgba(33,150,243,0.4)", backgroundColor: "rgba(33,150,243,0.04)" },
  cover: { width: "100%", height: 120 },
  coverPlaceholder: { backgroundColor: "rgba(60,60,60,0.8)", justifyContent: "center", alignItems: "center" },
  planBadge: {
    position: "absolute", top: 10, right: 10,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  planBadgeText: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  cardContent: { padding: 14 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: { backgroundColor: colors.accentSoft, justifyContent: "center", alignItems: "center" },
  name: { color: colors.textPrimary, fontSize: 16, fontWeight: "bold" },
  company: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  tag: { backgroundColor: colors.accentSoft, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: colors.accentBorder },
  tagText: { color: colors.accent, fontSize: 11 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" },
  metaText: { color: colors.textSecondary, fontSize: 12 },
  openBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  openText: { fontSize: 12, fontWeight: "600" },
});
