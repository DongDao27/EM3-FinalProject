import { Suspense } from "react";
import { PasswordRecovery } from "@/components/password-recovery";
import { Loading } from "@/components/ui";
export const metadata = {
  title: "Quên mật khẩu",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <PasswordRecovery />
    </Suspense>
  );
}
