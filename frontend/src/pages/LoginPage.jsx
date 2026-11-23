import { useEffect, useRef, useState } from "react";
import { Brand, Spinner } from "../components/index.js";
import { api } from "../services/api.js";

// Render the sign-in screen and hand each successful session back to App.jsx.
export default function Auth({ config, onSession }) {
  // Use the same form for signing in and creating an account.
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const googleRef = useRef(null);
  // Send the form to the server, then give App.jsx the account and login token.
  async function authenticate(path, body) {
    setBusy(true);
    setError("");
    try {
      onSession(await api(path, { method: "POST", body }));
    } catch (error) {
      setError(
        error instanceof TypeError
          ? "The backend is unavailable. Start it and try again."
          : error.message,
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    // Show Google sign-in only when it is set up on the server.
    if (!config?.googleClientId) return;
    // Ask Google to render its button and forward the returned credential to the API for verification.
    const initialise = () => {
      if (!window.google || !googleRef.current) return;
      window.google.accounts.id.initialize({
        client_id: config.googleClientId,
        callback: (response) =>
          authenticate("/auth/google", { credential: response.credential }),
      });
      window.google.accounts.id.renderButton(googleRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        width: Math.min(360, googleRef.current.clientWidth),
        text: "continue_with",
      });
    };
    // Load the Google client script only if it is needed and has not already loaded.
    if (window.google) initialise();
    else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = initialise;
      script.onerror = () =>
        setError(
          "Google sign-in could not load. You can still sign in with email.",
        );
      document.head.append(script);
    }
  }, [config?.googleClientId]);
  const registering = mode === "register";
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <Brand />
        <h1 id="auth-title">{registering ? "Create an account" : "Sign in"}</h1>
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault();
            // Send the name during registration. The login endpoint accepts only email and password.
            authenticate(
              `/auth/${mode}`,
              registering ? form : { email: form.email, password: form.password },
            );
          }}
        >
          {registering && (
            <label>
              Name
              <input
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                minLength={2}
                maxLength={80}
                autoComplete="name"
                required
              />
            </label>
          )}
          <label>
            Email address
            <input
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
              required
            />
          </label>
          <div className="auth-password-field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              autoComplete={registering ? "new-password" : "current-password"}
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
              required
              minLength={registering ? 10 : 1}
              maxLength={128}
              aria-describedby={registering ? "password-hint" : undefined}
            />
            {registering && (
              <small id="password-hint">Use at least 10 characters.</small>
            )}
          </div>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <button className="button button-primary" disabled={busy}>
            {busy && <Spinner />}
            {registering ? "Create account" : "Sign in"}
          </button>
        </form>
        <p className="auth-mode">
          {registering ? "Already have an account?" : "New to StudyPass?"}{" "}
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => {
              setMode(registering ? "login" : "register");
              setError("");
            }}
          >
            {registering ? "Sign in" : "Create an account"}
          </button>
        </p>
        {/* Show alternative sign-in options only when the API has enabled them. */}
        {(config?.googleClientId || config?.demoEnabled) && (
          <div className="auth-alternatives">
            {config.googleClientId && <div ref={googleRef} />}
            {config.demoEnabled && (
              <button
                type="button"
                className="button button-secondary"
                disabled={busy}
                onClick={() => authenticate("/auth/demo", {})}
              >
                Open a sample workspace
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
