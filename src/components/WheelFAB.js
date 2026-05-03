// ─────────────────────────────────────────────────────────────────
// WheelFAB.js — Redesign: egyszerű + FAB + action sheet
// ─────────────────────────────────────────────────────────────────
import React, { useState, useRef } from "react";
import {
  View, Text, TouchableOpacity, Animated, StyleSheet, Dimensions, Pressable,
} from "react-native";

const { width: SW } = Dimensions.get("window");

export default function WheelFAB({ items = [] }) {
  const [open, setOpen]   = useState(false);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const rotAnim   = useRef(new Animated.Value(0)).current;

  function openMenu() {
    setOpen(true);
    Animated.parallel([
      Animated.spring(fadeAnim,  { toValue: 1, useNativeDriver: true, tension: 140, friction: 9 }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 140, friction: 9 }),
      Animated.timing(rotAnim,   { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }

  function closeMenu(cb) {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 20, duration: 160, useNativeDriver: true }),
      Animated.timing(rotAnim,   { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(() => { setOpen(false); cb?.(); });
  }

  const rotate = rotAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "45deg"] });

  return (
    <View style={st.root} pointerEvents="box-none">
      {/* Backdrop */}
      {open && (
        <Pressable style={st.backdrop} onPress={() => closeMenu()} />
      )}

      {/* Action items */}
      <Animated.View
        pointerEvents={open ? "auto" : "none"}
        style={[st.sheet, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
      >
        {items.map((item, i) => (
          <TouchableOpacity
            key={item.label || i}
            style={st.actionItem}
            onPress={() => closeMenu(item.onPress)}
            activeOpacity={0.75}
          >
            <View style={st.actionIcon}>
              <Text style={{ fontSize: 18 }}>{item.icon}</Text>
            </View>
            <Text style={st.actionLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>

      {/* FAB button */}
      <TouchableOpacity
        style={[st.fab, open && st.fabOpen]}
        onPress={() => open ? closeMenu() : openMenu()}
        activeOpacity={0.85}
      >
        <Animated.Text style={[st.fabIcon, { transform: [{ rotate }] }]}>+</Animated.Text>
      </TouchableOpacity>
    </View>
  );
}

const st = StyleSheet.create({
  root: {
    position: "absolute",
    bottom: 80,
    alignSelf: "center",
    alignItems: "center",
    zIndex: 999,
  },
  backdrop: {
    position: "absolute",
    top: -1000, left: -SW, right: -SW, bottom: -100,
  },
  sheet: {
    backgroundColor: "rgba(18,18,18,0.97)",
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 14,
    minWidth: 220,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  actionIcon: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: "rgba(229,90,30,0.15)",
    borderWidth: 0.5, borderColor: "rgba(229,90,30,0.3)",
    alignItems: "center", justifyContent: "center",
  },
  actionLabel: {
    color: "#e0e0e0", fontSize: 15, fontWeight: "500",
  },
  fab: {
    width: 54, height: 54, borderRadius: 18,
    backgroundColor: "#e55a1e",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#e55a1e", shadowOpacity: 0.55, shadowRadius: 16, elevation: 12,
  },
  fabOpen: {
    backgroundColor: "#c44a10",
  },
  fabIcon: {
    color: "#fff", fontSize: 28, fontWeight: "300", lineHeight: 32, marginTop: -2,
  },
});
