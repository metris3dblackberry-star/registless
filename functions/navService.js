// ─────────────────────────────────────────────────────────────────
// navService.js — NAV Online Számla API 3.0 integráció
// Firebase Cloud Function (v2) — TESZT környezet
// C:\registless\functions\navService.js
//
// SZÜKSÉGES .env változók (C:\registless\functions\.env):
//   NAV_TAX_NUMBER=12345678        ← Star Labs Kft. adószám első 8 jegy
//   NAV_PASSWORD_HASH=<sha3-512>   ← SHA3-512(technikai user jelszó) UPPERCASE HEX
//
// Futtatás teszteléshez:
//   curl -X POST http://localhost:5001/registless/us-central1/navTestUpload
// ─────────────────────────────────────────────────────────────────

const { onRequest } = require("firebase-functions/v2/https");
const crypto  = require("crypto");
const zlib    = require("zlib");
const https   = require("https");
const { URL } = require("url");

// ── Credentials ───────────────────────────────────────────────────
const NAV_LOGIN        = "pgiyb5uem3museb";
const NAV_SIGN_KEY     = "d2-a1a7-6fde462260dd5BX6NCPI7QW9";
const NAV_EXCHANGE_KEY = "f9715BX6NCPI6KBR"; // 16 byte → AES-128-ECB
const NAV_TEST_URL     = "https://api-test.onlineszamla.nav.gov.hu/invoiceService/v3";

// ── Env változók ──────────────────────────────────────────────────
// Töltsd ki a functions/.env fájlban!
const NAV_TAX_NUMBER    = process.env.NAV_TAX_NUMBER    || "KITOLTENDO"; // pl. 12345678
const NAV_PASSWORD_HASH = process.env.NAV_PASSWORD_HASH || "KITOLTENDO"; // SHA3-512(jelszó) uppercase hex

// ── Crypto segédfüggvények ────────────────────────────────────────

/** SHA3-512 hash — uppercase HEX */
function sha3(str) {
  return crypto.createHash("sha3-512").update(str, "utf8").digest("hex").toUpperCase();
}

/** Egyedi requestId — max 30 karakter, csak betű/szám */
function makeRequestId() {
  const ts  = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 8).toUpperCase();
  return ("RGL" + ts + rnd).substring(0, 30);
}

/**
 * NAV timestamp az XML-be: 2024-03-28T12:00:00.000+01:00
 * A NAV UTC+1 (CET) / UTC+2 (CEST) offset-et vár — egyszerűsítve UTC+0 is elfogadható teszten
 */
function makeXmlTimestamp() {
  // NAV: YYYY-MM-DDTHH:mm:ss.sssZ formátum
  return new Date().toISOString();
}

/**
 * NAV signature timestamp: csak számok YYYYMMDDHHmmss (14 jegy, UTC)
 * Ez kerül a SHA3 bemenete
 */
function makeSignatureTimestamp() {
  return new Date().toISOString().replace(/[-:T.Z]/g, "").substring(0, 14);
}

/**
 * requestSignature tokenExchange-hez:
 *   SHA3-512(requestId + signatureTimestamp + signKey)
 */
function makeTokenExchangeSignature(requestId, sigTs) {
  return sha3(requestId + sigTs + NAV_SIGN_KEY);
}

/**
 * requestSignature manageInvoice-hoz:
 *   SHA3-512(requestId + sigTs + signKey + SHA3-512(compressedBase64_invoice1) + ...)
 */
function makeManageInvoiceSignature(requestId, sigTs, invoiceHashes) {
  return sha3(requestId + sigTs + NAV_SIGN_KEY + invoiceHashes.join(""));
}

/**
 * AES-128-ECB dekódolás — NAV exchange token visszafejtése
 * exchangeKey: pontosan 16 byte (16 ASCII karakter)
 */
function decryptExchangeToken(encodedToken) {
  const keyBuffer     = Buffer.from(NAV_EXCHANGE_KEY, "utf8"); // 16 byte
  const tokenBuffer   = Buffer.from(encodedToken, "base64");
  const decipher      = crypto.createDecipheriv("aes-128-ecb", keyBuffer, null);
  decipher.setAutoPadding(true);
  const decrypted     = Buffer.concat([decipher.update(tokenBuffer), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * Invoice XML → gzip → base64
 * Ez kerül a manageInvoice request invoiceData mezőjébe
 */
function compressAndEncode(xmlString) {
  const rawBytes   = Buffer.from(xmlString, "utf8");
  const compressed = zlib.gzipSync(rawBytes);
  return compressed.toString("base64");
}

/** SHA3-512(operation + base64) — NAV spec: operation és base64 tartalom összefűzése */
function invoiceHash(operation, base64) {
  return crypto.createHash("sha3-512").update(operation + base64, "utf8").digest("hex").toUpperCase();
}

// ── HTTP segédfüggvény (Promise wrapper) ──────────────────────────

function navPost(path, xmlBody) {
  return new Promise((resolve, reject) => {
    const url     = new URL(NAV_TEST_URL + path);
    const bodyBuf = Buffer.from(xmlBody, "utf8");
    const options = {
      hostname: url.hostname,
      path:     url.pathname,
      method:   "POST",
      headers:  {
        "Content-Type":   "application/xml;charset=UTF-8",
        "Content-Length": bodyBuf.length,
        "Accept":         "application/xml",
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    req.write(bodyBuf);
    req.end();
  });
}

// ── XML sablonok ──────────────────────────────────────────────────

function buildHeader(requestId, xmlTs) {
  return `
  <common:header>
    <common:requestId>${requestId}</common:requestId>
    <common:timestamp>${xmlTs}</common:timestamp>
    <common:requestVersion>3.0</common:requestVersion>
    <common:headerVersion>1.0</common:headerVersion>
  </common:header>`.trim();
}

function buildUser(requestSig) {
  return `
  <common:user>
    <common:login>${NAV_LOGIN}</common:login>
    <common:passwordHash cryptoType="SHA-512">${NAV_PASSWORD_HASH}</common:passwordHash>
    <common:taxNumber>${NAV_TAX_NUMBER}</common:taxNumber>
    <common:requestSignature cryptoType="SHA3-512">${requestSig}</common:requestSignature>
  </common:user>`.trim();
}

function buildSoftware() {
  return `
  <software>
    <softwareId>HU-STARLABS-REG-10</softwareId>
    <softwareName>Registless</softwareName>
    <softwareOperation>LOCAL_SOFTWARE</softwareOperation>
    <softwareMainVersion>1.0</softwareMainVersion>
    <softwareDevName>Star Labs Kft.</softwareDevName>
    <softwareDevContact>info@starlabs.hu</softwareDevContact>
    <softwareDevCountryCode>HU</softwareDevCountryCode>
    <softwareDevTaxNumber>${NAV_TAX_NUMBER}</softwareDevTaxNumber>
  </software>`.trim();
}

function buildTokenExchangeXml(requestId, xmlTs, requestSig) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<TokenExchangeRequest xmlns="http://schemas.nav.gov.hu/OSA/3.0/api"
  xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common">
  ${buildHeader(requestId, xmlTs)}
  ${buildUser(requestSig)}
  ${buildSoftware()}
</TokenExchangeRequest>`;
}

function buildManageInvoiceXml(requestId, xmlTs, requestSig, exchangeToken, compressedInvoiceBase64) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ManageInvoiceRequest xmlns="http://schemas.nav.gov.hu/OSA/3.0/api"
  xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common">
  ${buildHeader(requestId, xmlTs)}
  ${buildUser(requestSig)}
  ${buildSoftware()}
  <exchangeToken>${exchangeToken}</exchangeToken>
  <invoiceOperations>
    <compressedContent>true</compressedContent>
    <invoiceOperation>
      <index>1</index>
      <invoiceOperation>CREATE</invoiceOperation>
      <invoiceData>${compressedInvoiceBase64}</invoiceData>
    </invoiceOperation>
  </invoiceOperations>
</ManageInvoiceRequest>`;
}

/**
 * Dummy NAV InvoiceData XML — 3.0 séma szerint
 * Ez egy érvényes teszt számla struktúra
 */
function buildDummyInvoiceXml(invoiceNumber, issueDate) {
  const deliveryDate  = issueDate;
  const dueDate       = addDays(issueDate, 14);
  const netAmount     = 10000;
  const vatAmount     = 2700;
  const grossAmount   = 12700;

  return `<?xml version="1.0" encoding="UTF-8"?>
<InvoiceData xmlns="http://schemas.nav.gov.hu/OSA/3.0/data"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://schemas.nav.gov.hu/OSA/3.0/data invoiceData.xsd">
  <invoiceNumber>${invoiceNumber}</invoiceNumber>
  <invoiceIssueDate>${issueDate}</invoiceIssueDate>
  <completenessIndicator>false</completenessIndicator>
  <invoiceMain>
    <invoice>
      <invoiceHead>
        <supplierInfo>
          <supplierTaxNumber>
            <taxpayerTaxNumber>${NAV_TAX_NUMBER}</taxpayerTaxNumber>
            <vatCode>2</vatCode>
            <countyCode>02</countyCode>
          </supplierTaxNumber>
          <supplierName>Star Labs Kft.</supplierName>
          <supplierAddress>
            <simpleAddress>
              <countryCode>HU</countryCode>
              <postalCode>1000</postalCode>
              <city>Budapest</city>
              <additionalAddressDetail>Teszt utca 1.</additionalAddressDetail>
            </simpleAddress>
          </supplierAddress>
          <supplierBankAccountNumber>12345678-12345678-12345678</supplierBankAccountNumber>
        </supplierInfo>
        <customerInfo>
          <customerVatStatus>PRIVATE_PERSON</customerVatStatus>
          <customerName>Teszt Vevő</customerName>
          <customerAddress>
            <simpleAddress>
              <countryCode>HU</countryCode>
              <postalCode>1051</postalCode>
              <city>Budapest</city>
              <additionalAddressDetail>Vevő utca 2.</additionalAddressDetail>
            </simpleAddress>
          </customerAddress>
        </customerInfo>
        <invoiceDetail>
          <invoiceCategory>NORMAL</invoiceCategory>
          <invoiceDeliveryDate>${deliveryDate}</invoiceDeliveryDate>
          <currencyCode>HUF</currencyCode>
          <exchangeRate>1</exchangeRate>
          <paymentMethod>TRANSFER</paymentMethod>
          <paymentDate>${dueDate}</paymentDate>
          <invoiceAccountingDeliveryDate>${deliveryDate}</invoiceAccountingDeliveryDate>
        </invoiceDetail>
      </invoiceHead>
      <invoiceLines>
        <mergedItemIndicator>false</mergedItemIndicator>
        <line>
          <lineNumber>1</lineNumber>
          <lineDescription>Regisztless teszt szolgáltatás</lineDescription>
          <quantity>1</quantity>
          <unitOfMeasure>PIECE</unitOfMeasure>
          <unitPrice>${netAmount}</unitPrice>
          <lineAmountsNormal>
            <lineNetAmountData>
              <lineNetAmount>${netAmount}</lineNetAmount>
              <lineNetAmountHUF>${netAmount}</lineNetAmountHUF>
            </lineNetAmountData>
            <lineVatRate>
              <vatPercentage>0.27</vatPercentage>
            </lineVatRate>
            <lineVatData>
              <lineVatAmount>${vatAmount}</lineVatAmount>
              <lineVatAmountHUF>${vatAmount}</lineVatAmountHUF>
            </lineVatData>
            <lineGrossAmountData>
              <lineGrossAmountNormal>${grossAmount}</lineGrossAmountNormal>
              <lineGrossAmountNormalHUF>${grossAmount}</lineGrossAmountNormalHUF>
            </lineGrossAmountData>
          </lineAmountsNormal>
        </line>
      </invoiceLines>
      <invoiceSummary>
        <summaryNormal>
          <summaryByVatRate>
            <vatRate>
              <vatPercentage>0.27</vatPercentage>
            </vatRate>
            <vatRateNetData>
              <vatRateNetAmount>${netAmount}</vatRateNetAmount>
              <vatRateNetAmountHUF>${netAmount}</vatRateNetAmountHUF>
            </vatRateNetData>
            <vatRateVatData>
              <vatRateVatAmount>${vatAmount}</vatRateVatAmount>
              <vatRateVatAmountHUF>${vatAmount}</vatRateVatAmountHUF>
            </vatRateVatData>
            <vatRateGrossData>
              <vatRateGrossAmount>${grossAmount}</vatRateGrossAmount>
              <vatRateGrossAmountHUF>${grossAmount}</vatRateGrossAmountHUF>
            </vatRateGrossData>
          </summaryByVatRate>
          <invoiceNetAmount>${netAmount}</invoiceNetAmount>
          <invoiceNetAmountHUF>${netAmount}</invoiceNetAmountHUF>
          <invoiceVatAmount>${vatAmount}</invoiceVatAmount>
          <invoiceVatAmountHUF>${vatAmount}</invoiceVatAmountHUF>
        </summaryNormal>
        <summaryGrossData>
          <invoiceGrossAmount>${grossAmount}</invoiceGrossAmount>
          <invoiceGrossAmountHUF>${grossAmount}</invoiceGrossAmountHUF>
        </summaryGrossData>
      </invoiceSummary>
    </invoice>
  </invoiceMain>
</InvoiceData>`;
}

// ── Segéd: dátum + N nap ─────────────────────────────────────────
function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

// ── XML parse segéd (regex alapú, lightweight) ────────────────────
function extractTag(xml, tag) {
  const m = xml.match(new RegExp(`<(?:[^:]+:)?${tag}[^>]*>([^<]*)<`, "i"));
  return m ? m[1].trim() : null;
}

function extractErrorInfo(xml) {
  const code    = extractTag(xml, "funcCode") || extractTag(xml, "errorCode") || "?";
  const message = extractTag(xml, "message")  || extractTag(xml, "errorMessage") || xml.substring(0, 300);
  return { code, message };
}

// ── STEP 1: tokenExchange ─────────────────────────────────────────
async function tokenExchange() {
  const requestId = makeRequestId();
  const xmlTs     = makeXmlTimestamp();
  const sigTs     = makeSignatureTimestamp();
  const sig       = makeTokenExchangeSignature(requestId, sigTs);

  console.log("[NAV] tokenExchange →", { requestId, sigTs });

  const xml = buildTokenExchangeXml(requestId, xmlTs, sig);
  console.log("[NAV] tokenExchange REQUEST:\n", xml);

  const { status, body } = await navPost("/tokenExchange", xml);
  console.log("[NAV] tokenExchange RESPONSE status:", status);
  console.log("[NAV] tokenExchange RESPONSE body:\n", body);

  if (status !== 200) {
    const err = extractErrorInfo(body);
    throw new Error(`tokenExchange HTTP ${status} — ${err.code}: ${err.message}`);
  }

  const funcCode = extractTag(body, "funcCode");
  if (funcCode !== "OK") {
    const err = extractErrorInfo(body);
    throw new Error(`tokenExchange FAIL — ${err.code}: ${err.message}`);
  }

  const encodedToken = extractTag(body, "encodedExchangeToken");
  if (!encodedToken) throw new Error("tokenExchange: encodedExchangeToken hiányzik a válaszból");

  const exchangeToken = decryptExchangeToken(encodedToken);
  console.log("[NAV] exchangeToken (decrypted):", exchangeToken);

  return exchangeToken;
}

// ── STEP 2: manageInvoice ─────────────────────────────────────────
async function manageInvoice(exchangeToken, invoiceXml, invoiceNumber) {
  const requestId = makeRequestId();
  const xmlTs     = makeXmlTimestamp();
  // sigTs az xmlTs-ből: YYYYMMDDHHmmss — ugyanaz mint a header timestamp
  const sigTs     = xmlTs.replace(/[-:T.Z]/g, '').substring(0, 14);

  const compressedBase64 = compressAndEncode(invoiceXml);
  const invHash          = invoiceHash("CREATE", compressedBase64);
  const sigInput         = requestId + sigTs + NAV_SIGN_KEY + invHash;
  console.log("[NAV] manageInvoice sigInput részei:", {
    requestId,
    sigTs,
    signKeyLen: NAV_SIGN_KEY.length,
    invHashPrefix: invHash.substring(0, 16),
    sigInputLen: sigInput.length
  });
  const sig             = makeManageInvoiceSignature(requestId, sigTs, [invHash]);

  console.log("[NAV] manageInvoice →", { requestId, invoiceNumber, invHash: invHash.substring(0, 16) + "..." });

  const xml = buildManageInvoiceXml(requestId, xmlTs, sig, exchangeToken, compressedBase64);
  console.log("[NAV] manageInvoice REQUEST (rövidítve):\n",
    xml.replace(compressedBase64, "[...base64compressed...]")
  );

  const { status, body } = await navPost("/manageInvoice", xml);
  console.log("[NAV] manageInvoice RESPONSE status:", status);
  console.log("[NAV] manageInvoice RESPONSE body:\n", body);

  if (status !== 200) {
    const err = extractErrorInfo(body);
    throw new Error(`manageInvoice HTTP ${status} — ${err.code}: ${err.message}`);
  }

  const funcCode    = extractTag(body, "funcCode");
  const transactionId = extractTag(body, "transactionId");

  return { funcCode, transactionId, rawResponse: body };
}

// ── Cloud Function: navTestUpload ─────────────────────────────────
exports.navTestUpload = onRequest(
  { region: "us-central1", timeoutSeconds: 60 },
  async (req, res) => {
    console.log("=== NAV teszt feltöltés indul ===");

    // Előfeltétel ellenőrzés
    if (NAV_TAX_NUMBER === "KITOLTENDO" || NAV_PASSWORD_HASH === "KITOLTENDO") {
      return res.status(500).json({
        success: false,
        error: "Hiányzó .env változók",
        required: {
          NAV_TAX_NUMBER:    "A cég adószámának első 8 jegye (pl. 12345678)",
          NAV_PASSWORD_HASH: "SHA3-512(technikai user jelszó) — uppercase hex — lásd README",
        },
        hint: "Töltsd ki a functions/.env fájlt, majd: firebase deploy --only functions",
      });
    }

    try {
      // ── 1. Token megszerzése ─────────────────────────────────────
      console.log("[NAV] STEP 1: tokenExchange...");
      const exchangeToken = await tokenExchange();

      // ── 2. Dummy számla XML összeállítása ────────────────────────
      const invoiceNumber = `RGTL-TEST-${Date.now().toString(36).toUpperCase()}`;
      const issueDate     = todayStr();
      const invoiceXml    = buildDummyInvoiceXml(invoiceNumber, issueDate);

      console.log("[NAV] STEP 2: manageInvoice — számlaszám:", invoiceNumber);
      console.log("[NAV] Invoice XML:\n", invoiceXml);

      // ── 3. Feltöltés ─────────────────────────────────────────────
      const result = await manageInvoice(exchangeToken, invoiceXml, invoiceNumber);

      console.log("=== NAV teszt KÉSZ ===", result);

      return res.status(200).json({
        success:       result.funcCode === "OK",
        funcCode:      result.funcCode,
        transactionId: result.transactionId,
        invoiceNumber,
        issueDate,
        message:       result.funcCode === "OK"
          ? `✅ Számla sikeresen feltöltve! transactionId: ${result.transactionId}`
          : `⚠️ NAV válasz: ${result.funcCode}`,
        rawResponse: result.rawResponse,
      });

    } catch (err) {
      console.error("[NAV] HIBA:", err.message);
      return res.status(500).json({
        success: false,
        error:   err.message,
        hint:    "Nézd a Cloud Function logokat a részletekért",
      });
    }
  }
);

// ── Teszt: jelszó hash generálás (csak lokálisan használd!) ────────
// node -e "const c=require('crypto'); console.log(c.createHash('sha3-512').update('A_TE_JELSZAVAD','utf8').digest('hex').toUpperCase())"

// ─────────────────────────────────────────────────────────────────
// buildRealInvoiceXml — Valódi számla XML-je a Registless invoice
// objektumból (coordinator.js / invoice.js struktúra szerint)
// ─────────────────────────────────────────────────────────────────
function buildRealInvoiceXml({ invoiceNumber, issueDate, seller, buyer, items, currency = "HUF" }) {
  const deliveryDate = issueDate;
  const dueDate      = addDays(issueDate, 14);

  // Összesítők
  const netAmount   = Math.round(items.reduce((s, t) => s + (t.netto || 0), 0));
  const vatAmount   = Math.round(items.reduce((s, t) => s + (t.afa27 || 0), 0));
  const grossAmount = netAmount + vatAmount;

  // Sorok
  const lineXmls = items.map((t, i) => {
    const lNet   = Math.round(t.netto   || 0);
    const lVat   = Math.round(t.afa27   || 0);
    const lGross = Math.round(t.brutto  || lNet + lVat);
    return `
        <line>
          <lineNumber>${i + 1}</lineNumber>
          <lineDescription>${escXml(t.tetel || "Szolgáltatás")}</lineDescription>
          <quantity>${t.darab || 1}</quantity>
          <unitOfMeasure>PIECE</unitOfMeasure>
          <unitPrice>${t.egysegarNetto || lNet}</unitPrice>
          <lineAmountsNormal>
            <lineNetAmountData>
              <lineNetAmount>${lNet}</lineNetAmount>
              <lineNetAmountHUF>${lNet}</lineNetAmountHUF>
            </lineNetAmountData>
            <lineVatRate><vatPercentage>0.27</vatPercentage></lineVatRate>
            <lineVatData>
              <lineVatAmount>${lVat}</lineVatAmount>
              <lineVatAmountHUF>${lVat}</lineVatAmountHUF>
            </lineVatData>
            <lineGrossAmountData>
              <lineGrossAmountNormal>${lGross}</lineGrossAmountNormal>
              <lineGrossAmountNormalHUF>${lGross}</lineGrossAmountNormalHUF>
            </lineGrossAmountData>
          </lineAmountsNormal>
        </line>`;
  }).join("");

  // Vevő adószám státusz
  const customerVatStatus = buyer.taxNumber ? "DOMESTIC" : "PRIVATE_PERSON";
  const customerTaxBlock  = buyer.taxNumber
    ? `<customerTaxNumber><taxpayerTaxNumber>${escXml(buyer.taxNumber.replace(/[^0-9]/g, "").substring(0, 8))}</taxpayerTaxNumber></customerTaxNumber>`
    : "";

  // Cím parsálás
  const parseAddress = (addr) => {
    if (!addr) return { postalCode: "0000", city: "Budapest", detail: "-" };
    const m = addr.match(/^(\d{4})\s+(.+?),?\s+(.+)$/);
    if (m) return { postalCode: m[1], city: m[2], detail: m[3] };
    return { postalCode: "0000", city: "Budapest", detail: addr };
  };

  const sellerAddr = parseAddress(seller.address);
  const buyerAddr  = parseAddress(buyer.address);

  // Eladó adószám — első 8 jegy
  const sellerTaxRaw = (seller.taxNumber || NAV_TAX_NUMBER).replace(/[^0-9]/g, "").substring(0, 8);

  return `<?xml version="1.0" encoding="UTF-8"?>
<InvoiceData xmlns="http://schemas.nav.gov.hu/OSA/3.0/data"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://schemas.nav.gov.hu/OSA/3.0/data invoiceData.xsd">
  <invoiceNumber>${escXml(invoiceNumber)}</invoiceNumber>
  <invoiceIssueDate>${issueDate}</invoiceIssueDate>
  <completenessIndicator>false</completenessIndicator>
  <invoiceMain>
    <invoice>
      <invoiceHead>
        <supplierInfo>
          <supplierTaxNumber>
            <taxpayerTaxNumber>${sellerTaxRaw}</taxpayerTaxNumber>
            <vatCode>2</vatCode>
            <countyCode>02</countyCode>
          </supplierTaxNumber>
          <supplierName>${escXml(seller.company || seller.name || "Star Labs Kft.")}</supplierName>
          <supplierAddress>
            <simpleAddress>
              <countryCode>HU</countryCode>
              <postalCode>${sellerAddr.postalCode}</postalCode>
              <city>${escXml(sellerAddr.city)}</city>
              <additionalAddressDetail>${escXml(sellerAddr.detail)}</additionalAddressDetail>
            </simpleAddress>
          </supplierAddress>
          ${seller.bankAccount ? `<supplierBankAccountNumber>${escXml(seller.bankAccount)}</supplierBankAccountNumber>` : ""}
        </supplierInfo>
        <customerInfo>
          <customerVatStatus>${customerVatStatus}</customerVatStatus>
          ${customerTaxBlock}
          <customerName>${escXml(buyer.name || buyer.company || "Vevő")}</customerName>
          <customerAddress>
            <simpleAddress>
              <countryCode>HU</countryCode>
              <postalCode>${buyerAddr.postalCode}</postalCode>
              <city>${escXml(buyerAddr.city)}</city>
              <additionalAddressDetail>${escXml(buyerAddr.detail)}</additionalAddressDetail>
            </simpleAddress>
          </customerAddress>
        </customerInfo>
        <invoiceDetail>
          <invoiceCategory>NORMAL</invoiceCategory>
          <invoiceDeliveryDate>${deliveryDate}</invoiceDeliveryDate>
          <currencyCode>${currency}</currencyCode>
          <exchangeRate>1</exchangeRate>
          <paymentMethod>TRANSFER</paymentMethod>
          <paymentDate>${dueDate}</paymentDate>
          <invoiceAccountingDeliveryDate>${deliveryDate}</invoiceAccountingDeliveryDate>
        </invoiceDetail>
      </invoiceHead>
      <invoiceLines>
        <mergedItemIndicator>false</mergedItemIndicator>
        ${lineXmls}
      </invoiceLines>
      <invoiceSummary>
        <summaryNormal>
          <summaryByVatRate>
            <vatRate><vatPercentage>0.27</vatPercentage></vatRate>
            <vatRateNetData>
              <vatRateNetAmount>${netAmount}</vatRateNetAmount>
              <vatRateNetAmountHUF>${netAmount}</vatRateNetAmountHUF>
            </vatRateNetData>
            <vatRateVatData>
              <vatRateVatAmount>${vatAmount}</vatRateVatAmount>
              <vatRateVatAmountHUF>${vatAmount}</vatRateVatAmountHUF>
            </vatRateVatData>
            <vatRateGrossData>
              <vatRateGrossAmount>${grossAmount}</vatRateGrossAmount>
              <vatRateGrossAmountHUF>${grossAmount}</vatRateGrossAmountHUF>
            </vatRateGrossData>
          </summaryByVatRate>
          <invoiceNetAmount>${netAmount}</invoiceNetAmount>
          <invoiceNetAmountHUF>${netAmount}</invoiceNetAmountHUF>
          <invoiceVatAmount>${vatAmount}</invoiceVatAmount>
          <invoiceVatAmountHUF>${vatAmount}</invoiceVatAmountHUF>
        </summaryNormal>
        <summaryGrossData>
          <invoiceGrossAmount>${grossAmount}</invoiceGrossAmount>
          <invoiceGrossAmountHUF>${grossAmount}</invoiceGrossAmountHUF>
        </summaryGrossData>
      </invoiceSummary>
    </invoice>
  </invoiceMain>
</InvoiceData>`;
}

function escXml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ─────────────────────────────────────────────────────────────────
// submitNavInvoice — Éles Cloud Function: számla feltöltés NAV-ba
// POST body: { invoiceNumber, issueDate, seller, buyer, items }
// ─────────────────────────────────────────────────────────────────
exports.submitNavInvoice = onRequest(
  { region: "us-central1", timeoutSeconds: 60, cors: true },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }

    const { invoiceNumber, issueDate, seller, buyer, items } = req.body || {};

    if (!invoiceNumber || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: "invoiceNumber és items kötelező." });
    }

    try {
      const exchangeToken = await tokenExchange();
      const invoiceXml    = buildRealInvoiceXml({ invoiceNumber, issueDate: issueDate || todayStr(), seller: seller || {}, buyer: buyer || {}, items });
      const result        = await manageInvoice(exchangeToken, invoiceXml, invoiceNumber);

      return res.status(200).json({
        success:       result.funcCode === "OK",
        funcCode:      result.funcCode,
        transactionId: result.transactionId,
        invoiceNumber,
        message:       result.funcCode === "OK"
          ? `✅ NAV feltöltve: ${result.transactionId}`
          : `⚠️ NAV válasz: ${result.funcCode}`,
      });
    } catch (err) {
      console.error("[NAV] submitNavInvoice HIBA:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
);
