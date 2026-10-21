import { Github, KeyRound, Sparkles, Wifi, WifiOff } from "lucide-react";
import type { Mode, Session } from "../types";
import { decodeToken } from "../lib/session";

interface HeaderProps {
  mode: Mode;
  session: Session | null;
  sessionOnline: boolean | null;
  onModeChange: (mode: Mode) => void;
  onOpenSession: () => void;
  onHome: () => void;
}

export function Header({
  mode,
  session,
  sessionOnline,
  onModeChange,
  onOpenSession,
  onHome,
}: HeaderProps) {
  const sessionExpired = Boolean(session?.token && decodeToken(session.token).expired);
  const sessionButtonLabel =
    mode === "demo"
      ? "Session"
      : sessionExpired
        ? "Refresh"
        : session
          ? "Connected"
          : "Connect";
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <button type="button" className="brand" onClick={onHome}>
          <BrandMark />
          <span className="brand__text">
            <span className="brand__name">jajabor</span>
            <span className="brand__bn">যাযাবর</span>
          </span>
          <span className="brand__tag">split-ticket finder</span>
        </button>

        <nav className="site-nav" aria-label="Main navigation">
          <a href="#why">Why split</a>
          <a href="#how">How it works</a>
          <a href="#faq">FAQ</a>
        </nav>

        <div className="site-header__actions">
          <div className="mode-switch mode-switch--header" role="tablist" aria-label="Availability source">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "demo"}
              className={mode === "demo" ? "is-active" : ""}
              onClick={() => onModeChange("demo")}
            >
              <Sparkles size={12} /> Demo
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "live"}
              className={mode === "live" ? "is-active" : ""}
              onClick={() => onModeChange("live")}
            >
              {session ? <Wifi size={12} /> : <WifiOff size={12} />} Live
            </button>
          </div>

          <button
            type="button"
            className={`header-session ${session ? "has-session" : ""} ${
              sessionOnline === false || sessionExpired ? "is-offline" : ""
            }`}
            onClick={onOpenSession}
            aria-label={`${sessionButtonLabel} — railway account settings`}
          >
            <KeyRound size={14} />
            <span className="header-session__label">
              {sessionButtonLabel}
            </span>
            <span
              className={`status-dot ${
                sessionExpired || sessionOnline === false
                  ? "is-bad"
                  : sessionOnline === true
                    ? "is-good"
                    : ""
              }`}
              aria-hidden
            />
          </button>

          <a
            className="github-link"
            href="https://github.com/hello2himel/jajabor"
            target="_blank"
            rel="noreferrer"
            aria-label="Jajabor on GitHub"
          >
            <Github size={18} />
          </a>
        </div>
      </div>
    </header>
  );
}

export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="15" fill="currentColor" opacity=".12" />
      <path d="M14 43h36" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity=".35" />
      <path
        d="M17 39c8-17 22-17 30 0"
        stroke="var(--amber)"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="17" cy="44" r="4.5" fill="currentColor" />
      <circle cx="47" cy="44" r="4.5" fill="currentColor" />
      <circle cx="32" cy="23" r="3.5" fill="var(--ink)" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}
