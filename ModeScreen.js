import { View, StyleSheet, Text } from 'react-native';
import BigButton from '../components/BigButton';

export default function ModeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>REGISTLESS</Text>
      <Text style={styles.subtitle}>type less. earn more.</Text>

      <View style={styles.actions}>
        <BigButton title="RETAILER" onPress={() => navigation.navigate('ManualReg')} />
        <BigButton title="CLIENT" primary={false} onPress={() => navigation.navigate('ClientQR')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0B',
    justifyContent: 'flex-end',
    padding: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#BBBBBB',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 36,
  },
  actions: {
    marginBottom: 18,
  },
});
