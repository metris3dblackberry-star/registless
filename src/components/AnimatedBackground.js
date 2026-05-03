import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');
const RING_COUNT  = 4;
const BASE_R      = 50;
const PULSE_MS    = 6400;
const STAGGER_MS  = 1600;

// Random középpont a viewport biztonságos részén belül (margók a széleken)
function randomCenter() {
  const margin = 100;
  return {
    cx: margin + Math.random() * (W - margin * 2),
    cy: margin + Math.random() * (H - margin * 2),
  };
}

// ─────────────────────────────────────────────────────────────
// PULSE — pulzáló körök, középpont időnként ugrik új helyre
// ─────────────────────────────────────────────────────────────
function PulseBG() {
  const [center, setCenter] = useState(() => randomCenter());
  const { cx, cy } = center;

  const rings = useRef(
    Array.from({ length: RING_COUNT }, (_, i) => ({
      scale: new Animated.Value(0.3),
      op:    new Animated.Value(0),
      delay: i * STAGGER_MS,
    }))
  ).current;

  useEffect(() => {
    rings.forEach((ring) => {
      const loop = () => {
        ring.scale.setValue(0.3);
        ring.op.setValue(0.75);
        Animated.parallel([
          Animated.timing(ring.scale, { toValue: 3.8, duration: PULSE_MS, useNativeDriver: true }),
          Animated.timing(ring.op,    { toValue: 0,   duration: PULSE_MS, useNativeDriver: true }),
        ]).start(loop);
      };
      setTimeout(loop, ring.delay);
    });

    // Központ random ugrik új helyre minden teljes ciklusban (~PULSE_MS + max stagger)
    const totalCycle = PULSE_MS + RING_COUNT * STAGGER_MS;
    const moveTimer = setInterval(() => {
      setCenter(randomCenter());
    }, totalCycle);

    return () => clearInterval(moveTimer);
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#d2b48c' }]}>
      {/* Belső glow — a középpont körül */}
      {[1, 0.6, 0.3].map((r, i) => (
        <View key={`glow-${i}`} style={{
          position: 'absolute',
          width: BASE_R * 2 * r, height: BASE_R * 2 * r,
          borderRadius: BASE_R * r,
          left: cx - BASE_R * r, top: cy - BASE_R * r,
          backgroundColor: `rgba(229,90,30,${[0.22, 0.35, 0.55][i]})`,
        }} />
      ))}
      {/* Pulzáló külső gyűrűk */}
      {rings.map((ring, i) => (
        <Animated.View key={`ring-${i}`} style={{
          position: 'absolute',
          width: BASE_R * 2, height: BASE_R * 2,
          borderRadius: BASE_R,
          left: cx - BASE_R, top: cy - BASE_R,
          borderWidth: 1.5,
          borderColor: 'rgba(229,90,30,1)',
          opacity: ring.op,
          transform: [{ scale: ring.scale }],
        }} />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN — egyszerűsített: csak Pulse, nincs váltakozás
// ─────────────────────────────────────────────────────────────
export default function AnimatedBackground({ children }) {
  return (
    <View style={styles.container}>
      <PulseBG />
      {/* Sötét overlay az olvashatóságért */}
      <View style={styles.overlay} />
      {/* Tartalom */}
      <View style={StyleSheet.absoluteFill}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
});
