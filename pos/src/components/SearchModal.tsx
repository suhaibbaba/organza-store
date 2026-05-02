import {
  Modal,
  TextInput,
  Text,
  Group,
  UnstyledButton,
  Loader,
  Center,
  Badge,
  Box,
  Stack,
  Tooltip,
  ActionIcon,
} from "@mantine/core";
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
      const r = await api.searchProducts(q);
      setResults(r);
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
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="xs">
          <IconSearch size={18} />
          <Text fw={700} size="md">
            {t("search.title")}
          </Text>
        </Group>
      }
      size="xl"
      centered
      styles={{
        header: {
          borderBottom: "1px solid var(--mantine-color-gray-2)",
          paddingBottom: 12,
        },
        body: { padding: 0 },
      }}
    >
      <Box
        p="md"
        style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}
      >
        <TextInput
          leftSection={<IconSearch size={18} />}
          placeholder={t("search.placeholder")}
          value={query}
          onChange={(e) => handleSearch(e.currentTarget.value)}
          size="lg"
          radius="md"
          data-autofocus
          styles={{ input: { fontWeight: 500 } }}
        />
      </Box>

      <Box style={{ maxHeight: "60vh", overflowY: "auto" }}>
        {loading && (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <Loader size="md" />
              <Text size="sm" c="dimmed">
                Searching…
              </Text>
            </Stack>
          </Center>
        )}

        {!loading && query.length >= 2 && items.length === 0 && (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <IconPackage size={40} color="var(--mantine-color-gray-4)" />
              <Text c="dimmed" fw={500}>
                {t("search.noResults")}
              </Text>
              <Text size="xs" c="dimmed">
                Try a different keyword or SKU
              </Text>
            </Stack>
          </Center>
        )}

        {!loading && query.length < 2 && (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <IconSearch size={40} color="var(--mantine-color-gray-3)" />
              <Text c="dimmed" size="sm">
                Type at least 2 characters to search
              </Text>
            </Stack>
          </Center>
        )}

        {!loading && items.length > 0 && (
          <Box
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 12,
              padding: 16,
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
                <UnstyledButton
                  key={variant.id}
                  onClick={() => {
                    onPick(product, variant);
                    handleClose();
                  }}
                  style={{ width: "100%" }}
                >
                  <ProductCard
                    thumbnail={product.thumbnail}
                    title={product.title}
                    variantLabel={variantLabel}
                    price={format(price)}
                    productUrl={productUrl}
                  />
                </UnstyledButton>
              );
            })}
          </Box>
        )}
      </Box>
    </Modal>
  );
}

// ── Reusable product card (also used in CategoryPanel) ────────────────────────
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
      {/* External link badge — appears on hover, top-right */}
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

      {/* Image */}
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
            <IconPhoto size={36} color="var(--mantine-color-gray-4)" />
          </Center>
        )}
      </Box>

      {/* Info */}
      <Box p="xs">
        <Text fw={600} size="sm" lineClamp={2} lh={1.3} mb={4}>
          {title}
        </Text>
        {variantLabel && (
          <Badge variant="light" size="xs" color="gray" mb={6}>
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
