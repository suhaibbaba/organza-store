import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";

type PlaceholderKey = "inventory" | "users";

export async function PlaceholderPage({ namespace }: { namespace: PlaceholderKey }) {
  const t = await getTranslations(`placeholders.${namespace}`);
  const tCommon = await getTranslations("common");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <Card>
        <CardContent className="pt-5">
          <p className="text-sm text-muted-foreground">{tCommon("comingSoon")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
