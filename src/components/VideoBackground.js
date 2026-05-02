import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Video, ResizeMode } from 'expo-av';

const VIDEO_URL =
  'https://pub-4a3c1c2a20d7c1931b82b95825172de2.r2.dev/registless/R-84.9.mp4';

export default function VideoBackground({ children }) {
  const [videoError, setVideoError] = useState(false);

  if (videoError) {
    return (
      <View style={[styles.container, { backgroundColor: '#0a0a0a' }]}>
        {children}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Video
        source={{ uri: VIDEO_URL }}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        isLooping
        isMuted
        shouldPlay
        onError={(error) => {
          console.warn('[VideoBackground] hiba, fallback:', error);
          setVideoError(true);
        }}
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
});
