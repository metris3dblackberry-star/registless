// ─────────────────────────────────────────────────────────────────
// App.js — REGISTLESS navigator
// 2026-03-22 — VideoBackground, QR Share/Scan, NFC, NewService fix
// ─────────────────────────────────────────────────────────────────
import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, Image, ImageBackground,
  Animated, Easing, StyleSheet, Alert, Platform,
  ScrollView, TextInput, KeyboardAvoidingView,
  SafeAreaView, StatusBar, Linking, Share, BackHandler,
} from "react-native";
import { useCameraPermissions } from "expo-camera";
import AsyncStorage from "@react-native-async-storage/async-storage";
import QRCode from "react-native-qrcode-svg";

// Hooks
import { useAppState } from "./src/hooks/useAppState";

// Screens
import SellerDashboard  from "./src/screens/SellerDashboard";
import BuyerDashboard   from "./src/screens/BuyerDashboard";
import PartnerWorkspace from "./src/screens/PartnerWorkspace";
import OcrScreen        from "./src/screens/OcrScreen";
import SettingsScreen   from "./src/screens/SettingsScreen";
import OnboardingScreen from "./src/screens/OnboardingScreen";
import QrScanScreen     from "./src/screens/QrScanScreen";
import NfcScreen        from "./src/screens/NfcScreen";
import CalendarScreen   from "./src/screens/CalendarScreen";
import LocalSearchScreen from "./src/screens/LocalSearchScreen";
import BookingScreen     from "./src/screens/BookingScreen";
import VideoBackground  from "./src/components/VideoBackground";
import WheelFAB        from "./src/components/WheelFAB";
import { ErrorBoundary } from "./src/components/ErrorBoundary";

// Coordinator
import {
  applyOcrResult,
  issueInvoice,
  ActivityType,
  makeActivity,
} from "./src/services/coordinator";

// Demo data
import {
  DEMO_SELLER, DEMO_BUYER, DEMO_CONTACTS,
  DEMO_BUYER_CONTACTS, DEMO_QUICK_SERVICES,
} from "./src/services/demoData";

import { colors }          from "./src/theme/colors";
import { shared }          from "./src/theme/styles";
import { formatCurrency }  from "./src/services/invoice";
import {
  registerForPushNotifications,
  sendLocalNotification,
  sendPushToUser,
  setupNotificationListeners,
} from "./pushService";
import { getPushToken }    from "./firebase";
import { onAuthChange, logout } from "./src/services/authService";
import { getLicense, getLicenseStatus, getLicenseBadge, startTrial, PLANS } from "./src/services/licenseService";
import AuthScreen    from "./src/screens/AuthScreen";
import UpgradeScreen from "./src/screens/UpgradeScreen";

const ONBOARDING_KEY = "registless_onboarding_seen_v1";

const SELLER_QUICK_ACTIONS = [
  { id: "partner",  icon: "📱", label: "Új partner QR-rel" },
  { id: "nfc",      icon: "📡", label: "NFC partner csere" },
  { id: "service",  icon: "⚡", label: "Új szolgáltatás" },
  { icon: "🔍", label: "Helyi Keresés", onPress: () => navigate("localSearch") },
  { id: "settings", icon: "⚙️", label: "Beállítások" },
];
const BUYER_QUICK_ACTIONS = [
  { id: "partner",  icon: "📷", label: "Eladó QR scan" },
  { id: "ocr",      icon: "🔍", label: "OCR import" },
  { id: "settings", icon: "⚙️", label: "Beállítások" },
];

export default function App() {
  const app = useAppState();
  const [permission, requestPermission] = useCameraPermissions();

  const [screen, setScreen]               = useState("home");
  const [activeContactId, setActiveContactId] = useState(null);
  const [activeRole, setActiveRole]       = useState("seller");
  const [ocrUseCase, setOcrUseCase]       = useState("partner");
  const [settingsSection, setSettingsSection] = useState(null);
  const [initialTab, setInitialTab]           = useState(null);
  const [fabOpen, setFabOpen]             = useState(false);
  const [screenHistory, setScreenHistory] = useState(["home"]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [appKbHeight, setAppKbHeight]     = useState(0);
  const [invSearch, setInvSearch]         = useState("");
  const [invFrom, setInvFrom]             = useState("");
  const [invTo, setInvTo]                 = useState("");
  const [invFilter, setInvFilter]         = useState("all");

  // ── Auth + License state ──────────────────────────────────────
  const [authUser, setAuthUser]           = useState(null);
  const [authLoading, setAuthLoading]     = useState(true);
  const [licenseStatus, setLicenseStatus] = useState(null);
  const [showUpgrade, setShowUpgrade]     = useState(false);

  // ── Auth listener ─────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthChange(async (user) => {
      setAuthUser(user);
      setAuthLoading(false);
      if (user) {
        const license = await getLicense(user.uid).catch(() => null);
        if (!license) {
          await startTrial(user.uid).catch(() => {});
          const newLicense = await getLicense(user.uid).catch(() => null);
          setLicenseStatus(getLicenseStatus(newLicense));
        } else {
          setLicenseStatus(getLicenseStatus(license));
        }
        // QR payload frissítése authUser.uid-dal
       if (!app.sellerQrPayload?.()) {
          const payload = JSON.stringify({
            uid:     user.uid,
            name:    app.sellerName    || "",
            company: app.sellerCompany || "",
            phone:   "",
            email:   user.email        || "",
            address: app.sellerAddress || "",
          });
          app.setSellerQrPayload?.(payload);
        }
      } else {
        setLicenseStatus(null);
      }
    });
    return unsub;
  }, []);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(1)).current;

  // ── Onboarding + demo data ────────────────────────────────────
  useEffect(() => {
    if (!app.isHydrated) return;
    AsyncStorage.getItem(ONBOARDING_KEY).then((val) => {
      if (!val) setShowOnboarding(true);
    }).catch(() => setShowOnboarding(true));
    if (app.contacts.length === 0) {
      app.setContacts([...DEMO_CONTACTS, ...DEMO_BUYER_CONTACTS]);
      if (!app.sellerName) {
        app.setSellerName(DEMO_SELLER.sellerName);
        app.setSellerCompany(DEMO_SELLER.sellerCompany);
        app.setSellerAddress(DEMO_SELLER.sellerAddress);
        app.setSellerTaxNumber(DEMO_SELLER.sellerTaxNumber);
        app.setSellerBankAccount(DEMO_SELLER.sellerBankAccount);
      }
      if (!app.buyerName) {
        app.setBuyerName(DEMO_BUYER.buyerName);
        app.setBuyerAddress(DEMO_BUYER.buyerAddress);
      }
    }
  }, [app.isHydrated]);

  // ── Android Back Button ──────────────────────────────────────
  useEffect(() => {
    const backAction = () => {
      if (screen !== "home") {
        setScreenHistory(prev => {
          const newHistory = prev.length > 1 ? prev.slice(0, -1) : ["home"];
          const prevScreen = newHistory[newHistory.length - 1] || "home";
          // Animáció + screen váltás közvetlenül (nem navigate, hogy ne push-oljon)
          slideAnim.setValue(18);
          fadeAnim.setValue(0);
          setScreen(prevScreen);
          Animated.parallel([
            Animated.timing(slideAnim, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
          ]).start();
          return newHistory;
        });
        return true;
      }
      return false; // home screenen engedjük az app kilépést
    };
    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, [screen, screenHistory]);

  // ── Push értesítések ──────────────────────────────────────────
  useEffect(() => {
    if (!app.isHydrated || !app.sellerUid) return;
    registerForPushNotifications(app.sellerUid).catch(console.log);
    const cleanup = setupNotificationListeners(
      (notification) => { console.log("Push kapva:", notification); },
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.screen) navigate(data.screen, data);
      }
    );
    return cleanup;
  }, [app.isHydrated, app.sellerUid]);

  // ── Keyboard ──────────────────────────────────────────────────
  useEffect(() => {
    const { Keyboard } = require("react-native");
    const show = Keyboard.addListener("keyboardDidShow", (e) => setAppKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardDidHide", () => setAppKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // ── Navigate ──────────────────────────────────────────────────
  function navigate(to, opts = {}) {
    setFabOpen(false);
    slideAnim.setValue(18);
    fadeAnim.setValue(0);
    if (opts.contactId !== undefined)      setActiveContactId(opts.contactId);
    if (opts.role !== undefined)           setActiveRole(opts.role);
    if (opts.ocrUseCase !== undefined)     setOcrUseCase(opts.ocrUseCase);
    if (opts.settingsSection !== undefined) setSettingsSection(opts.settingsSection);
    if (opts.initialTab !== undefined) setInitialTab(opts.initialTab || null);
    setScreen(to);
    // ← screenHistory frissítése: ne duplikálj ha ugyanaz a screen
    setScreenHistory(prev => {
      if (prev[prev.length - 1] === to) return prev;
      return [...prev, to];
    });
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }

  const activeContact   = activeContactId ? app.getContactById(activeContactId) : null;
  const sellerContacts  = app.getSellerContacts();
  const buyerContacts   = app.getBuyerContacts();

  // ── Stripe Checkout ───────────────────────────────────────────
  const STRIPE_FUNCTION_URL = "https://europe-west1-registless.cloudfunctions.net/createStripeCheckout";

  async function handlePaymentRequest(contactId, invoiceId) {
    // VEVŐ fizet Stripe-on keresztül
    const contact = app.getContactById(contactId);
    if (!contact) return;
    let amount = 0;
    let label  = "Fizetési kérés";
    if (invoiceId) {
      const inv = (contact.invoices || []).find(i => i.id === invoiceId);
      if (inv) { amount = inv.bruttoOsszesen || 0; label = inv.id; }
    } else {
      amount = (contact.openItems || []).reduce((s, oi) => s + (oi.brutto || oi.amount || 0), 0);
      label  = app.sellerName || "Registless";
    }
    const amountFt = amount.toLocaleString("hu-HU");
    Alert.alert(
      "💳 Számla kifizetése",
      `Összeg: ${amountFt} Ft`,
      [
        { text: "Mégse", style: "cancel" },
        { text: "💳 Fizetés Stripe-on", onPress: async () => {
          try {
            const resp = await fetch(STRIPE_FUNCTION_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ amount: Math.round(amount * 100), invoiceId: label, sellerName: app.sellerName || "Registless", contactName: contact.name }),
            });
            const data = await resp.json();
            if (data?.url) await Linking.openURL(data.url);
            else Alert.alert("Hiba", data?.error || "Nem sikerült a Stripe checkout.");
          } catch (e) {
            Alert.alert("Hiba", e.message);
          }
        }},
      ]
    );
  }

  async function handleSendPaymentReminder(contactId, unpaidInvoices = []) {
    // ELADÓ küld push emlékeztetőt a Vevőnek
    const contact = app.getContactById(contactId);
    if (!contact) return;
    const total = unpaidInvoices.reduce((s, i) => s + Number(i.bruttoOsszesen || 0), 0);
    const invoiceList = unpaidInvoices.map(i => `${i.id}: ${Number(i.bruttoOsszesen||0).toLocaleString("hu-HU")} Ft`).join(", ");
    const pushBody = unpaidInvoices.length > 0
      ? `Nyitott számla(k): ${invoiceList} — Összesen: ${total.toLocaleString("hu-HU")} Ft`
      : `Nyitott tételei vannak. Kérjük rendezze egyenlegét.`;
    Alert.alert(
      "📨 Fizetési emlékeztető küldése",
      `Vevő: ${contact.name}\n${pushBody}`,
      [
        { text: "Mégse", style: "cancel" },
        { text: "📨 Push küldése", onPress: async () => {
          try {
            const partnerToken = await getPushToken(contact.registlessUid).catch(() => null);
            if (partnerToken) {
              await sendPushToUser(partnerToken, "📨 Fizetési emlékeztető", pushBody, { screen: "invoiceList" });
              Alert.alert("✅ Elküldve", "A fizetési emlékeztető el lett küldve.");
            } else {
              Alert.alert("⚠️ Nem küldhető", "A partnernek nincs aktív push token.");
            }
          } catch (e) { Alert.alert("Hiba", e.message); }
        }},
      ]
    );
  }

  // ── Booking accept ────────────────────────────────────────────
  async function handleAcceptBooking(contactId, req) {
    const appointment = {
      id: `appt-${Date.now()}`,
      serviceName: req.serviceName || "Szolgáltatás",
      datum: req.datum || "",
      ido:   req.ido   || "",
      statusz: "elfogadott foglalás",
      amount: req.amount || 0,
      createdAt: Date.now(),
    };
    app.addAppointmentToContact(contactId, appointment);
    app.addActivityToContact(contactId, makeActivity(
      ActivityType.BOOKING_ACCEPTED,
      `Időpont elfogadva: ${appointment.serviceName} – ${appointment.datum} ${appointment.ido}`,
      { appointment }
    ));
    const sellerContact = app.getContactById(contactId);
    const partnerUid    = sellerContact?.registlessUid;
    const buyerContact  = app.contacts.find(c =>
      c.myRoleInRelation === "buyer" && (
        (partnerUid && c.registlessUid === partnerUid) ||
        (c.name && sellerContact?.name && c.name === sellerContact.name)
      )
    );
    if (buyerContact) {
      app.updateContact(buyerContact.id, {
        calendar: [{ ...appointment, statusz: "elfogadva", myRoleInRelation: "buyer" }, ...(buyerContact.calendar || [])],
        lastActivityAt: Date.now(),
      });
      const buyerToken = await getPushToken(buyerContact.registlessUid).catch(() => null);
      if (buyerToken) sendPushToUser(buyerToken, "📅 Időpont visszaigazolva!", `${appointment.serviceName} – ${appointment.datum} ${appointment.ido}`, { screen: "partnerWorkspace", contactId: buyerContact.id });
    }
    const updatedRequests = (sellerContact?.bookingRequests || []).map(r => r.id === req.id ? { ...r, statusz: "elfogadva" } : r);
    app.updateContact(contactId, { bookingRequests: updatedRequests });
    sendLocalNotification("📅 Időpont elfogadva", `${appointment.serviceName} – ${appointment.datum} ${appointment.ido}`);
    Alert.alert("✅ Időpont elfogadva", `${appointment.serviceName}\n${appointment.datum} ${appointment.ido}`);
  }

  // ── Reset all ─────────────────────────────────────────────────
  function handleResetAll() {
    Alert.alert("Összes adat törlése", "Biztosan törölni szeretnéd az összes adatot?", [
      { text: "Nem", style: "cancel" },
      { text: "Igen, törlöm", style: "destructive", onPress: async () => {
        await AsyncStorage.clear();
        app.setContacts([]);
        app.setSellerName(""); app.setSellerCompany(""); app.setSellerAddress("");
        app.setSellerTaxNumber(""); app.setSellerBankAccount("");
        app.setBuyerName(""); app.setBuyerAddress(""); app.setBuyerCompany("");
        Alert.alert("✅ Törölve", "Az app újraindításkor üres állapotból indul.", [{ text: "OK", onPress: () => navigate("home") }]);
      }},
    ]);
  }

  // ── Quick action (FAB) ────────────────────────────────────────
  function handleQuickAction(id) {
    setFabOpen(false);
    if (id === "partner")  navigate("qrScan");
    else if (id === "nfc") navigate("nfc");
    else if (id === "service") navigate("newService");
    else if (id === "ocr") navigate("ocr", { ocrUseCase: "partner" });
    else if (id === "settings") navigate("settings");
  }

  // ═════════════════════════════════════════════════════════════
  // LOADING / AUTH / UPGRADE SCREENS
  // ═════════════════════════════════════════════════════════════

  if (authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0a0a0a" }}>
        <Text style={{ color: "#fff", fontSize: 22, fontWeight: "bold" }}>REGISTLESS</Text>
        <Text style={{ color: colors.textSecondary, marginTop: 8 }}>Betöltés...</Text>
      </View>
    );
  }

  if (!authUser) {
    return (
      <ImageBackground source={require("./assets/background.png")} style={{ flex: 1 }} resizeMode="cover">
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <AuthScreen onAuthSuccess={(user) => setAuthUser(user)} />
      </ImageBackground>
    );
  }

  if (showUpgrade) {
    return (
      <ImageBackground source={require("./assets/background.png")} style={{ flex: 1 }} resizeMode="cover">
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <UpgradeScreen
          licenseStatus={licenseStatus}
          userEmail={authUser.email}
          userId={authUser.uid}
          onBack={() => setShowUpgrade(false)}
          onUpgradeSuccess={() => setShowUpgrade(false)}
          onTrialActivated={(newStatus) => { setLicenseStatus(newStatus); setShowUpgrade(false); }}
        />
      </ImageBackground>
    );
  }

  if (!app.isHydrated) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0a0a0a" }}>
        <Text style={{ color: "#fff", fontSize: 22, fontWeight: "bold" }}>REGISTLESS</Text>
        <Text style={{ color: colors.textSecondary, marginTop: 8 }}>Betöltés...</Text>
      </View>
    );
  }

  if (showOnboarding) {
    return (
      <OnboardingScreen onComplete={async () => {
        try { await AsyncStorage.setItem(ONBOARDING_KEY, "1"); } catch(e) {}
        setShowOnboarding(false);
      }} />
    );
  }

  // ═════════════════════════════════════════════════════════════
  // SCREEN ROUTING
  // ═════════════════════════════════════════════════════════════
  let content = null;

  // ── Home ──────────────────────────────────────────────────────
  if (screen === "home") {
    const badge = licenseStatus ? getLicenseBadge(licenseStatus) : null;
    content = (
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ position: "absolute", bottom: 120, left: 24, right: 24, alignItems: "center", gap: 10 }}>

          {badge && (
            <TouchableOpacity
              onPress={() => setShowUpgrade(true)}
              style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 6 }}
            >
              <Text style={{ color: badge.color, fontWeight: "bold", fontSize: 13 }}>
                {badge.text} {licenseStatus?.plan !== "pro" ? "· Frissítés →" : ""}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[shared.btnPrimary, { width: "100%" }]}
            onPress={() => {
              if (licenseStatus?.plan === "free" || (!licenseStatus?.isActive && licenseStatus?.plan !== "pro")) {
                setShowUpgrade(true);
              } else {
                navigate("sellerDashboard", { role: "seller" });
              }
            }}>
            <Text style={shared.btnTextPrimary}>ELADÓ</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[shared.btnPrimary, { width: "100%" }]}
            onPress={() => navigate("buyerDashboard", { role: "buyer" })}>
            <Text style={shared.btnTextPrimary}>VEVŐ</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.shareBtn} onPress={() => navigate("qrShare")}>
            <Image source={require("./assets/share_icon.jpg")} style={s.shareIcon} />
            <Text style={s.shareLabel}>{"Registless\nMegosztása"}</Text>
          </TouchableOpacity>

          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{authUser?.email}</Text>

          <TouchableOpacity onPress={() => { logout(); setAuthUser(null); }}>
            <Text style={{ color: "#888", fontSize: 12 }}>Kijelentkezés</Text>
          </TouchableOpacity>

          <Text style={s.poweredBy}>Powered by Star Labs Kft. · All rights reserved</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Seller Dashboard ──────────────────────────────────────────
  if (screen === "sellerDashboard") {
    content = (
      <SafeAreaView style={{ flex: 1, width: "100%" }}>
        <SellerDashboard
          contacts={sellerContacts}
          sellerName={app.sellerName}
          drafts={[]}
          onPartner={(c) => c
            ? navigate("partnerWorkspace", { contactId: c.id, role: "seller" })
            : navigate("partnerList", { role: "seller" })
          }
          onNewPartner={() => navigate("qrScan", { role: "seller" })}
          onTodaySchedule={() => navigate("todaySchedule")}
          onNewService={() => navigate("newService")}
          onInvoices={() => navigate("invoiceList")}
          onSettings={(sec) => navigate("settings", { settingsSection: sec || null })}
          onHome={() => navigate("home")}
          onOcr={() => navigate("ocr", { ocrUseCase: "partner" })}
          onQrProfile={() => navigate("qrProfile")}
        />
      </SafeAreaView>
    );
  }

  // ── Buyer Dashboard ───────────────────────────────────────────
  if (screen === "buyerDashboard") {
    content = (
      <SafeAreaView style={{ flex: 1, width: "100%" }}>
        <BuyerDashboard
          contacts={buyerContacts}
          buyerName={app.buyerName}
          onPartner={(c) => c
            ? navigate("partnerWorkspace", { contactId: c.id, role: "buyer" })
            : navigate("partnerList", { role: "buyer" })
          }
          onNewPartner={() => navigate("qrScan", { role: "buyer" })}
          onAppointments={() => navigate("appointments")}
          onInvoices={() => navigate("invoiceList")}
          onMessages={() => navigate("messagesList", { role: "buyer" })}
          onSettings={(sec) => navigate("settings", { settingsSection: sec || null })}
          onHome={() => navigate("home")}
        />
      </SafeAreaView>
    );
  }

  // ── Partner Workspace ─────────────────────────────────────────
  if (screen === "partnerWorkspace" && activeContact) {
    content = (
      <SafeAreaView style={{ flex: 1, width: "100%" }}>
        <PartnerWorkspace
          initialTab={initialTab}
          contact={activeContact}
         myUid={activeRole === "seller" 
  	    ? (app.sellerUid || authUser?.uid || "") 
	    : (app.buyerUid  || authUser?.uid || "")}
          partnerUid={activeContact.registlessUid}
          myRole={activeRole}
          onBack={() => navigate(activeRole === "seller" ? "sellerDashboard" : "buyerDashboard")}
          onStartService={() => navigate("newService", { contactId: activeContact.id })}
          onNewBooking={() => navigate("newBooking", { contactId: activeContact.id })}
          onAcceptBooking={(req) => handleAcceptBooking(activeContact.id, req)}
          onIssueInvoice={() => issueInvoice({
            contactId: activeContact.id,
            taxType: app.sellerTaxType || "kata",
            getContactById: app.getContactById,
            addInvoiceToContact: async (contactId, invoice) => {
              app.addInvoiceToContact(contactId, invoice);
              // Szinkronizálás a vevő RTDB-re — hogy a vevő is lássa a számlát
              const contact = app.getContactById(contactId);
              if (contact?.registlessUid && !contact.registlessUid.startsWith("uid-ocr")) {
                try {
                  const { rtdb } = await import("./firebase");
                  const buyerInvoices = await rtdb.ref(`appState/${contact.registlessUid}/receivedInvoices`).once("value");
                  const existing = buyerInvoices.val() || [];
                  await rtdb.ref(`appState/${contact.registlessUid}/receivedInvoices`).set([invoice, ...existing]);
                  // Push értesítés a vevőnek
                  const token = await getPushToken(contact.registlessUid).catch(() => null);
                  if (token) sendPushToUser(token, "📄 Új számla érkezett", `${invoice.id} · ${Number(invoice.bruttoOsszesen||0).toLocaleString("hu-HU")} Ft`, { screen: "invoiceList" });
                } catch (e) { console.log("[Invoice sync]", e.message); }
              }
            },
            addActivityToContact: app.addActivityToContact,
            nextInvoiceNumber: app.nextInvoiceNumber,
            sellerProfile: {
              name: app.sellerName, company: app.sellerCompany,
              address: app.sellerAddress, taxNumber: app.sellerTaxNumber,
              bankAccount: app.sellerBankAccount,
            },
          })}
          onPayment={(invoiceId) => handlePaymentRequest(activeContact.id, invoiceId)}
          onSendPaymentReminder={(invs) => handleSendPaymentReminder(activeContact.id, invs)}
          onMessageSent={async (text) => {
            const partnerToken = await getPushToken(activeContact.registlessUid).catch(() => null);
            if (partnerToken) sendPushToUser(partnerToken, `💬 Új üzenet — ${app.sellerName || "Registless"}`, text.length > 60 ? text.substring(0, 60) + "..." : text, { screen: "partnerWorkspace" });
          }}
          onInvoicePaid={async (invoiceId, amount) => {
            sendLocalNotification("✅ Számla kifizetve!", `${invoiceId} · ${amount?.toLocaleString("hu-HU")} Ft`);
          }}
          onRemoveOpenItem={(itemId) => {
            if (!activeContact) return;
            const contact = app.getContactById(activeContact.id);
            const updated = (contact?.openItems || []).filter(oi => oi.id !== itemId);
            app.updateContact(activeContact.id, { openItems: updated });
          }}
        />
      </SafeAreaView>
    );
  }

  // ── New Booking ───────────────────────────────────────────────
  if (screen === "newBooking") {
    content = (
      <BookingScreen
        contact={activeContact}
        onSubmit={async (req) => {
          if (activeContact) {
            app.addActivityToContact(activeContact.id, makeActivity(ActivityType.BOOKING_REQUEST, `Időpont kérés: ${req.datum} ${req.ido} (${req.duration} perc)`, { request: req }));
            const contact = app.getContactById(activeContact.id);
            app.updateContact(activeContact.id, { bookingRequests: [{ ...req, id: `req-${Date.now()}`, statusz: "függőben", createdAt: Date.now() }, ...(contact?.bookingRequests || [])] });
            // Push értesítés az eladónak
            if (activeContact.registlessUid && !activeContact.registlessUid.startsWith("uid-ocr")) {
              try {
                const token = await getPushToken(activeContact.registlessUid);
                if (token) {
                  await sendPushToUser(token,
                    "📅 Új időpont kérés",
                    `${app.buyerName || "Vevő"}: ${req.datum} ${req.ido || ""} (${(req.duration||60)} perc)`,
                    { screen: "partnerWorkspace" }
                  );
                }
              } catch {}
            } else {
              console.log("[Booking] OCR partner — push nem küldhető, nincs valódi UID");
            }
          }
          Alert.alert("✅ Elküldve", "Az időpont kérés el lett küldve.", [{ text: "OK" }]);
          navigate("partnerWorkspace");
        }}
        onBack={() => navigate("partnerWorkspace")}
      />
    );
  }

  // ── New Service ───────────────────────────────────────────────
  if (screen === "newService") {
    content = <NewServiceScreen
      contact={activeContact}
      quickServices={app.quickServices}
      onSubmit={(item) => {
        if (activeContact) {
          app.addOpenItemToContact(activeContact.id, item);
          app.addActivityToContact(activeContact.id, makeActivity(ActivityType.SERVICE_FINISHED, `Szolgáltatás lezárva: ${item.serviceName}`, { amount: item.brutto }));
          Alert.alert("✅ Kész", "Hozzáadva a nyitott tételekhez!\nA Pénzügyek fülön állíthatsz ki számlát.");
          navigate("partnerWorkspace");
        } else {
          Alert.alert("ℹ️", "Válassz egy partnert a dashboardon.");
          navigate("sellerDashboard");
        }
      }}
      // ✅ ÚJ: Gyorslista hozzáadás
      onAddToQuickList={(qs) => {
        try {
          if (typeof app.addQuickService === "function") {
            app.addQuickService(qs.name, qs.amount);
          } else {
            console.warn("[QuickService] addQuickService not available");
          }
        } catch (e) {
          console.warn("[QuickService] hiba:", e);
        }
      }}
      onBack={() => activeContact ? navigate("partnerWorkspace") : navigate("sellerDashboard")}
    />;
  }
if (screen === "qrShare") {
  content = (
    <SafeAreaView style={{ flex: 1, width: "100%" }}>
      <ScrollView contentContainerStyle={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
        <Text style={{ color: "#fff", fontSize: 22, fontWeight: "bold", marginBottom: 8, textAlign: "center" }}>
          📱 Registless Letöltése
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: "center", marginBottom: 32 }}>
          Olvasd be a QR kódot az app letöltéséhez
        </Text>

        <View style={{ backgroundColor: "#fff", padding: 20, borderRadius: 24, shadowColor: "#ff7a1a", shadowOpacity: 0.4, shadowRadius: 24, elevation: 16 }}>
          <QRCode value="https://registless.ai" size={220} color="#111" backgroundColor="#fff" />
        </View>

        <View style={{ marginTop: 28, alignItems: "center" }}>
          <Text style={{ color: "#fff", fontSize: 18, fontWeight: "bold" }}>
            Registless Letöltése
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 4 }}>
            https://registless.ai
          </Text>
        </View>

        <TouchableOpacity style={[shared.btnOutline, { width: "100%", marginTop: 32 }]} onPress={() => navigate("home")}>
          <Text style={shared.btnTextSecondary}>VISSZA</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

  // ── QR Scan — Új partner beolvasása ──────────────────────────
  if (screen === "qrScan") {
    content = (
      <QrScanScreen
        permission={permission}
        requestPermission={requestPermission}
        role={activeRole}
        onScanned={(rawData) => {
          // Parse JSON payload if QR contains JSON, otherwise treat as plain uid
          let data = {};
          try {
            data = typeof rawData === "string" ? JSON.parse(rawData) : rawData;
          } catch {
            data = { uid: rawData, name: "", company: "" };
          }
          const newContact = {
            id:               `c-${Date.now()}`,
            name: data.name || data.n || "Ismeretlen",
	    company: data.company || data.c || "",
            phone:            data.phone    || "",
            email:            data.email    || "",
            address:          data.address  || "",
           registlessUid: data.uid || data.id || data.registlessUid || null,
            myRoleInRelation: activeRole,
            openItems: [], invoices: [], appointments: [],
            bookingRequests: [], calendar: [], messages: [],
            createdAt: Date.now(),
          };
          app.addContact(newContact);
          Alert.alert(
            "✅ Partner hozzáadva!",
            `${newContact.name} bekerült a partnereid közé.`,
            [
              { text: "Megnyitom", onPress: () => navigate("partnerWorkspace", { contactId: newContact.id, role: activeRole }) },
              { text: "OK", onPress: () => navigate(activeRole === "seller" ? "sellerDashboard" : "buyerDashboard") },
            ]
          );
        }}
        onBack={() => navigate(activeRole === "seller" ? "sellerDashboard" : "buyerDashboard")}
      />
    );
  }

  // ── NFC Partner csere ─────────────────────────────────────────
  if (screen === "nfc") {
    content = (
      <NfcScreen
        myProfile={{
          uid:     app.sellerUid    || "",
          name:    app.sellerName   || "",
          company: app.sellerCompany || "",
          phone:   "",
          email:   authUser?.email  || "",
          address: app.sellerAddress || "",
        }}
        role={activeRole}
        onPartnerScanned={(data) => {
          const newContact = {
            id:               `c-${Date.now()}`,
            name:             data.name     || "Ismeretlen",
            company:          data.company  || "",
            phone:            data.phone    || "",
            email:            data.email    || "",
            address:          data.address  || "",
            registlessUid:    data.uid      || null,
            myRoleInRelation: activeRole,
            openItems: [], invoices: [], appointments: [],
            bookingRequests: [], calendar: [], messages: [],
            createdAt: Date.now(),
          };
          app.addContact(newContact);
          Alert.alert(
            "✅ NFC Partner hozzáadva!",
            `${newContact.name} bekerült a partnereid közé.`,
            [
              { text: "Megnyitom", onPress: () => navigate("partnerWorkspace", { contactId: newContact.id, role: activeRole }) },
              { text: "OK", onPress: () => navigate(activeRole === "seller" ? "sellerDashboard" : "buyerDashboard") },
            ]
          );
        }}
        onBack={() => navigate(activeRole === "seller" ? "sellerDashboard" : "buyerDashboard")}
      />
    );
  }

  // ── QR Profil — saját profil QR megjelenítése ────────────────
  if (screen === "qrProfile") {
    // sellerQrPayload egy függvény — hívni kell
    const _qrRaw = typeof app.sellerQrPayload === "function"
      ? app.sellerQrPayload()
      : app.sellerQrPayload;
    const qrPayload = (_qrRaw && _qrRaw.length > 5)
      ? _qrRaw
      : (app.sellerName || authUser?.uid)
        ? JSON.stringify({
            uid:     authUser?.uid     || "",
            name:    app.sellerName    || "",
            company: app.sellerCompany || "",
            email:   authUser?.email   || "",
            phone:   "",
            address: app.sellerAddress || "",
          })
        : "REGISTLESS";
    content = (
      <SafeAreaView style={{ flex: 1, width: "100%" }}>
        <ScrollView contentContainerStyle={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Text style={{ color: "#fff", fontSize: 22, fontWeight: "bold", marginBottom: 4, textAlign: "center" }}>
            📱 Saját QR kód
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center", marginBottom: 28 }}>
            Mutasd ezt a kódot partnereidnek — ők beolvasva automatikusan felvesznek
          </Text>
          <View style={{ backgroundColor: "#fff", padding: 20, borderRadius: 24, shadowColor: "#ff7a1a", shadowOpacity: 0.4, shadowRadius: 24, elevation: 16 }}>
            <QRCode
              value={qrPayload}
              size={220}
              color="#111"
              backgroundColor="#fff"
            />
          </View>
          <View style={{ marginTop: 24, alignItems: "center", gap: 4 }}>
            {!!app.sellerName    && <Text style={{ color: "#fff",  fontSize: 17, fontWeight: "bold"  }}>{app.sellerName}</Text>}
            {!!app.sellerCompany && <Text style={{ color: "#aaa",  fontSize: 14 }}>{app.sellerCompany}</Text>}
            {!!authUser?.email   && <Text style={{ color: "#666",  fontSize: 12 }}>{authUser.email}</Text>}
          </View>
          <TouchableOpacity
            style={[shared.btnOutline, { width: "100%", marginTop: 28 }]}
            onPress={() => {
              Share.share({
                message: `Csatlakozz hozzám a Registless-en!\nNevem: ${app.sellerName || ""}\n${authUser?.email || ""}`,
                title: "Registless profil megosztása",
              }).catch(() => {});
            }}
          >
            <Text style={shared.btnTextSecondary}>📤 Profil megosztása</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[shared.btnOutline, { width: "100%", marginTop: 10 }]} onPress={() => navigate("sellerDashboard")}>
            <Text style={shared.btnTextSecondary}>← Vissza</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Local Search ──────────────────────────────────────────────
  if (screen === "localSearch") {
    content = (
      <LocalSearchScreen
        onBack={() => navigate(activeRole === "seller" ? "sellerDashboard" : "buyerDashboard")}
      />
    );
  }

  // ── OCR ───────────────────────────────────────────────────────
  if (screen === "ocr") {
    content = (
      <OcrScreen
        permission={permission}
        requestPermission={requestPermission}
        defaultUseCase={ocrUseCase}
        onApplyProfile={(p) => applyOcrResult({ parsed: p, useCase: "profile", activeRole, appState: app, navigate })}
        onApplyPartner={(p) => applyOcrResult({ parsed: p, useCase: "partner", activeRole, appState: app, navigate })}
        onApplyInvoice={(p) => applyOcrResult({ parsed: p, useCase: "invoice", activeRole, appState: app, navigate })}
        onBack={() => navigate(activeRole === "seller" ? "sellerDashboard" : "buyerDashboard")}
      />
    );
  }

  // ── Settings ──────────────────────────────────────────────────
  if (screen === "settings") {
    content = (
      <SafeAreaView style={{ flex: 1, width: "100%" }}>
        <SettingsScreen
          sellerName={app.sellerName}         setSellerName={app.setSellerName}
          sellerAddress={app.sellerAddress}   setSellerAddress={app.setSellerAddress}
          sellerCompany={app.sellerCompany}   setSellerCompany={app.setSellerCompany}
          sellerTaxNumber={app.sellerTaxNumber} setSellerTaxNumber={app.setSellerTaxNumber}
          sellerBankAccount={app.sellerBankAccount} setSellerBankAccount={app.setSellerBankAccount}
          buyerName={app.buyerName}           setBuyerName={app.setBuyerName}
          buyerAddress={app.buyerAddress}     setBuyerAddress={app.setBuyerAddress}
          buyerCompany={app.buyerCompany}     setBuyerCompany={app.setBuyerCompany}
          sellerQrPayload={app.sellerQrPayload}
          buyerQrPayload={app.buyerQrPayload}
          selectedPaymentMethod={app.selectedPaymentMethod}
          setSelectedPaymentMethod={app.setSelectedPaymentMethod}
          onOcr={() => navigate("ocr", { ocrUseCase: "partner" })}
          onResetAll={handleResetAll}
          onRestartOnboarding={() => { AsyncStorage.removeItem(ONBOARDING_KEY); setShowOnboarding(true); }}
	  sellerTaxType={app.sellerTaxType}
	  setSellerTaxType={app.setSellerTaxType}
          onBack={() => navigate(activeRole === "seller" ? "sellerDashboard" : activeRole === "buyer" ? "buyerDashboard" : "home")}
          initialSection={settingsSection}
        />
      </SafeAreaView>
    );
  }

  // ── Partner lista ─────────────────────────────────────────────
  if (screen === "partnerList") {
    const contacts = activeRole === "seller" ? sellerContacts : buyerContacts;
    content = (
      <SafeAreaView style={{ flex: 1, width: "100%" }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingTop: 16 }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20, paddingTop: 48 }}>
            <Text style={{ color: "#fff", fontSize: 24, fontWeight: "bold" }}>
              {activeRole === "seller" ? "Partnereim" : "Kapcsolataim"}
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                style={{ backgroundColor: "rgba(255,122,26,0.15)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(255,122,26,0.4)", flexDirection: "row", alignItems: "center", gap: 6 }}
                onPress={() => navigate("qrScan", { role: activeRole })}
              >
                <Text style={{ fontSize: 16 }}>📷</Text>
                <Text style={{ color: "#ff7a1a", fontSize: 13, fontWeight: "600" }}>QR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ backgroundColor: "rgba(79,195,247,0.15)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(79,195,247,0.4)", flexDirection: "row", alignItems: "center", gap: 6 }}
                onPress={() => navigate("ocr", { ocrUseCase: "partner" })}
              >
                <Text style={{ fontSize: 16 }}>🔍</Text>
                <Text style={{ color: "#4fc3f7", fontSize: 13, fontWeight: "600" }}>OCR</Text>
              </TouchableOpacity>
            </View>
          </View>
          {contacts.length === 0 ? (
            <View style={{ backgroundColor: "rgba(20,20,20,0.5)", borderRadius: 20, padding: 32, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>👥</Text>
              <Text style={{ color: "#fff", fontSize: 16, textAlign: "center" }}>Még nincs partner. A + gombbal adhatsz hozzá újat.</Text>
            </View>
          ) : (
            contacts.map((c) => (
              <View key={c.id} style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: "rgba(20,20,20,0.5)", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", flexDirection: "row", alignItems: "center" }}
                  onPress={() => navigate("partnerWorkspace", { contactId: c.id, role: activeRole })}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,122,26,0.2)", borderWidth: 1, borderColor: "rgba(255,122,26,0.4)", justifyContent: "center", alignItems: "center", marginRight: 12 }}>
                    <Text style={{ color: "#ff7a1a", fontSize: 18, fontWeight: "bold" }}>{(c.name || "?")[0].toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>{c.name}</Text>
                    {!!c.company && <Text style={{ color: "#888", fontSize: 12, marginTop: 2 }}>{c.company}</Text>}
                  </View>
                  {(c.openItems || []).length > 0 && (
                    <View style={{ backgroundColor: "rgba(255,122,26,0.2)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "rgba(255,122,26,0.4)", marginRight: 8 }}>
                      <Text style={{ color: "#ff7a1a", fontSize: 11 }}>{c.openItems.length} nyitott</Text>
                    </View>
                  )}
                  <Text style={{ color: "#888", fontSize: 18 }}>›</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ marginLeft: 8, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,50,50,0.15)", borderWidth: 1, borderColor: "rgba(255,50,50,0.3)", justifyContent: "center", alignItems: "center" }}
                  onPress={() => Alert.alert("Partner törlése", `Biztosan törlöd: ${c.name}?`, [
                    { text: "Nem", style: "cancel" },
                    { text: "Törlöm", style: "destructive", onPress: () => app.deleteContact?.(c.id) },
                  ])}
                >
                  <Text style={{ fontSize: 18 }}>🗑</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
        <TouchableOpacity style={s.floatingBack} onPress={() => navigate(activeRole === "seller" ? "sellerDashboard" : "buyerDashboard")}>
          <Image source={require("./assets/backbutton.png")} style={s.floatingBackImg} />
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Üzenetek lista ────────────────────────────────────────────
  if (screen === "messagesList") {
    const msgContacts = (activeRole === "seller" ? sellerContacts : buyerContacts)
      .filter(c => c.channels?.chat || (c.messages || []).length > 0);
    content = (
      <SafeAreaView style={{ flex: 1, width: "100%" }}>
        <View style={{ paddingTop: 52, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" }}>
          <Text style={{ color: "#fff", fontSize: 24, fontWeight: "bold" }}>💬 Üzenetek</Text>
          <Text style={{ color: "#888", fontSize: 12, marginTop: 2 }}>{msgContacts.length} aktív beszélgetés</Text>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
          {msgContacts.length === 0 ? (
            <View style={{ padding: 40, alignItems: "center" }}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>💬</Text>
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "bold", textAlign: "center" }}>Még nincs üzeneted</Text>
              <Text style={{ color: "#888", fontSize: 14, textAlign: "center", marginTop: 8 }}>Nyisd meg egy partner munkaterét és küldj üzenetet!</Text>
            </View>
          ) : (
            msgContacts.map((c) => {
              const lastMsg = (c.messages || []).slice(-1)[0];
              const hasUnread = (c.messages || []).some(m => !m.read && m.senderUid !== (activeRole === "seller" ? app.sellerUid : app.buyerUid));
              return (
                <TouchableOpacity key={c.id}
                  style={{ flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)", backgroundColor: hasUnread ? "rgba(255,122,26,0.05)" : "transparent" }}
                  onPress={() => navigate("partnerWorkspace", { contactId: c.id, role: activeRole, initialTab: "chat" })}
                >
                  {/* Avatar */}
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: hasUnread ? "rgba(255,122,26,0.2)" : "rgba(0,188,212,0.15)", borderWidth: 2, borderColor: hasUnread ? "#ff7a1a" : "rgba(0,188,212,0.3)", justifyContent: "center", alignItems: "center", marginRight: 14 }}>
                    <Text style={{ color: hasUnread ? "#ff7a1a" : "#00BCD4", fontSize: 20, fontWeight: "bold" }}>{(c.name || "?")[0].toUpperCase()}</Text>
                  </View>
                  {/* Info */}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ color: "#fff", fontSize: 16, fontWeight: hasUnread ? "700" : "600" }}>{c.name}</Text>
                      {lastMsg && <Text style={{ color: "#555", fontSize: 11 }}>{new Date(lastMsg.timestamp || lastMsg.sentAt).toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" })}</Text>}
                    </View>
                    {!!c.company && <Text style={{ color: "#666", fontSize: 12, marginTop: 1 }}>{c.company}</Text>}
                    {lastMsg && (
                      <Text style={{ color: hasUnread ? "#ccc" : "#666", fontSize: 13, marginTop: 3 }} numberOfLines={1}>
                        {lastMsg.type === "image" ? "📷 Kép" : lastMsg.type === "invoice" ? "📄 Számla" : lastMsg.text || ""}
                      </Text>
                    )}
                  </View>
                  {hasUnread && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#ff7a1a", marginLeft: 8 }} />}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
        <TouchableOpacity style={s.floatingBack} onPress={() => navigate(activeRole === "seller" ? "sellerDashboard" : "buyerDashboard")}>
          <Image source={require("./assets/backbutton.png")} style={s.floatingBackImg} />
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Számlák lista ─────────────────────────────────────────────
  if (screen === "invoiceList") {
    const contacts = activeRole === "seller" ? sellerContacts : buyerContacts;
    const allInvoices = contacts.flatMap(c => (c.invoices || []).map(inv => ({ ...inv, contactName: c.name, contactId: c.id }))).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const filtered = allInvoices.filter(inv => {
      if (invSearch && !inv.id?.toLowerCase().includes(invSearch.toLowerCase()) && !inv.contactName?.toLowerCase().includes(invSearch.toLowerCase())) return false;
      if (invFilter === "paid" && inv.statusz !== "PAID") return false;
      if (invFilter === "open" && inv.statusz === "PAID") return false;
      if (invFrom && inv.datum) { const d = inv.datum.replace(/\s/g,"").replace(/\./g,"-").replace(/--+/g,"-").replace(/-$/,""); if (d < invFrom.replace(/\./g,"-")) return false; }
      if (invTo   && inv.datum) { const d = inv.datum.replace(/\s/g,"").replace(/\./g,"-").replace(/--+/g,"-").replace(/-$/,""); if (d > invTo.replace(/\./g,"-")) return false; }
      return true;
    });
    const totalBrutto = filtered.reduce((s, i) => s + Number(i.bruttoOsszesen || 0), 0);
    const paidCount   = filtered.filter(i => i.statusz === "PAID").length;
    const openCount   = filtered.filter(i => i.statusz !== "PAID").length;

    content = (
      <SafeAreaView style={{ flex: 1, width: "100%" }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingTop: 16, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
            <Text style={{ color: "#fff", fontSize: 24, fontWeight: "bold", marginBottom: 16, paddingTop: 48 }}>Számlák</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
              <View style={{ flex: 1, backgroundColor: "rgba(76,175,80,0.15)", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "rgba(76,175,80,0.3)", alignItems: "center" }}>
                <Text style={{ color: "#4CAF50", fontSize: 18, fontWeight: "bold" }}>{paidCount}</Text>
                <Text style={{ color: "#888", fontSize: 11, marginTop: 2 }}>Fizetve</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: "rgba(255,152,0,0.15)", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "rgba(255,152,0,0.3)", alignItems: "center" }}>
                <Text style={{ color: "#FF9800", fontSize: 18, fontWeight: "bold" }}>{openCount}</Text>
                <Text style={{ color: "#888", fontSize: 11, marginTop: 2 }}>Nyitott</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: "rgba(255,122,26,0.15)", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "rgba(255,122,26,0.3)", alignItems: "center" }}>
                <Text style={{ color: "#ff7a1a", fontSize: 13, fontWeight: "bold" }}>{totalBrutto.toLocaleString("hu-HU")} Ft</Text>
                <Text style={{ color: "#888", fontSize: 11, marginTop: 2 }}>Összesen</Text>
              </View>
            </View>
            <View style={{ backgroundColor: "rgba(20,20,20,0.6)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", flexDirection: "row", alignItems: "center", paddingHorizontal: 12, marginBottom: 10 }}>
              <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
              <TextInput style={{ flex: 1, color: "#fff", paddingVertical: 12, fontSize: 14 }} value={invSearch} onChangeText={setInvSearch} placeholder="Keresés számlaszám, partner..." placeholderTextColor="#666" />
              {!!invSearch && <TouchableOpacity onPress={() => setInvSearch("")}><Text style={{ color: "#888" }}>✕</Text></TouchableOpacity>}
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
              {[["all","Mind"],["open","🟠 Nyitott"],["paid","✅ Fizetve"]].map(([val, label]) => (
                <TouchableOpacity key={val} style={{ flex: 1, backgroundColor: invFilter === val ? "rgba(255,122,26,0.25)" : "rgba(20,20,20,0.5)", borderRadius: 12, padding: 10, alignItems: "center", borderWidth: 1, borderColor: invFilter === val ? "rgba(255,122,26,0.5)" : "rgba(255,255,255,0.1)" }} onPress={() => setInvFilter(val)}>
                  <Text style={{ color: invFilter === val ? "#ff7a1a" : "#888", fontSize: 12, fontWeight: "600" }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {filtered.length === 0 ? (
              <View style={{ backgroundColor: "rgba(20,20,20,0.5)", borderRadius: 20, padding: 32, alignItems: "center" }}>
                <Text style={{ fontSize: 40, marginBottom: 12 }}>📄</Text>
                <Text style={{ color: "#fff", textAlign: "center" }}>Nincs találat.</Text>
              </View>
            ) : filtered.map((inv) => (
              <TouchableOpacity key={inv.id}
                style={{ backgroundColor: "rgba(20,20,20,0.5)", borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: inv.statusz === "PAID" ? "rgba(76,175,80,0.4)" : "rgba(255,152,0,0.3)" }}
                onPress={() => {
                  const contact = app.getContactById(inv.contactId);
                  Alert.alert(
                    inv.id,
                    `${inv.contactName} · ${inv.datum}\n${(inv.bruttoOsszesen || 0).toLocaleString("hu-HU")} Ft`,
                    [
                      {
                        text: "📄 PDF generálás",
                        onPress: async () => {
                          try {
                            const { buildInvoiceHtml, calcLine, calcTotals } = require("./src/services/invoice");
                            const tetelek = (inv.tetelek || []).length > 0 ? inv.tetelek :
                              (contact?.openItems || []).map(oi => calcLine(oi.serviceName || "Szolgáltatás", 1, oi.netto || oi.nettoAmount || Math.round((oi.amount || 0) / 1.27)));
                            const html = buildInvoiceHtml({
                              seller: { name: app.sellerName, company: app.sellerCompany, address: app.sellerAddress, taxNumber: app.sellerTaxNumber, bankAccount: app.sellerBankAccount },
                              buyer: { name: inv.contactName, company: contact?.company || "", address: contact?.address || "" },
                              items: tetelek,
                              invoiceId: inv.id,
                              date: inv.datum,
                              taxType: app.sellerTaxType || "kata",
                            });
                            const Print = require("expo-print");
                            const { uri } = await Print.printToFileAsync({ html });
                            const Sharing = require("expo-sharing");
                            if (await Sharing.isAvailableAsync()) {
                              await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: `${inv.id}` });
                            }
                          } catch(e) { Alert.alert("Hiba", e.message); }
                        }
                      },
                      {
                        text: "📤 Megosztás",
                        onPress: () => {
                          const { Share } = require("react-native");
                          Share.share({
                            message: `Számla: ${inv.id}\nDátum: ${inv.datum}\nPartner: ${inv.contactName}\nÖsszeg: ${(inv.bruttoOsszesen || 0).toLocaleString("hu-HU")} Ft`,
                            title: inv.id,
                          });
                        }
                      },
                      { text: "Partner megnyitása", onPress: () => navigate("partnerWorkspace", { contactId: inv.contactId, role: activeRole }) },
                      { text: "Mégse", style: "cancel" },
                    ]
                  );
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#fff", fontSize: 15, fontWeight: "bold" }}>{inv.id}</Text>
                    <Text style={{ color: "#888", fontSize: 12, marginTop: 2 }}>{inv.contactName} · {inv.datum}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text style={{ color: "#ff7a1a", fontWeight: "bold", fontSize: 15 }}>{(inv.bruttoOsszesen || 0).toLocaleString("hu-HU")} Ft</Text>
                    <View style={{ backgroundColor: inv.statusz === "PAID" ? "rgba(76,175,80,0.2)" : "rgba(255,152,0,0.2)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ color: inv.statusz === "PAID" ? "#4CAF50" : "#FF9800", fontSize: 11, fontWeight: "bold" }}>{inv.statusz === "PAID" ? "✅ FIZETVE" : "🟠 NYITOTT"}</Text>
                    </View>
                    <Text style={{ color: "#555", fontSize: 10, marginTop: 2 }}>Koppints a műveletekért</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={s.floatingBack} onPress={() => navigate(activeRole === "seller" ? "sellerDashboard" : "buyerDashboard")}>
            <Image source={require("./assets/backbutton.png")} style={s.floatingBackImg} />
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Időpontok ─────────────────────────────────────────────────
  if (screen === "todaySchedule" || screen === "appointments") {
    const calContacts = activeRole === "seller" ? sellerContacts : buyerContacts;
    content = (
      <CalendarScreen
        contacts={calContacts}
        activeRole={activeRole}
        onDayPress={(appt) => {
          if (appt.contactId) navigate("partnerWorkspace", { contactId: appt.contactId, role: activeRole });
        }}
        onBack={() => navigate(activeRole === "seller" ? "sellerDashboard" : "buyerDashboard")}
      />
    );
  }

  // ── Fallback ──────────────────────────────────────────────────
  if (!content) {
    content = (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
        <Text style={{ color: "#fff", fontSize: 16, marginBottom: 20 }}>⏳ {screen}</Text>
        <TouchableOpacity style={shared.btnOutline} onPress={() => navigate("home")}>
          <Text style={shared.btnTextSecondary}>HOME</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const quickActions = activeRole === "seller" ? SELLER_QUICK_ACTIONS : BUYER_QUICK_ACTIONS;
  const showFab = ["sellerDashboard", "buyerDashboard", "partnerWorkspace", "home", "invoiceList", "todaySchedule", "appointments", "partnerList", "messagesList", "localSearch", "newBooking", "ocr"].includes(screen);

  // Süti wheel items - szerepfüggő
  const wheelItems = screen === "home" ? [
    { icon: "🛍️", label: "Eladó mód", onPress: () => navigate("sellerDashboard", { role: "seller" }) },
    { icon: "🛒", label: "Vevő mód", onPress: () => navigate("buyerDashboard", { role: "buyer" }) },
    { icon: "📱", label: "QR Megosztás", onPress: () => navigate("qrShare") },
    { icon: "🔍", label: "Helyi Keresés", onPress: () => navigate("localSearch") },
  ] : activeRole === "seller" ? [
    { icon: "👥", label: "Partnereim", onPress: () => navigate("partnerList", { role: "seller" }) },
    { icon: "💬", label: "Üzenetek", onPress: () => navigate("messagesList", { role: "seller" }) },
    { icon: "📅", label: "Naptáram", onPress: () => navigate("todaySchedule") },
    { icon: "⚡", label: "Számla kiállítás", onPress: () => navigate("newService") },
    { icon: "📄", label: "Számlák", onPress: () => navigate("invoiceList") },
    { icon: "💰", label: "Pénzügyek", onPress: () => { if (activeContact) { navigate("partnerWorkspace", { contactId: activeContact.id, initialTab: "finance" }); } else { navigate("invoiceList"); } } },
  ] : [
    { icon: "👥", label: "Partnereim", onPress: () => navigate("partnerList", { role: "buyer" }) },
    { icon: "💬", label: "Üzenetek", onPress: () => navigate("messagesList", { role: "buyer" }) },
    { icon: "📅", label: "Naptáram", onPress: () => navigate("appointments") },
    { icon: "📅", label: "Új időpont", onPress: () => navigate("newBooking") },
    { icon: "📄", label: "Számláim", onPress: () => navigate("invoiceList") },
    { icon: "💰", label: "Pénzügyek", onPress: () => { if (activeContact) { navigate("partnerWorkspace", { contactId: activeContact.id, initialTab: "finance" }); } else { navigate("invoiceList"); } } },
  ];

  // ✅ VideoBackground a HOME screenhez, ImageBackground a többihez
  const Wrapper = screen === "home" ? VideoBackground : ImageBackground;
  const wrapperProps = screen === "home"
    ? { style: { flex: 1 } }
    : { source: require("./assets/background.png"), style: { flex: 1 }, resizeMode: "cover" };

  return (
    <ErrorBoundary>
    <Wrapper {...wrapperProps}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        {content}
      </Animated.View>

      {showFab && (
        <WheelFAB items={wheelItems} />
      )}
    </Wrapper>
    </ErrorBoundary>
  );
}

// ═════════════════════════════════════════════════════════════════
// INLINE SCREENS
// ═════════════════════════════════════════════════════════════════

function NewBookingScreen({ contact, onSubmit, onBack }) {
  const [svc, setSvc]     = useState("");
  const [datum, setDatum] = useState("");
  const [ido, setIdo]     = useState("");
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <Text style={[shared.title, { paddingTop: 16 }]}>IDŐPONT KÉRÉS</Text>
          {contact && <Text style={[shared.labelSmall, { marginBottom: 16 }]}>→ {contact.name}</Text>}
          <Text style={shared.label}>Szolgáltatás</Text>
          <TextInput style={shared.input} value={svc} onChangeText={setSvc} placeholder="pl. Személyi edzés" placeholderTextColor={colors.placeholder} />
          <Text style={shared.label}>Dátum (hh.nn)</Text>
          <TextInput style={shared.input} value={datum} onChangeText={setDatum} placeholder="pl. 03.25" placeholderTextColor={colors.placeholder} keyboardType="numeric" />
          <Text style={shared.label}>Időpont</Text>
          <TextInput style={shared.input} value={ido} onChangeText={setIdo} placeholder="pl. 10:00" placeholderTextColor={colors.placeholder} />
          <TouchableOpacity style={shared.btnPrimary} onPress={() => {
            if (!svc || !datum) { Alert.alert("Hiányzó adat", "Töltsd ki a mezőket."); return; }
            onSubmit({ id: `req-${Date.now()}`, serviceName: svc, datum, ido, statusz: "függőben", createdAt: Date.now() });
          }}>
            <Text style={shared.btnTextPrimary}>📅  Kérés elküldése</Text>
          </TouchableOpacity>
        </ScrollView>
        <TouchableOpacity style={s.floatingBack} onPress={onBack}>
          <Image source={require("./assets/backbutton.png")} style={s.floatingBackImg} />
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ✅ JAVÍTOTT NewServiceScreen — Darabszám számlálóval
function NewServiceScreen({ contact, quickServices = [], onSubmit, onAddToQuickList, onBack }) {
  const [svcName, setSvcName]     = useState("");
  const [svcAmount, setSvcAmount] = useState("");
  const [quantity, setQuantity]   = useState(1);
  const [qsQuantities, setQsQuantities] = useState({});

  function buildItem() {
    if (!svcName.trim()) { Alert.alert("Hiányzó adat", "Add meg a szolgáltatás nevét."); return null; }
    const netto = Number(svcAmount) || 0;
    const qty   = Math.max(1, quantity);
    return {
      id: `oi-${Date.now()}`,
      serviceName: qty > 1 ? `${svcName.trim()} (${qty} db)` : svcName.trim(),
      quantity: qty,
      netto: netto * qty, afa27: Math.round(netto * qty * 0.27),
      brutto: Math.round(netto * qty * 1.27), amount: Math.round(netto * qty * 1.27),
      datum: new Date().toLocaleDateString("hu-HU"), createdAt: Date.now(),
    };
  }

  const isCustom = svcName.trim() &&
    !quickServices.find(qs => qs.name.toLowerCase() === svcName.trim().toLowerCase());

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <Text style={[shared.title, { paddingTop: 16 }]}>ÚJ SZOLGÁLTATÁS</Text>
          {contact && (
            <View style={[shared.card, { marginBottom: 16 }]}>
              <Text style={shared.value}>👤 {contact.name}</Text>
            </View>
          )}
          <Text style={shared.label}>Szolgáltatás neve</Text>
          <TextInput style={shared.input} value={svcName} onChangeText={setSvcName}
            placeholder="pl. Személyi edzés" placeholderTextColor={colors.placeholder} />
          <Text style={shared.label}>Összeg (Ft, nettó)</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <TextInput style={[shared.input, { flex: 1 }]} value={svcAmount} onChangeText={setSvcAmount}
              placeholder="pl. 10000" placeholderTextColor={colors.placeholder} keyboardType="numeric" />
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.bgCard, borderRadius: 12, borderWidth: 1, borderColor: colors.borderSubtle, overflow: "hidden" }}>
              <TouchableOpacity style={{ paddingHorizontal: 12, paddingVertical: 14 }} onPress={() => setQuantity(q => Math.max(1, q - 1))}>
                <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "bold" }}>−</Text>
              </TouchableOpacity>
              <Text style={{ color: colors.accent, fontSize: 16, fontWeight: "bold", minWidth: 28, textAlign: "center" }}>{quantity}</Text>
              <TouchableOpacity style={{ paddingHorizontal: 12, paddingVertical: 14 }} onPress={() => setQuantity(q => q + 1)}>
                <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "bold" }}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          {quantity > 1 && !!svcAmount && (
            <Text style={{ color: colors.accent, fontSize: 12, marginTop: 4 }}>
              Összesen: {(Number(svcAmount) * quantity).toLocaleString("hu-HU")} Ft nettó
            </Text>
          )}

          {/* ✅ Gyorslistára hozzáadás gomb */}
          {isCustom && !!svcAmount && (
            <TouchableOpacity
              style={{ backgroundColor: "rgba(0,188,212,0.12)", borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "rgba(0,188,212,0.35)", flexDirection: "row", alignItems: "center", gap: 8 }}
              onPress={() => {
                const qs = { id: `qs-${Date.now()}`, name: svcName.trim(), amount: Number(svcAmount) || 0 };
                onAddToQuickList?.(qs);
                Alert.alert("✅ Hozzáadva", `"${svcName}" felkerült a gyorslistára.`);
              }}
            >
              <Text style={{ fontSize: 18 }}>➕</Text>
              <Text style={{ color: "#00BCD4", fontSize: 14, fontWeight: "600" }}>Hozzáadás a gyorslistához</Text>
            </TouchableOpacity>
          )}

          {quickServices.length > 0 && (
            <>
              <Text style={[shared.labelSmall, { marginBottom: 8, marginTop: 4 }]}>Gyors választás:</Text>
              {quickServices.map((qs) => {
                const qsQty = qsQuantities[qs.id] || 1;
                return (
                  <View key={qs.id} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 }}>
                    <TouchableOpacity
                      style={{ flex: 1, backgroundColor: colors.bgCard, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.borderSubtle }}
                      onPress={() => { setSvcName(qs.name); setSvcAmount(String(qs.amount)); setQuantity(qsQty); }}
                    >
                      <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{qs.name} — {formatCurrency(qs.amount * qsQty)}</Text>
                      {qsQty > 1 && <Text style={{ color: colors.accent, fontSize: 11, marginTop: 2 }}>{qsQty} db × {formatCurrency(qs.amount)}</Text>}
                    </TouchableOpacity>
                    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.bgCard, borderRadius: 12, borderWidth: 1, borderColor: colors.borderSubtle, overflow: "hidden" }}>
                      <TouchableOpacity style={{ paddingHorizontal: 10, paddingVertical: 12 }} onPress={() => setQsQuantities(q => ({ ...q, [qs.id]: Math.max(1, (q[qs.id] || 1) - 1) }))}>
                        <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "bold" }}>−</Text>
                      </TouchableOpacity>
                      <Text style={{ color: colors.accent, fontSize: 15, fontWeight: "bold", minWidth: 24, textAlign: "center" }}>{qsQty}</Text>
                      <TouchableOpacity style={{ paddingHorizontal: 10, paddingVertical: 12 }} onPress={() => setQsQuantities(q => ({ ...q, [qs.id]: (q[qs.id] || 1) + 1 }))}>
                        <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "bold" }}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </>
          )}

          <TouchableOpacity style={[shared.btnPrimary, { marginTop: 16 }]} onPress={() => { const item = buildItem(); if (item) onSubmit(item); }}>
            <Text style={shared.btnTextPrimary}>⚡  Szolgáltatás lezárása</Text>
          </TouchableOpacity>
        </ScrollView>
        <TouchableOpacity style={s.floatingBack} onPress={onBack}>
          <Image source={require("./assets/backbutton.png")} style={s.floatingBackImg} />
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  homeScreen: { flex: 1, justifyContent: "space-evenly", alignItems: "center", paddingHorizontal: 24, paddingTop: 7, paddingBottom: 24 },
  logo:       { width: 200, height: 120 },
  shareBtn:   { alignItems: "center", marginTop: 8 },
  shareIcon:  { width: 64, height: 64, borderRadius: 16 },
  shareLabel: { color: "#fff", fontSize: 13, marginTop: 6, fontWeight: "600" },
  poweredBy:  { color: "rgba(255,255,255,0.65)", fontSize: 11, textAlign: "center", marginTop: 4, letterSpacing: 0.3 },
  fab: {
    position: "absolute", right: 20, bottom: 48,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "rgba(255,122,26,0.55)",
    justifyContent: "center", alignItems: "center",
    shadowColor: colors.accent, shadowOpacity: 0.4, shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 }, elevation: 8,
  },
  fabOpen:     { backgroundColor: "#555" },
  fabText:     { color: "#fff", fontSize: 28, fontWeight: "bold", lineHeight: 32 },
  fabBackdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)" },
  fabMenu: {
    position: "absolute", right: 20, bottom: 112,
    backgroundColor: "rgba(18,18,18,0.97)", borderRadius: 20, padding: 8,
    borderWidth: 1, borderColor: colors.borderSubtle,
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 12,
    elevation: 10, minWidth: 220,
  },
  fabMenuItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  fabMenuIcon:  { fontSize: 20, width: 28 },
  fabMenuLabel: { color: colors.textPrimary, fontSize: 15, fontWeight: "500" },
  floatingBack: {
    position: "absolute", left: 20, bottom: 48,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "rgba(30,30,30,0.92)",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.2)",
    justifyContent: "center", alignItems: "center",
    elevation: 20, zIndex: 200,
    shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  floatingBackImg: { width: 32, height: 32, resizeMode: "contain" },
});
