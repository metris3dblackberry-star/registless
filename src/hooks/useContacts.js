// ─────────────────────────────────────────────────────────────────
// useContacts.js — Egységes partner kezelés hook
// ─────────────────────────────────────────────────────────────────
import { useState, useCallback } from "react";
import { createContact, addActivity, getChannelId } from "../models/Contact";

export function useContacts(initialContacts = []) {
  const [contacts, setContacts] = useState(initialContacts);

  const makeId = (prefix = "c") =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // Összes contact
  const getAll = useCallback(() => contacts, [contacts]);

  // Csak seller_customer role-ok
  const getSellerCustomers = useCallback(
    () => contacts.filter((c) => c.myRoleInRelation === "seller"),
    [contacts]
  );

  // Csak buyer_connection role-ok
  const getBuyerConnections = useCallback(
    () => contacts.filter((c) => c.myRoleInRelation === "buyer"),
    [contacts]
  );

  // ID alapján keresés
  const getById = useCallback(
    (id) => contacts.find((c) => c.id === id) || null,
    [contacts]
  );

  // Új contact hozzáadása
  const addContact = useCallback((params) => {
    const hasRealUid = params.registlessUid &&
      !params.registlessUid.startsWith("buyer-main") &&
      !params.registlessUid.startsWith("seller-main");

    // Duplikátum ellenőrzés csak valódi UID-ra
    if (hasRealUid) {
      const existing = contacts.find((c) => c.registlessUid === params.registlessUid);
      if (existing) return existing;
    }

    const newContact = createContact({
      id: makeId("contact"),
      ...params,
    });

    setContacts((prev) => [newContact, ...prev]);
    return newContact;
  }, [contacts]);

  // Contact frissítése
  const updateContact = useCallback((id, updates) => {
    setContacts((prev) =>
      prev.map((c) => c.id === id ? { ...c, ...updates, lastActivityAt: Date.now() } : c)
    );
  }, []);

  // Contact törlése
  const deleteContact = useCallback((id) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // Activity hozzáadása
  const logActivity = useCallback((contactId, activity) => {
    setContacts((prev) =>
      prev.map((c) => c.id === contactId ? addActivity(c, activity) : c)
    );
  }, []);

  // Számla hozzáadása
  const addInvoice = useCallback((contactId, invoice) => {
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId
          ? {
              ...c,
              invoices: [invoice, ...c.invoices],
              openItems: c.openItems.filter((oi) =>
                !invoice.appointmentIds?.includes(oi.appointmentId)
              ),
              lastActivityAt: Date.now(),
            }
          : c
      )
    );
  }, []);

  // OpenItem hozzáadása (gyűjtőhöz)
  const addOpenItem = useCallback((contactId, item) => {
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId
          ? { ...c, openItems: [item, ...(c.openItems || [])], lastActivityAt: Date.now() }
          : c
      )
    );
  }, []);

  // Időpont hozzáadása
  const addAppointment = useCallback((contactId, appt) => {
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId
          ? { ...c, appointments: [appt, ...(c.appointments || [])], lastActivityAt: Date.now() }
          : c
      )
    );
  }, []);

  // Foglalási kérelem hozzáadása (buyer oldal)
  const addBookingRequest = useCallback((contactId, request) => {
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId
          ? {
              ...c,
              bookingRequests: [request, ...(c.bookingRequests || [])],
              calendar: [request, ...(c.calendar || [])],
              lastActivityAt: Date.now(),
            }
          : c
      )
    );
  }, []);

  // Draft mentése
  const saveDraft = useCallback((contactId, key, data) => {
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId
          ? { ...c, drafts: { ...(c.drafts || {}), [key]: data } }
          : c
      )
    );
  }, []);

  return {
    contacts,
    setContacts,
    getAll,
    getSellerCustomers,
    getBuyerConnections,
    getById,
    addContact,
    updateContact,
    deleteContact,
    logActivity,
    addInvoice,
    addOpenItem,
    addAppointment,
    addBookingRequest,
    saveDraft,
  };
}
