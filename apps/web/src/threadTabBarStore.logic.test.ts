import { ProjectId } from "@t3tools/contracts";
import { describe, expect, it } from "vitest";

import {
  createDefaultThreadTabBarState,
  expandProjectGroup,
  isProjectGroupCollapsed,
  toggleProjectGroupCollapsed,
} from "~/threadTabBarStore.logic";

describe("threadTabBarStore.logic", () => {
  const projectId = ProjectId.makeUnsafe("project-1");

  it("toggles collapsed project groups", () => {
    const initial = createDefaultThreadTabBarState();
    expect(isProjectGroupCollapsed(initial.collapsedProjectIds, projectId)).toBe(false);

    const collapsed = toggleProjectGroupCollapsed(initial, projectId);
    expect(isProjectGroupCollapsed(collapsed.collapsedProjectIds, projectId)).toBe(true);

    const expanded = toggleProjectGroupCollapsed(collapsed, projectId);
    expect(isProjectGroupCollapsed(expanded.collapsedProjectIds, projectId)).toBe(false);
  });

  it("expands a collapsed project group idempotently", () => {
    const collapsed = toggleProjectGroupCollapsed(createDefaultThreadTabBarState(), projectId);
    const expandedOnce = expandProjectGroup(collapsed, projectId);
    const expandedTwice = expandProjectGroup(expandedOnce, projectId);
    expect(expandedTwice).toBe(expandedOnce);
    expect(isProjectGroupCollapsed(expandedTwice.collapsedProjectIds, projectId)).toBe(false);
  });
});
