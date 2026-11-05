import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Welcome back</h1>
      <AuthForm kind="login" />
    </div>
  );
}
