// ─────────────────────────────────────────────────────────────────
// nfcService.js — NFC STUB
// react-native-nfc-manager SDK 36-tal nem kompatibilis
// Sprint 2-ben visszarakjuk kompatibilis verzióval
// Registless 2026-03-22
// ─────────────────────────────────────────────────────────────────

export async function initNfc() {
  return false;
}

export async function isNfcAvailable() {
  return false;
}

export async function writeNfcTag(profileData) {
  throw new Error("NFC jelenleg nem elérhető. Hamarosan!");
}

export async function readNfcTag() {
  throw new Error("NFC jelenleg nem elérhető. Hamarosan!");
}

export async function nfcBeamExchange(myProfile, onPartnerReceived) {
  throw new Error("NFC jelenleg nem elérhető. Hamarosan!");
}

export function cancelNfc() {}
