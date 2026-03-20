// ─────────────────────────────────────────────────────────────────
// ocr.js — OCR service: raw + 3 parser use case
// Magyar-specifikus felismerés: név, cím, telefon, email, cégnév
// ─────────────────────────────────────────────────────────────────

const PROXY_URL = "https://ocranalyze-y4fietykka-uc.a.run.app";

// Magyar keresztnevek listája (leggyakoribbak)
const HU_FIRST_NAMES = [
  "András","Anna","Balázs","Béla","Csaba","Dániel","Dávid","Dorina","Erzsébet",
  "Ferenc","Gábor","György","Gergő","Hajnalka","István","János","József","Judit",
  "Katalin","Krisztina","László","Márton","Mária","Mihály","Miklós","Mónika",
  "Norbert","Péter","Réka","Roland","Sándor","Szabolcs","Tamás","Tibor","Zoltán",
  "Zsolt","Zsuzsa","Ádám","Éva","Nikolett","Petra","Bence","Attila","Edit",
  "Eszter","Fanni","Gréta","Kinga","Laura","Lilla","Melinda","Orsolya","Tímea",
  "Veronika","Viktor","Vilmos","Ágnes","Ákos","Bálint","Botond","Emese","Enikő",
  "Szilvia","Tünde","Renáta","Nóra","Luca","Lóránt","Kristóf","Hunor","Hanna",
  // Külföldi nevek is
  "Alex","Alexandra","Barbara","Christina","David","Elena","Filip","Gabrijela",
  "Hans","Igor","Jana","Karl","Lisa","Marco","Nina","Oliver","Patricia","Robert",
  "Sandra","Thomas","Urs","Vera","Wolfgang","Xenia","Yoko","Zara"
];

export async function analyzeWithAI(text, useCase = "businessCard") {
  const prompts = {
    businessCard: `Elemezd ezt a névjegy/dokumentum szöveget és add vissza JSON-ban:
{
  "name": "teljes személy neve",
  "company": "cégnév",
  "address": "teljes cím",
  "email": "email cím",
  "phone": "telefonszám",
  "taxNumber": "adószám"
}

FONTOS szabályok a felismeréshez:
- NÉV: Magyar névsorrendben VEZETÉKNÉV KERESZTNÉV (pl. Nagy Péter), vagy KERESZTNÉV VEZETÉKNÉV külföldinél. Magyar keresztnevek: ${HU_FIRST_NAMES.slice(0,20).join(", ")} stb. Ha a szövegben szerepel ilyen keresztnév, az előtte vagy mögötte lévő szó a vezetéknév.
- CÉGNÉV: Keress Kft., Zrt., Bt., Rt., Nyrt., E.V., Ltd., GmbH., d.o.o., S.r.o., AG végződéseket. Az előtte lévő szó(k) a cégnév.
- CÍM: Magyarországon 4 jegyű szám = irányítószám, utána jön a városnév, majd az utca. Pl: "1051 Budapest, Arany János u. 12." Keress ilyen mintát.
- TELEFON: Magyar: +36 vagy 06 után 9 karakter. Külföldi: + jel után következő számok. Formátumok: +36 30 123 4567, 06-30-123-4567, +385 91 234 5678
- EMAIL: Mindig tartalmaz @ jelet és pontot utána. Pl: nev@ceg.hu
- ADÓSZÁM: Magyar formátum: 12345678-1-41 (8-1-2 jegy kötőjelekkel)

Csak JSON-t adj vissza, semmi mást!

Szöveg:
${text}`,
    companyData: `Elemezd a dokumentumot és add vissza JSON-ban a cégadatokat:
{"name":"","company":"","address":"","email":"","phone":"","taxNumber":"","bankAccount":""}
Bankszámla: magyar formátum 12345678-12345678-12345678 (3x8 jegy)
Adószám: 12345678-1-41
Csak JSON-t adj vissza!
Szöveg: ${text}`,
    invoice: `Elemezd a számlát JSON-ban:
{"invoiceId":"","date":"","totalAmount":0,"seller":{"name":"","company":"","taxNumber":""},"rawText":""}
Csak JSON-t adj vissza!
Szöveg: ${text}`
  };

  const res = await fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, prompt: prompts[useCase] || prompts.businessCard }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data || typeof data !== "object") throw new Error("Üres válasz");
  return data;
}

// ── Magyar-specifikus regex parser ────────────────────────────────

export function parseBusinessCard(rawText) {
  const raw = String(rawText || "").trim();
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // EMAIL - @ jel alapján
  const email = raw.match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/)?.[0] || "";

  // TELEFON - Magyar +36/06 vagy külföldi +XX
  const phone =
    raw.match(/(?:\+36|06)[\s\-]?\d{2}[\s\-]?\d{3}[\s\-]?\d{4}/)?.[0]?.trim() ||
    raw.match(/\+[1-9][\d\s\-\.]{7,18}/)?.[0]?.trim() ||
    raw.match(/06[\s\-]?\d{2}[\s\-]?\d{3}[\s\-]?\d{4}/)?.[0]?.trim() || "";

  // ADÓSZÁM - Magyar 8-1-2 formátum
  const taxNumber =
    raw.match(/\b\d{8}-\d-\d{2}\b/)?.[0] ||
    raw.match(/\bOIB[:\s]*([0-9]{11})/i)?.[1] ||
    raw.match(/\bVAT[\s:]+([A-Z]{2}[0-9]{8,12})/i)?.[1] || "";

  // BANKSZÁMLA - Magyar 8-8-8 formátum
  const bankAccount =
    raw.match(/\b(\d{8}-\d{8}-\d{8})\b/)?.[1] ||
    raw.match(/\b(\d{8}-\d{8})\b/)?.[1] ||
    raw.match(/\bIBAN[:\s]*([A-Z]{2}[0-9]{2}[A-Z0-9]{4,})/i)?.[1]?.replace(/\s/g,"") || "";

  // CÍM - 4 jegyű irányítószám alapján
  const addressLine = lines.find(l => /^\d{4}\s+[A-ZÁÉÍÓÖŐÚÜŰ]/.test(l)) || "";
  const streetLine = lines.find(l =>
    /\b(utca|út|útja|körút|tér|köz|sor|sétány|sugárút|rakpart|cesta|ulica|street|road|ave|lane)\b/i.test(l) && l !== addressLine
  ) || "";
  const address = addressLine && streetLine
    ? `${addressLine}, ${streetLine}`
    : addressLine || streetLine || "";

  // CÉGNÉV - Kft./Zrt. stb. alapján
  const companyRegex = /\b(kft\.?|zrt\.?|bt\.?|rt\.?|nyrt\.?|e\.?v\.?|ltd\.?|llc\.?|gmbh\.?|inc\.?|d\.o\.o\.?|s\.r\.o\.?|ag\b|sa\b)\b/i;
  const company = lines.find(l => companyRegex.test(l)) || "";

  // NÉV - Magyar keresztnév alapján
  const firstNameRegex = new RegExp(
    "\\b(" + HU_FIRST_NAMES.join("|") + ")\\b", "i"
  );
  let name = "";

  // 1. Próbálj magyar névsorrendet: "Nagy Péter" típus
  for (const line of lines) {
    if (companyRegex.test(line)) continue;
    if (line === email || line === address || line === company) continue;
    if (/^\+|^06|^\d|@/.test(line)) continue;

    const match = line.match(firstNameRegex);
    if (match) {
      // Van keresztnév a sorban → ez a névsort tartalmazza
      name = line.trim();
      break;
    }
  }

  // 2. Fallback: első érvényes sor ami nem egyéb adat
  if (!name) {
    name = lines.find(l =>
      !companyRegex.test(l) &&
      l !== email && l !== address && l !== company &&
      !/^[\+0]|@|\d{4}/.test(l) &&
      l.length > 3 && l.length < 60 &&
      /[A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű]/.test(l)
    ) || "";
  }

  return { name, company, address, email, phone, taxNumber, bankAccount };
}

export function parseCompanyData(rawText) {
  const base = parseBusinessCard(rawText);
  return base;
}

export function parseInvoice(rawText) {
  const raw = String(rawText || "").trim();
  const invoiceId = raw.match(/\b(RGTL|INV|SZL|SZLA|SZÁMLASZÁM)[\-:\s]?\s*([A-Z0-9\-\/]+)/i)?.[0] || "";
  const date = raw.match(/\b\d{4}[.\-]\d{2}[.\-]\d{2}\.?\b/)?.[0] || "";
  const amounts = [...raw.matchAll(/\b(\d[\d\s]{3,})\s*(Ft|HUF|EUR|USD)\b/gi)]
    .map(m => ({ raw: m[0], value: parseInt(m[1].replace(/\s/g,""), 10) }));
  const totalAmount = amounts.length ? Math.max(...amounts.map(a => a.value)) : 0;
  const base = parseBusinessCard(rawText);
  return { invoiceId, date, amounts, totalAmount, seller: { name: base.name, company: base.company, taxNumber: base.taxNumber }, rawText };
}

export async function analyzeOcrText(text, useCase = "businessCard") {
  try {
    return await analyzeWithAI(text, useCase);
  } catch (e) {
    console.log("AI OCR fallback:", e.message);
    if (useCase === "invoice") return parseInvoice(text);
    if (useCase === "companyData") return parseCompanyData(text);
    return parseBusinessCard(text);
  }
}
