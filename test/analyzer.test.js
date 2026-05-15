import test from "node:test";
import assert from "node:assert/strict";
import { parseRepository } from "../src/analyzer.js";

test("accepts GitHub slugs and canonical URLs", () => {
  assert.deepEqual(parseRepository("zizmorcore/zizmor"), {
    slug: "zizmorcore/zizmor",
    url: "https://github.com/zizmorcore/zizmor.git",
  });
  assert.equal(parseRepository("https://github.com/gunh0/example.git").slug, "gunh0/example");
});

test("rejects arbitrary hosts and command-like input", () => {
  for (const value of ["https://example.com/a/b", "localhost/a", "owner/repo; rm", "../repo", "owner"] ) {
    assert.throws(() => parseRepository(value));
  }
});
