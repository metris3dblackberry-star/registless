// ─────────────────────────────────────────────────────────────────
// useAppState.js — App state + AsyncStorage + RTDB szinkron
// Újratelepítés után Firebase Auth UID alapján visszatölti az adatokat
// ─────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fromSellerCustomer, fromKapcsolat } from "../models/Contact";
import { rtdb } from "../../firebase";

const STORAGE_KEY    = "registless_app_state_v9";
const SELLER_UID_KEY = "registless_seller_uid_v1";
const BUYER_UID_KEY  = "registless_buyer_uid_v1";

function makeId(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── RTDB helpers ─────────────────────────────────────────────────
async function rtdbSave(uid, data) {
  if (!uid) return;
  try {
    await rtdb.ref(`appState/${uid}`).update({
      ...data,
      updatedAt: Date.now(),
    });
  } catch (e) {
    console.log("[RTDB] save error:", e.message);
  }
}

async function rtdbLoad(uid) {
  if (!uid) return null;
  try {
    const snap = await rtdb.ref(`appState/${uid}`).once("value");
    return snap.val();
  } catch (e) {
    console.log("[RTDB] load error:", e.message);
    return null;
  }
}

export function useAppState() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [firebaseUid, setFirebaseUid] = useState(null); // Firebase Auth UID

  const [registlessUid, setRegistlessUid] = useState(null);
  const [sellerUid, setSellerUid]         = useState(null);
  const [buyerUid, setBuyerUid]           = useState(null);

  const [sellerName, setSellerName]               = useState("");
  const [sellerAddress, setSellerAddress]         = useState("");
  const [sellerCompany, setSellerCompany]         = useState("");
  const [sellerTaxNumber, setSellerTaxNumber]     = useState("");
  const [sellerBankAccount, setSellerBankAccount] = useState("");

  const [buyerName, setBuyerName]       = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [buyerCompany, setBuyerCompany] = useState("");

  const [contacts, setContacts]         = useState([]);
  const [invoiceCounter, setInvoiceCounter] = useState(0);
  const invoiceCounterRef = useRef(0);

  const [quickServices, setQuickServices] = useState([
    { id: "qs-1", name: "Személyi edzés", amount: 10000 },
    { id: "qs-2", name: "Masszázs",        amount: 12000 },
    { id: "qs-3", name: "Konzultáció",     amount: 15000 },
  ]);

  const [activeService, setActiveService]             = useState(null);
  const [receivedInvoices, setReceivedInvoices]       = useState([]); // vevőnek küldött számlák
  const [hasSeenOnboarding, setHasSeenOnboarding]     = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("revolut");
  const [sellerTaxType, setSellerTaxType]             = useState("kata");

  // ── Adatok beállítása objektumból (RTDB vagy AsyncStorage) ────
  function applyState(s) {
    if (!s) return;
    if (s.sellerName        !== undefined) setSellerName(s.sellerName || "");
    if (s.sellerAddress     !== undefined) setSellerAddress(s.sellerAddress || "");
    if (s.sellerCompany     !== undefined) setSellerCompany(s.sellerCompany || "");
    if (s.sellerTaxNumber   !== undefined) setSellerTaxNumber(s.sellerTaxNumber || "");
    if (s.sellerBankAccount !== undefined) setSellerBankAccount(s.sellerBankAccount || "");
    if (s.buyerName         !== undefined) setBuyerName(s.buyerName || "");
    if (s.buyerAddress      !== undefined) setBuyerAddress(s.buyerAddress || "");
    if (s.buyerCompany      !== undefined) setBuyerCompany(s.buyerCompany || "");

    let loadedContacts = s.contacts || [];
    if (loadedContacts.length === 0) {
      const fromSeller = (s.sellerCustomers || []).map(fromSellerCustomer);
      const fromBuyer  = (s.kapcsolatok     || []).map(fromKapcsolat);
      loadedContacts   = [...fromSeller, ...fromBuyer];
    }
    setContacts(loadedContacts);

    const counter = Number(s.invoiceCounter || 0);
    setInvoiceCounter(counter);
    invoiceCounterRef.current = counter;

    if (s.hasSeenOnboarding !== undefined) setHasSeenOnboarding(s.hasSeenOnboarding || false);
    if (s.sellerTaxType     !== undefined) setSellerTaxType(s.sellerTaxType || "kata");
    if (s.quickServices     !== undefined) setQuickServices(s.quickServices || [
      { id: "qs-1", name: "Személyi edzés", amount: 10000 },
      { id: "qs-2", name: "Masszázs",        amount: 12000 },
      { id: "qs-3", name: "Konzultáció",     amount: 15000 },
    ]);
  }

  // ── Betöltés induláskor ───────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        // Először AsyncStorage (gyors, offline)
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) applyState(JSON.parse(raw));
      } catch (e) {
        console.log("AsyncStorage load error:", e);
      } finally {
        setIsHydrated(true);
      }
    }

    async function initUids() {
      try {
        let sUid = await AsyncStorage.getItem(SELLER_UID_KEY);
        if (!sUid) {
          sUid = "seller-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
          await AsyncStorage.setItem(SELLER_UID_KEY, sUid);
        }
        setSellerUid(sUid);
        setRegistlessUid(sUid);

        let bUid = await AsyncStorage.getItem(BUYER_UID_KEY);
        if (!bUid) {
          bUid = "buyer-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
          await AsyncStorage.setItem(BUYER_UID_KEY, bUid);
        }
        setBuyerUid(bUid);
      } catch (e) {
        console.log("UID init error:", e);
      }
    }

    load();
    initUids();
  }, []);

  // ── RTDB betöltés bejelentkezés után ──────────────────────────
  // Hívd meg: app.syncFromRTDB(authUser.uid) bejelentkezéskor
  async function syncFromRTDB(uid) {
    if (!uid) return;
    setFirebaseUid(uid);
    try {
      const rtdbData = await rtdbLoad(uid);
      if (rtdbData) {
        console.log("[RTDB] Adatok visszatöltve:", uid);
        applyState(rtdbData);
        if (rtdbData.receivedInvoices) setReceivedInvoices(rtdbData.receivedInvoices);
        // AsyncStorage-t is frissítjük
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(rtdbData));
      }
    } catch (e) {
      console.log("[RTDB] syncFromRTDB error:", e.message);
    }
  }

  // ── Mentés (AsyncStorage + RTDB) ─────────────────────────────
  const saveTimeoutRef = useRef(null);

  useEffect(() => {
    if (!isHydrated) return;

    const payload = {
      sellerName, sellerAddress, sellerCompany, sellerTaxNumber, sellerBankAccount,
      buyerName, buyerAddress, buyerCompany,
      contacts: contacts || [],
      invoiceCounter: invoiceCounter || 0,
      quickServices: quickServices || [],
      hasSeenOnboarding: hasSeenOnboarding || false,
      sellerTaxType: sellerTaxType || "kata",
    };

    // AsyncStorage — azonnal
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => {});

    // RTDB — debounced (ne írjon minden karakter után)
    if (firebaseUid) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        rtdbSave(firebaseUid, payload);
      }, 1500);
    }
  }, [
    isHydrated, firebaseUid,
    sellerName, sellerAddress, sellerCompany, sellerTaxNumber, sellerBankAccount,
    buyerName, buyerAddress, buyerCompany,
    contacts, invoiceCounter, quickServices, sellerTaxType, hasSeenOnboarding,
  ]);

  // ── Invoice counter ───────────────────────────────────────────
  function nextInvoiceNumber() {
    const next = invoiceCounterRef.current + 1;
    invoiceCounterRef.current = next;
    setInvoiceCounter(next);
    return `RGTL-${new Date().getFullYear()}-${String(next).padStart(4, "0")}`;
  }

  // ── Contacts API ──────────────────────────────────────────────
  const getSellerContacts = useCallback(
    () => contacts.filter((c) => c.myRoleInRelation === "seller"),
    [contacts]
  );
  const getBuyerContacts = useCallback(
    () => contacts.filter((c) => c.myRoleInRelation === "buyer"),
    [contacts]
  );
  const getContactById = useCallback(
    (id) => contacts.find((c) => c.id === id) || null,
    [contacts]
  );

  function addContact(params) {
    const hasRealUid = params.registlessUid &&
      !params.registlessUid.startsWith("buyer-main") &&
      !params.registlessUid.startsWith("seller-main") &&
      !params.registlessUid.startsWith("buyer-ocr") &&
      !params.registlessUid.startsWith("seller-ocr");

    if (hasRealUid) {
      const existing = contacts.find((c) => c.registlessUid === params.registlessUid);
      if (existing) return existing;
    }

    const newContact = {
      id: makeId("contact"),
      role: "contact",
      name: "", company: "", address: "", email: "", phone: "",
      taxNumber: "", bankAccount: "",
      registlessUid: params.registlessUid || makeId("uid-ocr"),
      qrId: null, myRoleInRelation: "seller",
      activities: [], appointments: [], invoices: [],
      openItems: [], bookingRequests: [], calendar: [], drafts: {},
      createdAt: Date.now(), lastActivityAt: Date.now(),
      ...params,
    };
    setContacts((prev) => [newContact, ...prev]);
    return newContact;
  }

  function updateContact(id, updates) {
    setContacts((prev) =>
      prev.map((c) => c.id === id ? { ...c, ...updates, lastActivityAt: Date.now() } : c)
    );
  }

  function deleteContact(id) {
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }

  function addActivityToContact(contactId, activity) {
    const act = { id: makeId("act"), type: "general", text: "", meta: {}, createdAt: Date.now(), ...activity };
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId
          ? { ...c, activities: [act, ...(c.activities || [])], lastActivityAt: Date.now() }
          : c
      )
    );
  }

  function addInvoiceToContact(contactId, invoice) {
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId
          ? { ...c, invoices: [invoice, ...(c.invoices || [])], openItems: [], lastActivityAt: Date.now() }
          : c
      )
    );
  }

  function addOpenItemToContact(contactId, item) {
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId
          ? { ...c, openItems: [item, ...(c.openItems || [])], lastActivityAt: Date.now() }
          : c
      )
    );
  }

  function addAppointmentToContact(contactId, appt) {
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId
          ? { ...c, appointments: [appt, ...(c.appointments || [])], lastActivityAt: Date.now() }
          : c
      )
    );
  }

  function addQuickService(name, amount) {
    const exists = quickServices.some((qs) => qs.name.toLowerCase() === name.toLowerCase());
    if (exists) return;
    setQuickServices((prev) => [...prev, { id: makeId("qs"), name, amount: Number(amount || 0) }]);
  }

  function removeQuickService(id) {
    setQuickServices((prev) => prev.filter((qs) => qs.id !== id));
  }

  function sellerQrPayload() {
    return JSON.stringify({
      t: "seller", id: sellerUid || "seller-main",
      n: sellerName || "", a: sellerAddress || "",
      c: sellerCompany || "", tx: sellerTaxNumber || "", b: sellerBankAccount || "",
    });
  }

  function buyerQrPayload() {
    return JSON.stringify({
      t: "buyer", id: buyerUid || "buyer-main",
      n: buyerName || "", a: buyerAddress || "", c: buyerCompany || "",
    });
  }

  function markOnboardingSeen() { setHasSeenOnboarding(true); }

  return {
    isHydrated,
    registlessUid, sellerUid, buyerUid, firebaseUid,
    sellerName, setSellerName,
    sellerAddress, setSellerAddress,
    sellerCompany, setSellerCompany,
    sellerTaxNumber, setSellerTaxNumber,
    sellerBankAccount, setSellerBankAccount,
    buyerName, setBuyerName,
    buyerAddress, setBuyerAddress,
    buyerCompany, setBuyerCompany,
    contacts, setContacts,
    getSellerContacts, getBuyerContacts, getContactById,
    addContact, updateContact, deleteContact,
    addActivityToContact, addInvoiceToContact,
    addOpenItemToContact, addAppointmentToContact,
    invoiceCounter, nextInvoiceNumber,
    quickServices, addQuickService, removeQuickService,
    activeService, setActiveService,
    selectedPaymentMethod, setSelectedPaymentMethod,
    hasSeenOnboarding, markOnboardingSeen,
    sellerTaxType, setSellerTaxType,
    sellerQrPayload, buyerQrPayload,
    receivedInvoices,
    syncFromRTDB, // ← ezt hívd meg bejelentkezés után!
  };
}
