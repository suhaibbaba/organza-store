"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Package, Barcode, Printer, ArchiveX, Settings, X } from "lucide-react";
import { OrganzaLogo } from "@/components/OrganzaLogo";
import { LanguageToggle } from "./LanguageToggle";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { key: "products", href: "/", icon: Package },
  { key: "barcodes", href: "/barcodes", icon: Barcode },
  { key: "printQueue", href: "/print-queue", icon: Printer },
  { key: "stock", href: "/stock", icon: ArchiveX },
  { key: "settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const locale = useLocale();
  const t = useTranslations("nav");
  const tAuth = useTranslations("auth");
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const isRtl = locale === "ar";

  const isActive = (href: string) => {
    const localePath = `/${locale}${href === "/" ? "" : href}`;
    if (href === "/") return pathname === `/${locale}` || pathname === `/${locale}/`;
    return pathname.startsWith(localePath);
  };

  return (
    <>
      {open !== undefined && open && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={cn(
          "fixed top-0 bottom-0 z-50 w-60 sidebar-gradient flex flex-col transition-transform duration-300",
          isRtl ? "right-0" : "left-0",
          open !== undefined && !open && (isRtl ? "translate-x-full" : "-translate-x-full"),
          open !== undefined && open && "translate-x-0",
          open === undefined && "translate-x-0",
          "lg:translate-x-0"
        )}
      >
        <div className="flex items-center gap-3 px-5 py-6">
          <OrganzaLogo size={36} />
          <div>
            <p className="text-white font-semibold text-sm leading-tight">Organza</p>
            <p className="text-white/50 text-xs">Moda Admin</p>
          </div>
          {open !== undefined && (
            <button onClick={onClose} className="ms-auto text-white/50 hover:text-white lg:hidden">
              <X size={18} />
            </button>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {NAV_ITEMS.map(({ key, href, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={key}
                href={`/${locale}${href === "/" ? "" : href}`}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                  active
                    ? "bg-white/18 text-white"
                    : "text-white/55 hover:text-white hover:bg-white/10"
                )}
              >
                <Icon size={18} />
                {t(key as keyof typeof t)}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-6 space-y-1 border-t border-white/10 pt-4">
          <LanguageToggle />
          {user && (
            <p className="px-3 py-1 text-white/40 text-xs truncate">{user.email}</p>
          )}
          <button
            onClick={() => logout(locale)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-white/55 hover:text-white hover:bg-white/10 transition-colors text-sm w-full"
          >
            {tAuth("logout")}
          </button>
        </div>
      </aside>
    </>
  );
}
