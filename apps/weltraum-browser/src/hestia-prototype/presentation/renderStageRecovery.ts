/** A stage without a returned handle could not prove release of its hidden resources.
 * Ordinary stage exceptions must leave the previous generation intact and release the new one.
 * This same-thread signal preserves both causes; native rollback cannot clear it.
 */
export class HvpRenderStageRecoveryError extends AggregateError {}
