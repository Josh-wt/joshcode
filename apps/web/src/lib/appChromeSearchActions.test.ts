import { describe, expect, it } from "vitest";

import { buildAppChromeSearchActions } from "./appChromeSearchActions";

describe("buildAppChromeSearchActions", () => {
  it("includes automations and plugins action ids", () => {
    const actions = buildAppChromeSearchActions({ keybindings: [] });
    const actionIds = actions.map((action) => action.id);
    expect(actionIds).toContain("automations");
    expect(actionIds).toContain("plugins");
    expect(actionIds).toContain("archived-threads");
    expect(actionIds).toContain("worktrees");
    expect(actionIds).toContain("sort-projects");
    expect(actionIds).toContain("sort-threads");
  });
});
