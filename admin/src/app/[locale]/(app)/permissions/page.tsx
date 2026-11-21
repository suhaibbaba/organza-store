"use client";

import { useTranslations } from "next-intl";
import { RoleGuard } from "@/components/auth/role-guard";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { usePermissionMatrix } from "@/components/providers/permissions-provider";
import { PermissionsEditor } from "@/components/permissions/permissions-editor";
import { Alert } from "@store/ui";

export default function PermissionsPage() {
  return (
    <RoleGuard action="permission.manage">
      <PermissionsPageContent />
    </RoleGuard>
  );
}

function PermissionsPageContent() {
  const t = useTranslations("permissions");
  // Already loaded: AuthGuard holds the app until it is.
  const { matrix } = usePermissionMatrix();

  return (
    <PageContainer>
      <PageHeader name="permissions" title={t("title")} description={`${t("subtitle")} ${t("adminNote")}`} />
      {matrix ? (
        <PermissionsEditor matrix={matrix} />
      ) : (
        <Alert tone="danger" data-testid="permissions-unavailable">
          {t("unavailable")}
        </Alert>
      )}
    </PageContainer>
  );
}
