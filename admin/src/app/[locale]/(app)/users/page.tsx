import { RoleGuard } from "@/components/auth/role-guard";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export default function UsersPage() {
  return (
    <RoleGuard allow={["ADMIN"]}>
      <PlaceholderPage namespace="users" />
    </RoleGuard>
  );
}
