import { describe, expect, it } from "vitest";
import { navCompanyName } from "@/lib/navision/client";

describe("navCompanyName", () => {
  it("rejects unsupported company names", () => {
    const previous = process.env.NAV_SQLSERVER_COMPANY;
    process.env.NAV_SQLSERVER_COMPANY = "ITES_EU;DROP";
    expect(() => navCompanyName()).toThrow(/caracteres/);
    process.env.NAV_SQLSERVER_COMPANY = previous;
  });
});
