// ─────────────────────────────────────────────────────────────────
// Contact.js — Egységes partner modell v2
// channels, lastActivity, financialSummary, status, source
// ─────────────────────────────────────────────────────────────────

export function createContact({
  id,
  myRoleInRelation = "seller", // "seller" | "buyer"
  name = "",
  company = "",
  address = "",
  email = "",
  phone = "",
  taxNumber = "",
  bankAccount = "",
  registlessUid = null,
  qrId = null,
  source = "manual",  // "manual" | "qr" | "ocr" | "nfc"
  status = "active",  // "active" | "archived"
  channels = { chat: false, qr: false, nfc: false },
} = {}) {
  return {
    id,
    myRoleInRelation,
    name, company, address, email, phone,
    taxNumber, bankAccount,
    registlessUid, qrId,
    source, status,
    channels,
    // Timeline
    activities: [],
    // Appointments
    appointments: [],
    // Invoices
    invoices: [],
    // Open items (gyűjtőhöz)
    openItems: [],
    // Booking requests
    bookingRequests: [],
    // Calendar (buyer side)
    calendar: [],
    // Drafts
    drafts: {},
    // Financial summary (computed)
    financialSummary: {
      totalInvoiced: 0,
      totalPaid: 0,
      openAmount: 0,
    },
    // Meta
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  };
}

export function fromSellerCustomer(sc) {
  return createContact({
    id: sc.id,
    myRoleInRelation: "seller",
    name: sc.name || "",
    company: sc.company || "",
    address: sc.address || "",
    email: sc.email || "",
    phone: sc.phone || "",
    taxNumber: sc.taxNumber || "",
    registlessUid: sc.buyerUid || sc.qrId || null,
    qrId: sc.qrId || null,
    source: sc.source || "qr",
    channels: { chat: !!sc.buyerUid, qr: !!sc.qrId, nfc: false },
    appointments: sc.appointments || [],
    invoices: sc.invoices || [],
    openItems: sc.openItems || [],
  });
}

export function fromKapcsolat(k) {
  return createContact({
    id: k.id,
    myRoleInRelation: "buyer",
    name: k.seller?.name || k.alias || "",
    company: k.seller?.company || "",
    address: k.seller?.address || "",
    email: k.seller?.email || "",
    registlessUid: k.seller?.id || null,
    qrId: k.seller?.id || null,
    source: "qr",
    channels: { chat: !!k.seller?.id, qr: true, nfc: false },
    invoices: k.szamlak || [],
    bookingRequests: k.foglalasiKerelmek || [],
    calendar: k.naptar || [],
  });
}

export function addActivity(contact, { type, text, meta = {} }) {
  return {
    ...contact,
    activities: [{
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      type, text, meta, createdAt: Date.now(),
    }, ...(contact.activities || [])],
    lastActivityAt: Date.now(),
  };
}

export function updateFinancialSummary(contact) {
  const totalInvoiced = (contact.invoices || []).reduce(
    (s, i) => s + Number(i.bruttoOsszesen || 0), 0
  );
  const openAmount = (contact.openItems || []).reduce(
    (s, i) => s + Number(i.brutto || i.amount || 0), 0
  );
  return {
    ...contact,
    financialSummary: { totalInvoiced, totalPaid: 0, openAmount },
  };
}

export function getChannelId(sellerUid, buyerUid) {
  if (!sellerUid || !buyerUid || sellerUid === buyerUid) return null;
  return `${sellerUid}_${buyerUid}`;
}

// ── Global search ──────────────────────────────────────────────
export function searchContacts(contacts, query) {
  if (!query || !query.trim()) return contacts;
  const q = query.toLowerCase().trim();
  return contacts.filter((c) =>
    (c.name || "").toLowerCase().includes(q) ||
    (c.company || "").toLowerCase().includes(q) ||
    (c.email || "").toLowerCase().includes(q) ||
    (c.phone || "").toLowerCase().includes(q) ||
    (c.address || "").toLowerCase().includes(q)
  );
}
