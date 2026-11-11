import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  Action,
  Profile,
  Snapshot,
  Submission,
} from "../../../packages/shared/model";
import "./style.css";
const uuid = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (
          Number(c) ^
          (crypto.getRandomValues(new Uint8Array(1))[0] &
            (15 >> (Number(c) / 4)))
        ).toString(16),
      );
const names: Record<string, string> = {
  lebarc: "LeBar(c)",
  bakaclub: "Bakaclub",
  arise: "ARISE",
};
const icons: Record<string, string> = {
  lebarc: "☕",
  bakaclub: "桜",
  arise: ">_",
};
const num = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 1,
    notation: n >= 1000000 ? "compact" : "standard",
  }).format(n);
const duration = (seconds: number) =>
  seconds <= 0
    ? "Prêt !"
    : seconds < 60
      ? `${Math.ceil(seconds)} s`
      : seconds < 3600
        ? `${Math.ceil(seconds / 60)} min`
        : `${Math.round(seconds / 360) / 10} h`;
async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  key?: string,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      "X-Cliicker": "1",
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Connexion interrompue.");
  return data;
}
function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [tab, setTab] = useState("campus");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(false);
  const [history, setHistory] = useState<Submission[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [submission, setSubmission] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const [selectedMember, setSelectedMember] = useState("");
  const [pendingClicks, setPendingClicks] = useState(0);
  const clicks = useRef(0);
  const chain = useRef(Promise.resolve());
  const [busy, setBusy] = useState(false);
  const formKey = useRef<string | null>(null);
  const failed = useRef<{ action: Action; key: string } | null>(null);
  const [retryAvailable, setRetryAvailable] = useState(false);
  const requestBusy = useRef(false);
  const accept = (s: Snapshot) => {
    setSnapshot(s);
    setClock(s.serverTime);
  };
  const firstSnapshot = useRef(true);
  const refresh = () =>
    api<Snapshot>("/game").then((s) => {
      if (firstSnapshot.current && s.offlineGain >= 1000)
        setNotice(
          `Ton équipe a gagné ${num(s.offlineGain / 1000)} points pendant ton absence.`,
        );
      firstSnapshot.current = false;
      accept(s);
    });
  const enqueue = (job: () => Promise<void>) => {
    chain.current = chain.current.then(job).catch((e) => setError(e.message));
  };
  useEffect(() => {
    api<{ profile: Profile | null }>("/session", "POST")
      .then(async (r) => {
        setProfile(r.profile);
        if (r.profile) await refresh();
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    const t = setInterval(() => setClock((c) => c + 1000), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!profile) return;
    const t = setInterval(() => {
      if (!document.hidden) enqueue(refresh);
    }, 10000);
    return () => clearInterval(t);
  }, [profile]);
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
          setNotice("Fiche enregistrée dans les deux bases.");
        }
      } catch (e) {
        if (live)
          setNotice(
            "Ta fiche est conservée. La confirmation des deux bases est momentanément indisponible.",
          );
      }
    };
    void check();
    const t = setInterval(check, 2500);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [submission]);
  function send(action: Action, key: string = uuid()) {
    enqueue(async () => {
      if (failed.current) return;
      requestBusy.current = true;
      setBusy(true);
      setError("");
      try {
        accept(await api<Snapshot>("/actions", "POST", action, key));
      } catch (e) {
        failed.current = { action, key };
        setRetryAvailable(true);
        throw e;
      } finally {
        requestBusy.current = false;
        setBusy(false);
      }
    });
  }
  useEffect(() => {
    const t = setInterval(() => {
      if (clicks.current && !failed.current && !requestBusy.current) {
        const count = clicks.current;
        clicks.current = 0;
        setPendingClicks(0);
        send({ type: "click", count });
      }
    }, 500);
    return () => clearInterval(t);
  }, []);
  function act(action: Action) {
    if (clicks.current) {
      const count = clicks.current;
      clicks.current = 0;
      setPendingClicks(0);
      send({ type: "click", count });
    }
    send(action);
  }
  function retry() {
    const f = failed.current;
    if (f) {
      failed.current = null;
      setRetryAvailable(false);
      send(f.action, f.key);
    }
  }
  function dismiss() {
    failed.current = null;
    setRetryAvailable(false);
    setError("");
    enqueue(refresh);
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const value = {
      nickname: String(data.get("nickname")),
      associationId: String(data.get("associationId")),
      presentation: String(data.get("presentation")),
    };
    setSaving(true);
    setError("");
    formKey.current ||= uuid();
    try {
      const r = await api<{
        profile: Profile;
        submissionId: string;
        replicated: boolean;
      }>("/profile", "PUT", value, formKey.current);
      setProfile(r.profile);
      setSubmission(r.replicated ? null : r.submissionId);
      setNotice(
        r.replicated
          ? "Fiche enregistrée dans les deux bases."
          : "Enregistrement en cours dans les deux bases…",
      );
      formKey.current = null;
      setEditing(false);
      setHistoryLoaded(false);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function loadHistory() {
    try {
      setHistory(await api<Submission[]>("/profile/history"));
      setHistoryLoaded(true);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const g = snapshot?.game;
  const c = snapshot?.catalog;
  const form = (
    <form
      className="profile-form"
      onSubmit={save}
      onChange={() => {
        formKey.current = null;
      }}
    >
      <label>
        Ton pseudo
        <input
          name="nickname"
          minLength={2}
          maxLength={32}
          required
          defaultValue={profile?.nickname}
          placeholder="Le futur prez"
          autoComplete="nickname"
        />
      </label>
      <fieldset>
        <legend>Ton asso de cœur</legend>
        <div className="association-choices">
          {Object.entries(names).map(([id, name]) => (
            <label className="association-option" key={id}>
              <input
                type="radio"
                name="associationId"
                value={id}
                required
                defaultChecked={
                  profile ? profile.associationId === id : id === "lebarc"
                }
                disabled={!!profile && profile.associationId !== id}
              />
              <span className="asso-symbol">{icons[id]}</span>
              <strong>{name}</strong>
              <small>
                {id === "lebarc"
                  ? "Projets plus rapides"
                  : id === "bakaclub"
                    ? "Plus de réputation"
                    : "Plus de gains passifs"}
              </small>
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        Pourquoi tu rejoins cette asso ?
        <textarea
          name="presentation"
          minLength={10}
          maxLength={500}
          required
          rows={3}
          defaultValue={profile?.presentation}
          placeholder="Je venais juste à la réunion…"
        />
        <small>
          10 à 500 caractères. Invente ton personnage, pas besoin de ton
          identité réelle.
        </small>
      </label>
      <button className="primary" disabled={saving}>
        {saving
          ? "Enregistrement…"
          : profile
            ? "Enregistrer ma fiche"
            : "Entrer dans la vie associative →"}
      </button>
      {profile && (
        <button
          type="button"
          className="quiet"
          onClick={() => setEditing(false)}
        >
          Annuler
        </button>
      )}
    </form>
  );
  return (
    <>
      <header className="topbar">
        <a className="brand" href="/">
          cli<span>ii</span>cker<span className="brand-dot">✳</span>
        </a>
        <span className="top-label">LA VIE ASSO, VERSION IDLE</span>
        <span className="solo">
          <i /> Partie solo
        </span>
      </header>
      <main>
        {error && (
          <div className="alert" role="alert">
            {error}{" "}
            {retryAvailable ? (
              <>
                <button onClick={retry}>Réessayer la même action</button>
                <button onClick={dismiss}>Fermer et actualiser</button>
              </>
            ) : (
              <button onClick={() => location.reload()}>Recharger</button>
            )}
          </div>
        )}
        {loading ? (
          <div className="loading">On retrouve les clés du local…</div>
        ) : !profile ? (
          <div className="welcome">
            <section>
              <p className="eyebrow">BIENVENUE À L’ENSIIE</p>
              <h1>
                Tu venais juste
                <br />à une réunion.
              </h1>
              <p className="lead">
                Un stand. Une asso. Toute une promo.
                <br />
                Et si le prochain prez du BdE, c’était toi ?
              </p>
              <div className="welcome-stamp">
                7 rôles
                <br />
                <strong>Une aventure</strong>
                <br />à ton rythme
              </div>
              <p className="muted">
                Quelques minutes par jour. Ton équipe continue pendant ton
                absence.
              </p>
            </section>
            <section className="paper">
              <div className="paper-heading">
                <span>01 / LA FICHE</span>
                <span>✎</span>
              </div>
              <h2>Tout commence par toi.</h2>
              {form}
            </section>
          </div>
        ) : !snapshot ? (
          <section className="paper">
            <h2>Retrouvons ta partie.</h2>
            <button className="primary" onClick={() => enqueue(refresh)}>
              Charger la sauvegarde
            </button>
          </section>
        ) : (
          <>
            <div className="player-heading">
              <div>
                <p className="eyebrow">
                  PROMO ENSIIE / {names[g!.associationId]}
                </p>
                <h1>
                  Salut, {profile.nickname}
                  <span className="handwave">✳</span>
                </h1>
                <p className="muted">
                  {c!.roles[g!.role].name} ·{" "}
                  {g!.role < 4
                    ? "Une petite asso, de grandes idées."
                    : "Le campus compte sur toi."}
                </p>
              </div>
              <button
                className="profile-chip"
                onClick={() => {
                  setTab("fiche");
                  setEditing(true);
                }}
              >
                {icons[g!.associationId]} Ma fiche ↗
              </button>
            </div>
            {snapshot.demo && (
              <div className="demo-banner">
                MODE SOUTENANCE · Temps et gains passifs × 3 600 · Partie
                distincte
              </div>
            )}
            {notice && (
              <div className="notice" role="status">
                {submission ? "◌" : "✓"} {notice}
              </div>
            )}
            <section className="stats" aria-label="Ressources">
              <div>
                <span>IMPLICATION</span>
                <strong>
                  {num(g!.implication / 1000)} <small>pts</small>
                </strong>
                <em>
                  +{num(snapshot.rate / 1000)} / seconde
                  {snapshot.demo ? " × 3 600" : ""}
                </em>
              </div>
              <div>
                <span>RÉPUTATION</span>
                <strong>
                  {num(g!.reputation)} <small>★</small>
                </strong>
                <em>Les projets font parler de toi</em>
              </div>
              <div>
                <span>TON PARCOURS</span>
                <strong>
                  {g!.role + 1}
                  <small> / 7</small>
                </strong>
                <em>
                  {g!.role === 6
                    ? "Bienvenue à la présidence !"
                    : `Prochaine étape : ${c!.roles[g!.role + 1].name}`}
                </em>
              </div>
            </section>
            <nav className="tabs" aria-label="Navigation du jeu">
              {[
                ["campus", "Mon campus"],
                ["projets", "Les projets"],
                ["equipe", "Mon équipe"],
                ["journal", "La vie asso"],
                ["fiche", "Ma fiche"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  aria-current={tab === id ? "page" : undefined}
                  onClick={() => {
                    setTab(id);
                    setEditing(false);
                  }}
                >
                  {label}
                </button>
              ))}
            </nav>
            {tab === "campus" && (
              <div className="campus-grid">
                <section className="scene-card">
                  <div className="scene-top">
                    <span>LE LOCAL · NIVEAU {g!.role + 1}</span>
                    <span>{names[g!.associationId]}</span>
                  </div>
                  <div
                    className={`scene stage-${Math.min(g!.role, 3)}`}
                    aria-hidden="true"
                  >
                    <div className="poster">
                      <small>OBJECTIF</small>
                      <b>{g!.role >= 4 ? "BdE" : "LA VIE\nASSO"}</b>
                      <span>ça commence ici ↗</span>
                    </div>
                    <div className="board">
                      {g!.role === 6
                        ? "ON L’A FAIT !"
                        : g!.role >= 3
                          ? "LE GRAND PROJET"
                          : "RÉUNION À 18H"}
                      <div className="sticky">
                        {g!.role >= 2
                          ? "penser au budget"
                          : "ramener du scotch"}
                      </div>
                    </div>
                    <div className="plant">♧</div>
                    <div className="desk">
                      <div className="laptop">
                        <span>{icons[g!.associationId]}</span>
                      </div>
                      <div className="mug">☕</div>
                      <div className="papers" />
                    </div>
                    <div className="floor" />
                  </div>
                  <div className="click-area">
                    <span className="eyebrow">
                      UN PETIT GESTE, UN GRAND DÉBUT
                    </span>
                    <button
                      className="click-button"
                      disabled={retryAvailable}
                      onClick={() => {
                        if (clicks.current < 10) {
                          clicks.current++;
                          setPendingClicks(clicks.current);
                        }
                      }}
                    >
                      S’impliquer <span>+1</span>
                    </button>
                    <small>
                      {pendingClicks
                        ? `${pendingClicks} clic(s) en cours d’envoi…`
                        : "Clic ou touche Entrée · +1 implication"}
                    </small>
                  </div>
                </section>
                <aside className="stack">
                  <section className="paper promotion">
                    <p className="eyebrow">LA PROCHAINE ÉTAPE</p>
                    <h2>
                      {g!.role === 6
                        ? "Prez du BdE. Rien que ça."
                        : c!.roles[g!.role + 1].name}
                    </h2>
                    {g!.role === 6 ? (
                      <>
                        <p>{profile.presentation}</p>
                        <p>
                          {g!.completed.length} projets distincts et{" "}
                          {g!.members.length} équipiers. La promo se souviendra
                          de toi.
                        </p>
                      </>
                    ) : (
                      <>
                        <progress
                          value={Math.min(
                            g!.reputation,
                            c!.roles[g!.role + 1].reputation,
                          )}
                          max={c!.roles[g!.role + 1].reputation}
                        />
                        <p>
                          {g!.reputation} / {c!.roles[g!.role + 1].reputation}{" "}
                          réputation
                        </p>
                        {snapshot.requirements.length ? (
                          <ul>
                            {snapshot.requirements.map((r) => (
                              <li key={r}>{r}</li>
                            ))}
                          </ul>
                        ) : (
                          <p>Tout est prêt. À toi de jouer !</p>
                        )}
                        <button
                          className="primary"
                          disabled={
                            busy ||
                            retryAvailable ||
                            !!snapshot.requirements.length
                          }
                          onClick={() => act({ type: "promote" })}
                        >
                          {g!.role === 5
                            ? "Lancer l’élection"
                            : "Passer au rôle suivant"}{" "}
                          ↗
                        </button>
                      </>
                    )}
                  </section>
                  <section className="note-card">
                    <span>✎ LE CONSEIL DU LOCAL</span>
                    <p>
                      {g!.role === 0
                        ? "20 points pour ton premier planning. Ensuite, ton asso travaille même quand tu fermes l’onglet."
                        : "Les projets longs sont parfaits pour une journée de cours. Les récompenses t’attendent, sans expiration."}
                    </p>
                  </section>
                </aside>
                <section className="upgrades">
                  <div className="section-title">
                    <h2>Un peu mieux organisé.</h2>
                    <span>PRODUCTION PASSIVE</span>
                  </div>
                  <div className="card-grid">
                    {c!.upgrades.map((u) => {
                      const level = g!.upgrades[u.id] || 0;
                      const cost = Math.ceil(u.cost * 1.15 ** level);
                      return (
                        <article className="paper upgrade" key={u.id}>
                          <span className="card-kicker">
                            {g!.role < u.role
                              ? `Dès ${c!.roles[u.role].name}`
                              : `NIVEAU ${level} / 50`}
                          </span>
                          <h3>{u.name}</h3>
                          <p>{u.description}</p>
                          <span className="effect">
                            +{num(u.rate / 1000)} / s par niveau
                          </span>
                          <button
                            disabled={
                              busy ||
                              retryAvailable ||
                              g!.role < u.role ||
                              g!.implication < cost * 1000 ||
                              level >= 50
                            }
                            onClick={() => act({ type: "buy", id: u.id })}
                          >
                            {level >= 50
                              ? "Au maximum"
                              : `Améliorer · ${num(cost)} pts`}
                          </button>
                        </article>
                      );
                    })}
                  </div>
                </section>
              </div>
            )}
            {tab === "projets" && (
              <>
                <div className="section-title">
                  <h2>De l’idée au « on l’a fait ».</h2>
                  <span>
                    {g!.runs.filter((r) => r.endsAt > clock).length} /{" "}
                    {g!.role >= 3 ? 2 : 1} PROJETS ACTIFS
                  </span>
                </div>
                <div className="runs">
                  {g!.runs.map((r) => (
                    <article className="paper run" key={r.id}>
                      <div>
                        <span className="card-kicker">
                          {r.endsAt <= clock ? "À RÉCUPÉRER" : "EN COURS"}
                        </span>
                        <h3>{r.name}</h3>
                        <small>
                          +{r.reputation} réputation ·{" "}
                          {duration((r.endsAt - clock) / 1000)}
                        </small>
                      </div>
                      <button
                        className="primary"
                        disabled={busy || retryAvailable || r.endsAt > clock}
                        onClick={() => act({ type: "claim", id: r.id })}
                      >
                        Récupérer
                      </button>
                    </article>
                  ))}
                </div>
                <label className="member-select">
                  Équipier pour le prochain projet
                  <select
                    value={selectedMember}
                    onChange={(e) => setSelectedMember(e.target.value)}
                  >
                    <option value="">Sans équipier</option>
                    {c!.members
                      .filter((m) => g!.members.includes(m.id))
                      .map((m) => (
                        <option
                          key={m.id}
                          value={m.id}
                          disabled={g!.runs.some(
                            (r) => r.member === m.id && r.endsAt > clock,
                          )}
                        >
                          {m.name}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="card-grid">
                  {c!.projects
                    .filter(
                      (p) =>
                        !p.association || p.association === g!.associationId,
                    )
                    .map((p) => {
                      const member = c!.members.find(
                        (m) => m.id === selectedMember,
                      );
                      const cost = Math.ceil(
                        p.cost * (member?.effect === "cost" ? 0.9 : 1),
                      );
                      const seconds = Math.ceil(
                        (p.seconds *
                          (1 -
                            (g!.associationId === "lebarc" ? 0.1 : 0) -
                            (member?.effect === "time" ? 0.1 : 0))) /
                          (snapshot.demo ? 3600 : 1),
                      );
                      const reputation = Math.round(
                        p.reputation *
                          (1 +
                            (g!.associationId === "bakaclub" ? 0.1 : 0) +
                            (member?.effect === "reputation" ? 0.1 : 0)),
                      );
                      const done =
                        p.once &&
                        (g!.completed.includes(p.id) ||
                          g!.runs.some((r) => r.projectId === p.id));
                      return (
                        <article className="paper project" key={p.id}>
                          <span className="card-kicker">
                            {g!.role < p.role
                              ? `Dès ${c!.roles[p.role].name}`
                              : p.association
                                ? names[p.association]
                                : p.role >= 4
                                  ? "OBJECTIF BdE"
                                  : "TOUTES LES ASSOS"}
                          </span>
                          <h3>{p.name}</h3>
                          <p>{p.description}</p>
                          <div className="project-meta">
                            <span>
                              ◷ {seconds === 0 ? "Immédiat" : duration(seconds)}
                            </span>
                            <span>★ +{reputation}</span>
                          </div>
                          <button
                            disabled={
                              busy ||
                              retryAvailable ||
                              !!done ||
                              g!.role < p.role ||
                              g!.implication < cost * 1000 ||
                              g!.runs.filter((r) => r.endsAt > clock).length >=
                                (g!.role >= 3 ? 2 : 1) ||
                              (!!selectedMember &&
                                g!.runs.some(
                                  (r) =>
                                    r.member === selectedMember &&
                                    r.endsAt > clock,
                                ))
                            }
                            onClick={() =>
                              act({
                                type: "start",
                                id: p.id,
                                ...(selectedMember
                                  ? { member: selectedMember }
                                  : {}),
                              })
                            }
                          >
                            {done
                              ? "Déjà lancé ou accompli ✓"
                              : `Lancer · ${num(cost)} pts`}
                          </button>
                        </article>
                      );
                    })}
                </div>
              </>
            )}
            {tab === "equipe" && (
              <>
                <div className="section-title">
                  <h2>Personne n’organise tout seul.</h2>
                  <span>DÈS LE BUREAU D’ASSO</span>
                </div>
                <div className="card-grid">
                  {c!.members.map((m, i) => (
                    <article className="paper team-card" key={m.id}>
                      <div className={`avatar avatar-${i}`}>
                        {["▦", "✂", "☏"][i]}
                      </div>
                      <h3>{m.name}</h3>
                      <p>{m.description}</p>
                      <button
                        disabled={
                          busy ||
                          retryAvailable ||
                          g!.role < 2 ||
                          g!.members.includes(m.id) ||
                          g!.implication < m.cost * 1000
                        }
                        onClick={() => act({ type: "recruit", id: m.id })}
                      >
                        {g!.members.includes(m.id)
                          ? "Dans ton équipe ✓"
                          : `Recruter · ${m.cost} pts`}
                      </button>
                    </article>
                  ))}
                </div>
                <p className="muted">
                  Un équipier par projet. Choisis son affectation dans l’onglet
                  Les projets.
                </p>
              </>
            )}
            {tab === "journal" && (
              <div className="journal-grid">
                <section className="paper">
                  <p className="eyebrow">LE PETIT IMPRÉVU</p>
                  {g!.event ? (
                    (() => {
                      const e = c!.events.find(
                        (e) => e.id === g!.event!.definitionId,
                      )!;
                      return (
                        <>
                          <h2>{e.title}</h2>
                          <p>{e.text}</p>
                          {e.choices.map((choice, i) => (
                            <button
                              className="event-choice"
                              key={i}
                              disabled={busy || retryAvailable}
                              onClick={() =>
                                act({
                                  type: "event",
                                  id: g!.event!.id,
                                  choice: i,
                                })
                              }
                            >
                              {choice.text}
                              <small>
                                {choice.reputation
                                  ? `+${choice.reputation * (g!.role + 1)} réputation`
                                  : `+${choice.implication * (g!.role + 1)} implication`}
                              </small>
                            </button>
                          ))}
                        </>
                      );
                    })()
                  ) : (
                    <>
                      <h2>Pour une fois, tout roule.</h2>
                      <p>
                        Les imprévus arrivent au fil de ton aventure. Rien à
                        surveiller : ils attendront ton retour.
                      </p>
                    </>
                  )}
                </section>
                <section className="paper">
                  <p className="eyebrow">LE CARNET DE BORD</p>
                  <h2>Ça avance, cette histoire.</h2>
                  {g!.journal.length ? (
                    <ol className="journal">
                      {g!.journal.map((entry, i) => (
                        <li key={i}>
                          <time>
                            {new Date(entry.at).toLocaleString("fr-FR", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </time>
                          <p>{entry.text}</p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p>Ta première action sera le début de l’histoire.</p>
                  )}
                </section>
              </div>
            )}
            {tab === "fiche" && (
              <div className="journal-grid">
                <section className="paper">
                  <p className="eyebrow">TA FICHE D’IIENS</p>
                  <h2>{profile.nickname}</h2>
                  {editing ? (
                    form
                  ) : (
                    <>
                      <p className="association-title">
                        {icons[profile.associationId]}{" "}
                        {names[profile.associationId]}
                      </p>
                      <p className="presentation">{profile.presentation}</p>
                      <button onClick={() => setEditing(true)}>
                        Modifier ma présentation
                      </button>
                    </>
                  )}
                </section>
                <section className="paper">
                  <p className="eyebrow">LES VERSIONS DE TON HISTOIRE</p>
                  <h2>Tu as fait du chemin.</h2>
                  <button onClick={loadHistory}>Actualiser l’historique</button>
                  {historyLoaded && history.length === 0 && (
                    <p>
                      La première version arrive. La réplication peut prendre
                      quelques secondes.
                    </p>
                  )}
                  {history.map((h) => (
                    <article className="history-entry" key={h.submissionId}>
                      <span className="card-kicker">
                        VERSION {h.revision} ·{" "}
                        {new Date(h.createdAt).toLocaleDateString("fr-FR")}
                      </span>
                      <h3>
                        {h.nickname} · {names[h.associationId]}
                      </h3>
                      <p className="presentation">{h.presentation}</p>
                    </article>
                  ))}
                </section>
              </div>
            )}
            <footer>
              Un jeu solo imaginé autour de l’ENSIIE. Scénarios fictifs,
              motivation réelle.
              <span>
                Sauvegarde automatique · jusqu’à 24 h de gains hors ligne
              </span>
            </footer>
          </>
        )}
      </main>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
