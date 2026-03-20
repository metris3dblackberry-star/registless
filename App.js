// ─────────────────────────────────────────────────────────────────
// App.js — REGISTLESS demo-ready navigator
// ─────────────────────────────────────────────────────────────────
import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, Image, ImageBackground,
  Animated, Easing, StyleSheet, Alert, Platform,
  ScrollView, TextInput, KeyboardAvoidingView,
  SafeAreaView, StatusBar, Linking,
} from "react-native";
import { useCameraPermissions } from "expo-camera";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Hooks
import { useAppState } from "./src/hooks/useAppState";

// Screens
import SellerDashboard from "./src/screens/SellerDashboard";
import BuyerDashboard from "./src/screens/BuyerDashboard";
import PartnerWorkspace from "./src/screens/PartnerWorkspace";
import OcrScreen from "./src/screens/OcrScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import OnboardingScreen from "./src/screens/OnboardingScreen";

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

import { colors } from "./src/theme/colors";
import { shared } from "./src/theme/styles";
import { formatCurrency } from "./src/services/invoice";
import {
  registerForPushNotifications,
  sendLocalNotification,
  sendPushToUser,
  setupNotificationListeners,
} from "./pushService";
import { getPushToken } from "./firebase";
import { onAuthChange, logout } from "./src/services/authService";
import { getLicense, getLicenseStatus, startTrial, PLANS } from "./src/services/licenseService";
import AuthScreen from "./src/screens/AuthScreen";
import UpgradeScreen from "./src/screens/UpgradeScreen";

const ONBOARDING_KEY = "registless_onboarding_seen_v1";

const SELLER_QUICK_ACTIONS = [
  { id: "partner", icon: "📱", label: "Új partner QR-rel" },
  { id: "service", icon: "⚡", label: "Új szolgáltatás" },
  { id: "ocr",     icon: "🔍", label: "OCR import" },
  { id: "settings",icon: "⚙️", label: "Beállítások" },
];
const BUYER_QUICK_ACTIONS = [
  { id: "partner", icon: "📷", label: "Eladó QR scan" },
  { id: "ocr",     icon: "🔍", label: "OCR import" },
  { id: "settings",icon: "⚙️", label: "Beállítások" },
];

export default function App() {
  const app = useAppState();
  const [permission, requestPermission] = useCameraPermissions();

  const [screen, setScreen] = useState("home");
  const [activeContactId, setActiveContactId] = useState(null);
  const [activeRole, setActiveRole] = useState("seller");
  const [ocrUseCase, setOcrUseCase] = useState("partner");
  const [settingsSection, setSettingsSection] = useState(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [appKbHeight, setAppKbHeight] = useState(0);
  // invoiceList screen state — ide kell, nem if-en belülre!
  const [invSearch, setInvSearch] = useState("");
  const [invFrom, setInvFrom] = useState("");
  const [invTo, setInvTo] = useState("");
  const [invFilter, setInvFilter] = useState("all");

  // ── Auth + License state ──────────────────────────────────────
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [licenseStatus, setLicenseStatus] = useState(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthChange(async (user) => {
      setAuthUser(user);
      setAuthLoading(false);
      if (user) {
        // Licensz lekérése
        const license = await getLicense(user.uid).catch(() => null);
        if (!license) {
          // Első belépés — trial indítása
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
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // ── Onboarding + demo data ────────────────────────────────────
  useEffect(() => {
    if (!app.isHydrated) return;

    // Onboarding check
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

  // ── Push értesítések regisztrációja ──────────────────────────
  useEffect(() => {
    if (!app.isHydrated || !app.sellerUid) return;

    // Push token regisztráció
    registerForPushNotifications(app.sellerUid).catch(console.log);

    // Értesítés lisenerek
    const cleanup = setupNotificationListeners(
      (notification) => {
        // App előtérben kapott értesítés — pl. navigáció
        console.log("Push kapva:", notification);
      },
      (response) => {
        // Felhasználó kattintott az értesítésre
        const data = response.notification.request.content.data;
        if (data?.screen) navigate(data.screen, data);
      }
    );
    return cleanup;
  }, [app.isHydrated, app.sellerUid]);

  // ── Keyboard height figyelése (FAB pozícióhoz) ────────────────
  useEffect(() => {
    const { Keyboard } = require("react-native");
    const show = Keyboard.addListener("keyboardDidShow", (e) => setAppKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardDidHide", () => setAppKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  function navigate(to, opts = {}) {
    setFabOpen(false);
    slideAnim.setValue(18);
    fadeAnim.setValue(0);
    if (opts.contactId !== undefined) setActiveContactId(opts.contactId);
    if (opts.role !== undefined) setActiveRole(opts.role);
    if (opts.ocrUseCase !== undefined) setOcrUseCase(opts.ocrUseCase);
    if (opts.settingsSection !== undefined) setSettingsSection(opts.settingsSection);
    setScreen(to);
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }

  const activeContact = activeContactId ? app.getContactById(activeContactId) : null;
  const sellerContacts = app.getSellerContacts();
  const buyerContacts = app.getBuyerContacts();

  // ── Fizetési kérés (Stripe + Simple + Revolut) ───────────────
  const STRIPE_FUNCTION_URL = "https://europe-west1-registless.cloudfunctions.net/createStripeCheckout";

  async function handlePaymentRequest(contactId, invoiceId) {
    const contact = app.getContactById(contactId);
    if (!contact) return;

    let amount = 0;
    let label = "Fizetési kérés";

    if (invoiceId) {
      const inv = (contact.invoices || []).find(i => i.id === invoiceId);
      if (inv) { amount = inv.bruttoOsszesen || 0; label = inv.id; }
    } else {
      amount = (contact.openItems || []).reduce((s, oi) => s + (oi.brutto || oi.amount || 0), 0);
      label = app.sellerName || "Registless";
    }

    const revolutUsername = app.sellerBankAccount?.startsWith("@")
      ? app.sellerBankAccount.replace("@", "") : null;
    const amountFt = amount.toLocaleString("hu-HU");

    const buttons = [
      { text: "Mégse", style: "cancel" },
      {
        text: "🔵 Stripe",
        onPress: async () => {
          try {
            const resp = await fetch(STRIPE_FUNCTION_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                amount: Math.round(amount),
                invoiceId: label,
                sellerName: app.sellerName || "Registless",
                contactName: contact.name,
              }),
            });
            const data = await resp.json();
            if (data.url) {
              Linking.openURL(data.url).catch(() =>
                Alert.alert("Hiba", "Nem sikerült megnyitni a Stripe oldalt.")
              );
              app.addActivityToContact(contactId, makeActivity(
                ActivityType.PAYMENT_REQUESTED,
                `Stripe fizetési kérés küldve: ${amountFt} Ft`,
                { invoiceId, amount, method: "stripe" }
              ));
            } else {
              Alert.alert("Stripe hiba", data.error || "Ismeretlen hiba");
            }
          } catch (e) {
            Alert.alert("Hiba", "Nem sikerült kapcsolódni a fizetési rendszerhez.");
          }
        }
      },
      {
        text: "🟠 Simple",
        onPress: () => {
          Linking.openURL("https://simplepay.hu").catch(() =>
            Alert.alert("Hiba", "Simple Pay nem érhető el.")
          );
          app.addActivityToContact(contactId, makeActivity(
            ActivityType.PAYMENT_REQUESTED,
            `Simple fizetési kérés küldve: ${amountFt} Ft`,
            { invoiceId, amount, method: "simple" }
          ));
        }
      },
      {
        text: "💜 Revolut",
        onPress: () => {
          const url = revolutUsername
            ? `https://revolut.me/${revolutUsername}`
            : "https://revolut.com";
          Linking.openURL(url).catch(() =>
            Alert.alert("Hiba", "Revolut nem érhető el.")
          );
          app.addActivityToContact(contactId, makeActivity(
            ActivityType.PAYMENT_REQUESTED,
            `Revolut fizetési kérés küldve: ${amountFt} Ft`,
            { invoiceId, amount, method: "revolut" }
          ));
        }
      },
    ];

    Alert.alert(
      "💳 Fizetési kérés küldése",
      `Összeg: ${amountFt} Ft\nPartner: ${contact.name}\n\nVálassz fizetési módot:`,
      buttons
    );
  }

  // ── Booking accept ────────────────────────────────────────────
  async function handleAcceptBooking(contactId, req) {
    const appointment = {
      id: `appt-${Date.now()}`,
      serviceName: req.serviceName || "Szolgáltatás",
      datum: req.datum || "",
      ido: req.ido || "",
      statusz: "elfogadott foglalás",
      amount: req.amount || 0,
      createdAt: Date.now(),
    };

    // 1. ELADÓ oldalon: a partner (vevő) kapcsolathoz appointments-be
    app.addAppointmentToContact(contactId, appointment);
    app.addActivityToContact(contactId, makeActivity(
      ActivityType.BOOKING_ACCEPTED,
      `Időpont elfogadva: ${appointment.serviceName} – ${appointment.datum} ${appointment.ido}`,
      { appointment }
    ));

    // 2. VEVŐ oldalon: keressük meg a megfelelő buyer contact-ot és calendar-ba írjuk
    const sellerContact = app.getContactById(contactId);
    const partnerUid = sellerContact?.registlessUid;

    // Próbáljuk megtalálni a buyer oldali kapcsolatot többféleképpen
    const buyerContact = app.contacts.find(c =>
      c.myRoleInRelation === "buyer" && (
        (partnerUid && c.registlessUid === partnerUid) ||
        (c.name && sellerContact?.name && c.name === sellerContact.name)
      )
    );

    if (buyerContact) {
      const buyerAppt = {
        ...appointment,
        statusz: "elfogadva",
        myRoleInRelation: "buyer",
      };
      app.updateContact(buyerContact.id, {
        calendar: [buyerAppt, ...(buyerContact.calendar || [])],
        lastActivityAt: Date.now(),
      });
      app.addActivityToContact(buyerContact.id, makeActivity(
        ActivityType.BOOKING_ACCEPTED,
        `Időpont visszaigazolva: ${appointment.serviceName} – ${appointment.datum} ${appointment.ido}`,
        { appointment }
      ));

      // Push a vevőnek
      const buyerToken = await getPushToken(buyerContact.registlessUid).catch(() => null);
      if (buyerToken) {
        sendPushToUser(
          buyerToken,
          "📅 Időpont visszaigazolva!",
          `${appointment.serviceName} – ${appointment.datum} ${appointment.ido}`,
          { screen: "partnerWorkspace", contactId: buyerContact.id }
        );
      }
    }

    // 3. Booking request státuszát frissítjük "elfogadva"-ra
    const updatedRequests = (sellerContact?.bookingRequests || []).map(r =>
      r.id === req.id ? { ...r, statusz: "elfogadva" } : r
    );
    app.updateContact(contactId, { bookingRequests: updatedRequests });

    // Helyi push az eladónak
    sendLocalNotification(
      "📅 Időpont elfogadva",
      `${appointment.serviceName} – ${appointment.datum} ${appointment.ido}`
    );

    Alert.alert(
      "✅ Időpont elfogadva",
      `${appointment.serviceName}\n${appointment.datum} ${appointment.ido}\n\n` +
      `Bekerült az eladó és a vevő naptárába is.`
    );
  }

  // ── Reset all ─────────────────────────────────────────────────
  function handleResetAll() {
    Alert.alert(
      "Összes adat törlése",
      "Biztosan törölni szeretnéd az összes adatot?",
      [
        { text: "Nem", style: "cancel" },
        { text: "Igen, törlöm", style: "destructive", onPress: async () => {
          await AsyncStorage.clear();
          app.setContacts([]);
          app.setSellerName(""); app.setSellerCompany("");
          app.setSellerAddress(""); app.setSellerTaxNumber("");
          app.setSellerBankAccount("");
          app.setBuyerName(""); app.setBuyerAddress(""); app.setBuyerCompany("");
          Alert.alert("✅ Törölve", "Az app újraindításkor üres állapotból indul.", [
            { text: "OK", onPress: () => navigate("home") }
          ]);
        }},
      ]
    );
  }

  function handleQuickAction(id) {
    setFabOpen(false);
    if (id === "partner") navigate("qrScan");
    else if (id === "service") navigate("newService");
    else if (id === "ocr") navigate("ocr", { ocrUseCase: "partner" });
    else if (id === "settings") navigate("settings");
  }

  // ── Auth loading ──────────────────────────────────────────────
  if (authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0a0a0a" }}>
        <Text style={{ color: "#fff", fontSize: 22, fontWeight: "bold" }}>REGISTLESS</Text>
        <Text style={{ color: colors.textSecondary, marginTop: 8 }}>Betöltés...</Text>
      </View>
    );
  }

  // ── Auth screen ───────────────────────────────────────────────
  if (!authUser) {
    return (
      <ImageBackground source={require("./assets/background.png")} style={{ flex: 1 }} resizeMode="cover">
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <AuthScreen onAuthSuccess={(user) => setAuthUser(user)} />
      </ImageBackground>
    );
  }

  // ── Upgrade screen ────────────────────────────────────────────
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
        />
      </ImageBackground>
    );
  }

  // ── Loading ───────────────────────────────────────────────────
  if (!app.isHydrated) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0a0a0a" }}>
        <Text style={{ color: "#fff", fontSize: 22, fontWeight: "bold" }}>REGISTLESS</Text>
        <Text style={{ color: colors.textSecondary, marginTop: 8 }}>Betöltés...</Text>
      </View>
    );
  }

  // ── Onboarding ────────────────────────────────────────────────
  if (showOnboarding) {
    return (
      <OnboardingScreen onComplete={async () => {
        try { await AsyncStorage.setItem(ONBOARDING_KEY, "1"); } catch(e) {}
        setShowOnboarding(false);
      }} />
    );
  }

  let content = null;

  // ── Home ──────────────────────────────────────────────────────
  if (screen === "home") {
    const badge = licenseStatus ? require("./src/services/licenseService").getLicenseBadge(licenseStatus) : null;
    content = (
      <SafeAreaView style={{ flex: 1 }}>
        <View style={s.homeScreen}>
          <Image source={require("./assets/logo.png")} style={s.logo} resizeMode="contain" />


          {/* Licensz badge */}
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
            <TouchableOpacity style={s.shareBtn}
              onPress={() => navigate("settings", { settingsSection: "App megosztása" })}>
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
            // Push a partnernek új üzenet esetén
            const partnerToken = await getPushToken(activeContact.registlessUid).catch(() => null);
            if (partnerToken) {
              sendPushToUser(
                partnerToken,
                `💬 Új üzenet — ${app.sellerName || "Registless"}`,
                text.length > 60 ? text.substring(0, 60) + "..." : text,
                { screen: "partnerWorkspace" }
              );
            }
          }}
          onInvoicePaid={async (invoiceId, amount) => {
            // Helyi push — számla kifizetve
            sendLocalNotification(
              "✅ Számla kifizetve!",
              `${invoiceId} · ${amount?.toLocaleString("hu-HU")} Ft`
            );
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
          // Activity log
          app.addActivityToContact(activeContact.id, makeActivity(
            ActivityType.BOOKING_REQUEST,
            `Időpont kérés: ${req.serviceName} – ${req.datum} ${req.ido}`,
            { request: req }
          ));
          // Tegyük bele a bookingRequests-be is (seller látja)
          const contact = app.getContactById(activeContact.id);
          app.updateContact(activeContact.id, {
            bookingRequests: [req, ...(contact?.bookingRequests || [])],
          });
        }
        Alert.alert("✅ Elküldve", "Az időpont kérés el lett küldve. Az eladó az Időpontok fülön fogadhatja el.", [
          { text: "OK" }
        ]);
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
          app.addActivityToContact(activeContact.id, makeActivity(
            ActivityType.SERVICE_FINISHED,
            `Szolgáltatás lezárva: ${item.serviceName}`,
            { amount: item.brutto }
          ));
          Alert.alert("✅ Kész", "Hozzáadva a nyitott tételekhez!\nA Pénzügyek fülön állíthatsz ki számlát.");
          navigate("partnerWorkspace");
        } else {
          Alert.alert("ℹ️", "Válassz egy partnert a dashboardon.");
          navigate("sellerDashboard");
        }
      }}
      onBack={() => activeContact ? navigate("partnerWorkspace") : navigate("sellerDashboard")}
    />;
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
          sellerName={app.sellerName} setSellerName={app.setSellerName}
          sellerAddress={app.sellerAddress} setSellerAddress={app.setSellerAddress}
          sellerCompany={app.sellerCompany} setSellerCompany={app.setSellerCompany}
          sellerTaxNumber={app.sellerTaxNumber} setSellerTaxNumber={app.setSellerTaxNumber}
          sellerBankAccount={app.sellerBankAccount} setSellerBankAccount={app.setSellerBankAccount}
          buyerName={app.buyerName} setBuyerName={app.setBuyerName}
          buyerAddress={app.buyerAddress} setBuyerAddress={app.setBuyerAddress}
          buyerCompany={app.buyerCompany} setBuyerCompany={app.setBuyerCompany}
          sellerQrPayload={app.sellerQrPayload}
          buyerQrPayload={app.buyerQrPayload}
          selectedPaymentMethod={app.selectedPaymentMethod}
          setSelectedPaymentMethod={app.setSelectedPaymentMethod}
          onOcr={() => navigate("ocr", { ocrUseCase: "profile" })}
          onResetAll={handleResetAll}
          onRestartOnboarding={() => {
            AsyncStorage.removeItem(ONBOARDING_KEY);
            setShowOnboarding(true);
          }}
          onBack={() => navigate(
            activeRole === "seller" ? "sellerDashboard" :
            activeRole === "buyer" ? "buyerDashboard" : "home"
          )}
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
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingTop: 16 }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={{ color: "#fff", fontSize: 24, fontWeight: "bold", marginBottom: 20, paddingTop: 48 }}>
            {activeRole === "seller" ? "Partnereim" : "Kapcsolataim"}
          </Text>

          {contacts.length === 0 ? (
            <View style={{ backgroundColor: "rgba(20,20,20,0.5)", borderRadius: 20, padding: 32, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>👥</Text>
              <Text style={{ color: "#fff", fontSize: 16, textAlign: "center" }}>
                Még nincs partner. A + gombbal adhatsz hozzá újat.
              </Text>
            </View>
          ) : (
            contacts.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={{ backgroundColor: "rgba(20,20,20,0.5)", borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", flexDirection: "row", alignItems: "center" }}
                onPress={() => navigate("partnerWorkspace", { contactId: c.id, role: activeRole })}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,122,26,0.2)", borderWidth: 1, borderColor: "rgba(255,122,26,0.4)", justifyContent: "center", alignItems: "center", marginRight: 12 }}>
                  <Text style={{ color: "#ff7a1a", fontSize: 18, fontWeight: "bold" }}>
                    {(c.name || "?")[0].toUpperCase()}
                  </Text>
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

        <TouchableOpacity
          style={s.floatingBack}
          onPress={() => navigate(activeRole === "seller" ? "sellerDashboard" : "buyerDashboard")}
        >
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
              <TouchableOpacity
                key={c.id}
                style={{ backgroundColor: "rgba(20,20,20,0.5)", borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", flexDirection: "row", alignItems: "center" }}
                onPress={() => navigate("partnerWorkspace", { contactId: c.id, role: activeRole })}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,188,212,0.15)", borderWidth: 1, borderColor: "rgba(0,188,212,0.3)", justifyContent: "center", alignItems: "center", marginRight: 12 }}>
                  <Text style={{ color: "#00BCD4", fontSize: 18, fontWeight: "bold" }}>
                    {(c.name || "?")[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>{c.name}</Text>
                  {!!c.company && <Text style={{ color: "#888", fontSize: 12, marginTop: 2 }}>{c.company}</Text>}
                  <Text style={{ color: "#888", fontSize: 12, marginTop: 4 }}>Üzenet tab → nyomj a névre</Text>
                </View>
                <Text style={{ color: "#888", fontSize: 18 }}>›</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        <TouchableOpacity
          style={s.floatingBack}
          onPress={() => navigate(activeRole === "seller" ? "sellerDashboard" : "buyerDashboard")}
        >
          <Image source={require("./assets/backbutton.png")} style={s.floatingBackImg} />
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Számlák lista keresővel ───────────────────────────────────
  if (screen === "invoiceList") {
    const contacts = activeRole === "seller" ? sellerContacts : buyerContacts;

    const allInvoices = contacts.flatMap(c =>
      (c.invoices || []).map(inv => ({ ...inv, contactName: c.name, contactId: c.id }))
    ).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const filtered = allInvoices.filter(inv => {
      if (invSearch && !inv.id?.toLowerCase().includes(invSearch.toLowerCase()) &&
          !inv.contactName?.toLowerCase().includes(invSearch.toLowerCase())) return false;
      if (invFilter === "paid" && inv.statusz !== "PAID") return false;
      if (invFilter === "open" && inv.statusz === "PAID") return false;
      // Dátum szűrő: inv.datum formátuma "2026. 03. 17." vagy "03.17"
      if (invFrom && inv.datum) {
        const d = inv.datum.replace(/\s/g,"").replace(/\./g,"-").replace(/--+/g,"-").replace(/-$/,"");
        if (d < invFrom.replace(/\./g,"-")) return false;
      }
      if (invTo && inv.datum) {
        const d = inv.datum.replace(/\s/g,"").replace(/\./g,"-").replace(/--+/g,"-").replace(/-$/,"");
        if (d > invTo.replace(/\./g,"-")) return false;
      }
      return true;
    });

    const totalBrutto = filtered.reduce((s, i) => s + Number(i.bruttoOsszesen || 0), 0);
    const paidCount = filtered.filter(i => i.statusz === "PAID").length;
    const openCount = filtered.filter(i => i.statusz !== "PAID").length;

    function sendInvoiceList() {
      if (filtered.length === 0) { Alert.alert("Nincs számla", "Nincs szűrt számla az elküldéshez."); return; }
      const lines = filtered.map(inv =>
        `${inv.statusz === "PAID" ? "✅" : "🟠"} ${inv.id} · ${inv.contactName} · ${(inv.bruttoOsszesen||0).toLocaleString("hu-HU")} Ft · ${inv.statusz === "PAID" ? "FIZETVE" : "NYITOTT"}`
      ).join("\n");
      const msg = "📄 SZÁMLA LISTA\n─────────────\n" + lines + "\n─────────────\nÖsszes: " + totalBrutto.toLocaleString("hu-HU") + " Ft\n✅ Fizetve: " + paidCount + " db\n🟠 Nyitott: " + openCount + " db";
      Alert.alert("Lista elküldése", "Melyik partnernek küldöm?", [
        ...contacts.slice(0,5).map(c => ({
          text: c.name,
          onPress: () => {
            // Üzenetként küldi el
            const { sendMessage } = require("./firebase");
            const channelId = activeRole === "seller"
              ? `${app.sellerUid}_${c.registlessUid}`
              : `${c.registlessUid}_${app.buyerUid}`;
            if (channelId && app.sellerUid) {
              sendMessage(channelId, app.sellerUid, msg).catch(()=>{});
            }
            app.addActivityToContact(c.id, makeActivity(
              ActivityType.INVOICE_ISSUED,
              "Számla lista elküldve",
              { count: filtered.length }
            ));
            Alert.alert("✅ Elküldve", `Számla lista elküldve: ${c.name}`);
          }
        })),
        { text: "Mégse", style: "cancel" }
      ]);
    }

    content = (
      <SafeAreaView style={{ flex: 1, width: "100%" }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingTop: 16, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
          <Text style={{ color: "#fff", fontSize: 24, fontWeight: "bold", marginBottom: 16, paddingTop: 48 }}>Számlák</Text>

          {/* Összesítő */}
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

          {/* Keresés */}
          <View style={{ backgroundColor: "rgba(20,20,20,0.6)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", flexDirection: "row", alignItems: "center", paddingHorizontal: 12, marginBottom: 10 }}>
            <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
            <TextInput
              style={{ flex: 1, color: "#fff", paddingVertical: 12, fontSize: 14 }}
              value={invSearch}
              onChangeText={setInvSearch}
              placeholder="Keresés számlaszám, partner..."
              placeholderTextColor="#666"
            />
            {!!invSearch && <TouchableOpacity onPress={() => setInvSearch("")}><Text style={{ color: "#888" }}>✕</Text></TouchableOpacity>}
          </View>

          {/* Dátum tól-ig */}
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
            <View style={{ flex: 1, backgroundColor: "rgba(20,20,20,0.6)", borderRadius: 14, borderWidth: 1, borderColor: invFrom ? "rgba(255,122,26,0.4)" : "rgba(255,255,255,0.1)", flexDirection: "row", alignItems: "center", paddingHorizontal: 10 }}>
              <Text style={{ fontSize: 13, marginRight: 6, color: "#888" }}>Tól:</Text>
              <TextInput
                style={{ flex: 1, color: "#fff", paddingVertical: 10, fontSize: 13 }}
                value={invFrom}
                onChangeText={setInvFrom}
                placeholder="2026-01-01"
                placeholderTextColor="#555"
                keyboardType="numeric"
              />
              {!!invFrom && <TouchableOpacity onPress={() => setInvFrom("")}><Text style={{ color: "#888" }}>✕</Text></TouchableOpacity>}
            </View>
            <View style={{ flex: 1, backgroundColor: "rgba(20,20,20,0.6)", borderRadius: 14, borderWidth: 1, borderColor: invTo ? "rgba(255,122,26,0.4)" : "rgba(255,255,255,0.1)", flexDirection: "row", alignItems: "center", paddingHorizontal: 10 }}>
              <Text style={{ fontSize: 13, marginRight: 6, color: "#888" }}>Ig:</Text>
              <TextInput
                style={{ flex: 1, color: "#fff", paddingVertical: 10, fontSize: 13 }}
                value={invTo}
                onChangeText={setInvTo}
                placeholder="2026-12-31"
                placeholderTextColor="#555"
                keyboardType="numeric"
              />
              {!!invTo && <TouchableOpacity onPress={() => setInvTo("")}><Text style={{ color: "#888" }}>✕</Text></TouchableOpacity>}
            </View>
          </View>

          {/* Szűrő gombok */}
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
            {[["all","Mind"],["open","🟠 Nyitott"],["paid","✅ Fizetve"]].map(([val, label]) => (
              <TouchableOpacity
                key={val}
                style={{ flex: 1, backgroundColor: invFilter === val ? "rgba(255,122,26,0.25)" : "rgba(20,20,20,0.5)", borderRadius: 12, padding: 10, alignItems: "center", borderWidth: 1, borderColor: invFilter === val ? "rgba(255,122,26,0.5)" : "rgba(255,255,255,0.1)" }}
                onPress={() => setInvFilter(val)}
              >
                <Text style={{ color: invFilter === val ? "#ff7a1a" : "#888", fontSize: 12, fontWeight: "600" }}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Küldés gomb */}
          <TouchableOpacity
            style={{ backgroundColor: "rgba(0,188,212,0.15)", borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(0,188,212,0.3)", marginBottom: 16, flexDirection: "row", justifyContent: "center", gap: 8 }}
            onPress={sendInvoiceList}
          >
            <Text style={{ fontSize: 18 }}>📤</Text>
            <Text style={{ color: "#00BCD4", fontWeight: "bold", fontSize: 14 }}>Lista küldése partnernek üzenetben</Text>
          </TouchableOpacity>

          {filtered.length === 0 ? (
            <View style={{ backgroundColor: "rgba(20,20,20,0.5)", borderRadius: 20, padding: 32, alignItems: "center" }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>📄</Text>
              <Text style={{ color: "#fff", textAlign: "center" }}>Nincs találat.</Text>
            </View>
          ) : (
            filtered.map((inv) => (
              <TouchableOpacity
                key={inv.id}
                style={{ backgroundColor: "rgba(20,20,20,0.5)", borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: inv.statusz === "PAID" ? "rgba(76,175,80,0.4)" : "rgba(255,152,0,0.3)" }}
                onPress={() => navigate("partnerWorkspace", { contactId: inv.contactId, role: activeRole })}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#fff", fontSize: 15, fontWeight: "bold" }}>{inv.id}</Text>
                    <Text style={{ color: "#888", fontSize: 12, marginTop: 2 }}>{inv.contactName} · {inv.datum}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text style={{ color: "#ff7a1a", fontWeight: "bold", fontSize: 15 }}>
                      {(inv.bruttoOsszesen || 0).toLocaleString("hu-HU")} Ft
                    </Text>
                    <View style={{ backgroundColor: inv.statusz === "PAID" ? "rgba(76,175,80,0.2)" : "rgba(255,152,0,0.2)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ color: inv.statusz === "PAID" ? "#4CAF50" : "#FF9800", fontSize: 11, fontWeight: "bold" }}>
                        {inv.statusz === "PAID" ? "✅ FIZETVE" : "🟠 NYITOTT"}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        <TouchableOpacity
          style={s.floatingBack}
          onPress={() => navigate(activeRole === "seller" ? "sellerDashboard" : "buyerDashboard")}
        >
          <Image source={require("./assets/backbutton.png")} style={s.floatingBackImg} />
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
    );
  }

  // ── Mai nap / Időpontok ───────────────────────────────────────
  if (screen === "todaySchedule" || screen === "appointments") {
    const contacts = activeRole === "seller" ? sellerContacts : buyerContacts;
    const today = new Date();
    const todayStr = `${String(today.getMonth()+1).padStart(2,"0")}.${String(today.getDate()).padStart(2,"0")}`;

    const allAppts = contacts.flatMap(c => {
      const appts = activeRole === "seller"
        ? (c.appointments || [])
        : (c.calendar || []);
      return appts.map(a => ({ ...a, contactName: c.name, contactId: c.id }));
    }).sort((a, b) => (a.ido || "").localeCompare(b.ido || ""));

    const todayAppts = allAppts.filter(a => a.datum === todayStr);
    const futureAppts = allAppts.filter(a => a.datum !== todayStr);

    content = (
      <SafeAreaView style={{ flex: 1, width: "100%" }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingTop: 16 }}>
          <Text style={{ color: "#fff", fontSize: 24, fontWeight: "bold", marginBottom: 20, paddingTop: 48 }}>
            {screen === "todaySchedule" ? "Mai nap" : "Időpontjaim"}
          </Text>

          {todayAppts.length > 0 && (
            <>
              <Text style={{ color: "#ff7a1a", fontSize: 14, fontWeight: "bold", marginBottom: 10 }}>📅 MA</Text>
              {todayAppts.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={{ backgroundColor: "rgba(255,122,26,0.1)", borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: "rgba(255,122,26,0.3)" }}
                  onPress={() => navigate("partnerWorkspace", { contactId: a.contactId, role: activeRole })}
                >
                  <Text style={{ color: "#fff", fontSize: 16, fontWeight: "bold" }}>{a.ido} — {a.serviceName}</Text>
                  <Text style={{ color: "#888", marginTop: 4 }}>👤 {a.contactName}</Text>
                  {a.amount > 0 && <Text style={{ color: "#ff7a1a", marginTop: 4 }}>{a.amount.toLocaleString("hu-HU")} Ft</Text>}
                </TouchableOpacity>
              ))}
            </>
          )}

          {futureAppts.length > 0 && (
            <>
              <Text style={{ color: "#888", fontSize: 14, fontWeight: "bold", marginBottom: 10, marginTop: 8 }}>KÖZELGŐ</Text>
              {futureAppts.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={{ backgroundColor: "rgba(20,20,20,0.5)", borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}
                  onPress={() => navigate("partnerWorkspace", { contactId: a.contactId, role: activeRole })}
                >
                  <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>{a.datum} {a.ido} — {a.serviceName}</Text>
                  <Text style={{ color: "#888", marginTop: 4 }}>👤 {a.contactName}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          {allAppts.length === 0 && (
            <View style={{ backgroundColor: "rgba(20,20,20,0.5)", borderRadius: 20, padding: 32, alignItems: "center" }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>📅</Text>
              <Text style={{ color: "#fff", textAlign: "center" }}>Még nincs időpont.</Text>
            </View>
          )}
        </ScrollView>

        <TouchableOpacity
          style={s.floatingBack}
          onPress={() => navigate(activeRole === "seller" ? "sellerDashboard" : "buyerDashboard")}
        >
          <Image source={require("./assets/backbutton.png")} style={s.floatingBackImg} />
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

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
  const showFab = ["sellerDashboard", "buyerDashboard", "partnerWorkspace"].includes(screen);

  return (
    <ImageBackground source={require("./assets/background.png")} style={{ flex: 1 }} resizeMode="cover">
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
                ? (appKbHeight > 0 ? appKbHeight + 224 : 212)
                : 112
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
              ? (appKbHeight > 0 ? appKbHeight + 160 : 172)
              : 48
          }]} onPress={() => setFabOpen(!fabOpen)}>
            <Text style={s.fabText}>{fabOpen ? "✕" : "+"}</Text>
          </TouchableOpacity>
        </>
      )}
    </ImageBackground>
  );
}

// ── Inline screens ────────────────────────────────────────────────

function NewBookingScreen({ contact, onSubmit, onBack }) {
  const [svc, setSvc] = useState("");
  const [datum, setDatum] = useState("");
  const [ido, setIdo] = useState("");
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <Text style={[shared.title, { paddingTop: 16 }]}>IDŐPONT KÉRÉS</Text>
          {contact && <Text style={[shared.labelSmall, { marginBottom: 16 }]}>→ {contact.name}</Text>}
          <Text style={shared.label}>Szolgáltatás</Text>
          <TextInput style={shared.input} value={svc} onChangeText={setSvc}
            placeholder="pl. Személyi edzés" placeholderTextColor={colors.placeholder} />
          <Text style={shared.label}>Dátum (hh.nn)</Text>
          <TextInput style={shared.input} value={datum} onChangeText={setDatum}
            placeholder="pl. 03.25" placeholderTextColor={colors.placeholder} keyboardType="numeric" />
          <Text style={shared.label}>Időpont</Text>
          <TextInput style={shared.input} value={ido} onChangeText={setIdo}
            placeholder="pl. 10:00" placeholderTextColor={colors.placeholder} />
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

function NewServiceScreen({ contact, quickServices = [], onSubmit, onBack }) {
  const [svcName, setSvcName] = useState("");
  const [svcAmount, setSvcAmount] = useState("");
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
          <Text style={[shared.labelSmall, { marginBottom: 8, marginTop: 8 }]}>Gyors választás:</Text>
          {quickServices.map((qs) => (
            <TouchableOpacity key={qs.id}
              style={{ backgroundColor: colors.bgCard, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.borderSubtle }}
              onPress={() => { setSvcName(qs.name); setSvcAmount(String(qs.amount)); }}>
              <Text style={{ color: colors.textPrimary, fontSize: 14 }}>
                {qs.name} — {formatCurrency(qs.amount)}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[shared.btnPrimary, { marginTop: 16 }]} onPress={() => {
            if (!svcName) { Alert.alert("Hiányzó adat", "Add meg a szolgáltatás nevét."); return; }
            const netto = Number(svcAmount) || 0;
            onSubmit({
              id: `oi-${Date.now()}`,
              serviceName: svcName,
              netto, afa27: Math.round(netto * 0.27),
              brutto: Math.round(netto * 1.27),
              amount: Math.round(netto * 1.27),
              datum: new Date().toLocaleDateString("hu-HU"),
              createdAt: Date.now(),
            });
          }}>
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
  homeScreen: {
    flex: 1, justifyContent: "space-evenly", alignItems: "center",
    paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24,
  },
  logo: { width: 200, height: 120 },
  homeTitle: { color: "#fff", fontSize: 30, fontWeight: "bold", textAlign: "center" },
  shareBtn: { alignItems: "center", marginTop: 8 },
  shareIcon: { width: 64, height: 64, borderRadius: 16 },
  shareLabel: { color: "#fff", fontSize: 13, marginTop: 6, fontWeight: "600" },
  poweredBy: { color: "rgba(255,255,255,0.65)", fontSize: 11, textAlign: "center", marginTop: 4, letterSpacing: 0.3 },
  fab: {
    position: "absolute", right: 20, bottom: 48,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.accent,
    justifyContent: "center", alignItems: "center",
    shadowColor: colors.accent, shadowOpacity: 0.5, shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 }, elevation: 8,
  },
  fabOpen: { backgroundColor: "#555" },
  fabText: { color: "#fff", fontSize: 28, fontWeight: "bold", lineHeight: 32 },
  fabBackdrop: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  fabMenu: {
    position: "absolute", right: 20, bottom: 112,
    backgroundColor: "rgba(18,18,18,0.97)",
    borderRadius: 20, padding: 8,
    borderWidth: 1, borderColor: colors.borderSubtle,
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 12,
    elevation: 10, minWidth: 210,
  },
  fabMenuItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
  },
  fabMenuIcon: { fontSize: 20, width: 28 },
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
