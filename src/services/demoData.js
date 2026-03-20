// ─────────────────────────────────────────────────────────────────
// demoData.js — Demo seed adatok
// Első indításkor betölti, hogy ne legyenek üres képernyők
// ─────────────────────────────────────────────────────────────────

const NOW = Date.now();
const DAY = 86400000;

export const DEMO_SELLER = {
  sellerName: "Nagy Péter",
  sellerCompany: "NP Fitness Kft.",
  sellerAddress: "1051 Budapest, Arany János u. 12.",
  sellerTaxNumber: "12345678-1-41",
  sellerBankAccount: "11773016-12345678-00000000",
};

export const DEMO_BUYER = {
  buyerName: "Kiss Anna",
  buyerAddress: "1061 Budapest, Andrássy út 5.",
  buyerCompany: "",
};

const tomorrow = new Date(NOW + DAY);
const dayAfter = new Date(NOW + 2 * DAY);

function dateStr(d) {
  return `${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`;
}

export const DEMO_CONTACTS = [
  {
    id: "demo-contact-1",
    myRoleInRelation: "seller",
    name: "Kiss Anna",
    company: "",
    address: "1061 Budapest, Andrássy út 5.",
    email: "anna.kiss@email.com",
    phone: "+36 30 123 4567",
    registlessUid: "buyer-demo-anna",
    qrId: "buyer-demo-anna",
    source: "qr",
    channels: { chat: true, qr: true, nfc: false },
    activities: [
      {
        id: "act-d1",
        type: "qr_connect",
        text: "Kiss Anna QR-rel kapcsolódott",
        meta: {},
        createdAt: NOW - 5 * DAY,
      },
      {
        id: "act-d2",
        type: "booking_request",
        text: "Időpont kérés: Személyi edzés",
        meta: {},
        createdAt: NOW - 2 * DAY,
      },
      {
        id: "act-d3",
        type: "invoice_issued",
        text: "Számla kiállítva: RGTL-2025-0001",
        meta: { amount: 12700 },
        createdAt: NOW - DAY,
      },
    ],
    appointments: [
      {
        id: "appt-d1",
        serviceName: "Személyi edzés",
        datum: dateStr(tomorrow),
        ido: "10:00",
        statusz: "elfogadott foglalás",
        amount: 10000,
        createdAt: NOW - 2 * DAY,
      },
    ],
    invoices: [
      {
        id: "RGTL-2025-0001",
        datum: new Date(NOW - DAY).toLocaleDateString("hu-HU"),
        tetelek: [
          {
            id: "t1",
            tetel: "Személyi edzés",
            darab: 1,
            egyseg: "db",
            egysegarNetto: 10000,
            netto: 10000,
            afa27: 2700,
            brutto: 12700,
          },
        ],
        nettoOsszesen: 10000,
        afaOsszesen: 2700,
        bruttoOsszesen: 12700,
        statusz: "kiállítva",
        createdAt: NOW - DAY,
      },
    ],
    openItems: [],
    bookingRequests: [],
    calendar: [],
    drafts: {},
    financialSummary: { totalInvoiced: 12700, totalPaid: 0, openAmount: 0 },
    createdAt: NOW - 5 * DAY,
    lastActivityAt: NOW - DAY,
  },
  {
    id: "demo-contact-2",
    myRoleInRelation: "seller",
    name: "Tóth Béla",
    company: "TB Consulting",
    address: "1054 Budapest, Szabadság tér 7.",
    email: "bela.toth@tbconsulting.hu",
    phone: "+36 20 987 6543",
    registlessUid: "buyer-demo-bela",
    qrId: "buyer-demo-bela",
    source: "ocr",
    channels: { chat: false, qr: false, nfc: false },
    activities: [
      {
        id: "act-d4",
        type: "ocr_import",
        text: "Partner hozzáadva névjegyből",
        meta: {},
        createdAt: NOW - 3 * DAY,
      },
    ],
    appointments: [
      {
        id: "appt-d2",
        serviceName: "Masszázs",
        datum: dateStr(dayAfter),
        ido: "14:30",
        statusz: "elfogadott foglalás",
        amount: 15000,
        createdAt: NOW - 3 * DAY,
      },
    ],
    invoices: [],
    openItems: [
      {
        id: "oi-d1",
        appointmentId: "appt-d2",
        serviceName: "Masszázs",
        datum: dateStr(dayAfter),
        ido: "14:30",
        netto: 15000,
        afa27: 4050,
        brutto: 19050,
        amount: 19050,
      },
    ],
    bookingRequests: [],
    calendar: [],
    drafts: {},
    financialSummary: { totalInvoiced: 0, totalPaid: 0, openAmount: 19050 },
    createdAt: NOW - 3 * DAY,
    lastActivityAt: NOW - DAY,
  },
];

export const DEMO_BUYER_CONTACTS = [
  {
    id: "demo-buyer-contact-1",
    myRoleInRelation: "buyer",
    name: "Nagy Péter",
    company: "NP Fitness Kft.",
    address: "1051 Budapest, Arany János u. 12.",
    email: "peter.nagy@npfitness.hu",
    phone: "+36 70 555 1234",
    registlessUid: "seller-demo-peter",
    qrId: "seller-demo-peter",
    source: "qr",
    channels: { chat: true, qr: true, nfc: false },
    activities: [
      {
        id: "act-bd1",
        type: "qr_connect",
        text: "Kapcsolódtál Nagy Péterhez",
        meta: {},
        createdAt: NOW - 5 * DAY,
      },
    ],
    appointments: [],
    invoices: [
      {
        id: "RGTL-2025-0001",
        datum: new Date(NOW - DAY).toLocaleDateString("hu-HU"),
        bruttoOsszesen: 12700,
        statusz: "kiállítva",
        createdAt: NOW - DAY,
      },
    ],
    openItems: [],
    bookingRequests: [],
    calendar: [
      {
        id: "cal-d1",
        serviceName: "Személyi edzés",
        datum: dateStr(tomorrow),
        ido: "10:00",
        statusz: "elfogadva",
        createdAt: NOW - 2 * DAY,
      },
    ],
    drafts: {},
    financialSummary: { totalInvoiced: 12700, totalPaid: 0, openAmount: 0 },
    createdAt: NOW - 5 * DAY,
    lastActivityAt: NOW - DAY,
  },
];

export const DEMO_QUICK_SERVICES = [
  { id: "qs-demo-1", name: "Személyi edzés", amount: 10000 },
  { id: "qs-demo-2", name: "Masszázs", amount: 15000 },
  { id: "qs-demo-3", name: "Konzultáció", amount: 20000 },
];
