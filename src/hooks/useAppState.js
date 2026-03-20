// ─────────────────────────────────────────────────────────────────
// useAppState.js — Teljes app state + AsyncStorage perzisztencia
// ─────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fromSellerCustomer, fromKapcsolat } from "../models/Contact";
import { saveUserProfile } from "../../firebase";

const STORAGE_KEY = "registless_app_state_v9";
const SELLER_UID_KEY = "registless_seller_uid_v1";
const BUYER_UID_KEY = "registless_buyer_uid_v1";

function makeId(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function useAppState() {
  const [isHydrated, setIsHydrated] = useState(false);

  // ── UIDs ──────────────────────────────────────────────────────
  const [registlessUid, setRegistlessUid] = useState(null);
  const [sellerUid, setSellerUid] = useState(null);
  const [buyerUid, setBuyerUid] = useState(null);

  // ── Seller profil ─────────────────────────────────────────────
  const [sellerName, setSellerName] = useState("");
  const [sellerAddress, setSellerAddress] = useState("");
  const [sellerCompany, setSellerCompany] = useState("");
  const [sellerTaxNumber, setSellerTaxNumber] = useState("");
  const [sellerBankAccount, setSellerBankAccount] = useState("");

  // ── Buyer profil ──────────────────────────────────────────────
  const [buyerName, setBuyerName] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [buyerCompany, setBuyerCompany] = useState("");

  // ── Contacts (egységes modell) ────────────────────────────────
  const [contacts, setContacts] = useState([]);

  // ── Invoice ───────────────────────────────────────────────────
  const [invoiceCounter, setInvoiceCounter] = useState(0);
  const invoiceCounterRef = useRef(0);

  // ── Quick services ────────────────────────────────────────────
  const [quickServices, setQuickServices] = useState([
    { id: "qs-1", name: "Személyi edzés", amount: 10000 },
    { id: "qs-2", name: "Masszázs", amount: 12000 },
    { id: "qs-3", name: "Konzultáció", amount: 15000 },
  ]);

  // ── Active service (timer) ────────────────────────────────────
  const [activeService, setActiveService] = useState(null);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

  // ── Payment ───────────────────────────────────────────────────
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("revolut");

  // ── Load ──────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const s = JSON.parse(raw);
          setSellerName(s.sellerName || "");
          setSellerAddress(s.sellerAddress || "");
          setSellerCompany(s.sellerCompany || "");
          setSellerTaxNumber(s.sellerTaxNumber || "");
          setSellerBankAccount(s.sellerBankAccount || "");
          setBuyerName(s.buyerName || "");
          setBuyerAddress(s.buyerAddress || "");
          setBuyerCompany(s.buyerCompany || "");

          // Migráció: régi kettős modell → egységes contacts
          let loadedContacts = s.contacts || [];
          if (loadedContacts.length === 0) {
            const fromSeller = (s.sellerCustomers || []).map(fromSellerCustomer);
            const fromBuyer = (s.kapcsolatok || []).map(fromKapcsolat);
            loadedContacts = [...fromSeller, ...fromBuyer];
          }
          setContacts(loadedContacts);

          const counter = Number(s.invoiceCounter || 0);
          setInvoiceCounter(counter);
          invoiceCounterRef.current = counter;

          setHasSeenOnboarding(s.hasSeenOnboarding || false);
          setQuickServices(s.quickServices || [
            { id: "qs-1", name: "Személyi edzés", amount: 10000 },
            { id: "qs-2", name: "Masszázs", amount: 12000 },
            { id: "qs-3", name: "Konzultáció", amount: 15000 },
          ]);
        }
      } catch (e) {
        console.log("Load error:", e);
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

  // ── Save ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isHydrated) return;
    async function save() {
      try {
        const payload = {
          sellerName, sellerAddress, sellerCompany, sellerTaxNumber, sellerBankAccount,
          buyerName, buyerAddress, buyerCompany,
          contacts: contacts || [],
          invoiceCounter: invoiceCounter || 0,
          quickServices: quickServices || [],
          hasSeenOnboarding: hasSeenOnboarding || false,
        };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

        if (sellerUid && sellerName) {
          saveUserProfile(sellerUid, { role: "seller", sellerName, sellerAddress, sellerCompany, sellerTaxNumber, sellerBankAccount })
            .catch(() => {});
        }
        if (buyerUid && buyerName) {
          saveUserProfile(buyerUid, { role: "buyer", buyerName, buyerAddress, buyerCompany })
            .catch(() => {});
        }
      } catch (e) {
        console.log("Save error:", e);
      }
    }
    save();
  }, [isHydrated, sellerName, sellerAddress, sellerCompany, sellerTaxNumber, sellerBankAccount,
      buyerName, buyerAddress, buyerCompany, contacts, invoiceCounter, quickServices]);

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
      name: "",
      company: "",
      address: "",
      email: "",
      phone: "",
      taxNumber: "",
      bankAccount: "",
      registlessUid: params.registlessUid || makeId("uid-ocr"),
      qrId: null,
      myRoleInRelation: "seller",
      activities: [],
      appointments: [],
      invoices: [],
      openItems: [],
      bookingRequests: [],
      calendar: [],
      drafts: {},
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
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
    const act = {
      id: makeId("act"),
      type: "general",
      text: "",
      meta: {},
      createdAt: Date.now(),
      ...activity,
    };
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
          ? {
              ...c,
              invoices: [invoice, ...(c.invoices || [])],
              // Gyűjtőszámla kiállításakor az összes nyitott tétel törlődik
              openItems: [],
              lastActivityAt: Date.now(),
            }
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

  // ── Quick services ────────────────────────────────────────────
  function addQuickService(name, amount) {
    const exists = quickServices.some(
      (qs) => qs.name.toLowerCase() === name.toLowerCase()
    );
    if (exists) return;
    setQuickServices((prev) => [
      ...prev,
      { id: makeId("qs"), name, amount: Number(amount || 0) },
    ]);
  }

  function removeQuickService(id) {
    setQuickServices((prev) => prev.filter((qs) => qs.id !== id));
  }

  // ── Seller QR payload ─────────────────────────────────────────
  function sellerQrPayload() {
    return JSON.stringify({
      t: "seller",
      id: sellerUid || "seller-main",
      n: sellerName || "",
      a: sellerAddress || "",
      c: sellerCompany || "",
      tx: sellerTaxNumber || "",
      b: sellerBankAccount || "",
    });
  }

  // ── Buyer QR payload ──────────────────────────────────────────
  function buyerQrPayload() {
    return JSON.stringify({
      t: "buyer",
      id: buyerUid || "buyer-main",
      n: buyerName || "",
      a: buyerAddress || "",
      c: buyerCompany || "",
    });
  }

  function markOnboardingSeen() {
    setHasSeenOnboarding(true);
  }

  return {
    isHydrated,
    // UIDs
    registlessUid, sellerUid, buyerUid,
    // Seller
    sellerName, setSellerName,
    sellerAddress, setSellerAddress,
    sellerCompany, setSellerCompany,
    sellerTaxNumber, setSellerTaxNumber,
    sellerBankAccount, setSellerBankAccount,
    // Buyer
    buyerName, setBuyerName,
    buyerAddress, setBuyerAddress,
    buyerCompany, setBuyerCompany,
    // Contacts
    contacts, setContacts,
    getSellerContacts, getBuyerContacts, getContactById,
    addContact, updateContact, deleteContact,
    addActivityToContact, addInvoiceToContact,
    addOpenItemToContact, addAppointmentToContact,
    // Invoice
    invoiceCounter, nextInvoiceNumber,
    // Quick services
    quickServices, addQuickService, removeQuickService,
    // Active service
    activeService, setActiveService,
    // Payment
    selectedPaymentMethod, setSelectedPaymentMethod,
    hasSeenOnboarding, markOnboardingSeen,
    // QR payloads
    sellerQrPayload, buyerQrPayload,
  };
}
