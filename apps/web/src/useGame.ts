import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Action,
  Profile,
  Snapshot,
  Submission,
} from "../../../packages/shared/model";
export const uuid = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (
          Number(c) ^
          (crypto.getRandomValues(new Uint8Array(1))[0] &
            (15 >> (Number(c) / 4)))
        ).toString(16),
      );
class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}
async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  key?: string,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`/api${path}`, {
      signal: controller.signal,
      method,
      credentials: "same-origin",
      headers: {
        "X-Cliicker": "1",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json();
    if (!response.ok)
      throw new ApiError(
        data.error || "Le service ne répond pas.",
        response.status,
      );
    return data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(
      "Connexion interrompue. Tu peux réessayer sans doubler ton action.",
    );
  } finally {
    clearTimeout(timeout);
  }
}
export function useGame() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingClicks, setPendingClicks] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const [offlineGain, setOfflineGain] = useState(0);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [promotion, setPromotion] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ action: Action; key: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [submission, setSubmission] = useState<string | null>(null);
  const [profileStatus, setProfileStatus] = useState("");
  const [history, setHistory] = useState<Submission[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const queue = useRef(Promise.resolve());
  const unsent = useRef(0);
  const failedRef = useRef<typeof failed>(null);
  const queued = useRef(0);
  const serverAnchor = useRef({ time: Date.now(), at: performance.now() });
  const latest = useRef<Snapshot | null>(null);
  const lastClicks = useRef<number[]>([]);
  const notice = useCallback(
    (text: string) => setToast({ id: Date.now(), text }),
    [],
  );
  const accept = useCallback((s: Snapshot) => {
    latest.current = s;
    serverAnchor.current = { time: s.serverTime, at: performance.now() };
    setSnapshot(s);
    setClock(s.serverTime);
  }, []);
  const enqueue = useCallback((job: () => Promise<void>) => {
    const next = queue.current.then(job);
    queue.current = next.catch((e) => setError(e.message));
    return next;
  }, []);
  const refresh = useCallback(async () => {
    const s = await api<Snapshot>("/game");
    accept(s);
  }, [accept]);
  useEffect(() => {
    void api<{ profile: Profile | null }>("/session", "POST")
      .then(async (r) => {
        setProfile(r.profile);
        if (r.profile) {
          const s = await api<Snapshot>("/game");
          setOfflineGain(s.offlineGain);
          accept(s);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [accept]);
  useEffect(() => {
    const t = setInterval(() => {
      const a = serverAnchor.current;
      setClock(a.time + performance.now() - a.at);
    }, 250);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!profile) return;
    const poll = () => {
      if (!document.hidden && !failedRef.current)
        void enqueue(refresh).catch(() => {});
    };
    const t = setInterval(poll, 10000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [profile, enqueue, refresh]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!submission) return;
    let live = true;
    const check = async () => {
      try {
        const r = await api<{ replicated: boolean }>(
          `/profile/submissions/${submission}`,
        );
        if (live && r.replicated) {
          setSubmission(null);
          setProfileStatus("Fiche enregistrée dans les deux bases.");
          notice("Ta fiche est enregistrée.");
        }
      } catch {
        if (live)
          setProfileStatus(
            "Fiche conservée. Confirmation momentanément indisponible.",
          );
      }
    };
    void check();
    const t = setInterval(check, 2500);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [submission, notice]);
  const send = useCallback(
    (action: Action, key = uuid()) => {
      queued.current++;
      setBusy(true);
      void enqueue(async () => {
        try {
          if (failedRef.current) {
            if (action.type === "click")
              setPendingClicks((n) => Math.max(0, n - action.count));
            return;
          }
          const before = latest.current;
          const s = await api<Snapshot>("/actions", "POST", action, key);
          accept(s);
          setError("");
          if (action.type === "click")
            setPendingClicks((n) => Math.max(0, n - action.count));
          else {
            const text =
              action.type === "buy"
                ? "Amélioration achetée. Ton équipe prend de la vitesse !"
                : action.type === "start"
                  ? "Projet lancé. Ton équipe s’en occupe."
                  : action.type === "claim"
                    ? `Projet terminé : +${s.game.reputation - (before?.game.reputation || 0)} réputation !`
                    : action.type === "recruit"
                      ? "Un nouveau talent dans ton équipe !"
                      : action.type === "event"
                        ? "Bien joué. La vie asso continue !"
                        : "Une nouvelle étape commence !";
            notice(text);
            if (action.type === "promote")
              setPromotion(s.catalog.roles[s.game.role].name);
          }
        } catch (e) {
          const definitive =
            e instanceof ApiError &&
            e.status >= 400 &&
            e.status < 500 &&
            e.status !== 429;
          if (definitive) {
            if (action.type === "click")
              setPendingClicks((n) => Math.max(0, n - action.count));
          } else {
            failedRef.current = { action, key };
            setFailed({ action, key });
          }
          throw e;
        } finally {
          queued.current--;
          setBusy(queued.current > 0);
        }
      }).catch(() => {});
    },
    [accept, enqueue, notice],
  );
  const flush = useCallback(() => {
    if (unsent.current && !failedRef.current) {
      const count = unsent.current;
      unsent.current = 0;
      send({ type: "click", count });
    }
  }, [send]);
  useEffect(() => {
    const t = setInterval(flush, 500);
    return () => clearInterval(t);
  }, [flush]);
  const click = () => {
    if (failedRef.current || unsent.current >= 10 || queued.current > 2)
      return false;
    const now = performance.now();
    lastClicks.current = lastClicks.current.filter((t) => now - t < 1100);
    if (lastClicks.current.length >= 10) return false;
    lastClicks.current.push(now);
    unsent.current++;
    setPendingClicks((n) => n + 1);
    return true;
  };
  const act = (action: Action) => {
    if (failedRef.current || queued.current > 0) return;
    flush();
    send(action);
  };
  const retry = () => {
    const f = failedRef.current;
    if (!f) return;
    failedRef.current = null;
    setFailed(null);
    send(f.action, f.key);
  };
  const dismissError = () => {
    const action = failedRef.current?.action;
    if (action?.type === "click")
      setPendingClicks((n) => Math.max(0, n - action.count));
    failedRef.current = null;
    setFailed(null);
    setError("");
    if (profile) void enqueue(refresh).catch(() => {});
  };
  const saveProfile = async (value: Profile, key: string) => {
    setSaving(true);
    setError("");
    try {
      const r = await api<{
        profile: Profile;
        submissionId: string;
        replicated: boolean;
      }>("/profile", "PUT", value, key);
      setProfile(r.profile);
      setSubmission(r.replicated ? null : r.submissionId);
      setProfileStatus(
        r.replicated
          ? "Fiche enregistrée dans les deux bases."
          : "Enregistrement en cours…",
      );
      if (r.replicated) notice("Ta fiche est enregistrée.");
      await enqueue(refresh);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  };
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      setHistory(await api<Submission[]>("/profile/history"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setHistoryLoading(false);
    }
  }, []);
  // Display-only interpolation. Purchases and rewards still use the server transaction.
  const estimate = snapshot
    ? Math.min(
        1e14,
        snapshot.game.implication +
          (failed
            ? 0
            : (Math.min(15000, Math.max(0, clock - snapshot.serverTime)) *
                snapshot.rate *
                (snapshot.demo ? 3600 : 1)) /
              1000),
      ) /
        1000 +
      (failed ? 0 : pendingClicks)
    : 0;
  return {
    profile,
    snapshot,
    loading,
    error,
    busy,
    pendingClicks,
    clock,
    estimate,
    offlineGain,
    clearOffline: () => setOfflineGain(0),
    toast,
    promotion,
    closePromotion: () => setPromotion(null),
    failed,
    saving,
    submission,
    profileStatus,
    history,
    historyLoading,
    click,
    act,
    retry,
    dismissError,
    saveProfile,
    loadHistory,
    refresh: () => enqueue(refresh).catch(() => {}),
    notice,
  };
}
export type GameController = ReturnType<typeof useGame>;
