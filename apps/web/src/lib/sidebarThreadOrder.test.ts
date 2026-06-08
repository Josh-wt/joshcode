import { ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vitest";

import {
  insertThreadIdIntoProjectOrder,
  reorderThreadIdsInProject,
  sortThreadIdsWithManualOrder,
} from "./sidebarThreadOrder";

const THREAD_A = ThreadId.makeUnsafe("thread-a");
const THREAD_B = ThreadId.makeUnsafe("thread-b");
const THREAD_C = ThreadId.makeUnsafe("thread-c");

describe("sidebarThreadOrder", () => {
  it("reorders threads within a project", () => {
    expect(
      reorderThreadIdsInProject({
        orderedThreadIds: [THREAD_A, THREAD_B, THREAD_C],
        draggedThreadId: THREAD_C,
        targetThreadId: THREAD_A,
      }),
    ).toEqual([THREAD_C, THREAD_A, THREAD_B]);
  });

  it("inserts moved threads before a target row", () => {
    expect(
      insertThreadIdIntoProjectOrder({
        orderedThreadIds: [THREAD_B, THREAD_C],
        threadId: THREAD_A,
        targetThreadId: THREAD_C,
        position: "before",
      }),
    ).toEqual([THREAD_B, THREAD_A, THREAD_C]);
  });

  it("sorts visible threads using the persisted manual order", () => {
    const threads = [
      { id: THREAD_A, title: "A" },
      { id: THREAD_B, title: "B" },
      { id: THREAD_C, title: "C" },
    ];

    expect(sortThreadIdsWithManualOrder(threads, [THREAD_C, THREAD_A])).toEqual([
      { id: THREAD_C, title: "C" },
      { id: THREAD_A, title: "A" },
      { id: THREAD_B, title: "B" },
    ]);
  });
});
