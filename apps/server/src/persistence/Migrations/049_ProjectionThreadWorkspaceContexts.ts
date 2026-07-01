import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { columnExists } from "./schemaHelpers.ts";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  if (!(yield* columnExists(sql, "projection_threads", "workspace_contexts_json"))) {
    yield* sql`
      ALTER TABLE projection_threads
      ADD COLUMN workspace_contexts_json TEXT
    `;
  }

  if (!(yield* columnExists(sql, "projection_threads", "active_workspace_context_id"))) {
    yield* sql`
      ALTER TABLE projection_threads
      ADD COLUMN active_workspace_context_id TEXT
    `;
  }
});
