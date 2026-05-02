import {
  IconSearch,
  IconPhoto,
  IconPackage,
  IconExternalLink,
} from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import * as api from "@/api/client";
import type { Product, Variant } from "@/types";
import { useCurrency } from "@/hooks/useCurrency";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

const STORE_DOMAIN = "https://organza-moda.com";

interface Props {
  opened: boolean;
  onClose: () => void;
  onPick: (product: Product, variant: Variant) => void;
  currencyCode?: string;
}

export function SearchModal({ opened, onClose, onPick, currencyCode }: Props) {
  const { t } = useTranslation();
  const { format } = useCurrency(currencyCode);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (q: string) => {
    setQuery(q);
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      setResults(await api.searchProducts(q));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setQuery("");
    setResults([]);
    onClose();
  };

  const items = results.flatMap((p) =>
    p.variants.map((v) => ({ product: p, variant: v })),
  );

  return (
    <TooltipProvider>
      <Dialog open={opened} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent
          size="xl"
          className="p-0 gap-0 overflow-hidden flex flex-col"
          style={{ maxHeight: "90vh" }}
        >
          <DialogHeader className="px-5 py-4">
            <DialogTitle className="flex items-center gap-2">
              <IconSearch size={18} className="text-primary" />
              {t("search.title")}
            </DialogTitle>
          </DialogHeader>

          <div className="px-5 pb-4 border-b border-border">
            <Input
              leftSection={<IconSearch size={16} />}
              placeholder={t("search.placeholder")}
              value={query}
              onChange={(e) => handleSearch(e.currentTarget.value)}
              autoFocus
              className="h-11 text-base"
            />
          </div>

          <ScrollArea
            className="flex-1"
            style={{ maxHeight: "calc(90vh - 180px)" }}
          >
            {loading && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <span
                  className="spinner text-primary"
                  style={{ width: 28, height: 28 }}
                />
                <span className="text-sm text-muted-foreground">
                  {t("search.searching")}
                </span>
              </div>
            )}
            {!loading && query.length >= 2 && items.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <IconPackage size={42} className="text-muted-foreground/30" />
                <p className="font-semibold text-muted-foreground">
                  {t("search.noResults")}
                </p>
                <p className="text-xs text-muted-foreground/70">
                  {t("search.tryDifferent")}
                </p>
              </div>
            )}
            {!loading && query.length < 2 && (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <IconSearch size={42} className="text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">
                  {t("search.typeToSearch")}
                </p>
              </div>
            )}
            {!loading && items.length > 0 && (
              <div
                className="grid gap-3 p-4"
                style={{
                  gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))",
                }}
              >
                {items.map(({ product, variant }) => {
                  const price = api.getVariantPrice(variant);
                  const variantLabel =
                    variant.title && variant.title !== "Default Title"
                      ? variant.title
                      : variant.sku || "";
                  const productUrl = product.handle
                    ? `${STORE_DOMAIN}/products/${product.handle}`
                    : null;
                  return (
                    <button
                      key={variant.id}
                      onClick={() => {
                        onPick(product, variant);
                        handleClose();
                      }}
                      className="w-full text-left"
                    >
                      <ProductCard
                        thumbnail={product.thumbnail}
                        title={product.title}
                        variantLabel={variantLabel}
                        price={format(price)}
                        productUrl={productUrl}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

interface ProductCardProps {
  thumbnail: string | null;
  title: string;
  variantLabel?: string;
  price: string;
  productUrl: string | null;
}

export function ProductCard({
  thumbnail,
  title,
  variantLabel,
  price,
  productUrl,
}: ProductCardProps) {
  const { t } = useTranslation();

  return (
    <div className="group relative border border-border rounded-xl overflow-hidden bg-card hover:border-primary/50 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-150 cursor-pointer">
      {productUrl && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={productUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-md transition-opacity hover:bg-primary/80"
              >
                <IconExternalLink size={11} color="white" />
              </a>
            </TooltipTrigger>
            <TooltipContent>{t("search.openOnStore")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      <div className="aspect-square h-[180px] bg-muted overflow-hidden">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <IconPhoto size={34} className="text-muted-foreground/30" />
          </div>
        )}
      </div>
      <div className="p-2.5">
        <p className="font-semibold text-sm line-clamp-2 leading-tight mb-1">
          {title}
        </p>
        {variantLabel && (
          <Badge variant="muted" size="sm" className="mb-1.5">
            {variantLabel}
          </Badge>
        )}
        <p className="font-extrabold text-sm text-primary">{price}</p>
      </div>
    </div>
  );
}
