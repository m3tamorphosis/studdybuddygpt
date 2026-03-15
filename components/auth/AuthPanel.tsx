"use client";

import { FormEvent, useState } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function AuthPanel() {
  const { user, loading, configured } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setError("Supabase is not configured yet.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "sign-up") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password
        });

        if (signUpError) {
          throw signUpError;
        }

        setMessage("Account created. Check your email if confirmation is enabled.");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (signInError) {
          throw signInError;
        }

        setMessage("Signed in successfully.");
      }
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Auth request failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        throw signOutError;
      }

      setMessage("Signed out.");
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : "Sign out failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!configured) {
    return (
      <section className="panel p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-ocean">Supabase</p>
        <p className="mt-3 text-sm leading-7 text-[color:var(--text-muted)]">
          Add <code className="rounded bg-[color:var(--secondary-bg)] px-1 py-0.5">NEXT_PUBLIC_SUPABASE_URL</code>, <code className="rounded bg-[color:var(--secondary-bg)] px-1 py-0.5">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, and <code className="rounded bg-[color:var(--secondary-bg)] px-1 py-0.5">NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET</code> to enable accounts and saved study history.
        </p>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="panel p-5">
        <p className="text-sm text-[color:var(--text-muted)]">Checking your study account...</p>
      </section>
    );
  }

  if (user) {
    return (
      <section className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-ocean">Study Account</p>
            <p className="mt-3 text-sm text-[color:var(--text-main)]">Signed in as <span className="font-semibold">{user.email ?? "unknown user"}</span></p>
            <p className="mt-2 text-sm leading-7 text-[color:var(--text-muted)]">Your quiz attempts, notes, key terms, flashcards, and PDF metadata can now sync to Supabase.</p>
          </div>
          <button className="secondary-button px-4 py-2 text-sm" disabled={submitting} onClick={handleSignOut} type="button">
            {submitting ? "Signing out..." : "Sign Out"}
          </button>
        </div>
        {message ? <p className="mt-3 text-sm text-[color:var(--text-muted)]">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-rose-500">{error}</p> : null}
      </section>
    );
  }

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-ocean">Study Account</p>
          <p className="mt-2 text-sm leading-7 text-[color:var(--text-muted)]">Create an account or sign in to save PDF study results and quiz attempts.</p>
        </div>
        <div className="flex rounded-2xl border border-[color:var(--field-border)] bg-[color:var(--field-bg)] p-1">
          <button className={["rounded-xl px-3 py-2 text-sm font-medium transition", mode === "sign-in" ? "primary-button" : "text-[color:var(--text-muted)]"].join(" ")} onClick={() => setMode("sign-in")} type="button">Sign In</button>
          <button className={["rounded-xl px-3 py-2 text-sm font-medium transition", mode === "sign-up" ? "primary-button" : "text-[color:var(--text-muted)]"].join(" ")} onClick={() => setMode("sign-up")} type="button">Sign Up</button>
        </div>
      </div>

      <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={handleSubmit}>
        <input className="field" onChange={(event) => setEmail(event.target.value)} placeholder="Email" type="email" value={email} />
        <input className="field" onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" value={password} />
        <button className="primary-button px-5 py-3" disabled={submitting || !email || !password} type="submit">
          {submitting ? "Please wait..." : mode === "sign-up" ? "Create Account" : "Sign In"}
        </button>
      </form>

      {message ? <p className="mt-3 text-sm text-[color:var(--text-muted)]">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-500">{error}</p> : null}
    </section>
  );
}
