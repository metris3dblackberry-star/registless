import { TouchableOpacity, Text, StyleSheet } from 'react-native';

export default function BigButton({ title, onPress, primary = true }) {
  return (
    <TouchableOpacity
      style={[styles.btn, primary ? styles.primary : styles.secondary]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={styles.txt}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 24,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    minHeight: 88,
  },
  primary: {
    backgroundColor: '#FF7A00',
  },
  secondary: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#0B0B0B',
  },
  txt: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
});
