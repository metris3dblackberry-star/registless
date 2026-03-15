import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  Share,
  Alert,
  Vibration,
  Animated,
  Easing,
  ImageBackground,
  Modal,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { CameraView, useCameraPermissions } from "expo-camera";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as ImagePicker from "expo-image-picker";
import {
  saveUserProfile,
  getUserProfile,
  createOrGetChannel,
  sendMessage,
  sendInvoicePdf,
  listenMessages,
  listenChannel,
} from "./firebase";
import TextRecognition from "@react-native-ml-kit/text-recognition";

// ── ChatInput komponens ───────────────────────────────────────────
function ChatInput({ channelId, senderUid, onSend }) {
  const [text, setText] = React.useState("");

  function handleSend() {
    if (!text.trim() || !channelId) return;
    onSend(text.trim());
    setText("");
  }

  return (
    <View style={chatInputStyles.row}>
      <TextInput
        style={chatInputStyles.input}
        value={text}
        onChangeText={setText}
        placeholder="Írj üzenetet..."
        placeholderTextColor="#666"
        returnKeyType="send"
        onSubmitEditing={handleSend}
        blurOnSubmit={false}
      />
      <TouchableOpacity
        style={chatInputStyles.sendBtn}
        onPress={handleSend}
      >
        <Text style={chatInputStyles.sendText}>➤</Text>
      </TouchableOpacity>
    </View>
  );
}

const chatInputStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    width: "100%",
    gap: 8,
    marginBottom: 10,
    marginTop: 4,
  },
  input: {
    flex: 1,
    backgroundColor: "rgba(20,20,20,0.62)",
    color: "#fff",
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.16)",
    fontSize: 15,
  },
  sendBtn: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "rgba(255,122,26,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,122,26,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  sendText: {
    color: "#fff",
    fontSize: 20,
  },
});

// ─────────────────────────────────────────────────────────────────
export default function App() {
  const STORAGE_KEY = "registless_app_state_v8";

  const [isHydrated, setIsHydrated] = useState(false);
  const [screen, setScreen] = useState("home");
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedData, setScannedData] = useState(null);
  const [ocrImportText, setOcrImportText] = useState("");
  const [ocrTarget, setOcrTarget] = useState("seller");
  const [newCustomerModal, setNewCustomerModal] = useState(false);

  // ── Firebase / felhő state ──────────────────────────────────────
  const [registlessUid, setRegistlessUid] = useState(null);
  const [sellerUid, setSellerUid] = useState(null);
  const [buyerUid, setBuyerUid] = useState(null);
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [channelMessages, setChannelMessages] = useState([]);
  const [chatScreen, setChatScreen] = useState(false);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [sellerName, setSellerName] = useState("");
  const [sellerAddress, setSellerAddress] = useState("");
  const [sellerCompany, setSellerCompany] = useState("");
  const [sellerTaxNumber, setSellerTaxNumber] = useState("");
  const [sellerBankAccount, setSellerBankAccount] = useState("");

  const [buyerName, setBuyerName] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [buyerCompany, setBuyerCompany] = useState("");

  const [kapcsolatok, setKapcsolatok] = useState([]);
  const [ujKapcsolatNev, setUjKapcsolatNev] = useState("");
  const [aktivKapcsolatId, setAktivKapcsolatId] = useState(null);

  const [sellerCustomers, setSellerCustomers] = useState([]);
  const [selectedSellerCustomerId, setSelectedSellerCustomerId] = useState(null);

  const [serviceNameInput, setServiceNameInput] = useState("");
  const [serviceAmountInput, setServiceAmountInput] = useState("");
  const [activeService, setActiveService] = useState(null);
  const [nowTs, setNowTs] = useState(Date.now());

  const [foglalasNap, setFoglalasNap] = useState("");
  const [foglalasHonap, setFoglalasHonap] = useState("");

  const [selectedBookingMeta, setSelectedBookingMeta] = useState(null);
  const [bookingHourInput, setBookingHourInput] = useState("");
  const [bookingMinuteInput, setBookingMinuteInput] = useState("");

  const [selectedInvoiceForQr, setSelectedInvoiceForQr] = useState(null);
  const [invoiceCounter, setInvoiceCounter] = useState(0);
  const [quickServices, setQuickServices] = useState([
    { id: "qs-1", name: "Személyi edzés", amount: 10000 },
    { id: "qs-2", name: "Masszázs", amount: 12000 },
    { id: "qs-3", name: "Konzultáció", amount: 15000 },
  ]);

  const [paymentDraft, setPaymentDraft] = useState(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("revolut");
  const [paymentQrPayload, setPaymentQrPayload] = useState("");

  const invoiceCounterRef = useRef(0);

  const sellerAddressRef = useRef(null);
  const sellerCompanyRef = useRef(null);
  const sellerTaxNumberRef = useRef(null);
  const sellerBankAccountRef = useRef(null);
  const buyerAddressRef = useRef(null);
  const buyerCompanyRef = useRef(null);
  const kapcsolatNevRef = useRef(null);
  const serviceAmountRef = useRef(null);
  const honapRef = useRef(null);
  const bookingMinuteRef = useRef(null);

  const screenSlideAnim = useRef(new Animated.Value(22)).current;
  const screenFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    async function loadAppState() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);

        if (raw) {
          const saved = JSON.parse(raw);

          setSellerName(saved.sellerName || "");
          setSellerAddress(saved.sellerAddress || "");
          setSellerCompany(saved.sellerCompany || "");
          setSellerTaxNumber(saved.sellerTaxNumber || "");
          setSellerBankAccount(saved.sellerBankAccount || "");

          setBuyerName(saved.buyerName || "");
          setBuyerAddress(saved.buyerAddress || "");
          setBuyerCompany(saved.buyerCompany || "");

          setKapcsolatok(saved.kapcsolatok || []);
          setSellerCustomers(saved.sellerCustomers || []);

          const loadedCounter = Number(saved.invoiceCounter || 0);
          setInvoiceCounter(loadedCounter);
          invoiceCounterRef.current = loadedCounter;

          setQuickServices(
            saved.quickServices || [
              { id: "qs-1", name: "Személyi edzés", amount: 10000 },
              { id: "qs-2", name: "Masszázs", amount: 12000 },
              { id: "qs-3", name: "Konzultáció", amount: 15000 },
            ]
          );
        }
      } catch (error) {
        console.log("Hiba a mentett adatok betöltésekor:", error);
      } finally {
        setIsHydrated(true);
      }
    }

    async function initRegistlessUid() {
      try {
        // Seller UID
        let sUid = await AsyncStorage.getItem("registless_seller_uid_v1");
        if (!sUid) {
          sUid = "seller-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
          await AsyncStorage.setItem("registless_seller_uid_v1", sUid);
        }
        setSellerUid(sUid);

        // Buyer UID – külön, hogy ugyanazon a telefonon is működjön
        let bUid = await AsyncStorage.getItem("registless_buyer_uid_v1");
        if (!bUid) {
          bUid = "buyer-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
          await AsyncStorage.setItem("registless_buyer_uid_v1", bUid);
        }
        setBuyerUid(bUid);

        // Általános UID visszafelé kompatibilitáshoz
        setRegistlessUid(sUid);
        setFirebaseReady(true);
      } catch (e) {
        console.log("UID init hiba:", e);
      }
    }

    loadAppState();
    initRegistlessUid();
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    async function saveAppState() {
      try {
        const payload = {
          sellerName,
          sellerAddress,
          sellerCompany,
          sellerTaxNumber,
          sellerBankAccount,
          buyerName,
          buyerAddress,
          buyerCompany,
          kapcsolatok,
          sellerCustomers,
          invoiceCounter,
          quickServices,
        };

        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

        // Firebase szinkron – csak ha van UID és profil adat
        if (sellerUid && sellerName) {
          try {
            await saveUserProfile(sellerUid, {
              role: "seller",
              sellerName, sellerAddress, sellerCompany,
              sellerTaxNumber, sellerBankAccount,
            });
          } catch (fbErr) {
            console.log("Firebase seller sync hiba:", fbErr);
          }
        }
        if (buyerUid && buyerName) {
          try {
            await saveUserProfile(buyerUid, {
              role: "buyer",
              buyerName, buyerAddress, buyerCompany,
            });
          } catch (fbErr) {
            console.log("Firebase buyer sync hiba:", fbErr);
          }
        }
      } catch (error) {
        console.log("Hiba a mentéskor:", error);
      }
    }

    saveAppState();
  }, [
    isHydrated,
    sellerName,
    sellerAddress,
    sellerCompany,
    sellerTaxNumber,
    sellerBankAccount,
    buyerName,
    buyerAddress,
    buyerCompany,
    kapcsolatok,
    sellerCustomers,
    invoiceCounter,
    quickServices,
  ]);

  useEffect(() => {
    if (!activeService) return;

    const timer = setInterval(() => {
      setNowTs(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [activeService]);

  // ── Firebase üzenet-figyelő ────────────────────────────────────
  useEffect(() => {
    if (!activeChannelId) return;
    const unsub = listenMessages(activeChannelId, (msgs) => {
      setChannelMessages(msgs);
    });
    return () => unsub();
  }, [activeChannelId]);

  useEffect(() => {
    screenSlideAnim.setValue(22);
    screenFadeAnim.setValue(0);

    Animated.parallel([
      Animated.timing(screenSlideAnim, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(screenFadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [screen, screenSlideAnim, screenFadeAnim]);

  function makeId(prefix = "id") {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }

  function pad2(v) {
    return String(v).padStart(2, "0");
  }

  function formatCurrency(amountNumber) {
    const safe = Number(amountNumber || 0);
    return `${safe.toLocaleString("hu-HU")} Ft`;
  }

  function formatDateHu(date = new Date()) {
    return `${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(
      date.getDate()
    )}.`;
  }

  function getNapNev(dayString, monthString, year = new Date().getFullYear()) {
    const day = Number(dayString);
    const month = Number(monthString);

    if (!day || !month) return "-";
    if (day < 1 || day > 31) return "-";
    if (month < 1 || month > 12) return "-";

    const d = new Date(year, month - 1, day);

    if (
      d.getFullYear() !== year ||
      d.getMonth() !== month - 1 ||
      d.getDate() !== day
    ) {
      return "-";
    }

    const napok = [
      "vasárnap",
      "hétfő",
      "kedd",
      "szerda",
      "csütörtök",
      "péntek",
      "szombat",
    ];

    return napok[d.getDay()];
  }

  function currentDateMeta() {
    const d = new Date();
    const day = pad2(d.getDate());
    const month = pad2(d.getMonth() + 1);
    const year = d.getFullYear();
    const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    const dayName = getNapNev(day, month, year);

    return {
      day,
      month,
      year,
      time,
      dayName,
      dateLabel: `${month}.${day}`,
      longDate: `${year}.${month}.${day}.`,
    };
  }

  function safeNumber(v) {
    return Number(v || 0);
  }

  function vibrateScan() {
    Vibration.vibrate(35);
  }

  function vibrateSuccess() {
    Vibration.vibrate([0, 35, 50, 60]);
  }

  function calcInvoiceLine(name, qty, unitPriceNet) {
    const safeQty = safeNumber(qty || 1);
    const safeUnitPriceNet = safeNumber(unitPriceNet);
    const netto = Math.round(safeQty * safeUnitPriceNet);
    const afa = Math.round(netto * 0.27);
    const brutto = netto + afa;

    return {
      id: makeId("tetel"),
      tetel: name || "Szolgáltatás",
      darab: safeQty,
      egyseg: "db",
      egysegarNetto: safeUnitPriceNet,
      netto,
      afa27: afa,
      brutto,
    };
  }

  function calcInvoiceTotals(items = []) {
    return items.reduce(
      (acc, item) => {
        acc.netto += safeNumber(item.netto);
        acc.afa27 += safeNumber(item.afa27);
        acc.brutto += safeNumber(item.brutto);
        return acc;
      },
      { netto: 0, afa27: 0, brutto: 0 }
    );
  }

  function createNextInvoiceNumber() {
    const next = invoiceCounterRef.current + 1;
    invoiceCounterRef.current = next;
    setInvoiceCounter(next);

    const year = new Date().getFullYear();
    return `REG-${year}-${String(next).padStart(6, "0")}`;
  }

  function compactSellerPayload() {
    return JSON.stringify({
      t: "seller",
      id: sellerUid || registlessUid || "seller-main",
      n: sellerName || "",
      a: sellerAddress || "",
      c: sellerCompany || "",
      tx: sellerTaxNumber || "",
      b: sellerBankAccount || "",
    });
  }

  function compactBuyerPayload() {
    return JSON.stringify({
      t: "buyer",
      id: buyerUid || "buyer-main",
      n: buyerName || "",
      a: buyerAddress || "",
      c: buyerCompany || "",
    });
  }

  const sellerQrData = compactSellerPayload();
  const buyerQrData = compactBuyerPayload();

  const foglalasNapNev = getNapNev(foglalasNap, foglalasHonap);

  const parsedScanned = useMemo(() => {
    if (!scannedData) return null;

    try {
      return JSON.parse(scannedData);
    } catch (e) {
      return null;
    }
  }, [scannedData]);

  const aktivKapcsolat =
    kapcsolatok.find((item) => item.id === aktivKapcsolatId) || null;

  const selectedSellerCustomer =
    sellerCustomers.find((item) => item.id === selectedSellerCustomerId) || null;

  const hasSellerProfile =
    sellerName.trim() !== "" ||
    sellerAddress.trim() !== "" ||
    sellerCompany.trim() !== "" ||
    sellerTaxNumber.trim() !== "" ||
    sellerBankAccount.trim() !== "";

  const hasBuyerProfile =
    buyerName.trim() !== "" ||
    buyerAddress.trim() !== "" ||
    buyerCompany.trim() !== "";

  function goToSellerEntry() {
    setScreen(hasSellerProfile ? "sellerMenu" : "seller");
  }

  function goToBuyerEntry() {
    setScreen(hasBuyerProfile ? "buyerHub" : "buyerProfile");
  }

  function goToBuyerProfileOrQr() {
    setScreen(hasBuyerProfile ? "buyerQr" : "buyerProfile");
  }

  function navigateToSellerCustomer(customerId) {
    setSelectedSellerCustomerId(customerId);
    setTimeout(() => {
      setScreen("sellerCustomerDetail");
    }, 0);
  }

  function deleteSellerCustomer(customerId) {
    Alert.alert(
      "Törlés",
      "Biztosan törlöd ezt a vevőt?",
      [
        { text: "Nem", style: "cancel" },
        {
          text: "Igen",
          style: "destructive",
          onPress: () => {
            setSellerCustomers((prev) => prev.filter((item) => item.id !== customerId));
            vibrateSuccess();
          }
        }
      ]
    );
  }

  function navigateToBuyerPartner(kapcsolatId) {
    setAktivKapcsolatId(kapcsolatId);
    setTimeout(() => {
      setScreen("buyerPartnerMenu");
    }, 0);
  }

  function resetToHome() {
    setScannedData(null);
    setUjKapcsolatNev("");
    setAktivKapcsolatId(null);
    setSelectedSellerCustomerId(null);
    setServiceNameInput("");
    setServiceAmountInput("");
    setFoglalasNap("");
    setFoglalasHonap("");
    setActiveService(null);
    setSelectedBookingMeta(null);
    setBookingHourInput("");
    setBookingMinuteInput("");
    setSelectedInvoiceForQr(null);
    setPaymentDraft(null);
    setPaymentQrPayload("");
    setSelectedPaymentMethod("revolut");
    setScreen("home");
  }

  function elapsedSeconds() {
    if (!activeService) return 0;
    return Math.max(0, Math.floor((nowTs - activeService.startedAt) / 1000));
  }

  function elapsedLabel() {
    const total = elapsedSeconds();
    const hh = Math.floor(total / 3600);
    const mm = Math.floor((total % 3600) / 60);
    const ss = total % 60;
    return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
  }

  function normalizeScannedType(parsed) {
    if (!parsed) return null;
    if (parsed.type === "elado") return "seller";
    if (parsed.type === "vevo") return "buyer";
    if (parsed.t === "seller") return "seller";
    if (parsed.t === "buyer") return "buyer";
    if (parsed.t === "inv") return "invoice";
    return null;
  }

  function importSellerProfileFromQr() {
    const kind = normalizeScannedType(parsedScanned);
    if (kind !== "seller") return;

    setSellerName(parsedScanned.n || parsedScanned.name || "");
    setSellerAddress(parsedScanned.a || parsedScanned.address || "");
    setSellerCompany(parsedScanned.c || parsedScanned.company || "");
    setSellerTaxNumber(parsedScanned.tx || parsedScanned.taxNumber || "");
    setSellerBankAccount(parsedScanned.b || parsedScanned.bankAccount || "");
    setScannedData(null);
    vibrateSuccess();
    setScreen("sellerSummary");
  }

  function importBuyerProfileFromQr() {
    const kind = normalizeScannedType(parsedScanned);
    if (kind !== "buyer") return;

    setBuyerName(parsedScanned.n || parsedScanned.name || "");
    setBuyerAddress(parsedScanned.a || parsedScanned.address || "");
    setBuyerCompany(parsedScanned.c || parsedScanned.company || "");
    setScannedData(null);
    vibrateSuccess();
    setScreen("buyerQr");
  }

  function addBuyerConnection() {
    const kind = normalizeScannedType(parsedScanned);
    if (kind !== "seller") return;

    const sellerId = parsedScanned.id || "seller-main";
    const alias = ujKapcsolatNev.trim() || "eladóm";

    const existing = kapcsolatok.find(
      (item) => (item.seller?.id || "") === sellerId
    );

    if (existing) {
      setScannedData(null);
      setUjKapcsolatNev("");
      vibrateSuccess();
      navigateToBuyerPartner(existing.id);
      return;
    }

    const uj = {
      id: makeId("kapcsolat"),
      alias,
      seller: {
        id: sellerId,
        name: parsedScanned.n || parsedScanned.name || "",
        address: parsedScanned.a || parsedScanned.address || "",
        company: parsedScanned.c || parsedScanned.company || "",
      },
      buyer: {
        id: "buyer-main",
        name: buyerName,
        address: buyerAddress,
        company: buyerCompany,
      },
      naptar: [],
      szamlak: [],
      foglalasiKerelmek: [],
    };

    setKapcsolatok((prev) => [uj, ...prev]);
    setScannedData(null);
    setUjKapcsolatNev("");
    Keyboard.dismiss();
    vibrateSuccess();
    navigateToBuyerPartner(uj.id);
  }

  function saveSellerCustomerFromBuyerQr() {
    const kind = normalizeScannedType(parsedScanned);
    if (kind !== "buyer") return;

    // Ha a beolvasott QR "buyer-main" default ID-val jön (nincs Firebase UID),
    // névre és cégre is ellenőrzünk, hogy ne jöjjön létre duplikált vevő
    const buyerId = parsedScanned.id || makeId("buyer-imported");
    const scannedName = parsedScanned.n || parsedScanned.name || "";
    const scannedCompany = parsedScanned.c || parsedScanned.company || "";

    const existing = sellerCustomers.find((item) => {
      if (item.qrId === buyerId && buyerId !== "buyer-main") return true;
      if (scannedName && item.name === scannedName &&
          item.company === scannedCompany) return true;
      return false;
    });

    if (existing) {
      setScannedData(null);
      vibrateSuccess();
      Alert.alert("Megjegyzés", "Ez a vevő már szerepel a listában.");
      navigateToSellerCustomer(existing.id);
      return;
    }

    const uj = {
      id: makeId("seller-customer"),
      qrId: buyerId,
      buyerUid: parsedScanned.id || null,
      name: scannedName || "vevő",
      address: parsedScanned.a || parsedScanned.address || "",
      company: scannedCompany,
      email: parsedScanned.e || parsedScanned.email || "",
      appointments: [],
      invoices: [],
      openItems: [],
    };

    setSellerCustomers((prev) => [uj, ...prev]);
    setScannedData(null);
    vibrateSuccess();

    // Firebase channel: saját sellerUid + beolvasott buyerUid
    const scannedBuyerUid = parsedScanned.id;
    const mySellerUid = sellerUid || registlessUid;
    if (mySellerUid && scannedBuyerUid &&
        !scannedBuyerUid.startsWith("buyer-main") &&
        mySellerUid !== scannedBuyerUid) {
      createOrGetChannel(mySellerUid, scannedBuyerUid)
        .then((chId) => setActiveChannelId(chId))
        .catch((e) => console.log("Channel hiba:", e));
    }

    Alert.alert("Vevő hozzáadva", `${uj.name} sikeresen felvéve a listába.`);
    navigateToSellerCustomer(uj.id);
  }

  function ensureSellerCustomerFromKapcsolat(kapcsolat) {
    const buyer = kapcsolat?.buyer || null;

    const existing = sellerCustomers.find((item) => {
      if (buyer?.id && item.qrId === buyer.id) return true;

      if (
        buyer?.name &&
        item.name === buyer.name &&
        item.company === (buyer.company || "")
      ) {
        return true;
      }

      return false;
    });

    if (existing) return existing;

    const uj = {
      id: makeId("seller-customer"),
      qrId: buyer?.id || makeId("buyer-fallback"),
      name: buyer?.name || kapcsolat?.alias || "vevő",
      address: buyer?.address || "",
      company: buyer?.company || "",
      appointments: [],
      invoices: [],
      openItems: [],
    };

    setSellerCustomers((prev) => [uj, ...prev]);
    return uj;
  }

  function getSellerBookingRequests() {
    const list = [];

    kapcsolatok.forEach((kapcsolat) => {
      const sellerId = kapcsolat?.seller?.id || "";
      if (sellerId !== "seller-main") return;

      (kapcsolat.foglalasiKerelmek || []).forEach((request) => {
        list.push({
          kapcsolatId: kapcsolat.id,
          kapcsolatAlias: kapcsolat.alias,
          buyer: kapcsolat.buyer || null,
          request,
        });
      });
    });

    list.sort((a, b) => {
      const aDate = `${a.request.datum || ""} ${a.request.ido || ""}`;
      const bDate = `${b.request.datum || ""} ${b.request.ido || ""}`;
      return aDate.localeCompare(bDate);
    });

    return list;
  }

  function openBookingDecision(kapcsolatId, requestId) {
    const kapcsolat = kapcsolatok.find((item) => item.id === kapcsolatId);
    const request = kapcsolat?.foglalasiKerelmek?.find(
      (item) => item.id === requestId
    );

    if (!kapcsolat || !request) return;

    setSelectedBookingMeta({
      kapcsolatId,
      requestId,
      buyerName: kapcsolat?.buyer?.name || kapcsolat.alias || "vevő",
      datum: request.datum,
      napNev: request.napNev,
    });

    setBookingHourInput("");
    setBookingMinuteInput("");
    setScreen("sellerBookingDecision");
  }

  function acceptBookingRequestWithTime() {
    if (!selectedBookingMeta) return;

    const hour = Number(bookingHourInput);
    const minute = Number(bookingMinuteInput);

    if (
      Number.isNaN(hour) ||
      Number.isNaN(minute) ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      Alert.alert("Hiba", "Adj meg érvényes órát és percet.");
      return;
    }

    const finalTime = `${pad2(hour)}:${pad2(minute)}`;

    const kapcsolat = kapcsolatok.find(
      (item) => item.id === selectedBookingMeta.kapcsolatId
    );
    if (!kapcsolat) return;

    const request = (kapcsolat.foglalasiKerelmek || []).find(
      (item) => item.id === selectedBookingMeta.requestId
    );
    if (!request) return;

    const customer = ensureSellerCustomerFromKapcsolat(kapcsolat);

    const appointment = {
      id: makeId("appt"),
      datum: request.datum,
      napNev: request.napNev,
      ido: finalTime,
      statusz: "elfogadott foglalás",
      serviceName: "foglalás",
      amount: 0,
      durationSec: 0,
      invoiceIds: [],
      openItem: false,
    };

    setSellerCustomers((prev) =>
      prev.map((item) =>
        item.id === customer.id
          ? {
              ...item,
              appointments: [appointment, ...item.appointments],
            }
          : item
      )
    );

    setKapcsolatok((prev) =>
      prev.map((item) => {
        if (item.id !== selectedBookingMeta.kapcsolatId) return item;

        return {
          ...item,
          foglalasiKerelmek: item.foglalasiKerelmek.map((req) =>
            req.id === selectedBookingMeta.requestId
              ? {
                  ...req,
                  ido: finalTime,
                  statusz: "elfogadva",
                }
              : req
          ),
          naptar: item.naptar.map((n) =>
            n.id === selectedBookingMeta.requestId
              ? {
                  ...n,
                  ido: finalTime,
                  statusz: "elfogadva",
                }
              : n
          ),
        };
      })
    );

    setSelectedBookingMeta(null);
    setBookingHourInput("");
    setBookingMinuteInput("");
    vibrateSuccess();

    // Firebase üzenet küldése a vevőnek ha van aktív channel
    const mySellerUid2 = sellerUid || registlessUid;
    const buyerUidFromKapcsolat = kapcsolat?.buyer?.id;
    const channelId = activeChannelId ||
      (mySellerUid2 && buyerUidFromKapcsolat &&
       !buyerUidFromKapcsolat.startsWith("buyer-main") &&
       mySellerUid2 !== buyerUidFromKapcsolat
        ? `${mySellerUid2}_${buyerUidFromKapcsolat}`
        : null);

    if (channelId && mySellerUid2) {
      sendMessage(
        channelId,
        mySellerUid2,
        `✅ Foglalásod elfogadva: ${request.datum} ${finalTime}`,
        "text",
        { type: "booking_accepted", datum: request.datum, ido: finalTime }
      ).catch((e) => console.log("Üzenet hiba:", e));
    }

    Alert.alert(
      "Foglalás elfogadva",
      `${request.datum} ${finalTime} időpontra rögzítve.${channelId ? " Értesítés elküldve a vevőnek." : ""}`
    );
    setScreen("sellerBookingRequests");
  }

  function rejectBookingRequest(kapcsolatId, requestId) {
    setKapcsolatok((prev) =>
      prev.map((item) => {
        if (item.id !== kapcsolatId) return item;

        return {
          ...item,
          foglalasiKerelmek: item.foglalasiKerelmek.map((req) =>
            req.id === requestId
              ? {
                  ...req,
                  statusz: "elutasítva",
                }
              : req
          ),
          naptar: item.naptar.map((n) =>
            n.id === requestId
              ? {
                  ...n,
                  statusz: "elutasítva",
                }
              : n
          ),
        };
      })
    );
  }

  function createInvoiceObject({ customer, lineItems }) {
    const items = lineItems.map((item) =>
      calcInvoiceLine(item.tetel, item.darab || 1, item.egysegarNetto)
    );

    const totals = calcInvoiceTotals(items);
    const invoiceId = createNextInvoiceNumber();
    const createdAt = new Date().toISOString();

    return {
      id: invoiceId,
      datum: formatDateHu(new Date()),
      issueDateIso: createdAt,
      seller: {
        name: sellerName,
        address: sellerAddress,
        company: sellerCompany,
        taxNumber: sellerTaxNumber,
        bankAccount: sellerBankAccount,
      },
      buyer: {
        name: customer?.name || "",
        address: customer?.address || "",
        company: customer?.company || "",
      },
      tetelek: items,
      nettoOsszesen: totals.netto,
      afaOsszesen: totals.afa27,
      bruttoOsszesen: totals.brutto,
      vegosszeg: formatCurrency(totals.brutto),
      pdfMeta: {
        type: "invoice-pdf",
        createdAt,
        suggestedFileName: `${invoiceId}.pdf`,
      },
    };
  }

  function buildInvoiceQrPayload(invoice) {
    return JSON.stringify({
      t: "inv",
      id: invoice.id,
    });
  }

  function createInvoiceHtml(invoice) {
    const qrPayload = buildInvoiceQrPayload(invoice);

    const rows = (invoice.tetelek || [])
      .map(
        (item) => `
        <tr>
          <td>${item.tetel}</td>
          <td style="text-align:center;">${item.darab} ${item.egyseg}</td>
          <td style="text-align:right;">${item.egysegarNetto.toLocaleString("hu-HU")} Ft</td>
          <td style="text-align:right;">${item.netto.toLocaleString("hu-HU")} Ft</td>
          <td style="text-align:right;">${item.afa27.toLocaleString("hu-HU")} Ft</td>
          <td style="text-align:right;font-weight:bold;">${item.brutto.toLocaleString("hu-HU")} Ft</td>
        </tr>
      `
      )
      .join("");

    return `
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body {
      font-family: Arial, sans-serif;
      background: #f2f2f2;
      padding: 40px;
      color: #111;
    }
    .invoice {
      background: white;
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.10);
    }
    .header {
      background: linear-gradient(90deg, #ff6a00, #ff3c3c);
      color: white;
      padding: 24px;
      border-radius: 12px;
    }
    .title {
      font-size: 28px;
      font-weight: bold;
    }
    .subtitle {
      margin-top: 6px;
      font-size: 14px;
      opacity: 0.92;
    }
    .grid {
      display: flex;
      gap: 20px;
      margin-top: 24px;
    }
    .card {
      flex: 1;
      background: #fafafa;
      border-radius: 12px;
      padding: 16px;
      border: 1px solid #eee;
    }
    .meta {
      margin-top: 20px;
      margin-bottom: 8px;
      font-size: 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 24px;
      background: #fff;
      overflow: hidden;
      border-radius: 12px;
    }
    th {
      background: #111;
      color: white;
      padding: 10px;
      text-align: left;
    }
    td {
      padding: 10px;
      border-bottom: 1px solid #ddd;
    }
    .total {
      margin-top: 20px;
      text-align: right;
      font-size: 20px;
      font-weight: bold;
    }
    .qr {
      margin-top: 28px;
      font-size: 11px;
      color: #666;
      word-break: break-word;
    }
    .footer {
      margin-top: 32px;
      font-size: 10px;
      color: #777;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div class="title">REGISTLESS</div>
      <div class="subtitle">service invoice</div>
    </div>

    <div class="meta"><strong>Számlaszám:</strong> ${invoice.id}</div>
    <div class="meta"><strong>Kiállítás dátuma:</strong> ${invoice.datum}</div>

    <div class="grid">
      <div class="card">
        <strong>Eladó</strong><br/><br/>
        ${invoice.seller.name || "-"}<br/>
        ${invoice.seller.company || ""}<br/>
        ${invoice.seller.address || ""}<br/>
        ${
          invoice.seller.taxNumber
            ? `Adószám: ${invoice.seller.taxNumber}<br/>`
            : ""
        }
        ${
          invoice.seller.bankAccount
            ? `Bankszámla: ${invoice.seller.bankAccount}`
            : ""
        }
      </div>

      <div class="card">
        <strong>Vevő</strong><br/><br/>
        ${invoice.buyer.name || "-"}<br/>
        ${invoice.buyer.company || ""}<br/>
        ${invoice.buyer.address || ""}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Tétel</th>
          <th>Darab</th>
          <th>Egységár nettó</th>
          <th>Nettó</th>
          <th>ÁFA 27%</th>
          <th>Bruttó</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="total">
      Nettó összesen: ${invoice.nettoOsszesen.toLocaleString("hu-HU")} Ft<br/>
      ÁFA 27%: ${invoice.afaOsszesen.toLocaleString("hu-HU")} Ft<br/>
      Bruttó összesen: ${invoice.bruttoOsszesen.toLocaleString("hu-HU")} Ft
    </div>

    <div class="qr">
      Számla QR payload: ${qrPayload}
    </div>

    <div class="footer">
      Powered by Star Labs • Copyright Miklós Thurzó
    </div>
  </div>
</body>
</html>
    `;
  }

  async function shareInvoicePdf(invoice) {
    try {
      const html = createInvoiceHtml(invoice);
      const { uri } = await Print.printToFileAsync({ html });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        await Share.share({
          message: `Számla PDF létrehozva: ${uri}`,
        });
      }
    } catch (error) {
      console.log("Hiba a PDF megosztásnál:", error);
    }
  }

  function openInvoiceQr(invoice) {
    setSelectedInvoiceForQr(invoice);
    setScreen("sellerInvoiceQr");
  }

  function findLocalInvoiceById(invoiceId) {
    for (const customer of sellerCustomers) {
      for (const invoice of customer.invoices || []) {
        if (invoice.id === invoiceId) return invoice;
      }
    }
    return null;
  }

  function importInvoiceFromQr() {
    const kind = normalizeScannedType(parsedScanned);
    if (kind !== "invoice") return;

    const invoiceId = parsedScanned.id;
    if (!invoiceId) return;

    const found = findLocalInvoiceById(invoiceId);

    if (!found) {
      Alert.alert("Nincs meg", "Ez a számla nincs meg ezen a készüléken.");
      return;
    }

    setKapcsolatok((prev) =>
      prev.map((kapcsolat) => {
        const sellerMatch =
          (kapcsolat?.seller?.name || "") === (found?.seller?.name || "") &&
          (kapcsolat?.seller?.company || "") ===
            (found?.seller?.company || "");

        const buyerMatch =
          (kapcsolat?.buyer?.name || "") === (found?.buyer?.name || "") &&
          (kapcsolat?.buyer?.company || "") ===
            (found?.buyer?.company || "");

        if (!sellerMatch || !buyerMatch) return kapcsolat;

        const exists = (kapcsolat.szamlak || []).some(
          (item) => item.id === found.id
        );
        if (exists) return kapcsolat;

        return {
          ...kapcsolat,
          szamlak: [found, ...(kapcsolat.szamlak || [])],
        };
      })
    );

    setScannedData(null);
    vibrateSuccess();
    setScreen("buyerConnections");
  }

  function syncInvoiceToBuyer(customer, invoice) {
    setKapcsolatok((prev) =>
      prev.map((kapcsolat) => {
        const buyer = kapcsolat.buyer || null;

        const matches =
          (buyer?.id && customer?.qrId && buyer.id === customer.qrId) ||
          (buyer?.name === customer?.name &&
            (buyer?.company || "") === (customer?.company || ""));

        if (!matches) return kapcsolat;

        const invoiceExists = (kapcsolat.szamlak || []).some(
          (i) => i.id === invoice.id
        );

        const updatedInvoices = invoiceExists
          ? kapcsolat.szamlak
          : [invoice, ...(kapcsolat.szamlak || [])];

        return {
          ...kapcsolat,
          szamlak: updatedInvoices,
        };
      })
    );
  }

  function startService() {
    if (!selectedSellerCustomer) return;
    if (!serviceNameInput.trim()) return;
    if (!serviceAmountInput.trim()) return;

    setActiveService({
      customerId: selectedSellerCustomer.id,
      customerName: selectedSellerCustomer.name,
      serviceName: serviceNameInput.trim(),
      amount: Number(serviceAmountInput) || 0,
      startedAt: Date.now(),
    });

    setScreen("sellerServiceRunning");
  }

  function startQuickService(item) {
    setServiceNameInput(item.name);
    setServiceAmountInput(String(item.amount));
  }

  function saveCurrentAsQuickService() {
    const name = serviceNameInput.trim();
    const amount = Number(serviceAmountInput || 0);

    if (!name || !amount) return;

    const exists = quickServices.some(
      (item) => item.name === name && Number(item.amount) === amount
    );
    if (exists) return;

    const uj = {
      id: makeId("quick"),
      name,
      amount,
    };

    setQuickServices((prev) => [uj, ...prev]);
  }

  function removeQuickService(id) {
    Alert.alert(
      "Törlés",
      "Biztosan törlöd ezt a szolgáltatást?",
      [
        { text: "Nem", style: "cancel" },
        {
          text: "Igen",
          style: "destructive",
          onPress: () => setQuickServices((prev) => prev.filter((item) => item.id !== id))
        }
      ]
    );
  }

  function createAppointmentBase() {
    if (!activeService) return null;

    const meta = currentDateMeta();

    return {
      id: makeId("appt"),
      datum: meta.dateLabel,
      napNev: meta.dayName,
      ido: meta.time,
      statusz: "megtörtént",
      serviceName: activeService.serviceName,
      amount: activeService.amount,
      durationSec: elapsedSeconds(),
      invoiceIds: [],
      openItem: false,
    };
  }

  function finishServiceAndInvoice() {
    if (!activeService) return;

    const appointment = createAppointmentBase();
    if (!appointment) return;

    const customer = selectedSellerCustomer;

    const invoice = createInvoiceObject({
      customer,
      lineItems: [
        {
          tetel: activeService.serviceName,
          darab: 1,
          egysegarNetto: activeService.amount,
        },
      ],
    });

    appointment.invoiceIds = [invoice.id];

    setSellerCustomers((prev) =>
      prev.map((item) =>
        item.id === activeService.customerId
          ? {
              ...item,
              appointments: [appointment, ...item.appointments],
              invoices: [invoice, ...item.invoices],
            }
          : item
      )
    );

    if (customer) syncInvoiceToBuyer(customer, invoice);

    setServiceNameInput("");
    setServiceAmountInput("");
    setActiveService(null);
    vibrateSuccess();
    setScreen("sellerCustomerDetail");
  }

  function finishServiceAndAddOccurrence() {
    if (!activeService) return;

    const appointment = createAppointmentBase();
    if (!appointment) return;

    appointment.openItem = true;

    const openItem = {
      id: makeId("open"),
      appointmentId: appointment.id,
      megnevezes: activeService.serviceName,
      datum: appointment.datum,
      ido: appointment.ido,
      osszeg: activeService.amount,
      durationSec: appointment.durationSec,
    };

    setSellerCustomers((prev) =>
      prev.map((item) =>
        item.id === activeService.customerId
          ? {
              ...item,
              appointments: [appointment, ...item.appointments],
              openItems: [openItem, ...item.openItems],
            }
          : item
      )
    );

    setServiceNameInput("");
    setServiceAmountInput("");
    setActiveService(null);
    vibrateSuccess();
    setScreen("sellerCustomerDetail");
  }

  function issueCollectorInvoice() {
    if (!selectedSellerCustomer) return;
    if (!selectedSellerCustomer.openItems.length) return;

    const lineItems = selectedSellerCustomer.openItems.map((item) => ({
      tetel: item.megnevezes,
      darab: 1,
      egysegarNetto: item.osszeg,
    }));

    const invoice = createInvoiceObject({
      customer: selectedSellerCustomer,
      lineItems,
    });

    const customer = selectedSellerCustomer;

    setSellerCustomers((prev) =>
      prev.map((item) => {
        if (item.id !== selectedSellerCustomer.id) return item;

        return {
          ...item,
          invoices: [invoice, ...item.invoices],
          openItems: [],
          appointments: item.appointments.map((appt) =>
            item.openItems.some((oi) => oi.appointmentId === appt.id)
              ? {
                  ...appt,
                  invoiceIds: [invoice.id],
                  openItem: false,
                }
              : appt
          ),
        };
      })
    );

    if (customer) syncInvoiceToBuyer(customer, invoice);

    vibrateSuccess();
  }

  function sellerCalendarItems() {
    const list = [];

    sellerCustomers.forEach((customer) => {
      customer.appointments.forEach((appt) => {
        list.push({
          customerId: customer.id,
          customerName: customer.name,
          datum: appt.datum,
          napNev: appt.napNev,
          ido: appt.ido,
          serviceName: appt.serviceName,
          invoiceIds: appt.invoiceIds,
          statusz: appt.statusz,
        });
      });
    });

    list.sort((a, b) => {
      const aKey = `${a.datum || ""} ${a.ido || ""}`;
      const bKey = `${b.datum || ""} ${b.ido || ""}`;
      return aKey.localeCompare(bKey);
    });

    return list;
  }

  function sellerCalendarBuckets() {
    const items = sellerCalendarItems();
    const today = currentDateMeta().dateLabel;

    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = `${pad2(tomorrowDate.getMonth() + 1)}.${pad2(
      tomorrowDate.getDate()
    )}`;

    return {
      ma: items.filter((item) => item.datum === today),
      holnap: items.filter((item) => item.datum === tomorrow),
      kesobb: items.filter(
        (item) => item.datum !== today && item.datum !== tomorrow
      ),
    };
  }

  function addBuyerBookingRequest() {
    if (!aktivKapcsolat) return;
    if (!foglalasNap || !foglalasHonap || foglalasNapNev === "-") return;

    const datum = `${pad2(foglalasHonap)}.${pad2(foglalasNap)}`;

    const ujKeres = {
      id: makeId("booking"),
      datum,
      napNev: foglalasNapNev,
      ido: "egyeztetés alatt",
      statusz: "foglalási kérés",
      szamlak: [],
    };

    setKapcsolatok((prev) =>
      prev.map((item) =>
        item.id === aktivKapcsolat.id
          ? {
              ...item,
              foglalasiKerelmek: [ujKeres, ...item.foglalasiKerelmek],
              naptar: [ujKeres, ...item.naptar],
            }
          : item
      )
    );

    setFoglalasNap("");
    setFoglalasHonap("");
    vibrateSuccess();
    setScreen("buyerCalendar");
  }

  function openPaymentFlowForCustomer() {
    if (!selectedSellerCustomer) return;

    const amount = Number(serviceAmountInput || 0);
    const paymentAmount =
      amount > 0
        ? amount
        : Number(
            selectedSellerCustomer?.openItems?.reduce(
              (sum, item) => sum + Number(item.osszeg || 0),
              0
            ) || 0
          );

    if (!paymentAmount) {
      Alert.alert("Adj meg összeget", "Előbb adj meg egy szolgáltatás összeget.");
      return;
    }

    const draft = {
      id: makeId("pay"),
      customerId: selectedSellerCustomer.id,
      customerName: selectedSellerCustomer.name,
      amount: paymentAmount,
      currency: "HUF",
      sellerName: sellerName || sellerCompany || "REGISTLESS",
      sellerCompany: sellerCompany || "",
      sellerBankAccount: sellerBankAccount || "",
      createdAt: new Date().toISOString(),
    };

    setPaymentDraft(draft);
    setSelectedPaymentMethod("revolut");
    setPaymentQrPayload(buildPaymentQrPayload(draft, "revolut"));
    setScreen("paymentMethod");
  }

  function buildPaymentQrPayload(draft, method) {
    return JSON.stringify({
      t: "pay",
      m: method,
      id: draft.id,
      a: draft.amount,
      c: draft.currency,
      s: draft.sellerCompany || draft.sellerName || "",
      b: draft.sellerBankAccount || "",
      v: draft.customerName || "",
    });
  }

  function choosePaymentMethod(method) {
    setSelectedPaymentMethod(method);
    setPaymentQrPayload(buildPaymentQrPayload(paymentDraft, method));
  }

  function openHostedPaymentInfo(method) {
    if (method === "stripe") {
      Alert.alert(
        "Stripe előkészítés",
        "Itt majd Stripe Payment Sheet vagy hosted checkout jön. Ehhez backend kell."
      );
      return;
    }

    if (method === "paypal") {
      Alert.alert(
        "PayPal előkészítés",
        "Itt majd PayPal checkout link / hosted flow jön. Ehhez backend kell."
      );
      return;
    }
  }


  function parseOcrFields(rawText) {
    const raw = String(rawText || "").trim();
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    // ── Email ──────────────────────────────────────────────────────────────
    const email = raw.match(/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i)?.[0] || "";

    // ── Adószám / VAT ──────────────────────────────────────────────────────
    // HU: 12345678-1-12  |  EU: EU123456789  |  HR OIB  |  VAT HRxxxxxxx
    const taxNumber =
      raw.match(/\bOIB[:\s]*([0-9]{11})/i)?.[1] ||
      raw.match(/\bVAT\s*(?:ID)?[:\s]*(EU[0-9]{9})/i)?.[1] ||
      raw.match(/\b(EU[0-9]{9})\b/i)?.[1] ||
      raw.match(/\bVAT\s*(?:ID)?[:\s]*([A-Z]{2}[0-9]{8,12})/i)?.[1] ||
      raw.match(/\b(HR[0-9]{11})\b/i)?.[1] ||
      raw.match(/\b\d{8}-\d-\d{2}\b/)?.[0] ||
      raw.match(/\b\d{11}\b/)?.[0] ||
      "";

    // ── Bankszámlaszám – HU: 8-8-8 vagy 8-8 ──────────────────────────────
    const bankAccount =
      raw.match(/\b(\d{8}-\d{8}-\d{8})\b/)?.[1] ||
      raw.match(/\b(\d{8}-\d{8})\b/)?.[1] ||
      raw.match(/\bIBAN[:\s]*([A-Z]{2}[0-9]{2}[A-Z0-9 ]{4,})/i)?.[1]?.replace(/\s/g,"") ||
      "";

    // ── Cím: irányítószám + város + utca ──────────────────────────────────
    // Több sort is összefűz ha kell (pl. "Poduzetnička cesta l/3a" + "43290 Grubišno Polje")
    const streetLine = lines.find((l) =>
      /\b(utca|út|útja|körút|tér|köz|sor|sétány|cesta|ulica|street|road|avenue|lane|blvd|plaza|fasor)\b/i.test(l)
    ) || "";
    const postalLine = lines.find((l) => /^\d{4,5}\s+\S/.test(l)) || "";
    const addressLine = streetLine && postalLine && streetLine !== postalLine
      ? postalLine + ", " + streetLine
      : streetLine || postalLine || "";

    // ── Cégnév felismerése ─────────────────────────────────────────────────
    // Cégformák: Kft, Zrt, Bt, Rt, Nyrt, Ev, EV, e.v., Kkt, Lp, 
    //            Ltd, LLC, GmbH, Inc, Corp, AG, SA, SAS, BV,
    //            d.o.o., d.d., j.d.o.o., s.r.o., s.p.a., s.l., OÜ, AS,
    //            doo, dd, jdoo (pont nélkül is)
    const companyRegex = /\b(kft\.?|zrt\.?|bt\.?|rt\.?|nyrt\.?|ev\.?|e\.v\.?|kkt\.?|lp\.?|ltd\.?|llc\.?|gmbh\.?|inc\.?|corp\.?|ag\b|sa\b|sas\b|bv\b|oü\b|d\.o\.o\.?|d\.d\.?|j\.d\.o\.o\.?|doo\b|dd\b|jdoo\b|s\.r\.o\.?|s\.p\.a\.?|s\.l\.?)\b/i;
    const companyLine = lines.find((l) => companyRegex.test(l)) || "";

    // ── Telefon ────────────────────────────────────────────────────────────
    const phoneRaw =
      lines.find((l) => /^[ME]\s+\+?[\d\s()\-]{7,}/.test(l))?.replace(/^[ME]\s+/,"").trim() ||
      raw.match(/(?:M|T|Tel|Mob|Phone)[:\s]+([\+\d][\d\s()\-]{6,20})/i)?.[1]?.trim() ||
      raw.match(/\+[1-9][\d\s()\-]{6,18}\d/)?.[0] ||
      "";
    const phone = phoneRaw.replace(/\s{2,}/g," ").trim();

    // ── Személynév ────────────────────────────────────────────────────────
    const skipLine = /^(VAT|OIB|IBAN|M\s|E\s|T\s|Tel|Mob|Phone|www|http|General|Manager|Director|CEO|CFO)/i;
    const nameLine =
      // Explicit label
      lines.find((l) => /^(Name|Ime|Név)[:\s]/i.test(l))?.replace(/^[^:]+:\s*/,"") ||
      // FULL CAPS: pl. "LAURENT SESSA"
      lines.find((l) =>
        /^[A-ZÁÉÍÓÖŐÚÜŰ]{2,}(\s+[A-ZÁÉÍÓÖŐÚÜŰ]{2,})+$/.test(l) &&
        !companyRegex.test(l) &&
        l.split(" ").length >= 2 &&
        l.split(" ").length <= 4
      ) ||
      // Title Case: "Laurent Sessa"
      lines.find((l) =>
        /^[A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű]+(\s+[A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű]+)+$/.test(l) &&
        !companyRegex.test(l) &&
        !addressLine.includes(l) &&
        l !== email &&
        l.length > 4 &&
        l.length < 50
      ) ||
      // Fallback
      lines.find((l) =>
        !skipLine.test(l) &&
        !companyRegex.test(l) &&
        l !== companyLine &&
        l !== addressLine &&
        l !== email &&
        !l.includes("@") &&
        !/^\d/.test(l) &&
        l.length > 3 &&
        l.length < 60
      ) || "";

    return { name: nameLine, company: companyLine, address: addressLine, email, taxNumber, bankAccount, phone };
  }

  async function applyOcrImportAi() {
    if (!ocrImportText.trim()) {
      Alert.alert("OCR", "Nincs szöveg az elemzéshez.");
      return;
    }

    // ocrTarget értékét megőrizzük az async hívás alatt
    const currentTarget = ocrTarget;

    try {
      const PROXY_URL = "https://ocranalyze-y4fietykka-uc.a.run.app";

      const res = await fetch(PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ocrImportText }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      if (!data || typeof data !== "object") throw new Error("Üres válasz");

      // Az async hívás után explicit átadjuk a target-et
      applyParsedToProfileWithTarget(data, currentTarget);
    } catch (e) {
      console.log("AI OCR hiba:", e);
      Alert.alert("AI elemzés sikertelen", "Regex alapú felismerés használva.");
      applyParsedToProfileWithTarget(parseOcrFields(ocrImportText), currentTarget);
    }
  }

  function applyParsedToProfileWithTarget(parsed, target) {
    if (target === "seller") {
      if (parsed.name) setSellerName(parsed.name);
      if (parsed.address) setSellerAddress(parsed.address);
      if (parsed.company) setSellerCompany(parsed.company);
      if (parsed.taxNumber) setSellerTaxNumber(parsed.taxNumber);
      if (parsed.bankAccount) setSellerBankAccount(parsed.bankAccount);
      Alert.alert("OCR import", "Az adatok betöltve az eladó profilba.");
      setScreen("seller");
      return;
    }
    if (target === "buyer") {
      if (parsed.name) setBuyerName(parsed.name);
      if (parsed.address) setBuyerAddress(parsed.address);
      if (parsed.company) setBuyerCompany(parsed.company);
      Alert.alert("OCR import", "Az adatok betöltve a vevő profilba.");
      setScreen("buyerProfile");
      return;
    }
    if (target === "newSellerCustomer") {
      saveSellerCustomerFromParsed(parsed);
      return;
    }
    if (target === "newBuyerConnection") {
      addBuyerConnectionFromParsed(parsed);
      return;
    }
    // Fallback
    if (parsed.name) setBuyerName(parsed.name);
    if (parsed.address) setBuyerAddress(parsed.address);
    if (parsed.company) setBuyerCompany(parsed.company);
    setScreen("buyerProfile");
  }

  function applyParsedToProfile(parsed) {
    applyParsedToProfileWithTarget(parsed, ocrTarget);
  }

  function applyOcrImport() {
    const parsed = parseOcrFields(ocrImportText);
    applyParsedToProfileWithTarget(parsed, ocrTarget);
  }

  
  async function importOcrFromImage() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm?.granted) {
        Alert.alert("OCR", "A képgaléria engedélye szükséges az OCR-hez.");
        return;
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
        base64: false,
      });

      if (picked?.canceled || !picked?.assets?.length) return;

      const asset = picked.assets[0];
      const imageUri = asset?.uri || "";

      try {
        const result = await TextRecognition.recognize(imageUri);

        const mergedText = result?.text || "";

        setOcrImportText(mergedText);

        Alert.alert(
          "OCR kész",
          "A kép szövege beolvasva. Ellenőrizd és töltsd be a profilba."
        );
      } catch (ocrError) {
        Alert.alert(
          "OCR modul hiányzik",
          "ML Kit OCR modul nincs buildelve. Használd: eas build"
        );
      }
    } catch (error) {
      Alert.alert("OCR hiba", "Nem sikerült a képet feldolgozni.");
    }
  }

  async function importOcrFromCamera(imageUri) {
    if (!imageUri) return;
    try {
      const result = await TextRecognition.recognize(imageUri);
      const mergedText = result?.text || "";
      setOcrImportText(mergedText);
      setScreen("ocrImport");
      if (!mergedText) {
        Alert.alert("OCR", "Nem sikerült szöveget felismerni a képből.");
      }
    } catch (ocrError) {
      Alert.alert("OCR hiba", "ML Kit OCR modul szükséges. Futtasd: npx expo run:android");
      setScreen("ocrImport");
    }
  }

  function addBuyerConnectionFromParsed(parsed) {
    if (!parsed) return;

    const parsedName = (parsed.n || parsed.name || "").trim();
    const parsedCompany = (parsed.c || parsed.company || "").trim();
    const sellerId = parsed.id || makeId("seller-ocr");
    const alias = parsedName || parsedCompany || "eladóm";

    // Csak valódi Firebase UID alapján ellenőrzünk duplikátumot
    // OCR esetén mindig új kapcsolat jön létre
    const hasRealId = parsed.id && !parsed.id.startsWith("seller-main");
    const existing = hasRealId
      ? kapcsolatok.find((item) => item.seller?.id === parsed.id)
      : null;

    if (existing) {
      Alert.alert("Megjegyzés", "Ez a kapcsolat már szerepel a listában.");
      vibrateSuccess();
      navigateToBuyerPartner(existing.id);
      return;
    }

    const uj = {
      id: makeId("kapcsolat"),
      alias,
      seller: {
        id: sellerId,
        name: parsedName,
        address: parsed.a || parsed.address || "",
        company: parsedCompany,
        email: parsed.e || parsed.email || "",
        phone: parsed.phone || "",
        taxNumber: parsed.taxNumber || "",
      },
      buyer: {
        id: buyerUid || "buyer-main",
        name: buyerName,
        address: buyerAddress,
        company: buyerCompany,
      },
      naptar: [],
      szamlak: [],
      foglalasiKerelmek: [],
    };

    setKapcsolatok((prev) => [uj, ...prev]);
    vibrateSuccess();

    // Firebase channel csak ha valódi UID-ok vannak
    const myBuyerUid = buyerUid || registlessUid;
    if (hasRealId && myBuyerUid && sellerId !== myBuyerUid) {
      createOrGetChannel(sellerId, myBuyerUid)
        .then((chId) => setActiveChannelId(chId))
        .catch((e) => console.log("Channel hiba:", e));
    }

    Alert.alert("Kapcsolat hozzáadva", `${alias} sikeresen felvéve.`);
    navigateToBuyerPartner(uj.id);
  }

  function saveSellerCustomerFromParsed(parsed) {
    if (!parsed) return;

    const parsedName = (parsed.n || parsed.name || "").trim();
    const parsedCompany = (parsed.c || parsed.company || "").trim();

    // Csak valódi Firebase UID alapján duplikátum ellenőrzés
    const hasRealId = parsed.id && !parsed.id.startsWith("buyer-main");
    const existing = hasRealId
      ? sellerCustomers.find((item) => item.qrId === parsed.id)
      : null;

    if (existing) {
      Alert.alert("Megjegyzés", "Ez a vevő már szerepel a listában.");
      vibrateSuccess();
      navigateToSellerCustomer(existing.id);
      return;
    }

    // OCR esetén egyedi ID generálás
    const buyerId = parsed.id || makeId("buyer-ocr");

    const uj = {
      id: makeId("seller-customer"),
      qrId: buyerId,
      name: parsedName || "vevő",
      address: parsed.a || parsed.address || "",
      company: parsedCompany,
      email: parsed.e || parsed.email || "",
      phone: parsed.phone || "",
      taxNumber: parsed.taxNumber || "",
      appointments: [],
      invoices: [],
      openItems: [],
    };

    // Előbb navigálunk az új ID-val, majd state frissítés
    setSelectedSellerCustomerId(uj.id);
    setSellerCustomers((prev) => [uj, ...prev]);
    vibrateSuccess();

    // Firebase channel csak valódi UID esetén
    const mySellerUid = sellerUid || registlessUid;
    if (hasRealId && mySellerUid && buyerId !== mySellerUid) {
      createOrGetChannel(mySellerUid, buyerId)
        .then((chId) => setActiveChannelId(chId))
        .catch((e) => console.log("Channel hiba:", e));
    }

    Alert.alert("Vevő hozzáadva", `${uj.name} sikeresen felvéve a listába.`, [
      { text: "OK", onPress: () => setScreen("sellerCustomerDetail") }
    ]);
  }

  function renderOcrImport() {
    const parsed = parseOcrFields(ocrImportText);

    return (
      <View style={{ flex: 1, width: "100%" }}>
        <ScrollView
          style={styles.fullWidth}
          contentContainerStyle={styles.formScrollTop}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
        >
          <View style={styles.formWrap}>
            <Text style={styles.title}>OCR IMPORT</Text>
            {(ocrTarget === "newSellerCustomer" || ocrTarget === "newBuyerConnection") && (
              <View style={{ backgroundColor: "rgba(255,122,26,0.18)", borderRadius: 12, padding: 10, marginBottom: 8, width: "100%" }}>
                <Text style={{ color: "#ffb07a", fontSize: 13, textAlign: "center" }}>
                  {ocrTarget === "newSellerCustomer" ? "➕ Új vevő hozzáadása az eladó listájához" : "➕ Új eladó kapcsolat hozzáadása"}
                </Text>
              </View>
            )}

              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[
                    styles.miniToggle,
                    ocrTarget === "seller" && styles.miniToggleActive,
                  ]}
                  onPress={() => setOcrTarget("seller")}
                >
                  <Text style={styles.secondaryButtonText}>ELADÓ</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.miniToggle,
                    ocrTarget === "buyer" && styles.miniToggleActive,
                  ]}
                  onPress={() => setOcrTarget("buyer")}
                >
                  <Text style={styles.secondaryButtonText}>VEVŐ</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>
                ide jöhet az OCR-ből kimásolt szöveg vagy egy névjegy / számla szövege.
              </Text>

              <TextInput
                style={styles.bigTextArea}
                multiline
                value={ocrImportText}
                onChangeText={setOcrImportText}
                placeholder="illessz be OCR szöveget..."
                placeholderTextColor="#888"
                textAlignVertical="top"
              />

              <View style={styles.panelCard}>
                <Text style={styles.cardTitle}>FELISMERT ADATOK</Text>
                <Text style={styles.value}>név: {parsed.name || "-"}</Text>
                <Text style={styles.value}>cégnév: {parsed.company || "-"}</Text>
                <Text style={styles.value}>cím: {parsed.address || "-"}</Text>
                <Text style={styles.value}>email: {parsed.email || "-"}</Text>
                <Text style={styles.value}>telefon: {parsed.phone || "-"}</Text>
                {ocrTarget === "seller" && (
                  <>
                    <Text style={styles.value}>adószám: {parsed.taxNumber || "-"}</Text>
                    <Text style={styles.value}>bankszámla: {parsed.bankAccount || "-"}</Text>
                  </>
                )}
              </View>

              <View style={{ flexDirection: "row", gap: 10, width: "100%" }}>
                <TouchableOpacity
                  style={[styles.panelButton, { flex: 1 }]}
                  onPress={importOcrFromImage}
                >
                  <Text style={styles.panelButtonTitle}>🖼️</Text>
                  <Text style={styles.panelButtonSub}>Galériából</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.panelButton, { flex: 1 }]}
                  onPress={() => {
                    setScreen("ocrCamera");
                  }}
                >
                  <Text style={styles.panelButtonTitle}>📷</Text>
                  <Text style={styles.panelButtonSub}>Kamerával</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.glowButton}
                onPress={applyOcrImportAi}
              >
                <Text style={styles.bigButtonText}>🤖  AI ELEMZÉS + BETÖLTÉS</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.outlineGlowButton}
                onPress={applyOcrImport}
              >
                <Text style={styles.secondaryButtonText}>Regex alapú betöltés</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.outlineGlowButton}
                onPress={() => {
                  if (ocrTarget === "seller") setScreen("seller");
                  else if (ocrTarget === "newSellerCustomer") setScreen("sellerCustomers");
                  else if (ocrTarget === "newBuyerConnection") setScreen("buyerConnections");
                  else setScreen("buyerHub");
                }}
              >
                <Text style={styles.secondaryButtonText}>VISSZA</Text>
              </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  function renderOcrCamera() {
    if (!permission) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>OCR KAMERA</Text>
          <Text style={styles.value}>kamera jogosultság betöltése…</Text>
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>OCR KAMERA</Text>
          <View style={styles.panelCard}>
            <Text style={styles.cardText}>a kamerához engedélyezd a hozzáférést</Text>
          </View>
          <TouchableOpacity style={styles.glowButton} onPress={requestPermission}>
            <Text style={styles.bigButtonText}>KAMERA ENGEDÉLYEZÉSE</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.outlineGlowButton} onPress={() => setScreen("ocrImport")}>
            <Text style={styles.secondaryButtonText}>VISSZA</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.scanScreen}>
        <View style={styles.scanHeader}>
          <Text style={styles.scanTitle}>OCR – NÉVJEGY / DOKUMENTUM SCAN</Text>
        </View>

        <View style={styles.cameraWrap}>
          <CameraView
            style={{ flex: 1 }}
            ref={(ref) => { if (ref) global._ocrCameraRef = ref; }}
          />
          <View style={styles.crosshairOverlay}>
            <View style={styles.crosshairHorizontal} />
            <View style={styles.crosshairVertical} />
            <View style={styles.crosshairDiagLeft} />
            <View style={styles.crosshairDiagRight} />
          </View>
          <View style={styles.poiHintWrap}>
            <Text style={styles.poiHintText}>Igazítsd a szöveget a célkereszthez, majd fotózz</Text>
          </View>
        </View>

        <View style={styles.scanFooter}>
          <TouchableOpacity
            style={styles.glowButton}
            onPress={async () => {
              try {
                const cam = global._ocrCameraRef;
                if (!cam) {
                  Alert.alert("Hiba", "Kamera nem elérhető.");
                  return;
                }
                const photo = await cam.takePictureAsync({ quality: 0.8, base64: false, shutterSound: false });
                await importOcrFromCamera(photo.uri);
              } catch (e) {
                Alert.alert("Hiba", "Nem sikerült fotózni.");
                setScreen("ocrImport");
              }
            }}
          >
            <Text style={styles.bigButtonText}>📷  FOTÓ ÉS FELISMERÉS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.outlineGlowButton}
            onPress={() => setScreen("ocrImport")}
          >
            <Text style={styles.secondaryButtonText}>VISSZA</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderChat() {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, width: "100%" }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "android" ? 0 : 90}
      >
        <View style={styles.listScreen}>
          <Text style={styles.title}>ÜZENETEK</Text>

          {!activeChannelId ? (
            <View style={styles.panelCard}>
              <Text style={styles.cardText}>
                Még nincs aktív kapcsolat. Olvass be egy QR kódot a kapcsolódáshoz.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.fullWidth}
              contentContainerStyle={[styles.scrollListContent, { flexGrow: 1 }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {channelMessages.length === 0 ? (
                <View style={styles.panelCard}>
                  <Text style={styles.cardText}>Még nincs üzenet.</Text>
                </View>
              ) : (
                channelMessages.map((msg) => (
                  <View
                    key={msg.id}
                    style={[
                      styles.chatBubble,
                      msg.senderUid === registlessUid
                        ? styles.chatBubbleMine
                        : styles.chatBubbleTheirs,
                    ]}
                  >
                    {msg.type === "invoice" ? (
                      <Text style={styles.chatInvoiceText}>
                        📄 {msg.text}
                      </Text>
                    ) : (
                      <Text style={styles.chatText}>{msg.text}</Text>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          )}

          <ChatInput
            channelId={activeChannelId}
            senderUid={registlessUid}
            onSend={(text) =>
              sendMessage(activeChannelId, registlessUid, text)
            }
          />

          <TouchableOpacity
            style={styles.outlineGlowButton}
            onPress={() => setScreen("home")}
          >
            <Text style={styles.secondaryButtonText}>VISSZA</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  function renderPaymentSetup() {
    return (
      <View style={styles.listScreen}>
        <Text style={styles.title}>PAYMENT PACK</Text>

        <ScrollView
          style={styles.fullWidth}
          contentContainerStyle={styles.scrollListContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.panelCard}>
            <Text style={styles.cardTitle}>REVOLUT</Text>
            <Text style={styles.cardText}>
              A jelenlegi QR belső payload. A valódi merchant flow és payment visszaigazolás a következő buildben jön.
            </Text>
          </View>

          <View style={styles.panelCard}>
            <Text style={styles.cardTitle}>STRIPE</Text>
            <Text style={styles.cardText}>
              Hosted checkout / payment link irány készítendő. Itt majd a valódi payment status webhookkal frissül.
            </Text>
          </View>

          <View style={styles.panelCard}>
            <Text style={styles.cardTitle}>PAYPAL</Text>
            <Text style={styles.cardText}>
              Hosted link és checkout irány. Buyer oldali fizetési visszaigazolás későbbi szerverrel.
            </Text>
          </View>
        </ScrollView>

        <TouchableOpacity
          style={styles.outlineGlowButton}
          onPress={() => setScreen("sellerMenu")}
        >
          <Text style={styles.secondaryButtonText}>VISSZA</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderCrosshairOverlay() {
    return (
      <View pointerEvents="none" style={styles.crosshairOverlay}>
        <View style={styles.crosshairHorizontal} />
        <View style={styles.crosshairVertical} />
        <View style={styles.crosshairDiagLeft} />
        <View style={styles.crosshairDiagRight} />
        <View style={styles.poiHintWrap}>
          <Text style={styles.poiHintText}>
            célozd a középpontot a számla adatsorára
          </Text>
        </View>
      </View>
    );
  }

  function renderHome() {
    return (
      <View style={styles.homeScreen}>
        <Image source={require("./logo/logo.png")} style={styles.logo} />
        <Text style={styles.title}>REGISTLESS</Text>

        <TouchableOpacity style={[styles.glowButton, { width: "100%" }]} onPress={goToSellerEntry}>
          <Text style={styles.bigButtonText}>ELADÓ</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.glowButton, { width: "100%" }]} onPress={goToBuyerEntry}>
          <Text style={styles.bigButtonText}>VEVŐ</Text>
        </TouchableOpacity>

        <View style={{ alignItems: "center", marginTop: 8 }}>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={() => setScreen("shareRegistless")}
          >
            <Image
              source={require("./assets/share_icon.jpg")}
              style={styles.shareIcon}
            />
            <Text style={styles.shareLabel}>Megosztás</Text>
          </TouchableOpacity>

          <Text style={styles.poweredBy}>
            Powered by Star Labs Kft. · All rights reserved
          </Text>
        </View>
      </View>
    );
  }

  function renderShareRegistless() {
    const shareUrl = "https://registless.ai";
    return (
      <View style={styles.container}>
        <Text style={styles.title}>REGISTLESS LETÖLTÉSE</Text>
        <View style={styles.qrWrap}>
          <QRCode value={shareUrl} size={220} />
        </View>
        <Text style={{ color: "#fff", fontSize: 16, marginBottom: 8, textAlign: "center" }}>
          Registless Letöltése
        </Text>
        <Text style={{ color: "#aaa", fontSize: 13, marginBottom: 24, textAlign: "center" }}>
          {shareUrl}
        </Text>
        <TouchableOpacity
          style={styles.outlineGlowButton}
          onPress={() => setScreen("home")}
        >
          <Text style={styles.secondaryButtonText}>VISSZA</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderSeller() {
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            style={styles.fullWidth}
            contentContainerStyle={styles.formScrollTop}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formWrap}>
              <Text style={styles.title}>ELADÓ</Text>

              {!hasSellerProfile && (
                <TouchableOpacity
                  style={styles.outlineGlowButton}
                  onPress={() => {
                    setScannedData(null);
                    setScreen("sellerProfileQrImport");
                  }}
                >
                  <Text style={styles.secondaryButtonText}>QR IMPORT</Text>
                </TouchableOpacity>
              )}

              <View style={{ flexDirection: "row", gap: 10, width: "100%", marginBottom: 8 }}>
                <TouchableOpacity
                  style={[styles.outlineGlowButton, { flex: 1, marginTop: 0 }]}
                  onPress={() => {
                    setOcrTarget("seller");
                    setOcrImportText("");
                    setScreen("ocrImport");
                  }}
                >
                  <Text style={styles.secondaryButtonText}>📄  OCR</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.outlineGlowButton, { flex: 1, marginTop: 0 }]}
                  onPress={() => {
                    setOcrTarget("seller");
                    setOcrImportText("");
                    setScreen("ocrCamera");
                  }}
                >
                  <Text style={styles.secondaryButtonText}>📷  Kamera</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>név – írd folytatólagosan</Text>
              <TextInput
                style={styles.input}
                value={sellerName}
                onChangeText={setSellerName}
                placeholder="név"
                placeholderTextColor="#888"
                autoFocus
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => sellerAddressRef.current?.focus()}
              />

              <Text style={styles.label}>cím – írd folytatólagosan</Text>
              <TextInput
                ref={sellerAddressRef}
                style={styles.input}
                value={sellerAddress}
                onChangeText={setSellerAddress}
                placeholder="cím"
                placeholderTextColor="#888"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => sellerCompanyRef.current?.focus()}
              />

              <Text style={styles.label}>cégnév – ha vállalkozás</Text>
              <TextInput
                ref={sellerCompanyRef}
                style={styles.input}
                value={sellerCompany}
                onChangeText={setSellerCompany}
                placeholder="cégnév"
                placeholderTextColor="#888"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => sellerTaxNumberRef.current?.focus()}
              />

              <Text style={styles.label}>adószám</Text>
              <TextInput
                ref={sellerTaxNumberRef}
                style={styles.input}
                value={sellerTaxNumber}
                onChangeText={setSellerTaxNumber}
                placeholder="adószám"
                placeholderTextColor="#888"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => sellerBankAccountRef.current?.focus()}
              />

              <Text style={styles.label}>bankszámlaszám</Text>
              <TextInput
                ref={sellerBankAccountRef}
                style={styles.input}
                value={sellerBankAccount}
                onChangeText={setSellerBankAccount}
                placeholder="bankszámlaszám"
                placeholderTextColor="#888"
                returnKeyType="done"
                blurOnSubmit={false}
                onSubmitEditing={() => setScreen("sellerSummary")}
              />

              <Text style={styles.hint}>ha üresen hagyod, akkor nem cég</Text>

              <TouchableOpacity
                style={styles.glowButton}
                onPress={() => setScreen("sellerSummary")}
              >
                <Text style={styles.bigButtonText}>KÖVETKEZŐ</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.outlineGlowButton}
                onPress={resetToHome}
              >
                <Text style={styles.secondaryButtonText}>VISSZA</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    );
  }

  function renderSellerProfileQrImport() {
    if (!permission) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>ELADÓ QR IMPORT</Text>
          <Text style={styles.value}>kamera jogosultság betöltése…</Text>
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>ELADÓ QR IMPORT</Text>

          <View style={styles.panelCard}>
            <Text style={styles.cardText}>
              a QR beolvasáshoz engedélyezd a kamerát
            </Text>
          </View>

          <TouchableOpacity style={styles.glowButton} onPress={requestPermission}>
            <Text style={styles.bigButtonText}>KAMERA ENGEDÉLYEZÉSE</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.outlineGlowButton}
            onPress={() => {
              setScannedData(null);
              setScreen("seller");
            }}
          >
            <Text style={styles.secondaryButtonText}>VISSZA</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (scannedData) {
      const kind = normalizeScannedType(parsedScanned);

      return (
        <View style={styles.container}>
          <Text style={styles.title}>ELADÓ QR IMPORT</Text>

          {kind === "seller" ? (
            <View style={styles.panelCard}>
              <Text style={styles.labelSmall}>név</Text>
              <Text style={styles.value}>
                {parsedScanned?.n || parsedScanned?.name || "-"}
              </Text>

              <Text style={styles.labelSmall}>cím</Text>
              <Text style={styles.value}>
                {parsedScanned?.a || parsedScanned?.address || "-"}
              </Text>

              <Text style={styles.labelSmall}>cégnév</Text>
              <Text style={styles.value}>
                {parsedScanned?.c || parsedScanned?.company || "-"}
              </Text>

              <Text style={styles.labelSmall}>adószám</Text>
              <Text style={styles.value}>
                {parsedScanned?.tx || parsedScanned?.taxNumber || "-"}
              </Text>

              <Text style={styles.labelSmall}>bankszámlaszám</Text>
              <Text style={styles.value}>
                {parsedScanned?.b || parsedScanned?.bankAccount || "-"}
              </Text>
            </View>
          ) : (
            <View style={styles.panelCard}>
              <Text style={styles.cardText}>ez nem ELADÓ QR</Text>
            </View>
          )}

          {kind === "seller" && (
            <TouchableOpacity
              style={styles.glowButton}
              onPress={importSellerProfileFromQr}
            >
              <Text style={styles.bigButtonText}>ADATOK BETÖLTÉSE</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.outlineGlowButton}
            onPress={() => {
              setScannedData(null);
              setScreen("sellerProfileQrImport");
            }}
          >
            <Text style={styles.secondaryButtonText}>ÚJRA SCAN</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.scanScreen}>
        <View style={styles.scanHeader}>
          <Text style={styles.scanTitle}>ELADÓ – PROFIL QR IMPORT</Text>
        </View>

        <View style={styles.cameraWrap}>
          <CameraView
            style={{ flex: 1 }}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => {
              if (!scannedData) {
                vibrateScan();
                setScannedData(data);
              }
            }}
          />
          {renderCrosshairOverlay()}
        </View>

        <View style={styles.scanFooter}>
          <TouchableOpacity
            style={styles.outlineGlowButton}
            onPress={() => {
              setScannedData(null);
              setScreen("seller");
            }}
          >
            <Text style={styles.secondaryButtonText}>VISSZA</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderSellerSummary() {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>EZT MENTENÉM</Text>

        <View style={styles.panelCard}>
          <Text style={styles.labelSmall}>név</Text>
          <Text style={styles.value}>{sellerName || "-"}</Text>

          <Text style={styles.labelSmall}>cím</Text>
          <Text style={styles.value}>{sellerAddress || "-"}</Text>

          <Text style={styles.labelSmall}>cégnév</Text>
          <Text style={styles.value}>{sellerCompany || "-"}</Text>

          <Text style={styles.labelSmall}>adószám</Text>
          <Text style={styles.value}>{sellerTaxNumber || "-"}</Text>

          <Text style={styles.labelSmall}>bankszámla</Text>
          <Text style={styles.value}>{sellerBankAccount || "-"}</Text>
        </View>

        <TouchableOpacity
          style={styles.glowButton}
          onPress={() => setScreen("sellerMenu")}
        >
          <Text style={styles.bigButtonText}>KÉSZ</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.outlineGlowButton}
          onPress={() => setScreen("seller")}
        >
          <Text style={styles.secondaryButtonText}>VISSZA</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderSellerMenu() {
    return (
      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={styles.screenScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>ELADÓ</Text>

        <View style={styles.panelCard}>
          <Text style={styles.cardTitle}>ELADÓ ADATAI</Text>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              style={[styles.panelButton, { flex: 1, marginBottom: 0 }]}
              onPress={() => setScreen("sellerQr")}
            >
              <Text style={styles.panelButtonTitle}>📱 QR</Text>
              <Text style={styles.panelButtonSub}>megosztás</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.panelButton, { flex: 1, marginBottom: 0 }]}
              onPress={() => setScreen("seller")}
            >
              <Text style={styles.panelButtonTitle}>✏️ SZERKESZTÉS</Text>
              <Text style={styles.panelButtonSub}>adatok módosítása</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.panelButton}
          onPress={() => {
            setScannedData(null);
            setScreen("sellerBuyerScan");
          }}
        >
          <Text style={styles.panelButtonTitle}>VEVŐ QR SCAN</Text>
          <Text style={styles.panelButtonSub}>kapcsolat és ügyfélfelvétel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.panelButton}
          onPress={() => setScreen("sellerBookingRequests")}
        >
          <Text style={styles.panelButtonTitle}>FOGLALÁSI KÉRÉSEK</Text>
          <Text style={styles.panelButtonSub}>elfogadás pontos idővel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.panelButton}
          onPress={() => setScreen("sellerCustomers")}
        >
          <Text style={styles.panelButtonTitle}>VEVŐIM</Text>
          <Text style={styles.panelButtonSub}>szolgáltatás, számla, fizetés</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.panelButton}
          onPress={() => setScreen("sellerCalendar")}
        >
          <Text style={styles.panelButtonTitle}>NAPTÁR</Text>
          <Text style={styles.panelButtonSub}>timeline nézet ma / holnap / később</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.panelButton}
          onPress={() => setScreen("chat")}
        >
          <Text style={styles.panelButtonTitle}>💬  ÜZENETEK</Text>
          <Text style={styles.panelButtonSub}>
            {activeChannelId ? "kapcsolat aktív" : "még nincs kapcsolat"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.panelButton}
          onPress={() => setScreen("paymentSetup")}
        >
          <Text style={styles.panelButtonTitle}>PAYMENT</Text>
          <Text style={styles.panelButtonSub}>Revolut / Stripe / PayPal állapot</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.outlineGlowButton}
          onPress={resetToHome}
        >
          <Text style={styles.secondaryButtonText}>HOME</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  function renderSellerQr() {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>ELADÓ QR</Text>

        <View style={styles.qrWrap}>
          <QRCode value={sellerQrData} size={220} />
        </View>

        <TouchableOpacity
          style={styles.outlineGlowButton}
          onPress={() => setScreen("sellerMenu")}
        >
          <Text style={styles.secondaryButtonText}>VISSZA</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderSellerBuyerScan() {
    if (!permission) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>ELADÓ</Text>
          <Text style={styles.value}>kamera jogosultság betöltése…</Text>
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>ELADÓ</Text>

          <View style={styles.panelCard}>
            <Text style={styles.cardText}>
              a QR beolvasáshoz engedélyezd a kamerát
            </Text>
          </View>

          <TouchableOpacity
            style={styles.glowButton}
            onPress={requestPermission}
          >
            <Text style={styles.bigButtonText}>KAMERA ENGEDÉLYEZÉSE</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.outlineGlowButton}
            onPress={() => setScreen("sellerMenu")}
          >
            <Text style={styles.secondaryButtonText}>VISSZA</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (scannedData) {
      const kind = normalizeScannedType(parsedScanned);

      return (
        <View style={styles.container}>
          <Text style={styles.title}>ELADÓ</Text>

          {kind === "buyer" ? (
            <View style={styles.panelCard}>
              <Text style={styles.cardTitle}>vevő beolvasva</Text>

              <Text style={styles.labelSmall}>név</Text>
              <Text style={styles.value}>
                {parsedScanned?.n || parsedScanned?.name || "-"}
              </Text>

              <Text style={styles.labelSmall}>cím</Text>
              <Text style={styles.value}>
                {parsedScanned?.a || parsedScanned?.address || "-"}
              </Text>

              <Text style={styles.labelSmall}>cégnév</Text>
              <Text style={styles.value}>
                {parsedScanned?.c || parsedScanned?.company || "-"}
              </Text>
            </View>
          ) : (
            <View style={styles.panelCard}>
              <Text style={styles.cardText}>ez nem VEVŐ QR</Text>
            </View>
          )}

          {kind === "buyer" && (() => {
            const scannedId = parsedScanned?.id;
            const scannedName = parsedScanned?.n || parsedScanned?.name || "";
            const scannedCompany = parsedScanned?.c || parsedScanned?.company || "";
            const existing = sellerCustomers.find((item) =>
              (scannedId && scannedId !== "buyer-main" && item.qrId === scannedId) ||
              (scannedName && item.name === scannedName && item.company === scannedCompany)
            );
            return existing ? (
              <TouchableOpacity
                style={styles.glowButton}
                onPress={() => {
                  setScannedData(null);
                  navigateToSellerCustomer(existing.id);
                }}
              >
                <Text style={styles.bigButtonText}>BELÉPÉS: {existing.name}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.glowButton}
                onPress={saveSellerCustomerFromBuyerQr}
              >
                <Text style={styles.bigButtonText}>ÚJ VEVŐ LÉTREHOZÁSA</Text>
              </TouchableOpacity>
            );
          })()}

          <TouchableOpacity
            style={styles.outlineGlowButton}
            onPress={() => {
              setScannedData(null);
              setScreen("sellerBuyerScan");
            }}
          >
            <Text style={styles.secondaryButtonText}>ÚJRA SCAN</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.scanScreen}>
        <View style={styles.scanHeader}>
          <Text style={styles.scanTitle}>ELADÓ – VEVŐ QR SCAN</Text>
        </View>

        <View style={styles.cameraWrap}>
          <CameraView
            style={{ flex: 1 }}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => {
              if (!scannedData) {
                vibrateScan();
                setScannedData(data);
              }
            }}
          />
          {renderCrosshairOverlay()}
        </View>

        <View style={styles.scanFooter}>
          <TouchableOpacity
            style={styles.outlineGlowButton}
            onPress={() => setScreen("sellerMenu")}
          >
            <Text style={styles.secondaryButtonText}>VISSZA</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderSellerBookingRequests() {
    const requests = getSellerBookingRequests();

    return (
      <View style={styles.listScreen}>
        <Text style={styles.title}>FOGLALÁSI KÉRÉSEK</Text>

        <ScrollView
          style={styles.fullWidth}
          contentContainerStyle={styles.scrollListContent}
          showsVerticalScrollIndicator={false}
        >
          {requests.length === 0 ? (
            <View style={styles.panelCard}>
              <Text style={styles.cardText}>nincs foglalási kérés</Text>
            </View>
          ) : (
            requests.map((item) => (
              <View key={item.request.id} style={styles.panelCard}>
                <Text style={styles.cardTitle}>
                  {item.buyer?.name || item.kapcsolatAlias || "vevő"}
                </Text>

                <Text style={styles.labelSmall}>megjelenítés a vevőnél</Text>
                <Text style={styles.value}>{item.kapcsolatAlias || "-"}</Text>

                <Text style={styles.labelSmall}>dátum</Text>
                <Text style={styles.value}>
                  {item.request.datum} – {item.request.napNev}
                </Text>

                <Text style={styles.labelSmall}>idő</Text>
                <Text style={styles.value}>{item.request.ido || "-"}</Text>

                <Text style={styles.labelSmall}>állapot</Text>
                <Text style={styles.value}>{item.request.statusz || "-"}</Text>

                {item.request.statusz === "foglalási kérés" && (
                  <>
                    <TouchableOpacity
                      style={styles.glowButton}
                      onPress={() =>
                        openBookingDecision(item.kapcsolatId, item.request.id)
                      }
                    >
                      <Text style={styles.bigButtonText}>
                        ELFOGAD / IDŐPONT ADÁSA
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.outlineGlowButton}
                      onPress={() => {
                        const itemBuyerUid = item.buyer?.id;
                        const mySellerUid3 = sellerUid || registlessUid;
                        if (!itemBuyerUid || !mySellerUid3 || mySellerUid3 === itemBuyerUid) {
                          Alert.alert("Üzenet", "Nincs felhős kapcsolat ezzel a vevővel. Kérje meg, hogy frissítse az appot és olvasson be új QR-t.");
                          return;
                        }
                        const chId = `${mySellerUid3}_${itemBuyerUid}`;
                        setActiveChannelId(chId);
                        setScreen("chat");
                      }}
                    >
                      <Text style={styles.secondaryButtonText}>💬  ÜZENET KÜLDÉSE</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.dangerOutlineButton}
                      onPress={() =>
                        rejectBookingRequest(item.kapcsolatId, item.request.id)
                      }
                    >
                      <Text style={styles.secondaryButtonText}>ELUTASÍT</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            ))
          )}
        </ScrollView>

        <TouchableOpacity
          style={styles.outlineGlowButton}
          onPress={() => setScreen("sellerMenu")}
        >
          <Text style={styles.secondaryButtonText}>VISSZA</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderSellerBookingDecision() {
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            style={styles.fullWidth}
            contentContainerStyle={styles.formScrollTop}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formWrap}>
              <Text style={styles.title}>IDŐPONT MEGADÁSA</Text>

              <View style={styles.panelCard}>
                <Text style={styles.labelSmall}>vevő</Text>
                <Text style={styles.value}>
                  {selectedBookingMeta?.buyerName || "-"}
                </Text>

                <Text style={styles.labelSmall}>dátum</Text>
                <Text style={styles.value}>
                  {selectedBookingMeta?.datum || "-"} –{" "}
                  {selectedBookingMeta?.napNev || "-"}
                </Text>
              </View>

              <View style={styles.dateRow}>
                <View style={styles.dateBox}>
                  <Text style={styles.label}>óra</Text>
                  <TextInput
                    style={styles.input}
                    value={bookingHourInput}
                    onChangeText={setBookingHourInput}
                    placeholder="09"
                    placeholderTextColor="#888"
                    keyboardType="number-pad"
                    autoFocus
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => bookingMinuteRef.current?.focus()}
                  />
                </View>

                <View style={styles.dateBox}>
                  <Text style={styles.label}>perc</Text>
                  <TextInput
                    ref={bookingMinuteRef}
                    style={styles.input}
                    value={bookingMinuteInput}
                    onChangeText={setBookingMinuteInput}
                    placeholder="30"
                    placeholderTextColor="#888"
                    keyboardType="number-pad"
                    returnKeyType="done"
                    blurOnSubmit={false}
                    onSubmitEditing={acceptBookingRequestWithTime}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.glowButton}
                onPress={acceptBookingRequestWithTime}
              >
                <Text style={styles.bigButtonText}>
                  ELFOGADÁS PONTOS IDŐVEL
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.outlineGlowButton}
                onPress={() => {
                  setSelectedBookingMeta(null);
                  setBookingHourInput("");
                  setBookingMinuteInput("");
                  setScreen("sellerBookingRequests");
                }}
              >
                <Text style={styles.secondaryButtonText}>VISSZA</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    );
  }

  function renderSellerCustomers() {
    return (
      <View style={styles.listScreen}>
        <Text style={styles.title}>VEVŐIM</Text>

        <ScrollView
          style={styles.fullWidth}
          contentContainerStyle={styles.scrollListContent}
          showsVerticalScrollIndicator={false}
        >
          {sellerCustomers.length === 0 ? (
            <View style={styles.panelCard}>
              <Text style={styles.cardText}>még nincs vevő a listában</Text>
            </View>
          ) : (
            sellerCustomers.map((item) => (
              <View key={item.id} style={styles.quickServiceRow}>
                <TouchableOpacity
                  style={[styles.quickServiceMain, styles.panelButton, { marginBottom: 0 }]}
                  onPress={() => navigateToSellerCustomer(item.id)}
                >
                  <Text style={styles.panelButtonTitle}>{item.name}</Text>
                  <Text style={styles.panelButtonSub}>
                    számlák: {item.invoices.length}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickDeleteButton}
                  onPress={() => deleteSellerCustomer(item.id)}
                >
                  <Text style={styles.quickDeleteText}>🗑</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>

        <TouchableOpacity
          style={styles.newCustomerButton}
          onPress={() => setNewCustomerModal(true)}
        >
          <Text style={styles.newCustomerIconWrap}>📝</Text>
          <Text style={styles.newCustomerLabel}>ÚJ</Text>
        </TouchableOpacity>

        <Modal
          visible={newCustomerModal}
          transparent
          animationType="fade"
          onRequestClose={() => setNewCustomerModal(false)}
        >
          <TouchableWithoutFeedback onPress={() => setNewCustomerModal(false)}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.modalBox}>
                  <Text style={styles.modalTitle}>ÚJ VEVŐ</Text>

                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={() => {
                      setNewCustomerModal(false);
                      setScannedData(null);
                      setScreen("sellerBuyerScan");
                    }}
                  >
                    <Text style={styles.modalButtonIcon}>📷</Text>
                    <Text style={styles.modalButtonText}>QR SCAN</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={() => {
                      setNewCustomerModal(false);
                      setOcrTarget("newSellerCustomer");
                      setScreen("ocrImport");
                    }}
                  >
                    <Text style={styles.modalButtonIcon}>🔍</Text>
                    <Text style={styles.modalButtonText}>OCR IMPORT</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={() => setNewCustomerModal(false)}
                  >
                    <Text style={styles.modalCancelText}>Mégse</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        <TouchableOpacity
          style={styles.outlineGlowButton}
          onPress={() => setScreen("sellerMenu")}
        >
          <Text style={styles.secondaryButtonText}>VISSZA</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderQuickServiceRow(item) {
    return (
      <View key={item.id} style={styles.quickServiceRow}>
        <TouchableOpacity
          style={styles.quickServiceMain}
          onPress={() => startQuickService(item)}
        >
          <Text style={styles.quickServiceTitle}>{item.name}</Text>
          <Text style={styles.quickServiceAmount}>
            {formatCurrency(item.amount)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickDeleteButton}
          onPress={() => removeQuickService(item.id)}
        >
          <Text style={styles.quickDeleteText}>🗑</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderSellerCustomerDetail() {
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            style={styles.fullWidth}
            contentContainerStyle={styles.formScrollTop}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formWrap}>
              <Text style={styles.title}>
                {selectedSellerCustomer?.name || "VEVŐ"}
              </Text>

              <View style={styles.panelCard}>
                <Text style={styles.labelSmall}>összes számla</Text>
                <Text style={styles.value}>
                  {selectedSellerCustomer?.invoices?.length || 0}
                </Text>
              </View>

              <View style={styles.panelCard}>
                <Text style={styles.cardTitle}>GYORS SZOLGÁLTATÁSOK</Text>

                {quickServices.length ? (
                  quickServices.map((item) => renderQuickServiceRow(item))
                ) : (
                  <Text style={styles.value}>még nincs gyors gomb</Text>
                )}
              </View>

              <Text style={styles.label}>szolgáltatás neve</Text>
              <TextInput
                style={styles.input}
                value={serviceNameInput}
                onChangeText={setServiceNameInput}
                placeholder="pl. személyi edzés"
                placeholderTextColor="#888"
                autoFocus
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => serviceAmountRef.current?.focus()}
              />

              <Text style={styles.label}>összeg</Text>
              <TextInput
                ref={serviceAmountRef}
                style={styles.input}
                value={serviceAmountInput}
                onChangeText={setServiceAmountInput}
                placeholder="pl. 10000"
                placeholderTextColor="#888"
                keyboardType="number-pad"
                returnKeyType="done"
                blurOnSubmit={false}
                onSubmitEditing={startService}
              />

              <TouchableOpacity
                style={styles.outlineGlowButton}
                onPress={saveCurrentAsQuickService}
              >
                <Text style={styles.secondaryButtonText}>
                  MENTÉS GYORS GOMBKÉNT
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.glowButton} onPress={startService}>
                <Text style={styles.bigButtonText}>SZOLGÁLTATÁS INDUL</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.panelButton}
                onPress={openPaymentFlowForCustomer}
              >
                <Text style={styles.panelButtonTitle}>FIZETÉS KÉRÉSE</Text>
                <Text style={styles.panelButtonSub}>
                  Revolut / Stripe / PayPal előkészítés
                </Text>
              </TouchableOpacity>

              {!!selectedSellerCustomer?.openItems?.length && (
                <TouchableOpacity
                  style={styles.glowButton}
                  onPress={issueCollectorInvoice}
                >
                  <Text style={styles.bigButtonText}>
                    GYŰJTŐSZÁMLA KIÁLLÍTÁSA
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.glowButton}
                onPress={() => setScreen("sellerCustomerHistory")}
              >
                <Text style={styles.bigButtonText}>ÖSSZES SZÁMLA / ALKALOM</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.outlineGlowButton}
                onPress={() => setScreen("sellerCustomers")}
              >
                <Text style={styles.secondaryButtonText}>VISSZA</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    );
  }

  function renderPaymentMethod() {
    return (
      <View style={styles.listScreen}>
        <Text style={styles.title}>FIZETÉS</Text>

        <ScrollView
          style={styles.fullWidth}
          contentContainerStyle={styles.scrollListContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.panelCard}>
            <Text style={styles.labelSmall}>vevő</Text>
            <Text style={styles.value}>{paymentDraft?.customerName || "-"}</Text>

            <Text style={styles.labelSmall}>összeg</Text>
            <Text style={styles.value}>
              {formatCurrency(paymentDraft?.amount || 0)}
            </Text>

            <Text style={styles.labelSmall}>bankszámla</Text>
            <Text style={styles.value}>{sellerBankAccount || "-"}</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.panelButton,
              selectedPaymentMethod === "revolut" && styles.panelButtonActive,
            ]}
            onPress={() => choosePaymentMethod("revolut")}
          >
            <Text style={styles.panelButtonTitle}>REVOLUT PAY KÉRÉS</Text>
            <Text style={styles.panelButtonSub}>
              belső payment QR payload előkészítve
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.panelButton,
              selectedPaymentMethod === "stripe" && styles.panelButtonActive,
            ]}
            onPress={() => choosePaymentMethod("stripe")}
          >
            <Text style={styles.panelButtonTitle}>STRIPE</Text>
            <Text style={styles.panelButtonSub}>
              Payment Sheet / hosted checkout stub
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.panelButton,
              selectedPaymentMethod === "paypal" && styles.panelButtonActive,
            ]}
            onPress={() => choosePaymentMethod("paypal")}
          >
            <Text style={styles.panelButtonTitle}>PAYPAL</Text>
            <Text style={styles.panelButtonSub}>
              hosted checkout stub
            </Text>
          </TouchableOpacity>

          {selectedPaymentMethod === "revolut" ? (
            <TouchableOpacity
              style={styles.glowButton}
              onPress={() => setScreen("paymentQr")}
            >
              <Text style={styles.bigButtonText}>PAYMENT QR</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.glowButton}
              onPress={() => openHostedPaymentInfo(selectedPaymentMethod)}
            >
              <Text style={styles.bigButtonText}>HOSTED CHECKOUT INFÓ</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <TouchableOpacity
          style={styles.outlineGlowButton}
          onPress={() => setScreen("sellerCustomerDetail")}
        >
          <Text style={styles.secondaryButtonText}>VISSZA</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderPaymentQr() {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>PAYMENT QR</Text>

        <View style={styles.panelCard}>
          <Text style={styles.value}>{paymentDraft?.customerName || "-"}</Text>
          <Text style={styles.value}>
            {formatCurrency(paymentDraft?.amount || 0)}
          </Text>
          <Text style={styles.value}>
            {selectedPaymentMethod.toUpperCase()}
          </Text>
        </View>

        <View style={styles.qrWrap}>
          <QRCode value={paymentQrPayload || "empty"} size={220} />
        </View>

        <TouchableOpacity
          style={styles.outlineGlowButton}
          onPress={() => setScreen("paymentMethod")}
        >
          <Text style={styles.secondaryButtonText}>VISSZA</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderSellerServiceRunning() {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>SZOLGÁLTATÁS FUT</Text>

        <View style={styles.panelCard}>
          <Text style={styles.labelSmall}>vevő</Text>
          <Text style={styles.value}>{activeService?.customerName || "-"}</Text>

          <Text style={styles.labelSmall}>szolgáltatás</Text>
          <Text style={styles.value}>{activeService?.serviceName || "-"}</Text>

          <Text style={styles.labelSmall}>összeg</Text>
          <Text style={styles.value}>
            {formatCurrency(activeService?.amount || 0)}
          </Text>

          <Text style={styles.timerText}>{elapsedLabel()}</Text>
        </View>

        <TouchableOpacity
          style={styles.glowButton}
          onPress={() => setScreen("sellerServiceFinishChoice")}
        >
          <Text style={styles.bigButtonText}>SZOLGÁLTATÁS VÉGE</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderSellerServiceFinishChoice() {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>MI TÖRTÉNJEN?</Text>

        <View style={styles.panelCard}>
          <Text style={styles.value}>{activeService?.serviceName || "-"}</Text>
          <Text style={styles.value}>{elapsedLabel()}</Text>
          <Text style={styles.value}>
            {formatCurrency(activeService?.amount || 0)}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.glowButton}
          onPress={finishServiceAndInvoice}
        >
          <Text style={styles.bigButtonText}>SZÁMLÁZ</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.glowButton}
          onPress={finishServiceAndAddOccurrence}
        >
          <Text style={styles.bigButtonText}>ALKALOM HOZZÁAD</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.outlineGlowButton}
          onPress={() => setScreen("sellerServiceRunning")}
        >
          <Text style={styles.secondaryButtonText}>VISSZA</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderSellerCalendarSection(title, items) {
    return (
      <View style={styles.panelCard}>
        <Text style={styles.cardTitle}>{title}</Text>

        {items.length ? (
          items.map((item, index) => (
            <TouchableOpacity
              key={`${title}-${item.customerId}-${index}`}
              style={styles.panelButton}
              onPress={() => {
                setSelectedSellerCustomerId(item.customerId);
                setScreen("sellerCustomerHistory");
              }}
            >
              <Text style={styles.panelButtonTitle}>
                {item.ido} – {item.customerName}
              </Text>
              <Text style={styles.panelButtonSub}>
                {item.datum} • {item.serviceName} • {item.statusz}
              </Text>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.value}>nincs elem</Text>
        )}
      </View>
    );
  }

  function renderSellerCalendar() {
    const buckets = sellerCalendarBuckets();

    return (
      <View style={styles.listScreen}>
        <Text style={styles.title}>NAPTÁR – TIMELINE</Text>

        <ScrollView
          style={styles.fullWidth}
          contentContainerStyle={styles.scrollListContent}
          showsVerticalScrollIndicator={false}
        >
          {renderSellerCalendarSection("MA", buckets.ma)}
          {renderSellerCalendarSection("HOLNAP", buckets.holnap)}
          {renderSellerCalendarSection("KÉSŐBB", buckets.kesobb)}
        </ScrollView>

        <TouchableOpacity
          style={styles.outlineGlowButton}
          onPress={() => setScreen("sellerMenu")}
        >
          <Text style={styles.secondaryButtonText}>VISSZA</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderSellerCustomerHistory() {
    return (
      <View style={styles.listScreen}>
        <Text style={styles.title}>
          {selectedSellerCustomer?.name || "VEVŐ"}
        </Text>

        <ScrollView
          style={styles.fullWidth}
          contentContainerStyle={styles.scrollListContent}
          showsVerticalScrollIndicator={false}
        >

          <View style={styles.panelCard}>
            <Text style={styles.cardTitle}>számlák</Text>

            {selectedSellerCustomer?.invoices?.length ? (
              selectedSellerCustomer.invoices.map((inv) => (
                <View key={inv.id} style={{ marginBottom: 18 }}>
                  <Text style={styles.value}>
                    {inv.id} • {inv.datum} • {inv.vegosszeg}
                  </Text>

                  {(inv.tetelek || []).map((tetel) => (
                    <Text key={tetel.id} style={styles.connectionSub}>
                      {tetel.tetel} • {tetel.darab} db • nettó{" "}
                      {formatCurrency(tetel.netto)} • áfa{" "}
                      {formatCurrency(tetel.afa27)} • bruttó{" "}
                      {formatCurrency(tetel.brutto)}
                    </Text>
                  ))}

                  <TouchableOpacity
                    style={styles.outlineGlowButton}
                    onPress={() => shareInvoicePdf(inv)}
                  >
                    <Text style={styles.secondaryButtonText}>PDF MEGOSZTÁS</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.outlineGlowButton}
                    onPress={() => openInvoiceQr(inv)}
                  >
                    <Text style={styles.secondaryButtonText}>SZÁMLA QR</Text>
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <Text style={styles.value}>még nincs számla</Text>
            )}
          </View>
        </ScrollView>

        <TouchableOpacity
          style={styles.outlineGlowButton}
          onPress={() => setScreen("sellerCustomerDetail")}
        >
          <Text style={styles.secondaryButtonText}>VISSZA</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderSellerInvoiceQr() {
    const payload = selectedInvoiceForQr
      ? buildInvoiceQrPayload(selectedInvoiceForQr)
      : "";

    return (
      <View style={styles.container}>
        <Text style={styles.title}>SZÁMLA QR</Text>

        {selectedInvoiceForQr ? (
          <>
            <View style={styles.panelCard}>
              <Text style={styles.value}>{selectedInvoiceForQr.id}</Text>
              <Text style={styles.value}>{selectedInvoiceForQr.datum}</Text>
              <Text style={styles.value}>{selectedInvoiceForQr.vegosszeg}</Text>
            </View>

            <View style={styles.qrWrap}>
              <QRCode value={payload} size={220} />
            </View>
          </>
        ) : (
          <View style={styles.panelCard}>
            <Text style={styles.cardText}>nincs kiválasztott számla</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.outlineGlowButton}
          onPress={() => setScreen("sellerCustomerHistory")}
        >
          <Text style={styles.secondaryButtonText}>VISSZA</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderBuyerHub() {
    return (
      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={styles.screenScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Image source={require("./logo/logo.png")} style={styles.logo} />
        <Text style={styles.title}>VEVŐ</Text>

        <TouchableOpacity
          style={styles.panelButton}
          onPress={goToBuyerProfileOrQr}
        >
          <Text style={styles.panelButtonTitle}>VEVŐ PROFIL / QR</Text>
          <Text style={styles.panelButtonSub}>azonosítás és megosztás</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.panelButton}
          onPress={() => {
            setScannedData(null);
            setScreen("buyerScanSeller");
          }}
        >
          <Text style={styles.panelButtonTitle}>ELADÓ QR SCAN</Text>
          <Text style={styles.panelButtonSub}>új kapcsolat hozzáadása</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.panelButton}
          onPress={() => setScreen("buyerConnections")}
        >
          <Text style={styles.panelButtonTitle}>KAPCSOLATAIM</Text>
          <Text style={styles.panelButtonSub}>eladók, számlák, foglalások</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.panelButton}
          onPress={() => {
            setOcrTarget("buyer");
            setScreen("ocrImport");
          }}
        >
          <Text style={styles.panelButtonTitle}>OCR IMPORT</Text>
          <Text style={styles.panelButtonSub}>buyer adatok beemelése szövegből</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.outlineGlowButton}
          onPress={resetToHome}
        >
          <Text style={styles.secondaryButtonText}>VISSZA</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  function renderBuyerProfile() {
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            style={styles.fullWidth}
            contentContainerStyle={styles.formScrollTop}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formWrap}>
              <Text style={styles.title}>VEVŐ PROFIL</Text>

              <TouchableOpacity
                style={styles.outlineGlowButton}
                onPress={() => {
                  setScannedData(null);
                  setScreen("buyerProfileQrImport");
                }}
              >
                <Text style={styles.secondaryButtonText}>QR IMPORT</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.outlineGlowButton}
                onPress={() => {
                  setOcrTarget("buyer");
                  setScreen("ocrImport");
                }}
              >
                <Text style={styles.secondaryButtonText}>📷  OCR IMPORTÁLÁS</Text>
              </TouchableOpacity>

              <Text style={styles.label}>név – írd folytatólagosan</Text>
              <TextInput
                style={styles.input}
                value={buyerName}
                onChangeText={setBuyerName}
                placeholder="név"
                placeholderTextColor="#888"
                autoFocus
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => buyerAddressRef.current?.focus()}
              />

              <Text style={styles.label}>cím – írd folytatólagosan</Text>
              <TextInput
                ref={buyerAddressRef}
                style={styles.input}
                value={buyerAddress}
                onChangeText={setBuyerAddress}
                placeholder="cím"
                placeholderTextColor="#888"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => buyerCompanyRef.current?.focus()}
              />

              <Text style={styles.label}>cégnév – ha vállalkozás</Text>
              <TextInput
                ref={buyerCompanyRef}
                style={styles.input}
                value={buyerCompany}
                onChangeText={setBuyerCompany}
                placeholder="cégnév"
                placeholderTextColor="#888"
                returnKeyType="done"
                blurOnSubmit={false}
                onSubmitEditing={() => setScreen("buyerQr")}
              />

              <Text style={styles.hint}>ha üresen hagyod, akkor nem cég</Text>

              <TouchableOpacity
                style={styles.glowButton}
                onPress={() => setScreen("buyerQr")}
              >
                <Text style={styles.bigButtonText}>VEVŐ QR</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.outlineGlowButton}
                onPress={() => setScreen("buyerHub")}
              >
                <Text style={styles.secondaryButtonText}>VISSZA</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    );
  }

  function renderBuyerProfileQrImport() {
    if (!permission) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>VEVŐ QR IMPORT</Text>
          <Text style={styles.value}>kamera jogosultság betöltése…</Text>
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>VEVŐ QR IMPORT</Text>

          <View style={styles.panelCard}>
            <Text style={styles.cardText}>
              a QR beolvasáshoz engedélyezd a kamerát
            </Text>
          </View>

          <TouchableOpacity style={styles.glowButton} onPress={requestPermission}>
            <Text style={styles.bigButtonText}>KAMERA ENGEDÉLYEZÉSE</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.outlineGlowButton}
            onPress={() => {
              setScannedData(null);
              setScreen("buyerProfile");
            }}
          >
            <Text style={styles.secondaryButtonText}>VISSZA</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (scannedData) {
      const kind = normalizeScannedType(parsedScanned);

      return (
        <View style={styles.container}>
          <Text style={styles.title}>VEVŐ QR IMPORT</Text>

          {kind === "buyer" ? (
            <View style={styles.panelCard}>
              <Text style={styles.labelSmall}>név</Text>
              <Text style={styles.value}>
                {parsedScanned?.n || parsedScanned?.name || "-"}
              </Text>

              <Text style={styles.labelSmall}>cím</Text>
              <Text style={styles.value}>
                {parsedScanned?.a || parsedScanned?.address || "-"}
              </Text>

              <Text style={styles.labelSmall}>cégnév</Text>
              <Text style={styles.value}>
                {parsedScanned?.c || parsedScanned?.company || "-"}
              </Text>
            </View>
          ) : (
            <View style={styles.panelCard}>
              <Text style={styles.cardText}>ez nem VEVŐ QR</Text>
            </View>
          )}

          {kind === "buyer" && (
            <TouchableOpacity
              style={styles.glowButton}
              onPress={importBuyerProfileFromQr}
            >
              <Text style={styles.bigButtonText}>ADATOK BETÖLTÉSE</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.outlineGlowButton}
            onPress={() => {
              setScannedData(null);
              setScreen("buyerProfileQrImport");
            }}
          >
            <Text style={styles.secondaryButtonText}>ÚJRA SCAN</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.scanScreen}>
        <View style={styles.scanHeader}>
          <Text style={styles.scanTitle}>VEVŐ – PROFIL QR IMPORT</Text>
        </View>

        <View style={styles.cameraWrap}>
          <CameraView
            style={{ flex: 1 }}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => {
              if (!scannedData) {
                vibrateScan();
                setScannedData(data);
              }
            }}
          />
          {renderCrosshairOverlay()}
        </View>

        <View style={styles.scanFooter}>
          <TouchableOpacity
            style={styles.outlineGlowButton}
            onPress={() => {
              setScannedData(null);
              setScreen("buyerProfile");
            }}
          >
            <Text style={styles.secondaryButtonText}>VISSZA</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderBuyerQr() {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>VEVŐ QR</Text>

        <View style={styles.qrWrap}>
          <QRCode value={buyerQrData} size={220} />
        </View>

        <View style={{ alignItems: "center", marginBottom: 12 }}>
          <Text style={styles.value}>{buyerName || "-"}</Text>
          {!!buyerAddress && <Text style={styles.labelSmall}>{buyerAddress}</Text>}
          {!!buyerCompany && <Text style={styles.labelSmall}>{buyerCompany}</Text>}
        </View>

        <TouchableOpacity
          style={styles.glowButton}
          onPress={() => setScreen("buyerProfile")}
        >
          <Text style={styles.bigButtonText}>✏️  ADATOK MÓDOSÍTÁSA</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.outlineGlowButton}
          onPress={() => {
            setOcrTarget("buyer");
            setScreen("ocrImport");
          }}
        >
          <Text style={styles.secondaryButtonText}>📷  OCR IMPORTÁLÁS</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.outlineGlowButton}
          onPress={() => setScreen("buyerHub")}
        >
          <Text style={styles.secondaryButtonText}>VISSZA</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderBuyerScanSeller() {
    if (!permission) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>VEVŐ</Text>
          <Text style={styles.value}>kamera jogosultság betöltése…</Text>
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>VEVŐ</Text>

          <View style={styles.panelCard}>
            <Text style={styles.cardText}>
              a QR beolvasáshoz engedélyezd a kamerát
            </Text>
          </View>

          <TouchableOpacity
            style={styles.glowButton}
            onPress={requestPermission}
          >
            <Text style={styles.bigButtonText}>KAMERA ENGEDÉLYEZÉSE</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.outlineGlowButton}
            onPress={() => setScreen("buyerHub")}
          >
            <Text style={styles.secondaryButtonText}>VISSZA</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (scannedData) {
      const kind = normalizeScannedType(parsedScanned);

      return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <ScrollView
              style={styles.fullWidth}
              contentContainerStyle={styles.formScrollTop}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.formWrap}>
                <Text style={styles.title}>VEVŐ</Text>

                {kind === "seller" ? (
                  <View style={styles.panelCard}>
                    <Text style={styles.cardTitle}>beolvasott eladó</Text>

                    <Text style={styles.labelSmall}>név</Text>
                    <Text style={styles.value}>
                      {parsedScanned?.n || parsedScanned?.name || "-"}
                    </Text>

                    <Text style={styles.labelSmall}>cím</Text>
                    <Text style={styles.value}>
                      {parsedScanned?.a || parsedScanned?.address || "-"}
                    </Text>

                    <Text style={styles.labelSmall}>cégnév</Text>
                    <Text style={styles.value}>
                      {parsedScanned?.c || parsedScanned?.company || "-"}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.panelCard}>
                    <Text style={styles.cardText}>ez nem ELADÓ QR</Text>
                  </View>
                )}

                {kind === "seller" && (
                  <>
                    <Text style={styles.label}>
                      hogy jelenjen meg nálam – pl. edzőm
                    </Text>
                    <TextInput
                      ref={kapcsolatNevRef}
                      style={styles.input}
                      value={ujKapcsolatNev}
                      onChangeText={setUjKapcsolatNev}
                      placeholder="pl. edzőm"
                      placeholderTextColor="#888"
                      autoFocus
                      returnKeyType="done"
                      blurOnSubmit={false}
                      onSubmitEditing={addBuyerConnection}
                    />

                    <TouchableOpacity
                      style={styles.glowButton}
                      onPress={addBuyerConnection}
                    >
                      <Text style={styles.bigButtonText}>
                        KAPCSOLÓDÁS MENTÉSE
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                <TouchableOpacity
                  style={styles.outlineGlowButton}
                  onPress={() => {
                    setScannedData(null);
                    setUjKapcsolatNev("");
                    setScreen("buyerScanSeller");
                  }}
                >
                  <Text style={styles.secondaryButtonText}>ÚJRA SCAN</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      );
    }

    return (
      <View style={styles.scanScreen}>
        <View style={styles.scanHeader}>
          <Text style={styles.scanTitle}>VEVŐ – ELADÓ QR SCAN</Text>
        </View>

        <View style={styles.cameraWrap}>
          <CameraView
            style={{ flex: 1 }}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => {
              if (!scannedData) {
                vibrateScan();
                setScannedData(data);
              }
            }}
          />
          {renderCrosshairOverlay()}
        </View>

        <View style={styles.scanFooter}>
          <TouchableOpacity
            style={styles.outlineGlowButton}
            onPress={() => setScreen("buyerHub")}
          >
            <Text style={styles.secondaryButtonText}>VISSZA</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderBuyerInvoiceScan() {
    if (!permission) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>VEVŐ</Text>
          <Text style={styles.value}>kamera jogosultság betöltése…</Text>
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>VEVŐ</Text>
          <View style={styles.panelCard}>
            <Text style={styles.cardText}>
              a QR beolvasáshoz engedélyezd a kamerát
            </Text>
          </View>

          <TouchableOpacity style={styles.glowButton} onPress={requestPermission}>
            <Text style={styles.bigButtonText}>KAMERA ENGEDÉLYEZÉSE</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.outlineGlowButton}
            onPress={() => setScreen("buyerHub")}
          >
            <Text style={styles.secondaryButtonText}>VISSZA</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (scannedData) {
      const kind = normalizeScannedType(parsedScanned);

      return (
        <View style={styles.container}>
          <Text style={styles.title}>SZÁMLA IMPORT</Text>

          {kind === "invoice" ? (
            <View style={styles.panelCard}>
              <Text style={styles.value}>
                {parsedScanned?.id || "ismeretlen számla"}
              </Text>
              <Text style={styles.value}>rövid QR payload</Text>
            </View>
          ) : (
            <View style={styles.panelCard}>
              <Text style={styles.cardText}>ez nem REGISTLESS számla QR</Text>
            </View>
          )}

          {kind === "invoice" && (
            <TouchableOpacity
              style={styles.glowButton}
              onPress={importInvoiceFromQr}
            >
              <Text style={styles.bigButtonText}>SZÁMLA MENTÉSE</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.outlineGlowButton}
            onPress={() => {
              setScannedData(null);
              setScreen("buyerInvoiceScan");
            }}
          >
            <Text style={styles.secondaryButtonText}>ÚJRA SCAN</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.scanScreen}>
        <View style={styles.scanHeader}>
          <Text style={styles.scanTitle}>VEVŐ – SZÁMLA QR SCAN</Text>
        </View>

        <View style={styles.cameraWrap}>
          <CameraView
            style={{ flex: 1 }}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => {
              if (!scannedData) {
                vibrateScan();
                setScannedData(data);
              }
            }}
          />
          {renderCrosshairOverlay()}
        </View>

        <View style={styles.scanFooter}>
          <TouchableOpacity
            style={styles.outlineGlowButton}
            onPress={() => setScreen("buyerHub")}
          >
            <Text style={styles.secondaryButtonText}>VISSZA</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderBuyerConnections() {
    return (
      <View style={styles.listScreen}>
        <Text style={styles.title}>KAPCSOLATAIM</Text>

        <ScrollView
          style={styles.fullWidth}
          contentContainerStyle={styles.scrollListContent}
          showsVerticalScrollIndicator={false}
        >
          {kapcsolatok.length === 0 ? (
            <View style={styles.panelCard}>
              <Text style={styles.cardText}>még nincs mentett kapcsolatom</Text>
            </View>
          ) : (
            kapcsolatok.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.panelButton}
                onPress={() => navigateToBuyerPartner(item.id)}
              >
                <Text style={styles.panelButtonTitle}>{item.alias}</Text>
                <Text style={styles.panelButtonSub}>
                  {item.seller.name || item.seller.company || "eladó"}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        <TouchableOpacity
          style={styles.outlineGlowButton}
          onPress={() => {
            setScannedData(null);
            setScreen("buyerScanSeller");
          }}
        >
          <Text style={styles.secondaryButtonText}>📷  ELADÓ QR SCAN</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.outlineGlowButton}
          onPress={() => {
            setOcrTarget("newBuyerConnection");
            setScreen("ocrImport");
          }}
        >
          <Text style={styles.secondaryButtonText}>📄  ÚJ ELADÓ OCR-REL</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.outlineGlowButton}
          onPress={() => setScreen("buyerProfile")}
        >
          <Text style={styles.secondaryButtonText}>✏️  SAJÁT PROFIL MÓDOSÍTÁSA</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.outlineGlowButton}
          onPress={() => setScreen("buyerHub")}
        >
          <Text style={styles.secondaryButtonText}>VISSZA</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderBuyerPartnerMenu() {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{aktivKapcsolat?.alias || "kapcsolat"}</Text>

        <TouchableOpacity
          style={styles.glowButton}
          onPress={() => setScreen("buyerCalendar")}
        >
          <Text style={styles.bigButtonText}>NAPTÁR</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.glowButton}
          onPress={() => setScreen("buyerInvoices")}
        >
          <Text style={styles.bigButtonText}>EDDIGI SZÁMLÁK</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.glowButton}
          onPress={() => setScreen("buyerBooking")}
        >
          <Text style={styles.bigButtonText}>FOGLALÁS</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.glowButton}
          onPress={() => {
            const itemSellerUid = aktivKapcsolat?.seller?.id;
            const myBuyerUid2 = buyerUid || registlessUid;
            if (!itemSellerUid || !myBuyerUid2 || itemSellerUid === myBuyerUid2) {
              Alert.alert("Üzenet", "Nincs felhős kapcsolat ezzel az eladóval. Olvass be új QR-t.");
              return;
            }
            const chId = `${itemSellerUid}_${myBuyerUid2}`;
            setActiveChannelId(chId);
            setScreen("chat");
          }}
        >
          <Text style={styles.bigButtonText}>💬  ÜZENET</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.outlineGlowButton}
          onPress={() => setScreen("buyerConnections")}
        >
          <Text style={styles.secondaryButtonText}>VISSZA</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderBuyerCalendar() {
    return (
      <View style={styles.listScreen}>
        <Text style={styles.title}>NAPTÁR</Text>

        <ScrollView
          style={styles.fullWidth}
          contentContainerStyle={styles.scrollListContent}
          showsVerticalScrollIndicator={false}
        >
          {(aktivKapcsolat?.naptar || []).length ? (
            aktivKapcsolat.naptar.map((item) => (
              <View key={item.id} style={styles.panelCard}>
                <Text style={styles.labelSmall}>dátum</Text>
                <Text style={styles.value}>
                  {item.datum} – {item.napNev}
                </Text>

                <Text style={styles.labelSmall}>idő</Text>
                <Text style={styles.value}>{item.ido}</Text>

                <Text style={styles.labelSmall}>állapot</Text>
                <Text style={styles.value}>{item.statusz}</Text>

                <TouchableOpacity
                  style={styles.outlineGlowButton}
                  onPress={() => {
                    const itemSellerUid = aktivKapcsolat?.seller?.id;
                    const myBuyerUid2 = buyerUid || registlessUid;
                    if (!itemSellerUid || !myBuyerUid2 || itemSellerUid === myBuyerUid2) {
                      Alert.alert("Üzenet", "Nincs felhős kapcsolat ezzel az eladóval. Olvass be új QR-t.");
                      return;
                    }
                    const chId = `${itemSellerUid}_${myBuyerUid2}`;
                    setActiveChannelId(chId);
                    setScreen("chat");
                  }}
                >
                  <Text style={styles.secondaryButtonText}>💬  ÜZENET AZ ELADÓNAK</Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={styles.panelCard}>
              <Text style={styles.cardText}>még nincs időpont</Text>
            </View>
          )}
        </ScrollView>

        <TouchableOpacity
          style={styles.outlineGlowButton}
          onPress={() => setScreen("buyerPartnerMenu")}
        >
          <Text style={styles.secondaryButtonText}>VISSZA</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderBuyerInvoices() {
    return (
      <View style={styles.listScreen}>
        <Text style={styles.title}>EDDIGI SZÁMLÁK</Text>

        <ScrollView
          style={styles.fullWidth}
          contentContainerStyle={styles.scrollListContent}
          showsVerticalScrollIndicator={false}
        >
          {(aktivKapcsolat?.szamlak || []).length ? (
            aktivKapcsolat.szamlak.map((szamla) => (
              <View key={szamla.id} style={styles.panelCard}>
                <Text style={styles.cardTitle}>{szamla.id}</Text>

                <Text style={styles.labelSmall}>kiállítás dátuma</Text>
                <Text style={styles.value}>{szamla.datum}</Text>

                <Text style={styles.labelSmall}>tételek</Text>
                {(szamla.tetelek || []).map((tetel) => (
                  <Text key={tetel.id} style={styles.value}>
                    {tetel.tetel} • {tetel.darab} db • nettó{" "}
                    {formatCurrency(tetel.netto)} • áfa{" "}
                    {formatCurrency(tetel.afa27)} • bruttó{" "}
                    {formatCurrency(tetel.brutto)}
                  </Text>
                ))}

                <Text style={styles.labelSmall}>nettó összesen</Text>
                <Text style={styles.value}>
                  {formatCurrency(szamla.nettoOsszesen)}
                </Text>

                <Text style={styles.labelSmall}>ÁFA 27%</Text>
                <Text style={styles.value}>
                  {formatCurrency(szamla.afaOsszesen)}
                </Text>

                <Text style={styles.labelSmall}>bruttó</Text>
                <Text style={styles.value}>
                  {formatCurrency(szamla.bruttoOsszesen)}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.panelCard}>
              <Text style={styles.cardText}>még nincs számla</Text>
            </View>
          )}
        </ScrollView>

        <TouchableOpacity
          style={styles.outlineGlowButton}
          onPress={() => setScreen("buyerPartnerMenu")}
        >
          <Text style={styles.secondaryButtonText}>VISSZA</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderBuyerBooking() {
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            style={styles.fullWidth}
            contentContainerStyle={styles.formScrollTop}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formWrap}>
              <Text style={styles.title}>FOGLALÁS</Text>

              <View style={styles.dateRow}>
                <View style={styles.dateBox}>
                  <Text style={styles.label}>nap</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="11"
                    placeholderTextColor="#888"
                    value={foglalasNap}
                    onChangeText={setFoglalasNap}
                    keyboardType="number-pad"
                    autoFocus
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => honapRef.current?.focus()}
                  />
                </View>

                <View style={styles.dateBox}>
                  <Text style={styles.label}>hónap</Text>
                  <TextInput
                    ref={honapRef}
                    style={styles.input}
                    placeholder="03"
                    placeholderTextColor="#888"
                    value={foglalasHonap}
                    onChangeText={setFoglalasHonap}
                    keyboardType="number-pad"
                    returnKeyType="done"
                    blurOnSubmit={false}
                    onSubmitEditing={addBuyerBookingRequest}
                  />
                </View>

                <View style={styles.dateBox}>
                  <Text style={styles.label}>nap neve</Text>
                  <View style={styles.readonlyBox}>
                    <Text style={styles.readonlyText}>{foglalasNapNev}</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.glowButton}
                onPress={addBuyerBookingRequest}
              >
                <Text style={styles.bigButtonText}>FOGLALÁSI KÉRÉS KÜLDÉSE</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.outlineGlowButton}
                onPress={() => setScreen("buyerPartnerMenu")}
              >
                <Text style={styles.secondaryButtonText}>VISSZA</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    );
  }


  function renderFloatingHomeButton() {
    if (screen === "home") return null;

    return (
      <TouchableOpacity
        style={styles.homeFab}
        onPress={resetToHome}
        activeOpacity={0.86}
      >
        <Text style={styles.homeFabIcon}>⌂</Text>
        <Text style={styles.homeFabText}>HOME</Text>
      </TouchableOpacity>
    );
  }

  function renderAnimatedShell(content) {
    return (
      <ImageBackground
        source={require("./logo/background.png")}
        style={styles.bgImage}
        resizeMode="cover"
      >
        <View style={styles.bgOverlay} />
        <Animated.View
          style={[
            styles.appAnimatedShell,
            {
              opacity: screenFadeAnim,
              transform: [{ translateY: screenSlideAnim }],
            },
          ]}
        >
          {content}
          {renderFloatingHomeButton()}
        </Animated.View>
      </ImageBackground>
    );
  }

  if (!isHydrated) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>REGISTLESS</Text>
        <Text style={styles.value}>betöltés...</Text>
      </View>
    );
  }

  let content = null;

  if (screen === "home") content = renderHome();

  if (screen === "seller") content = renderSeller();
  if (screen === "sellerProfileQrImport") content = renderSellerProfileQrImport();
  if (screen === "sellerSummary") content = renderSellerSummary();
  if (screen === "sellerMenu") content = renderSellerMenu();
  if (screen === "sellerQr") content = renderSellerQr();
  if (screen === "sellerBuyerScan") content = renderSellerBuyerScan();
  if (screen === "sellerBookingRequests") content = renderSellerBookingRequests();
  if (screen === "sellerBookingDecision") content = renderSellerBookingDecision();
  if (screen === "sellerCustomers") content = renderSellerCustomers();
  if (screen === "sellerCustomerDetail") content = renderSellerCustomerDetail();
  if (screen === "paymentMethod") content = renderPaymentMethod();
  if (screen === "paymentQr") content = renderPaymentQr();
  if (screen === "sellerServiceRunning") content = renderSellerServiceRunning();
  if (screen === "sellerServiceFinishChoice") content = renderSellerServiceFinishChoice();
  if (screen === "sellerCalendar") content = renderSellerCalendar();
  if (screen === "sellerCustomerHistory") content = renderSellerCustomerHistory();
  if (screen === "sellerInvoiceQr") content = renderSellerInvoiceQr();
  if (screen === "ocrImport") content = renderOcrImport();
  if (screen === "shareRegistless") content = renderShareRegistless();
  if (screen === "chat") content = renderChat();
  if (screen === "ocrCamera") content = renderOcrCamera();
  if (screen === "paymentSetup") content = renderPaymentSetup();

  if (screen === "buyerHub") content = renderBuyerHub();
  if (screen === "buyerProfile") content = renderBuyerProfile();
  if (screen === "buyerProfileQrImport") content = renderBuyerProfileQrImport();
  if (screen === "buyerQr") content = renderBuyerQr();
  if (screen === "buyerScanSeller") content = renderBuyerScanSeller();
  if (screen === "buyerInvoiceScan") content = renderBuyerInvoiceScan();
  if (screen === "buyerConnections") content = renderBuyerConnections();
  if (screen === "buyerPartnerMenu") content = renderBuyerPartnerMenu();
  if (screen === "buyerCalendar") content = renderBuyerCalendar();
  if (screen === "buyerInvoices") content = renderBuyerInvoices();
  if (screen === "buyerBooking") content = renderBuyerBooking();

  return renderAnimatedShell(content);
}

const styles = StyleSheet.create({
  bgImage: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  appAnimatedShell: {
    flex: 1,
    width: "100%",
  },
  container: {
    flex: 1,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  homeScreen: {
    flex: 1,
    backgroundColor: "transparent",
    justifyContent: "space-evenly",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 16,
    width: "100%",
  },
  shareButton: {
    alignItems: "center",
    marginTop: 8,
  },
  shareIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
  },
  shareLabel: {
    color: "#fff",
    fontSize: 13,
    marginTop: 6,
    fontWeight: "600",
  },
  poweredBy: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    textAlign: "center",
    marginTop: 4,
    letterSpacing: 0.3,
  },
  listScreen: {
    flex: 1,
    backgroundColor: "transparent",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  fullWidth: {
    width: "100%",
  },
  screenScroll: {
    flex: 1,
    backgroundColor: "transparent",
    paddingHorizontal: 20,
  },
  screenScrollContent: {
    paddingTop: 28,
    paddingBottom: 30,
  },
  formScrollTop: {
    paddingBottom: 45,
    width: "100%",
  },
  scrollListContent: {
    paddingBottom: 35,
    width: "100%",
  },
  formWrap: {
    width: "100%",
  },
  logo: {
    width: 220,
    height: 130,
    resizeMode: "contain",
    marginBottom: 24,
    alignSelf: "center",
  },
  title: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "bold",
    marginBottom: 28,
    textAlign: "center",
  },
  label: {
    color: "#fff",
    fontSize: 18,
    marginBottom: 8,
    marginTop: 10,
  },
  hint: {
    color: "#aaa",
    fontSize: 14,
    marginBottom: 18,
    marginTop: 6,
  },
  input: {
    width: "100%",
    backgroundColor: "rgba(20,20,20,0.62)",
    color: "#fff",
    padding: 18,
    borderRadius: 22,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.16)",
    fontSize: 18,
    shadowColor: "#ff4d4d",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  glowButton: {
    width: "100%",
    backgroundColor: "rgba(88,88,88,0.34)",
    padding: 20,
    borderRadius: 22,
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#ff4d4d",
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  outlineGlowButton: {
    width: "100%",
    borderWidth: 1.4,
    borderColor: "rgba(255,255,255,0.18)",
    padding: 18,
    borderRadius: 22,
    alignItems: "center",
    marginTop: 12,
    backgroundColor: "rgba(70,70,70,0.28)",
    shadowColor: "#ff4d4d",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  dangerOutlineButton: {
    width: "100%",
    borderWidth: 1.4,
    borderColor: "rgba(255,255,255,0.18)",
    padding: 18,
    borderRadius: 22,
    alignItems: "center",
    marginTop: 12,
    backgroundColor: "#180b0b",
  },
  bigButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  secondaryButtonText: {
    color: "#fff",
    fontSize: 16,
  },
  panelCard: {
    width: "100%",
    backgroundColor: "rgba(20,20,20,0.50)",
    padding: 20,
    borderRadius: 26,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  panelButton: {
    width: "100%",
    backgroundColor: "rgba(20,20,20,0.50)",
    borderRadius: 26,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    shadowColor: "#ff4d4d",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  panelButtonActive: {
    borderColor: "rgba(255,255,255,0.16)",
    shadowColor: "#ff7a1a",
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  panelButtonTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
  },
  panelButtonSub: {
    color: "#8e8e8e",
    fontSize: 15,
    marginTop: 6,
  },
  cardTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  cardText: {
    color: "#ddd",
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
  },
  labelSmall: {
    color: "#9b9b9b",
    marginTop: 6,
  },
  value: {
    color: "#fff",
    fontSize: 16,
    marginBottom: 6,
  },
  qrWrap: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 24,
    marginBottom: 20,
  },
  quickServiceRow: {
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: 10,
    gap: 8,
  },
  quickServiceMain: {
    flex: 1,
    backgroundColor: "rgba(34,34,34,0.46)",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  quickServiceTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "bold",
  },
  quickServiceAmount: {
    color: "#ffb07a",
    fontSize: 14,
    marginTop: 6,
  },
  quickDeleteButton: {
    width: 58,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 22,
    backgroundColor: "rgba(70,70,70,0.30)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  quickDeleteText: {
    fontSize: 20,
    color: "#fff",
  },
  scanScreen: {
    flex: 1,
    backgroundColor: "transparent",
  },
  cameraWrap: {
    flex: 1,
    position: "relative",
  },
  scanHeader: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: "rgba(0,0,0,0.16)",
  },
  scanTitle: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
  },
  scanFooter: {
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.16)",
  },
  crosshairOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  crosshairHorizontal: {
    position: "absolute",
    width: "74%",
    height: 1.2,
    backgroundColor: "rgba(255,122,26,0.9)",
  },
  crosshairVertical: {
    position: "absolute",
    height: "58%",
    width: 1.2,
    backgroundColor: "rgba(255,77,77,0.9)",
  },
  crosshairDiagLeft: {
    position: "absolute",
    width: "70%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.42)",
    transform: [{ rotate: "34deg" }],
  },
  crosshairDiagRight: {
    position: "absolute",
    width: "70%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.42)",
    transform: [{ rotate: "-34deg" }],
  },
  poiHintWrap: {
    position: "absolute",
    bottom: 32,
    backgroundColor: "rgba(0,0,0,0.58)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,122,26,0.5)",
  },
  poiHintText: {
    color: "#fff",
    fontSize: 13,
  },
  dateRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  dateBox: {
    flex: 1,
  },
  readonlyBox: {
    width: "100%",
    backgroundColor: "#151515",
    borderWidth: 1.5,
    borderColor: "#5c2626",
    borderRadius: 22,
    padding: 18,
    minHeight: 64,
    justifyContent: "center",
  },
  readonlyText: {
    color: "#fff",
    fontSize: 18,
    textAlign: "center",
  },
  timerText: {
    color: "#fff",
    fontSize: 34,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 18,
  },
  homeFab: {
    position: "absolute",
    right: 18,
    bottom: 33,
    width: 58,
    minHeight: 58,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 22,
    backgroundColor: "rgba(70,70,70,0.30)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  homeFabIcon: {
    fontSize: 20,
    color: "#fff",
    lineHeight: 20,
    marginBottom: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    width: 260,
    backgroundColor: "#1a1a1a",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    shadowColor: "#ff4d4d",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
    letterSpacing: 1,
  },
  modalButton: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
  },
  modalButtonIcon: {
    fontSize: 22,
    marginRight: 14,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalCancelButton: {
    marginTop: 6,
    padding: 10,
  },
  modalCancelText: {
    color: "#888",
    fontSize: 14,
  },
  chatBubble: {
    maxWidth: "78%",
    padding: 12,
    borderRadius: 18,
    marginBottom: 8,
  },
  chatBubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(255,122,26,0.30)",
    borderWidth: 1,
    borderColor: "rgba(255,122,26,0.5)",
    borderBottomRightRadius: 4,
  },
  chatBubbleTheirs: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    borderBottomLeftRadius: 4,
  },
  chatText: {
    color: "#fff",
    fontSize: 15,
  },
  chatInvoiceText: {
    color: "#ffb07a",
    fontSize: 15,
    fontWeight: "600",
  },
  newCustomerButton: {
    width: 72,
    height: 72,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(40,40,40,0.60)",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "flex-end",
    marginBottom: 10,
    shadowColor: "#ff4d4d",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  newCustomerLabel: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginTop: 2,
  },
  newCustomerIconWrap: {
    fontSize: 28,
    lineHeight: 32,
  },
  homeFabText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    marginBottom: 16,
  },
  miniToggle: {
    flex: 1,
    borderWidth: 1.2,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 18,
    padding: 12,
    alignItems: "center",
    backgroundColor: "rgba(50,50,50,0.30)",
  },
  miniToggleActive: {
    borderColor: "rgba(255,122,26,0.8)",
    backgroundColor: "rgba(255,122,26,0.18)",
  },
  bigTextArea: {
    width: "100%",
    backgroundColor: "rgba(20,20,20,0.62)",
    color: "#fff",
    padding: 18,
    borderRadius: 22,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.16)",
    fontSize: 15,
    minHeight: 120,
  },
});

