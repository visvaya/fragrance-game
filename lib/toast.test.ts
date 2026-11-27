import { describe, expect, it, vi } from "vitest";

const sonner = vi.hoisted(() => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock("sonner", () => sonner);

import { toast } from "./toast";

describe("toast", () => {
  it("passes each kind of message to sonner once it has loaded", async () => {
    toast.error("Failed", { description: "details" });
    toast.info("Info");
    toast.success("Done");
    toast.warning("Careful");

    await vi.waitFor(() => {
      expect(sonner.toast.warning).toHaveBeenCalledWith("Careful", undefined);
    });
    expect(sonner.toast.error).toHaveBeenCalledWith("Failed", {
      description: "details",
    });
    expect(sonner.toast.info).toHaveBeenCalledWith("Info", undefined);
    expect(sonner.toast.success).toHaveBeenCalledWith("Done", undefined);
  });
});
