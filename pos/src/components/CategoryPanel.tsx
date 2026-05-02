import {
  Box,
  Text,
  Group,
  Loader,
  Center,
  Stack,
  UnstyledButton,
  ActionIcon,
  ScrollArea,
  Badge,
  Tooltip,
  TextInput,
  Select,
  Drawer,
} from "@mantine/core";
import {
  IconX,
  IconPhoto,
  IconLayoutGrid,
  IconSearch,
  IconExternalLink,
  IconChevronRight,
} from "@tabler/icons-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useMediaQuery } from "@mantine/hooks";
import * as api from "@/api/client";
import type { Category, Product, Variant } from "@/types";
import { useCurrency } from "@/hooks/useCurrency";

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
      .then((cats) => setCategories(cats))
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
      const nextOffset = currentOffset + newProds.length;
      setOffset(nextOffset);
      setHasMore(nextOffset < count);
    } catch {
      // silent
    } finally {
      setProdLoading(false);
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!selectedCat) return;
    loadPage(selectedCat, 0);
  }, [selectedCat, loadPage]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMore &&
          !loadingRef.current &&
          selectedCat
        ) {
          loadPage(selectedCat, offset);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, offset, selectedCat, loadPage]);

  const filtered =
    filterQuery.trim().length >= 1
      ? products.filter((p) =>
          p.title.toLowerCase().includes(filterQuery.toLowerCase()),
        )
      : products;

  const productGrid = (
    <Box style={{ flex: 1, overflowY: "auto", padding: 12 }}>
      {/* Filter bar */}
      {selectedCat && (
        <Box mb={12}>
          <TextInput
            leftSection={<IconSearch size={14} />}
            placeholder={`Filter in "${selectedCat.name}"…`}
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.currentTarget.value)}
            size="sm"
            radius="md"
          />
        </Box>
      )}

      {!selectedCat && (
        <Center h={isMobile ? 180 : 300}>
          <Stack align="center" gap="sm">
            <IconLayoutGrid size={40} color="var(--mantine-color-gray-4)" />
            <Text fw={600} c="dimmed">
              {isMobile
                ? "Pick a category above"
                : "Select a category from the left"}
            </Text>
          </Stack>
        </Center>
      )}

      {selectedCat && (
        <>
          {filtered.length > 0 && (
            <Box
              style={{
                display: "grid",
                gridTemplateColumns: isMobile
                  ? "repeat(auto-fill, minmax(120px, 1fr))"
                  : "repeat(auto-fill, minmax(150px, 1fr))",
                gap: 10,
              }}
            >
              {filtered.map((product) =>
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
                    <UnstyledButton
                      key={variant.id}
                      onClick={() => onPick(product, variant)}
                      style={{ width: "100%" }}
                    >
                      <CatProductCard
                        thumbnail={product.thumbnail}
                        title={product.title}
                        variantLabel={variantLabel}
                        price={format(price)}
                        productUrl={productUrl}
                      />
                    </UnstyledButton>
                  );
                }),
              )}
            </Box>
          )}

          <div ref={sentinelRef} style={{ height: 1, marginTop: 8 }} />

          {prodLoading && (
            <Center py="lg">
              <Loader size="sm" />
            </Center>
          )}

          {!prodLoading && !hasMore && filtered.length > 0 && (
            <Center py="md">
              <Text size="xs" c="dimmed">
                All {totalCount} products loaded
              </Text>
            </Center>
          )}

          {!prodLoading && products.length === 0 && (
            <Center h={160}>
              <Stack align="center" gap="xs">
                <IconPhoto size={36} color="var(--mantine-color-gray-4)" />
                <Text size="sm" c="dimmed" fw={500}>
                  No products in this category
                </Text>
              </Stack>
            </Center>
          )}

          {!prodLoading && products.length > 0 && filtered.length === 0 && (
            <Center h={160}>
              <Text size="sm" c="dimmed" fw={500}>
                No products match "{filterQuery}"
              </Text>
            </Center>
          )}
        </>
      )}
    </Box>
  );

  // ── MOBILE: Bottom drawer with Select ──────────────────────────────────────
  if (isMobile) {
    return (
      <Drawer
        opened={opened}
        onClose={onClose}
        position="bottom"
        size="90%"
        radius="xl"
        title={
          <Group gap="xs">
            <IconLayoutGrid size={18} />
            <Text fw={700}>Browse Categories</Text>
          </Group>
        }
        styles={{
          body: {
            display: "flex",
            flexDirection: "column",
            padding: 0,
            height: "100%",
            overflow: "hidden",
          },
          header: {
            padding: "12px 16px",
            borderBottom: "1px solid var(--mantine-color-gray-2)",
          },
        }}
      >
        {/* Category Select */}
        <Box
          px={12}
          py={10}
          style={{
            borderBottom: "1px solid var(--mantine-color-gray-2)",
            flexShrink: 0,
          }}
        >
          {catLoading ? (
            <Center py="xs">
              <Loader size="sm" />
            </Center>
          ) : (
            <Select
              placeholder="Select a category…"
              data={categories.map((c) => ({ value: c.id, label: c.name }))}
              value={selectedCat?.id ?? null}
              onChange={(val) => {
                const cat = categories.find((c) => c.id === val) ?? null;
                selectCategory(cat);
              }}
              searchable
              clearable
              size="md"
              radius="md"
              leftSection={<IconLayoutGrid size={16} />}
              rightSection={
                selectedCat && totalCount > 0 ? (
                  <Badge size="xs" variant="filled" color="blue" mr={4}>
                    {totalCount}
                  </Badge>
                ) : undefined
              }
            />
          )}
        </Box>

        {/* Product grid */}
        {productGrid}
      </Drawer>
    );
  }

  // ── DESKTOP: Floating panel ────────────────────────────────────────────────
  if (!opened) return null;

  return (
    <>
      {/* Backdrop */}
      <Box
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 200,
          backdropFilter: "blur(2px)",
          animation: "catFadeIn 0.2s ease",
        }}
      />

      {/* Floating panel */}
      <Box
        style={{
          position: "fixed",
          top: "5vh",
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(96vw, 1000px)",
          height: "88vh",
          background: "var(--mantine-color-white)",
          borderRadius: 20,
          zIndex: 201,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
          animation: "catSlideUp 0.25s ease",
        }}
      >
        {/* Header */}
        <Box
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--mantine-color-gray-2)",
            background: "linear-gradient(90deg, #1a1b2e 0%, #16213e 100%)",
            flexShrink: 0,
            borderRadius: "20px 20px 0 0",
          }}
        >
          <Group justify="space-between" align="center">
            <Group gap="sm">
              <Box
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #228be6, #7c3aed)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <IconLayoutGrid size={16} color="white" />
              </Box>
              <Text fw={700} size="md" c="white">
                Browse Categories
              </Text>
              {selectedCat && (
                <>
                  <IconChevronRight size={14} color="rgba(255,255,255,0.5)" />
                  <Text fw={600} size="sm" c="rgba(255,255,255,0.85)">
                    {selectedCat.name}
                  </Text>
                  {totalCount > 0 && (
                    <Badge size="xs" variant="filled" color="blue">
                      {totalCount}
                    </Badge>
                  )}
                </>
              )}
            </Group>
            <ActionIcon onClick={onClose} variant="subtle" c="white" size="lg">
              <IconX size={20} />
            </ActionIcon>
          </Group>
        </Box>

        {/* Body: sidebar + grid */}
        <Box style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Categories sidebar */}
          <Box
            style={{
              width: 200,
              borderRight: "1px solid var(--mantine-color-gray-2)",
              background: "var(--mantine-color-gray-0)",
              display: "flex",
              flexDirection: "column",
              flexShrink: 0,
            }}
          >
            <Text
              size="xs"
              fw={700}
              tt="uppercase"
              c="dimmed"
              px="md"
              py="sm"
              style={{
                letterSpacing: "0.07em",
                borderBottom: "1px solid var(--mantine-color-gray-2)",
              }}
            >
              Categories
            </Text>
            {catLoading && (
              <Center py="xl">
                <Loader size="sm" />
              </Center>
            )}
            {!catLoading && categories.length === 0 && (
              <Center py="xl" px="md">
                <Text size="xs" c="dimmed" ta="center">
                  No categories found
                </Text>
              </Center>
            )}
            <ScrollArea style={{ flex: 1 }}>
              <Stack gap={2} p="xs">
                {categories.map((cat) => {
                  const isActive = selectedCat?.id === cat.id;
                  return (
                    <UnstyledButton
                      key={cat.id}
                      onClick={() => selectCategory(cat)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: isActive
                          ? "var(--mantine-color-blue-1)"
                          : "transparent",
                        color: isActive
                          ? "var(--mantine-color-blue-7)"
                          : "var(--mantine-color-dark-6)",
                        fontWeight: isActive ? 700 : 500,
                        fontSize: 13,
                        transition: "all 0.1s",
                        borderLeft: isActive
                          ? "3px solid var(--mantine-color-blue-5)"
                          : "3px solid transparent",
                      }}
                    >
                      {cat.name}
                    </UnstyledButton>
                  );
                })}
              </Stack>
            </ScrollArea>
          </Box>

          {/* Product grid */}
          <Box
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {productGrid}
          </Box>
        </Box>
      </Box>

      <style>{`
        @keyframes catFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes catSlideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(24px) }
          to   { opacity: 1; transform: translateX(-50%) translateY(0) }
        }
      `}</style>
    </>
  );
}

// ── Product card ──────────────────────────────────────────────────────────────
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
    <Box
      style={{
        border: "1.5px solid var(--mantine-color-gray-2)",
        borderRadius: 12,
        overflow: "hidden",
        background: "var(--mantine-color-white)",
        transition: "all 0.15s ease",
        cursor: "pointer",
        position: "relative",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "var(--mantine-color-blue-4)";
        el.style.boxShadow = "0 4px 16px rgba(34,139,230,0.15)";
        el.style.transform = "translateY(-2px)";
        const badge = el.querySelector<HTMLElement>("[data-link-badge]");
        if (badge) badge.style.opacity = "1";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "var(--mantine-color-gray-2)";
        el.style.boxShadow = "none";
        el.style.transform = "translateY(0)";
        const badge = el.querySelector<HTMLElement>("[data-link-badge]");
        if (badge) badge.style.opacity = "0";
      }}
    >
      {productUrl && (
        <Box
          data-link-badge
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            zIndex: 10,
            opacity: 0,
            transition: "opacity 0.15s",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Tooltip label="Open on organza-moda.com" position="left" withArrow>
            <ActionIcon
              component="a"
              href={productUrl}
              target="_blank"
              rel="noopener noreferrer"
              size="sm"
              variant="filled"
              color="blue"
              radius="xl"
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}
            >
              <IconExternalLink size={11} />
            </ActionIcon>
          </Tooltip>
        </Box>
      )}
      <Box
        style={{
          position: "relative",
          aspectRatio: "1",
          background: "var(--mantine-color-gray-0)",
          overflow: "hidden",
        }}
      >
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <Center h="100%">
            <IconPhoto size={32} color="var(--mantine-color-gray-4)" />
          </Center>
        )}
      </Box>
      <Box p="xs">
        <Text fw={600} size="sm" lineClamp={2} lh={1.3} mb={4}>
          {title}
        </Text>
        {variantLabel && (
          <Badge variant="light" size="xs" color="gray" mb={4}>
            {variantLabel}
          </Badge>
        )}
        <Text fw={800} size="sm" c="blue.7">
          {price}
        </Text>
      </Box>
    </Box>
  );
}
