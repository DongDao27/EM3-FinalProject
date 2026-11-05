"use client";

import { useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/format";

export function NewsletterForm() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ message: string }>("/newsletter/subscriptions", {
        method: "POST",
        body: {
          email: fields.get("email"),
          consent: fields.get("consent") === "on",
        },
      });
      setMessage(result.data.message);
      form.reset();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="newsletter" aria-labelledby="newsletter-title">
      <h2 id="newsletter-title">Đăng ký nhận bản tin</h2>
      <p>Sách mới và cảm hứng đọc sách, gửi đến bạn qua email.</p>
      <form onSubmit={submit}>
        <label className="sr-only" htmlFor="newsletter-email">
          Email nhận bản tin
        </label>
        <div className="newsletter-input">
          <input
            id="newsletter-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="Nhập địa chỉ email của bạn"
            maxLength={254}
            required
            disabled={busy}
          />
          <button className="button primary" disabled={busy}>
            {busy ? "Đang đăng ký…" : "Đăng ký"}
          </button>
        </div>
        <label className="newsletter-consent">
          <input name="consent" type="checkbox" required disabled={busy} />
          Tôi đồng ý nhận bản tin qua email.
        </label>
      </form>
      <div className="newsletter-feedback" aria-live="polite">
        {message && <p role="status">{message}</p>}
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
