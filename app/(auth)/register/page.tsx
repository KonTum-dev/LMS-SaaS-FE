import type { Metadata } from "next";
import { PublicRegistrationPage } from "@/components/account-security/public-registration-page";
import { getServerI18n } from "@/lib/i18n/server";
import { authMessages } from "@/lib/i18n/auth-messages";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerI18n(authMessages);
  return {
  title: t("Tạo workspace dùng thử"),
  description:
    t("Tạo tài khoản quản trị và workspace DX LMS dùng thử cho lớp học hoặc trung tâm đào tạo."),
};
}

export default function RegisterPage() {
  return <PublicRegistrationPage />;
}
