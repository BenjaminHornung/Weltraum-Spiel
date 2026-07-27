import { compareCanonicalCodeUnits } from "../adaptive";
import {
  REPRESENTATION_MAX_FALLBACK_CHILDREN,
  REPRESENTATION_MAX_FALLBACK_GROUPS,
  type AtomicFallbackDecision,
  type AtomicFallbackGroup
} from "./types";
import {
  deepFreeze,
  representationDenseArray,
  representationExactKeys,
  representationFail,
  representationId,
  representationNonNegativeSafeInteger,
  representationRecord
} from "./validation";

const readinessValues = new Set(["Ready", "Stale", "Invalid", "Cancelled", "Incomplete"]);

const fallbackGroup = (value: unknown, path: string): AtomicFallbackGroup => {
  const record = representationRecord(value, path);
  representationExactKeys(record, ["groupId", "parentId", "revision", "requiredChildIds", "children"], path);
  const requiredChildIds = representationDenseArray(record.requiredChildIds, `${path}/requiredChildIds`, REPRESENTATION_MAX_FALLBACK_CHILDREN)
    .map((entry, index) => representationId(entry, `${path}/requiredChildIds/${index}`))
    .sort(compareCanonicalCodeUnits);
  if (requiredChildIds.length < 1) {
    return representationFail("InvalidFallback", `${path}/requiredChildIds`, "At least one required fallback child is required.");
  }
  for (let index = 1; index < requiredChildIds.length; index += 1) {
    if (requiredChildIds[index - 1] === requiredChildIds[index]) {
      return representationFail("InvalidFallback", `${path}/requiredChildIds`, "Required fallback child IDs must be unique.");
    }
  }
  const children = representationDenseArray(record.children, `${path}/children`, REPRESENTATION_MAX_FALLBACK_CHILDREN).map((entry, index) => {
    const childPath = `${path}/children/${index}`;
    const child = representationRecord(entry, childPath);
    representationExactKeys(child, ["childId", "revision", "readiness"], childPath);
    if (typeof child.readiness !== "string" || !readinessValues.has(child.readiness)) {
      return representationFail("InvalidFallback", `${childPath}/readiness`, "Unsupported fallback child readiness.");
    }
    return deepFreeze({
      childId: representationId(child.childId, `${childPath}/childId`),
      revision: representationNonNegativeSafeInteger(child.revision, `${childPath}/revision`),
      readiness: child.readiness as AtomicFallbackGroup["children"][number]["readiness"]
    });
  }).sort((left, right) => compareCanonicalCodeUnits(left.childId, right.childId));
  for (let index = 1; index < children.length; index += 1) {
    if (children[index - 1].childId === children[index].childId) {
      return representationFail("InvalidFallback", `${path}/children`, "Fallback child IDs must be unique.");
    }
  }
  return deepFreeze({
    groupId: representationId(record.groupId, `${path}/groupId`),
    parentId: representationId(record.parentId, `${path}/parentId`),
    revision: representationNonNegativeSafeInteger(record.revision, `${path}/revision`),
    requiredChildIds: deepFreeze(requiredChildIds),
    children: deepFreeze(children)
  });
};

export const resolveAtomicFallback = (value: unknown): AtomicFallbackDecision => {
  const group = fallbackGroup(value, "fallback");
  const complete = group.children.length === group.requiredChildIds.length
    && group.children.every((child, index) =>
      child.childId === group.requiredChildIds[index]
      && child.readiness === "Ready"
      && child.revision === group.revision
    );
  return complete
    ? deepFreeze({
        groupId: group.groupId,
        settledCoverage: "Children",
        parentId: null,
        childIds: deepFreeze(group.children.map((child) => child.childId)),
        reason: "AllRequiredCurrentChildrenReady"
      })
    : deepFreeze({
        groupId: group.groupId,
        settledCoverage: "Parent",
        parentId: group.parentId,
        childIds: [] as const,
        reason: "ParentRetainedUntilAtomicReplacement"
      });
};

export const resolveAtomicFallbackGroups = (value: unknown): readonly AtomicFallbackDecision[] =>
  deepFreeze(representationDenseArray(value, "fallbackGroups", REPRESENTATION_MAX_FALLBACK_GROUPS)
    .map((entry) => resolveAtomicFallback(entry))
    .sort((left, right) => compareCanonicalCodeUnits(left.groupId, right.groupId)));
