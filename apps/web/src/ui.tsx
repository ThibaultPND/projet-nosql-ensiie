import { useEffect, useRef, type ReactNode } from "react";
export const names: Record<string, string> = {
  lebarc: "LeBar(c)",
  bakaclub: "Bakaclub",
  arise: "ARISE",
};
export const num = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 1,
    notation: n >= 1000000 ? "compact" : "standard",
  }).format(n);
export const duration = (s: number) =>
  s <= 0
    ? "Prêt !"
    : s < 60
      ? `${Math.ceil(s)} s`
      : s < 3600
        ? `${Math.ceil(s / 60)} min`
        : `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)
            .toString()
            .padStart(2, "0")}`;
export type IconName =
  | "campus"
  | "bolt"
  | "star"
  | "projects"
  | "team"
  | "journal"
  | "profile"
  | "arrow"
  | "check"
  | "clock"
  | "lock"
  | "close"
  | "trophy"
  | "spark"
  | "search"
  | "coffee"
  | "code"
  | "flower"
  | "settings";
const paths: Record<IconName, ReactNode> = {
  campus: (
    <>
      <path d="m3 10 9-7 9 7v10H3Z" />
      <path d="M9 20v-7h6v7" />
    </>
  ),
  bolt: <path d="m13 2-9 12h7l-1 8 10-13h-7Z" />,
  star: (
    <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />
  ),
  projects: (
    <>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M8 3v4m8-4v4M4 11h16m-11 5h6" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 21v-3a6 6 0 0 1 12 0v3m1-17a3 3 0 0 1 0 6m3 4a5 5 0 0 1 3 5v2" />
    </>
  ),
  journal: (
    <>
      <path d="M4 4h6a3 3 0 0 1 2 1 3 3 0 0 1 2-1h6v16h-6a3 3 0 0 0-2 1 3 3 0 0 0-2-1H4Zm8 1v16" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 22v-3a8 8 0 0 1 16 0v3" />
    </>
  ),
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  check: <path d="m4 12 5 5L20 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" />
    </>
  ),
  close: <path d="m6 6 12 12M6 18 18 6" />,
  trophy: (
    <>
      <path d="M7 3h10v6a5 5 0 0 1-10 0ZM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 2v6m-5 1h10" />
    </>
  ),
  spark: <path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Zm7 0v4m-2-2h4" />,
  search: (
    <>
      <circle cx="10" cy="10" r="6" />
      <path d="m15 15 6 6" />
    </>
  ),
  coffee: (
    <>
      <path d="M4 8h12v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Zm12 1h2a3 3 0 0 1 0 6h-2M7 2v3m5-3v3" />
    </>
  ),
  code: (
    <>
      <path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-14-2 16" />
    </>
  ),
  flower: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M9 8C1-1 23-1 15 8c12-3 9 15 1 7 3 12-15 9-8 0-12 3-9-15 1-7Z" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h16M4 17h16" />
      <circle cx="8" cy="7" r="3" />
      <circle cx="16" cy="17" r="3" />
    </>
  ),
};
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
export function AssoMark({ id }: { id: string }) {
  return (
    <span className={`asso-mark ${id}`}>
      <Icon
        name={
          id === "lebarc" ? "coffee" : id === "bakaclub" ? "flower" : "code"
        }
      />
    </span>
  );
}
export function Brand() {
  return (
    <a className="brand" href="/" aria-label="Cliicker, accueil">
      <span className="brand-symbol">
        <Icon name="bolt" size={23} />
      </span>
      cliicker<span className="brand-suffix">.</span>
    </a>
  );
}
export function Modal({
  title,
  onClose,
  children,
  className = "",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      className={`modal ${className}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        className="icon-button modal-close"
        onClick={onClose}
        aria-label="Fermer"
      >
        <Icon name="close" />
      </button>
      {children}
    </dialog>
  );
}
export function Scene({
  role = 0,
  association = "arise",
}: {
  role?: number;
  association?: string;
}) {
  return (
    <svg
      className="campus-art"
      viewBox="0 0 560 340"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="wall" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#6662a7" />
          <stop offset="1" stopColor="#424063" />
        </linearGradient>
        <linearGradient id="floor" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#454259" />
          <stop offset="1" stopColor="#25243c" />
        </linearGradient>
      </defs>
      <ellipse cx="300" cy="304" rx="205" ry="26" fill="#151425" opacity=".5" />
      <path d="m68 223 200-110 219 116-202 111Z" fill="url(#floor)" />
      <path d="M68 223V66L268 4v109Z" fill="url(#wall)" />
      <path d="M268 4 487 91v138L268 113Z" fill="#34334f" />
      <path d="m89 86 82-27v82l-82 35Z" fill="#a8d3d7" />
      <path d="m94 92 72-24v67l-72 30Z" fill="#92bdcb" />
      <path d="m94 124 72-28m-36-16v70" stroke="#d8e7df" strokeWidth="5" />
      <path d="m94 147 27-37 45 25-72 30Z" fill="#b2d0c2" />
      <path d="m197 65 48-16v67l-48 22Z" fill="#e7ac7c" />
      <text
        x="211"
        y="91"
        transform="rotate(-18 211 91)"
        fill="#302d40"
        fontSize="12"
        fontWeight="800"
      >
        ENSIIE
      </text>
      <path d="m205 105 30-11m-30 21 19-7" stroke="#6b4750" strokeWidth="3" />
      <path d="m305 51 135 51v72l-135-52Z" fill="#a78873" />
      <path d="m312 62 121 45v56l-121-47Z" fill="#e8dec4" />
      <path d="m324 77 32 12v24l-32-12Z" fill="#d4eb78" />
      <path d="m366 93 26 10v22l-26-10Z" fill="#a49ed6" />
      <path d="m401 106 22 8v30l-22-8Z" fill="#e8997f" />
      <path d="m153 231 135-66 145 73-139 69Z" fill="#b88d71" />
      <path d="m153 231 141 70 139-63v11l-139 68-141-75Z" fill="#966d59" />
      <path
        d="M166 248v33l9 5v-34m234 0v32l9-5v-34m-131 62v29l10-5v-28"
        stroke="#775960"
        strokeWidth="7"
      />
      <g className="art-screen">
        <path
          d="m252 158 65 27v51l-65-29Z"
          fill="#25283a"
          stroke="#918cb3"
          strokeWidth="4"
        />
        <path d="m258 169 53 22v34l-53-23Z" fill="#454e64" />
        <path
          d="m278 185-9 4 9 11m14-9 9 11-9 4"
          stroke="#d3ed85"
          strokeWidth="3"
        />
        <path d="m252 209 65 28-19 10-65-29Z" fill="#77718d" />
      </g>
      <path d="m185 225 25-12 27 14-25 12Z" fill="#eee8d6" />
      <path d="m188 229 24 12 24-12" stroke="#e1b96e" strokeWidth="3" />
      <g className="art-coffee">
        <ellipse cx="360" cy="239" rx="13" ry="6" fill="#6f4e50" />
        <path d="M350 218v17c0 9 19 9 19 0v-17" fill="#e9b969" />
        <ellipse cx="359" cy="218" rx="10" ry="5" fill="#f6d897" />
        <path d="M369 221c15-4 13 15 0 10" stroke="#e9b969" strokeWidth="4" />
        <path
          className="steam"
          d="M356 206c-7-7 6-9 0-17m8 20c-7-7 6-9 0-17"
          stroke="#e4d7c1"
          strokeWidth="2"
          opacity=".6"
        />
      </g>
      <path d="m106 215 25 10-3 33-19-8Z" fill="#c4a0a6" />
      <ellipse cx="118" cy="220" rx="15" ry="6" fill="#7a635f" />
      <path d="M119 224v-59" stroke="#8ca78d" strokeWidth="4" />
      <path
        d="M119 194c-35-5-22-40 0-16 22-30 42-5 0 16m0 20c-32-2-39-29 0-19 30-22 39 0 0 10"
        fill="#9eb99a"
      />
      <g className="art-person">
        <path
          d="m406 191 30 14v46l-30-13Z"
          fill={
            association === "bakaclub"
              ? "#b2a2df"
              : association === "lebarc"
                ? "#ebb67b"
                : "#a9c8c5"
          }
        />
        <ellipse cx="421" cy="178" rx="15" ry="19" fill="#e6ae8c" />
        <path d="M405 174c-5-26 36-23 32 4l-11-6-17 7Z" fill="#393047" />
        <path
          d="m408 241-1 37 13 4 4-34m8 3 6 31 11 3-9-36"
          stroke="#323047"
          strokeWidth="11"
          strokeLinejoin="round"
        />
        <path
          d="m407 208-26 19-16-4"
          stroke="#e6ae8c"
          strokeWidth="9"
          strokeLinecap="round"
        />
      </g>
      {role >= 2 && (
        <g>
          <path d="m210 164 27-13 21 10-26 14Z" fill="#d7ec88" />
          <path d="m211 164 21 11v13l-21-11Z" fill="#a2b66c" />
          <path d="m232 175 26-14v13l-26 14Z" fill="#8f9f65" />
        </g>
      )}
      {role >= 4 && (
        <g>
          <path d="m337 149 28 11v32l-28-11Z" fill="#efcd6f" />
          <text
            x="340"
            y="171"
            fontSize="10"
            fill="#3c3550"
            transform="rotate(22 340 171)"
          >
            BdE
          </text>
        </g>
      )}
      <circle className="art-spark" cx="455" cy="53" r="4" fill="#d7ed88" />
      <path
        className="art-spark"
        d="M200 23v12m-6-6h12"
        stroke="#ccb8f0"
        strokeWidth="3"
      />
    </svg>
  );
}
