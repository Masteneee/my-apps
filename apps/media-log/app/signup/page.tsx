import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-2 text-2xl font-bold">Create your account</h1>
      <p className="mb-6 text-zinc-400">One profile for movies, series, anime, manga, books and games.</p>
      <AuthForm kind="signup" />
    </div>
  );
}
