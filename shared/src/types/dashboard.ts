// GET /api/dashboard/summary — Phase 1 dashboard (spec.md: "Dashboard" section).
// Sales/profit are Phase 2 (orders don't exist yet) — deliberately not modeled here.
export interface DashboardSummary {
  products: {
    active: number;
    hidden: number;
    total: number;
  };
  categories: {
    total: number;
  };
  lowStock: {
    count: number;
    threshold: number;
  };
  // `basis: "cost"` only for roles with product.viewCost (CLAUDE.md rule 19);
  // everyone else gets a retail valuation off basePrice/priceOverride.
  inventoryValue: {
    amount: string;
    basis: "cost" | "price";
  };
}
