// ─────────────────────────────────────────────────────────────────
// invoice.js — Számla logika service layer
// ─────────────────────────────────────────────────────────────────

export function calcLine(name, qty, unitPriceNet) {
  const safeQty = Number(qty || 1);
  const safeNet = Number(unitPriceNet || 0);
  const netto = Math.round(safeQty * safeNet);
  const afa = Math.round(netto * 0.27);
  return {
    id: `tetel-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    tetel: name || "Szolgáltatás",
    darab: safeQty,
    egyseg: "db",
    egysegarNetto: safeNet,
    netto,
    afa27: afa,
    brutto: netto + afa,
  };
}

export function calcTotals(items = []) {
  return items.reduce(
    (acc, item) => {
      acc.netto += Number(item.netto || 0);
      acc.afa27 += Number(item.afa27 || 0);
      acc.brutto += Number(item.brutto || 0);
      return acc;
    },
    { netto: 0, afa27: 0, brutto: 0 }
  );
}

export function formatCurrency(amount) {
  return `${Number(amount || 0).toLocaleString("hu-HU")} Ft`;
}

export function formatDateHu(date = new Date()) {
  const pad = (v) => String(v).padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}.`;
}

export function generateInvoiceNumber(counter) {
  return `RGTL-${new Date().getFullYear()}-${String(counter).padStart(4, "0")}`;
}

export function buildInvoiceHtml({ seller, buyer, items, invoiceId, date, taxType }) {
  const totals = calcTotals(items);
  const rows = items.map((t) => `
    <tr>
      <td>${t.tetel}</td>
      <td style="text-align:right">${t.darab} ${t.egyseg}</td>
      <td style="text-align:right">${formatCurrency(t.netto)}</td>
      <td style="text-align:right">${formatCurrency(t.afa27)}</td>
      <td style="text-align:right">${formatCurrency(t.brutto)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  body { font-family: Arial, sans-serif; background: #f2f2f2; padding: 40px; color: #111; }
  .invoice { background: white; border-radius: 16px; padding: 32px; box-shadow: 0 10px 40px rgba(0,0,0,0.10); }
  .header { background: linear-gradient(90deg,#ff6a00,#ff3c3c); color: white; padding: 24px; border-radius: 12px; }
  .title { font-size: 28px; font-weight: bold; }
  .grid { display:flex; gap:20px; margin-top:24px; }
  .card { flex:1; background:#fafafa; border-radius:12px; padding:16px; border:1px solid #eee; }
  table { width:100%; border-collapse:collapse; margin-top:24px; background:#fff; border-radius:12px; overflow:hidden; }
  th { background:#111; color:white; padding:10px; text-align:left; }
  td { padding:10px; border-bottom:1px solid #ddd; }
  .total { margin-top:20px; text-align:right; font-size:20px; font-weight:bold; }
  .footer { margin-top:32px; font-size:10px; color:#777; text-align:center; }
</style></head><body>
<div class="invoice">
  <div class="header">
    <div class="title">REGISTLESS</div>
    <div style="margin-top:6px;font-size:14px;opacity:.92">${taxType === 'kata' ? 'Bizonylat' : 'Számla'} · ${invoiceId} · ${date}</div>
  </div>
  <div class="grid">
    <div class="card"><strong>Eladó</strong><br/>${seller.name || ""}<br/>${seller.company || ""}<br/>${seller.address || ""}<br/>Adószám: ${seller.taxNumber || "-"}<br/>Bankszámlaszám: ${seller.bankAccount || "-"}</div>
    <div class="card"><strong>Vevő</strong><br/>${buyer.name || ""}<br/>${buyer.company || ""}<br/>${buyer.address || ""}</div>
  </div>
  <table>
    <tr><th>Tétel</th><th>Menny.</th><th>Nettó</th><th>ÁFA 27%</th><th>Bruttó</th></tr>
    ${rows}
  </table>
  <div class="total">Bruttó összesen: ${formatCurrency(totals.brutto)}</div>
  <div class="footer">Powered by REGISTLESS · Star Labs Kft.</div>
</div></body></html>`;
}
