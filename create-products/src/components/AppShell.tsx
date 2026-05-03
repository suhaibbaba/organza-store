"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Package,
  Barcode,
  Layers,
  Settings,
  Menu,
  X,
  Printer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OrganzaLogo } from "./OrganzaLogo";
import { barcodeQueue } from "@/lib/barcodeQueue";

const links = [
  { href: "/products", icon: Package, label: "Products", labelAr: "المنتجات" },
  { href: "/barcode", icon: Barcode, label: "Barcode", labelAr: "الباركود" },
  { href: "/stock", icon: Layers, label: "Stock", labelAr: "المخزون" },
  {
    href: "/settings",
    icon: Settings,
    label: "Settings",
    labelAr: "الإعدادات",
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [queueCount, setQueueCount] = useState(0);

  // Refresh queue badge whenever path changes
  useEffect(() => {
    setQueueCount(barcodeQueue.unprintedCount());
  }, [path]);

  // Also listen for storage events (cross-tab)
  useEffect(() => {
    const handler = () => setQueueCount(barcodeQueue.unprintedCount());
    window.addEventListener("storage", handler);
    // Also update on focus
    window.addEventListener("focus", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("focus", handler);
    };
  }, []);

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "#f0f5f5" }}
    >
      {/* ── Desktop Sidebar ───────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col z-30 w-16 lg:w-60 flex-shrink-0 shadow-2xl"
        style={{
          background: "linear-gradient(180deg, #1a444a 0%, #235C63 100%)",
        }}
      >
        {/* Brand */}
        <div
          className="flex items-center gap-3 px-3 lg:px-5 h-16 border-b"
          style={{ borderColor: "rgba(255,255,255,0.1)" }}
        >
          <OrganzaLogo size={34} />
          <span className="hidden lg:block text-white font-bold text-base tracking-tight">
            Organza
          </span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-4 space-y-0.5 px-2">
          {links.map(({ href, icon: Icon, label }) => {
            const active =
              path === href ||
              (href !== "/barcode" && path.startsWith(href)) ||
              (href === "/barcode" && path.startsWith("/barcode"));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative",
                  active ? "text-white shadow-lg" : "hover:text-white",
                )}
                style={
                  active
                    ? { background: "rgba(255,255,255,0.18)", color: "white" }
                    : { color: "rgba(255,255,255,0.55)" }
                }
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="hidden lg:block text-sm font-semibold">
                  {label}
                </span>
                {href === "/barcode" && queueCount > 0 && (
                  <span className="absolute right-2 top-2 min-w-[18px] h-[18px] bg-amber-400 text-amber-900 text-[10px] font-bold rounded-full flex items-center justify-center px-1 hidden lg:flex">
                    {queueCount}
                  </span>
                )}
              </Link>
            );
          })}

          {/* Print queue shortcut */}
          <Link
            href="/barcode/print"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative",
              path === "/barcode/print"
                ? "text-white shadow-lg"
                : "hover:text-white",
            )}
            style={
              path === "/barcode/print"
                ? { background: "rgba(255,255,255,0.18)", color: "white" }
                : { color: "rgba(255,255,255,0.55)" }
            }
          >
            <Printer className="w-5 h-5 flex-shrink-0" />
            <span className="hidden lg:block text-sm font-semibold">
              Print Queue
            </span>
            {queueCount > 0 && (
              <span className="absolute right-2 top-2 min-w-[18px] h-[18px] bg-amber-400 text-amber-900 text-[10px] font-bold rounded-full flex items-center justify-center px-1 hidden lg:flex">
                {queueCount}
              </span>
            )}
          </Link>
        </nav>

        {/* Footer */}
        <div
          className="p-2 border-t"
          style={{ borderColor: "rgba(255,255,255,0.1)" }}
        >
          <div className="flex items-center gap-2 px-3 py-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.2)" }}
            >
              <span className="text-white text-[10px] font-bold">A</span>
            </div>
            <span
              className="hidden lg:block text-xs font-medium truncate"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              Admin
            </span>
          </div>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden bg-white border-b border-brand-100 px-4 h-14 flex items-center justify-between flex-shrink-0 z-20">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "#235C63" }}
            >
              <OrganzaLogo size={22} />
            </div>
            <span className="font-bold text-brand-700 text-sm">Organza</span>
          </div>
          <button
            onClick={() => setMobileNavOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-brand-50 transition-colors relative"
          >
            <Menu className="w-5 h-5 text-brand-600" />
            {queueCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-amber-400 text-amber-900 text-[9px] font-bold rounded-full flex items-center justify-center">
                {queueCount}
              </span>
            )}
          </button>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-y-auto">{children}</main>

        {/* Mobile bottom nav */}
        <nav
          className="md:hidden bg-white border-t border-brand-100 flex-shrink-0 z-20"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="flex">
            {[
              ...links,
              {
                href: "/barcode/print",
                icon: Printer,
                label: "Print",
                labelAr: "طباعة",
              },
            ].map(({ href, icon: Icon, label }) => {
              const active =
                path === href ||
                (href !== "/barcode" &&
                  href !== "/barcode/print" &&
                  path.startsWith(href)) ||
                (href === "/barcode" && path === "/barcode") ||
                (href === "/barcode/print" && path === "/barcode/print");
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors relative"
                >
                  <Icon
                    className={cn(
                      "w-5 h-5",
                      active ? "text-brand-600" : "text-slate-400",
                    )}
                  />
                  <span
                    className={cn(
                      "text-[9px] font-semibold",
                      active ? "text-brand-600" : "text-slate-400",
                    )}
                  >
                    {label}
                  </span>
                  {href === "/barcode/print" && queueCount > 0 && (
                    <span className="absolute top-1.5 right-[calc(50%-18px)] w-4 h-4 bg-amber-400 text-amber-900 text-[9px] font-bold rounded-full flex items-center justify-center">
                      {queueCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          />
          <div
            className="relative w-64 flex flex-col shadow-2xl"
            style={{
              background: "linear-gradient(180deg, #1a444a 0%, #235C63 100%)",
            }}
          >
            <div
              className="flex items-center justify-between px-5 h-14 border-b"
              style={{ borderColor: "rgba(255,255,255,0.1)" }}
            >
              <div className="flex items-center gap-2.5">
                <OrganzaLogo size={26} />
                <span className="text-white font-bold">Organza</span>
              </div>
              <button
                onClick={() => setMobileNavOpen(false)}
                style={{ color: "rgba(255,255,255,0.6)" }}
                className="hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 py-4 space-y-0.5 px-2">
              {[
                ...links,
                {
                  href: "/barcode/print",
                  icon: Printer,
                  label: "Print Queue",
                  labelAr: "طباعة",
                },
              ].map(({ href, icon: Icon, label }) => {
                const active = path.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileNavOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-semibold relative"
                    style={
                      active
                        ? {
                            background: "rgba(255,255,255,0.18)",
                            color: "white",
                          }
                        : { color: "rgba(255,255,255,0.6)" }
                    }
                  >
                    <Icon className="w-5 h-5" />
                    {label}
                    {href === "/barcode/print" && queueCount > 0 && (
                      <span className="ml-auto min-w-[20px] h-5 bg-amber-400 text-amber-900 text-[10px] font-bold rounded-full flex items-center justify-center px-1.5">
                        {queueCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
