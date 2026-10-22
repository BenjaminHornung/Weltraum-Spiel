import manifestBytes from "../../../public/factory/crashsite-walkable-v1-2026-10-19/manifest.json?raw";

// This leaf is reached only by the explicit V6 Hull loader. Keep the payload
// out of the module graph: only the small hash-pinned metadata sidecar is raw.
export const HULL_MANIFEST_BYTES = manifestBytes;
export const HULL_MANIFEST_BYTE_LENGTH = 6775;
export const HULL_MANIFEST_SHA256 = "f5017bad6abf8d0ae2407d7a0f837c9fe2a4a9a876858d1f063296e14dba65a8";
export const HULL_MANIFEST_UTF16_BYTES = 13550;
export const HULL_MANIFEST_PARSED_UTF16_BYTES = 9366;
export const HULL_MANIFEST_PARSED_GRAPH_BYTES = 6112;

export interface HullNativePartPin {
  readonly vertexBytes: number;
  readonly indexBytes: number;
  readonly verticesSha256: string;
  readonly indicesSha256: string;
}

export interface HullPartMetadata {
  readonly partId: string;
  readonly vertices: number;
  readonly indices: number;
  readonly primitives: number;
  readonly maxPositionAccessor: number;
  readonly maxIndexAccessor: number;
  readonly native: HullNativePartPin;
}

export interface HullMaterialMetadata {
  readonly name: string;
  readonly color: readonly [number, number, number, 1];
}

export interface HullProjectionCosts {
  readonly sourceBytes:number;readonly sourceSha256CopyBytes:number;readonly jsonUtf16Bytes:number;readonly jsonGraphBytes:number;
  readonly renderScratchBytes:number;readonly renderArtifactBytes:number;readonly stagedRenderArtifactBytes:number;
  readonly nativeSectorBytes:number;readonly nativeHashCopyPeakBytes:number;
}

export interface HullMetadataCosts {
  readonly sidecarUtf8Bytes:number;readonly sidecarHashCopyBytes:number;readonly sidecarRawUtf16Bytes:number;
  readonly sidecarParsedUtf16Bytes:number;readonly sidecarParsedGraphBytes:number;
}

export interface HullManifest {
  readonly schema: "hestia.factory.closed-hull/v1";
  readonly assetId: "hestia_crashsite_walkable_v1";
  readonly assetRevision: 1;
  readonly runtimeGlb: Readonly<{url:string;bytes:number;sha256:string}>;
  readonly source: Readonly<{
    sourceAssetId:string;sourceGlb:string;sourceGlbSha256:string;authoringBlend:string;authoringBlendSha256:string;
    builder:string;builderSha256:string;provenance:string;provenanceSha256:string;license:string;licenseFile:string;
    licenseFileSha256:string;referenceSha256:string;runtimeCensus:string;runtimeCensusSha256:string;
    walkabilityValidation:string;walkabilityValidationSha256:string;modelSpec:string;modelSpecSha256:string;
  }>;
  readonly frame: "fp02_east_north_height_xyz_v1";
  readonly metersPerUnit: 1;
  readonly anchorMeters: readonly [6.5, 1.5, 7.5];
  readonly boundsM: Readonly<{min:readonly [-7.875,0,-2.75];max:readonly [7.25,5.5,5.375]}>;
  readonly sceneExtras: Readonly<Record<string,string|number|boolean>>;
  readonly nodeExtras: Readonly<Record<string,string|number|boolean>>;
  readonly parts: readonly HullPartMetadata[];
  readonly palette: readonly HullMaterialMetadata[];
  readonly census: Readonly<{
    jsonChunkBytes:number;jsonUtf16Bytes:number;jsonGraphBytes:number;vertices:number;indices:number;primitives:number;
    renderPaletteBytes:number;renderVertexColorBytes:number;nativeVertexIndexBytes:number;nativeCollisionDigest:string;
  }>;
  readonly costs:HullProjectionCosts;
}
