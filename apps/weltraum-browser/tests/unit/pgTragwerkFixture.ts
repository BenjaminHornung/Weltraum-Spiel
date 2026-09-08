/**
 * Vitest compatibility barrel. The fixture implementation lives in the
 * test-side adapter so browser proofs never import product code through a
 * `tests/unit` module path.
 */
export * from "../support/pgTragwerkFixtureAdapter";
