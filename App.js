// ─────────────────────────────────────────────────────────────────
// App.js — REGISTLESS navigator
// 2026-03-22 — VideoBackground, QR Share/Scan, NFC, NewService fix
// ─────────────────────────────────────────────────────────────────
import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, Image, ImageBackground,
  Animated, Easing, StyleSheet, Alert, Platform,
  ScrollView, TextInput, KeyboardAvoidingView,
  SafeAreaView, StatusBar, Linking, Share,
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
import VideoBackground  from "./src/components/VideoBackground";
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
  { id: "ocr",      icon: "🔍", label: "OCR import" },
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
  const [fabOpen, setFabOpen]             = useState(false);
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
    setScreen(to);
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
    const revolutUsername = app.sellerBankAccount?.startsWith("@")
      ? app.sellerBankAccount.replace("@", "") : null;
    const amountFt = amount.toLocaleString("hu-HU");
    Alert.alert(
      "💳 Fizetési kérés küldése",
      `Összeg: ${amountFt} Ft\nPartner: ${contact.name}\n\nVálassz fizetési módot:`,
      [
        { text: "Mégse", style: "cancel" },
        { text: "🔵 Stripe", onPress: async () => {
          try {
            const resp = await fetch(STRIPE_FUNCTION_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ amount: Math.round(amount * 100), invoiceId: label, sellerName: app.sellerName || "Registless", contactName: contact.name }),
            });
            const data = await resp.json();
            if (data.url) {
              Linking.openURL(data.url).catch(() => Alert.alert("Hiba", "Nem sikerült megnyitni a Stripe oldalt."));
              app.addActivityToContact(contactId, makeActivity(ActivityType.PAYMENT_REQUESTED, `Stripe fizetési kérés: ${amountFt} Ft`, { invoiceId, amount, method: "stripe" }));
            } else {
              Alert.alert("Stripe hiba", data.error || "Ismeretlen hiba");
            }
          } catch (e) { Alert.alert("Hiba", "Nem sikerült kapcsolódni."); }
        }},
        { text: "🟠 Simple", onPress: () => {
          Linking.openURL("https://simplepay.hu").catch(() => {});
          app.addActivityToContact(contactId, makeActivity(ActivityType.PAYMENT_REQUESTED, `Simple fizetési kérés: ${amountFt} Ft`, { invoiceId, amount, method: "simple" }));
        }},
        { text: "💜 Revolut", onPress: () => {
          Linking.openURL(revolutUsername ? `https://revolut.me/${revolutUsername}` : "https://revolut.com").catch(() => {});
          app.addActivityToContact(contactId, makeActivity(ActivityType.PAYMENT_REQUESTED, `Revolut fizetési kérés: ${amountFt} Ft`, { invoiceId, amount, method: "revolut" }));
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
        <View style={s.homeScreen}>
          <Image source={require("./assets/logo.png")} style={s.logo} resizeMode="contain" />

          {badge && (
            <TouchableOpacity
              onPress={() => setShowUpgrade(true)}
              style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 8 }}
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

          <View style={{ alignItems: "center", marginTop: 8 }}>
            {/* ✅ FIX: Megosztás → qrShare (nem settings) */}
            <TouchableOpacity style={s.shareBtn} onPress={() => navigate("qrShare")}>
              <Image source={require("./assets/share_icon.jpg")} style={s.shareIcon} />
              <Text style={s.shareLabel}>Megosztás</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
              {authUser?.email}
            </Text>
            <TouchableOpacity onPress={() => { logout(); setAuthUser(null); }}>
              <Text style={{ color: "#888", fontSize: 12, marginTop: 4 }}>Kijelentkezés</Text>
            </TouchableOpacity>
            <Text style={s.poweredBy}>Powered by Star Labs Kft. · All rights reserved</Text>
          </View>
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
          contact={activeContact}
          myUid={activeRole === "seller" ? app.sellerUid : app.buyerUid}
          partnerUid={activeContact.registlessUid}
          myRole={activeRole}
          onBack={() => navigate(activeRole === "seller" ? "sellerDashboard" : "buyerDashboard")}
          onStartService={() => navigate("newService", { contactId: activeContact.id })}
          onNewBooking={() => navigate("newBooking", { contactId: activeContact.id })}
          onAcceptBooking={(req) => handleAcceptBooking(activeContact.id, req)}
          onIssueInvoice={() => issueInvoice({
            contactId: activeContact.id,
            getContactById: app.getContactById,
            addInvoiceToContact: app.addInvoiceToContact,
            addActivityToContact: app.addActivityToContact,
            nextInvoiceNumber: app.nextInvoiceNumber,
            sellerProfile: {
              name: app.sellerName, company: app.sellerCompany,
              address: app.sellerAddress, taxNumber: app.sellerTaxNumber,
              bankAccount: app.sellerBankAccount,
            },
          })}
          onPayment={(invoiceId) => handlePaymentRequest(activeContact.id, invoiceId)}
          onMessageSent={async (text) => {
            const partnerToken = await getPushToken(activeContact.registlessUid).catch(() => null);
            if (partnerToken) sendPushToUser(partnerToken, `💬 Új üzenet — ${app.sellerName || "Registless"}`, text.length > 60 ? text.substring(0, 60) + "..." : text, { screen: "partnerWorkspace" });
          }}
          onInvoicePaid={async (invoiceId, amount) => {
            sendLocalNotification("✅ Számla kifizetve!", `${invoiceId} · ${amount?.toLocaleString("hu-HU")} Ft`);
          }}
        />
      </SafeAreaView>
    );
  }

  // ── New Booking ───────────────────────────────────────────────
  if (screen === "newBooking") {
    content = <NewBookingScreen
      contact={activeContact}
      onSubmit={(req) => {
        if (activeContact) {
          app.addActivityToContact(activeContact.id, makeActivity(ActivityType.BOOKING_REQUEST, `Időpont kérés: ${req.serviceName} – ${req.datum} ${req.ido}`, { request: req }));
          const contact = app.getContactById(activeContact.id);
          app.updateContact(activeContact.id, { bookingRequests: [req, ...(contact?.bookingRequests || [])] });
        }
        Alert.alert("✅ Elküldve", "Az időpont kérés el lett küldve.", [{ text: "OK" }]);
        navigate("partnerWorkspace");
      }}
      onBack={() => navigate("partnerWorkspace")}
    />;
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
        app.addQuickService?.(qs);
      }}
      onBack={() => activeContact ? navigate("partnerWorkspace") : navigate("sellerDashboard")}
    />;
  }

  // ── QR Megosztás — saját QR kód ──────────────────────────────
  if (screen === "qrShare") {
    const qrValue    = app.sellerQrPayload || app.buyerQrPayload || app.sellerUid || authUser?.uid || "registless-default";
    const shareText  = `Adj hozzá engem a Registless appban!\n\nNévjegy: ${app.sellerName || app.buyerName || ""}\n${app.sellerCompany ? app.sellerCompany + "\n" : ""}Registless ID: ${qrValue}\n\nhttps://registless.ai`;
    content = (
      <SafeAreaView style={{ flex: 1, width: "100%" }}>
        <ScrollView contentContainerStyle={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Text style={{ color: "#fff", fontSize: 22, fontWeight: "bold", marginBottom: 8, textAlign: "center" }}>
            📱 Saját QR kódom
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: "center", marginBottom: 32 }}>
            Mutasd ezt a kódot — a partner beolvasva hozzáad téged
          </Text>

          <View style={{ backgroundColor: "#fff", padding: 20, borderRadius: 24, shadowColor: "#ff7a1a", shadowOpacity: 0.4, shadowRadius: 24, elevation: 16 }}>
            {!!qrValue && qrValue.length > 2 ? (
              <QRCode value={qrValue} size={220} color="#111" backgroundColor="#fff" />
            ) : (
              <View style={{ width: 220, height: 220, backgroundColor: "#f0f0f0", borderRadius: 8, justifyContent: "center", alignItems: "center" }}>
                <Text style={{ color: "#888", fontSize: 12, textAlign: "center" }}>QR generálás...{"\n"}Kérjük várjon</Text>
              </View>
            )}
          </View>

          <View style={{ marginTop: 28, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "bold" }}>
              {app.sellerName || app.buyerName || "Névtelen"}
            </Text>
            {!!(app.sellerCompany || app.buyerCompany) && (
              <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 4 }}>
                {app.sellerCompany || app.buyerCompany}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={[shared.btnPrimary, { marginTop: 32, width: "100%" }]}
            onPress={() => Share.share({ message: shareText }).catch(() => {})}
          >
            <Text style={shared.btnTextPrimary}>📤  Megosztás másnak</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[shared.btnOutline, { width: "100%" }]} onPress={() => navigate("home")}>
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
        onScanned={(data) => {
          const newContact = {
            id:               `c-${Date.now()}`,
            name:             data.name     || "Ismeretlen",
            company:          data.company  || "",
            phone:            data.phone    || "",
            email:            data.email    || "",
            address:          data.address  || "",
            registlessUid:    data.uid      || data.registlessUid || null,
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
          onOcr={() => navigate("ocr", { ocrUseCase: "profile" })}
          onResetAll={handleResetAll}
          onRestartOnboarding={() => { AsyncStorage.removeItem(ONBOARDING_KEY); setShowOnboarding(true); }}
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
          <Text style={{ color: "#fff", fontSize: 24, fontWeight: "bold", marginBottom: 20, paddingTop: 48 }}>
            {activeRole === "seller" ? "Partnereim" : "Kapcsolataim"}
          </Text>
          {contacts.length === 0 ? (
            <View style={{ backgroundColor: "rgba(20,20,20,0.5)", borderRadius: 20, padding: 32, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>👥</Text>
              <Text style={{ color: "#fff", fontSize: 16, textAlign: "center" }}>Még nincs partner. A + gombbal adhatsz hozzá újat.</Text>
            </View>
          ) : (
            contacts.map((c) => (
              <TouchableOpacity key={c.id}
                style={{ backgroundColor: "rgba(20,20,20,0.5)", borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", flexDirection: "row", alignItems: "center" }}
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
    const contacts = activeRole === "seller" ? sellerContacts : buyerContacts;
    content = (
      <SafeAreaView style={{ flex: 1, width: "100%" }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingTop: 16 }}>
          <Text style={{ color: "#fff", fontSize: 24, fontWeight: "bold", marginBottom: 20, paddingTop: 48 }}>Üzenetek</Text>
          {contacts.length === 0 ? (
            <View style={{ backgroundColor: "rgba(20,20,20,0.5)", borderRadius: 20, padding: 32, alignItems: "center" }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>💬</Text>
              <Text style={{ color: "#fff", textAlign: "center" }}>Még nincs üzeneted.</Text>
            </View>
          ) : (
            contacts.map((c) => (
              <TouchableOpacity key={c.id}
                style={{ backgroundColor: "rgba(20,20,20,0.5)", borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", flexDirection: "row", alignItems: "center" }}
                onPress={() => navigate("partnerWorkspace", { contactId: c.id, role: activeRole })}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,188,212,0.15)", borderWidth: 1, borderColor: "rgba(0,188,212,0.3)", justifyContent: "center", alignItems: "center", marginRight: 12 }}>
                  <Text style={{ color: "#00BCD4", fontSize: 18, fontWeight: "bold" }}>{(c.name || "?")[0].toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>{c.name}</Text>
                  {!!c.company && <Text style={{ color: "#888", fontSize: 12, marginTop: 2 }}>{c.company}</Text>}
                </View>
                <Text style={{ color: "#888", fontSize: 18 }}>›</Text>
              </TouchableOpacity>
            ))
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
                onPress={() => navigate("partnerWorkspace", { contactId: inv.contactId, role: activeRole })}
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
    const contacts  = activeRole === "seller" ? sellerContacts : buyerContacts;
    const today     = new Date();
    const todayStr  = `${String(today.getMonth()+1).padStart(2,"0")}.${String(today.getDate()).padStart(2,"0")}`;
    const allAppts  = contacts.flatMap(c => {
      const appts = activeRole === "seller" ? (c.appointments || []) : (c.calendar || []);
      return appts.map(a => ({ ...a, contactName: c.name, contactId: c.id }));
    }).sort((a, b) => (a.ido || "").localeCompare(b.ido || ""));
    const todayAppts  = allAppts.filter(a => a.datum === todayStr);
    const futureAppts = allAppts.filter(a => a.datum !== todayStr);
    content = (
      <SafeAreaView style={{ flex: 1, width: "100%" }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingTop: 16 }}>
          <Text style={{ color: "#fff", fontSize: 24, fontWeight: "bold", marginBottom: 20, paddingTop: 48 }}>
            {screen === "todaySchedule" ? "Mai nap" : "Időpontjaim"}
          </Text>
          {todayAppts.length > 0 && (<>
            <Text style={{ color: "#ff7a1a", fontSize: 14, fontWeight: "bold", marginBottom: 10 }}>📅 MA</Text>
            {todayAppts.map((a) => (
              <TouchableOpacity key={a.id} style={{ backgroundColor: "rgba(255,122,26,0.1)", borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: "rgba(255,122,26,0.3)" }} onPress={() => navigate("partnerWorkspace", { contactId: a.contactId, role: activeRole })}>
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "bold" }}>{a.ido} — {a.serviceName}</Text>
                <Text style={{ color: "#888", marginTop: 4 }}>👤 {a.contactName}</Text>
                {a.amount > 0 && <Text style={{ color: "#ff7a1a", marginTop: 4 }}>{a.amount.toLocaleString("hu-HU")} Ft</Text>}
              </TouchableOpacity>
            ))}
          </>)}
          {futureAppts.length > 0 && (<>
            <Text style={{ color: "#888", fontSize: 14, fontWeight: "bold", marginBottom: 10, marginTop: 8 }}>KÖZELGŐ</Text>
            {futureAppts.map((a) => (
              <TouchableOpacity key={a.id} style={{ backgroundColor: "rgba(20,20,20,0.5)", borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }} onPress={() => navigate("partnerWorkspace", { contactId: a.contactId, role: activeRole })}>
                <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>{a.datum} {a.ido} — {a.serviceName}</Text>
                <Text style={{ color: "#888", marginTop: 4 }}>👤 {a.contactName}</Text>
              </TouchableOpacity>
            ))}
          </>)}
          {allAppts.length === 0 && (
            <View style={{ backgroundColor: "rgba(20,20,20,0.5)", borderRadius: 20, padding: 32, alignItems: "center" }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>📅</Text>
              <Text style={{ color: "#fff", textAlign: "center" }}>Még nincs időpont.</Text>
            </View>
          )}
        </ScrollView>
        <TouchableOpacity style={s.floatingBack} onPress={() => navigate(activeRole === "seller" ? "sellerDashboard" : "buyerDashboard")}>
          <Image source={require("./assets/backbutton.png")} style={s.floatingBackImg} />
        </TouchableOpacity>
      </SafeAreaView>
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
  const showFab      = ["sellerDashboard", "buyerDashboard", "partnerWorkspace"].includes(screen);

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
        <>
          {fabOpen && <TouchableOpacity style={s.fabBackdrop} onPress={() => setFabOpen(false)} activeOpacity={1} />}
          {fabOpen && (
            <View style={[s.fabMenu, {
              bottom: screen === "partnerWorkspace"
                ? (appKbHeight > 0 ? appKbHeight + 224 : 212) : 112
            }]}>
              {quickActions.map((action, i) => (
                <TouchableOpacity
                  key={action.id}
                  style={[s.fabMenuItem, i === quickActions.length - 1 && { borderBottomWidth: 0 }]}
                  onPress={() => handleQuickAction(action.id)}
                >
                  <Text style={s.fabMenuIcon}>{action.icon}</Text>
                  <Text style={s.fabMenuLabel}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <TouchableOpacity style={[s.fab, fabOpen && s.fabOpen, {
            bottom: screen === "partnerWorkspace"
              ? (appKbHeight > 0 ? appKbHeight + 160 : 172) : 48
          }]} onPress={() => setFabOpen(!fabOpen)}>
            <Text style={s.fabText}>{fabOpen ? "✕" : "+"}</Text>
          </TouchableOpacity>
        </>
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

// ✅ JAVÍTOTT NewServiceScreen — "Hozzáadás a gyorslistához" gombbal
function NewServiceScreen({ contact, quickServices = [], onSubmit, onAddToQuickList, onBack }) {
  const [svcName, setSvcName]     = useState("");
  const [svcAmount, setSvcAmount] = useState("");

  function buildItem() {
    if (!svcName.trim()) { Alert.alert("Hiányzó adat", "Add meg a szolgáltatás nevét."); return null; }
    const netto = Number(svcAmount) || 0;
    return {
      id: `oi-${Date.now()}`, serviceName: svcName.trim(),
      netto, afa27: Math.round(netto * 0.27),
      brutto: Math.round(netto * 1.27), amount: Math.round(netto * 1.27),
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
          <TextInput style={shared.input} value={svcAmount} onChangeText={setSvcAmount}
            placeholder="pl. 10000" placeholderTextColor={colors.placeholder} keyboardType="numeric" />

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
              {quickServices.map((qs) => (
                <TouchableOpacity key={qs.id}
                  style={{ backgroundColor: colors.bgCard, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.borderSubtle }}
                  onPress={() => { setSvcName(qs.name); setSvcAmount(String(qs.amount)); }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{qs.name} — {formatCurrency(qs.amount)}</Text>
                </TouchableOpacity>
              ))}
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
    backgroundColor: colors.accent,
    justifyContent: "center", alignItems: "center",
    shadowColor: colors.accent, shadowOpacity: 0.5, shadowRadius: 12,
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
