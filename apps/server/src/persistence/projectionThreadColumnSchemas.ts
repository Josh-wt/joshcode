import { Schema } from "effect";
import * as SchemaGetter from "effect/SchemaGetter";

import { ThreadWorkspaceContext } from "@t3tools/contracts";

export const ProjectionThreadWorkspaceContextsColumn = Schema.NullOr(
  Schema.fromJsonString(Schema.Array(ThreadWorkspaceContext)),
).pipe(
  Schema.decodeTo(Schema.Array(ThreadWorkspaceContext), {
    decode: SchemaGetter.transform((value) => value ?? []),
    encode: SchemaGetter.transform((value) => value),
  }),
);
