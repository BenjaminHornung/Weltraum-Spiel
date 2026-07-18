import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import * as ts from "typescript/unstable/ast";
import { API as TypeScriptAPI } from "typescript/unstable/sync";
import { describe, expect, it } from "vitest";
import { surfaceFrameId, voxelBodyId, voxelRegionId } from "../../src/voxel";
import {
  createHestiaGenerationKey,
  deriveHestiaDomainSeed,
  fbm2,
  generateHestiaVoxelBrick,
  hashHestiaLattice,
  quinticFade,
  valueNoise2,
  valueNoise3,
  type HestiaGenerationInput
} from "../../src/world-generation/hestia";

const canonicalInput = (overrides: Partial<HestiaGenerationInput> = {}): HestiaGenerationInput => ({
  rootSeed: "hestia-fixture-alpha",
  bodyId: voxelBodyId("planet.hestia"),
  surfaceFrameId: surfaceFrameId("frame:surface.hestia"),
  regionId: voxelRegionId("region:hestia.preview"),
  brickCoordinate: { x: 0, y: 0, z: 0 },
  voxelSizeMeters: 0.5,
  ...overrides
});

const HESTIA_V1_MODULES = Object.freeze([
  "densityGenerator.ts",
  "index.ts",
  "materialClassifier.ts",
  "noise.ts",
  "preset.ts",
  "scatterGenerator.ts",
  "seed.ts"
]);

const unwrapExpression = (expression: ts.Expression): ts.Expression => {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current)
    || ts.isAsExpression(current)
    || ts.isTypeAssertion(current)
    || ts.isSatisfiesExpression(current)
    || ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
};

const expressionPath = (expression: ts.Expression): string | undefined => {
  const current = unwrapExpression(expression);
  if (ts.isIdentifier(current)) return current.text;
  if (ts.isPropertyAccessExpression(current)) {
    const owner = expressionPath(current.expression);
    return owner === undefined ? undefined : `${owner}.${current.name.text}`;
  }
  if (ts.isElementAccessExpression(current) && current.argumentExpression !== undefined) {
    const owner = expressionPath(current.expression);
    const key = unwrapExpression(current.argumentExpression);
    return owner !== undefined && ts.isStringLiteralLikeNode(key) ? `${owner}.${key.text}` : undefined;
  }
  return undefined;
};

const moduleSpecifierText = (node: ts.Node): string | undefined => {
  if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier !== undefined) {
    return ts.isStringLiteralLikeNode(node.moduleSpecifier) ? node.moduleSpecifier.text : undefined;
  }
  if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
    const expression = node.moduleReference.expression;
    return expression !== undefined && ts.isStringLiteralLikeNode(expression) ? expression.text : undefined;
  }
  if (ts.isImportTypeNode(node)) {
    const argument = node.argument;
    return ts.isLiteralTypeNode(argument) && ts.isStringLiteralLikeNode(argument.literal)
      ? argument.literal.text
      : undefined;
  }
  return undefined;
};

const mutableSingletonInitializer = (expression: ts.Expression): boolean => {
  const current = unwrapExpression(expression);
  return ts.isArrayLiteralExpression(current)
    || ts.isObjectLiteralExpression(current)
    || ts.isNewExpression(current);
};

const scanHestiaModule = (
  moduleName: string,
  sourceFile: ts.SourceFile,
  allowedDependencies: ReadonlySet<string>
): readonly string[] => {
  const findings: string[] = [];
  const report = (node: ts.Node, message: string): void => {
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    findings.push(`${moduleName}:${position.line + 1}:${position.character + 1} ${message}`);
  };
  const inspectDependency = (node: ts.Node, dependency: string | undefined, kind: string): void => {
    if (dependency === undefined) {
      report(node, `${kind} must use a static string module specifier`);
    } else if (!allowedDependencies.has(dependency)) {
      report(node, `${kind} has forbidden dependency ${dependency}`);
    }
  };

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const isConst = (statement.declarationList.flags & ts.NodeFlags.Const) !== 0;
    if (!isConst) report(statement, "must not declare mutable top-level let/var state");
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.initializer !== undefined && mutableSingletonInitializer(declaration.initializer)) {
        report(declaration, "must not own mutable top-level singleton state");
      }
    }
  }

  const visit = (node: ts.Node): void => {
    if (
      ts.isImportDeclaration(node)
      || (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined)
      || ts.isImportEqualsDeclaration(node)
      || ts.isImportTypeNode(node)
    ) {
      inspectDependency(node, moduleSpecifierText(node), "module declaration");
    }

    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const argument = node.arguments[0];
        inspectDependency(
          node,
          argument !== undefined && ts.isStringLiteralLikeNode(argument) ? argument.text : undefined,
          "dynamic import"
        );
      } else if (ts.isIdentifier(node.expression) && node.expression.text === "require") {
        const argument = node.arguments[0];
        inspectDependency(
          node,
          argument !== undefined && ts.isStringLiteralLikeNode(argument) ? argument.text : undefined,
          "require"
        );
      }

      const path = expressionPath(node.expression)?.toLowerCase();
      if (path === "date" || path?.endsWith(".date")) report(node, "must not call Date()");
    } else if (ts.isNewExpression(node)) {
      const path = expressionPath(node.expression)?.toLowerCase();
      if (path === "date" || path?.endsWith(".date")) report(node, "must not construct Date");
    }

    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const path = expressionPath(node)?.toLowerCase();
      if (path?.endsWith("math.random")) report(node, "must not access Math.random");
      if (path?.endsWith("date.now")) report(node, "must not access Date.now");
      if (path?.endsWith("performance.now")) report(node, "must not access performance.now");
      if (path?.endsWith("crypto.getrandomvalues") || path?.endsWith("crypto.randomuuid")) {
        report(node, "must not access crypto random APIs");
      }
    }

    if (ts.isIdentifier(node)) {
      const normalized = node.text.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
      if (normalized.includes("camera") || normalized.includes("floatingorigin") || normalized.includes("loadorder")) {
        report(node, `must not expose runtime ownership input ${node.text}`);
      }
      if ([
        "window",
        "document",
        "htmlelement",
        "nodelist",
        "mutationobserver",
        "resizeobserver",
        "requestanimationframe",
        "cancelanimationframe",
        "three"
      ].includes(normalized)) {
        report(node, `must not depend on renderer/DOM global ${node.text}`);
      }
    }

    node.forEachChild(visit);
  };
  visit(sourceFile);
  return findings;
};

describe("Hestia V1 seed and byte determinism", () => {
  it("pins FNV-1a32 domain separation, safe high-word lattice mixing, and noise helpers", () => {
    const source = canonicalInput();
    const macroSeed = deriveHestiaDomainSeed(source, "macro-elevation");
    const rockSeed = deriveHestiaDomainSeed(source, "rock-breakup");
    const vectors = {
      macroSeed,
      rockSeed,
      lattice: hashHestiaLattice(macroSeed, -1, 0x1_0000_0001),
      noise2: valueNoise2(macroSeed, 1.25, -2.75),
      noise3: valueNoise3(rockSeed, -0.5, 2.25, 4.75),
      fbm2: fbm2(macroSeed, 0.125, -0.875, 4),
      fadeQuarter: quinticFade(0.25)
    };
    expect(vectors).toEqual({
      macroSeed: 1161633489,
      rockSeed: 3438350283,
      lattice: 735284689,
      noise2: -0.19953450047603027,
      noise3: 0.6146136134701656,
      fbm2: -0.18095702931682447,
      fadeQuarter: 0.103515625
    });
    expect(hashHestiaLattice(macroSeed, 1)).not.toBe(hashHestiaLattice(macroSeed, 0x1_0000_0001));
  });

  it("produces byte-identical channels and hashes for the same canonical input", { timeout: 15_000 }, () => {
    const first = generateHestiaVoxelBrick(canonicalInput());
    const second = generateHestiaVoxelBrick(canonicalInput());
    expect(first.contentHash).toBe(second.contentHash);
    expect(new Uint8Array(first.densityBuffer.buffer)).toEqual(new Uint8Array(second.densityBuffer.buffer));
    expect(first.materialBuffer).toEqual(second.materialBuffer);
  });

  it("changes canonical output when the root seed changes", { timeout: 10_000 }, () => {
    const first = generateHestiaVoxelBrick(canonicalInput());
    const changed = generateHestiaVoxelBrick(canonicalInput({ rootSeed: "hestia-fixture-beta" }));
    expect(changed.contentHash).not.toBe(first.contentHash);
    expect(changed.densityBuffer).not.toEqual(first.densityBuffer);
  });

  it("separates 0.25 and 0.50 metre generation keys, hashes, and physical extents", { timeout: 10_000 }, () => {
    const halfInput = canonicalInput();
    const quarterInput = canonicalInput({ voxelSizeMeters: 0.25 });
    const half = generateHestiaVoxelBrick(halfInput);
    const quarter = generateHestiaVoxelBrick(quarterInput);
    expect(createHestiaGenerationKey(halfInput)).not.toBe(createHestiaGenerationKey(quarterInput));
    expect(half.contentHash).not.toBe(quarter.contentHash);
    expect(half.cellDimensions.x * half.voxelSizeMeters).toBe(16);
    expect(half.cellDimensions.y * half.voxelSizeMeters).toBe(32);
    expect(half.cellDimensions.z * half.voxelSizeMeters).toBe(16);
    expect(quarter.cellDimensions.x * quarter.voxelSizeMeters).toBe(8);
    expect(quarter.cellDimensions.y * quarter.voxelSizeMeters).toBe(16);
    expect(quarter.cellDimensions.z * quarter.voxelSizeMeters).toBe(8);
  });

  it("pins a canonical generator content hash as a V1 drift guard", () => {
    const brick = generateHestiaVoxelBrick(canonicalInput());
    // Canonical VoxelBrick V1 drift guard for the complete generator pipeline.
    expect(brick.contentHash).toBe("fnv1a64:12d868170450df55");
  });

  it("keeps the exact seven-module Hestia V1 boundary deterministic and owner-neutral", { timeout: 10_000 }, () => {
    const directory = resolve(process.cwd(), "src", "world-generation", "hestia");
    const configFilePath = resolve(process.cwd(), "tsconfig.json");
    const actualModules = readdirSync(directory).filter((file) => file.endsWith(".ts")).sort();
    expect(actualModules).toEqual([...HESTIA_V1_MODULES].sort());
    const allowedDependencies = new Set([
      ...HESTIA_V1_MODULES.map((moduleName) => `./${moduleName.slice(0, -3)}`),
      "../../core/hash",
      "../../voxel"
    ]);
    const findings: string[] = [];
    const api = new TypeScriptAPI({ cwd: process.cwd() });
    try {
      const snapshot = api.updateSnapshot({ openProjects: [configFilePath] });
      try {
        const project = snapshot.getProject(configFilePath);
        if (project === undefined) {
          throw new Error(`TypeScript project snapshot is missing ${configFilePath}`);
        }
        for (const moduleName of HESTIA_V1_MODULES) {
          const filePath = join(directory, moduleName);
          const sourceFile = project.program.getSourceFile(filePath);
          if (sourceFile === undefined) {
            throw new Error(`TypeScript project snapshot is missing source file ${filePath}`);
          }
          findings.push(...scanHestiaModule(moduleName, sourceFile, allowedDependencies));
        }
      } finally {
        snapshot.dispose();
      }
    } finally {
      api.close();
    }
    expect(findings).toEqual([]);
  });

  it("fails closed for invalid seeds, IDs, brick coordinates, and unsupported voxel sizes", () => {
    for (const rootSeed of ["", "contains space", "ümlaut", "x".repeat(129)]) {
      expect(() => generateHestiaVoxelBrick(canonicalInput({ rootSeed }))).toThrow(TypeError);
    }
    for (const voxelSizeMeters of [0.1, 0.3, 1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => generateHestiaVoxelBrick(canonicalInput({
        voxelSizeMeters: voxelSizeMeters as HestiaGenerationInput["voxelSizeMeters"]
      }))).toThrow(RangeError);
    }
    for (const coordinate of [-0, 0.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => generateHestiaVoxelBrick(canonicalInput({
        brickCoordinate: { x: coordinate, y: 0, z: 0 }
      }))).toThrow(RangeError);
    }
    expect(() => generateHestiaVoxelBrick(canonicalInput({
      bodyId: "Planet.Hestia" as HestiaGenerationInput["bodyId"]
    }))).toThrow(TypeError);
  });
});
