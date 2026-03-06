import { useEffect, useRef, useState } from "react";
import { googleAuth, type AuthResponse } from "../lib/api";

const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const GOOGLE_CLIENT_ID = String(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "").trim();

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleAccountsIdApi = {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    context?: "signin" | "signup" | "use";
  }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
};

type GoogleWindow = Window & {
  google?: {
    accounts?: {
      id?: GoogleAccountsIdApi;
    };
  };
};

let googleScriptPromise: Promise<void> | null = null;

function loadGoogleScript(): Promise<void> {
  if ((window as GoogleWindow).google?.accounts?.id) {
    return Promise.resolve();
  }
  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_SCRIPT_SRC}"]`);
    if (existing) {
      if ((window as GoogleWindow).google?.accounts?.id) {
        resolve();
        return;
      }
      if (existing.dataset.loaded === "true") {
        reject(new Error("Google script loaded without API."));
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google script.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error("Failed to load Google script."));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

type GoogleAuthButtonProps = {
  mode: "login" | "signup";
  theme: "light" | "dark";
  disabled?: boolean;
  className?: string;
  onSuccess: (response: AuthResponse) => void;
  onError: (message: string) => void;
};

export function GoogleAuthButton({
  mode,
  theme,
  disabled = false,
  className,
  onSuccess,
  onError,
}: GoogleAuthButtonProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const [status, setStatus] = useState<"idle" | "loading" | "unavailable">("idle");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    let cancelled = false;

    async function initializeButton() {
      if (!GOOGLE_CLIENT_ID) {
        setStatus("unavailable");
        setStatusMessage("Google sign-in is not configured.");
        return;
      }

      try {
        await loadGoogleScript();
        if (cancelled) return;

        const googleId = (window as GoogleWindow).google?.accounts?.id;
        const container = containerRef.current;
        if (!googleId || !container) {
          setStatus("unavailable");
          setStatusMessage("Google sign-in is currently unavailable.");
          return;
        }

        googleId.initialize({
          client_id: GOOGLE_CLIENT_ID,
          auto_select: false,
          cancel_on_tap_outside: true,
          context: mode === "signup" ? "signup" : "signin",
          callback: async (response) => {
            const idToken = String(response.credential ?? "").trim();
            if (!idToken) {
              onErrorRef.current("Google sign-in failed. Please try again.");
              return;
            }

            setStatus("loading");
            setStatusMessage("");
            try {
              const authResponse = await googleAuth(idToken);
              onSuccessRef.current(authResponse);
            } catch (error) {
              onErrorRef.current((error as Error).message || "Google sign-in failed.");
            } finally {
              if (!cancelled) {
                setStatus("idle");
              }
            }
          },
        });

        container.innerHTML = "";
        const width = Math.max(220, Math.min(360, Math.floor(container.clientWidth || 320)));
        googleId.renderButton(container, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "pill",
          text: mode === "signup" ? "signup_with" : "signin_with",
          logo_alignment: "center",
          width,
        });

        setStatus("idle");
        setStatusMessage("");
      } catch {
        if (cancelled) return;
        setStatus("unavailable");
        setStatusMessage("Google sign-in is currently unavailable.");
      }
    }

    initializeButton();
    return () => {
      cancelled = true;
    };
  }, [mode, theme]);

  const rootClassName = ["google-auth-button", className].filter(Boolean).join(" ");
  const unavailable = status === "unavailable";

  return (
    <div className={rootClassName}>
      <div
        ref={containerRef}
        className={`google-auth-render${disabled || status === "loading" ? " is-disabled" : ""}${unavailable ? " is-hidden" : ""}`}
        aria-hidden={unavailable}
      />
      {unavailable ? (
        <button type="button" className="google-auth-fallback" disabled>
          Continue with Google
        </button>
      ) : null}
      {status === "loading" ? <p className="google-auth-status">Signing in with Google...</p> : null}
      {unavailable && statusMessage ? <p className="google-auth-status">{statusMessage}</p> : null}
    </div>
  );
}
