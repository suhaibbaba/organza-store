import { useState } from "react";
import {
  IconShoppingCart,
  IconAt,
  IconLock,
  IconEye,
  IconEyeOff,
  IconLanguage,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import * as api from "@/api/client";

interface Props {
  onLogin: () => void;
  onLanguageToggle: () => void;
}

export function LoginScreen({ onLogin, onLanguageToggle }: Props) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await api.login(email, password);
      onLogin();
    } catch {
      setErr(t("login.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background:
          "linear-gradient(150deg, #0f2b2e 0%, #1a4448 40%, #235C63 100%)",
      }}
    >
      {/* Decorative rings */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full border border-white/5" />
        <div className="absolute -top-16 -right-16 w-[380px] h-[380px] rounded-full border border-white/5" />
        <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full border border-white/5" />
        <div className="absolute bottom-1/4 right-1/4 w-2 h-2 rounded-full bg-white/20" />
        <div className="absolute top-1/3 left-1/4 w-1.5 h-1.5 rounded-full bg-teal-300/30" />
        <div className="absolute top-2/3 right-1/3 w-1 h-1 rounded-full bg-white/30" />
      </div>

      <div className="w-full max-w-[400px] relative z-10 animate-fade-in">
        {/* Language toggle */}
        <div className="flex justify-end mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={onLanguageToggle}
            className="text-white/60 hover:text-white hover:bg-white/10"
          >
            <IconLanguage size={16} />
            {t("app.language")}
          </Button>
        </div>

        {/* Brand */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-2xl"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.25), rgba(255,255,255,0.08))",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            <IconShoppingCart size={30} color="white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {t("app.title")}
          </h1>
          <p className="text-white/50 text-sm mt-1">{t("login.subtitle")}</p>
        </div>

        <Card
          className="shadow-2xl border-0"
          style={{ background: "rgba(255,255,255,0.97)" }}
        >
          <CardContent className="p-6">
            <h2 className="text-xl font-bold text-foreground mb-1">
              {t("login.welcomeBack")}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {t("login.signInToPOS")}
            </p>

            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("login.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.currentTarget.value)}
                  required
                  autoComplete="email"
                  leftSection={<IconAt size={15} />}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">{t("login.password")}</Label>
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  required
                  autoComplete="current-password"
                  leftSection={<IconLock size={15} />}
                  rightSection={
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="hover:text-foreground transition-colors"
                    >
                      {showPw ? (
                        <IconEyeOff size={15} />
                      ) : (
                        <IconEye size={15} />
                      )}
                    </button>
                  }
                />
              </div>

              {err && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5">
                  <p className="text-sm text-destructive font-medium">{err}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                loading={loading}
                variant="brand"
              >
                {loading ? t("login.signingIn") : t("login.submit")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs mt-6 text-white/25">
          {t("app.poweredBy")}
        </p>
      </div>
    </div>
  );
}
