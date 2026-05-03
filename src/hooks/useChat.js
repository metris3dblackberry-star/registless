// useChat.js — @react-native-firebase natív SDK
import { useState, useEffect, useCallback, useRef } from "react";
import { rtdb } from "../../firebase";
import {
  encryptMsg, decryptMsg, getPublicKey, getPrivateKey,
} from "../services/cryptoService";

function buildChatId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

export function useChat(myUid, partnerUid) {
  console.log("🔍 useChat myUid=" + (myUid||"null") + " partnerUid=" + (partnerUid||"null") + " chatId=" + buildChatId(myUid||"a", partnerUid||"b"));
  
  const [messages, setMessages] = useState([]);
  const [sending,  setSending]  = useState(false);
  const [error,    setError]    = useState(null);

  const chatId   = buildChatId(myUid || "a", partnerUid || "b");
  const keyCache = useRef({});
  const myPrivRef = useRef(null);

  // ── Kulcsok előtöltése ──────────────────────────────────────────
  useEffect(() => {
    if (!myUid || !partnerUid) return;
    let cancelled = false;
    async function loadKeys() {
      try {
        const [myPriv, partnerPub, myPub] = await Promise.all([
          getPrivateKey(),
          getPublicKey(partnerUid),
          getPublicKey(myUid),
        ]);
        if (cancelled) return;
        if (myPriv)     myPrivRef.current            = myPriv;
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

    let dbRef;
    try {
     dbRef = rtdb.ref(`chats/${chatId}/messages`);
    } catch (e) {
      console.warn("Firebase ref hiba:", e.message);
      return;
    }

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
            return { id, text: plaintext, senderUid: msg.senderId, timestamp: msg.timestamp, type: msg.type ?? "text", encrypted: true };
          } catch {
            return { id, text: "🔒 Nem olvasható üzenet", senderUid: msg.senderId, timestamp: msg.timestamp, type: "error" };
          }
        })
      );
      setMessages(decrypted.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)));
    };

    try {
      dbRef.on("value", handleSnapshot);
    } catch (e) {
      console.warn("Firebase on hiba:", e.message);
    }
    return () => {
      try { dbRef.off("value", handleSnapshot); } catch (e) {}
    };
  }, [chatId, myUid, partnerUid]);

  // ── Küldés ─────────────────────────────────────────────────────
  const send = useCallback(async (content, type = "text") => {
    if (!content || sending) return;

    const optimisticId = `local-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: optimisticId,
      text: content,
      senderUid: myUid,
      timestamp: Date.now(),
      type,
      encrypted: false,
    }]);
    setSending(true);

    try {
      const dbRef = rtdb.ref(`chats/${chatId}/messages`);
      // ÚJ:
	let recipientPub = keyCache.current[partnerUid] ?? null;
	let myPriv = myPrivRef.current ?? null;
	try {
	  if (!recipientPub) recipientPub = await getPublicKey(partnerUid);
	  if (!myPriv) myPriv = await getPrivateKey();
} catch (e) {
  console.warn("Kulcs lekérés sikertelen, titkosítás nélkül küld:", e.message);
}
      if (!recipientPub || !myPriv) {
        await dbRef.push({
          text: content, senderId: myUid, senderUid: myUid,
          timestamp: Date.now(), encrypted: false, type,
        });
      } else {
        if (!keyCache.current[partnerUid]) keyCache.current[partnerUid] = recipientPub;
        if (!myPrivRef.current)            myPrivRef.current             = myPriv;
        const { ciphertext, nonce } = encryptMsg(content, recipientPub, myPriv);
        await dbRef.push({
          ciphertext, nonce, senderId: myUid, senderUid: myUid,
          timestamp: Date.now(), encrypted: true, type,
        });
      }
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
    } catch (e) {
      console.warn("Firebase push sikertelen, lokálisan maradt:", e.message);
    } finally {
      setSending(false);
    }
  }, [myUid, partnerUid, sending, chatId]);

  return {
    messages,
    send,
    sending,
    sendMessage: send,
    sendImage:   (b64) => send(b64, "image"),
    isSending:   sending,
    error,
    clearError:  () => setError(null),
  };
}
