import { assert, describe, it } from "vitest";

import { getCentralIconUrl } from "./central-icons";

describe("getCentralIconUrl", () => {
  it("builds a public asset URL for a valid icon basename", () => {
    assert.equal(getCentralIconUrl("branch"), "/central-icons-reversed/branch.svg");
    assert.equal(getCentralIconUrl("branch.svg"), "/central-icons-reversed/branch.svg");
  });

  it("returns null for invalid or non-string names", () => {
    assert.equal(getCentralIconUrl(""), null);
    assert.equal(getCentralIconUrl("   "), null);
    assert.equal(getCentralIconUrl("../escape"), null);
    assert.equal(getCentralIconUrl(null as unknown as string), null);
    assert.equal(getCentralIconUrl(undefined as unknown as string), null);
    assert.equal(getCentralIconUrl(42 as unknown as string), null);
    assert.equal(getCentralIconUrl({} as unknown as string), null);
  });
});
