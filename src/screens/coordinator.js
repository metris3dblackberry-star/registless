// ─────────────────────────────────────────────────────────────────
// coordinator.js — Üzleti logika coordinator
// Kivezeti az App.js-ből: invoice issue, QR scan, OCR apply,
// service start, partner add, activity log
// ─────────────────────────────────────────────────────────────────
import { Alert, Vibration } from "react-native";
import { createOrGetChannel } from "../../firebase";
import { buildInvoiceHtml, calcLine, calcTotals, formatCurrency } from "../services/invoice";
import { parseBusinessCard, parseCompanyData, parseInvoice } from "../services/ocr";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

// ── Activity event factory ────────────────────────────────────────
export const ActivityType = {
  PARTNER_CREATED:  "partner_created",
  QR_CONNECT:       "qr_connect",
  OCR_IMPORT:       "ocr_import",
  MESSAGE_SENT:     "message_sent",
  BOOKING_REQUEST:  "booking_request",
  BOOKING_ACCEPTED: "booking_accepted",
  SERVICE_STARTED:  "service_started",
  SERVICE_FINISHED: "service_finished",
  INVOICE_ISSUED:   "invoice_issued",
  PAYMENT_REQUESTED:"payment_requested",
};

export function makeActivity(type, text, meta = {}) {
  return {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    text,
    meta,
    createdAt: Date.now(),
  };
}

// ── Partner létrehozás QR-ből ─────────────────────────────────────
export function handleQrScan({
  scannedData,
  activeRole,
  sellerUid,
  buyerUid,
  sellerContacts,
  buyerContacts,
  addContact,
  addActivityToContact,
  navigate,
}) {
  try {
    const parsed = JSON.parse(scannedData);
    const type = parsed.t || parsed.type || "";
    const isSellerQr = type === "seller";
    const isBuyerQr = type === "buyer";
    const uid = parsed.id;

    if (activeRole === "seller" && isBuyerQr) {
      const existing = sellerContacts.find(
        (c) => (uid && c.registlessUid === uid) ||
                (parsed.n && c.name === (parsed.n || parsed.name))
      );
      if (existing) {
        Vibration.vibrate([0, 35, 50, 60]);
        Alert.alert("Ismert partner", `${existing.name} már szerepel a listádban.`);
        navigate("partnerWorkspace", { contactId: existing.id });
        return;
      }
      const newContact = addContact({
        name: parsed.n || parsed.name || "",
        company: parsed.c || parsed.company || "",
        address: parsed.a || parsed.address || "",
        email: parsed.e || parsed.email || "",
        registlessUid: uid || null,
        qrId: uid || null,
        myRoleInRelation: "seller",
        source: "qr",
        channels: { chat: !!(uid && !uid.startsWith("buyer-main")), qr: true, nfc: false },
      });
      addActivityToContact(newContact.id, makeActivity(
        ActivityType.QR_CONNECT, "Partner QR-rel kapcsolódott", { uid }
      ));
      if (sellerUid && uid && !uid.startsWith("buyer-main") && sellerUid !== uid) {
        createOrGetChannel(sellerUid, uid).catch(() => {});
      }
      Vibration.vibrate([0, 35, 50, 60]);
      Alert.alert("Új partner", `${newContact.name || "Partner"} hozzáadva!`);
      navigate("partnerWorkspace", { contactId: newContact.id });

    } else if (activeRole === "buyer" && isSellerQr) {
      const existing = buyerContacts.find((c) => uid && c.registlessUid === uid);
      if (existing) {
        Vibration.vibrate([0, 35, 50, 60]);
        navigate("partnerWorkspace", { contactId: existing.id });
        return;
      }
      const newContact = addContact({
        name: parsed.n || parsed.name || "",
        company: parsed.c || parsed.company || "",
        address: parsed.a || parsed.address || "",
        email: parsed.e || parsed.email || "",
        taxNumber: parsed.tx || parsed.taxNumber || "",
        bankAccount: parsed.b || parsed.bankAccount || "",
        registlessUid: uid || null,
        qrId: uid || null,
        myRoleInRelation: "buyer",
        source: "qr",
        channels: { chat: !!(uid && !uid.startsWith("seller-main")), qr: true, nfc: false },
      });
      addActivityToContact(newContact.id, makeActivity(
        ActivityType.QR_CONNECT, "Eladó QR-rel kapcsolódott", { uid }
      ));
      if (buyerUid && uid && !uid.startsWith("seller-main") && buyerUid !== uid) {
        createOrGetChannel(uid, buyerUid).catch(() => {});
      }
      Vibration.vibrate([0, 35, 50, 60]);
      Alert.alert("Új kapcsolat", `${newContact.name || "Eladó"} hozzáadva!`);
      navigate("partnerWorkspace", { contactId: newContact.id });
    } else {
      Alert.alert("QR", "Ez a QR kód nem ehhez a módhoz tartozik.");
    }
  } catch (e) {
    Alert.alert("QR hiba", "Nem sikerült értelmezni a QR kódot.");
  }
}

// ── OCR apply handler ─────────────────────────────────────────────
export function applyOcrResult({
  parsed,
  useCase,          // "profile" | "partner" | "invoice"
  activeRole,
  appState,         // { setSellerName, setBuyerName, addContact, addActivityToContact, ... }
  navigate,
}) {
  if (useCase === "profile") {
    if (activeRole === "seller") {
      if (parsed.name) appState.setSellerName(parsed.name);
      if (parsed.address) appState.setSellerAddress(parsed.address);
      if (parsed.company) appState.setSellerCompany(parsed.company);
      if (parsed.taxNumber) appState.setSellerTaxNumber(parsed.taxNumber);
      if (parsed.bankAccount) appState.setSellerBankAccount(parsed.bankAccount);
      Alert.alert("✅ OCR", "Eladó profil frissítve.");
    } else {
      if (parsed.name) appState.setBuyerName(parsed.name);
      if (parsed.address) appState.setBuyerAddress(parsed.address);
      if (parsed.company) appState.setBuyerCompany(parsed.company);
      Alert.alert("✅ OCR", "Vevő profil frissítve.");
    }
    navigate(activeRole === "seller" ? "sellerDashboard" : "buyerDashboard");
    return;
  }

  if (useCase === "partner") {
    const newContact = appState.addContact({
      name: parsed.name || "",
      company: parsed.company || "",
      address: parsed.address || "",
      email: parsed.email || "",
      phone: parsed.phone || "",
      taxNumber: parsed.taxNumber || "",
      myRoleInRelation: activeRole,
      source: "ocr",
      channels: { chat: false, qr: false, nfc: false },
    });
    appState.addActivityToContact(newContact.id, makeActivity(
      ActivityType.OCR_IMPORT,
      `Partner hozzáadva OCR-rel: ${parsed.name || ""}`,
      { source: "ocr" }
    ));
    Alert.alert(
      "✅ Partner hozzáadva",
      `${parsed.name || "Névtelen partner"} sikeresen létrehozva!`,
      [{ text: "OK", onPress: () => navigate(activeRole === "seller" ? "sellerDashboard" : "buyerDashboard") }]
    );
    return;
  }

  if (useCase === "invoice") {
    Alert.alert(
      "Számla elemzés",
      `Azonosító: ${parsed.invoiceId || "–"}\nDátum: ${parsed.date || "–"}\nÖsszeg: ${formatCurrency(parsed.totalAmount || 0)}`
    );
    navigate(activeRole === "seller" ? "sellerDashboard" : "buyerDashboard");
  }
}

// ── Számla kiállítás ──────────────────────────────────────────────
export async function issueInvoice({
  contactId,
  getContactById,
  addInvoiceToContact,
  addActivityToContact,
  nextInvoiceNumber,
  sellerProfile,
}) {
  const contact = getContactById(contactId);
  if (!contact) return;
  const openItems = contact.openItems || [];
  if (openItems.length === 0) {
    Alert.alert("Nincs nyitott tétel", "Indíts előbb egy szolgáltatást.");
    return;
  }

  const invoiceId = nextInvoiceNumber();
  const date = new Date().toLocaleDateString("hu-HU");
  const tetelek = openItems.map((oi) =>
    calcLine(oi.serviceName || "Szolgáltatás", 1, oi.netto || oi.nettoAmount || Math.round((oi.amount || 0) / 1.27))
  );
  const totals = calcTotals(tetelek);

  const invoice = {
    id: invoiceId,
    datum: date,
    tetelek,
    nettoOsszesen: totals.netto,
    afaOsszesen: totals.afa27,
    bruttoOsszesen: totals.brutto,
    appointmentIds: openItems.map((oi) => oi.appointmentId).filter(Boolean),
    createdAt: Date.now(),
  };

  addInvoiceToContact(contactId, invoice);
  addActivityToContact(contactId, makeActivity(
    ActivityType.INVOICE_ISSUED,
    `Számla kiállítva: ${invoiceId}`,
    { invoiceId, amount: totals.brutto }
  ));

  // PDF generálás
  try {
    const html = buildInvoiceHtml({
      seller: sellerProfile,
      buyer: { name: contact.name, company: contact.company, address: contact.address },
      items: tetelek,
      invoiceId,
      date,
    });
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `Számla: ${invoiceId}`,
      });
    }
  } catch (e) {
    console.log("PDF hiba:", e);
  }

  Alert.alert("✅ Számla kiállítva", `${invoiceId} · ${formatCurrency(totals.brutto)}`);
}

// ── Draft mentés ──────────────────────────────────────────────────
export function saveDraft(appState, contactId, key, data) {
  appState.updateContact(contactId, {
    drafts: {
      ...(appState.getContactById(contactId)?.drafts || {}),
      [key]: { ...data, savedAt: Date.now() },
    },
  });
}

export function loadDraft(appState, contactId, key) {
  return appState.getContactById(contactId)?.drafts?.[key] || null;
}

export function clearDraft(appState, contactId, key) {
  const contact = appState.getContactById(contactId);
  if (!contact) return;
  const drafts = { ...(contact.drafts || {}) };
  delete drafts[key];
  appState.updateContact(contactId, { drafts });
}
