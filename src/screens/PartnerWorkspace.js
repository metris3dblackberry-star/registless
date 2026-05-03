// ─────────────────────────────────────────────────────────────────
// PartnerWorkspace.js v2 — Az app szíve
// Olvasható timeline · Gyors chat · Üzletszagú pénzügyek
// ─────────────────────────────────────────────────────────────────
import React, { useState, useRef, useEffect } from "react";
import * as ImagePicker from "expo-image-picker";
// expo-document-picker — natív build szükséges, Expo Go-ban nem elérhető
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  KeyboardAvoidingView, Platform, StyleSheet, TextInput, Alert, Keyboard,
  Linking, Modal, Clipboard,
} from "react-native";
import { colors } from "../theme/colors";
import { shared } from "../theme/styles";
import { formatCurrency } from "../services/invoice";
import { useChat } from "../hooks/useChat";
import { getChannelId } from "../models/Contact";
import { ActivityType } from "../services/coordinator";
import { rtdb } from "../../firebase";

const TABS = [
  { id: "activity", label: "Aktivitás", icon: "📋" },
  { id: "chat",     label: "Üzenet",   icon: "💬" },
  { id: "schedule", label: "Időpontok", icon: "📅" },
  { id: "finance",  label: "Pénzügyek", icon: "💳" },
];

const ACTIVITY_ICONS = {
  [ActivityType.PARTNER_CREATED]:   { icon: "🤝", color: "#4CAF50" },
  [ActivityType.QR_CONNECT]:        { icon: "📱", color: "#2196F3" },
  [ActivityType.OCR_IMPORT]:        { icon: "🔍", color: "#9C27B0" },
  [ActivityType.MESSAGE_SENT]:      { icon: "💬", color: "#00BCD4" },
  [ActivityType.BOOKING_REQUEST]:   { icon: "📅", color: "#FF9800" },
  [ActivityType.BOOKING_ACCEPTED]:  { icon: "✅", color: "#4CAF50" },
  [ActivityType.SERVICE_STARTED]:   { icon: "⚡", color: "#FF9800" },
  [ActivityType.SERVICE_FINISHED]:  { icon: "🏁", color: "#4CAF50" },
  [ActivityType.INVOICE_ISSUED]:    { icon: "📄", color: "#FF5722" },
  [ActivityType.PAYMENT_REQUESTED]: { icon: "💳", color: "#E91E63" },
};

function formatRelativeTime(ts) {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (min < 1) return "most";
  if (min < 60) return `${min} perce`;
  if (hr < 24) return `${hr} órája`;
  if (day < 7) return `${day} napja`;
  return new Date(ts).toLocaleDateString("hu-HU");
}

export default function PartnerWorkspace({
  contact,
  myUid,
  partnerUid,
  myName = "",
  myRole = "seller",
  initialTab = "activity",
  onBack,
  onStartService,
  onNewBooking,
  onAcceptBooking,
  onIssueInvoice,
  onPayment,
  onSendPaymentReminder,
  onMessageSent,
  onInvoicePaid,
  onRemoveOpenItem,
}) {
  const [activeTab, setActiveTab] = useState(initialTab || "activity");
  const [msgText, setMsgText] = useState("");
  const [kbHeight, setKbHeight] = useState(0);
  const scrollRef = useRef(null);
  const tabScrollRef = useRef(null);
  const tabWidth = require('react-native').Dimensions.get('window').width;
  const TABS_ORDER = ["activity", "chat", "schedule", "finance"];

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  function handleTabSwipe(event) {
    const x = event.nativeEvent.contentOffset.x;
    const index = Math.round(x / tabWidth);
    const newTab = TABS_ORDER[index];
    if (newTab && newTab !== activeTab) {
      setActiveTab(newTab);
    }
  }

  function scrollToTab(tabId) {
    const index = TABS_ORDER.indexOf(tabId);
    if (index >= 0 && tabScrollRef.current) {
      tabScrollRef.current.scrollTo({ x: index * tabWidth, animated: true });
    }
  }

  // Channel mindig a két UID sort()-ja alapján — roletól független
  const channelId = getChannelId(myUid, partnerUid);
  const { messages, send, sending } = useChat(myUid, partnerUid, myName);

  if (!contact) return null;

  const activities = contact.activities || [];
  const appointments = contact.appointments || [];
  const invoices = contact.invoices || [];
  const openItems = contact.openItems || [];
  const calendar = contact.calendar || [];
  const financialSummary = contact.financialSummary || {};

  const totalInvoiced = invoices.reduce((s, i) => s + Number(i.bruttoOsszesen || 0), 0);
  const openAmount = openItems.reduce((s, i) => s + Number(i.brutto || i.amount || 0), 0);

  // ── Tab bar ───────────────────────────────────────────────────
  function renderTabBar() {
    const badges = {
      chat: messages.length,
      finance: openItems.length,
    };
    return (
      <View style={ws.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[ws.tab, activeTab === tab.id && ws.tabActive]}
            onPress={() => {
              setActiveTab(tab.id);
              scrollToTab(tab.id);
            }}
          >
            <Text style={ws.tabIcon}>{tab.icon}</Text>
            <Text style={[ws.tabText, activeTab === tab.id && ws.tabTextActive]}>
              {tab.label}
            </Text>
            {badges[tab.id] > 0 && (
              <View style={ws.badge}>
                <Text style={ws.badgeText}>{badges[tab.id]}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  // ── Aktivitás timeline ────────────────────────────────────────
  function renderActivity() {
    // Összefűzött, időrendbe rendezett esemény napló
    const allEvents = [
      // Kézzel naplózott activity-k
      ...activities.map((a) => ({
        ...a,
        _kind: "activity",
        ts: a.createdAt || 0,
      })),
      // Időpontok
      ...appointments.map((a) => ({
        id: a.id,
        _kind: "appointment",
        type: a.statusz === "elfogadott foglalás" ? ActivityType.BOOKING_ACCEPTED : ActivityType.BOOKING_REQUEST,
        text: `${a.serviceName || "Szolgáltatás"} — ${a.datum || ""} ${a.ido || ""}`,
        meta: { amount: a.amount },
        ts: a.createdAt || 0,
      })),
      // Számlák
      ...invoices.map((i) => ({
        id: i.id,
        _kind: "invoice",
        type: ActivityType.INVOICE_ISSUED,
        text: `Számla: ${i.id}`,
        meta: { amount: i.bruttoOsszesen },
        ts: i.createdAt || 0,
      })),
    ].sort((a, b) => (b.ts || 0) - (a.ts || 0));

    if (allEvents.length === 0) {
      return (
        <View style={[shared.card, { marginTop: 16, alignItems: "center", paddingVertical: 32 }]}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>🤝</Text>
          <Text style={[shared.value, { textAlign: "center" }]}>
            Még nincs aktivitás.{"\n"}Küldj üzenetet vagy indíts szolgáltatást!
          </Text>
        </View>
      );
    }

    return (
      <View style={{ width: "100%" }}>
        {myRole === "seller" && (
          <TouchableOpacity
            style={ws.centerServiceBtn}
            onPress={onStartService}
          >
            <Text style={ws.centerServiceBtnText}>⚡  Új szolgáltatás indítása</Text>
          </TouchableOpacity>
        )}
        {allEvents.map((event, idx) => {
          const config = ACTIVITY_ICONS[event.type] || { icon: "•", color: colors.textSecondary };
          return (
            <View key={event.id || idx} style={ws.timelineItem}>
              {/* Időtengely vonal */}
              <View style={ws.timelineLeft}>
                <View style={[ws.timelineDot, { backgroundColor: config.color }]}>
                  <Text style={ws.timelineDotIcon}>{config.icon}</Text>
                </View>
                {idx < allEvents.length - 1 && <View style={ws.timelineLine} />}
              </View>
              {/* Tartalom */}
              <View style={ws.timelineContent}>
                <Text style={ws.timelineText}>{event.text}</Text>
                {event.meta?.amount > 0 && (
                  <Text style={[ws.timelineSub, { color: colors.accent }]}>
                    {formatCurrency(event.meta.amount)}
                  </Text>
                )}
                <Text style={ws.timelineTime}>{formatRelativeTime(event.ts)}</Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  // ── Üzenet tab ────────────────────────────────────────────────
  const [selectedMsg, setSelectedMsg] = useState(null);

  function handleLongPress(msg) {
    setSelectedMsg(msg);
  }

  const [editingMsg, setEditingMsg] = useState(null);
  const [editText, setEditText] = useState("");

  function handleMsgAction(action, msg) {
    setSelectedMsg(null);
    if (action === "copy") {
      if (msg.type === "image") { Alert.alert("ℹ️", "Kép nem másolható szövegként."); return; }
      Clipboard.setString(msg.text || "");
      Alert.alert("✅ Másolva", "Üzenet a vágólapon.");
    } else if (action === "edit") {
      if (msg.type === "image") { Alert.alert("ℹ️", "Kép nem módosítható."); return; }
      setEditText(msg.text || "");
      setEditingMsg(msg);
      return;
    } else if (action === "delete") {
      Alert.alert("Törlés", "Biztosan törlöd ezt az üzenetet?", [
        { text: "Mégse", style: "cancel" },
        { text: "Törlés", style: "destructive", onPress: () => {
          try {
            const chatId = [myUid, partnerUid].sort().join("_");
            rtdb.ref(`chats/${chatId}/messages/${msg.id}`).remove();
          } catch(e) { console.warn("Törlési hiba:", e.message); }
        }},
      ]);
    }
  }

  function renderTextWithLinks(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return (
      <Text style={ws.bubbleText}>
        {parts.map((part, i) =>
          urlRegex.test(part) ? (
            <Text
              key={i}
              style={{ color: "#4fc3f7", textDecorationLine: "underline" }}
              onPress={() => Linking.openURL(part).catch(() => {})}
            >
              {part}
            </Text>
          ) : (
            <Text key={i}>{part}</Text>
          )
        )}
      </Text>
    );
  }

  function renderChat() {
    if (!myUid || !partnerUid) {
      return (
        <View style={[shared.card, { marginTop: 16, alignItems: "center", paddingVertical: 24, marginHorizontal: 16 }]}>
          <Text style={{ fontSize: 32, marginBottom: 12 }}>📡</Text>
          <Text style={[shared.value, { textAlign: "center" }]}>
            Nincs felhős kapcsolat ezzel a partnerrel.{"\n"}
            Olvass be új QR kódot a kapcsolódáshoz.
          </Text>
        </View>
      );
    }

    return (
      <>
        {/* Hosszú nyomás modal */}
        <Modal visible={!!selectedMsg} transparent animationType="fade" onRequestClose={() => setSelectedMsg(null)}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" }}
            onPress={() => setSelectedMsg(null)}
          >
            <View style={{ backgroundColor: "#1a1a1a", borderRadius: 20, padding: 8, width: 240, borderWidth: 1, borderColor: "#333" }}>
              <Text style={{ color: "#888", fontSize: 12, textAlign: "center", padding: 8, marginBottom: 4 }}>
                {selectedMsg?.text?.substring(0, 40)}{selectedMsg?.text?.length > 40 ? "..." : ""}
              </Text>
              {[
                { icon: "📋", label: "Másolás", action: "copy" },
                { icon: "✏️", label: "Módosítás", action: "edit" },
                { icon: "🗑️", label: "Törlés", action: "delete" },
              ].map((item) => (
                <TouchableOpacity
                  key={item.action}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12 }}
                  onPress={() => handleMsgAction(item.action, selectedMsg)}
                >
                  <Text style={{ fontSize: 20 }}>{item.icon}</Text>
                  <Text style={{ color: item.action === "delete" ? "#f44336" : "#fff", fontSize: 16 }}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Módosítás modal */}
        <Modal visible={!!editingMsg} transparent animationType="slide" onRequestClose={() => setEditingMsg(null)}>
          <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={0}
          >
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setEditingMsg(null)} activeOpacity={1} />
            <View style={{ backgroundColor: "#1a1a1a", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, borderWidth: 1, borderColor: "#333" }}>
              <Text style={{ color: "#888", fontSize: 13, marginBottom: 12 }}>Üzenet módosítása</Text>
              <TextInput
                style={{ backgroundColor: "#111", borderRadius: 12, padding: 12, color: "#fff", fontSize: 15, borderWidth: 1, borderColor: "#333", marginBottom: 12, minHeight: 60 }}
                value={editText}
                onChangeText={setEditText}
                multiline
                autoFocus
              />
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 8 }}>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: "rgba(45,45,45,0.92)", borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.10)" }}
                  onPress={() => setEditingMsg(null)}
                >
                  <Text style={{ color: "#888" }}>Mégse</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: "rgba(255,122,26,0.2)", borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,122,26,0.4)" }}
                  onPress={async () => {
                    if (!editingMsg || !editText.trim()) return;
                    const _chatId = [myUid, partnerUid].sort().join("_");
                    try {
                      await rtdb.ref(`chats/${_chatId}/messages/${editingMsg.id}`).update({ text: editText.trim(), edited: true, timestamp: Date.now() });
                    } catch(e) {
                      Alert.alert("Hiba", "Nem sikerült menteni: " + e.message);
                      return;
                    }
                    // Popup bezárása MENTÉS után
                    setEditingMsg(null);
                    setEditText("");
                  }}
                >
                  <Text style={{ color: "#ff7a1a", fontWeight: "bold" }}>Mentés</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1, width: "100%" }}
          contentContainerStyle={{ padding: 8, flexGrow: 1, paddingBottom: 16 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 ? (
            <View style={[shared.card, { marginTop: 16, alignItems: "center" }]}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>💬</Text>
              <Text style={[shared.value, { textAlign: "center" }]}>
                Még nincs üzenet. Írj az első üzenetet!
              </Text>
            </View>
          ) : (
            messages.map((msg) => {
              const isMine = (msg.senderUid === myUid) || (msg.senderId === myUid);
              return (
                <TouchableOpacity
                  key={msg.id}
                  style={{ width: "100%", marginBottom: 8, alignItems: isMine ? "flex-end" : "flex-start" }}
                  onLongPress={() => handleLongPress(msg)}
                  delayLongPress={400}
                  activeOpacity={0.8}
                >
                  <Text style={[ws.msgLabel, { textAlign: isMine ? "right" : "left" }]}>
                    {isMine ? "ÉN" : contact.name}
                  </Text>
                  <View style={[ws.bubble, isMine ? ws.bubbleMine : ws.bubbleTheirs]}>
                    {msg.type === "image" ? (
                      msg.text ? (
                        <Image
                          source={{ uri: msg.text }}
                          style={{ width: 200, height: 200, borderRadius: 12 }}
                          resizeMode="cover"
                        />
                      ) : (
                        <Text style={[ws.bubbleText, { color: "#888" }]}>🖼️ Kép nem tölthető be</Text>
                      )
                    ) : msg.type === "invoice" ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={{ fontSize: 20 }}>📄</Text>
                        <Text style={[ws.bubbleText, { color: colors.accent }]}>{msg.text}</Text>
                      </View>
                    ) : (
                      renderTextWithLinks(msg.text || "")
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </>
    );
  }

  // ── Időpontok tab ─────────────────────────────────────────────
  function renderSchedule() {
    const allAppts = myRole === "seller" ? appointments : calendar;

    return (
      <View style={{ width: "100%" }}>
        {myRole === "buyer" && (
          <TouchableOpacity style={[shared.btnPrimary, { marginBottom: 16 }]} onPress={onNewBooking}>
            <Text style={shared.btnTextPrimary}>📅  Időpont kérése</Text>
          </TouchableOpacity>
        )}

        {/* Vevő módban: eladó által kiállított számlák */}
        {myRole === "buyer" && invoices.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={[shared.label, { marginBottom: 8 }]}>📄 Számláim</Text>
            {invoices.map((inv) => (
              <View key={inv.id} style={[shared.card, { marginBottom: 8, borderColor: inv.statusz === "PAID" ? "rgba(76,175,80,0.4)" : colors.borderSubtle }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[shared.value, { fontWeight: "bold" }]}>{inv.id}</Text>
                    <Text style={shared.labelSmall}>{inv.datum}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text style={[shared.value, { color: colors.accent, fontWeight: "bold" }]}>
                      {formatCurrency(inv.bruttoOsszesen || 0)}
                    </Text>
                    {inv.statusz === "PAID" ? (
                      <View style={{ backgroundColor: "rgba(76,175,80,0.2)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: "rgba(76,175,80,0.4)" }}>
                        <Text style={{ color: "#4CAF50", fontSize: 11, fontWeight: "bold" }}>✓ FIZETVE</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={{ backgroundColor: "rgba(255,122,26,0.15)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: colors.accentBorder }}
                        onPress={() => onPayment?.(inv.id)}
                      >
                        <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "bold" }}>💳 Fizetés</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Booking kérelmek elfogadása - seller oldalon */}
        {myRole === "seller" && (contact.bookingRequests || []).filter(r => r.statusz === "függőben").length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={[shared.label, { marginBottom: 8, color: "#FF9800" }]}>⏳ Függő kérelmek</Text>
            {(contact.bookingRequests || []).filter(r => r.statusz === "függőben").map((req) => (
              <View key={req.id} style={[shared.card, { borderColor: "rgba(255,152,0,0.4)" }]}>
                <Text style={shared.value}>{req.serviceName}</Text>
                <Text style={shared.labelSmall}>{req.datum} {req.ido}</Text>
                <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: "rgba(76,175,80,0.2)", borderRadius: 12, padding: 10, alignItems: "center", borderWidth: 1, borderColor: "rgba(76,175,80,0.4)" }}
                    onPress={() => onAcceptBooking?.(req)}
                  >
                    <Text style={{ color: "#4CAF50", fontWeight: "bold" }}>✓ Elfogad</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: "rgba(244,67,54,0.1)", borderRadius: 12, padding: 10, alignItems: "center", borderWidth: 1, borderColor: "rgba(244,67,54,0.3)" }}
                    onPress={() => {}}
                  >
                    <Text style={{ color: "#f44336", fontWeight: "bold" }}>✕ Elutasít</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {allAppts.length === 0 ? (
          <View style={[shared.card, { alignItems: "center", paddingVertical: 24 }]}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>📅</Text>
            <Text style={[shared.value, { textAlign: "center" }]}>Még nincs időpont.</Text>
          </View>
        ) : (
          allAppts.map((appt) => (
            <View key={appt.id} style={[shared.card, { marginBottom: 8 }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={[shared.value, { fontWeight: "bold", fontSize: 17 }]}>
                    {appt.serviceName || "Szolgáltatás"}
                  </Text>
                  <Text style={[shared.labelSmall, { marginTop: 4 }]}>
                    📅 {appt.datum || ""}{appt.napNev ? ` · ${appt.napNev}` : ""}
                    {appt.ido ? ` · ${appt.ido}` : ""}
                  </Text>
                </View>
                <View style={[ws.statusBadge, {
                  backgroundColor: appt.statusz === "elfogadott foglalás" || appt.statusz === "elfogadva"
                    ? "rgba(76,175,80,0.2)" : "rgba(255,152,0,0.2)",
                }]}>
                  <Text style={[ws.statusText, {
                    color: appt.statusz === "elfogadott foglalás" || appt.statusz === "elfogadva"
                      ? "#4CAF50" : "#FF9800",
                  }]}>
                    {appt.statusz === "elfogadott foglalás" || appt.statusz === "elfogadva" ? "✓" : "⏳"}
                    {" "}{appt.statusz || ""}
                  </Text>
                </View>
              </View>
              {appt.amount > 0 && (
                <Text style={[shared.labelSmall, { marginTop: 8, color: colors.accent }]}>
                  {formatCurrency(appt.amount)}
                </Text>
              )}
            </View>
          ))
        )}
      </View>
    );
  }

  // ── Pénzügyek tab — üzletszagú és tiszta ─────────────────────
  function renderFinance() {
    return (
      <View style={{ width: "100%" }}>
        {/* Összesítő kártya */}
        <View style={ws.financeSummary}>
          <View style={ws.financeStatItem}>
            <Text style={ws.financeStatValue}>{formatCurrency(totalInvoiced)}</Text>
            <Text style={ws.financeStatLabel}>Összes számlázott</Text>
          </View>
          <View style={ws.financeStatDivider} />
          <View style={ws.financeStatItem}>
            <Text style={[ws.financeStatValue, openAmount > 0 && { color: colors.accent }]}>
              {formatCurrency(openAmount)}
            </Text>
            <Text style={ws.financeStatLabel}>Nyitott tétel</Text>
          </View>
          <View style={ws.financeStatDivider} />
          <View style={ws.financeStatItem}>
            <Text style={ws.financeStatValue}>{invoices.length}</Text>
            <Text style={ws.financeStatLabel}>Számla</Text>
          </View>
        </View>

        {/* Akció gombok */}
        {myRole === "seller" && (
          <View style={{ gap: 10, marginBottom: 16 }}>
            {openItems.length > 0 && (
              <TouchableOpacity style={shared.btnPrimary} onPress={onIssueInvoice}>
                <Text style={shared.btnTextPrimary}>
                  📄  Gyűjtőszámla kiállítása ({openItems.length} tétel · {formatCurrency(openAmount)})
                </Text>
              </TouchableOpacity>
            )}
            {myRole === "buyer" ? (
              <TouchableOpacity style={shared.btnOutline} onPress={() => onPayment?.()}>
                <Text style={shared.btnTextSecondary}>💳  Fizetési kérés küldése</Text>
              </TouchableOpacity>
            ) : (
              invoices.filter(i => i.statusz !== "PAID").length > 0 ? (
                <TouchableOpacity
                  style={{ backgroundColor: "rgba(255,122,26,0.1)", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "rgba(255,122,26,0.4)", alignItems: "center" }}
                  onPress={() => onSendPaymentReminder?.(invoices.filter(i => i.statusz !== "PAID"))}
                >
                  <Text style={{ color: "#ff7a1a", fontSize: 14, fontWeight: "700" }}>
                    📨  Fizetési emlékeztető küldése
                  </Text>
                  <Text style={{ color: "#888", fontSize: 12, marginTop: 3 }}>
                    {formatCurrency(invoices.filter(i => i.statusz !== "PAID").reduce((s,i) => s + Number(i.bruttoOsszesen||0), 0))} · Registless üzenet
                  </Text>
                </TouchableOpacity>
              ) : openAmount > 0 ? (
                <TouchableOpacity
                  style={{ backgroundColor: "rgba(255,122,26,0.1)", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "rgba(255,122,26,0.4)", alignItems: "center" }}
                  onPress={() => onSendPaymentReminder?.([])}
                >
                  <Text style={{ color: "#ff7a1a", fontSize: 14, fontWeight: "700" }}>
                    📨  Fizetési emlékeztető küldése
                  </Text>
                  <Text style={{ color: "#888", fontSize: 12, marginTop: 3 }}>
                    {formatCurrency(openAmount)} · Registless üzenet
                  </Text>
                </TouchableOpacity>
              ) : null
            )}
          </View>
        )}

        {/* Nyitott tételek */}
        {openItems.length > 0 && (
          <>
            <Text style={[shared.label, { marginBottom: 8 }]}>Számlázatlan tételek</Text>
            {openItems.map((oi) => (
              <View key={oi.id || oi.appointmentId} style={[shared.card, { marginBottom: 8, flexDirection: "row", alignItems: "center" }]}>
                <View style={{ flex: 1 }}>
                  <Text style={shared.value}>{oi.serviceName || "Szolgáltatás"}</Text>
                  <Text style={shared.labelSmall}>{oi.datum || ""} {oi.ido || ""}</Text>
                </View>
                <Text style={[shared.value, { color: colors.accent, fontWeight: "bold", marginRight: 8 }]}>
                  {formatCurrency(oi.brutto || oi.amount || 0)}
                </Text>
                <TouchableOpacity
                  style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,50,50,0.15)", borderWidth: 1, borderColor: "rgba(255,50,50,0.3)", justifyContent: "center", alignItems: "center" }}
                  onPress={() => Alert.alert(
                    "Tétel törlése",
                    `Biztosan törlöd: ${oi.serviceName}?`,
                    [
                      { text: "Nem", style: "cancel" },
                      { text: "Törlöm", style: "destructive", onPress: () => onRemoveOpenItem?.(oi.id) },
                    ]
                  )}
                >
                  <Text style={{ fontSize: 14 }}>🗑</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {/* Számla lista */}
        {invoices.length > 0 && (
          <>
            <Text style={[shared.label, { marginBottom: 8, marginTop: 8 }]}>Kiállított számlák</Text>
            {invoices.map((inv) => (
              <View key={inv.id} style={[shared.card, { marginBottom: 8, borderColor: inv.statusz === "PAID" ? "rgba(76,175,80,0.4)" : colors.borderSubtle }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[shared.value, { fontWeight: "bold" }]}>{inv.id}</Text>
                    <Text style={shared.labelSmall}>{inv.datum}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text style={[shared.value, { color: colors.accent, fontWeight: "bold", fontSize: 16 }]}>
                      {formatCurrency(inv.bruttoOsszesen || 0)}
                    </Text>
                    {inv.statusz === "PAID" ? (
                      <View style={{ backgroundColor: "rgba(76,175,80,0.2)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: "rgba(76,175,80,0.4)" }}>
                        <Text style={{ color: "#4CAF50", fontSize: 11, fontWeight: "bold" }}>✓ FIZETVE</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={{ backgroundColor: "rgba(255,122,26,0.15)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: colors.accentBorder }}
                        onPress={() => onSendPaymentReminder?.([inv])}
                      >
                        <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "bold" }}>📨 Emlékeztető</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </>
        )}

        {invoices.length === 0 && openItems.length === 0 && (
          <View style={[shared.card, { alignItems: "center", paddingVertical: 24 }]}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>💳</Text>
            <Text style={[shared.value, { textAlign: "center" }]}>
              Még nincs pénzügyi esemény.
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={ws.root}
      behavior={Platform.OS === "ios" ? "padding" : "padding"}
      keyboardVerticalOffset={Platform.OS === "android" ? 0 : 0}
    >
      {/* Header */}
      <View style={ws.header}>
        <View style={ws.headerInfo}>
          <View style={ws.avatar}>
            <Text style={ws.avatarText}>{(contact.name || "?")[0].toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ws.headerName} numberOfLines={1}>{contact.name || "Partner"}</Text>
            {!!contact.company && (
              <Text style={ws.headerCompany} numberOfLines={1}>{contact.company}</Text>
            )}
          </View>
          {/* Kapcsolat indikátorok */}
          <View style={{ flexDirection: "row", gap: 4 }}>
            {contact.channels?.chat && <Text style={ws.channelBadge}>💬</Text>}
            {contact.channels?.qr && <Text style={ws.channelBadge}>📱</Text>}
          </View>
        </View>
      </View>

      {renderTabBar()}

      {/* Tab content - swipe-able */}
      <ScrollView
        ref={tabScrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleTabSwipe}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, width: "100%" }}
      >
        {/* Aktivitás */}
        <ScrollView
          style={{ width: tabWidth, flex: 1 }}
          contentContainerStyle={{ paddingBottom: 100, paddingTop: 8, paddingHorizontal: 16 }}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {renderActivity()}
        </ScrollView>

        {/* Üzenet */}
        <View style={{ width: tabWidth, flex: 1 }}>
          {renderChat()}
        </View>

        {/* Időpontok */}
        <ScrollView
          style={{ width: tabWidth, flex: 1 }}
          contentContainerStyle={{ paddingBottom: 100, paddingTop: 8, paddingHorizontal: 16 }}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {renderSchedule()}
        </ScrollView>

        {/* Pénzügyek */}
        <ScrollView
          style={{ width: tabWidth, flex: 1 }}
          contentContainerStyle={{ paddingBottom: 100, paddingTop: 8, paddingHorizontal: 16 }}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {renderFinance()}
        </ScrollView>
      </ScrollView>

      {/* Chat input sor — back + kép + input + küldés egyben */}
      {activeTab === "chat" && myUid && partnerUid ? (
        <View style={[ws.chatInputRow, { paddingBottom: Platform.OS === "android" ? 42 : 10 }]}>
          {/* Back gomb */}
          <TouchableOpacity style={ws.chatBackBtn} onPress={onBack}>
            <Image
              source={require("../../assets/backbutton.png")}
              style={{ width: 28, height: 28, resizeMode: "contain" }}
            />
          </TouchableOpacity>

          {/* Kép ikon */}
          <TouchableOpacity
            style={ws.attachBtn}
            onPress={async () => {
              const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!perm.granted) { Alert.alert("Engedély szükséges"); return; }
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.5,
                base64: true,
              });
              if (!result.canceled && result.assets?.length) {
                const asset = result.assets[0];
                const ext = asset.uri.split('.').pop()?.toLowerCase() || "jpeg";
                const mime = ext === "png" ? "image/png" : "image/jpeg";
                const dataUri = `data:${mime};base64,${asset.base64}`;
                send(dataUri, "image");
              }
            }}
          >
            <Text style={ws.attachIcon}>🖼️</Text>
          </TouchableOpacity>

          {/* Szöveg input */}
          <TextInput
            style={ws.chatInput}
            value={msgText}
            onChangeText={setMsgText}
            placeholder="Írj üzenetet..."
            placeholderTextColor={colors.placeholder}
            returnKeyType="send"
            multiline={false}
            onSubmitEditing={() => { if (msgText.trim()) { send(msgText); onMessageSent?.(msgText); setMsgText(""); } }}
            blurOnSubmit={false}
          />

          {/* Küldés gomb */}
          <TouchableOpacity
            style={[ws.sendBtn, (sending || !msgText.trim()) && { opacity: 0.4 }]}
            disabled={sending || !msgText.trim()}
            onPress={() => { if (msgText.trim()) { send(msgText); onMessageSent?.(msgText); setMsgText(""); } }}
          >
            <Text style={ws.sendIcon}>➤</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Más tabokon: csak a back gomb lebeg */
        <TouchableOpacity style={ws.floatingBack} onPress={onBack}>
          <Image
            source={require("../../assets/backbutton.png")}
            style={{ width: 32, height: 32, resizeMode: "contain" }}
          />
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
  );
}

const ws = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, alignItems: "center", width: "100%" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    gap: 8,
  },
  backBtn: { display: "none" },
  backIcon: { display: "none" },
  headerInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.accentSoft,
    borderWidth: 1, borderColor: colors.accentBorder,
    justifyContent: "center", alignItems: "center",
  },
  avatarText: { color: colors.accent, fontSize: 16, fontWeight: "bold" },
  headerName: { color: colors.textPrimary, fontSize: 17, fontWeight: "bold" },
  headerCompany: { color: colors.textSecondary, fontSize: 12, marginTop: 1 },
  channelBadge: { fontSize: 14 },
  startBtn: {
    backgroundColor: colors.accentSoft,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.accentBorder,
    marginRight: 4,
  },
  startBtnText: { fontSize: 22 },
  tabBar: {
    flexDirection: "row", width: "100%",
    borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
    marginTop: 4,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", position: "relative" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.accent },
  tabIcon: { fontSize: 14, marginBottom: 2 },
  tabText: { color: colors.textSecondary, fontSize: 11 },
  tabTextActive: { color: colors.accent, fontWeight: "bold" },
  badge: {
    position: "absolute", top: 4, right: 8,
    backgroundColor: colors.danger, borderRadius: 8,
    minWidth: 16, height: 16, justifyContent: "center", alignItems: "center",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  // Timeline
  timelineItem: { flexDirection: "row", marginBottom: 4, paddingVertical: 4 },
  timelineLeft: { width: 36, alignItems: "center" },
  timelineDot: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: "center", alignItems: "center",
  },
  timelineDotIcon: { fontSize: 14 },
  timelineLine: { width: 2, flex: 1, backgroundColor: colors.borderSubtle, marginVertical: 2 },
  timelineContent: { flex: 1, paddingLeft: 12, paddingBottom: 12 },
  timelineText: { color: colors.textPrimary, fontSize: 14, fontWeight: "500" },
  timelineSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  timelineTime: { color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 4 },
  // Chat
  msgLabel: { color: "rgba(255,255,255,0.4)", fontSize: 10, marginBottom: 2, paddingHorizontal: 4 },
  bubble: { maxWidth: "78%", padding: 12, borderRadius: 18, marginBottom: 2 },
  bubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: colors.chatMine,
    borderWidth: 1, borderColor: colors.accentBorder,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(45,45,45,0.92)",
    borderWidth: 1, borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { color: colors.textPrimary, fontSize: 15 },
  chatInputRow: {
    flexDirection: "row", width: "100%", gap: 8,
    alignItems: "center",
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: "rgba(10,10,10,0.95)",
    zIndex: 10,
  },
  chatBackBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(30,30,30,0.92)",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.2)",
    justifyContent: "center", alignItems: "center",
  },
  chatInput: {
    flex: 1, backgroundColor: colors.bgInput,
    color: colors.textPrimary, padding: 14,
    borderRadius: 18, borderWidth: 1.5, borderColor: colors.border, fontSize: 15,
  },
  sendBtn: {
    width: 52, height: 52, borderRadius: 18,
    backgroundColor: colors.accentSoft,
    borderWidth: 1, borderColor: colors.accentBorder,
    justifyContent: "center", alignItems: "center",
  },
  sendIcon: { color: colors.textPrimary, fontSize: 20 },
  attachBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(45,45,45,0.92)",
    justifyContent: "center", alignItems: "center",
  },
  attachIcon: { fontSize: 18 },
  attachColumn: {
    position: "absolute",
    left: 84,
    bottom: 56,
    flexDirection: "column",
    zIndex: 201,
  },
  floatingBack: {
    position: "absolute",
    left: 20,
    bottom: 48,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(30,30,30,0.92)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 20,
    zIndex: 200,
  },
  floatingBackText: { color: "#fff", fontSize: 22, fontWeight: "bold" },
  centerServiceBtn: {
    width: "92%",
    backgroundColor: "rgba(255,122,26,0.18)",
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,122,26,0.5)",
    marginTop: 10,
    marginBottom: 4,
  },
  centerServiceBtnText: { color: "#ff7a1a", fontSize: 15, fontWeight: "bold" },
  // Appointments
  statusBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: "600" },
  // Finance
  financeSummary: {
    flexDirection: "row",
    backgroundColor: colors.bgCard,
    borderRadius: 20, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  financeStatItem: { flex: 1, alignItems: "center" },
  financeStatValue: { color: colors.textPrimary, fontSize: 16, fontWeight: "bold", textAlign: "center" },
  financeStatLabel: { color: colors.textSecondary, fontSize: 11, marginTop: 4, textAlign: "center" },
  financeStatDivider: { width: 1, backgroundColor: colors.borderSubtle, marginHorizontal: 8 },
});
