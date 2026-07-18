import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import * as ts from "typescript/unstable/ast";
import { API, type Project } from "typescript/unstable/sync";
import { describe, expect, it } from "vitest";
import {
  INTERACTION_BLOCK_REASONS,
  INTERACTION_VERBS,
  InteractionCanonicalError,
  InteractionContractError,
  canonicalInteractionJson,
  canonicalizeInteractionValue,
  createInteractionActorContext,
  createInteractionCandidate,
  createInteractionTargetSnapshot,
  evaluateInteraction,
  interactionHash,
  orderInteractionCandidates,
  selectFocusedInteractionCandidate,
  type InteractionActorContextInput,
  type InteractionCandidateInput,
  type InteractionTargetSnapshotInput,
  type InteractionVerbRuleInput
} from "../../src/interaction";

const ruleInput = (overrides: Partial<InteractionVerbRuleInput> = {}): InteractionVerbRuleInput => ({
  verb: "Inspect",
  requiredCapabilities: ["cap.basic"],
  requiredTools: ["tool.multitool"],
  costs: { energy: 2, resources: [{ resourceId: "resource.parts", amount: 1 }] },
  requiredPermissionId: "permission.interact",
  requiredHoldTicks: 3,
  interruptPolicy: "Interruptible",
  movementToleranceClass: "Stationary",
  damageInterrupts: true,
  focusLossInterrupts: true,
  allowedActorModes: ["mode.surface"],
  targetBusy: false,
  ...overrides
});

const targetInput = (
  overrides: Partial<InteractionTargetSnapshotInput> = {},
  ruleOverrides: Partial<InteractionVerbRuleInput> = {}
): InteractionTargetSnapshotInput => ({
  targetId: "target.airlock",
  revision: 4,
  ownerId: "owner.station",
  claimId: "claim.station",
  legalState: "Legal",
  hazard: { level: 1, warningThreshold: 2 },
  supportedVerbs: ["Inspect"],
  verbRules: [ruleInput(ruleOverrides)],
  ...overrides
});

const actorInput = (overrides: Partial<InteractionActorContextInput> = {}): InteractionActorContextInput => ({
  actorId: "actor.player",
  revision: 7,
  knownCapabilities: ["cap.basic", "cap.scan"],
  capabilities: ["cap.basic"],
  tools: ["tool.multitool"],
  energyAvailable: 10,
  resources: [{ resourceId: "resource.parts", amount: 5 }],
  permissions: ["permission.interact"],
  legalOverride: false,
  hazardTolerance: 5,
  incapacitated: false,
  mode: "mode.surface",
  ...overrides
});

const candidateInput = (
  target: InteractionTargetSnapshotInput = targetInput(),
  overrides: Partial<InteractionCandidateInput> = {}
): InteractionCandidateInput => ({
  actorId: "actor.player",
  actorRevision: 7,
  target,
  expectedTargetRevision: 4,
  verb: "Inspect",
  distanceMeters: 2,
  maximumDistanceMeters: 3,
  lineOfSight: true,
  reachable: true,
  focusRank: 0,
  ...overrides
});

const decisionFor = (
  candidateOverrides: Partial<InteractionCandidateInput> = {},
  actorOverrides: Partial<InteractionActorContextInput> = {},
  targetOverrides: Partial<InteractionTargetSnapshotInput> = {},
  ruleOverrides: Partial<InteractionVerbRuleInput> = {}
) => evaluateInteraction(
  candidateInput(targetInput(targetOverrides, ruleOverrides), candidateOverrides),
  actorInput(actorOverrides)
);

interface AuthorityScanResult {
  readonly forbiddenImports: readonly string[];
  readonly forbiddenAuthorities: readonly string[];
  readonly visited: readonly string[];
}

const ambientAuthorityNames = new Set([
  "Date", "HTMLElement", "cancelAnimationFrame", "crypto", "document", "localStorage", "navigator",
  "performance", "requestAnimationFrame", "sessionStorage", "setInterval", "setTimeout", "window"
]);

const displayFileName = (fileName: string): string => relative(process.cwd(), fileName).replaceAll("\\", "/");

const moduleText = (node: ts.Node): string | null =>
  ts.isStringLiteralLikeNode(node) ? node.text : null;

interface LexicalScope {
  readonly bindings: Set<string>;
  readonly functionBoundary: boolean;
  readonly parent: LexicalScope | null;
}

const isFunctionScopeNode = (node: ts.Node): boolean =>
  ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) ||
  ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node) ||
  ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node) ||
  ts.isMethodSignatureDeclaration(node) || ts.isCallSignatureDeclaration(node) ||
  ts.isConstructSignatureDeclaration(node) || ts.isFunctionTypeNode(node) ||
  ts.isConstructorTypeNode(node) || ts.isIndexSignatureDeclaration(node);

const isLoopScopeNode = (node: ts.Node): boolean =>
  ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node);

const addBindingName = (node: ts.Node, scope: LexicalScope): void => {
  if (ts.isIdentifier(node)) {
    scope.bindings.add(node.text);
    return;
  }
  if (ts.isObjectBindingPattern(node) || ts.isArrayBindingPattern(node)) {
    for (const element of node.elements) {
      if (ts.isBindingElement(element) && element.name !== undefined) {
        addBindingName(element.name, scope);
      }
    }
  }
};

const createLexicalScopeMap = (sourceFile: ts.SourceFile): WeakMap<ts.Node, LexicalScope> => {
  const scopes = new WeakMap<ts.Node, LexicalScope>();
  const rootScope: LexicalScope = { bindings: new Set(), functionBoundary: true, parent: null };

  const collect = (node: ts.Node, parentScope: LexicalScope): void => {
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isEnumDeclaration(node) ||
         ts.isModuleDeclaration(node)) && node.name !== undefined && ts.isIdentifier(node.name)) {
      addBindingName(node.name, parentScope);
    }

    const createsScope = node !== sourceFile && (ts.isBlock(node) || isFunctionScopeNode(node) ||
      ts.isClassDeclaration(node) || ts.isClassExpression(node) || ts.isCatchClause(node) || isLoopScopeNode(node));
    const scope: LexicalScope = createsScope
      ? { bindings: new Set(), functionBoundary: isFunctionScopeNode(node), parent: parentScope }
      : parentScope;
    scopes.set(node, scope);

    if (ts.isVariableDeclaration(node)) {
      const declarationList = node.parent;
      const isBlockScoped = ts.isVariableDeclarationList(declarationList) &&
        (declarationList.flags & ts.NodeFlags.BlockScoped) !== 0 || ts.isCatchClause(declarationList);
      let bindingScope = scope;
      while (!isBlockScoped && !bindingScope.functionBoundary && bindingScope.parent !== null) {
        bindingScope = bindingScope.parent;
      }
      addBindingName(node.name, bindingScope);
    } else if (ts.isParameterDeclaration(node)) {
      addBindingName(node.name, scope);
    } else if (ts.isFunctionExpression(node) && node.name !== undefined) {
      addBindingName(node.name, scope);
    } else if (ts.isClassExpression(node) && node.name !== undefined) {
      addBindingName(node.name, scope);
    } else if (ts.isImportClause(node) && node.name !== undefined) {
      addBindingName(node.name, scope);
    } else if (ts.isImportSpecifier(node) || ts.isNamespaceImport(node) || ts.isImportEqualsDeclaration(node)) {
      addBindingName(node.name, scope);
    }

    node.forEachChild((child) => collect(child, scope));
  };

  scopes.set(sourceFile, rootScope);
  sourceFile.forEachChild((child) => collect(child, rootScope));
  return scopes;
};

const isGlobalIdentifier = (identifier: ts.Identifier, scopes: WeakMap<ts.Node, LexicalScope>): boolean => {
  let scope = scopes.get(identifier) ?? null;
  while (scope !== null) {
    if (scope.bindings.has(identifier.text)) {
      return false;
    }
    scope = scope.parent;
  }
  return true;
};

const propertyNameText = (node: ts.Node | undefined): string | null => {
  if (node === undefined) {
    return null;
  }
  return ts.isIdentifier(node) || ts.isStringLiteralLikeNode(node) ? node.text : null;
};

const isNonReferenceIdentifierPosition = (node: ts.Identifier): boolean => {
  const parent = node.parent;
  if (parent === undefined) {
    return false;
  }
  if ((ts.isPropertyAccessExpression(parent) || ts.isPropertyAssignment(parent) ||
       ts.isPropertyDeclaration(parent) || ts.isPropertySignatureDeclaration(parent) ||
       ts.isMethodDeclaration(parent) || ts.isMethodSignatureDeclaration(parent) ||
       ts.isGetAccessorDeclaration(parent) || ts.isSetAccessorDeclaration(parent) ||
       ts.isEnumMember(parent) || ts.isNamedTupleMember(parent)) && parent.name === node) {
    return true;
  }
  if (ts.isBindingElement(parent) && (parent.name === node || parent.propertyName === node)) {
    return true;
  }
  if (ts.isQualifiedName(parent) && parent.right === node) {
    return true;
  }
  if (ts.isImportSpecifier(parent) && parent.propertyName === node) {
    return true;
  }
  if (ts.isExportSpecifier(parent) && parent.propertyName !== undefined && parent.name === node) {
    return true;
  }
  if ((ts.isInterfaceDeclaration(parent) || ts.isTypeAliasDeclaration(parent) ||
       ts.isTypeParameterDeclaration(parent)) && parent.name === node) {
    return true;
  }
  if ((ts.isLabeledStatement(parent) || ts.isBreakStatement(parent) || ts.isContinueStatement(parent)) &&
      parent.label === node) {
    return true;
  }
  return false;
};

const scanAuthoritySources = (project: Project, rootFiles: readonly string[]): AuthorityScanResult => {
  const pending = rootFiles.map((file) => resolve(file));
  const visited = new Set<string>();
  const forbiddenImports: string[] = [];
  const forbiddenAuthorities: string[] = [];

  const localDependency = (importer: string, specifier: string): string | null => {
    if (!specifier.startsWith(".")) {
      return null;
    }
    const base = resolve(dirname(importer), specifier);
    for (const candidate of [base, `${base}.ts`, join(base, "index.ts")]) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  };

  while (pending.length > 0) {
    const filePath = pending.pop() as string;
    const normalizedPath = resolve(filePath);
    if (visited.has(normalizedPath)) {
      continue;
    }
    visited.add(normalizedPath);
    const sourceFile = project.program.getSourceFile(normalizedPath);
    if (sourceFile === undefined) {
      throw new Error(`TypeScript AST unavailable for ${normalizedPath}`);
    }
    const sourceDisplay = displayFileName(normalizedPath);
    const lexicalScopes = createLexicalScopeMap(sourceFile);

    const inspectModule = (specifier: string | null, kind: string): void => {
      if (specifier === null) {
        forbiddenImports.push(`${sourceDisplay}: non-literal ${kind}`);
        return;
      }
      if (specifier === "three" || specifier.startsWith("three/")) {
        forbiddenImports.push(`${sourceDisplay}: ${specifier}`);
      }
      const dependency = localDependency(normalizedPath, specifier);
      if (dependency !== null && !visited.has(dependency)) {
        pending.push(dependency);
      }
    };

    const recordGlobalThisBinding = (binding: ts.ObjectBindingPattern): void => {
      for (const element of binding.elements) {
        const name = propertyNameText(element.propertyName) ?? propertyNameText(element.name);
        if (name !== null && ambientAuthorityNames.has(name)) {
          forbiddenAuthorities.push(`${sourceDisplay}: globalThis destructuring ${name}`);
        }
      }
    };

    const visit = (node: ts.Node): void => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier !== undefined) {
        inspectModule(moduleText(node.moduleSpecifier), "static import");
      }
      if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
        inspectModule(
          node.moduleReference.expression === undefined ? null : moduleText(node.moduleReference.expression),
          "static import"
        );
      }
      if (ts.isCallExpression(node)) {
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
          inspectModule(node.arguments.length === 1 ? moduleText(node.arguments[0] as ts.Node) : null, "dynamic import");
        } else if (ts.isIdentifier(node.expression) && node.expression.text === "require" &&
                   isGlobalIdentifier(node.expression, lexicalScopes)) {
          inspectModule(node.arguments.length === 1 ? moduleText(node.arguments[0] as ts.Node) : null, "require");
        }
      }

      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) &&
          node.expression.text === "globalThis" && isGlobalIdentifier(node.expression, lexicalScopes) &&
          ambientAuthorityNames.has(node.name.text)) {
        forbiddenAuthorities.push(`${sourceDisplay}: globalThis.${node.name.text}`);
      }
      if (ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression) &&
          node.expression.text === "globalThis" && isGlobalIdentifier(node.expression, lexicalScopes)) {
        const name = propertyNameText(node.argumentExpression);
        if (name !== null && ambientAuthorityNames.has(name)) {
          forbiddenAuthorities.push(`${sourceDisplay}: globalThis[${name}]`);
        }
      }
      if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) &&
          node.initializer !== undefined && ts.isIdentifier(node.initializer) && node.initializer.text === "globalThis" &&
          isGlobalIdentifier(node.initializer, lexicalScopes)) {
        recordGlobalThisBinding(node.name);
      }

      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) &&
          node.expression.text === "Math" && node.name.text === "random" &&
          isGlobalIdentifier(node.expression, lexicalScopes)) {
        forbiddenAuthorities.push(`${sourceDisplay}: Math.random`);
      }
      if (ts.isIdentifier(node) && ambientAuthorityNames.has(node.text) &&
          isGlobalIdentifier(node, lexicalScopes)) {
        if (!isNonReferenceIdentifierPosition(node)) {
          forbiddenAuthorities.push(`${sourceDisplay}: ${node.text}`);
        }
      }

      node.forEachChild(visit);
    };

    visit(sourceFile);
  }

  return {
    forbiddenImports,
    forbiddenAuthorities,
    visited: [...visited].map(displayFileName)
  };
};

const scanSyntheticAuthoritySource = (source: string): AuthorityScanResult => {
  const directory = mkdtempSync(join(tmpdir(), "interaction-authority-"));
  const filePath = join(directory, "fixture.ts");
  writeFileSync(filePath, source, "utf8");
  const api = new API({ cwd: directory });
  try {
    const snapshot = api.updateSnapshot({ openFiles: [filePath] });
    try {
      const project = snapshot.getDefaultProjectForFile(filePath);
      if (project === undefined) {
        throw new Error("TypeScript did not create a project for the authority fixture.");
      }
      return scanAuthoritySources(project, [filePath]);
    } finally {
      snapshot.dispose();
    }
  } finally {
    api.close();
    rmSync(directory, { force: true, recursive: true });
  }
};

describe("surface interaction contracts and evaluation", () => {
  it("exports exactly the V1 verbs and closed block reasons", () => {
    expect(INTERACTION_VERBS).toEqual([
      "Inspect", "Scan", "Extract", "Repair", "Open", "Close", "Activate", "Deactivate", "Pickup", "Place", "Transfer"
    ]);
    expect(INTERACTION_BLOCK_REASONS).toEqual([
      "OutOfRange", "NoLineOfSight", "NotReachable", "MissingCapability", "MissingTool",
      "InsufficientEnergy", "InsufficientResource", "HazardTooHigh", "PermissionDenied",
      "IllegalWithoutOverride", "TargetBusy", "TargetStale", "ActorIncapacitated", "ModeConflict"
    ]);
  });

  it("returns a frozen Allowed decision with all Task 2 admission parameters", () => {
    const decision = decisionFor();
    expect(decision).toMatchObject({
      status: "Allowed",
      reason: null,
      unavailableReason: null,
      warnings: [],
      costs: { energy: 2, resources: [{ resourceId: "resource.parts", amount: 1 }] },
      requiredHoldTicks: 3,
      interruptPolicy: "Interruptible",
      movementToleranceClass: "Stationary",
      damageInterrupts: true,
      focusLossInterrupts: true
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.warnings)).toBe(true);
    expect(decision.status === "Allowed" && Object.isFrozen(decision.costs.resources)).toBe(true);
    const target = createInteractionTargetSnapshot(targetInput());
    expect(target.requiredCapabilities).toEqual(["cap.basic"]);
    expect(target.requiredTools).toEqual(["tool.multitool"]);
  });

  it("produces byte-stable decisions and hashes for equivalent reordered input", () => {
    const first = createInteractionTargetSnapshot({
      ...targetInput(),
      supportedVerbs: ["Scan", "Inspect"],
      verbRules: [
        ruleInput({ verb: "Scan", requiredCapabilities: ["cap.scan", "cap.basic"], requiredTools: [] }),
        ruleInput({ requiredCapabilities: ["cap.basic"], requiredTools: ["tool.multitool"] })
      ]
    });
    const second = createInteractionTargetSnapshot({
      ...targetInput(),
      supportedVerbs: ["Inspect", "Scan"],
      verbRules: [
        ruleInput({ requiredCapabilities: ["cap.basic"], requiredTools: ["tool.multitool"] }),
        ruleInput({ verb: "Scan", requiredCapabilities: ["cap.basic", "cap.scan"], requiredTools: [] })
      ]
    });
    const contextA = createInteractionActorContext(actorInput({
      knownCapabilities: ["cap.scan", "cap.basic"],
      capabilities: ["cap.basic", "cap.scan"]
    }));
    const contextB = createInteractionActorContext(actorInput({
      knownCapabilities: ["cap.basic", "cap.scan"],
      capabilities: ["cap.scan", "cap.basic"]
    }));
    const a = evaluateInteraction(createInteractionCandidate(candidateInput(first)), contextA);
    const b = evaluateInteraction(createInteractionCandidate(candidateInput(second)), contextB);
    expect(canonicalInteractionJson(a)).toBe(canonicalInteractionJson(b));
    expect(a.decisionHash).toBe(b.decisionHash);
    expect(interactionHash(a)).toBe(interactionHash(b));
  });

  it.each([
    ["TargetStale", { expectedTargetRevision: 3 }, {}, {}, {}],
    ["ActorIncapacitated", {}, { incapacitated: true }, {}, {}],
    ["OutOfRange", { distanceMeters: 4 }, {}, {}, {}],
    ["NoLineOfSight", { lineOfSight: false }, {}, {}, {}],
    ["NotReachable", { reachable: false }, {}, {}, {}],
    ["MissingCapability", {}, { capabilities: [] }, {}, {}],
    ["MissingTool", {}, { tools: [] }, {}, {}],
    ["InsufficientEnergy", {}, { energyAvailable: 1 }, {}, {}],
    ["InsufficientResource", {}, { resources: [] }, {}, {}],
    ["HazardTooHigh", {}, { hazardTolerance: 2 }, { hazard: { level: 3, warningThreshold: 1 } }, {}],
    ["PermissionDenied", {}, { permissions: [] }, {}, {}],
    ["IllegalWithoutOverride", {}, {}, { legalState: "Illegal" }, {}],
    ["TargetBusy", {}, {}, {}, { targetBusy: true }],
    ["ModeConflict", {}, { mode: "mode.flight" }, {}, {}]
  ] as const)("returns the closed %s reason", (reason, candidateOverrides, actorOverrides, targetOverrides, ruleOverrides) => {
    expect(decisionFor(candidateOverrides, actorOverrides, targetOverrides, ruleOverrides)).toMatchObject({
      status: "Blocked",
      reason
    });
  });

  it("applies target, actor, spatial, equipment, cost, risk, policy, and verb precedence", () => {
    expect(decisionFor(
      { expectedTargetRevision: 2, distanceMeters: 10, lineOfSight: false, reachable: false },
      { incapacitated: true, capabilities: [], tools: [], energyAvailable: 0, permissions: [], mode: "mode.flight" },
      { legalState: "Illegal", hazard: { level: 9, warningThreshold: 1 } },
      { targetBusy: true }
    ).reason).toBe("TargetStale");
    expect(decisionFor(
      { distanceMeters: 10, lineOfSight: false },
      { incapacitated: true, capabilities: [], tools: [] }
    ).reason).toBe("ActorIncapacitated");
    expect(decisionFor(
      { distanceMeters: 10, lineOfSight: false, reachable: false },
      { capabilities: [], tools: [], energyAvailable: 0 }
    ).reason).toBe("OutOfRange");
  });

  it.each([
    [
      "incapacity before an unsupported verb",
      { ...candidateInput(), verb: "Hack" },
      actorInput({ incapacitated: true }),
      { status: "Blocked", reason: "ActorIncapacitated" }
    ],
    [
      "incapacity before target verb availability",
      candidateInput(targetInput({
        supportedVerbs: ["Scan"],
        verbRules: [ruleInput({ verb: "Scan", requiredCapabilities: [], requiredTools: [] })]
      })),
      actorInput({ incapacitated: true }),
      { status: "Blocked", reason: "ActorIncapacitated" }
    ],
    [
      "incapacity before an unknown capability",
      candidateInput(targetInput({}, { requiredCapabilities: ["cap.future"] })),
      actorInput({ incapacitated: true }),
      { status: "Blocked", reason: "ActorIncapacitated" }
    ],
    [
      "range before an unknown capability",
      candidateInput(targetInput({}, { requiredCapabilities: ["cap.future"] }), { distanceMeters: 4 }),
      actorInput(),
      { status: "Blocked", reason: "OutOfRange" }
    ]
  ] as const)("evaluates %s", (_name, candidate, context, expected) => {
    expect(evaluateInteraction(candidate, context)).toMatchObject(expected);
  });

  it("keeps every adjacent precedence boundary stable when the lower check is also invalid or blocked", () => {
    expect(evaluateInteraction(
      { ...candidateInput(), expectedTargetRevision: 3, actorId: "bad id" },
      actorInput()
    )).toMatchObject({ status: "Blocked", reason: "TargetStale" });
    expect(evaluateInteraction(
      { ...candidateInput(), distanceMeters: Number.NaN },
      { ...actorInput(), incapacitated: true }
    )).toMatchObject({ status: "Blocked", reason: "ActorIncapacitated" });
    expect(evaluateInteraction(
      { ...candidateInput(), distanceMeters: 4, lineOfSight: "invalid" },
      actorInput()
    )).toMatchObject({ status: "Blocked", reason: "OutOfRange" });
    expect(evaluateInteraction(
      { ...candidateInput(), lineOfSight: false, reachable: "invalid" },
      actorInput()
    )).toMatchObject({ status: "Blocked", reason: "NoLineOfSight" });
    expect(evaluateInteraction(
      candidateInput(targetInput({}, { requiredCapabilities: null as unknown as readonly string[] }), { reachable: false }),
      actorInput()
    )).toMatchObject({ status: "Blocked", reason: "NotReachable" });
    expect(evaluateInteraction(
      candidateInput(),
      { ...actorInput({ capabilities: [] }), tools: null }
    )).toMatchObject({ status: "Blocked", reason: "MissingCapability" });
    expect(evaluateInteraction(
      candidateInput(),
      { ...actorInput({ tools: [] }), energyAvailable: Number.NaN }
    )).toMatchObject({ status: "Blocked", reason: "MissingTool" });
    expect(evaluateInteraction(
      candidateInput(),
      { ...actorInput({ energyAvailable: 1 }), resources: null }
    )).toMatchObject({ status: "Blocked", reason: "InsufficientEnergy" });
    expect(evaluateInteraction(
      candidateInput(targetInput({ hazard: { level: Number.NaN, warningThreshold: 1 } })),
      actorInput({ resources: [] })
    )).toMatchObject({ status: "Blocked", reason: "InsufficientResource" });
    expect(evaluateInteraction(
      candidateInput(targetInput({ hazard: { level: 6, warningThreshold: 1 } })),
      { ...actorInput(), permissions: null }
    )).toMatchObject({ status: "Blocked", reason: "HazardTooHigh" });
    expect(evaluateInteraction(
      candidateInput(targetInput({ legalState: "invalid" })),
      actorInput({ permissions: [] })
    )).toMatchObject({ status: "Blocked", reason: "PermissionDenied" });
    expect(evaluateInteraction(
      candidateInput(targetInput({ legalState: "Illegal" }, { targetBusy: "invalid" as unknown as boolean })),
      actorInput()
    )).toMatchObject({ status: "Blocked", reason: "IllegalWithoutOverride" });
    expect(evaluateInteraction(
      candidateInput(targetInput({}, { targetBusy: true })),
      { ...actorInput(), mode: "bad mode" }
    )).toMatchObject({ status: "Blocked", reason: "TargetBusy" });
  });

  it("lets valid higher-layer decisions beat malformed spatial, capability, and verb fields", () => {
    expect(evaluateInteraction(
      {
        ...candidateInput(),
        verb: "Hack",
        distanceMeters: Number.NaN
      },
      {
        ...actorInput({ incapacitated: true }),
        knownCapabilities: null,
        capabilities: null
      }
    )).toMatchObject({ status: "Blocked", reason: "ActorIncapacitated" });

    expect(evaluateInteraction(
      { ...candidateInput(), expectedTargetRevision: 3, distanceMeters: Number.NaN },
      actorInput()
    )).toMatchObject({ status: "Blocked", reason: "TargetStale" });
  });

  it("evaluates risk and legal layers before unsupported or target-unavailable verbs", () => {
    expect(evaluateInteraction(
      { ...candidateInput(targetInput({ hazard: { level: 6, warningThreshold: 1 } })), verb: "Hack" },
      actorInput()
    )).toMatchObject({ status: "Blocked", reason: "HazardTooHigh" });

    expect(evaluateInteraction(
      candidateInput(targetInput({
        legalState: "Illegal",
        supportedVerbs: ["Scan"],
        verbRules: [ruleInput({ verb: "Scan", requiredCapabilities: [], requiredTools: [] })]
      })),
      actorInput()
    )).toMatchObject({ status: "Blocked", reason: "IllegalWithoutOverride" });

    expect(evaluateInteraction(
      { ...candidateInput(), verb: "Hack" },
      { ...actorInput(), energyAvailable: Number.NaN }
    )).toMatchObject({ status: "Unavailable", unavailableReason: "InvalidContract" });

    expect(evaluateInteraction(
      candidateInput(targetInput({
        supportedVerbs: ["Scan"],
        verbRules: [ruleInput({ verb: "Scan", requiredCapabilities: [], requiredTools: [] })]
      })),
      { ...actorInput(), knownCapabilities: null }
    )).toMatchObject({ status: "Unavailable", unavailableReason: "InvalidContract" });
  });

  it("keeps missing capability and missing tool independent and ordered", () => {
    expect(decisionFor({}, { capabilities: [], tools: [] }).reason).toBe("MissingCapability");
    expect(decisionFor({}, { capabilities: ["cap.basic"], tools: [] }).reason).toBe("MissingTool");
  });

  it("checks permission before legality and never treats override as permission", () => {
    expect(decisionFor({}, { permissions: [], legalOverride: false }, { legalState: "Illegal" }).reason)
      .toBe("PermissionDenied");
    expect(decisionFor({}, { permissions: [], legalOverride: true }, { legalState: "Illegal" }).reason)
      .toBe("PermissionDenied");
    expect(decisionFor({}, { legalOverride: false }, { legalState: "Illegal" }).reason)
      .toBe("IllegalWithoutOverride");
    expect(decisionFor({}, { legalOverride: true }, { legalState: "Illegal" }).status).toBe("Allowed");
  });

  it("warns for tolerated hazard and blocks only above tolerance", () => {
    const warned = decisionFor({}, { hazardTolerance: 5 }, { hazard: { level: 5, warningThreshold: 2 } });
    const blocked = decisionFor({}, { hazardTolerance: 4 }, { hazard: { level: 5, warningThreshold: 2 } });
    expect(warned).toMatchObject({ status: "Allowed", warnings: ["HazardWarning"] });
    expect(blocked).toMatchObject({ status: "Blocked", reason: "HazardTooHigh", warnings: [] });
  });

  it("uses stable target ID as the final tie-break without mutating candidate order", () => {
    const context = createInteractionActorContext(actorInput());
    const targetB = createInteractionTargetSnapshot(targetInput({ targetId: "target.b" }));
    const targetA = createInteractionTargetSnapshot(targetInput({ targetId: "target.a" }));
    const candidateB = createInteractionCandidate(candidateInput(targetB));
    const candidateA = createInteractionCandidate(candidateInput(targetA));
    const source = [candidateB, candidateA];
    const ordered = orderInteractionCandidates(source, context);
    expect(ordered.map((entry) => entry.candidate.target.targetId)).toEqual(["target.a", "target.b"]);
    expect(selectFocusedInteractionCandidate(source, context)?.candidate.target.targetId).toBe("target.a");
    expect(source.map((entry) => entry.target.targetId)).toEqual(["target.b", "target.a"]);
    expect(Object.isFrozen(ordered)).toBe(true);
    expect(Object.isFrozen(ordered[0]?.candidate.target)).toBe(true);
  });

  it("orders Allowed before Blocked before Unavailable, then by explicit focus fields", () => {
    const context = createInteractionActorContext(actorInput());
    const allowedFarFocus = createInteractionCandidate(candidateInput(targetInput({ targetId: "target.allowed" }), { focusRank: 5 }));
    const blockedNearFocus = createInteractionCandidate(candidateInput(targetInput({ targetId: "target.blocked" }), {
      focusRank: 0,
      distanceMeters: 9
    }));
    const unavailable = createInteractionCandidate(candidateInput(
      targetInput({ targetId: "target.unavailable", supportedVerbs: ["Scan"], verbRules: [ruleInput({ verb: "Scan" })] }),
      { focusRank: 0 }
    ));
    expect(orderInteractionCandidates([unavailable, blockedNearFocus, allowedFarFocus], context)
      .map((entry) => entry.decision.status)).toEqual(["Allowed", "Blocked", "Unavailable"]);
  });

  it("canonicalizes finite nonnegative costs and rejects unsafe costs", () => {
    const target = createInteractionTargetSnapshot(targetInput({}, {
      costs: {
        energy: 0,
        resources: [
          { resourceId: "resource.zinc", amount: 0 },
          { resourceId: "resource.parts", amount: 2 }
        ]
      }
    }));
    expect(target.verbRules[0]?.costs.resources.map((cost) => cost.resourceId))
      .toEqual(["resource.parts", "resource.zinc"]);
    for (const invalid of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => createInteractionTargetSnapshot(targetInput({}, {
        costs: { energy: invalid, resources: [] }
      }))).toThrowError(InteractionContractError);
      expect(evaluateInteraction(candidateInput(targetInput({}, {
        costs: { energy: invalid, resources: [] }
      })), actorInput())).toMatchObject({ status: "Unavailable", unavailableReason: "InvalidContract" });
    }
  });

  it("fails closed for unknown verbs, capabilities, malformed IDs, and non-finite candidate values", () => {
    expect(evaluateInteraction({ ...candidateInput(), verb: "Hack" }, actorInput()))
      .toMatchObject({ status: "Unavailable", unavailableReason: "UnsupportedVerb" });
    expect(decisionFor({}, {}, {}, { requiredCapabilities: ["cap.future"] }))
      .toMatchObject({ status: "Unavailable", unavailableReason: "UnknownCapability" });
    expect(evaluateInteraction(candidateInput(targetInput({ targetId: "bad id" })), actorInput()))
      .toMatchObject({ status: "Unavailable", unavailableReason: "InvalidTarget" });
    expect(evaluateInteraction({ ...candidateInput(), distanceMeters: Number.NaN }, actorInput()))
      .toMatchObject({ status: "Unavailable", unavailableReason: "InvalidContract" });
  });

  it("returns Unavailable for valid but unsupported target actions", () => {
    const scanOnly = targetInput({
      supportedVerbs: ["Scan"],
      verbRules: [ruleInput({ verb: "Scan", requiredTools: [], requiredCapabilities: [] })]
    });
    expect(evaluateInteraction(candidateInput(scanOnly), actorInput()))
      .toMatchObject({ status: "Unavailable", unavailableReason: "TargetNotActionable" });
  });

  it("does not mutate caller input and returns deeply frozen clones", () => {
    const rawTarget = targetInput();
    const rawContext = actorInput();
    const rawCandidate = candidateInput(rawTarget);
    const before = canonicalInteractionJson({ rawCandidate, rawContext });
    const decision = evaluateInteraction(rawCandidate, rawContext);
    expect(canonicalInteractionJson({ rawCandidate, rawContext })).toBe(before);
    expect(Object.isFrozen(rawCandidate)).toBe(false);
    expect(Object.isFrozen(rawContext)).toBe(false);
    expect(Object.isFrozen(decision)).toBe(true);
    if (decision.status === "Allowed") {
      expect(Object.isFrozen(decision.costs)).toBe(true);
      expect(Object.isFrozen(decision.costs.resources)).toBe(true);
    }
  });

  it("serializes keys and negative zero canonically and rejects non-JSON values", () => {
    expect(canonicalInteractionJson({ z: -0, a: { d: 2, c: 1 } }))
      .toBe('{"a":{"c":1,"d":2},"z":0}');
    expect(interactionHash({ b: 2, a: 1 })).toBe(interactionHash({ a: 1, b: 2 }));
    expect(() => canonicalInteractionJson({ value: Number.NEGATIVE_INFINITY }))
      .toThrowError(InteractionCanonicalError);
    expect(() => canonicalInteractionJson({ value: undefined }))
      .toThrowError(InteractionCanonicalError);
  });

  it("preserves an enumerable own __proto__ key as distinct canonical data", () => {
    const dangerous = JSON.parse('{"__proto__":{"polluted":true}}') as unknown;
    const canonical = canonicalizeInteractionValue<Record<string, unknown>>(dangerous);
    expect(Object.getPrototypeOf(canonical)).toBeNull();
    expect(Object.hasOwn(canonical, "__proto__")).toBe(true);
    expect(canonicalInteractionJson(dangerous)).toBe('{"__proto__":{"polluted":true}}');
    expect(canonicalInteractionJson(dangerous)).not.toBe(canonicalInteractionJson({}));
    expect(interactionHash(dangerous)).not.toBe(interactionHash({}));
  });

  it("keeps the interaction source free of presentation, clock, and random authority", () => {
    const sourceDirectory = join(process.cwd(), "src", "interaction");
    const rootFiles = readdirSync(sourceDirectory)
      .filter((file) => file.endsWith(".ts"))
      .map((file) => join(sourceDirectory, file));
    const api = new API({ cwd: process.cwd() });
    try {
      const snapshot = api.updateSnapshot({ openProjects: [join(process.cwd(), "tsconfig.json")] });
      try {
        const project = snapshot.getProjects()[0];
        expect(project).toBeDefined();
        const result = scanAuthoritySources(project as Project, rootFiles);
        expect(result.visited).toContain("src/core/hash.ts");
        expect(result.forbiddenImports).toEqual([]);
        expect(result.forbiddenAuthorities).toEqual([]);
      } finally {
        snapshot.dispose();
      }
    } finally {
      api.close();
    }
  });

  it("proves the AST authority detector catches forbidden syntax without flagging safe property names or shadows", () => {
    const positive = scanSyntheticAuthoritySource(`
      import "three";
      export * from "three/examples/jsm/Addons.js";
      import Three = require("three/src/Three.js");
      void Three;
      void import("three/addons/loaders/GLTFLoader.js");
      const moduleName = "three";
      void import(moduleName);
      interface ScopedSignature {
        window: string;
        schedule(setTimeout: number): void;
      }
      void (0 as unknown as ScopedSignature);
      try {
        throw new Error("scope");
      } catch (window) {
        void window;
      }
      for (const Date of [class LocalDate {}]) {
        void Date;
      }
      for (const document in { local: true }) {
        void document;
      }
      for (let performance = 0; performance < 1; performance += 1) {
        void performance;
      }
      Date.now();
      Math.random();
      window.location.href;
      document.title;
      performance.now();
      setTimeout(() => undefined, 0);
      globalThis.document;
      globalThis["performance"];
      const { navigator, localStorage: storage } = globalThis;
      void storage;
    `);
    expect(positive.forbiddenImports).toHaveLength(5);
    expect(positive.forbiddenAuthorities).toHaveLength(10);
    expect(positive.forbiddenImports.some((entry) => entry.includes("non-literal dynamic import"))).toBe(true);
    for (const authority of [
      "Date", "Math.random", "window", "globalThis.document", "globalThis[performance]",
      "globalThis destructuring navigator", "globalThis destructuring localStorage"
    ]) {
      expect(positive.forbiddenAuthorities.some((entry) => entry.includes(authority))).toBe(true);
    }
    for (const scopedName of ["Date", "window", "document", "performance", "setTimeout"]) {
      expect(positive.forbiddenAuthorities.filter((entry) => entry.endsWith(`: ${scopedName}`))).toHaveLength(1);
    }

    const negative = scanSyntheticAuthoritySource(`
      const safe = {
        Date: class LocalDate {},
        window: { location: "local" },
        document: "metadata",
        performance: 1,
        Math: { random: () => 0.5 }
      };
      interface SafeShape {
        window: string;
        readonly document: string;
        Date(): void;
        setTimeout(delay: number): void;
      }
      type SafeRecord = {
        performance: number;
        navigator(): string;
      };
      type SafeTuple = [localStorage: string];
      enum SafeEnum { crypto }
      class SafeNames {
        sessionStorage = "local";
        get requestAnimationFrame() { return 1; }
        set requestAnimationFrame(value: number) { void value; }
        cancelAnimationFrame() { return 1; }
      }
      const safeMethods = {
        window() { return "local"; },
        get document() { return "local"; },
        set document(value: string) { void value; }
      };
      void (0 as unknown as SafeShape);
      void (0 as unknown as SafeRecord);
      void (0 as unknown as SafeTuple);
      void SafeEnum;
      void SafeNames;
      void safeMethods;
      const { Date, window, document, performance } = safe;
      Date;
      window.location;
      document;
      performance;
      safe.Date;
      safe.window;
      safe.document;
      safe.performance;
      safe.Math.random();
      function usesFunctionScopedShadow() {
        if (safe.performance > 0) {
          var Date = safe.Date;
        }
        return Date;
      }
      function usesParameterShadow(window: { location: string }) {
        return window.location;
      }
      try {
        throw safe;
      } catch (window) {
        window.location;
      }
      for (const Date of [safe.Date]) {
        void Date;
      }
      for (const document in safe) {
        void document;
      }
      for (let performance = 0; performance < 1; performance += 1) {
        void performance;
      }
      void usesFunctionScopedShadow;
      void usesParameterShadow;
    `);
    expect(negative.forbiddenImports).toEqual([]);
    expect(negative.forbiddenAuthorities).toEqual([]);
  });
});
