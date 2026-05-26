# player-mission-reward-ui-v1 Spec

## Capability: Player Mission Reward UI

### Requirements

- The Player HUD SHALL reserve mission/reward presentation inside or directly adjacent to the existing Objective panel, not inside Ship Systems.
- The Player HUD SHALL use existing gameplay data, currently the Arena/objective loop, as the source for mission/reward text.
- The Player HUD SHALL NOT show fake mission, reward, currency, or unlock claims when no gameplay system reports them.
- While an Arena objective is incomplete, the Objective panel SHALL show objective progress without claiming that a reward is ready.
- When an Arena objective is complete and the Arena loop reports reward data, the Objective panel SHALL show a compact player-facing completion/reward status.
- The Mission/Reward display SHALL remain compact and shall not overlap radar, context panels, bottom controls, or target indicators across the existing responsive HUD matrix.
- The legacy debug/prototype windows SHALL remain separate from this player-facing mission/reward presentation.

### Important Scenarios

- No objective source: Objective/Mission reward UI is hidden or neutral.
- Arena active: Objective progress is visible; reward is not claim-ready.
- Arena complete: Objective progress and reward/completion text are visible.
- Ship Systems text: contains ship status only and no Arena reward line.

### Verification

- EditMode tests cover snapshot/renderer behavior for active and complete objective states.
- Unity MCP tests cover the affected HUD/objective and Arena behavior.
- A GameView screenshot shows the player-facing Objective panel with mission/reward state.
