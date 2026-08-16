import { describe, expect, it } from "vitest";
import { normalizeMarketplaceFilters } from "./db";

describe("marketplace filters", () => {
  it("trims and caps the free-text search while preserving structured filters", () => {
    const result = normalizeMarketplaceFilters({
      search: `  Messi ${"x".repeat(100)}  `,
      championshipId: 7,
      type: "duplicate",
      condition: "good",
      sort: "playerName",
    });

    expect(result).toEqual({
      search: `Messi ${"x".repeat(100)}`.slice(0, 80),
      championshipId: 7,
      type: "duplicate",
      condition: "good",
      sort: "playerName",
    });
  });

  it("uses newest as the default order and removes blank searches", () => {
    expect(normalizeMarketplaceFilters({ search: "   " })).toEqual({
      search: undefined,
      championshipId: undefined,
      type: undefined,
      condition: undefined,
      sort: "newest",
    });
  });
});
