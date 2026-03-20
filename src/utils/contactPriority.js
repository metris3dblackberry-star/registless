// ─────────────────────────────────────────────────────────────────
// contactPriority.js — Dashboard prioritás-rendezés
// ─────────────────────────────────────────────────────────────────

export const ContactStatus = {
  NEW_MESSAGE:    "new_message",
  UPCOMING_APPT:  "upcoming_appt",
  OPEN_ITEM:      "open_item",
  UNPAID_INVOICE: "unpaid_invoice",
};

function getTodayStr() {
  const d = new Date();
  return `${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`;
}

function getTomorrowStr() {
  const d = new Date(Date.now() + 86400000);
  return `${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`;
}

export function getContactStatuses(contact) {
  const statuses = [];
  const today = getTodayStr();
  const tomorrow = getTomorrowStr();

  const upcomingAppts = (contact.appointments || []).filter(
    (a) => a.datum === today || a.datum === tomorrow
  );
  if (upcomingAppts.length > 0) {
    statuses.push({ type: ContactStatus.UPCOMING_APPT, count: upcomingAppts.length, next: upcomingAppts[0] });
  }

  const openItems = contact.openItems || [];
  if (openItems.length > 0) {
    const total = openItems.reduce((s, i) => s + Number(i.brutto || i.amount || 0), 0);
    statuses.push({ type: ContactStatus.OPEN_ITEM, count: openItems.length, total });
  }

  return statuses;
}

export function getContactPriority(contact) {
  let score = 0;
  const today = getTodayStr();
  if ((contact.appointments || []).some((a) => a.datum === today)) score += 1000;
  if ((contact.openItems || []).length > 0) score += 200;
  score += Math.min((contact.lastActivityAt || 0) / 1000000, 100);
  return score;
}

export function sortContactsByPriority(contacts) {
  return [...contacts].sort((a, b) => getContactPriority(b) - getContactPriority(a));
}

export const STATUS_CONFIG = {
  [ContactStatus.NEW_MESSAGE]:   { icon: "💬", color: "#00BCD4", label: "új üzenet" },
  [ContactStatus.UPCOMING_APPT]: { icon: "📅", color: "#FF9800", label: "időpont" },
  [ContactStatus.OPEN_ITEM]:     { icon: "⚡", color: "#FF5722", label: "nyitott" },
  [ContactStatus.UNPAID_INVOICE]:{ icon: "💳", color: "#E91E63", label: "fizetetlen" },
};
