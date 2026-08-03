import { RoleGuard } from "@/components/auth/role-guard";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export default function SettingsPage() {
  return (
    <RoleGuard action="settings.manage">
      <PlaceholderPage namespace="settings" />
    </RoleGuard>
  );
}
