import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] crash:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Valami hiba történt</Text>
          <Text style={styles.message}>{this.state.errorMessage}</Text>
          <TouchableOpacity style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>Újra</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  message: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
```

---

## 📁 OCR fájl — előbb mutasd meg a struktúrát

Az OCR screen-hez meg kell néznem hol van. Mutasd meg ezt a mappát:
```
C:\registless\src\
```

vagy
```
C:\registless\app\