// ─────────────────────────────────────────────────────────────────
// useOcr.js — Kétréteges OCR hook
// Réteg 1: nyers szöveg kinyerés (ML Kit / kamera / galéria)
// Réteg 2: parser (profil / partner / számla use case-enként)
// ─────────────────────────────────────────────────────────────────
import { useState } from "react";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { analyzeOcrText, parseBusinessCard as analyzeWithRegex } from "../services/ocr";

// ML Kit stub — natív build nélkül (Expo Go) kamera OCR nem elérhető
const TextRecognition = {
  recognize: async () => {
    throw new Error("A kamerás OCR csak natív buildben érhető el. Használd a szöveg beillesztése funkciót!");
  },
};

export function useOcr() {
  const [rawText, setRawText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // ── Réteg 1: Nyers szöveg kinyerés ───────────────────────────

  async function recognizeFromUri(imageUri) {
    try {
      const result = await TextRecognition.recognize(imageUri);
      const text = result?.text || "";
      setRawText(text);
      return text;
    } catch (e) {
      throw new Error("ML Kit OCR sikertelen: " + e.message);
    }
  }

  async function pickFromGallery() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm?.granted) {
      Alert.alert("OCR", "A képgaléria engedélye szükséges.");
      return null;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      base64: false,
    });
    if (picked?.canceled || !picked?.assets?.length) return null;
    return picked.assets[0].uri;
  }

  async function fromGallery() {
    setIsProcessing(true);
    try {
      const uri = await pickFromGallery();
      if (!uri) return null;
      return await recognizeFromUri(uri);
    } catch (e) {
      Alert.alert("OCR hiba", e.message);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }

  async function fromCameraPhoto(photoUri) {
    setIsProcessing(true);
    try {
      return await recognizeFromUri(photoUri);
    } catch (e) {
      Alert.alert("OCR hiba", e.message);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }

  // ── Réteg 2: Parser use case-enként ──────────────────────────

  /**
   * Saját profil kitöltése (seller vagy buyer)
   * Visszaad: { name, company, address, email, taxNumber, bankAccount, phone }
   */
  async function parseForProfile(text = rawText) {
    setIsProcessing(true);
    try {
      return await analyzeOcrText(text);
    } finally {
      setIsProcessing(false);
    }
  }

  /**
   * Új partner felvétele névjegyből / dokumentumból
   * Visszaad: { name, company, address, email, phone, taxNumber }
   */
  async function parseForPartner(text = rawText) {
    setIsProcessing(true);
    try {
      const result = await analyzeOcrText(text);
      return {
        name: result.name || "",
        company: result.company || "",
        address: result.address || "",
        email: result.email || "",
        phone: result.phone || "",
        taxNumber: result.taxNumber || "",
      };
    } finally {
      setIsProcessing(false);
    }
  }

  /**
   * Számla / dokumentum elemzése
   * Visszaad: { invoiceId, date, seller, buyer, items, total }
   */
  async function parseForInvoice(text = rawText) {
    setIsProcessing(true);
    try {
      // Regex alapú számla-specifikus elemzés
      const invoiceId = text.match(/\b(RGTL|INV|SZL|SZLA)[-\s]?\d+/i)?.[0] || "";
      const date = text.match(/\b\d{4}[.\-]\d{2}[.\-]\d{2}\.?\b/)?.[0] || "";
      const amounts = [...text.matchAll(/\b(\d[\d\s]{3,})\s*(Ft|HUF|EUR)\b/gi)]
        .map((m) => ({ raw: m[0], value: parseInt(m[1].replace(/\s/g, ""), 10) }));

      const baseFields = analyzeWithRegex(text);

      return {
        invoiceId,
        date,
        amounts,
        seller: { name: baseFields.name, company: baseFields.company, taxNumber: baseFields.taxNumber },
        rawText: text,
      };
    } finally {
      setIsProcessing(false);
    }
  }

  return {
    rawText,
    setRawText,
    isProcessing,
    // Réteg 1
    fromGallery,
    fromCameraPhoto,
    recognizeFromUri,
    // Réteg 2
    parseForProfile,
    parseForPartner,
    parseForInvoice,
  };
}
