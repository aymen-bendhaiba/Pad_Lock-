import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SplashPreloader } from "./splash-preloader";
import { AlertToastListener } from "./alert-toast-listener";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Plateforme de gestion intelligente",
  description:
    "Surveillez, securisez et gerez les PadLock en temps reel.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          id="pad-lock-theme-init"
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('pad-lock-theme');var dark=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',dark);}catch(e){}`,
          }}
        />
        <SplashPreloader />
        <AlertToastListener />
        {children}
      </body>
    </html>
  );
}

