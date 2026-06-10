import { assert, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { runMigrations } from "../Migrations.ts";
import * as NodeSqliteClient from "../NodeSqliteClient.ts";

const layer = it.layer(Layer.mergeAll(NodeSqliteClient.layerMemory()));

const projectionThreadsColumnNames = (sql: SqlClient.SqlClient) =>
  sql<{ readonly name: string }>`
    SELECT name FROM pragma_table_info('projection_threads')
  `.pipe(Effect.map((rows) => rows.map((row) => row.name)));

layer("045_ReconcileForkThreadMarkers", (it) => {
  it.effect("heals fork DBs whose migration 42 was workspace contexts", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      yield* runMigrations({ toMigrationInclusive: 41 });
      yield* sql`
        INSERT INTO effect_sql_migrations (migration_id, name)
        VALUES (42, 'ProjectionThreadWorkspaceContexts')
      `;
      yield* runMigrations({ toMigrationInclusive: 44 });

      const beforeColumns = yield* projectionThreadsColumnNames(sql);
      assert.notInclude(beforeColumns, "thread_markers_json");

      yield* runMigrations();

      const afterColumns = yield* projectionThreadsColumnNames(sql);
      assert.include(afterColumns, "thread_markers_json");
    }),
  );
});
