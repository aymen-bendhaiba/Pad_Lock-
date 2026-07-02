"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { loginWithCredentials } from "../lib/api";
import { userFriendlyError } from "../lib/error-messages";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await loginWithCredentials(email, password);
      router.push("/dashboard");
    } catch (loginError) {
      setError(userFriendlyError(loginError, "Connexion impossible. Verifiez vos identifiants et reessayez."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-8" aria-label="Formulaire de connexion" onSubmit={handleSubmit}>
      <div>
        <h3 className="text-[16px] font-semibold leading-none text-[#17171c] dark:text-[#e5eef9]">
          Connexion
        </h3>
        <p className="mt-3 text-[12px] leading-none text-[#777781] dark:text-[#9fb0c7]">
          Saisissez votre email pour acceder a votre compte
        </p>
      </div>

      <div className="mt-5 space-y-3">
        <div>
          <label
            htmlFor="email"
            className="block text-[11px] font-medium leading-none text-[#1d1d22] dark:text-[#d7e2f0]"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="m@example.com"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 h-9 w-full rounded-[4px] border border-[#dddddf] bg-white px-3 text-[12px] text-[#17171c] outline-none transition placeholder:text-[#8a94a6] focus:border-[#1E9ADA] focus:ring-2 focus:ring-[#1E9ADA]/20 dark:border-[#2b3b52] dark:bg-[#101d31] dark:text-[#e5eef9] dark:placeholder:text-[#73849d]"
          />
        </div>

        <div>
          <div className="flex items-center justify-between gap-4">
            <label
              htmlFor="password"
              className="block text-[11px] font-medium leading-none text-[#1d1d22] dark:text-[#d7e2f0]"
            >
              Mot de passe
            </label>
            <Link
              href="#"
              className="text-[11px] font-normal leading-none text-[#1d1d22] underline underline-offset-2 dark:text-[#d7e2f0]"
            >
              Mot de passe oublie ?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 h-9 w-full rounded-[4px] border border-[#dddddf] bg-white px-3 text-[12px] text-[#17171c] outline-none transition placeholder:text-[#8a94a6] focus:border-[#1E9ADA] focus:ring-2 focus:ring-[#1E9ADA]/20 dark:border-[#2b3b52] dark:bg-[#101d31] dark:text-[#e5eef9] dark:placeholder:text-[#73849d]"
          />
        </div>
      </div>

      {error ? (
        <p className="mt-3 rounded-[4px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] leading-snug text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-5">
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-9 w-full rounded-[4px] bg-[#1c1c21] text-[12px] font-medium text-white transition hover:bg-[#0C4E71] focus:outline-none focus:ring-2 focus:ring-[#1E9ADA]/35 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-[#1E9ADA] dark:hover:bg-[#167db4]"
        >
          {isSubmitting ? "Connexion..." : "Se connecter"}
        </button>
      </div>

      <p className="mt-5 text-center text-[12px] leading-none text-[#1d1d22] dark:text-[#d7e2f0]">
        Vous n&apos;avez pas encore de compte ?{" "}
        <Link href="#" className="underline underline-offset-2">
          Creer un compte
        </Link>
      </p>
    </form>
  );
}
