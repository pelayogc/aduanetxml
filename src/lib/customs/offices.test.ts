import { describe, expect, it } from "vitest";
import { findDefaultCustomsOffice } from "@/lib/customs/offices";

describe("customs office defaults", () => {
  it("maps generic Barcelona customs text to Barcelona maritime export office", () => {
    expect(findDefaultCustomsOffice("Barcelona")?.aeatCode).toBe("ES000812");
    expect(findDefaultCustomsOffice("BARCELONA MARITIMA EXP")?.aeatCode).toBe("ES000812");
  });
});
