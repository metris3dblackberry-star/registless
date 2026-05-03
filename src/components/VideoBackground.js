import React, { useRef, useState } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { Video, ResizeMode } from 'expo-av';

// Local asset — APK-ba épül, azonnali playback minden home navigálásnál
const VIDEO_ASSET = require('../../assets/videos/R-84.9.mp4');

export default function VideoBackground({ children }) {
  const videoRef = useRef(null);
  const [error, setError] = useState(false);

  if (Platform.OS === 'web' || error) {
    return (
      <View style={[styles.container, styles.fallback]}>
        {children}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Video
        ref={videoRef}
        source={VIDEO_ASSET}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
        onError={() => setError(true)}
      />
      <View style={styles.overlay} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fallback: {
    backgroundColor: '#0a0a0a',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
});
