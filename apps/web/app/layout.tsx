import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import SocketConnector from "./SocketConnector";
import NotificationBell from "./NotificationBell";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "RentalHub",
  description: "Find your next stay",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <SessionProvider>
          <SocketConnector />
            <div style={{ position: "fixed", top: 12, right: 12, zIndex: 100 }}>
              <NotificationBell />
            </div>
          {children}</SessionProvider>
      </body>
    </html>
  );
}