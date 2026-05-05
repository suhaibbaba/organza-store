"use client";
import { useTranslations } from "next-intl";
import { AppLayout } from "@/components/layout/AppLayout";
import { useSettings } from "@/context/SettingsContext";
import { toast } from "sonner";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
      {children}
    </label>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        dir="ltr"
        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600 text-sm"
      />
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? "bg-brand-600" : "bg-slate-200"}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${value ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tNav = useTranslations("nav");
  const { settings, currency, updateSettings, setCurrency } = useSettings();

  const save = () => toast.success(t("saved"));

  return (
    <AppLayout title={tNav("settings")}>
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-slate-800">{t("store")}</h2>
          <div>
            <Label>{t("defaultCurrency")}</Label>
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
              maxLength={3}
              dir="ltr"
              className="w-32 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600 text-sm font-mono uppercase"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-slate-800">{t("printLabels")}</h2>
          <div className="grid grid-cols-2 gap-4">
            <NumberInput label={t("barcodesPerRow")} value={settings.barcodesPerRow} onChange={(v) => updateSettings({ barcodesPerRow: v })} />
            <NumberInput label={t("labelWidth")} value={settings.labelWidthMm} onChange={(v) => updateSettings({ labelWidthMm: v })} />
            <NumberInput label={t("labelHeight")} value={settings.labelHeightMm} onChange={(v) => updateSettings({ labelHeightMm: v })} />
            <NumberInput label={t("barcodeHeight")} value={settings.barcodeHeightPx} onChange={(v) => updateSettings({ barcodeHeightPx: v })} />
          </div>
          <div className="divide-y divide-slate-50">
            <Toggle label={t("showProductName")} value={settings.showProductName} onChange={(v) => updateSettings({ showProductName: v })} />
            <Toggle label={t("showVariantLabel")} value={settings.showVariantLabel} onChange={(v) => updateSettings({ showVariantLabel: v })} />
            <Toggle label={t("showSku")} value={settings.showSku} onChange={(v) => updateSettings({ showSku: v })} />
          </div>
          <button onClick={save} className="btn-brand text-white px-6 py-2.5 rounded-xl text-sm font-semibold">
            {t("saved")}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
