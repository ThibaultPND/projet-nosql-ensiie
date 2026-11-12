import { useRef, useState } from "react";
import type { Profile } from "../../../packages/shared/model";
import { uuid, type GameController } from "./useGame";
export function ProfileForm({ game, onDone }: { game: GameController; onDone?: () => void }) {
  const [value, setValue] = useState<Profile>({
    nickname: game.profile?.nickname || "",
    associationId: game.profile?.associationId || "lebarc",
    presentation: game.profile?.presentation || "",
  });
  const request = useRef({ key: uuid(), value: "" });
  return <form onSubmit={async e => {
    e.preventDefault();
    const serialized = JSON.stringify(value);
    if (request.current.value !== serialized) request.current = { key: uuid(), value: serialized };
    if (await game.saveProfile(value, request.current.key)) onDone?.();
  }}>
    <fieldset disabled={game.saving}>
      <label>Ton pseudo
        <input name="nickname" required minLength={2} maxLength={32} autoComplete="nickname"
          value={value.nickname} onChange={e => setValue({ ...value, nickname: e.target.value })} />
      </label>
      <label>Ton association
        <select name="associationId" value={value.associationId} disabled={!!game.profile}
          onChange={e => setValue({ ...value, associationId: e.target.value as Profile["associationId"] })}>
          <option value="lebarc">LeBar(c)</option><option value="bakaclub">Bakaclub</option><option value="arise">ARISE</option>
        </select>
      </label>
      <label>Quelques mots sur toi
        <textarea name="presentation" required minLength={10} maxLength={500} rows={3}
          placeholder="Pourquoi cette asso ?" value={value.presentation}
          onChange={e => setValue({ ...value, presentation: e.target.value })} />
        <small>10 caractères minimum. Tu peux inventer ton personnage.</small>
      </label>
      <button className="primary" type="submit">
        {game.saving ? "Enregistrement…" : game.profile ? "Enregistrer ma fiche" : "Commencer à jouer"}
      </button>
    </fieldset>
  </form>;
}
