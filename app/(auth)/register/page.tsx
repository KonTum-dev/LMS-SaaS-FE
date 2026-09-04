import type { Metadata } from "next";
import { PublicRegistrationPage } from "@/components/account-security/public-registration-page";

export const metadata: Metadata = {
  title: "Tạo workspace dùng thử",
  description:
    "Tạo tài khoản quản trị và workspace DX LMS dùng thử cho lớp học hoặc trung tâm đào tạo.",
};

export default function RegisterPage() {
  return <PublicRegistrationPage />;
}
