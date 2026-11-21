// GET /api/dashboard/summary — catalogue figures and the to-do counts; sales come from /api/reports.
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
  // `basis: "cost"` only with product.viewCost (rule 19); everyone else gets a retail valuation.
  inventoryValue: {
    amount: string;
    basis: "cost" | "price";
  };
  // The labels page's "not printed yet" queue, counted with the same clause.
  unprintedLabels: number;
  // Quick-sold pieces still waiting for their details (rule 23).
  incompleteProducts: number;
}
