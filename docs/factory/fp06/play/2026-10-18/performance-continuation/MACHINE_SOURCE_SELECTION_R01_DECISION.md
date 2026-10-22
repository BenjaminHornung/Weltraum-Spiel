# Machine source selection R01

Confirmed R05: the machine panel aggregates several small stacks for one recipe term, enables Start, and submits a request the existing production authority correctly rejects. Saved starts bind one exact stack per term and contain no per-source quantity. Do not relax that authority or change the saved schema.

Use the existing normal Cargo Transfer, which merges compatible bulk stacks. For each recipe term the panel selects one accessible, eligible stack with the whole required quantity. Preserve manual-bench freshness and role checks. Skip smaller stacks and find a later complete stack. When aggregate eligible stock is sufficient but no complete single stack exists, disable Start and explain that compatible stacks can be combined with Cargo Transfer. Never issue an automatic transfer or grant material.

Bounded UI writer, after the kernel-only r22 export: src/factory/ui/machinePanel.ts, src/factory/ui/english.ts, tests/unit/factory/panels.test.ts only. No production, persistence, resource-transfer, runtime, asset or schema changes. Root remains sole shared-runtime integrator. Existing controls, surfaces and keyboard/mouse input remain.

Acceptance: two separate 4kg stacks cannot dispatch an 8kg recipe and have a clear hint; one merged 8kg stack can; a later 8kg stack is selected despite preceding small stacks; multi-ingredient and manual freshness checks remain. Run the existing panel group and TypeScript. Root checks rendered machine/Cargo flow with actual normal transfers and the final fresh 16kg production route. Direct multi-stack production remains strict; normal compatible consolidation is the supported player path.
