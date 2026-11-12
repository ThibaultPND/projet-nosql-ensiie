import { useState } from "react";
import { createRoot } from "react-dom/client";
import { useGame } from "./useGame";
import { ProfileForm } from "./ProfileForm";
import "./style.css";
const number = (n: number) => Math.floor(n).toLocaleString("fr-FR");
function App() {
  const g = useGame();
  const [profileOpen, setProfileOpen] = useState(false);
  const s = g.snapshot;
  const role = s?.catalog.roles[s.game.role];
  const next = s?.catalog.roles[s.game.role + 1];
  const maxed = s && s.game.clickLevel >= s.catalog.upgrade.maxLevel;
  const available = s && s.game.implication / 1000 >= s.upgradePrice;
  return <div className="shell">
    <header>
      <a className="brand" href="/">cliicker<span>.</span></a>
      {g.profile && <button className="text-button" aria-expanded={profileOpen}
        onClick={() => setProfileOpen(!profileOpen)}>{profileOpen ? "Retour au jeu" : "Ma fiche"}</button>}
    </header>
    <main>
      {g.error && <div className="error" role="alert">
        <p>{g.error}</p>
        {g.failed ? <button onClick={g.retry} disabled={g.busy}>Réessayer la même action</button>
          : <button onClick={() => s ? g.dismissError() : window.location.reload()}>Réessayer</button>}
      </div>}
      {g.loading ? <p role="status">Chargement de ta partie…</p> : !g.profile ?
        <section className="panel welcome">
          <h1>De l’élève au prez du BdE.</h1>
          <p>Clique, améliore ton clic et monte les échelons.</p>
          <ProfileForm game={g} />
        </section> : profileOpen ?
        <section className="panel">
          <h1>Ma fiche</h1>
          <ProfileForm game={g} onDone={() => setProfileOpen(false)} />
          <p className="muted" role="status">{g.profileStatus}</p>
          <details onToggle={e => { if (e.currentTarget.open) void g.loadHistory(); }}>
            <summary>Historique de ma fiche</summary>
            {g.historyLoading ? <p>Chargement…</p> : g.history.map(h =>
              <article className="history" key={h.submissionId}>
                <strong>Version {h.revision} · {h.nickname}</strong><p>{h.presentation}</p>
              </article>)}
            <button className="text-button" onClick={g.loadHistory}>Actualiser l’historique</button>
          </details>
        </section> : s && role ? <>
          <section className="game panel" aria-label="Le jeu">
            <div className="role-line"><span>Échelon {s.game.role + 1} / {s.catalog.roles.length}</span><span>{g.profile.nickname}</span></div>
            <h1>{role.name}</h1>
            <div className="score"><strong data-testid="points">{number(g.estimate)}</strong><span>points</span></div>
            <button className="click-button" onClick={g.click} disabled={!!g.failed}>
              Cliquer <span>+{number(s.clickValue)} {s.clickValue === 1 ? "point" : "points"} par clic</span>
            </button>
            <div className="saving" role="status">{g.failed ? "Sauvegarde en attente" : g.busy || g.pendingClicks ? "Sauvegarde…" : "Partie sauvegardée"}</div>
          </section>
          <section className="panel progression" aria-label="Ta progression">
            {next ? <>
              <div className="section-line"><h2>Prochain échelon</h2><span>+{next.clickValue - role.clickValue} par clic</span></div>
              <p className="next-role">{next.name}</p>
              <progress aria-label={`Progression vers ${next.name}`} max={next.threshold} value={s.game.totalEarned / 1000} />
              <div className="progress-label"><span>{number(s.game.totalEarned / 1000)} / {number(next.threshold)} points gagnés</span><span>Automatique</span></div>
              <p className="hint">Les achats ne font pas reculer ta progression.</p>
            </> : <>
              <h2>Te voilà prez du BdE !</h2><p>Tous les échelons sont gravis. Tu peux continuer à cliquer et battre ton score.</p>
            </>}
          </section>
          <section className="panel upgrade" aria-label="Améliorer ton clic">
            <div><h2>Un clic plus fort</h2><p>+{s.catalog.upgrade.bonus} point à chaque clic</p></div>
            <button disabled={!!maxed || !available || g.busy || !!g.failed} onClick={() => g.act({ type: "buy" })}>
              {maxed ? "Bonus maximum" : `Améliorer · ${number(s.upgradePrice)} points`}
            </button>
            {!maxed && !available && <small>Encore {number(s.upgradePrice - s.game.implication / 1000)} points pour l’acheter.</small>}
          </section>
          <details className="journey">
            <summary>Voir les échelons</summary>
            <ol>{s.catalog.roles.map((r, i) => <li key={r.name} aria-current={i === s.game.role ? "step" : undefined}>
              <span>{r.name}{i === s.game.role ? " · toi" : i < s.game.role ? " ✓" : ""}</span><span>{number(r.threshold)} points</span>
            </li>)}</ol>
          </details>
        </> : !g.error && <p role="status">Chargement du jeu…</p>}
    </main>
    {g.toast && <div className="toast" role="status" key={g.toast.id}>{g.toast.text}</div>}
    <footer>Un clic à la fois.</footer>
  </div>;
}
createRoot(document.getElementById("root")!).render(<App />);
