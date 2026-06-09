/**
 * Repairs fork DBs whose migration tracker recorded ID 40 as
 * ProjectionThreadWorkspaceContexts before upstream pinned-message columns
 * landed at the same ID. Queries in v0.1.4 require pinned_messages_json/notes.
 */
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { columnExists } from "./schemaHelpers.ts";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  if (!(yield* columnExists(sql, "projection_threads", "pinned_messages_json"))) {
    yield* sql`
      ALTER TABLE projection_threads
      ADD COLUMN pinned_messages_json TEXT
    `;
  }

  if (!(yield* columnExists(sql, "projection_threads", "notes"))) {
    yield* sql`
      ALTER TABLE projection_threads
      ADD COLUMN notes TEXT
    `;
  }
});
