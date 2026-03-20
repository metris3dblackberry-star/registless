import { useState, useEffect, useCallback, useRef } from "react";
import { ref, push, onValue, off } from "firebase/database";
import { rtdb } from "../../firebase";
import {
  encryptMsg, decryptMsg, getPublicKey, getPrivateKey,
} from "../services/cryptoService";

function buildChatId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

export function useChat(myUid, partnerUid) {
  const [messages, setMessages] = useState([]);
  const [sending,  setSending]  = useState(false);
  const [error,    setError]    = useState(null);

  const chatId        = buildChatId(myUid, partnerUid);
  const messagesRef   = useRef(ref(rtdb, `chats/${chatId}/messages`));
  const keyCache      = useRef({});
  const myPrivRef     = useRef(null);

  // chatId változáskor frissítjük a ref-et
  useEffect(() => {
    messagesRef.current = ref(rtdb, `chats/${chatId}/messages`);
  }, [chatId]);

  // ── Kulcsok előtöltése ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function loadKeys() {
      try {
        const [myPriv, partnerPub, myPub] = await Promise.all([
          getPrivateKey(),
          getPublicKey(partnerUid),
          getPublicKey(myUid),
        ]);
        if (cancelled) return;
        if (myPriv)     myPrivRef.current          = myPriv;
        if (partnerPub) keyCache.current[partnerUid] = partnerPub;
        if (myPub)      keyCache.current[myUid]      = myPub;
      } catch (e) {
        console.warn("Kulcs betöltési hiba:", e.message);
      }
    }
    loadKeys();
    return () => { cancelled = true; };
  }, [myUid, partnerUid]);

  // ── Üzenetek figyelése ──────────────────────────────────────────
  useEffect(() => {
    if (!myUid || !partnerUid) return;

    const dbRef = ref(rtdb, `chats/${chatId}/messages`);

    const handleSnapshot = async (snapshot) => {
      const raw = snapshot.val();
      if (!raw) { setMessages([]); return; }

      const myPriv = myPrivRef.current;

      const decrypted = await Promise.all(
        Object.entries(raw).map(async ([id, msg]) => {
          if (!msg.encrypted) {
            return {
              id,
              text:      msg.text ?? "[régi üzenet]",
              senderUid: msg.senderId || msg.senderUid || "",
              timestamp: msg.timestamp,
              type:      msg.type ?? "text",
            };
          }
          try {
            let senderPub = keyCache.current[msg.senderId];
            if (!senderPub) {
              senderPub = await getPublicKey(msg.senderId);
              if (senderPub) keyCache.current[msg.senderId] = senderPub;
            }
            if (!senderPub || !myPriv) throw new Error("Hiányzó kulcs");
            const plaintext = decryptMsg(msg.ciphertext, msg.nonce, senderPub, myPriv);
            return {
              id, text: plaintext,
              senderUid: msg.senderId,
              timestamp: msg.timestamp,
              type: msg.type ?? "text",
              encrypted: true,
            };
          } catch {
            return {
              id, text: "🔒 Nem olvasható üzenet",
              senderUid: msg.senderId,
              timestamp: msg.timestamp,
              type: "error",
            };
          }
        })
      );

      setMessages(decrypted.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)));
    };

    onValue(dbRef, handleSnapshot);
    return () => off(dbRef);
  }, [chatId, myUid, partnerUid]);

  // ── Küldés ─────────────────────────────────────────────────────
  const send = useCallback(async (content, type = "text") => {
    if (!content || sending) return;
    setSending(true);
    try {
      const dbRef        = messagesRef.current;
      const recipientPub = keyCache.current[partnerUid] ?? await getPublicKey(partnerUid);
      const myPriv       = myPrivRef.current             ?? await getPrivateKey();

      if (!recipientPub || !myPriv) {
        await push(dbRef, {
          text: content, senderId: myUid, senderUid: myUid,
          timestamp: Date.now(), encrypted: false, type,
        });
      } else {
        if (!keyCache.current[partnerUid]) keyCache.current[partnerUid] = recipientPub;
        if (!myPrivRef.current)            myPrivRef.current             = myPriv;
        const { ciphertext, nonce } = encryptMsg(content, recipientPub, myPriv);
        await push(dbRef, {
          ciphertext, nonce, senderId: myUid, senderUid: myUid,
          timestamp: Date.now(), encrypted: true, type,
        });
      }
    } catch (e) {
      setError("Küldési hiba: " + e.message);
    } finally {
      setSending(false);
    }
  }, [myUid, partnerUid, sending]);

  return {
    messages,
    send,
    sending,
    sendMessage:  send,
    sendImage:    (b64) => send(b64, "image"),
    isSending:    sending,
    error,
    clearError:   () => setError(null),
  };
}
