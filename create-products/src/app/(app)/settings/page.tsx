"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Globe,
  LogOut,
  ShoppingBag,
  Plus,
  Check,
  Languages,
} from "lucide-react";
import {
  getBackendUrl,
  setBackendUrl,
  setToken,
  getMainLang,
  setMainLang,
} from "@/lib/storage";
import { getCollections, createCollection } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import type { Collection } from "@/types";

function SettingCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center">
          <Icon className="w-4 h-4 text-brand-600" />
        </div>
        <p className="font-semibold text-slate-800">{title}</p>
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [backendUrl, setBackendUrlState] = useState(getBackendUrl());
  const [mainLang, setMainLangState] = useState<"en" | "ar">(getMainLang());
  const [collections, setCollections] = useState<Collection[]>([]);
  const [newCol, setNewCol] = useState("");
  const [addingCol, setAddingCol] = useState(false);

  useEffect(() => {
    getCollections()
      .then(setCollections)
      .catch(() => {});
  }, []);

  const saveUrl = () => {
    setBackendUrl(backendUrl.trim());
    toast.success("Backend URL saved");
  };
  const saveLang = (lang: "en" | "ar") => {
    setMainLang(lang);
    setMainLangState(lang);
    toast.success("Main language updated");
  };
  const logout = () => {
    setToken(null);
    router.push("/login");
  };

  const addCollection = async () => {
    if (!newCol.trim()) return;
    setAddingCol(true);
    try {
      const col = await createCollection(newCol.trim());
      setCollections((prev) => [...prev, col]);
      setNewCol("");
      toast.success("Collection created");
    } catch {
      toast.error("Failed to create collection");
    } finally {
      setAddingCol(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-5">
      <h1 className="text-xl font-bold text-slate-900 mb-5">
        Settings / الإعدادات
      </h1>
      <div className="space-y-4">
        {/* Backend */}
        <SettingCard title="Backend Connection" icon={Globe}>
          <Input
            label="Backend URL"
            value={backendUrl}
            onChange={(e) => setBackendUrlState(e.target.value)}
            placeholder="http://localhost:9000"
          />
          <button
            onClick={saveUrl}
            className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-colors"
          >
            Save URL
          </button>
        </SettingCard>

        {/* Main language */}
        <SettingCard title="Main Language / اللغة الرئيسية" icon={Languages}>
          <p className="text-xs text-slate-500">
            The primary language (★) shown first in bilingual product fields. AI
            translation is free via MyMemory — no API key needed.
          </p>
          <div className="flex gap-2">
            {(["en", "ar"] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => saveLang(lang)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-bold transition-all ${
                  mainLang === lang
                    ? "border-brand-600 bg-brand-50 text-brand-700"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                {mainLang === lang && <Check className="w-4 h-4" />}
                {lang === "en" ? "🇬🇧 English" : "🇸🇦 العربية"}
              </button>
            ))}
          </div>
          <div className="flex items-start gap-2 bg-emerald-50 rounded-xl p-3">
            <span className="text-emerald-500 text-sm">✓</span>
            <p className="text-xs text-emerald-700 font-medium">
              AI translation powered by MyMemory — free, no signup required.
              Click the ✦ AI button next to any field to translate instantly.
            </p>
          </div>
        </SettingCard>

        {/* Collections */}
        <SettingCard title="Collections / المجموعات" icon={ShoppingBag}>
          {collections.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-2">
              No collections yet
            </p>
          ) : (
            <div className="divide-y divide-slate-50">
              {collections.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between py-2.5"
                >
                  <p className="text-sm font-medium text-slate-800">
                    {c.title}
                  </p>
                  <p className="text-xs text-slate-400">/{c.handle}</p>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <input
              value={newCol}
              onChange={(e) => setNewCol(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCollection()}
              placeholder="New collection name…"
              className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
            />
            <button
              onClick={addCollection}
              disabled={addingCol}
              className="px-4 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-500 transition-all active:scale-95 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </SettingCard>

        {/* App info */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">Organza</p>
            <p className="text-xs text-slate-400">v2.0.0 · Organza</p>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-4 bg-red-50 text-red-600 font-semibold rounded-2xl border border-red-100 active:scale-[0.98] transition-all"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>
    </div>
  );
}
