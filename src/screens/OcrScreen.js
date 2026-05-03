import Clipboard from '@react-native-clipboard/clipboard';
import React, { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';

const HINT_LABELS = {
  NA: 'Név',
  CO: 'Cégnév',
  TE: 'Telefonszám',
  EM: 'Email',
  TX: 'Adószám',
  AD: 'Cím',
  BA: 'Bankszámlaszám',
};

function parseOCRHints(text) {
  const results = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // ── CO: Cégnév — Kft/Zrt/Bt stb. case-insensitive ────────────
  const kftRegex = /([A-ZÁÉÍÓÖŐÚÜŰ][A-Za-záéíóöőúüű\s\-&]+(?:kft|zrt|bt|rt|nyrt|kkt|e\.v\.|ev)\.?)/i;
  const kftMatch = text.match(kftRegex);
  if (kftMatch) {
    results.push({ code: 'CO', label: 'Cégnév', value: kftMatch[1].trim() });
  }

  // ── AD: Cím — 4 jegyű irányítószám alapján ───────────────────
  // Formátumok: "1051 Budapest, Arany János u. 12." vagy több sorban
  const addrLineIdx = lines.findIndex(l => /^\d{4}\s+[A-ZÁÉÍÓÖŐÚÜŰ]/.test(l));
  if (addrLineIdx >= 0) {
    let addr = lines[addrLineIdx];
    // Ha a következő sor utca-féle, fűzzük hozzá
    if (addrLineIdx + 1 < lines.length) {
      const nextLine = lines[addrLineIdx + 1];
      if (/\b(utca|út|útja|körút|tér|köz|sor|sétány|sugárút|rakpart|u\.|str\.|road|street)\b/i.test(nextLine)) {
        addr += ', ' + nextLine;
      }
    }
    results.push({ code: 'AD', label: 'Cím', value: addr });
  }

  // ── Explicit kód: NA/CO/TE/EM/TX/AD/BA ───────────────────────
  for (const line of lines) {
    const match = line.match(/^(NA|CO|TE|EM|TX|AD|BA)[:\s]+(.+)$/i);
    if (match) {
      const code = match[1].toUpperCase();
      if (code === 'CO' && results.find(r => r.code === 'CO')) continue;
      if (code === 'AD' && results.find(r => r.code === 'AD')) continue;
      results.push({ code, label: HINT_LABELS[code] || code, value: match[2].trim() });
    }
  }

  if (results.length === 0 && text.trim().length > 0) {
    results.push({ code: 'NA', label: 'Beolvasott szöveg', value: text.trim() });
  }
  return results;
}

function fieldsToObject(fields) {
  const obj = {};
  for (const f of fields) {
    if (f.code === 'NA') obj.name     = f.value;
    if (f.code === 'CO') obj.company  = f.value;
    if (f.code === 'TE') obj.phone    = f.value;
    if (f.code === 'EM') obj.email    = f.value;
    if (f.code === 'AD') obj.address  = f.value;
    if (f.code === 'TX') obj.taxNumber   = f.value;
    if (f.code === 'BA') obj.bankAccount = f.value;
  }
  return obj;
}

export default function OCRScreen({ onBack, onApplyPartner, onApplyProfile, onApplyInvoice }) {
  const [inputText, setInputText]       = useState('');
  const [parsedFields, setParsedFields] = useState([]);
  const [loading, setLoading]           = useState(false);
  const [statusMsg, setStatusMsg]       = useState('');

  const processImageWithAI = async (base64) => {
    setLoading(true);
    setStatusMsg('Claude AI feldolgozás...');
    try {
      const response = await fetch(
        'https://us-central1-registless.cloudfunctions.net/ocrAnalyze',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: `data:image/jpeg;base64,${base64}` }),
        }
      );
      const responseText = await response.text();
      if (responseText.trim().startsWith('<')) throw new Error('Szerver nem elérhető');
      const data = JSON.parse(responseText);
      const raw = data.raw || '';
      if (raw) {
        setInputText(raw);
        const fields = parseOCRHints(raw);
        setParsedFields(fields);
        setStatusMsg(`✓ ${fields.length} mező felismerve`);
      } else {
        setStatusMsg('Nem sikerült adatot kiolvasni');
      }
    } catch (e) {
      setStatusMsg('Hiba: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Engedély szükséges', 'Galéria hozzáférés szükséges.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, quality: 0.8, base64: true,
      });
      if (!result.canceled && result.assets?.[0]?.base64) {
        await processImageWithAI(result.assets[0].base64);
      }
    } catch { Alert.alert('Hiba', 'Képválasztás sikertelen.'); }
  };

  const handleCamera = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { Alert.alert('Engedély szükséges', 'Kamera hozzáférés szükséges.'); return; }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true, quality: 0.8, base64: true,
      });
      if (!result.canceled && result.assets?.[0]?.base64) {
        await processImageWithAI(result.assets[0].base64);
      }
    } catch { Alert.alert('Hiba', 'Kamera megnyitása sikertelen.'); }
  };

  const handleTextAnalyze = () => {
    if (!inputText.trim()) return;
    const fields = parseOCRHints(inputText);
    setParsedFields(fields);
    setStatusMsg(`✓ ${fields.length} mező felismerve`);
  };

  const handleCopyField = (value) => {
    Clipboard.setString(value);
    Alert.alert('Másolva', `"${value}" a vágólapon.`);
  };

  const handleApplyPartner = () => {
    if (parsedFields.length === 0) return;
    const parsed = fieldsToObject(parsedFields);
    if (!parsed.name && !parsed.company) {
      Alert.alert('Hiányzó adat', 'Legalább egy név vagy cégnév szükséges.');
      return;
    }
    onApplyPartner?.(parsed);
  };

  const handleApplyProfile = () => {
    if (parsedFields.length === 0) return;
    onApplyProfile?.(fieldsToObject(parsedFields));
  };

  const handleApplyInvoice = () => {
    if (parsedFields.length === 0) return;
    onApplyInvoice?.(fieldsToObject(parsedFields));
  };

  const hasResults = parsedFields.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>📷 Claude AI karakterfelismerés</Text>
        <Text style={styles.topSub}>Névjegykártya, dokumentum, számla</Text>
      </View>

      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.hintsRow}>
          {Object.entries(HINT_LABELS).map(([code, label]) => (
            <View key={code} style={styles.hintBadge}>
              <Text style={styles.hintCode}>{code}</Text>
              <Text style={styles.hintLabel}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.imageBtnRow}>
          <TouchableOpacity style={[styles.imageBtn, styles.cameraBtn]} onPress={handleCamera} disabled={loading}>
            <Text style={styles.cameraBtnText}>📷 Kamera</Text>
            <Text style={styles.btnSub}>Fényképezés</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.imageBtn} onPress={handlePickImage} disabled={loading}>
            <Text style={styles.imageBtnText}>🖼 Galéria</Text>
            <Text style={styles.btnSub}>Kép importálás</Text>
          </TouchableOpacity>
        </View>

        {(loading || statusMsg) && (
          <View style={styles.statusRow}>
            {loading && <ActivityIndicator size="small" color="#b39ddb" style={{ marginRight: 8 }} />}
            <Text style={styles.statusText}>{loading ? 'Claude AI feldolgozás...' : statusMsg}</Text>
          </View>
        )}

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            multiline numberOfLines={5}
            placeholder={'Vagy illeszd be a szöveget kézzel...\n\nPélda:\nNA: Kovács János\nCO: Kovács és Társai Kft\nAD: 1051 Budapest, Arany János u. 12.'}
            placeholderTextColor="#444"
            value={inputText}
            onChangeText={setInputText}
            textAlignVertical="top"
          />
          {inputText.trim().length > 0 && (
            <TouchableOpacity style={styles.analyzeTextBtn} onPress={handleTextAnalyze}>
              <Text style={styles.analyzeTextBtnText}>Szöveg elemzése →</Text>
            </TouchableOpacity>
          )}
        </View>

        {hasResults && (
          <View style={styles.results}>
            <Text style={styles.resultsTitle}>Felismert mezők</Text>
            {parsedFields.map((field, index) => (
              <TouchableOpacity key={index} style={styles.fieldCard} onPress={() => handleCopyField(field.value)} activeOpacity={0.7}>
                <View style={styles.fieldHeader}>
                  <View style={[styles.fieldCodeBadge, field.code === 'CO' && styles.fieldCodeBadgeCo]}>
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

        <View style={{ height: 160 }} />
      </ScrollView>

      {hasResults && (
        <View style={styles.applyBar}>
          <Text style={styles.applyBarTitle}>Mentés ide:</Text>
          <View style={styles.applyRow}>
            {onApplyPartner && (
              <TouchableOpacity style={styles.applyBtn} onPress={handleApplyPartner}>
                <Text style={styles.applyBtnText}>👤 Partner</Text>
              </TouchableOpacity>
            )}
            {onApplyProfile && (
              <TouchableOpacity style={[styles.applyBtn, styles.applyBtnProfile]} onPress={handleApplyProfile}>
                <Text style={styles.applyBtnText}>🏠 Profilom</Text>
              </TouchableOpacity>
            )}
            {onApplyInvoice && (
              <TouchableOpacity style={[styles.applyBtn, styles.applyBtnInvoice]} onPress={handleApplyInvoice}>
                <Text style={styles.applyBtnText}>🧾 Számla</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.floatingBack} onPress={onBack}>
        <Text style={styles.backBtnText}>← Vissza</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { paddingTop: 52, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  topTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  topSub: { color: '#666', fontSize: 12, marginTop: 2 },
  backBtnText: { color: '#ff7a1a', fontSize: 15, fontWeight: '600' },
  floatingBack: { position: 'absolute', bottom: 49, left: 20, backgroundColor: 'rgba(255,122,26,0.15)', borderWidth: 1, borderColor: '#ff7a1a', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 },
  container: { flex: 1, padding: 16 },
  hintsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  hintBadge: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center' },
  hintCode: { color: '#b39ddb', fontSize: 11, fontWeight: '700', fontFamily: 'monospace' },
  hintLabel: { color: '#888', fontSize: 10, marginTop: 1 },
  imageBtnRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  imageBtn: { flex: 1, backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#4fc3f7', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  cameraBtn: { backgroundColor: '#1a2e1a', borderColor: '#2ecc71' },
  imageBtnText: { color: '#4fc3f7', fontSize: 15, fontWeight: '700' },
  cameraBtnText: { color: '#2ecc71', fontSize: 15, fontWeight: '700' },
  btnSub: { color: '#555', fontSize: 11, marginTop: 3 },
  statusRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(100,60,200,0.1)', borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(150,100,255,0.2)' },
  statusText: { color: '#b39ddb', fontSize: 13 },
  inputContainer: { marginBottom: 12 },
  textInput: { backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10, color: '#fff', fontSize: 13, padding: 12, minHeight: 100, fontFamily: 'monospace' },
  analyzeTextBtn: { marginTop: 8, backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#4fc3f7', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  analyzeTextBtnText: { color: '#4fc3f7', fontSize: 13, fontWeight: '600' },
  results: { gap: 10 },
  resultsTitle: { color: '#888', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  fieldCard: { backgroundColor: '#111', borderWidth: 1, borderColor: '#222', borderRadius: 10, padding: 12 },
  fieldHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  fieldCodeBadge: { backgroundColor: '#0d2a36', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  fieldCodeBadgeCo: { backgroundColor: '#1a0d36' },
  fieldCode: { color: '#b39ddb', fontSize: 11, fontWeight: '700', fontFamily: 'monospace' },
  fieldLabel: { color: '#888', fontSize: 12, flex: 1 },
  fieldCopyHint: { color: '#444', fontSize: 11 },
  fieldValue: { color: '#fff', fontSize: 15, fontWeight: '500' },
  applyBar: { position: 'absolute', bottom: 130, right: 16, left: 16, backgroundColor: '#111', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#2a2a2a' },
  applyBarTitle: { color: '#888', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  applyRow: { flexDirection: 'row', gap: 8 },
  applyBtn: { flex: 1, backgroundColor: '#1a3a1a', borderWidth: 1, borderColor: '#2ecc71', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  applyBtnProfile: { backgroundColor: '#1a1a3a', borderColor: '#7a7aff' },
  applyBtnInvoice: { backgroundColor: '#2a1a1a', borderColor: '#ff7a1a' },
  applyBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
