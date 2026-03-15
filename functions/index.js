/* eslint-disable */
const { onRequest } = require("firebase-functions/v2/https");
const fetch = require("node-fetch");

const ANTHROPIC_KEY = "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";

exports.ocrAnalyze = onRequest(
  { region: "us-central1", cors: true },
  async (req, res) => {
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

    const text = req.body && req.body.text;
    if (!text || !text.trim()) { res.status(400).json({ error: "Nincs szöveg" }); return; }

    try {
      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 400,
          messages: [{
            role: "user",
            content: "A következő szöveg egy névjegyről lett OCR-rel beolvasva. Adj vissza CSAK egy JSON objektumot, semmi mást:\n\n" + text + "\n\nJSON struktúra:\n{\"name\":\"\",\"company\":\"\",\"address\":\"\",\"email\":\"\",\"taxNumber\":\"\",\"bankAccount\":\"\",\"phone\":\"\"}",
          }],
        }),
      });

      const data = await anthropicRes.json();
      const raw = (data && data.content && data.content[0] && data.content[0].text) || "";
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      res.status(200).json(parsed);
    } catch (e) {
      res.status(500).json({ error: "AI elemzés sikertelen", detail: e.message });
    }
  }
);
