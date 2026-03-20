// ─────────────────────────────────────────────────────────────────
// useBadges.js — Belső badge rendszer
// Időpontok, nyitott tételek, üzenetek számontartása
// ─────────────────────────────────────────────────────────────────
import { useMemo } from "react";

function getTodayStr() {
  const d = new Date();
  return `${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`;
}

function getTomorrowStr() {
  const d = new Date(Date.now() + 86400000);
  return `${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`;
}

export function useBadges(contacts = [], messageCountByChannel = {}) {
  return useMemo(() => {
    const today = getTodayStr();
    const tomorrow = getTomorrowStr();

    let todayAppts = 0;
    let tomorrowAppts = 0;
    let openItems = 0;
    let openAmount = 0;
    let unreadMessages = 0;
    const urgentContacts = [];

    contacts.forEach((c) => {
      const todayA = (c.appointments || []).filter((a) => a.datum === today);
      const tomorrowA = (c.appointments || []).filter((a) => a.datum === tomorrow);
      const open = c.openItems || [];
      const msgs = messageCountByChannel[c.registlessUid] || 0;

      todayAppts += todayA.length;
      tomorrowAppts += tomorrowA.length;
      openItems += open.length;
      openAmount += open.reduce((s, i) => s + Number(i.brutto || i.amount || 0), 0);
      unreadMessages += msgs;

      const isUrgent = todayA.length > 0 || open.length > 0 || msgs > 0;
      if (isUrgent) urgentContacts.push(c.id);
    });

    const total = todayAppts + openItems + unreadMessages;

    return {
      total,
      todayAppts,
      tomorrowAppts,
      openItems,
      openAmount,
      unreadMessages,
      urgentContacts,
      // Összesített badge szöveg
      summary: total === 0 ? null :
        [
          todayAppts > 0 && `${todayAppts} mai időpont`,
          openItems > 0 && `${openItems} nyitott tétel`,
          unreadMessages > 0 && `${unreadMessages} új üzenet`,
        ].filter(Boolean).join(" · "),
    };
  }, [contacts, messageCountByChannel]);
}

// Badge komponens
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme/colors";

export function Badge({ count, color = colors.danger, size = "sm" }) {
  if (!count || count <= 0) return null;
  const isLg = size === "lg";
  return (
    <View style={[badge.wrap, {
      backgroundColor: color,
      minWidth: isLg ? 22 : 16,
      height: isLg ? 22 : 16,
      borderRadius: isLg ? 11 : 8,
    }]}>
      <Text style={[badge.text, { fontSize: isLg ? 12 : 10 }]}>
        {count > 99 ? "99+" : count}
      </Text>
    </View>
  );
}

const badge = StyleSheet.create({
  wrap: {
    justifyContent: "center", alignItems: "center",
    paddingHorizontal: 4,
  },
  text: { color: "#fff", fontWeight: "bold" },
});
