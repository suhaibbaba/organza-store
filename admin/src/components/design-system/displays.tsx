"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  Drawer,
  EmptyState,
  EntityCard,
  InfoTip,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Modal,
  Money,
  ProgressBar,
  RowMenu,
  StatCard,
  StatRow,
  Summary,
  Table,
  TotalBadge,
  Widget,
  useToast,
  type Column,
} from "@store/ui";
import { Skeleton } from "@store/ui/components/skeleton";
import { useSettingsQuery } from "@/hooks/use-settings";
import { DESIGN_SYSTEM_SAMPLE_ROWS } from "@/constants/design-system";
import { ShowcaseRow, ShowcaseSection } from "@/components/design-system/showcase-section";
import type { DesignSystemSampleRow } from "@/types/design-system";

export function Displays() {
  const t = useTranslations("designSystem");
  const currency = useSettingsQuery().data?.currency;
  const toast = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [tableLoading, setTableLoading] = useState(false);

  const columns: readonly Column<DesignSystemSampleRow>[] = [
    { key: "name", header: "designSystem.table.product", primary: true, render: (row) => t(`table.${row.nameKey}`) },
    {
      key: "sku",
      header: "designSystem.table.sku",
      render: (row) => (
        <span dir="ltr" data-selectable="true">
          {row.sku}
        </span>
      ),
    },
    { key: "stock", header: "designSystem.table.stock", align: "numeric", render: (row) => row.stock },
    {
      key: "price",
      header: "designSystem.table.price",
      align: "numeric",
      render: (row) => <Money amount={row.price} currency={currency} cents />,
    },
    {
      key: "actions",
      header: "",
      actions: true,
      render: () => (
        <RowMenu label={t("overlays.menu")}>
          <MenuItem icon="edit">{t("overlays.edit")}</MenuItem>
          <MenuItem icon="copy">{t("overlays.duplicate")}</MenuItem>
          <MenuItem icon="trash" tone="danger">
            {t("overlays.delete")}
          </MenuItem>
        </RowMenu>
      ),
    },
  ];

  return (
    <>
      <ShowcaseSection id="cards" title={t("sections.cards")} hint={t("hints.cards")}>
        <StatRow cards={4}>
          <StatCard
            label={t("cards.sales")}
            icon="money"
            value={<Money amount="2450.00" currency={currency} />}
            delta={{ text: "12%", direction: "up", isGood: true }}
            caption={t("cards.vsYesterday")}
          />
          <StatCard label={t("cards.orders")} icon="receipt" tone="primary" value="18" />
          <StatCard
            label={t("cards.returns")}
            icon="reset"
            tone="danger"
            value="2"
            delta={{ text: "1", direction: "up", isGood: false }}
          />
          <StatCard label={t("cards.stockValue")} icon="package" tone="success" value="275" />
        </StatRow>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Card className="flex flex-col gap-1 p-4">
            <p className="text-section font-bold text-ink">{t("cards.cardTitle")}</p>
            <p className="text-value text-ink-muted">{t("cards.cardBody")}</p>
          </Card>
          <Card tone="selected" className="flex flex-col gap-1 p-4">
            <p className="text-section font-bold text-ink">{t("cards.selected")}</p>
            <p className="text-value text-ink-muted">{t("cards.cardBody")}</p>
          </Card>
          <Widget title={t("cards.widget")}>
            <p className="text-value text-ink-muted">{t("cards.widgetBody")}</p>
          </Widget>
          <EntityCard
            icon="package"
            title={t("cards.entityTitle")}
            subtitle={t("cards.entitySubtitle")}
            status={{ label: t("badges.inStock"), tone: "success" }}
            progress={{ value: 6, total: 10, label: t("cards.progress"), caption: t("cards.progressCaption") }}
            action={{ label: t("cards.open"), onClick: () => setDrawerOpen(true) }}
          />
          <Card className="flex flex-col gap-3 p-4">
            <Summary
              divided
              rows={[
                {
                  key: "item",
                  label: t("cards.itemLine"),
                  value: <Money amount="360.00" currency={currency} />,
                  emphasis: "item",
                },
                {
                  key: "subtotal",
                  label: t("cards.subtotal"),
                  value: <Money amount="360.00" currency={currency} />,
                  emphasis: "subtotal",
                },
                {
                  key: "discount",
                  label: t("cards.discount"),
                  value: <Money amount="36.00" currency={currency} />,
                  deduct: true,
                },
                {
                  key: "total",
                  label: t("cards.total"),
                  value: <Money amount="324.00" currency={currency} />,
                  emphasis: "total",
                },
              ]}
            />
          </Card>
          <Card className="flex flex-col gap-4 p-4">
            <ProgressBar value={6} total={10} label={t("cards.progress")} />
            <ProgressBar value={9} total={10} label={t("badges.lowStock")} tone="warning" />
            <div className="flex items-center gap-3">
              <Avatar name={t("type.sample")} tintKey="a" />
              <Avatar name={t("table.rowB")} tintKey="b" />
              <Avatar name={t("table.rowC")} tintKey="c" />
              <TotalBadge total={275} />
            </div>
          </Card>
        </div>
      </ShowcaseSection>

      <ShowcaseSection id="feedback" title={t("sections.feedback")} hint={t("hints.feedback")}>
        <ShowcaseRow>
          <Button variant="secondary" onClick={() => toast.success("designSystem.feedback.toastSuccess")}>
            {t("feedback.showSuccess")}
          </Button>
          <Button variant="secondary" onClick={() => toast.warning("designSystem.feedback.toastWarning")}>
            {t("feedback.showWarning")}
          </Button>
          <Button variant="secondary" onClick={() => toast.error("designSystem.feedback.toastError")}>
            {t("feedback.showError")}
          </Button>
          <InfoTip label={t("feedback.info")}>{t("feedback.infoBody")}</InfoTip>
        </ShowcaseRow>
        <EmptyState
          icon="receipt"
          title="designSystem.feedback.emptyTitle"
          hint="designSystem.feedback.emptyHint"
          action={<Button variant="primary">{t("buttons.withIcon")}</Button>}
        />
        <ShowcaseRow label={t("feedback.loading")}>
          <div className="flex w-full flex-col gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-10 w-full" />
          </div>
        </ShowcaseRow>
      </ShowcaseSection>

      <ShowcaseSection id="overlays" title={t("sections.overlays")} hint={t("hints.overlays")}>
        <ShowcaseRow>
          <Button variant="secondary" onClick={() => setModalOpen(true)}>
            {t("overlays.openModal")}
          </Button>
          <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
            {t("overlays.openDrawer")}
          </Button>
          <Button variant="secondary" onClick={() => setNavDrawerOpen(true)}>
            {t("overlays.openNavDrawer")}
          </Button>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            {t("overlays.openConfirm")}
          </Button>
          <Menu>
            <MenuTrigger asChild>
              <Button variant="secondary" icon={<span aria-hidden="true">⋯</span>}>
                {t("overlays.menu")}
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem icon="edit">{t("overlays.edit")}</MenuItem>
              <MenuItem icon="copy">{t("overlays.duplicate")}</MenuItem>
              <MenuItem icon="trash" tone="danger">
                {t("overlays.delete")}
              </MenuItem>
            </MenuContent>
          </Menu>
        </ShowcaseRow>
      </ShowcaseSection>

      <ShowcaseSection id="table" title={t("sections.table")} hint={t("hints.table")}>
        <ShowcaseRow>
          <Button variant="quiet" size="sm" onClick={() => setTableLoading((value) => !value)}>
            {t("feedback.loading")}
          </Button>
        </ShowcaseRow>
        <Table
          columns={columns}
          rows={DESIGN_SYSTEM_SAMPLE_ROWS}
          rowKey={(row) => row.id}
          isLoading={tableLoading}
          empty={<EmptyState title="designSystem.table.empty" />}
          pagination={{ page, totalPages: 5, onPageChange: setPage }}
        />
      </ShowcaseSection>

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title="designSystem.overlays.modalTitle"
        description="designSystem.overlays.modalDescription"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              {t("overlays.close")}
            </Button>
            <Button variant="primary" onClick={() => setModalOpen(false)}>
              {t("buttons.secondary")}
            </Button>
          </>
        }
      >
        <p className="text-value text-ink-muted">{t("overlays.modalDescription")}</p>
      </Modal>

      <Drawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={t("overlays.drawerTitle")}
        descriptionKey="designSystem.overlays.drawerDescription"
      >
        <p className="text-value text-ink-muted">{t("overlays.drawerDescription")}</p>
      </Drawer>
      <Drawer
        side="start"
        size="sm"
        open={navDrawerOpen}
        onOpenChange={setNavDrawerOpen}
        title={t("overlays.openNavDrawer")}
        descriptionKey="designSystem.overlays.navDrawerDescription"
      >
        <p className="text-value text-ink-muted">{t("overlays.navDrawerDescription")}</p>
      </Drawer>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="designSystem.overlays.confirmTitle"
        consequences={[t("overlays.confirmConsequence")]}
        tone="danger"
        onConfirm={async () => {
          setConfirmOpen(false);
        }}
      />
    </>
  );
}
