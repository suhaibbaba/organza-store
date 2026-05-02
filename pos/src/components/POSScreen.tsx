import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  AppShell,
  Group,
  Title,
  ActionIcon,
  Select,
  Button,
  TextInput,
  Stack,
  Text,
  Center,
  Menu,
  Drawer,
  Box,
  Tooltip,
  Badge,
} from "@mantine/core";
import {
  IconSettings,
  IconLanguage,
  IconLogout,
  IconCamera,
  IconSearch,
  IconBarcode,
  IconShoppingCartOff,
  IconLayoutGrid,
  IconCategory,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { notifications } from "@mantine/notifications";
import { useMediaQuery, useDisclosure } from "@mantine/hooks";
import * as api from "@/api/client";
import type { Product, Variant, CartLine } from "@/types";
import { loadSettings, saveSettings } from "@/lib/storage";
import { CartLineRow } from "./CartLineRow";
import { SummaryPanel } from "./SummaryPanel";
import { SearchModal } from "./SearchModal";
import { BarcodeScannerModal } from "./BarcodeScannerModal";
import { SettingsModal } from "./SettingsModal";
import { CategoryPanel } from "./CategoryPanel";
import { OrganzaLogo } from "./OrganzaLogo";

interface Props {
  onLogout: () => void;
  onLanguageToggle: () => void;
}

export function POSScreen({ onLogout, onLanguageToggle }: Props) {
  const { t } = useTranslation();
  const isMobile = useMediaQuery("(max-width: 900px)");

  const [cart, setCart] = useState<CartLine[]>([]);
  const [scanInput, setScanInput] = useState("");
  const [cartDiscountValue, setCartDiscountValue] = useState(0);
  const [cartDiscountType, setCartDiscountType] = useState<"fixed" | "percent">(
    "fixed",
  );
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [processing, setProcessing] = useState(false);

  const [regions, setRegions] = useState<
    Awaited<ReturnType<typeof api.getRegions>>
  >([]);
  const [salesChannels, setSalesChannels] = useState<
    Awaited<ReturnType<typeof api.getSalesChannels>>
  >([]);
  const [regionId, setRegionId] = useState(loadSettings().regionId || "");
  const [salesChannelId, setSalesChannelId] = useState(
    loadSettings().salesChannelId || "",
  );

  const [searchOpen, { open: openSearch, close: closeSearch }] =
    useDisclosure(false);
  const [scannerOpen, { open: openScanner, close: closeScanner }] =
    useDisclosure(false);
  const [settingsOpen, { open: openSettings, close: closeSettings }] =
    useDisclosure(false);
  const [summaryOpen, { open: openSummary, close: closeSummary }] =
    useDisclosure(false);
  const [categoryOpen, { open: openCategory, close: closeCategory }] =
    useDisclosure(false);

  const scanRef = useRef<HTMLInputElement>(null);

  const currentRegion = useMemo(
    () => regions.find((r) => r.id === regionId),
    [regions, regionId],
  );
  const currencyCode = currentRegion?.currency_code;

  const loadBootstrap = useCallback(async () => {
    try {
      const [regs, chans] = await Promise.all([
        api.getRegions(),
        api.getSalesChannels(),
      ]);
      setRegions(regs);
      setSalesChannels(chans);

      const s = loadSettings();
      const useRegion =
        regs.find((r) => r.id === s.regionId)?.id || regs[0]?.id || "";
      const useChannel =
        chans.find((c) => c.id === s.salesChannelId)?.id || chans[0]?.id || "";

      setRegionId(useRegion);
      setSalesChannelId(useChannel);
      saveSettings({ ...s, regionId: useRegion, salesChannelId: useChannel });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "unauthorized") {
        notifications.show({
          message: t("toast.sessionExpired"),
          color: "red",
        });
        onLogout();
      } else {
        notifications.show({ message: msg, color: "red" });
      }
    }
  }, [onLogout, t]);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    if (isMobile) return;
    const timer = setInterval(() => {
      const active = document.activeElement;
      if (
        !searchOpen &&
        !scannerOpen &&
        !settingsOpen &&
        !categoryOpen &&
        active?.tagName !== "INPUT" &&
        active?.tagName !== "TEXTAREA" &&
        active?.tagName !== "BUTTON"
      ) {
        scanRef.current?.focus();
      }
    }, 800);
    return () => clearInterval(timer);
  }, [isMobile, searchOpen, scannerOpen, settingsOpen, categoryOpen]);

  const handleRegionChange = (newId: string | null) => {
    if (!newId) return;
    setRegionId(newId);
    saveSettings({ ...loadSettings(), regionId: newId });
  };

  const handleScanChannelChange = (newId: string | null) => {
    if (!newId) return;
    setSalesChannelId(newId);
    saveSettings({ ...loadSettings(), salesChannelId: newId });
  };

  const addToCart = useCallback(
    (product: Product, variant: Variant) => {
      const price = api.getVariantPrice(variant);
      setCart((prev) => {
        const existing = prev.find((l) => l.variant.id === variant.id);
        if (existing) {
          return prev.map((l) =>
            l.variant.id === variant.id
              ? { ...l, quantity: l.quantity + 1 }
              : l,
          );
        }
        return [
          ...prev,
          {
            product,
            variant,
            unitPrice: price,
            quantity: 1,
            lineDiscount: 0,
            lineDiscountType: "fixed",
          },
        ];
      });
      notifications.show({
        message: t("toast.added", { name: product.title }),
        color: "green",
        autoClose: 1500,
      });
    },
    [t],
  );

  const lookupAndAdd = useCallback(
    async (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;

      if (!loadSettings().publishableKey) {
        notifications.show({
          message: t("toast.missingKey"),
          color: "red",
          autoClose: 4000,
        });
        return;
      }

      try {
        const found = await api.findByCode(trimmed);
        if (!found) {
          notifications.show({
            message: t("toast.notFound", { code: trimmed }),
            color: "red",
          });
          return;
        }
        addToCart(found.product, found.variant);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        notifications.show({ message: msg, color: "red" });
      }
    },
    [addToCart, t],
  );

  const handleScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const code = scanInput;
    setScanInput("");
    lookupAndAdd(code);
  };

  const handleCameraScan = async (code: string) => {
    closeScanner();
    await lookupAndAdd(code);
  };

  const updateQty = (variantId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) =>
          l.variant.id === variantId
            ? { ...l, quantity: Math.max(0, l.quantity + delta) }
            : l,
        )
        .filter((l) => l.quantity > 0),
    );
  };

  const removeItem = (variantId: string) => {
    setCart((prev) => prev.filter((l) => l.variant.id !== variantId));
  };

  const setLineDiscount = (
    variantId: string,
    value: number,
    type: "fixed" | "percent",
  ) => {
    setCart((prev) =>
      prev.map((l) =>
        l.variant.id === variantId
          ? { ...l, lineDiscount: value, lineDiscountType: type }
          : l,
      ),
    );
  };

  const calcLineTotal = (item: CartLine): number => {
    const gross = item.unitPrice * item.quantity;
    const disc =
      item.lineDiscountType === "percent"
        ? gross * (item.lineDiscount / 100)
        : item.lineDiscount * item.quantity;
    return Math.max(0, gross - disc);
  };

  const subtotal = cart.reduce((s, l) => s + calcLineTotal(l), 0);
  const cartDiscountAmount =
    cartDiscountType === "percent"
      ? subtotal * (cartDiscountValue / 100)
      : Math.min(cartDiscountValue, subtotal);
  const total = Math.max(0, subtotal - cartDiscountAmount);

  const completeSale = async () => {
    if (cart.length === 0) {
      notifications.show({ message: t("toast.emptyCart"), color: "red" });
      return;
    }
    if (!regionId) {
      notifications.show({ message: t("toast.noRegion"), color: "red" });
      return;
    }

    setProcessing(true);
    try {
      const items = cart.map((l) => {
        const gross = l.unitPrice * l.quantity;
        const lineDisc =
          l.lineDiscountType === "percent"
            ? gross * (l.lineDiscount / 100)
            : l.lineDiscount * l.quantity;
        const netPerUnit = Math.max(0, (gross - lineDisc) / l.quantity);
        return {
          variant_id: l.variant.id,
          quantity: l.quantity,
          unit_price: Math.round(netPerUnit * 100),
        };
      });

      const order = await api.createOrder({
        items,
        regionId,
        salesChannelId: salesChannelId || null,
        paymentMethod,
        cartDiscount: cartDiscountAmount,
      });

      notifications.show({
        message: t("toast.saleComplete", { id: order.display_id ?? order.id }),
        color: "green",
        autoClose: 4000,
      });
      setCart([]);
      setCartDiscountValue(0);
      if (isMobile) closeSummary();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      notifications.show({
        message: t("toast.saleFailed", { msg }),
        color: "red",
        autoClose: 5000,
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <AppShell
      header={{ height: 64 }}
      padding={0}
      styles={{
        header: {
          background: "#235C63",
          borderBottom: "none",
          boxShadow: "0 2px 16px rgba(0,0,0,0.25)",
        },
      }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          {/* Brand */}
          <Group gap="xs" wrap="nowrap">
            <OrganzaLogo size={60} style={{ flexShrink: 0 }} />
          </Group>

          {/* Center: Region + Channel selects */}
          <Group
            gap="xs"
            wrap="nowrap"
            style={{ flex: 1, justifyContent: "center", maxWidth: 480 }}
          >
            <Select
              value={regionId}
              onChange={handleRegionChange}
              data={regions.map((r) => ({
                value: r.id,
                label: `${r.name} (${r.currency_code.toUpperCase()})`,
              }))}
              size="xs"
              w={isMobile ? 120 : 180}
              placeholder={t("pos.region")}
              allowDeselect={false}
              styles={{
                input: {
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "white",
                },
              }}
            />
            {!isMobile && salesChannels.length > 1 && (
              <Select
                value={salesChannelId}
                onChange={handleScanChannelChange}
                data={salesChannels.map((c) => ({
                  value: c.id,
                  label: c.name,
                }))}
                size="xs"
                w={180}
                allowDeselect={false}
                styles={{
                  input: {
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    color: "white",
                  },
                }}
              />
            )}
          </Group>

          {/* Right: actions */}
          <Group gap="xs" wrap="nowrap">
            <Menu shadow="xl" position="bottom-end" radius="md">
              <Menu.Target>
                <ActionIcon
                  variant="subtle"
                  size="lg"
                  c="white"
                  style={{ opacity: 0.9 }}
                >
                  <IconSettings size={20} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown style={{ minWidth: 180 }}>
                <Menu.Label>Options</Menu.Label>
                <Menu.Item
                  leftSection={<IconLanguage size={14} />}
                  onClick={onLanguageToggle}
                >
                  {t("app.language")}
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconSettings size={14} />}
                  onClick={openSettings}
                >
                  {t("app.settings")}
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconLogout size={14} />}
                  color="red"
                  onClick={onLogout}
                >
                  {t("app.logout")}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Box
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 360px",
            height: "calc(100dvh - 64px)",
            overflow: "hidden",
            background: "var(--mantine-color-gray-0)",
          }}
        >
          {/* LEFT: Scan + Cart */}
          <Box
            style={{
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Scanner bar */}
            <Box
              p="md"
              style={{
                borderBottom: "1px solid var(--mantine-color-gray-2)",
                background: "var(--mantine-color-white)",
              }}
            >
              <Group gap="xs" wrap="nowrap">
                <TextInput
                  ref={scanRef}
                  value={scanInput}
                  onChange={(e) => setScanInput(e.currentTarget.value)}
                  onKeyDown={handleScan}
                  placeholder={t("pos.scanPlaceholder")}
                  size="md"
                  style={{ flex: 1 }}
                  autoFocus
                  radius="md"
                  leftSection={<IconBarcode size={18} />}
                />
                <Tooltip label={t("pos.scanWithCamera")}>
                  <ActionIcon
                    size="xl"
                    variant="filled"
                    color="blue"
                    radius="md"
                    onClick={openScanner}
                  >
                    <IconCamera size={20} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label={t("pos.manualSearch")}>
                  <ActionIcon
                    size="xl"
                    variant="light"
                    color="blue"
                    radius="md"
                    onClick={openSearch}
                  >
                    <IconSearch size={20} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label={t("pos.browseCategories")}>
                  <ActionIcon
                    size="xl"
                    variant="light"
                    color="violet"
                    radius="md"
                    onClick={openCategory}
                  >
                    <IconCategory size={20} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Box>

            {/* Cart header */}
            {cart.length > 0 && (
              <Box
                px="md"
                pt="sm"
                pb={4}
                style={{
                  background: "var(--mantine-color-white)",
                  borderBottom: "1px solid var(--mantine-color-gray-2)",
                }}
              >
                <Group gap="xs">
                  <Text
                    size="xs"
                    c="dimmed"
                    fw={600}
                    tt="uppercase"
                    style={{ letterSpacing: "0.05em" }}
                  >
                    Cart
                  </Text>
                  <Badge size="xs" variant="filled" color="blue" circle>
                    {cart.length}
                  </Badge>
                </Group>
              </Box>
            )}

            {/* Cart items */}
            <Box style={{ flex: 1, overflow: "auto", padding: 12 }}>
              {cart.length === 0 ? (
                <Center h="100%">
                  <Stack align="center" gap="sm">
                    <Box
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: "50%",
                        background: "var(--mantine-color-gray-1)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <IconShoppingCartOff
                        size={36}
                        color="var(--mantine-color-gray-4)"
                      />
                    </Box>
                    <Text size="lg" fw={600} c="dimmed">
                      {t("pos.emptyCart")}
                    </Text>
                    <Text size="sm" c="dimmed" ta="center" maw={240}>
                      {t("pos.emptyCartHint")}
                    </Text>
                    <Group gap="xs" mt="xs">
                      <Button
                        variant="light"
                        leftSection={<IconSearch size={16} />}
                        onClick={openSearch}
                      >
                        {t("pos.manualSearch")}
                      </Button>
                      <Button
                        variant="light"
                        color="violet"
                        leftSection={<IconCategory size={16} />}
                        onClick={openCategory}
                      >
                        {t("pos.browseCategories")}
                      </Button>
                    </Group>
                  </Stack>
                </Center>
              ) : (
                <Stack gap={8}>
                  {cart.map((item) => (
                    <CartLineRow
                      key={item.variant.id}
                      item={item}
                      currencyCode={currencyCode}
                      onQty={updateQty}
                      onRemove={removeItem}
                      onDiscount={setLineDiscount}
                      lineTotal={calcLineTotal(item)}
                    />
                  ))}
                </Stack>
              )}
            </Box>

            {/* Mobile: checkout button */}
            {isMobile && cart.length > 0 && (
              <Box
                p="md"
                style={{
                  borderTop: "1px solid var(--mantine-color-gray-2)",
                  background: "var(--mantine-color-white)",
                }}
              >
                <Button
                  size="lg"
                  fullWidth
                  radius="md"
                  onClick={openSummary}
                  style={{ fontWeight: 700 }}
                >
                  {t("summary.complete")} · {total.toFixed(2)}
                </Button>
              </Box>
            )}
          </Box>

          {/* RIGHT: Summary panel (desktop) */}
          {!isMobile && (
            <Box
              style={{
                borderLeft: "1px solid var(--mantine-color-gray-2)",
                background: "var(--mantine-color-white)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <SummaryPanel
                currencyCode={currencyCode}
                subtotal={subtotal}
                cartDiscountValue={cartDiscountValue}
                cartDiscountType={cartDiscountType}
                cartDiscountAmount={cartDiscountAmount}
                total={total}
                paymentMethod={paymentMethod}
                canCheckout={cart.length > 0}
                processing={processing}
                cartLength={cart.length}
                onCartDiscountChange={(v, ty) => {
                  setCartDiscountValue(v);
                  setCartDiscountType(ty);
                }}
                onPaymentChange={setPaymentMethod}
                onCheckout={completeSale}
                onClear={() => setCart([])}
              />
            </Box>
          )}
        </Box>

        {/* Mobile: summary drawer */}
        {isMobile && (
          <Drawer
            opened={summaryOpen}
            onClose={closeSummary}
            position="bottom"
            size="90%"
            title={t("summary.title")}
            radius="xl"
          >
            <SummaryPanel
              currencyCode={currencyCode}
              subtotal={subtotal}
              cartDiscountValue={cartDiscountValue}
              cartDiscountType={cartDiscountType}
              cartDiscountAmount={cartDiscountAmount}
              total={total}
              paymentMethod={paymentMethod}
              canCheckout={cart.length > 0}
              processing={processing}
              cartLength={cart.length}
              onCartDiscountChange={(v, ty) => {
                setCartDiscountValue(v);
                setCartDiscountType(ty);
              }}
              onPaymentChange={setPaymentMethod}
              onCheckout={completeSale}
              onClear={() => setCart([])}
            />
          </Drawer>
        )}
      </AppShell.Main>

      <SearchModal
        opened={searchOpen}
        onClose={closeSearch}
        onPick={addToCart}
        currencyCode={currencyCode}
      />
      <BarcodeScannerModal
        opened={scannerOpen}
        onClose={closeScanner}
        onScan={handleCameraScan}
      />
      <SettingsModal
        opened={settingsOpen}
        onClose={closeSettings}
        onSaved={loadBootstrap}
      />
      <CategoryPanel
        opened={categoryOpen}
        onClose={closeCategory}
        onPick={(product, variant) => {
          addToCart(product, variant);
          closeCategory();
        }}
        currencyCode={currencyCode}
      />
    </AppShell>
  );
}
