"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { sdk, saveToken } from "@/lib/sdk";
import { useAuth } from "@/context/AuthContext";
import { OrganzaLogo } from "@/components/OrganzaLogo";
import { toast } from "sonner";

export default function LoginPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const { setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await sdk.auth.login("user", "emailpass", { email, password });
      const token = typeof result === "string" ? result : (result as unknown as { token: string }).token;
      saveToken(token);

      const { user } = await sdk.admin.user.me();
      const role = user.metadata?.role;
      if (role !== "admin" && role !== "organza_staff") {
        toast.error(t("accessDenied"));
        setLoading(false);
        return;
      }

      setUser({ id: user.id, email: user.email, metadata: user.metadata as Record<string, unknown> });
      window.location.href = `/${locale}`;
    } catch (err) {
      toast.error("Login failed. Check your credentials.");
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f6f6] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl sidebar-gradient flex items-center justify-center mb-4">
            <OrganzaLogo size={40} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">{t("loginTitle")}</h1>
          <p className="text-slate-500 text-sm mt-1">{t("loginSubtitle")}</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              {t("email")}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              dir="ltr"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600 text-sm"
              placeholder="admin@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              {t("password")}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              dir="ltr"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600 text-sm"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-brand text-white font-semibold py-2.5 rounded-xl transition-opacity disabled:opacity-70 mt-2"
          >
            {loading ? "..." : t("loginButton")}
          </button>
        </form>
      </div>
    </div>
  );
}
