// ─────────────────────────────────────────────────────────────────
// FinanceScreen.js — Pénzügyi dashboard
// Bevétel / Kiadás / Profit / Kintlévőség + trend + top partnerek
// ─────────────────────────────────────────────────────────────────
import React, { useMemo, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, Alert,
} from "react-native";
import { colors } from "../theme/colors";
import { formatCurrency } from "../services/invoice";

const PERIODS = [
  { id: "today", label: "Ma" },
  { id: "week",  label: "Hét" },
  { id: "month", label: "Hónap" },
  { id: "year",  label: "Év" },
];

const EXPENSE_CATEGORIES = [
  { id: "supplies", label: "Anyag/Eszköz", icon: "📦" },
  { id: "rent",     label: "Bérleti díj",   icon: "🏢" },
  { id: "fuel",     label: "Üzemanyag",     icon: "⛽" },
  { id: "marketing",label: "Marketing",     icon: "📢" },
  { id: "service",  label: "Szolgáltatás",  icon: "🛠️" },
  { id: "tax",      label: "Adó/Járulék",   icon: "🧾" },
  { id: "other",    label: "Egyéb",         icon: "📌" },
];

// ── Időszak helper-ek ────────────────────────────────────────────
function periodRange(period) {
  const now = new Date();
  const end = now.getTime();
  let start;
  if (period === "today") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  } else if (period === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    start = d.getTime();
  } else if (period === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  } else { // year
    start = new Date(now.getFullYear(), 0, 1).getTime();
  }
  return { start, end };
}

function inRange(ts, start, end) {
  if (!ts) return false;
  return ts >= start && ts <= end;
}

// Bar chart (egyszerű, View-alapú)
function BarChart({ data, height = 120 }) {
  const max = Math.max(1, ...data.map(d => Math.max(d.income, d.expense)));
  return (
    <View style={chart.wrap}>
      <View style={[chart.row, { height }]}>
        {data.map((d, i) => (
          <View key={i} style={chart.col}>
            <View style={chart.barStack}>
              <View style={[chart.barIncome, {
                height: (d.income / max) * (height - 18),
              }]} />
              <View style={[chart.barExpense, {
                height: (d.expense / max) * (height - 18),
              }]} />
            </View>
            <Text style={chart.label}>{d.label}</Text>
          </View>
        ))}
      </View>
      <View style={chart.legend}>
        <View style={[chart.legendDot, { backgroundColor: "#4CAF50" }]} />
        <Text style={chart.legendText}>Bevétel</Text>
        <View style={[chart.legendDot, { backgroundColor: "#F44336", marginLeft: 14 }]} />
        <Text style={chart.legendText}>Kiadás</Text>
      </View>
    </View>
  );
}

const chart = StyleSheet.create({
  wrap:   { backgroundColor: "rgba(45,45,45,0.85)", borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.08)" },
  row:    { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 6 },
  col:    { flex: 1, alignItems: "center" },
  barStack:   { flexDirection: "row", alignItems: "flex-end", gap: 2, height: "100%" },
  barIncome:  { width: 9, backgroundColor: "#4CAF50", borderRadius: 3 },
  barExpense: { width: 9, backgroundColor: "#F44336", borderRadius: 3 },
  label:  { color: "#888", fontSize: 9, marginTop: 6 },
  legend: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  legendDot:  { width: 8, height: 8, borderRadius: 2 },
  legendText: { color: "#aaa", fontSize: 11, marginLeft: 5 },
});

export default function FinanceScreen({
  contacts = [],
  expenses = [],
  onAddExpense,
  onDeleteExpense,
  onBack,
  onPartner,
}) {
  const [period, setPeriod]               = useState("month");
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [newExpAmount, setNewExpAmount]   = useState("");
  const [newExpCategory, setNewExpCategory] = useState("supplies");
  const [newExpNote, setNewExpNote]       = useState("");

  // ── Aggregátorok ─────────────────────────────────────────────
  const stats = useMemo(() => {
    const { start, end } = periodRange(period);
    let income = 0, paidIncome = 0, openReceivable = 0, expectedRevenue = 0;
    const partnerRevenue = {};
    const aging = { d0_30: 0, d30_60: 0, d60p: 0 };
    const NOW = Date.now();

    contacts.forEach(c => {
      (c.invoices || []).forEach(inv => {
        const amt = Number(inv.bruttoOsszesen || 0);
        const ts  = inv.createdAt || inv.kibocsajtas || 0;
        if (inv.statusz === "PAID") {
          if (inRange(ts, start, end)) {
            income += amt;
            paidIncome += amt;
            partnerRevenue[c.id] = (partnerRevenue[c.id] || 0) + amt;
          }
        } else {
          openReceivable += amt;
          // Aging
          const ageDays = ts ? (NOW - ts) / (1000 * 60 * 60 * 24) : 0;
          if (ageDays <= 30)      aging.d0_30  += amt;
          else if (ageDays <= 60) aging.d30_60 += amt;
          else                     aging.d60p   += amt;
        }
      });
      (c.openItems || []).forEach(item => {
        expectedRevenue += Number(item.brutto || item.amount || 0);
      });
    });

    const expensesPeriod = expenses.filter(e => inRange(e.createdAt, start, end));
    const expenseTotal   = expensesPeriod.reduce((s, e) => s + Number(e.amount || 0), 0);

    const topPartners = Object.entries(partnerRevenue)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cid, amt]) => ({
        contact: contacts.find(c => c.id === cid),
        amount: amt,
      }))
      .filter(p => p.contact);

    // Trend: utolsó 6 hónap havi bevétel/kiadás
    const trend = [];
    const monthNames = ["Jan","Feb","Már","Ápr","Máj","Jún","Júl","Aug","Sze","Okt","Nov","Dec"];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i, 1);
      const ms = d.getTime();
      const me = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
      let inc = 0, exp = 0;
      contacts.forEach(c => (c.invoices || []).forEach(inv => {
        const ts  = inv.createdAt || inv.kibocsajtas || 0;
        if (inv.statusz === "PAID" && inRange(ts, ms, me)) inc += Number(inv.bruttoOsszesen || 0);
      }));
      expenses.forEach(e => { if (inRange(e.createdAt, ms, me)) exp += Number(e.amount || 0); });
      trend.push({ label: monthNames[d.getMonth()], income: inc, expense: exp });
    }

    return {
      income, expenseTotal, profit: income - expenseTotal,
      openReceivable, expectedRevenue, paidIncome,
      topPartners, aging, trend, expensesPeriod,
    };
  }, [contacts, expenses, period]);

  // ── Új kiadás mentése ─────────────────────────────────────────
  function handleSaveExpense() {
    const amt = Number(newExpAmount.replace(/\s/g, "").replace(",", "."));
    if (!amt || amt <= 0) {
      Alert.alert("Hibás összeg", "Adj meg egy pozitív kiadást.");
      return;
    }
    const cat = EXPENSE_CATEGORIES.find(c => c.id === newExpCategory);
    onAddExpense?.({
      id: `exp-${Date.now()}`,
      amount: amt,
      category: newExpCategory,
      categoryLabel: cat?.label || "Egyéb",
      categoryIcon: cat?.icon || "📌",
      note: newExpNote.trim(),
      createdAt: Date.now(),
    });
    setNewExpAmount("");
    setNewExpNote("");
    setNewExpCategory("supplies");
    setShowExpenseModal(false);
  }

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140, paddingTop: 52, paddingHorizontal: 18 }}>

        {/* Header */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.title}>💰 Pénzügyek</Text>
            <Text style={s.subtitle}>{periodLabel(period)}</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={() => setShowExpenseModal(true)}>
            <Text style={s.addBtnIcon}>+</Text>
            <Text style={s.addBtnLabel}>Kiadás</Text>
          </TouchableOpacity>
        </View>

        {/* Időszak tabok */}
        <View style={s.periodRow}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[s.periodPill, period === p.id && s.periodPillActive]}
              onPress={() => setPeriod(p.id)}
            >
              <Text style={[s.periodLabel, period === p.id && s.periodLabelActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Top stat-ok 2x2 */}
        <View style={s.statsGrid}>
          <View style={[s.statBox, { borderColor: "rgba(76,175,80,0.4)" }]}>
            <Text style={s.statLabel}>Bevétel</Text>
            <Text style={[s.statValue, { color: "#4CAF50" }]}>{formatCurrency(stats.income)}</Text>
          </View>
          <View style={[s.statBox, { borderColor: "rgba(244,67,54,0.4)" }]}>
            <Text style={s.statLabel}>Kiadás</Text>
            <Text style={[s.statValue, { color: "#F44336" }]}>{formatCurrency(stats.expenseTotal)}</Text>
          </View>
          <View style={[s.statBox, { borderColor: stats.profit >= 0 ? "rgba(229,90,30,0.4)" : "rgba(244,67,54,0.4)" }]}>
            <Text style={s.statLabel}>Profit</Text>
            <Text style={[s.statValue, { color: stats.profit >= 0 ? "#e55a1e" : "#F44336" }]}>
              {formatCurrency(stats.profit)}
            </Text>
          </View>
          <View style={[s.statBox, { borderColor: "rgba(255,152,0,0.4)" }]}>
            <Text style={s.statLabel}>Kintlévőség</Text>
            <Text style={[s.statValue, { color: "#FF9800" }]}>{formatCurrency(stats.openReceivable)}</Text>
          </View>
        </View>

        {/* Várható bevétel (openItems) */}
        {stats.expectedRevenue > 0 && (
          <View style={s.hintCard}>
            <Text style={s.hintLabel}>📋 Számlázandó nyitott tételek</Text>
            <Text style={s.hintValue}>{formatCurrency(stats.expectedRevenue)}</Text>
          </View>
        )}

        {/* Trend chart — 6 havi */}
        <Text style={s.sectionLabel}>Utolsó 6 hónap</Text>
        <BarChart data={stats.trend} />

        {/* Aging — kintlévőség kor */}
        {stats.openReceivable > 0 && (
          <>
            <Text style={s.sectionLabel}>Kintlévőség kora</Text>
            <View style={s.agingRow}>
              <AgingPill label="0-30 nap"  value={stats.aging.d0_30}  color="#4CAF50" />
              <AgingPill label="30-60 nap" value={stats.aging.d30_60} color="#FF9800" />
              <AgingPill label="60+ nap"   value={stats.aging.d60p}   color="#F44336" />
            </View>
          </>
        )}

        {/* Top 5 partner */}
        {stats.topPartners.length > 0 && (
          <>
            <Text style={s.sectionLabel}>Top partnerek (bevétel szerint)</Text>
            {stats.topPartners.map((p, i) => (
              <TouchableOpacity
                key={p.contact.id}
                style={s.partnerRow}
                onPress={() => onPartner?.(p.contact)}
              >
                <View style={s.partnerRank}>
                  <Text style={s.partnerRankText}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.partnerName}>{p.contact.name || "Partner"}</Text>
                  {!!p.contact.company && <Text style={s.partnerCompany}>{p.contact.company}</Text>}
                </View>
                <Text style={s.partnerAmount}>{formatCurrency(p.amount)}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Kiadások listája */}
        <Text style={s.sectionLabel}>Kiadások — {periodLabel(period)}</Text>
        {stats.expensesPeriod.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>Nincs kiadás ebben az időszakban.</Text>
          </View>
        ) : (
          stats.expensesPeriod
            .slice()
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
            .map(e => (
              <View key={e.id} style={s.expRow}>
                <Text style={s.expIcon}>{e.categoryIcon || "📌"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.expCategory}>{e.categoryLabel}</Text>
                  {!!e.note && <Text style={s.expNote}>{e.note}</Text>}
                  <Text style={s.expDate}>{new Date(e.createdAt).toLocaleDateString("hu-HU")}</Text>
                </View>
                <Text style={s.expAmount}>{formatCurrency(e.amount)}</Text>
                <TouchableOpacity
                  style={s.expDelete}
                  onPress={() => Alert.alert("Törlés", "Törlöd ezt a kiadást?", [
                    { text: "Mégse", style: "cancel" },
                    { text: "Törlés", style: "destructive", onPress: () => onDeleteExpense?.(e.id) },
                  ])}
                >
                  <Text style={{ color: "#666", fontSize: 16 }}>🗑️</Text>
                </TouchableOpacity>
              </View>
            ))
        )}
      </ScrollView>

      {/* Vissza */}
      <TouchableOpacity style={s.backBtn} onPress={onBack}>
        <Text style={s.backBtnText}>← Vissza</Text>
      </TouchableOpacity>

      {/* Új kiadás modal */}
      <Modal visible={showExpenseModal} animationType="slide" transparent>
        <View style={modal.overlay}>
          <View style={modal.sheet}>
            <Text style={modal.title}>📝 Új kiadás</Text>

            <Text style={modal.label}>Kategória</Text>
            <View style={modal.catGrid}>
              {EXPENSE_CATEGORIES.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[modal.catChip, newExpCategory === c.id && modal.catChipActive]}
                  onPress={() => setNewExpCategory(c.id)}
                >
                  <Text style={{ fontSize: 14 }}>{c.icon}</Text>
                  <Text style={[modal.catText, newExpCategory === c.id && { color: "#fff" }]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={modal.label}>Összeg (Ft)</Text>
            <TextInput
              style={modal.input}
              value={newExpAmount}
              onChangeText={setNewExpAmount}
              placeholder="pl. 25 000"
              placeholderTextColor="#666"
              keyboardType="numeric"
            />

            <Text style={modal.label}>Megjegyzés (opcionális)</Text>
            <TextInput
              style={modal.input}
              value={newExpNote}
              onChangeText={setNewExpNote}
              placeholder="pl. patikai eszközök"
              placeholderTextColor="#666"
            />

            <View style={modal.actions}>
              <TouchableOpacity style={modal.cancelBtn} onPress={() => setShowExpenseModal(false)}>
                <Text style={{ color: "#aaa", fontWeight: "600" }}>Mégse</Text>
              </TouchableOpacity>
              <TouchableOpacity style={modal.saveBtn} onPress={handleSaveExpense}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>Mentés</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function periodLabel(p) {
  if (p === "today") return "Mai nap";
  if (p === "week")  return "Utolsó 7 nap";
  if (p === "month") return "Aktuális hónap";
  return "Aktuális év";
}

function AgingPill({ label, value, color }) {
  return (
    <View style={[s.agingPill, { borderColor: color + "55", backgroundColor: color + "15" }]}>
      <Text style={[s.agingPillLabel, { color }]}>{label}</Text>
      <Text style={[s.agingPillValue, { color }]}>{formatCurrency(value)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  title: { color: "#fff", fontSize: 26, fontWeight: "700" },
  subtitle: { color: "#888", fontSize: 12, marginTop: 2 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(229,90,30,0.2)", borderWidth: 0.5, borderColor: "rgba(229,90,30,0.5)", borderRadius: 12, paddingVertical: 8, paddingHorizontal: 14 },
  addBtnIcon: { color: "#e55a1e", fontSize: 18, fontWeight: "700" },
  addBtnLabel: { color: "#e55a1e", fontSize: 13, fontWeight: "600" },

  periodRow: { flexDirection: "row", gap: 6, marginBottom: 14 },
  periodPill: { flex: 1, backgroundColor: "rgba(45,45,45,0.85)", borderRadius: 12, paddingVertical: 9, alignItems: "center", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.08)" },
  periodPillActive: { backgroundColor: "#e55a1e", borderColor: "#e55a1e" },
  periodLabel: { color: "#888", fontSize: 12, fontWeight: "600" },
  periodLabelActive: { color: "#fff" },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  statBox: { width: "48%", backgroundColor: "rgba(45,45,45,0.85)", borderRadius: 14, padding: 14, borderWidth: 0.5 },
  statLabel: { color: "#888", fontSize: 11, marginBottom: 6 },
  statValue: { fontSize: 18, fontWeight: "700" },

  hintCard: { backgroundColor: "rgba(229,90,30,0.1)", borderWidth: 0.5, borderColor: "rgba(229,90,30,0.3)", borderRadius: 12, padding: 12, marginBottom: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  hintLabel: { color: "#e55a1e", fontSize: 12, fontWeight: "600" },
  hintValue: { color: "#e55a1e", fontSize: 14, fontWeight: "700" },

  sectionLabel: { color: "#666", fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", marginTop: 6, marginBottom: 8 },

  agingRow: { flexDirection: "row", gap: 6, marginBottom: 14 },
  agingPill: { flex: 1, borderRadius: 12, padding: 10, borderWidth: 0.5, alignItems: "center" },
  agingPillLabel: { fontSize: 10, marginBottom: 4 },
  agingPillValue: { fontSize: 13, fontWeight: "700" },

  partnerRow: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(45,45,45,0.85)", borderRadius: 14, padding: 12, marginBottom: 6, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.08)" },
  partnerRank: { width: 28, height: 28, borderRadius: 8, backgroundColor: "rgba(229,90,30,0.2)", alignItems: "center", justifyContent: "center", marginRight: 10 },
  partnerRankText: { color: "#e55a1e", fontWeight: "700", fontSize: 13 },
  partnerName: { color: "#f0f0f0", fontSize: 14, fontWeight: "600" },
  partnerCompany: { color: "#777", fontSize: 11, marginTop: 1 },
  partnerAmount: { color: "#4CAF50", fontSize: 13, fontWeight: "700" },

  expRow: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(45,45,45,0.85)", borderRadius: 12, padding: 11, marginBottom: 5, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.08)" },
  expIcon: { fontSize: 20, marginRight: 10 },
  expCategory: { color: "#f0f0f0", fontSize: 13, fontWeight: "600" },
  expNote: { color: "#999", fontSize: 11, marginTop: 1 },
  expDate: { color: "#666", fontSize: 10, marginTop: 2 },
  expAmount: { color: "#F44336", fontSize: 13, fontWeight: "700", marginRight: 10 },
  expDelete: { padding: 6 },

  emptyCard: { backgroundColor: "rgba(45,45,45,0.85)", borderRadius: 12, padding: 18, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.08)" },
  emptyText: { color: "#888", fontSize: 13, textAlign: "center" },

  backBtn: { position: "absolute", bottom: 110, left: 18, backgroundColor: "rgba(229,90,30,0.15)", borderWidth: 1, borderColor: "#e55a1e", borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 },
  backBtnText: { color: "#e55a1e", fontSize: 14, fontWeight: "600" },
});

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#1a1a1a", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  title: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 18, textAlign: "center" },
  label: { color: "#888", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 14, marginBottom: 6 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  catChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: "rgba(45,45,45,0.85)", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.08)" },
  catChipActive: { backgroundColor: "#e55a1e", borderColor: "#e55a1e" },
  catText: { color: "#aaa", fontSize: 12, fontWeight: "600" },
  input: { backgroundColor: "rgba(45,45,45,0.85)", color: "#fff", borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.08)" },
  actions: { flexDirection: "row", gap: 10, marginTop: 22 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: "rgba(45,45,45,0.85)", alignItems: "center", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.08)" },
  saveBtn: { flex: 2, paddingVertical: 14, borderRadius: 14, backgroundColor: "#e55a1e", alignItems: "center" },
});
