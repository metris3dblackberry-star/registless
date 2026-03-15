import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const MOCK_CLIENTS = [
  { time: '09:30', name: 'Kovács Anna', note: 'hajvágás' },
  { time: '10:00', name: 'Kiss Péter', note: 'szakáll' },
  { time: '10:30', name: 'Anna Fitness Kft.', note: 'személyi edzés' },
];

export default function RetailerHomeScreen({ navigation, route }) {
  const profileName = route?.params?.profileName || 'retailer';

  return (
    <View style={styles.container}>
      <Text style={styles.topLabel}>{profileName}</Text>
      <Text style={styles.title}>MAI ÜGYFELEK</Text>

      <View style={styles.list}>
        {MOCK_CLIENTS.map((item) => (
          <View key={`${item.time}-${item.name}`} style={styles.card}>
            <Text style={styles.time}>{item.time}</Text>
            <View style={styles.cardTextWrap}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.note}>{item.note}</Text>
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={styles.secondaryFab}
        onPress={() => navigation.navigate('ClientQR')}
        activeOpacity={0.85}
      >
        <Text style={styles.secondaryFabText}>SAJÁT QR</Text>
      </TouchableOpacity>

      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('Scan')}
          activeOpacity={0.85}
        >
          <Text style={styles.fabText}>SCAN QR</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0B',
    paddingTop: 56,
    paddingHorizontal: 18,
  },
  topLabel: {
    color: '#BBBBBB',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 6,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 18,
  },
  list: {
    paddingBottom: 180,
  },
  card: {
    backgroundColor: '#161616',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  time: {
    color: '#FF7A00',
    fontSize: 18,
    fontWeight: '700',
    width: 64,
  },
  cardTextWrap: {
    flex: 1,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 4,
  },
  note: {
    color: '#BBBBBB',
    fontSize: 14,
  },
  secondaryFab: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 118,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 24,
    minHeight: 68,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0B0B0B',
  },
  secondaryFabText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  fabContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 30,
  },
  fab: {
    backgroundColor: '#FF7A00',
    minHeight: 78,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
  },
});
