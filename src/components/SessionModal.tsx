import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  KeyRound,
  Loader2,
  ShieldCheck,
  Terminal,
  X,
} from "lucide-react";
import type { Session } from "../types";
import { apiErrorMessage, apiHealth, probeSession, resolveApiBase } from "../lib/api";
import { useBodyLock, useCopy } from "../lib/hooks";
import { defaultProxy, decodeToken, maskToken, parseSessionInput } from "../lib/session";
import { formatMinutes } from "../lib/format";

interface SessionModalProps {
  open: boolean;
  onClose: () => void;
  session: Session | null;
  sessionOnline: boolean | null;
  initialError?: string | null;
  onSave: (session: Session) => void;
  onClear: () => void;
}

const SNIPPET = `copy(JSON.stringify({
  token: localStorage.getItem("token"),
  deviceId: localStorage.getItem("uudid"),
  deviceKey: localStorage.getItem("ssdk")
}, null, 2))`;

type TestState = { status: "idle" | "testing" | "ok" | "error"; message?: string };
type ProxyState = { status: "idle" | "checking" | "online" | "offline"; message?: string };

export function SessionModal({
  open,
  onClose,
  session,
  sessionOnline,
  initialError,
  onSave,
  onClear,
}: SessionModalProps) {
  const [bundle, setBundle] = useState("");
  const [proxy, setProxy] = useState("");
  const [remember, setRemember] = useState(false);
  const [test, setTest] = useState<TestState>({ status: "idle" });
  const [proxyState, setProxyState] = useState<ProxyState>({ status: "idle" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { copied, copy } = useCopy();
  useBodyLock(open);

  useEffect(() => {
    if (!open) return;
    setBundle(
      session
        ? JSON.stringify(
            {
              token: session.token,
              ...(session.deviceId ? { deviceId: session.deviceId } : {}),
              ...(session.deviceKey ? { deviceKey: session.deviceKey } : {}),
            },
            null,
            2,
          )
        : "",
    );
    setProxy(session?.proxy ?? defaultProxy());
    setRemember(Boolean(session?.remember));
    setTest({ status: "idle" });
    setError(null);
    setSaving(false);
    const base = (session?.proxy ?? defaultProxy()).trim();
    void checkProxy(base);
    window.setTimeout(() => {
      document.getElementById("session-bundle")?.focus();
    }, 80);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    setTest({ status: "idle" });
    setError(null);
  }, [bundle, proxy]);

  const parsed = useMemo(() => parseSessionInput(bundle), [bundle]);
  const tokenInfo = parsed ? decodeToken(parsed.token) : null;

  if (!open) return null;

  async function checkProxy(explicitProxy = proxy.trim()) {
    setProxyState({ status: "checking" });
    const health = await apiHealth(explicitProxy.replace(/\/+$/, ""));
    if (health.ok) {
      setProxyState({
        status: "online",
        message: `Proxy online${health.version ? ` · v${health.version}` : ""}`,
      });
    } else {
      setProxyState({
        status: "offline",
        message: explicitProxy
          ? "Couldn't reach this proxy."
          : "No proxy at this address. Start it locally or enter a proxy URL.",
      });
    }
    return health.ok;
  }

  function candidate(): Session | null {
    if (!parsed) {
      setError("Paste a session bundle or a Railway token first.");
      return null;
    }
    return {
      token: parsed.token,
      ...(parsed.deviceId ? { deviceId: parsed.deviceId } : {}),
      ...(parsed.deviceKey ? { deviceKey: parsed.deviceKey } : {}),
      proxy: proxy.trim().replace(/\/+$/, ""),
      remember,
    };
  }

  function hasFreshToken(value: Session): boolean {
    const info = decodeToken(value.token);
    if (info.expired) {
      setError(
        "This token has already expired. Log in to the railway site again and copy a fresh session.",
      );
      return false;
    }
    return true;
  }

  async function handleTest() {
    const value = candidate();
    if (!value || !hasFreshToken(value)) return;
    setError(null);
    setTest({ status: "testing" });
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 30_000);
    try {
      await probeSession(value, controller.signal);
      setTest({
        status: "ok",
        message: "Connected. The railway API accepted this session.",
      });
    } catch (caught) {
      setTest({ status: "error", message: apiErrorMessage(caught) });
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function handleSave() {
    const value = candidate();
    if (!value || !hasFreshToken(value)) return;
    setSaving(true);
    setError(null);
    try {
      const base = resolveApiBase(value);
      const online = await apiHealth(base);
      if (!online.ok && !value.proxy) {
        setError(
          "No proxy is running at this address. Run `npm install && npm run live`, open http://localhost:8788, or enter your proxy URL above.",
        );
        setProxyState({ status: "offline", message: "Proxy not reachable." });
        setSaving(false);
        return;
      }
      onSave(value);
    } finally {
      setSaving(false);
    }
  }

  const expiryLabel = tokenInfo?.expiresAt
    ? tokenInfo.expired
      ? "Token has expired"
      : `Token valid for ${formatMinutes(Math.max(1, Math.round((tokenInfo.expiresAt - Date.now()) / 60000)))}`
    : null;

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        className="modal session-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-title"
      >
        <div className="modal__head">
          <div>
            <span className="eyebrow eyebrow--dark">Live mode</span>
            <h2 id="session-title">Connect your railway session</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal__body">
          {(initialError || error) && (
            <div className="modal-alert" role="alert">
              <AlertTriangle size={17} />
              <span>{error || initialError}</span>
            </div>
          )}

          <div className="session-steps">
            <div className="session-step">
              <span className="session-step__num">1</span>
              <div>
                <strong>Open the official site and log in</strong>
                <p>
                  Seat availability needs an active railway session. Jajabor never asks for your
                  password or OTP.
                </p>
                <a
                  className="text-link"
                  href="https://eticket.railway.gov.bd/"
                  target="_blank"
                  rel="noreferrer"
                >
                  eticket.railway.gov.bd <ExternalLink size={12} />
                </a>
              </div>
            </div>

            <div className="session-step">
              <span className="session-step__num">2</span>
              <div>
                <strong>Copy your session from the browser console</strong>
                <p>
                  On the e-ticket site, open DevTools → Console and run this snippet. It reads your
                  own login token and copies it to the clipboard. Nothing is sent anywhere.
                </p>
                <div className="code-block">
                  <pre>
                    <code>{SNIPPET}</code>
                  </pre>
                  <button
                    type="button"
                    className="code-copy"
                    onClick={() => copy(SNIPPET)}
                    aria-label="Copy session snippet"
                  >
                    {copied ? <Check size={14} /> : <Clipboard size={14} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            </div>

            <div className="session-step">
              <span className="session-step__num">3</span>
              <div>
                <strong>Paste it below</strong>
                <p>
                  A session bundle looks like <code>{`{ "token": "eyJ…", "deviceId": "…" }`}</code>.
                  A bare token works too.
                </p>
                <label className="field-label" htmlFor="session-bundle">
                  Session bundle or token
                </label>
                <textarea
                  id="session-bundle"
                  className={`text-area ${bundle && !parsed ? "is-invalid" : ""}`}
                  value={bundle}
                  onChange={(event) => setBundle(event.target.value)}
                  rows={5}
                  spellCheck={false}
                  placeholder={`Paste the copied JSON here — or just your token`}
                />
                <div className="session-meta">
                  {parsed ? (
                    <span className="inline-status inline-status--good">
                      <CheckCircle2 size={13} /> Session recognised · {maskToken(parsed.token)}
                      {parsed.deviceKey ? " · device key included" : ""}
                    </span>
                  ) : bundle ? (
                    <span className="inline-status inline-status--bad">
                      <AlertTriangle size={13} /> That doesn&apos;t look like a token or session
                      bundle yet.
                    </span>
                  ) : (
                    <span className="inline-status">Stored only in this browser.</span>
                  )}
                  {expiryLabel && (
                    <span
                      className={`inline-status ${
                        tokenInfo?.expired ? "inline-status--bad" : "inline-status--good"
                      }`}
                    >
                      {expiryLabel}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="session-proxy">
            <div className="session-proxy__head">
              <div>
                <label className="field-label" htmlFor="proxy-url">
                  Proxy address
                </label>
                <p>
                  The railway API only accepts requests from its own site, so Jajabor forwards seat
                  lookups through a small proxy you control.
                </p>
              </div>
              <span
                className={`proxy-pill ${
                  proxyState.status === "online"
                    ? "is-good"
                    : proxyState.status === "offline"
                      ? "is-bad"
                      : ""
                }`}
              >
                {proxyState.status === "checking" ? (
                  <Loader2 size={12} className="spin" />
                ) : proxyState.status === "online" ? (
                  <CheckCircle2 size={12} />
                ) : proxyState.status === "offline" ? (
                  <AlertTriangle size={12} />
                ) : null}
                {proxyState.message || sessionOnline === false ? "Proxy not checked" : "Proxy"}
              </span>
            </div>
            <div className="proxy-row">
              <div className="input-wrap">
                <Terminal size={15} className="input-icon" aria-hidden />
                <input
                  id="proxy-url"
                  className="text-input text-input--mono"
                  value={proxy}
                  onChange={(event) => {
                    setProxy(event.target.value);
                    setProxyState({ status: "idle" });
                  }}
                  placeholder="http://localhost:8788 (leave blank if this site is the proxy)"
                  spellCheck={false}
                />
              </div>
              <button
                type="button"
                className="button button--small button--outline"
                onClick={() => void checkProxy()}
                disabled={proxyState.status === "checking"}
              >
                Check
              </button>
            </div>
            <div className="proxy-help">
              <p>
                Running the app locally? Start it with{" "}
                <code>npm install &amp;&amp; npm run live</code> and open{" "}
                <code>http://localhost:8788</code>. Leave the proxy field blank there.
              </p>
              <p>
                On GitHub Pages, start the proxy locally and use{" "}
                <code>http://localhost:8788</code>. If your browser blocks an HTTPS page calling
                localhost, open the app from the local server instead.
              </p>
            </div>
          </div>

          <label className="checkline">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            <span>
              Remember this session on this device
              <small>
                Off by default. When off, the token is kept only for this browser tab and clears
                when you close it.
              </small>
            </span>
          </label>

          <div className="session-security">
            <ShieldCheck size={18} />
            <div>
              <strong>What leaves this browser?</strong>
              <span>
                Your token is sent only to the proxy address above, which forwards it to the
                railway&apos;s own API. Jajabor has no analytics and no server of its own. Never
                paste a token into a proxy you don&apos;t trust.
              </span>
            </div>
          </div>

          {test.status !== "idle" && (
            <div
              className={`test-result ${
                test.status === "ok" ? "is-good" : test.status === "error" ? "is-bad" : ""
              }`}
            >
              {test.status === "testing" && <Loader2 size={15} className="spin" />}
              {test.status === "ok" && <CheckCircle2 size={15} />}
              {test.status === "error" && <AlertTriangle size={15} />}
              <span>
                {test.status === "testing"
                  ? "Testing the session against the railway API…"
                  : test.message}
              </span>
            </div>
          )}

          {session && (
            <div className="session-current">
              <span>
                <KeyRound size={14} /> A session is saved in this browser.
              </span>
              <button
                type="button"
                className="text-button text-button--danger"
                onClick={() => {
                  onClear();
                  onClose();
                }}
              >
                Forget it
              </button>
            </div>
          )}
        </div>

        <div className="modal__foot">
          <button type="button" className="button button--ghost-dark" onClick={onClose}>
            Cancel
          </button>
          <div className="modal__foot-right">
            <button
              type="button"
              className="button button--outline"
              onClick={() => void handleTest()}
              disabled={!parsed || test.status === "testing"}
            >
              {test.status === "testing" ? <Loader2 size={15} className="spin" /> : null}
              Test connection
            </button>
            <button
              type="button"
              className="button button--green"
              onClick={() => void handleSave()}
              disabled={!parsed || saving}
            >
              {saving ? <Loader2 size={15} className="spin" /> : <KeyRound size={15} />}
              Save &amp; use live
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
