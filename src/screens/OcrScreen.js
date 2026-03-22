import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Clipboard,
} from 'react-native';

const HINT_LABELS = {
  NA: 'Név',
  TE: 'Telefonszám',
  EM: 'Email',
  TX: 'Adószám',
  AD: 'Cím',
  BA: 'Bankszámlaszám',
};

function parseOCRHints(text) {
  const results = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const match = line.match(/^(NA|TE|EM|TX|AD|BA)[:\s]+(.+)$/i);
    if (match) {
      const code = match[1].toUpperCase();
      results.push({
        code,
        label: HINT_LABELS[code] || code,
        value: match[2].trim(),
      });
    }
  }

  if (results.length === 0 && text.trim().length > 0) {
    results.push({ code: 'NA', label: 'Beolvasott szöveg', value: text.trim() });
  }

  return results;
}

export default function OCRScreen() {
  const [inputText, setInputText] = useState('');
  const [parsedFields, setParsedFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analysisMode, setAnalysisMode] = useState('local');

  const handlePasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getString();
      if (text) {
        setInputText(text);
      } else {
        Alert.alert('Üres vágólap', 'Nincs szöveg a vágólapon.');
      }
    } catch {
      Alert.alert('Hiba', 'Nem sikerült beolvasni a vágólapot.');
    }
  };

  const handleAnalyze = async () => {
    if (!inputText.trim()) {
      Alert.alert('Üres mező', 'Illeszd be a felismert szöveget elemzés előtt.');
      return;
    }

    setLoading(true);

    try {
      if (analysisMode === 'local') {
        const fields = parseOCRHints(inputText);
        setParsedFields(fields);
      } else {
        const response = await fetch(
          'https://us-central1-registless-default-rtdb.cloudfunctions.net/ocrAnalyze',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: inputText }),
          }
        );
        const data = await response.json();
        if (data.fields) {
          setParsedFields(data.fields);
        } else {
          setParsedFields(parseOCRHints(inputText));
        }
      }
    } catch (error) {
      console.warn('[OCR] hiba, lokális parse:', error);
      setParsedFields(parseOCRHints(inputText));
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setInputText('');
    setParsedFields([]);
  };

  const handleCopyField = (value) => {
    Clipboard.setString(value);
    Alert.alert('Másolva', `"${value}" a vágólapon.`);
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>Szöveg beillesztése</Text>
        <Text style={styles.subtitle}>
          Fényképezd le a dokumentumot, majd illeszd be a felismert szöveget
        </Text>
      </View>

      {/* Hint kódok */}
      <View style={styles.hintsRow}>
        {Object.entries(HINT_LABELS).map(([code, label]) => (
          <View key={code} style={styles.hintBadge}>
            <Text style={styles.hintCode}>{code}</Text>
            <Text style={styles.hintLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          multiline
          numberOfLines={8}
          placeholder={
            'Illeszd be a szöveget ide...\n\nPélda:\nNA: Kovács János\nEM: kovacs@email.com\nTE: +36 30 123 4567'
          }
          placeholderTextColor="#555"
          value={inputText}
          onChangeText={setInputText}
          textAlignVertical="top"
        />
        <View style={styles.inputActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={handlePasteFromClipboard}>
            <Text style={styles.actionBtnText}>📋 Beillesztés vágólapról</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.clearBtn]} onPress={handleClear}>
            <Text style={styles.actionBtnText}>🗑 Törlés</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Mód választó */}
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeBtn, analysisMode === 'local' && styles.modeBtnActive]}
          onPress={() => setAnalysisMode('local')}
        >
          <Text style={styles.modeBtnText}>Lokális</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, analysisMode === 'ai' && styles.modeBtnActive]}
          onPress={() => setAnalysisMode('ai')}
        >
          <Text style={styles.modeBtnText}>AI (Firebase)</Text>
        </TouchableOpacity>
      </View>

      {/* Elemzés gomb */}
      <TouchableOpacity
        style={[styles.analyzeBtn, loading && styles.analyzeBtnDisabled]}
        onPress={handleAnalyze}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.analyzeBtnText}>Elemzés indítása</Text>
        )}
      </TouchableOpacity>

      {/* Eredmények */}
      {parsedFields.length > 0 && (
        <View style={styles.results}>
          <Text style={styles.resultsTitle}>Felismert mezők</Text>
          {parsedFields.map((field, index) => (
            <TouchableOpacity
              key={index}
              style={styles.fieldCard}
              onPress={() => handleCopyField(field.value)}
              activeOpacity={0.7}
            >
              <View style={styles.fieldHeader}>
                <View style={styles.fieldCodeBadge}>
                  <Text style={styles.fieldCode}>{field.code}</Text>
                </View>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                <Text style={styles.fieldCopyHint}>másolás</Text>
              </View>
              <Text style={styles.fieldValue}>{field.value}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: '#666',
    fontSize: 13,
    lineHeight: 18,
  },
  hintsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  hintBadge: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  hintCode: {
    color: '#4fc3f7',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  hintLabel: {
    color: '#888',
    fontSize: 10,
    marginTop: 1,
  },
  inputContainer: {
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 10,
    color: '#fff',
    fontSize: 14,
    padding: 12,
    minHeight: 160,
    fontFamily: 'monospace',
  },
  inputActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  clearBtn: {
    flex: 0.5,
  },
  actionBtnText: {
    color: '#ccc',
    fontSize: 13,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  modeBtnActive: {
    borderColor: '#4fc3f7',
    backgroundColor: '#0d2a36',
  },
  modeBtnText: {
    color: '#ccc',
    fontSize: 13,
    fontWeight: '500',
  },
  analyzeBtn: {
    backgroundColor: '#4fc3f7',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  analyzeBtnDisabled: {
    opacity: 0.5,
  },
  analyzeBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },
  results: {
    gap: 10,
  },
  resultsTitle: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  fieldCard: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 10,
    padding: 12,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  fieldCodeBadge: {
    backgroundColor: '#0d2a36',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  fieldCode: {
    color: '#4fc3f7',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  fieldLabel: {
    color: '#888',
    fontSize: 12,
    flex: 1,
  },
  fieldCopyHint: {
    color: '#444',
    fontSize: 11,
  },
  fieldValue: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
});