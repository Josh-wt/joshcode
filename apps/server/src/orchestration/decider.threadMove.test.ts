import {
  CommandId,
  DEFAULT_PROVIDER_INTERACTION_MODE,
  EventId,
  ProjectId,
  ThreadId,
} from "@t3tools/contracts";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { decideOrchestrationCommand } from "./decider.ts";
import { createEmptyReadModel, projectEvent } from "./projector.ts";

const PROJECT_A = ProjectId.makeUnsafe("project-a");
const PROJECT_B = ProjectId.makeUnsafe("project-b");
const THREAD_ID = ThreadId.makeUnsafe("thread-1");

const asEventId = (value: string) => EventId.makeUnsafe(value);

async function createThreadMoveReadModel(now: string) {
  const withProjectA = await Effect.runPromise(
    projectEvent(createEmptyReadModel(now), {
      sequence: 1,
      eventId: asEventId("evt-project-a-create"),
      aggregateKind: "project",
      aggregateId: PROJECT_A,
      type: "project.created",
      occurredAt: now,
      commandId: CommandId.makeUnsafe("cmd-project-a-create"),
      causationEventId: null,
      correlationId: CommandId.makeUnsafe("cmd-project-a-create"),
      metadata: {},
      payload: {
        projectId: PROJECT_A,
        title: "A",
        workspaceRoot: "/tmp/a",
        defaultModelSelection: null,
        scripts: [],
        createdAt: now,
        updatedAt: now,
      },
    }),
  );

  const withProjectB = await Effect.runPromise(
    projectEvent(withProjectA, {
      sequence: 2,
      eventId: asEventId("evt-project-b-create"),
      aggregateKind: "project",
      aggregateId: PROJECT_B,
      type: "project.created",
      occurredAt: now,
      commandId: CommandId.makeUnsafe("cmd-project-b-create"),
      causationEventId: null,
      correlationId: CommandId.makeUnsafe("cmd-project-b-create"),
      metadata: {},
      payload: {
        projectId: PROJECT_B,
        title: "B",
        workspaceRoot: "/tmp/b",
        defaultModelSelection: null,
        scripts: [],
        createdAt: now,
        updatedAt: now,
      },
    }),
  );

  return Effect.runPromise(
    projectEvent(withProjectB, {
      sequence: 3,
      eventId: asEventId("evt-thread-create"),
      aggregateKind: "thread",
      aggregateId: THREAD_ID,
      type: "thread.created",
      occurredAt: now,
      commandId: CommandId.makeUnsafe("cmd-thread-create"),
      causationEventId: null,
      correlationId: CommandId.makeUnsafe("cmd-thread-create"),
      metadata: {},
      payload: {
        threadId: THREAD_ID,
        projectId: PROJECT_A,
        title: "Move me",
        modelSelection: {
          provider: "codex",
          model: "gpt-5.4",
        },
        interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
        runtimeMode: "full-access",
        envMode: "worktree",
        branch: "feature/move",
        worktreePath: "/tmp/worktree",
        associatedWorktreePath: "/tmp/worktree",
        associatedWorktreeBranch: "feature/move",
        associatedWorktreeRef: "feature/move",
        parentThreadId: null,
        subagentAgentId: null,
        subagentNickname: null,
        subagentRole: null,
        forkSourceThreadId: null,
        sidechatSourceThreadId: null,
        handoff: null,
        createdAt: now,
        updatedAt: now,
      },
    }),
  );
}

describe("decideOrchestrationCommand thread project moves", () => {
  it("emits project and workspace reset when moving a thread to another project", async () => {
    const now = "2026-01-01T00:00:00.000Z";
    const readModel = await createThreadMoveReadModel(now);

    const event = await Effect.runPromise(
      decideOrchestrationCommand({
        readModel,
        command: {
          type: "thread.meta.update",
          commandId: CommandId.makeUnsafe("cmd-1"),
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
