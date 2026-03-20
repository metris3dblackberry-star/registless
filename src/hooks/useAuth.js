// ─────────────────────────────────────────────────────────────────
// useAuth.js — Auth + Account hook
// ─────────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { onAuthChange, getAccount } from "../services/authService"; // ← onAuthChange (nem onAuthChanged!)
import { getEffectivePlan, getPermissions, isTrialActive, trialDaysLeft } from "../models/accountModel";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const acc = await getAccount(firebaseUser.uid);
        setAccount(acc);
      } else {
        setAccount(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const permissions    = getPermissions(account);
  const effectivePlan  = getEffectivePlan(account);
  const trialActive    = isTrialActive(account);
  const daysLeft       = trialDaysLeft(account);

  function can(feature) {
    return !!permissions[feature];
  }

  return {
    user, account, loading,
    isLoggedIn: !!user,
    effectivePlan, permissions,
    trialActive, daysLeft,
    can,
  };
}
