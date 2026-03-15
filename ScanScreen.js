import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';

export default function ScanScreen({ navigation }) {
  const [permission, setPermission] = useState(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    BarCodeScanner.requestPermissionsAsync().then(({ status }) => {
      setPermission(status === 'granted');
    });
  }, []);

  const handleScan = ({ data }) => {
    if (scanned) return;
    setScanned(true);
    navigation.replace('Checkout', { clientId: data });
  };

  if (permission === false) {
    return (
      <View style={styles.center}>
        <Text style={styles.info}>nincs kamera engedély</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <BarCodeScanner
        onBarCodeScanned={scanned ? undefined : handleScan}
        style={{ flex: 1 }}
      />
      <View style={styles.overlay}>
        <Text style={styles.heading}>SCAN CLIENT QR</Text>
        <Text style={styles.sub}>irányítsd a kamerát a kliens QR-jára</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#0B0B0B',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  info: {
    color: '#FFFFFF',
    fontSize: 18,
    textAlign: 'center',
  },
  overlay: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 30,
    backgroundColor: 'rgba(11,11,11,0.8)',
    borderRadius: 24,
    padding: 18,
  },
  heading: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  sub: {
    color: '#BBBBBB',
    fontSize: 14,
    textAlign: 'center',
  },
});
