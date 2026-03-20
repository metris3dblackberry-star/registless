// ─────────────────────────────────────────────────────────────────
// draftManager.js — Draft everything logika
// Félbehagyott: OCR import, partner létrehozás, számla, foglalás
// ─────────────────────────────────────────────────────────────────

export const DraftType = {
  OCR_IMPORT:      "ocr_import",
  NEW_PARTNER:     "new_partner",
  INVOICE:         "invoice",
  BOOKING:         "booking",
  SERVICE:         "service",
};

export function createDraft(type, data = {}) {
  return {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    data,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function updateDraft(draft, data) {
  return { ...draft, data: { ...draft.data, ...data }, updatedAt: Date.now() };
}

// Draft summary szöveg — UI-ban megjelenítéshez
export function draftSummary(draft) {
  switch (draft.type) {
    case DraftType.OCR_IMPORT:
      return `OCR import: ${draft.data.name || "névtelen"} (${formatRelative(draft.updatedAt)})`;
    case DraftType.NEW_PARTNER:
      return `Új partner: ${draft.data.name || "névtelen"} (${formatRelative(draft.updatedAt)})`;
    case DraftType.INVOICE:
      return `Számla piszkozat: ${draft.data.contactName || ""} (${formatRelative(draft.updatedAt)})`;
    case DraftType.BOOKING:
      return `Foglalás: ${draft.data.contactName || ""} · ${draft.data.datum || ""} (${formatRelative(draft.updatedAt)})`;
    case DraftType.SERVICE:
      return `Folyamatban: ${draft.data.serviceName || "szolgáltatás"} · ${draft.data.contactName || ""} (${formatRelative(draft.updatedAt)})`;
    default:
      return "Piszkozat";
  }
}

function formatRelative(ts) {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(diff / 3600000);
  if (min < 1) return "most";
  if (min < 60) return `${min} perce`;
  if (hr < 24) return `${hr} órája`;
  return new Date(ts).toLocaleDateString("hu-HU");
}
