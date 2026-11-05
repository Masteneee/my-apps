import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold">Create your account</h1>
      <p className="mb-6 text-muted">One account for your check-ins, habits and streaks.</p>
      <AuthForm kind="signup" />
    </div>
  );
}
