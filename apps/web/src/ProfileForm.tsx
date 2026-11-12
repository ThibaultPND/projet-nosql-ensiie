import { useRef, useState } from "react";
import type { Profile } from "../../../packages/shared/model";
import { AssoMark, Icon, names } from "./ui";
import { uuid, type GameController } from "./useGame";
export function ProfileForm({
  game,
  onSaved,
  onCancel,
}: {
  game: GameController;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [association, setAssociation] = useState<string>(
    game.profile?.associationId || "lebarc",
  );
  const [presentation, setPresentation] = useState(
    game.profile?.presentation || "",
  );
  const key = useRef(uuid());
  const bonuses: Record<string, string> = {
    lebarc:
      "Les projets sont 10 % plus rapides. Idéal pour une équipe qui aime faire bouger le campus.",
    bakaclub:
      "Les projets rapportent 10 % de réputation en plus. Fais rayonner la culture japonaise.",
    arise:
      "La production passive augmente de 10 %. Les bons outils travaillent même quand tu pars.",
  };
  return (
    <form
      className="profile-form"
      onChange={() => {
        key.current = uuid();
      }}
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        if (
          await game.saveProfile(
            {
              nickname: String(data.get("nickname")),
              associationId: association as Profile["associationId"],
              presentation,
            },
            key.current,
          )
        ) {
          key.current = uuid();
          onSaved();
        }
      }}
    >
      <fieldset disabled={game.saving} className="form-fields">
        <label>
          Ton pseudo
          <input
            name="nickname"
            required
            minLength={2}
            maxLength={32}
            defaultValue={game.profile?.nickname}
            placeholder="Comment la promo t’appelle ?"
            autoComplete="nickname"
          />
        </label>
        <fieldset className="association-field">
          <legend>
            Ton asso de cœur{" "}
            <span>
              {game.profile
                ? "Choisie au début de ta partie"
                : "À toi de choisir"}
            </span>
          </legend>
          <div className="association-choices">
            {Object.entries(names).map(([id, name]) => (
              <label
                key={id}
                className={`association-option ${association === id ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="associationId"
                  checked={association === id}
                  onChange={() => setAssociation(id)}
                  value={id}
                  disabled={!!game.profile && game.profile.associationId !== id}
                />
                <AssoMark id={id} />
                <strong>{name}</strong>
                <span className="radio-check">
                  <Icon name="check" size={12} />
                </span>
              </label>
            ))}
          </div>
          <p className="bonus-explanation">
            <Icon name="spark" size={16} />
            {bonuses[association]}
          </p>
        </fieldset>
        <label>
          Pourquoi tu rejoins cette asso ?
          <textarea
            name="presentation"
            required
            minLength={10}
            maxLength={500}
            rows={3}
            value={presentation}
            onChange={(e) => setPresentation(e.target.value)}
            placeholder="Je venais pour une réunion. Je suis resté pour les projets…"
          />
          <span className="field-hint">
            <span>10 caractères minimum · invente ton personnage</span>
            <span>{presentation.length}/500</span>
          </span>
        </label>
      </fieldset>
      <div className="form-actions">
        <button className="button primary" disabled={game.saving}>
          {game.saving ? (
            <>
              <span className="spinner" /> Enregistrement…
            </>
          ) : (
            <>
              {game.profile
                ? "Enregistrer ma fiche"
                : "Entrer dans la vie associative"}
              <Icon name="arrow" size={18} />
            </>
          )}
        </button>
        {onCancel && (
          <button className="button ghost" type="button" onClick={onCancel}>
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}
