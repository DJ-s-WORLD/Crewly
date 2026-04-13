import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatTaskCompletionDate } from "./formatTaskCompletionDate";

describe("formatTaskCompletionDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Completed today" for same local calendar day', () => {
    vi.setSystemTime(new Date(2026, 3, 10, 22, 0, 0));
    expect(formatTaskCompletionDate(new Date(2026, 3, 10, 8, 0, 0).toISOString())).toBe("Completed today");
  });

  it('returns "Completed yesterday" for previous local day', () => {
    vi.setSystemTime(new Date(2026, 3, 10, 12, 0, 0));
    expect(formatTaskCompletionDate(new Date(2026, 3, 9, 12, 0, 0).toISOString())).toBe("Completed yesterday");
  });

  it("returns en-GB numeric date for older completions", () => {
    vi.setSystemTime(new Date(2026, 3, 10, 12, 0, 0));
    expect(formatTaskCompletionDate(new Date(2026, 3, 1, 12, 0, 0).toISOString())).toBe("01/04/2026");
  });
});
