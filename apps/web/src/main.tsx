import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Project } from "../../../packages/shared/model";
import { useGame, type GameController } from "./useGame";
import {
  Icon,
  AssoMark,
  Brand,
  Modal,
  Scene,
  names,
  num,
  duration,
  type IconName,
} from "./ui";
import { ProfileForm } from "./ProfileForm";
import "./style.css";
type Tab = "campus" | "projets" | "equipe" | "journal" | "fiche";
const tabs: { id: Tab; label: string; short: string; icon: IconName }[] = [
  { id: "campus", label: "Mon campus", short: "Campus", icon: "campus" },
  { id: "projets", label: "Les projets", short: "Projets", icon: "projects" },
  { id: "equipe", label: "Mon équipe", short: "Équipe", icon: "team" },
  { id: "journal", label: "La vie asso", short: "Vie asso", icon: "journal" },
  { id: "fiche", label: "Ma fiche", short: "Profil", icon: "profile" },
];
function useReducedMotion() {
  const [manual, setManual] = useState(() => {
    try {
      return localStorage.getItem("cliicker-motion") === "reduced";
    } catch {
      return false;
    }
  });
  const [system, setSystem] = useState(
    matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const m = matchMedia("(prefers-reduced-motion: reduce)");
    const listener = () => setSystem(m.matches);
    m.addEventListener("change", listener);
    return () => m.removeEventListener("change", listener);
  }, []);
  return {
    reduced: manual || system,
    manual,
    toggle: () =>
      setManual((v) => {
        try {
          localStorage.setItem("cliicker-motion", !v ? "reduced" : "full");
        } catch {}
        return !v;
      }),
  };
}
function App() {
  const game = useGame();
  const [tab, setTab] = useState<Tab>("campus");
  const [editing, setEditing] = useState(false);
  const [journey, setJourney] = useState(false);
  const motion = useReducedMotion();
  const heading = useRef<HTMLHeadingElement>(null);
  const navigate = (next: Tab) => {
    setTab(next);
    setEditing(false);
    window.scrollTo({
      top: 0,
      behavior: motion.reduced ? "instant" : "smooth",
    });
    requestAnimationFrame(() =>
      heading.current?.focus({ preventScroll: true }),
    );
  };
  useEffect(() => {
    if (tab === "fiche" && game.profile) void game.loadHistory();
  }, [tab, game.profile, game.loadHistory]);
  const s = game.snapshot;
  const g = s?.game;
  const c = s?.catalog;
  const ready = g?.runs.filter((r) => r.endsAt <= game.clock).length || 0;
  const alerts = game.error && (
    <div className="error-banner" role="alert">
      <Icon name="bolt" />
      <div>
        <strong>L’action n’a pas pu être confirmée.</strong>
        <p>{game.error}</p>
      </div>
      {game.failed ? (
        <>
          <button className="button small" onClick={game.retry}>
            Réessayer la même action
          </button>
          <button
            className="icon-button"
            onClick={game.dismissError}
            aria-label="Fermer et actualiser"
          >
            <Icon name="close" />
          </button>
        </>
      ) : (
        <button
          className="button small"
          onClick={() => {
            game.dismissError();
            if (!game.profile) location.reload();
          }}
        >
          Actualiser
        </button>
      )}
    </div>
  );
  if (game.loading)
    return (
      <div className="loading-screen">
        <Brand />
        <span className="spinner" />
        <h1>On ouvre le local…</h1>
        <p>Ta vie associative reprend dans un instant.</p>
      </div>
    );
  return (
    <div className={motion.reduced ? "app reduced-motion" : "app"}>
      {!game.profile ? (
        <>
          <header className="welcome-header">
            <Brand />
            <span className="solo-label">
              <span className="live-dot" />
              Un jeu solo. À ton rythme.
            </span>
          </header>
          <main className="onboarding">
            {alerts}
            <section className="welcome-story">
              <span className="eyebrow">ENSIIE · LA VIE ASSO COMMENCE ICI</span>
              <h1>
                Petite réunion.
                <br />
                Grandes <span>ambitions.</span>
              </h1>
              <p>
                Du premier stand à la présidence du BdE.
                <br />
                Fais-toi une place, une équipe et un nom.
              </p>
              <div className="welcome-scene">
                <Scene />
                <span className="floating-sticker">
                  <Icon name="trophy" />
                  Futur prez ?
                </span>
              </div>
              <div className="welcome-perks">
                <span>
                  <Icon name="clock" />
                  Quelques minutes par jour
                </span>
                <span>
                  <Icon name="bolt" />
                  Ton équipe travaille hors ligne
                </span>
              </div>
            </section>
            <section className="onboarding-card">
              <div className="section-kicker">
                <span className="number-tag">01</span> TA NOUVELLE AVENTURE
              </div>
              <h2>Tout commence par toi.</h2>
              <p className="muted">
                Une fiche, une asso. Et beaucoup de choses à faire.
              </p>
              <ProfileForm game={game} onSaved={() => setTab("campus")} />
              <p className="privacy-note">
                <Icon name="lock" size={13} />
                Pas d’inscription. Ta partie reste dans ce navigateur.
              </p>
            </section>
          </main>
        </>
      ) : (
        <div className="game-shell">
          <aside className="sidebar">
            <Brand />
            <div className="sidebar-label">TON AVENTURE</div>
            <nav aria-label="Navigation principale">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  aria-label={t.label}
                  aria-current={tab === t.id ? "page" : undefined}
                  className={`nav-item ${tab === t.id ? "active" : ""}`}
                  onClick={() => navigate(t.id)}
                >
                  <Icon name={t.icon} />
                  <span className="nav-label">{t.label}</span>
                  <span className="mobile-label">{t.short}</span>
                  {((t.id === "projets" && ready > 0) ||
                    (t.id === "journal" && g?.event)) && (
                    <span className="nav-badge">
                      {t.id === "projets" ? ready : "1"}
                    </span>
                  )}
                </button>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <div className="solo-card">
                <span className="live-dot" />
                <span>
                  Partie solo
                  <br />
                  <small>Tout commence par un clic.</small>
                </span>
              </div>
              <button
                className="motion-toggle"
                aria-label="Réduire les animations"
                aria-pressed={motion.manual}
                onClick={motion.toggle}
              >
                <Icon name="settings" size={16} />
                <span>
                  {motion.reduced
                    ? "Animations réduites"
                    : "Réduire les animations"}
                </span>
              </button>
              <div className="sidebar-player">
                <AssoMark id={game.profile.associationId} />
                <div>
                  <strong>{game.profile.nickname}</strong>
                  <small>{names[game.profile.associationId]}</small>
                </div>
              </div>
            </div>
          </aside>
          <div className="workspace">
            <header className="resource-bar">
              <div className="resource implication">
                <span className="resource-icon">
                  <Icon name="bolt" />
                </span>
                <div>
                  <small>IMPLICATION</small>
                  <strong
                    data-testid="implication"
                    title="Estimation visuelle, confirmée par le serveur"
                  >
                    {num(game.estimate)}
                    <span> pts</span>
                  </strong>
                </div>
                <span className="income">
                  +{num(((s?.rate || 0) / 1000) * (s?.demo ? 3600 : 1))}/s
                </span>
              </div>
              <div className="resource reputation">
                <span className="resource-icon">
                  <Icon name="star" />
                </span>
                <div>
                  <small>RÉPUTATION</small>
                  <strong>
                    {num(g?.reputation || 0)}
                    <span> pts</span>
                  </strong>
                </div>
              </div>
              <div className="resource-side">
                <span
                  className={`save-state ${game.failed ? "disconnected" : ""}`}
                  role="status"
                >
                  <span className="live-dot" />
                  {game.failed
                    ? "À vérifier"
                    : game.busy || game.pendingClicks
                      ? "Envoi…"
                      : "À jour"}
                </span>
                <button
                  className="level-chip"
                  aria-label={`Voir mon parcours, rang ${(g?.role || 0) + 1} sur 7`}
                  onClick={() => setJourney(true)}
                >
                  <Icon name="trophy" size={16} />
                  <span>
                    Rang {(g?.role || 0) + 1}
                    <small>/7</small>
                  </span>
                </button>
              </div>
            </header>
            <main id="content" className="game-main">
              {alerts}
              {s?.demo && (
                <div className="demo-banner">
                  <Icon name="bolt" size={15} />
                  MODE SOUTENANCE{" "}
                  <span>Temps et gains × 3 600 · partie distincte</span>
                </div>
              )}
              {!s ? (
                <section className="panel empty-state">
                  <Icon name="campus" size={32} />
                  <h1>Retrouvons ta partie.</h1>
                  <button className="button primary" onClick={game.refresh}>
                    Charger la sauvegarde
                  </button>
                </section>
              ) : (
                <>
                  <div className="page-heading">
                    <div>
                      <p className="eyebrow">
                        {names[g!.associationId]}{" "}
                        <span className="heading-dot">/</span>{" "}
                        {c!.roles[g!.role].name}
                      </p>
                      <h1 ref={heading} tabIndex={-1}>
                        {tab === "campus" ? (
                          <>
                            Salut, {game.profile.nickname}
                            <span className="hello-spark">✦</span>
                          </>
                        ) : tab === "projets" ? (
                          "Les idées deviennent des projets."
                        ) : tab === "equipe" ? (
                          "Les bonnes personnes, ensemble."
                        ) : tab === "journal" ? (
                          "Ça bouge dans les assos."
                        ) : (
                          "Ton histoire commence ici."
                        )}
                      </h1>
                      <p className="page-subtitle">
                        {tab === "campus"
                          ? "Ton local. Ton équipe. La prochaine grande idée."
                          : tab === "projets"
                            ? "Choisis une mission, confie-la à ton équipe, récolte la réputation."
                            : tab === "equipe"
                              ? "Trois talents, trois façons de faire avancer tes projets."
                              : tab === "journal"
                                ? "Les petits imprévus font les grandes histoires."
                                : "Une présentation qui évolue avec ton aventure."}
                      </p>
                    </div>
                    {tab === "campus" && (
                      <button
                        className="button ghost journey-button"
                        onClick={() => setJourney(true)}
                      >
                        Mon parcours
                        <Icon name="arrow" size={16} />
                      </button>
                    )}
                  </div>
                  {game.offlineGain >= 1000 && (
                    <div className="offline-card">
                      <span className="offline-icon">
                        <Icon name="spark" />
                      </span>
                      <div>
                        <strong>Ça a travaillé pendant ton absence.</strong>
                        <p>
                          Ton équipe a produit{" "}
                          <b>+{num(game.offlineGain / 1000)} implication</b>.
                          Bienvenue au local !
                        </p>
                      </div>
                      <button
                        className="icon-button"
                        onClick={game.clearOffline}
                        aria-label="Fermer le bilan d’absence"
                      >
                        <Icon name="close" size={18} />
                      </button>
                    </div>
                  )}
                  <div className="page-content" key={tab}>
                    {tab === "campus" && (
                      <Campus
                        game={game}
                        navigate={navigate}
                        reduced={motion.reduced}
                        openJourney={() => setJourney(true)}
                      />
                    )}
                    {tab === "projets" && <Projects game={game} />}
                    {tab === "equipe" && <Team game={game} />}
                    {tab === "journal" && <Journal game={game} />}
                    {tab === "fiche" && (
                      <div className="profile-grid">
                        <section className="panel">
                          <div className="profile-cover">
                            <AssoMark id={g!.associationId} />
                            <span>FICHE D’IIENS</span>
                          </div>
                          <div className="panel-body">
                            <h2>{game.profile.nickname}</h2>
                            {editing ? (
                              <ProfileForm
                                game={game}
                                onSaved={() => {
                                  setEditing(false);
                                  void game.loadHistory();
                                }}
                                onCancel={() => setEditing(false)}
                              />
                            ) : (
                              <>
                                <span className="tag">
                                  {names[g!.associationId]}
                                </span>
                                <p className="presentation">
                                  {game.profile.presentation}
                                </p>
                                <button
                                  className="button secondary"
                                  onClick={() => setEditing(true)}
                                >
                                  Modifier ma présentation
                                  <Icon name="arrow" size={16} />
                                </button>
                              </>
                            )}
                            <p className="profile-status" role="status">
                              {game.submission ? (
                                <span className="spinner" />
                              ) : (
                                <Icon name="check" size={15} />
                              )}{" "}
                              {game.profileStatus ||
                                "Ta fiche est sauvegardée."}
                            </p>
                            <button
                              className="text-button mobile-preferences"
                              aria-pressed={motion.manual}
                              onClick={motion.toggle}
                            >
                              <Icon name="settings" size={16} />
                              {motion.reduced
                                ? "Animations réduites"
                                : "Réduire les animations"}
                            </button>
                          </div>
                        </section>
                        <section className="panel panel-body">
                          <div className="section-heading">
                            <div>
                              <span className="eyebrow">
                                AU FIL DES VERSIONS
                              </span>
                              <h2>Tu as fait du chemin.</h2>
                            </div>
                            <button
                              className="icon-button"
                              aria-label="Actualiser l’historique"
                              onClick={game.loadHistory}
                              disabled={game.historyLoading}
                            >
                              <Icon name="clock" />
                            </button>
                          </div>
                          {game.historyLoading && (
                            <p role="status" className="muted">
                              Chargement de ton histoire…
                            </p>
                          )}
                          {!game.historyLoading && !game.history.length && (
                            <div className="empty-state">
                              <Icon name="journal" size={30} />
                              <p>
                                La première page arrive.
                                <br />
                                Elle apparaîtra dès la confirmation de ta fiche.
                              </p>
                            </div>
                          )}
                          {game.history.map((h) => (
                            <article
                              className="history-entry"
                              key={h.submissionId}
                            >
                              <span className="history-dot" />
                              <div>
                                <span className="eyebrow">
                                  VERSION {h.revision} ·{" "}
                                  {new Date(h.createdAt).toLocaleDateString(
                                    "fr-FR",
                                  )}
                                </span>
                                <h3>{h.nickname}</h3>
                                <p className="presentation">{h.presentation}</p>
                              </div>
                            </article>
                          ))}
                        </section>
                      </div>
                    )}
                  </div>
                  <footer className="game-footer">
                    <span>
                      Imaginé autour de l’ENSIIE. Scénarios fictifs, motivation
                      réelle.
                    </span>
                    <span>
                      <Icon name="lock" size={12} />
                      Ta progression est sauvegardée automatiquement
                    </span>
                  </footer>
                </>
              )}
            </main>
          </div>
        </div>
      )}
      {game.toast && (
        <div className="toast" role="status" key={game.toast.id}>
          <span>
            <Icon name="check" size={18} />
          </span>
          {game.toast.text}
        </div>
      )}
      {game.promotion && (
        <Modal
          title="Promotion obtenue"
          onClose={game.closePromotion}
          className="promotion-modal"
        >
          <div className="celebration" aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => (
              <i key={i} style={{ "--i": i } as React.CSSProperties} />
            ))}
            <span>
              <Icon name="trophy" size={48} />
            </span>
          </div>
          <p className="eyebrow">NOUVEAU CHAPITRE DÉBLOQUÉ</p>
          <h2>{game.promotion}</h2>
          <p>
            Une réunion de plus, un rôle de plus.
            <br />
            La promo commence à connaître ton nom.
          </p>
          <button
            className="button primary"
            autoFocus
            onClick={game.closePromotion}
          >
            C’est parti !<Icon name="arrow" />
          </button>
        </Modal>
      )}
      {journey && s && (
        <Modal
          title="Mon parcours jusqu’au BdE"
          onClose={() => setJourney(false)}
        >
          <p className="eyebrow">DE LA PROMO AU BdE</p>
          <h2>Chaque étape compte.</h2>
          <ol className="journey-list">
            {c!.roles.map((r, i) => (
              <li key={r.name} className={i <= g!.role ? "reached" : ""}>
                <span className="journey-step">
                  {i < g!.role ? <Icon name="check" size={17} /> : i + 1}
                </span>
                <div>
                  <strong>{r.name}</strong>
                  <small>
                    {i === g!.role
                      ? "Tu es ici"
                      : i < g!.role
                        ? "Accompli"
                        : `${r.reputation} réputation · ${r.distinct} projets distincts`}
                  </small>
                </div>
                {i === g!.role && <span className="tag lime">ACTUEL</span>}
              </li>
            ))}
          </ol>
        </Modal>
      )}
    </div>
  );
}
function Runs({
  game,
  compact = false,
}: {
  game: GameController;
  compact?: boolean;
}) {
  const s = game.snapshot!;
  const runs = s.game.runs;
  return (
    <div className={`runs ${compact ? "compact" : ""}`}>
      {runs.map((r) => {
        const ready = r.endsAt <= game.clock;
        const progress = Math.max(
          0,
          Math.min(
            100,
            ((game.clock - r.startedAt) / Math.max(1, r.endsAt - r.startedAt)) *
              100,
          ),
        );
        return (
          <article className={`run-card ${ready ? "ready" : ""}`} key={r.id}>
            <span className="run-icon">
              <Icon name={ready ? "check" : "projects"} />
            </span>
            <div className="run-info">
              <div className="run-title">
                <h3>{r.name}</h3>
                <span className={`tag ${ready ? "lime" : ""}`}>
                  {ready ? "Terminé" : duration((r.endsAt - game.clock) / 1000)}
                </span>
              </div>
              <div
                className="progress-track"
                role="progressbar"
                aria-label={`Avancement : ${r.name}`}
                aria-valuenow={Math.round(progress)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span style={{ width: `${progress}%` }} />
              </div>
              <small>
                +{r.reputation} réputation
                {r.member ? " · Équipier affecté" : ""}
              </small>
            </div>
            <button
              className={`button small ${ready ? "primary" : "ghost"}`}
              disabled={!ready || game.busy || !!game.failed}
              onClick={() => game.act({ type: "claim", id: r.id })}
            >
              {ready ? "Récupérer" : <Icon name="clock" size={17} />}
            </button>
          </article>
        );
      })}
    </div>
  );
}
function Campus({
  game,
  navigate,
  reduced,
  openJourney,
}: {
  game: GameController;
  navigate: (t: Tab) => void;
  reduced: boolean;
  openJourney: () => void;
}) {
  const s = game.snapshot!;
  const g = s.game;
  const c = s.catalog;
  const [particles, setParticles] = useState<{ id: number; x: number }[]>([]);
  const serial = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [pulse, setPulse] = useState(0);
  const [showLocked, setShowLocked] = useState(false);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const addClick = () => {
    if (!game.click()) return;
    setPulse((n) => n + 1);
    if (reduced) return;
    const id = ++serial.current;
    setParticles((p) => [...p, { id, x: 25 + Math.random() * 50 }]);
    const t = setTimeout(() => {
      setParticles((p) => p.filter((item) => item.id !== id));
      timers.current = timers.current.filter((x) => x !== t);
    }, 800);
    timers.current.push(t);
  };
  const next = c.roles[g.role + 1];
  const nextReady = !!next && !s.requirements.length;
  const ready = g.runs.filter((r) => r.endsAt <= game.clock).length;
  const suggested = c.projects.find(
    (p) =>
      p.role <= g.role &&
      (!p.association || p.association === g.associationId) &&
      !g.completed.includes(p.id) &&
      !g.runs.some((r) => r.projectId === p.id),
  );
  const affordable = c.upgrades.filter(
    (u) =>
      u.role <= g.role &&
      (g.upgrades[u.id] || 0) < 50 &&
      Math.ceil(u.cost * 1.15 ** (g.upgrades[u.id] || 0)) <= game.estimate,
  ).length;
  return (
    <>
      <div className="dashboard-grid">
        <section className="clicker-hero">
          <div className="hero-topline">
            <span className="hero-label">
              <span className="live-dot" />
              LE LOCAL EST OUVERT
            </span>
            <span className="hero-association">
              <AssoMark id={g.associationId} />
              {names[g.associationId]}
            </span>
          </div>
          <div className="hero-copy">
            <span className="eyebrow">UN CLIC PEUT TOUT CHANGER</span>
            <h2>
              {g.role >= 4 ? (
                <>
                  Fais vibrer
                  <br />
                  <em>toute la promo.</em>
                </>
              ) : (
                <>
                  Les grandes idées
                  <br />
                  commencent <em>ici.</em>
                </>
              )}
            </h2>
            <p>
              {g.role >= 2
                ? "Ton équipe prend de l’ampleur. Donne le rythme."
                : "Un coup de main aujourd’hui. Une asso qui grandit demain."}
            </p>
          </div>
          <Scene role={g.role} association={g.associationId} />
          <div className="hero-bottom">
            <div className="click-target">
              <button
                className={`click-button ${pulse % 2 ? "tap-a" : "tap-b"}`}
                disabled={!!game.failed}
                onClick={addClick}
              >
                <Icon name="bolt" size={23} />
                <span>S’impliquer</span>
                <b>+1</b>
              </button>
              <div className="click-particles" aria-hidden="true">
                {particles.map((p) => (
                  <span key={p.id} style={{ left: `${p.x}%` }}>
                    +1 ✦
                  </span>
                ))}
              </div>
            </div>
            <div className="click-caption">
              <span>
                {game.pendingClicks
                  ? `${game.pendingClicks} clic(s) en cours d’envoi`
                  : "Clic ou Entrée · +1 implication"}
              </span>
              <span>
                <Icon name="bolt" size={12} />
                {num((s.rate / 1000) * (s.demo ? 3600 : 1))}/s en automatique
              </span>
            </div>
          </div>
        </section>
        <section className="goal-card">
          <div className="goal-top">
            <span className="eyebrow">TON PROCHAIN CHAPITRE</span>
            <button
              className="icon-button"
              onClick={openJourney}
              aria-label="Voir tout mon parcours"
            >
              <Icon name="arrow" size={18} />
            </button>
          </div>
          <div className="goal-medal">
            <Icon name="trophy" size={28} />
            <span>{g.role === 6 ? "7" : g.role + 2}</span>
          </div>
          <h2>{next?.name || "Prez du BdE. Ça y est."}</h2>
          <p className="goal-description">
            {g.role === 6
              ? "Du premier flyer au bureau du BdE. La promo se souviendra de toi."
              : "Construis ta réputation, un projet à la fois."}
          </p>
          {next ? (
            <>
              <div className="goal-progress-label">
                <span>Réputation</span>
                <strong>
                  {g.reputation}
                  <small> / {next.reputation}</small>
                </strong>
              </div>
              <progress
                value={Math.min(g.reputation, next.reputation)}
                max={next.reputation}
                aria-label="Réputation pour la prochaine promotion"
              />
              <div className="goal-tasks">
                <div className={g.reputation >= next.reputation ? "done" : ""}>
                  <Icon
                    name={g.reputation >= next.reputation ? "check" : "star"}
                    size={15}
                  />
                  {next.reputation} points de réputation
                </div>
                <div
                  className={g.completed.length >= next.distinct ? "done" : ""}
                >
                  <Icon
                    name={
                      g.completed.length >= next.distinct ? "check" : "projects"
                    }
                    size={15}
                  />
                  {Math.min(g.completed.length, next.distinct)} /{" "}
                  {next.distinct} projets distincts
                </div>
                {next.required.map((tag) => (
                  <div key={tag} className={g.tags.includes(tag) ? "done" : ""}>
                    <Icon
                      name={g.tags.includes(tag) ? "check" : "lock"}
                      size={15}
                    />
                    {c.projects.find((p) => p.tag === tag)?.name}
                  </div>
                ))}
              </div>
              <button
                className={`button ${nextReady ? "primary" : "secondary"}`}
                disabled={!nextReady || game.busy || !!game.failed}
                onClick={() => game.act({ type: "promote" })}
              >
                {g.role === 5 ? "Lancer l’élection" : "Passer au rôle suivant"}
                <Icon name={nextReady ? "arrow" : "lock"} size={16} />
              </button>
            </>
          ) : (
            <>
              <p>
                <b>{g.completed.length}</b> projets différents ·{" "}
                <b>{g.members.length}</b> équipiers
              </p>
              <button className="button primary" onClick={openJourney}>
                Revoir mon parcours
                <Icon name="trophy" size={16} />
              </button>
            </>
          )}
        </section>
      </div>
      <div className="next-action">
        <span className="next-action-icon">
          <Icon name={ready ? "check" : nextReady ? "trophy" : "spark"} />
        </span>
        <div>
          <span className="eyebrow">ON FAIT QUOI MAINTENANT ?</span>
          <strong>
            {ready
              ? `${ready} projet${ready > 1 ? "s" : ""} terminé${ready > 1 ? "s" : ""} t’attend${ready > 1 ? "ent" : ""}.`
              : nextReady
                ? "Tout est prêt pour ta prochaine promotion."
                : suggested
                  ? `Prochaine idée : ${suggested.name}`
                  : "Ton équipe peut préparer un nouveau projet."}
          </strong>
        </div>
        <button
          className="button ghost"
          onClick={() =>
            ready || !nextReady
              ? navigate("projets")
              : document.querySelector(".goal-card")?.scrollIntoView({
                  behavior: reduced ? "instant" : "smooth",
                  block: "center",
                })
          }
        >
          {ready
            ? "Récupérer les gains"
            : nextReady
              ? "Voir ma promotion"
              : "Voir les projets"}
          <Icon name="arrow" size={16} />
        </button>
      </div>
      {g.runs.length > 0 && (
        <section className="dashboard-runs">
          <div className="section-heading">
            <h2>
              Pendant ce temps, au local
              <span className="count-pill">{g.runs.length}</span>
            </h2>
            <button className="text-button" onClick={() => navigate("projets")}>
              Tous les projets
              <Icon name="arrow" size={15} />
            </button>
          </div>
          <Runs game={game} compact />
        </section>
      )}
      <section className="upgrade-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">MOINS D’EFFORT, PLUS D’IMPACT</span>
            <h2>Fais tourner ton asso.</h2>
          </div>
          <span className="tag">
            {affordable} amélioration{affordable > 1 ? "s" : ""} abordable
            {affordable > 1 ? "s" : ""}
          </span>
        </div>
        <div className="upgrade-list">
          {c.upgrades
            .filter((u) => showLocked || u.role <= g.role)
            .map((u, i) => {
              const level = g.upgrades[u.id] || 0;
              const cost = Math.ceil(u.cost * 1.15 ** level);
              const locked = g.role < u.role;
              const missing = Math.max(0, cost - game.estimate);
              return (
                <article
                  className={`upgrade ${locked ? "locked" : ""}`}
                  key={u.id}
                >
                  <span className={`upgrade-icon tone-${i % 3}`}>
                    <Icon
                      name={
                        (
                          [
                            "journal",
                            "campus",
                            "settings",
                            "team",
                            "projects",
                          ] as IconName[]
                        )[i]
                      }
                    />
                  </span>
                  <div className="upgrade-copy">
                    <h3>
                      {u.name}
                      <span className="level-tag">Niv. {level}</span>
                    </h3>
                    <p>{u.description}</p>
                    <small>
                      <Icon name="bolt" size={12} />+{num(u.rate / 1000)} / s
                      par niveau
                    </small>
                  </div>
                  <div className="upgrade-purchase">
                    <button
                      className={`button ${!missing && !locked ? "secondary" : "ghost"}`}
                      disabled={
                        game.busy ||
                        !!game.failed ||
                        locked ||
                        missing > 0 ||
                        level >= 50
                      }
                      onClick={() => game.act({ type: "buy", id: u.id })}
                    >
                      {locked ? (
                        <>
                          <Icon name="lock" size={15} />
                          Verrouillé
                        </>
                      ) : level >= 50 ? (
                        "Au maximum"
                      ) : (
                        <>
                          <Icon name="bolt" size={14} />
                          {num(cost)}
                          <span>Améliorer</span>
                        </>
                      )}
                    </button>
                    <small>
                      {locked
                        ? `Dès ${c.roles[u.role].name}`
                        : level >= 50
                          ? "50 niveaux accomplis"
                          : missing > 0
                            ? `Il te manque ${num(missing)} pts`
                            : "Disponible maintenant"}
                    </small>
                  </div>
                </article>
              );
            })}
        </div>
        {c.upgrades.some((u) => u.role > g.role) && (
          <button
            className="text-button reveal-button"
            aria-expanded={showLocked}
            onClick={() => setShowLocked((v) => !v)}
          >
            <Icon name="lock" size={14} />
            {showLocked
              ? "Masquer les améliorations futures"
              : `Voir les ${c.upgrades.filter((u) => u.role > g.role).length} améliorations à débloquer`}
          </button>
        )}
      </section>
    </>
  );
}
function Projects({ game }: { game: GameController }) {
  const s = game.snapshot!;
  const g = s.game;
  const c = s.catalog;
  const [filter, setFilter] = useState("available");
  const [search, setSearch] = useState("");
  const [member, setMember] = useState("");
  const slots = g.role >= 3 ? 2 : 1;
  const active = g.runs.filter((r) => r.endsAt > game.clock).length;
  const projects = c.projects.filter(
    (p) => !p.association || p.association === g.associationId,
  );
  const done = (p: Project) =>
    !!p.once &&
    (g.completed.includes(p.id) || g.runs.some((r) => r.projectId === p.id));
  const shown = projects.filter(
    (p) =>
      (filter === "all" ||
        (filter === "available" && p.role <= g.role && !done(p)) ||
        (filter === "short" &&
          p.role <= g.role &&
          p.seconds <= 3600 &&
          !done(p)) ||
        (filter === "campaign" && p.role >= 4) ||
        (filter === "done" && g.completed.includes(p.id))) &&
      `${p.name} ${p.description}`
        .toLocaleLowerCase("fr")
        .includes(search.toLocaleLowerCase("fr")),
  );
  return (
    <>
      <section className="projects-active panel panel-body">
        <div className="section-heading">
          <div>
            <span className="eyebrow">TON ÉQUIPE EST SUR LE COUP</span>
            <h2>
              Le tableau de bord
              <span className="count-pill">
                {active}/{slots} actif{slots > 1 ? "s" : ""}
              </span>
            </h2>
          </div>
          {active < slots && (
            <span className="tag lime">
              {slots - active} place{slots - active > 1 ? "s" : ""} libre
              {slots - active > 1 ? "s" : ""}
            </span>
          )}
        </div>
        {g.runs.length ? (
          <Runs game={game} />
        ) : (
          <div className="empty-inline">
            <span className="empty-illustration">
              <Icon name="projects" size={28} />
            </span>
            <div>
              <strong>Une bonne idée attend son équipe.</strong>
              <p>
                Lance ton premier projet ci-dessous. Sa récompense t’attendra
                sans expiration.
              </p>
            </div>
          </div>
        )}
      </section>
      <div className="project-toolbar">
        <div className="filter-tabs" aria-label="Filtrer les projets">
          {[
            ["available", "Accessibles"],
            ["short", "Rapides"],
            ["campaign", "Objectif BdE"],
            ["done", "Accomplis"],
            ["all", "Tous"],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="search-input">
          <Icon name="search" size={17} />
          <span className="sr-only">Rechercher un projet</span>
          <input
            placeholder="Chercher une idée…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="icon-button"
              onClick={() => setSearch("")}
              aria-label="Effacer la recherche"
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </label>
      </div>
      <div className="project-meta-bar">
        <span>
          {shown.length} projet{shown.length > 1 ? "s" : ""}
        </span>
        <label className="member-select">
          <Icon name="team" size={16} />
          <span>Équipier</span>
          <select
            aria-label="Équipier pour le prochain projet"
            value={member}
            onChange={(e) => setMember(e.target.value)}
          >
            <option value="">Sans équipier</option>
            {c.members
              .filter((m) => g.members.includes(m.id))
              .map((m) => (
                <option
                  key={m.id}
                  value={m.id}
                  disabled={g.runs.some(
                    (r) => r.member === m.id && r.endsAt > game.clock,
                  )}
                >
                  {m.name}
                  {g.runs.some(
                    (r) => r.member === m.id && r.endsAt > game.clock,
                  )
                    ? " · occupé"
                    : ""}
                </option>
              ))}
          </select>
        </label>
      </div>
      <div className="project-grid">
        {shown.map((p) => {
          const m = c.members.find((m) => m.id === member);
          const cost = Math.ceil(p.cost * (m?.effect === "cost" ? 0.9 : 1));
          const seconds = Math.ceil(
            (p.seconds *
              (1 -
                (g.associationId === "lebarc" ? 0.1 : 0) -
                (m?.effect === "time" ? 0.1 : 0))) /
              (s.demo ? 3600 : 1),
          );
          const reward = Math.round(
            p.reputation *
              (1 +
                (g.associationId === "bakaclub" ? 0.1 : 0) +
                (m?.effect === "reputation" ? 0.1 : 0)),
          );
          const locked = g.role < p.role;
          const memberBusy =
            member &&
            g.runs.some((r) => r.member === member && r.endsAt > game.clock);
          const missing = Math.max(0, cost - game.estimate);
          const reason = locked
            ? `Dès ${c.roles[p.role].name}`
            : done(p)
              ? "Projet unique déjà lancé ou accompli"
              : active >= slots
                ? "Tous tes emplacements sont occupés"
                : memberBusy
                  ? "Cet équipier travaille déjà sur un projet"
                  : missing > 0
                    ? `Il te manque ${num(missing)} implication`
                    : "";
          return (
            <article className={`project ${locked ? "locked" : ""}`} key={p.id}>
              <div
                className={`project-cover ${p.association || p.role >= 4 ? "special" : ""}`}
              >
                <Icon
                  name={
                    p.role >= 4
                      ? "trophy"
                      : p.association === "bakaclub"
                        ? "flower"
                        : p.association === "arise"
                          ? "code"
                          : p.association === "lebarc"
                            ? "coffee"
                            : "projects"
                  }
                  size={34}
                />
                <span className="tag">
                  {p.association
                    ? names[p.association]
                    : p.role >= 4
                      ? "Campagne BdE"
                      : "Vie associative"}
                </span>
                {g.completed.includes(p.id) && (
                  <span className="completed-mark" title="Déjà accompli">
                    <Icon name="check" size={16} />
                  </span>
                )}
              </div>
              <div className="project-body">
                <h3>{p.name}</h3>
                <p>{p.description}</p>
                <div className="project-rewards">
                  <span>
                    <Icon name="clock" size={15} />
                    {seconds === 0 ? "Immédiat" : duration(seconds)}
                  </span>
                  <span>
                    <Icon name="star" size={15} />+{reward} réputation
                  </span>
                </div>
                <button
                  className={`button ${reason ? "ghost" : "secondary"}`}
                  disabled={!!reason || game.busy || !!game.failed}
                  onClick={() =>
                    game.act({
                      type: "start",
                      id: p.id,
                      ...(member ? { member } : {}),
                    })
                  }
                >
                  {locked ? (
                    <>
                      <Icon name="lock" size={15} />À débloquer
                    </>
                  ) : done(p) ? (
                    "Déjà lancé ou accompli"
                  ) : (
                    <>
                      Lancer<small>{num(cost)} pts</small>
                      <Icon name="arrow" size={15} />
                    </>
                  )}
                </button>
                <span className="button-reason">
                  {reason ||
                    (p.once
                      ? "Une seule fois · un jalon de ton histoire"
                      : "Rejouable · récompense garantie")}
                </span>
              </div>
            </article>
          );
        })}
      </div>
      {!shown.length && (
        <div className="panel empty-state">
          <Icon name="search" size={34} />
          <h2>Aucun projet dans cette sélection.</h2>
          <p>
            {filter === "done"
              ? "Tes premières réussites apparaîtront ici."
              : "Essaie un autre filtre ou une recherche plus courte."}
          </p>
          <button
            className="button secondary"
            onClick={() => {
              setSearch("");
              setFilter("all");
            }}
          >
            Voir tous les projets
          </button>
        </div>
      )}
    </>
  );
}
function Team({ game }: { game: GameController }) {
  const s = game.snapshot!;
  const g = s.game;
  return (
    <>
      <div className="team-intro">
        <span>
          <Icon name="team" size={27} />
        </span>
        <div>
          <strong>Un talent par projet. Un vrai coup de pouce.</strong>
          <p>
            Recrute dès le bureau d’asso, puis affecte tes équipiers dans Les
            projets. Ils se libèrent dès la fin de leur mission.
          </p>
        </div>
        <span className="tag">{g.members.length}/3 recrutés</span>
      </div>
      <div className="team-grid">
        {s.catalog.members.map((m, i) => {
          const owned = g.members.includes(m.id);
          const run = g.runs.find(
            (r) => r.member === m.id && r.endsAt > game.clock,
          );
          const reason =
            g.role < 2
              ? "Débloqué au bureau d’asso"
              : game.estimate < m.cost
                ? `Il te manque ${num(m.cost - game.estimate)} implication`
                : "";
          return (
            <article className="team-card" key={m.id}>
              <div className={`portrait portrait-${i}`}>
                <svg viewBox="0 0 180 160" aria-hidden="true">
                  <circle
                    cx="90"
                    cy="77"
                    r="65"
                    fill="currentColor"
                    opacity=".12"
                  />
                  <path
                    d="M40 160v-30c0-54 100-54 100 0v30"
                    fill={["#8573bc", "#76958d", "#bd8666"][i]}
                  />
                  <rect
                    x="79"
                    y="92"
                    width="22"
                    height="25"
                    rx="8"
                    fill="#d9a483"
                  />
                  <ellipse
                    cx="90"
                    cy="67"
                    rx="32"
                    ry="37"
                    fill={i === 1 ? "#b78263" : "#e5b28e"}
                  />
                  <path
                    d={
                      i === 1
                        ? "M57 74C20 4 148 6 126 91l-15-34-46 6-4 30Z"
                        : "M56 68C35 3 144 4 126 72l-14-24-48 10Z"
                    }
                    fill="#343148"
                  />
                  <path
                    d="M78 74h1m23 0h1"
                    stroke="#393144"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M82 88q8 7 16 0"
                    stroke="#8c584c"
                    strokeWidth="2"
                    fill="none"
                  />
                  {i === 0 && (
                    <path
                      d="M65 68h19v14H65Zm31 0h19v14H96Zm-12 4h12"
                      stroke="#4b4755"
                      strokeWidth="3"
                      fill="none"
                    />
                  )}
                </svg>
                <span className="tag">
                  {owned
                    ? run
                      ? "En mission"
                      : "Dans ton équipe"
                    : "À recruter"}
                </span>
              </div>
              <div className="team-body">
                <span className="eyebrow">
                  {["ORGANISATION", "DÉBROUILLE", "RELATIONS"][i]}
                </span>
                <h2>{m.name}</h2>
                <p>{m.description}</p>
                {owned ? (
                  <div className={`team-status ${run ? "working" : ""}`}>
                    <span className="live-dot" />
                    {run ? (
                      <span>
                        {run.name}
                        <small>
                          Libre dans{" "}
                          {duration((run.endsAt - game.clock) / 1000)}
                        </small>
                      </span>
                    ) : (
                      "Disponible pour un projet"
                    )}
                  </div>
                ) : (
                  <>
                    <button
                      className="button secondary"
                      disabled={!!reason || game.busy || !!game.failed}
                      onClick={() => game.act({ type: "recruit", id: m.id })}
                    >
                      Recruter<span>{num(m.cost)} pts</span>
                    </button>
                    <small className="button-reason">
                      {reason || "Un recrutement, un bonus permanent"}
                    </small>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
function Journal({ game }: { game: GameController }) {
  const s = game.snapshot!;
  const g = s.game;
  const event = s.catalog.events.find((e) => e.id === g.event?.definitionId);
  return (
    <div className="journal-grid">
      <section className="event-card">
        <div className="event-illustration">
          <span className="event-orbit" />
          <Icon name={event ? "spark" : "coffee"} size={54} />
          <span className="tag">
            {event ? "À TOI DE DÉCIDER" : "TOUT ROULE"}
          </span>
        </div>
        <div className="panel-body">
          <span className="eyebrow">LES PETITES GALÈRES DU CAMPUS</span>
          <h2>{event?.title || "Un moment de calme."}</h2>
          <p>
            {event?.text ||
              "Les imprévus arrivent au fil de ton aventure. Ils attendront ton retour, pas besoin de surveiller."}
          </p>
          {event &&
            event.choices.map((choice, i) => (
              <button
                className="event-choice"
                key={i}
                disabled={game.busy || !!game.failed}
                onClick={() =>
                  game.act({ type: "event", id: g.event!.id, choice: i })
                }
              >
                <span>
                  <strong>{choice.text}</strong>
                  <small>
                    {choice.reputation
                      ? `+${choice.reputation * (g.role + 1)} réputation`
                      : `+${choice.implication * (g.role + 1)} implication`}
                  </small>
                </span>
                <Icon name="arrow" size={18} />
              </button>
            ))}
        </div>
      </section>
      <section className="panel panel-body">
        <div className="section-heading">
          <div>
            <span className="eyebrow">LES COULISSES DE TA RÉUSSITE</span>
            <h2>Le carnet de bord.</h2>
          </div>
          <Icon name="journal" size={25} />
        </div>
        {g.journal.length ? (
          <ol className="journal">
            {g.journal.map((entry, i) => (
              <li key={`${entry.at}-${i}`}>
                <span className="journal-pin" />
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
          <div className="empty-state">
            <Icon name="journal" size={32} />
            <p>
              Une page blanche, plein d’idées.
              <br />
              Ta première action lancera l’histoire.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
