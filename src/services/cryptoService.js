// ─────────────────────────────────────────────────────────────────
// cryptoService.js — E2E titkosítás (EAS Build ready)
// SecureStore natív modulon fut
// ─────────────────────────────────────────────────────────────────
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';

import * as SecureStore from 'expo-secure-store';

const PRIV_KEY = 'registless_priv_key';
const PUB_KEY  = 'registless_pub_key';

async function saveKey(key, value) {
  await SecureStore.setItemAsync(key, value);
}

async function loadKey(key) {
  return await SecureStore.getItemAsync(key);
}

export async function initKeyPair(uid) {
  let priv = await loadKey(PRIV_KEY);
  let pub  = await loadKey(PUB_KEY);

  if (!priv || !pub) {
    const keyPair = nacl.box.keyPair();
    priv = encodeBase64(keyPair.secretKey);
    pub  = encodeBase64(keyPair.publicKey);
    await saveKey(PRIV_KEY, priv);
    await saveKey(PUB_KEY,  pub);
  }

  await setDoc(doc(db, 'users', uid), { publicKey: pub }, { merge: true });
  return pub;
}

export async function getPrivateKey() {
  return await loadKey(PRIV_KEY);
}

export async function getPublicKey(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data().publicKey ?? null : null;
}

export function encryptMsg(plaintext, recipientPubB64, senderPrivB64) {
  const nonce     = nacl.randomBytes(nacl.box.nonceLength);
  const encrypted = nacl.box(
    encodeUTF8(plaintext),
    nonce,
    decodeBase64(recipientPubB64),
    decodeBase64(senderPrivB64),
  );
  return {
    ciphertext: encodeBase64(encrypted),
    nonce:      encodeBase64(nonce),
  };
}

export function decryptMsg(ciphertextB64, nonceB64, senderPubB64, recipientPrivB64) {
  const result = nacl.box.open(
    decodeBase64(ciphertextB64),
    decodeBase64(nonceB64),
    decodeBase64(senderPubB64),
    decodeBase64(recipientPrivB64),
  );
  if (!result) throw new Error('Visszafejtés sikertelen');
  return decodeUTF8(result);
}
