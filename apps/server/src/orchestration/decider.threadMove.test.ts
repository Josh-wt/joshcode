import { ProjectId, ThreadId } from "@t3tools/contracts";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { decideOrchestrationCommand } from "./decider.ts";
import { createEmptyReadModel } from "./projector.ts";

const PROJECT_A = ProjectId.makeUnsafe("project-a");
const PROJECT_B = ProjectId.makeUnsafe("project-b");
const THREAD_ID = ThreadId.makeUnsafe("thread-1");

describe("decideOrchestrationCommand thread project moves", () => {
  it("emits project and workspace reset when moving a thread to another project", async () => {
    const readModel = {
      ...createEmptyReadModel("2026-01-01T00:00:00.000Z"),
      projects: [
        {
          id: PROJECT_A,
          title: "A",
          workspaceRoot: "/tmp/a",
          kind: "project" as const,
          defaultModel: null,
          defaultModelOptions: {},
          scripts: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          deletedAt: null,
        },
        {
          id: PROJECT_B,
          title: "B",
          workspaceRoot: "/tmp/b",
          kind: "project" as const,
          defaultModel: null,
          defaultModelOptions: {},
          scripts: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          deletedAt: null,
        },
      ],
      threads: [
        {
          id: THREAD_ID,
          projectId: PROJECT_A,
          title: "Move me",
          modelSelection: { provider: "codex", model: "gpt-5.4" },
          runtimeMode: "full-access",
          interactionMode: "default",
          envMode: "worktree",
          branch: "feature/move",
          worktreePath: "/tmp/worktree",
          workspaceContexts: [],
          activeWorkspaceContextId: null,
          associatedWorktreePath: null,
          associatedWorktreeBranch: null,
          associatedWorktreeRef: null,
          createBranchFlowCompleted: false,
          isPinned: false,
          parentThreadId: null,
          subagentAgentId: null,
          subagentNickname: null,
          subagentRole: null,
          forkSourceThreadId: null,
          sidechatSourceThreadId: null,
          lastKnownPr: null,
          handoff: null,
          pinnedMessages: null,
          notes: "",
          latestTurnId: null,
          latestUserMessageAt: null,
          pendingApprovalCount: 0,
          pendingUserInputCount: 0,
          hasActionableProposedPlan: false,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          archivedAt: null,
          deletedAt: null,
          session: null,
        },
      ],
    };

    const event = await Effect.runPromise(
      decideOrchestrationCommand({
        readModel,
        command: {
          type: "thread.meta.update",
          commandId: "cmd-1",
          threadId: THREAD_ID,
          projectId: PROJECT_B,
        },
      }),
    );

    expect(event).toMatchObject({
      type: "thread.meta-updated",
      payload: {
        threadId: THREAD_ID,
        projectId: PROJECT_B,
        envMode: "local",
        worktreePath: null,
        branch: null,
        workspaceContexts: [],
        activeWorkspaceContextId: null,
      },
    });
  });
});
