import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Organza Moda — Admin",
  description: "Admin panel for Organza Moda",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
