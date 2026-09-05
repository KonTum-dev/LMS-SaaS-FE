import { FeedbackLanguageSwitcher } from "@/components/feedback/feedback-locale";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <><div className="auth-feedback-language"><FeedbackLanguageSwitcher /></div>{children}</>;
}
