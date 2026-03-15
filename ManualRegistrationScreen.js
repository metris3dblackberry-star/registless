import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';

export default function ManualRegistrationScreen({ navigation }) {
  const addressRef = useRef(null);
  const companyRef = useRef(null);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [company, setCompany] = useState('');

  const handleNext = () => {
    const entityType = company.trim() === '' ? 'private_person' : 'company';

    console.log('PROFILE_CREATED', {
      name,
      address,
      company,
      entityType,
    });

    navigation.navigate('RetailerHome', {
      profileName: company.trim() || name.trim() || 'új profil',
    });
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View>
            <Text style={styles.title}>kézi regisztráció</Text>

            <Text style={styles.label}>név – írd folytatólagosan</Text>
            <TextInput
              style={styles.input}
              autoFocus
              value={name}
              onChangeText={setName}
              placeholder="pl. Kovács Anna"
              placeholderTextColor="#888"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => addressRef.current?.focus()}
            />

            <Text style={styles.label}>cím – írd folytatólagosan</Text>
            <TextInput
              ref={addressRef}
              style={styles.input}
              value={address}
              onChangeText={setAddress}
              placeholder="pl. 1111 Budapest Fő utca 1."
              placeholderTextColor="#888"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => companyRef.current?.focus()}
            />

            <Text style={styles.label}>cégnév – ha vállalkozás</Text>
            <TextInput
              ref={companyRef}
              style={styles.input}
              value={company}
              onChangeText={setCompany}
              placeholder="pl. Miki Barber Kft."
              placeholderTextColor="#888"
              returnKeyType="done"
              onSubmitEditing={handleNext}
            />

            <Text style={styles.hint}>ha üresen hagyod, akkor nem cég</Text>

            <TouchableOpacity style={styles.button} onPress={handleNext} activeOpacity={0.85}>
              <Text style={styles.buttonText}>TOVÁBB</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B0B0B',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    padding: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
  },
  label: {
    color: '#FFFFFF',
    fontSize: 18,
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#161616',
    color: '#FFFFFF',
    fontSize: 20,
    borderWidth: 2,
    borderColor: '#FF7A00',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  hint: {
    color: '#BBBBBB',
    fontSize: 14,
    marginTop: 8,
  },
  button: {
    backgroundColor: '#FF7A00',
    borderRadius: 20,
    paddingVertical: 22,
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 8,
    minHeight: 88,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
});
