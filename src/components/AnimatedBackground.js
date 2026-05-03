import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: W, height: H } = Dimensions.get('window');
const MODES = ['ember', 'aurora', 'particles', 'pulse', 'mesh'];
const CYCLE_MS = 15000;
const FADE_MS  = 1200;

// ─────────────────────────────────────────────────────────────
// 1. EMBER – parázs glowok
// ─────────────────────────────────────────────────────────────
function EmberBG() {
  const orbs = useRef(
    [
      { x: W * 0.72, y: H * 0.78, s: 220 },
      { x: W * 0.15, y: H * 0.88, s: 170 },
      { x: W * 0.48, y: H * 0.62, s: 140 },
      { x: W * 0.88, y: H * 0.52, s: 120 },
      { x: W * 0.28, y: H * 0.42, s: 100 },
    ].map((o, i) => ({
      ...o,
      opacity: new Animated.Value(0.2 + i * 0.05),
      scale:   new Animated.Value(1),
      tx:      new Animated.Value(0),
      ty:      new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    orbs.forEach((orb, i) => {
      const d = 3500 + i * 600;
      const m = 6000 + i * 800;
      Animated.loop(Animated.sequence([
        Animated.timing(orb.opacity, { toValue: 0.65, duration: d, useNativeDriver: true }),
        Animated.timing(orb.opacity, { toValue: 0.15, duration: d, useNativeDriver: true }),
      ])).start();
      Animated.loop(Animated.sequence([
        Animated.timing(orb.scale, { toValue: 1.28, duration: d + 400, useNativeDriver: true }),
        Animated.timing(orb.scale, { toValue: 0.80, duration: d + 400, useNativeDriver: true }),
      ])).start();
      Animated.loop(Animated.sequence([
        Animated.timing(orb.tx, { toValue: 20 - i * 7, duration: m, useNativeDriver: true }),
        Animated.timing(orb.tx, { toValue: -20 + i * 5, duration: m, useNativeDriver: true }),
      ])).start();
      Animated.loop(Animated.sequence([
        Animated.timing(orb.ty, { toValue: -18 + i * 5, duration: m + 900, useNativeDriver: true }),
        Animated.timing(orb.ty, { toValue:  18 - i * 4, duration: m + 900, useNativeDriver: true }),
      ])).start();
    });
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0f0f0f' }]}>
      {orbs.map((orb, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: orb.x - orb.s / 2,
            top:  orb.y - orb.s / 2,
            width: orb.s, height: orb.s,
            opacity: orb.opacity,
            transform: [
              { scale: orb.scale },
              { translateX: orb.tx },
              { translateY: orb.ty },
            ],
          }}
        >
          {[1, 0.65, 0.35].map((r, j) => (
            <View key={j} style={{
              position: 'absolute',
              width: orb.s * r, height: orb.s * r,
              borderRadius: orb.s * r / 2,
              left: orb.s * (1 - r) / 2,
              top:  orb.s * (1 - r) / 2,
              backgroundColor: [
                'rgba(200,60,10,0.12)',
                'rgba(220,80,15,0.25)',
                'rgba(240,105,20,0.45)',
              ][j],
            }} />
          ))}
        </Animated.View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. AURORA – kék-lila hullámok
// ─────────────────────────────────────────────────────────────
const AURORA_BANDS = [
  { yFrac: 0.28, h: 130, colors: ['transparent', 'rgba(40,80,200,0.45)', 'rgba(100,20,180,0.38)', 'transparent'] },
  { yFrac: 0.46, h: 110, colors: ['transparent', 'rgba(20,140,110,0.42)', 'rgba(30,70,200,0.32)', 'transparent'] },
  { yFrac: 0.65, h: 120, colors: ['transparent', 'rgba(130,20,200,0.40)', 'rgba(40,90,180,0.42)', 'transparent'] },
];

function AuroraBG() {
  const tys = useRef(AURORA_BANDS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    tys.forEach((ty, i) => {
      Animated.loop(Animated.sequence([
        Animated.timing(ty, { toValue:  28 + i * 12, duration: 5500 + i * 1200, useNativeDriver: true }),
        Animated.timing(ty, { toValue: -(28 + i * 12), duration: 5500 + i * 1200, useNativeDriver: true }),
      ])).start();
    });
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#08080f' }]}>
      {AURORA_BANDS.map((band, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', left: 0, right: 0,
          top: H * band.yFrac, height: band.h,
          transform: [{ translateY: tys[i] }],
        }}>
          <LinearGradient colors={band.colors} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ))}
      {/* Narancsos brand glow */}
      <View style={{
        position: 'absolute', bottom: -60, right: -40,
        width: 220, height: 220, borderRadius: 110,
        backgroundColor: 'rgba(229,90,30,0.18)',
      }} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. PARTICLES – felszálló részecskék
// ─────────────────────────────────────────────────────────────
const PARTICLE_COUNT = 30;

function ParticlesBG() {
  const particles = useRef(
    Array.from({ length: PARTICLE_COUNT }, () => ({
      x:     10 + Math.random() * (W - 20),
      size:  1 + Math.random() * 2.5,
      speed: 4500 + Math.random() * 5000,
      delay: Math.random() * 5000,
      ty:    new Animated.Value(H + 10),
      op:    new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    particles.forEach(p => {
      const loop = () => {
        p.ty.setValue(H + 10);
        p.op.setValue(0);
        Animated.parallel([
          Animated.timing(p.ty, { toValue: -10, duration: p.speed, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(p.op, { toValue: 0.85, duration: p.speed * 0.15, useNativeDriver: true }),
            Animated.timing(p.op, { toValue: 0.85, duration: p.speed * 0.70, useNativeDriver: true }),
            Animated.timing(p.op, { toValue: 0,    duration: p.speed * 0.15, useNativeDriver: true }),
          ]),
        ]).start(loop);
      };
      setTimeout(loop, p.delay);
    });
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0d0d0d' }]}>
      <View style={{
        position: 'absolute', bottom: -80, left: W * 0.5 - 100,
        width: 200, height: 200, borderRadius: 100,
        backgroundColor: 'rgba(229,90,30,0.22)',
      }} />
      {particles.map((p, i) => (
        <Animated.View key={i} style={{
          position: 'absolute',
          left: p.x,
          top: 0,
          width: p.size, height: p.size,
          borderRadius: p.size / 2,
          backgroundColor: 'rgba(229,110,40,0.9)',
          opacity: p.op,
          transform: [{ translateY: p.ty }],
        }} />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. PULSE – pulzáló körök
// ─────────────────────────────────────────────────────────────
const RING_COUNT = 4;
const BASE_R = 50;
const CX = W / 2;
const CY = H * 0.75;

function PulseBG() {
  const rings = useRef(
    Array.from({ length: RING_COUNT }, (_, i) => ({
      scale: new Animated.Value(0.3),
      op:    new Animated.Value(0),
      delay: i * 1600,
    }))
  ).current;

  useEffect(() => {
    rings.forEach(ring => {
      const loop = () => {
        ring.scale.setValue(0.3);
        ring.op.setValue(0.75);
        Animated.parallel([
          Animated.timing(ring.scale, { toValue: 3.8, duration: 6400, useNativeDriver: true }),
          Animated.timing(ring.op,    { toValue: 0,   duration: 6400, useNativeDriver: true }),
        ]).start(loop);
      };
      setTimeout(loop, ring.delay);
    });
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0d0d0d' }]}>
      {/* Kék accent */}
      <View style={{
        position: 'absolute', top: H * 0.15 - 60, left: W * 0.15 - 60,
        width: 120, height: 120, borderRadius: 60,
        backgroundColor: 'rgba(50,100,200,0.13)',
      }} />
      {/* Belső glow */}
      {[1, 0.6, 0.3].map((r, i) => (
        <View key={i} style={{
          position: 'absolute',
          width: BASE_R * 2 * r, height: BASE_R * 2 * r,
          borderRadius: BASE_R * r,
          left: CX - BASE_R * r, top: CY - BASE_R * r,
          backgroundColor: `rgba(229,90,30,${[0.22, 0.35, 0.55][i]})`,
        }} />
      ))}
      {rings.map((ring, i) => (
        <Animated.View key={i} style={{
          position: 'absolute',
          width: BASE_R * 2, height: BASE_R * 2,
          borderRadius: BASE_R,
          left: CX - BASE_R, top: CY - BASE_R,
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
// 5. MESH – mozgó pontháló
// ─────────────────────────────────────────────────────────────
const MESH_COUNT = 12;

function MeshBG() {
  const dots = useRef(
    Array.from({ length: MESH_COUNT }, () => {
      const sx = 20 + Math.random() * (W - 40);
      const sy = 20 + Math.random() * (H - 40);
      return { x: new Animated.Value(sx), y: new Animated.Value(sy), cx: sx, cy: sy };
    })
  ).current;

  useEffect(() => {
    dots.forEach(dot => {
      const move = () => {
        dot.cx = Math.max(20, Math.min(W - 20, dot.cx + (Math.random() - 0.5) * 110));
        dot.cy = Math.max(20, Math.min(H - 20, dot.cy + (Math.random() - 0.5) * 110));
        Animated.parallel([
          Animated.timing(dot.x, { toValue: dot.cx, duration: 2800 + Math.random() * 2000, useNativeDriver: true }),
          Animated.timing(dot.y, { toValue: dot.cy, duration: 2800 + Math.random() * 2000, useNativeDriver: true }),
        ]).start(move);
      };
      setTimeout(move, Math.random() * 1500);
    });
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#09090e' }]}>
      <View style={{
        position: 'absolute', bottom: -50, right: -30,
        width: 180, height: 180, borderRadius: 90,
        backgroundColor: 'rgba(229,90,30,0.2)',
      }} />
      <View style={{
        position: 'absolute', top: H * 0.3 - 80, left: -30,
        width: 160, height: 160, borderRadius: 80,
        backgroundColor: 'rgba(40,90,200,0.12)',
      }} />
      {dots.map((dot, i) => (
        <Animated.View key={i} style={{
          position: 'absolute',
          width: 5, height: 5, borderRadius: 2.5,
          backgroundColor: 'rgba(229,90,30,0.65)',
          transform: [{ translateX: dot.x }, { translateY: dot.y }],
          marginLeft: -2.5, marginTop: -2.5,
        }} />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN – váltakozó háttér
// ─────────────────────────────────────────────────────────────
const BG_MAP = { ember: EmberBG, aurora: AuroraBG, particles: ParticlesBG, pulse: PulseBG, mesh: MeshBG };

export default function AnimatedBackground({ children }) {
  const idxRef      = useRef(0);
  const [curIdx, setCurIdx]   = useState(0);
  const [nextIdx, setNextIdx] = useState(null);
  const transitioning = useRef(false);
  const curOpacity  = useRef(new Animated.Value(1)).current;
  const nextOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setInterval(() => {
      if (transitioning.current) return;
      transitioning.current = true;
      const next = (idxRef.current + 1) % MODES.length;
      nextOpacity.setValue(0);
      setNextIdx(next);
      Animated.parallel([
        Animated.timing(curOpacity,  { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
        Animated.timing(nextOpacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
      ]).start(() => {
        idxRef.current = next;
        setCurIdx(next);
        setNextIdx(null);
        curOpacity.setValue(1);
        nextOpacity.setValue(0);
        transitioning.current = false;
      });
    }, CYCLE_MS);
    return () => clearInterval(timer);
  }, []);

  const CurBG  = BG_MAP[MODES[curIdx]];
  const NextBG = nextIdx !== null ? BG_MAP[MODES[nextIdx]] : null;

  return (
    <View style={styles.container}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: curOpacity }]}>
        <CurBG />
      </Animated.View>
      {NextBG && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: nextOpacity }]}>
          <NextBG />
        </Animated.View>
      )}
      {/* Sötét overlay az olvashatósághoz */}
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
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
});
