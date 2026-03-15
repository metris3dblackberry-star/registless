import { View, Text, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

export default function ClientQRScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>CLIENT QR</Text>
      <Text style={styles.subtitle}>mutasd a QR-od fizetésnél és időpontnál</Text>

      <View style={styles.qrCard}>
        <QRCode value="CL_12345" size={220} backgroundColor="#FFFFFF" color="#000000" />
      </View>

      <View style={styles.bottomArea}>
        <View style={styles.smallCard}>
          <Text style={styles.smallCardTitle}>kapcsolataim</Text>
          <Text style={styles.smallCardText}>fodrászom, kisboltom, edzőm</Text>
        </View>
        <View style={styles.smallCard}>
          <Text style={styles.smallCardTitle}>számláim</Text>
          <Text style={styles.smallCardText}>a következő verzióban jön</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0B',
    paddingTop: 56,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: '#BBBBBB',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 28,
  },
  qrCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    marginBottom: 30,
  },
  bottomArea: {
    width: '100%',
    marginTop: 'auto',
    paddingBottom: 30,
  },
  smallCard: {
    backgroundColor: '#161616',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
  },
  smallCardTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  smallCardText: {
    color: '#BBBBBB',
    fontSize: 14,
  },
});
