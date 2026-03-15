import { View, Text, StyleSheet } from 'react-native';
import BigButton from '../components/BigButton';

export default function CheckoutScreen({ route }) {
  const clientId = route?.params?.clientId || 'CL_12345';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>CHECKOUT</Text>
      <Text style={styles.subtitle}>client: {clientId}</Text>

      <View style={styles.actions}>
        <BigButton title="BANKKÁRTYA" />
        <BigButton title="REVOLUT" primary={false} />
        <BigButton title="KÉSZPÉNZ" primary={false} />
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
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#BBBBBB',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 34,
  },
  actions: {
    marginBottom: 12,
  },
});
