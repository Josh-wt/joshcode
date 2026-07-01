import { Schema } from "effect";
import * as SchemaGetter from "effect/SchemaGetter";

import { ThreadWorkspaceContext } from "@t3tools/contracts";

export const ProjectionThreadWorkspaceContextsColumn = Schema.NullOr(
  Schema.fromJsonString(Schema.Array(ThreadWorkspaceContext)),
).pipe(
  Schema.decodeTo(Schema.Array(ThreadWorkspaceContext), {
    decode: SchemaGetter.transform((value) => value ?? []),
    // Stored JSON uses plain strings; branded ProjectId is restored on decode.
    // @ts-expect-error encode targets persisted JSON shape without brands
    encode: SchemaGetter.transform((value) => (value.length === 0 ? null : value)),
  }),
);
