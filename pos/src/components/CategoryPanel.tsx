import {
  IconX,
  IconPhoto,
  IconLayoutGrid,
  IconSearch,
  IconExternalLink,
  IconChevronRight,
} from "@tabler/icons-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import * as api from "@/api/client";
import type { Category, Product, Variant } from "@/types";
import { useCurrency } from "@/hooks/useCurrency";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import * as DialogPrimitive from "@radix-ui/react-dialog";

const STORE_DOMAIN = "https://organza-moda.com";
const PAGE_SIZE = 20;

interface Props {
  opened: boolean;
  onClose: () => void;
  onPick: (product: Product, variant: Variant) => void;
  currencyCode?: string;
}

export function CategoryPanel({
  opened,
  onClose,
  onPick,
  currencyCode,
}: Props) {
  const { format } = useCurrency(currencyCode);
  const isMobile = useMediaQuery("(max-width: 768px)");

  const [categories, setCategories] = useState<Category[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [prodLoading, setProdLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filterQuery, setFilterQuery] = useState("");

  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!opened) return;
    setCatLoading(true);
    api
      .getCategories()
      .then(setCategories)
      .catch(() => setCategories([]))
      .finally(() => setCatLoading(false));
  }, [opened]);

  const selectCategory = useCallback((cat: Category | null) => {
    setSelectedCat(cat);
    setProducts([]);
    setOffset(0);
    setHasMore(false);
    setFilterQuery("");
    loadingRef.current = false;
  }, []);

  const loadPage = useCallback(async (cat: Category, currentOffset: number) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setProdLoading(true);
    try {
      const { products: newProds, count } = await api.getProductsByCategory(
        cat.id,
        currentOffset,
        PAGE_SIZE,
      );
      setTotalCount(count);
      setProducts((prev) =>
        currentOffset === 0 ? newProds : [...prev, ...newProds],
      );
      const next = currentOffset + newProds.length;
      setOffset(next);
      setHasMore(next < count);
    } catch {
      /* silent */
    } finally {
      setProdLoading(false);
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (selectedCat) {
      loadPage(selectedCat, 0);
    }
  }, [selectedCat, loadPage]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (
          entry.isIntersecting &&
          hasMore &&
          !loadingRef.current &&
          selectedCat
        )
          loadPage(selectedCat, offset);
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, offset, selectedCat, loadPage]);

  const filtered = filterQuery.trim()
    ? products.filter((p) =>
        p.title.toLowerCase().includes(filterQuery.toLowerCase()),
      )
    : products;

  const ProductGrid = (
    <div className="flex flex-col flex-1 overflow-hidden">
      {selectedCat && (
        <div className="px-4 py-3 border-b border-border flex-shrink-0">
          <Input
            leftSection={<IconSearch size={14} />}
            placeholder={`Filter in "${selectedCat.name}"…`}
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.currentTarget.value)}
            className="h-9 text-sm"
          />
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-4">
          {!selectedCat && (
            <div className="flex flex-col items-center justify-center gap-3 h-52">
              <IconLayoutGrid size={42} className="text-muted-foreground/20" />
              <p className="font-semibold text-muted-foreground/50 text-sm">
                {isMobile
                  ? "Pick a category above"
                  : "Select a category from the left"}
              </p>
            </div>
          )}

          {selectedCat && (
            <>
              {filtered.length > 0 && (
                <div
                  className="grid gap-3"
                  style={{
                    gridTemplateColumns: isMobile
                      ? "repeat(auto-fill, minmax(115px, 1fr))"
                      : "repeat(auto-fill, minmax(145px, 1fr))",
                  }}
                >
                  {filtered.flatMap((product) =>
                    product.variants.map((variant) => {
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
                          onClick={() => onPick(product, variant)}
                          className="w-full text-left"
                        >
                          <CatProductCard
                            thumbnail={product.thumbnail}
                            title={product.title}
                            variantLabel={variantLabel}
                            price={format(price)}
                            productUrl={productUrl}
                          />
                        </button>
                      );
                    }),
                  )}
                </div>
              )}

              <div ref={sentinelRef} style={{ height: 1, marginTop: 8 }} />

              {prodLoading && (
                <div className="flex justify-center py-4">
                  <span
                    className="spinner text-primary"
                    style={{ width: 20, height: 20 }}
                  />
                </div>
              )}

              {!prodLoading && !hasMore && filtered.length > 0 && (
                <p className="text-center text-xs text-muted-foreground py-4">
                  All {totalCount} products loaded
                </p>
              )}

              {!prodLoading && products.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 h-40">
                  <IconPhoto size={34} className="text-muted-foreground/25" />
                  <p className="text-sm text-muted-foreground">
                    No products in this category
                  </p>
                </div>
              )}

              {!prodLoading && products.length > 0 && filtered.length === 0 && (
                <div className="flex items-center justify-center h-40">
                  <p className="text-sm text-muted-foreground">
                    No products match "{filterQuery}"
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  // ── MOBILE: Sheet (bottom drawer via Radix Dialog) ─────────────────────────
  if (isMobile) {
    return (
      <Sheet open={opened} onOpenChange={(o) => !o && onClose()}>
        <SheetContent
          side="bottom"
          className="flex flex-col p-0"
          style={{ height: "90dvh" }}
        >
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <IconLayoutGrid size={18} className="text-primary" />
              Browse Categories
            </SheetTitle>
          </SheetHeader>

          <div className="px-4 pb-3 border-b border-border flex-shrink-0">
            {catLoading ? (
              <div className="flex justify-center py-2">
                <span
                  className="spinner text-primary"
                  style={{ width: 18, height: 18 }}
                />
              </div>
            ) : (
              <Select
                value={selectedCat?.id ?? ""}
                onValueChange={(val) =>
                  selectCategory(categories.find((c) => c.id === val) ?? null)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category…" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {ProductGrid}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <TooltipProvider>
      <DialogPrimitive.Root open={opened} onOpenChange={(o) => !o && onClose()}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            className={cn(
              "fixed inset-0 z-[200] bg-black/50 backdrop-blur-[3px]",
              "data-[state=open]:animate-in   data-[state=open]:fade-in-0",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
              "duration-200",
            )}
          />

          {/* Floating panel */}
          <DialogPrimitive.Content
            className={cn(
              "fixed z-[201] flex flex-col overflow-hidden",
              "bg-card border border-border shadow-2xl",
              // enter
              "data-[state=open]:animate-in",
              "data-[state=open]:fade-in-0",
              "data-[state=open]:zoom-in-[0.97]",
              "data-[state=open]:slide-in-from-bottom-2",
              // exit
              "data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0",
              "data-[state=closed]:zoom-out-[0.97]",
              "data-[state=closed]:slide-out-to-bottom-2",
              "duration-250 ease-[cubic-bezier(0.16,1,0.3,1)]",
              "focus:outline-none",
            )}
            style={{
              top: "5vh",
              left: "50%",
              transform: "translateX(-50%)",
              width: "min(96vw, 1000px)",
              height: "88vh",
              borderRadius: 20,
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 flex-shrink-0 rounded-t-[20px]"
              style={{
                background: "linear-gradient(90deg, #1a3a3e 0%, #235C63 100%)",
              }}
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
                  <IconLayoutGrid size={15} color="white" />
                </div>
                <span className="font-bold text-white">Browse Categories</span>
                {selectedCat && (
                  <>
                    <IconChevronRight size={14} className="text-white/40" />
                    <span className="font-semibold text-sm text-white/80">
                      {selectedCat.name}
                    </span>
                    {totalCount > 0 && (
                      <Badge variant="default" size="sm">
                        {totalCount}
                      </Badge>
                    )}
                  </>
                )}
              </div>
              <DialogPrimitive.Close asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/15 hover:text-white"
                >
                  <IconX size={18} />
                </Button>
              </DialogPrimitive.Close>
            </div>

            {/* Body */}
            <div className="flex flex-1 overflow-hidden">
              {/* Category sidebar */}
              <div className="w-[200px] border-r border-border bg-muted/40 flex flex-col flex-shrink-0">
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest px-4 py-3 border-b border-border">
                  Categories
                </p>

                {catLoading && (
                  <div className="flex justify-center py-8">
                    <span
                      className="spinner text-primary"
                      style={{ width: 18, height: 18 }}
                    />
                  </div>
                )}

                {!catLoading && categories.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center p-4">
                    No categories found
                  </p>
                )}

                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-0.5">
                    {categories.map((cat) => {
                      const isActive = selectedCat?.id === cat.id;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => selectCategory(cat)}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-all border-l-[3px]",
                            isActive
                              ? "bg-primary/10 text-primary font-bold border-primary"
                              : "text-foreground border-transparent hover:bg-accent hover:border-primary/30",
                          )}
                        >
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>

              {ProductGrid}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </TooltipProvider>
  );
}

interface CatProductCardProps {
  thumbnail: string | null;
  title: string;
  variantLabel?: string;
  price: string;
  productUrl: string | null;
}

function CatProductCard({
  thumbnail,
  title,
  variantLabel,
  price,
  productUrl,
}: CatProductCardProps) {
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
            <TooltipContent>Open on organza-moda.com</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <div className="aspect-square h-[180px] bg-muted overflow-hidden">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 max-h-full"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <IconPhoto size={30} className="text-muted-foreground/30" />
          </div>
        )}
      </div>

      <div className="p-2.5">
        <p className="font-semibold text-sm line-clamp-2 leading-tight mb-1">
          {title}
        </p>
        {variantLabel && (
          <Badge variant="muted" size="sm" className="mb-1">
            {variantLabel}
          </Badge>
        )}
        <p className="font-extrabold text-sm text-primary">{price}</p>
      </div>
    </div>
  );
}
