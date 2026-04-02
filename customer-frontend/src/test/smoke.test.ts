import { describe, expect, it } from "vitest";

import { customerScreenCatalog } from "@/lib/contracts/customer-screen-catalog";

describe("customer screen catalog", () => {
  it("contains the planned 50 logical screens", () => {
    expect(customerScreenCatalog).toHaveLength(50);
  });

  it("maps every screen to at least one Stitch reference", () => {
    expect(customerScreenCatalog.every((screen) => screen.stitchRefs.length > 0)).toBe(true);
  });

  it("keeps routes unique", () => {
    const uniqueRoutes = new Set(customerScreenCatalog.map((screen) => screen.route));
    expect(uniqueRoutes.size).toBe(customerScreenCatalog.length);
  });
});
