import { structuralComponentClassificationSteps } from "./classificationSteps";
import { StructuralConnectivityError } from "./occupiedEntries";
import type {
  StructuralComponent,
  StructuralComponentClassification,
  StructuralConnectivityBudgets,
  StructuralFragment,
  StructuralObject
} from "./types";

// Same class identity and public name; its definition moved next to the occupied-entry subkernel.
export { StructuralConnectivityError };

/** Public synchronous classification: drains the single step algorithm without pausing. */
export const deriveStructuralComponentClassification = (
  object: StructuralObject,
  budgetValue: StructuralConnectivityBudgets
): StructuralComponentClassification => {
  const steps = structuralComponentClassificationSteps(object, budgetValue);
  for (;;) {
    const step = steps.next();
    if (step.done) {
      return step.value;
    }
  }
};

export const deriveStructuralComponents = (
  object: StructuralObject,
  budgets: StructuralConnectivityBudgets
): readonly StructuralComponent[] => deriveStructuralComponentClassification(object, budgets).components;

export const deriveStructuralFragments = (
  object: StructuralObject,
  budgets: StructuralConnectivityBudgets
): readonly StructuralFragment[] => deriveStructuralComponentClassification(object, budgets).fragments;
