import { describe, expect, it } from "vitest";
import { getAppHealth } from "@/lib/health";

describe("getAppHealth", () => {
  it("returns the scaffold service health payload", () => {
    const payload = getAppHealth();

    expect(payload.status).toBe("ok");
    expect(payload.service).toBe("saatgut");
    expect(Date.parse(payload.timestamp)).not.toBeNaN();
  });
});
