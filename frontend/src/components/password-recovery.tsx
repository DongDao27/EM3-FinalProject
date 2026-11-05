"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api-client";
import { errorMessage } from "@/lib/format";
import { storeInfo } from "@/lib/store-info";
import { PasswordField } from "./password-field";
import { Notice } from "./ui";

export function PasswordRecovery({ reset = false }: { reset?: boolean }) {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const locked = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setFields({});
    const values = new FormData(event.currentTarget);
    try {
      const result = await api<{ message: string }>(
        `/auth/${reset ? "reset-password" : "forgot-password"}`,
        {
          method: "POST",
          body: reset
            ? {
                email,
                token,
                password: String(values.get("password")),
                password_confirmation: String(values.get("password_confirmation")),
              }
            : { email },
        },
      );
      setMessage(result.data.message);
      if (reset) window.history.replaceState(null, "", "/reset-password");
    } catch (cause) {
      setError(errorMessage(cause));
      if (cause instanceof ApiError) setFields(cause.fields);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const invalidLink = reset && !/^[a-f0-9]{64}$/.test(token) && !message;
  return (
    <section className="container recovery-page">
      <div className="recovery-card">
        <span className="eyebrow">TÀI KHOẢN THU THANH</span>
        <h1>{reset ? "Đặt mật khẩu mới" : "Bạn quên mật khẩu?"}</h1>
        <p className="muted">
          {reset
            ? "Chọn mật khẩu mới để tiếp tục mua sắm. Các phiên đăng nhập cũ sẽ kết thúc."
            : "Nhập email đã đăng ký. Liên kết khôi phục chỉ dùng một lần và có hiệu lực trong 60 phút."}
        </p>
        {message && <Notice>{message}</Notice>}
        {error && (
          <Notice error>
            {error}
            {fields.token && <p>{fields.token.join(" ")}</p>}
          </Notice>
        )}
        {invalidLink ? (
          <Notice error>
            Liên kết chưa đầy đủ hoặc không hợp lệ.{" "}
            <Link href="/forgot-password">Yêu cầu liên kết mới</Link>
          </Notice>
        ) : (
          !message && (
            <form className="form-stack" onSubmit={submit}>
              <label htmlFor="recovery-email">Email đăng ký</label>
              <input
                id="recovery-email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
                aria-invalid={!!fields.email}
                aria-describedby={fields.email ? "recovery-email-error" : undefined}
              />
              {fields.email && (
                <small className="field-error" id="recovery-email-error">
                  {fields.email.join(" ")}
                </small>
              )}
              {reset && (
                <>
                  <PasswordField
                    label="Mật khẩu mới"
                    newPassword
                    error={fields.password?.join(" ")}
                    disabled={busy}
                  />
                  <PasswordField
                    name="password_confirmation"
                    label="Nhập lại mật khẩu mới"
                    newPassword
                    error={fields.password_confirmation?.join(" ")}
                    disabled={busy}
                  />
                </>
              )}
              <button className="button primary full" disabled={busy}>
                {busy ? "Đang xử lý…" : reset ? "Lưu mật khẩu mới" : "Gửi liên kết khôi phục"}
              </button>
            </form>
          )
        )}
        {message && !reset && (
          <button
            className="text-button"
            onClick={() => {
              setMessage("");
              setError("");
            }}
          >
            Dùng email khác hoặc gửi lại
          </button>
        )}
        <a className="recovery-back" href="/login">
          Quay lại đăng nhập →
        </a>
        <div className="recovery-support">
          <strong>Bạn đăng ký chỉ bằng số điện thoại?</strong>
          <p>
            Khôi phục tự động hiện hỗ trợ email. Liên hệ{" "}
            <a href={storeInfo.phoneHref}>{storeInfo.phone}</a> để được hướng dẫn,{" "}
            {storeInfo.hours.toLowerCase()}.
          </p>
        </div>
      </div>
    </section>
  );
}
