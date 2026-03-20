// ─────────────────────────────────────────────────────────────────
// OnboardingScreen.js — First-run onboarding
// Rövid, ütős: 5 slide, végén profil kitöltés
// ─────────────────────────────────────────────────────────────────
import React, { useState, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Dimensions, ScrollView,
} from "react-native";
import { colors } from "../theme/colors";
import { shared } from "../theme/styles";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    icon: "🤝",
    title: "Partner-központú",
    subtitle: "REGISTLESS",
    desc: "Nem számlázó app.\nNem CRM.\nEgy helyen minden: partner, időpont, számla, fizetés.",
    accent: "#ff7a1a",
  },
  {
    icon: "👥",
    title: "Partner hozzáadása",
    subtitle: "1 lépés",
    desc: "QR kóddal, névjegy fotójából vagy kézzel.\nAzonnal kapcsolódtok.",
    accent: "#2196F3",
  },
  {
    icon: "⚡",
    title: "Szolgáltatás & Számla",
    subtitle: "2 lépés",
    desc: "Indítsd el a szolgáltatást.\nLezáráskor azonnal számla — PDF megosztással.",
    accent: "#FF9800",
  },
  {
    icon: "💬",
    title: "Üzenet & Időpont",
    subtitle: "3 lépés",
    desc: "Minden a partner oldalán.\nÜzenet, foglalás, előzmények — egy helyen.",
    accent: "#00BCD4",
  },
  {
    icon: "💳",
    title: "Fizetés",
    subtitle: "4 lépés",
    desc: "Revolut, Stripe, PayPal.\nFizetési kérés egy tapra.",
    accent: "#4CAF50",
  },
];

export default function OnboardingScreen({ onComplete }) {
  const [current, setCurrent] = useState(0);
  const scrollRef = useRef(null);
  const dotAnim = useRef(SLIDES.map(() => new Animated.Value(0))).current;

  function goTo(index) {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
    setCurrent(index);
  }

  function handleNext() {
    if (current < SLIDES.length - 1) {
      goTo(current + 1);
    } else {
      onComplete();
    }
  }

  const slide = SLIDES[current];

  return (
    <View style={ob.root}>
      {/* Skip */}
      <TouchableOpacity style={ob.skipBtn} onPress={onComplete}>
        <Text style={ob.skipText}>Kihagyom</Text>
      </TouchableOpacity>

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={true}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          if (index !== current) setCurrent(index);
        }}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s, i) => (
          <View key={i} style={[ob.slide, { width }]}>
            {/* Icon */}
            <View style={[ob.iconWrap, { backgroundColor: s.accent + "22", borderColor: s.accent + "44" }]}>
              <Text style={ob.icon}>{s.icon}</Text>
            </View>

            {/* Subtitle pill */}
            <View style={[ob.pill, { backgroundColor: s.accent + "22", borderColor: s.accent + "44" }]}>
              <Text style={[ob.pillText, { color: s.accent }]}>{s.subtitle}</Text>
            </View>

            <Text style={ob.title}>{s.title}</Text>
            <Text style={ob.desc}>{s.desc}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Dots */}
      <View style={ob.dotsRow}>
        {SLIDES.map((_, i) => (
          <TouchableOpacity
            key={i}
            style={[ob.dot, i === current && [ob.dotActive, { backgroundColor: slide.accent }]]}
            onPress={() => goTo(i)}
          />
        ))}
      </View>

      {/* CTA */}
      <View style={ob.footer}>
        <TouchableOpacity
          style={[ob.nextBtn, { backgroundColor: slide.accent }]}
          onPress={handleNext}
        >
          <Text style={ob.nextBtnText}>
            {current === SLIDES.length - 1 ? "Kezdjük el! 🚀" : "Következő →"}
          </Text>
        </TouchableOpacity>

        {current === SLIDES.length - 1 && (
          <TouchableOpacity style={[shared.btnOutline, { marginTop: 12 }]} onPress={onComplete}>
            <Text style={shared.btnTextSecondary}>Majd beállítom</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const ob = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgDark,
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 0,
  },
  skipBtn: { position: "absolute", top: 56, right: 24, zIndex: 10, padding: 8 },
  skipText: { color: colors.textSecondary, fontSize: 14 },
  slide: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 20,
  },
  iconWrap: {
    width: 120, height: 120, borderRadius: 36,
    justifyContent: "center", alignItems: "center",
    borderWidth: 2, marginBottom: 8,
  },
  icon: { fontSize: 56 },
  pill: {
    paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
  },
  pillText: { fontSize: 13, fontWeight: "700", letterSpacing: 1 },
  title: {
    color: colors.textPrimary,
    fontSize: 28, fontWeight: "bold",
    textAlign: "center", letterSpacing: -0.5,
  },
  desc: {
    color: colors.textSecondary,
    fontSize: 16, textAlign: "center",
    lineHeight: 24,
  },
  dotsRow: {
    flexDirection: "row", justifyContent: "center",
    gap: 8, marginBottom: 24,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.borderSubtle,
  },
  dotActive: { width: 24 },
  footer: { paddingHorizontal: 24 },
  nextBtn: {
    width: "100%", padding: 20,
    borderRadius: 22, alignItems: "center",
    shadowOpacity: 0.4, shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  nextBtnText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
});
