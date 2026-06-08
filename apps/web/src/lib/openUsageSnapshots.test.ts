import { describe, expect, it } from "vitest";

import {
  formatOpenUsageProgressSummary,
  formatOpenUsageResetLabel,
  normalizeOpenUsageProviderSnapshots,
  openUsageProgressRemainingPercent,
  openUsageSidebarProgressLines,
} from "./openUsageSnapshots";

describe("openUsageSnapshots", () => {
  it("normalizes provider snapshots from the CrossUsage collection endpoint", () => {
    expect(
      normalizeOpenUsageProviderSnapshots([
        {
          providerId: "codex",
          displayName: "Codex",
          plan: "Plus",
          fetchedAt: "2099-04-08T18:00:00.000Z",
          lines: [
            {
              type: "progress",
              label: "Session",
              used: 20,
              limit: 100,
              format: { kind: "percent" },
              resetsAt: "2099-04-08T21:18:00.000Z",
            },
            {
              type: "text",
              label: "Today",
              value: "$5.17 · 9.2M tokens",
            },
          ],
        },
        {
          providerId: "cursor",
          displayName: "Cursor",
          fetchedAt: "2099-04-08T18:01:00.000Z",
          lines: [
            {
              type: "progress",
              label: "Fast requests",
              used: 42,
              limit: 100,
              format: { kind: "percent" },
            },
          ],
        },
      ]),
    ).toEqual([
      {
        providerId: "codex",
        displayName: "Codex",
        plan: "Plus",
        fetchedAt: "2099-04-08T18:00:00.000Z",
        providerKind: "codex",
        lines: [
          {
            type: "progress",
            label: "Session",
            used: 20,
            limit: 100,
            format: { kind: "percent" },
            resetsAt: "2099-04-08T21:18:00.000Z",
          },
          {
            type: "text",
            label: "Today",
            value: "$5.17 · 9.2M tokens",
          },
        ],
      },
      {
        providerId: "cursor",
        displayName: "Cursor",
        fetchedAt: "2099-04-08T18:01:00.000Z",
        providerKind: "cursor",
        lines: [
          {
            type: "progress",
            label: "Fast requests",
            used: 42,
            limit: 100,
            format: { kind: "percent" },
          },
        ],
      },
    ]);
  });

  it("formats progress summaries and selects sidebar progress lines", () => {
    const [snapshot] = normalizeOpenUsageProviderSnapshots([
      {
        providerId: "claude",
        displayName: "Claude",
        fetchedAt: "2099-04-08T18:00:00.000Z",
        lines: [
          {
            type: "progress",
            label: "Session",
            used: 25,
            limit: 100,
            format: { kind: "percent" },
          },
          {
            type: "progress",
            label: "Weekly",
            used: 10,
            limit: 100,
            format: { kind: "percent" },
          },
        ],
      },
    ]);

    expect(snapshot).toBeDefined();
    if (!snapshot) return;

    const [primary] = openUsageSidebarProgressLines(snapshot);
    expect(primary).toBeDefined();
    if (!primary) return;

    expect(openUsageProgressRemainingPercent(primary)).toBe(75);
    expect(formatOpenUsageProgressSummary(primary)).toBe("75% left");
  });

  it("hides Total usage for Cursor in the sidebar", () => {
    const [snapshot] = normalizeOpenUsageProviderSnapshots([
      {
        providerId: "cursor",
        displayName: "Cursor",
        fetchedAt: "2099-04-08T18:00:00.000Z",
        lines: [
          {
            type: "progress",
            label: "Total usage",
            used: 80,
            limit: 100,
            format: { kind: "percent" },
          },
          {
            type: "progress",
            label: "Fast requests",
            used: 42,
            limit: 100,
            format: { kind: "percent" },
          },
        ],
      },
    ]);

    expect(snapshot).toBeDefined();
    if (!snapshot) return;

    expect(openUsageSidebarProgressLines(snapshot).map((line) => line.label)).toEqual([
      "Fast requests",
    ]);
  });

  it("formats relative and absolute reset labels", () => {
    const nowMs = Date.parse("2099-04-08T18:00:00.000Z");

    expect(formatOpenUsageResetLabel("2099-04-08T18:00:45.000Z", nowMs)).toBe("Resets in 45s");
    expect(formatOpenUsageResetLabel("2099-04-08T18:45:00.000Z", nowMs)).toBe("Resets in 45m");
    expect(formatOpenUsageResetLabel("2099-04-08T21:18:00.000Z", nowMs)).toBe("Resets in 3h 18m");
    expect(formatOpenUsageResetLabel("2099-04-14T18:00:00.000Z", nowMs)).toMatch(/^Resets /);
    expect(formatOpenUsageResetLabel("2099-04-08T17:00:00.000Z", nowMs)).toBe("Reset");
  });
});
