"use client";
import { useState, type FormEvent } from "react";
import { useStore } from "@/components/store-provider";
import { AccountGate } from "@/components/account-gate";
import { PasswordField } from "@/components/password-field";
import { Notice } from "@/components/ui";
import { ApiError } from "@/lib/api-client";
import { errorMessage } from "@/lib/format";
import Link from "next/link";

export default function AccountPage() {
  const { user } = useStore();
  return (
    <AccountGate admin={user?.role === "admin"}>
      <ProfileForm key={user?.id} />
    </AccountGate>
  );
}
function ProfileForm() {
  const { user, updateProfile } = useStore();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const changedIdentity =
    email.trim().toLowerCase() !== (user?.email ?? "") || phone.trim() !== (user?.phone ?? "");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget,
      data = new FormData(form);
    setBusy(true);
    setError("");
    setSuccess("");
    setFields({});
    try {
      const saved = await updateProfile({
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        ...(changedIdentity
          ? { current_password: String(data.get("current_password") ?? "") }
          : {}),
      });
      setName(saved.name);
      setEmail(saved.email ?? "");
      setPhone(saved.phone ?? "");
      setSuccess("Đã cập nhật thông tin cá nhân.");
    } catch (e) {
      setError(errorMessage(e));
      if (e instanceof ApiError) setFields(e.fields);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="container page-section account-page">
      <div className="breadcrumb">
        <Link href="/">Trang chủ</Link>
        <span>/</span>Thông tin cá nhân
      </div>
      <h1>Thông tin cá nhân</h1>
      <form className="form-stack detail-panel profile-form" onSubmit={save}>
        {error && <Notice error>{error}</Notice>}
        {success && <Notice>{success}</Notice>}
        <fieldset disabled={busy}>
          {(
            [
              ["name", "Họ và tên", name, setName, "text", "name"],
              ["email", "Email", email, setEmail, "email", "email"],
              ["phone", "Số điện thoại", phone, setPhone, "tel", "tel"],
            ] as const
          ).map(([id, label, value, setValue, type, auto]) => (
            <label key={id}>
              {label}
              <input
                name={id}
                type={type}
                autoComplete={auto}
                required={id === "name"}
                maxLength={id === "name" ? 120 : id === "email" ? 254 : 20}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setSuccess("");
                }}
                aria-invalid={!!fields[id]}
                aria-describedby={fields[id] ? `profile-${id}-error` : undefined}
              />
              {fields[id] && (
                <small className="field-error" id={`profile-${id}-error`}>
                  {fields[id].join(" ")}
                </small>
              )}
            </label>
          ))}
          {changedIdentity && (
            <>
              <p className="muted">
                Nhập mật khẩu hiện tại để xác nhận đổi email hoặc số điện thoại.
              </p>
              <PasswordField
                name="current_password"
                label="Mật khẩu hiện tại"
                error={fields.current_password?.join(" ")}
                disabled={busy}
              />
            </>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu thay đổi"}
          </button>
        </fieldset>
      </form>
    </section>
  );
}
