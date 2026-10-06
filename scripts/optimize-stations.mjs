/**
 * Builds the web versions of the station hulls (raw Higgsfield / Tripo
 * image-to-3D exports, ~480k triangles with 4096px textures) in two levels:
 *
 *   hd/  desktop: ~190k triangles, 2048px textures
 *   sd/  phones and touch devices: ~60k triangles, 1024px textures
 *
 * Geometry is simplified within a small error bound and meshopt-compressed
 * (its decoder ships with three-stdlib, so nothing is fetched from a CDN).
 * Textures become KTX2 so they stay compressed on the GPU: ETC1S for colour
 * and occlusion/roughness/metalness, UASTC (+ Zstandard) for normal maps,
 * which carry the panel detail and band badly in ETC1S. The browser
 * transcodes them with the Basis transcoder in public/static/basis.
 *
 * Usage:  node scripts/optimize-stations.mjs <raw-dir> [out-dir]
 *   raw-dir holds one GLB per station, named after its key (home.glb, …)
 *   out-dir defaults to public/static/models/stations
 */
import { mkdirSync, readdirSync, statSync } from 'fs';
import path from 'path';

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import {
  dedup,
  meshopt,
  prune,
  reorder,
  simplify,
  textureCompress,
  weld,
} from '@gltf-transform/functions';
import { ktx2 } from 'ktx2-encoder/gltf-transform';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const root = new URL('..', import.meta.url).pathname;
const [rawDir, outDir = path.join(root, 'public/static/models/stations')] = process.argv.slice(2);

if (!rawDir) {
  console.error('Usage: node scripts/optimize-stations.mjs <raw-dir> [out-dir]');
  process.exit(1);
}

const levels = {
  hd: { size: 2048, ratio: 0.4, error: 0.0006 },
  sd: { size: 1024, ratio: 0.12, error: 0.002 },
};

const etc1s = { isUASTC: false, qualityLevel: 230, compressionLevel: 2, generateMipmap: true };
const linear = { isInputSRGB: false, isSetKTX2SRGBTransferFunc: false, isPerceptual: false };

const imageDecoder = async (buffer) => {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
};

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const kb = (file) => `${(statSync(file).size / 1024).toFixed(0)} KB`;

for (const name of readdirSync(rawDir).filter((f) => f.endsWith('.glb'))) {
  for (const [level, { size, ratio, error }] of Object.entries(levels)) {
    const input = path.join(rawDir, name);
    const output = path.join(outDir, level, name);
    mkdirSync(path.dirname(output), { recursive: true });

    const document = await io.read(input);
    await document.transform(
      dedup(),
      weld(),
      simplify({ simplifier: MeshoptSimplifier, ratio, error }),
      // Resize losslessly first: the Basis encoder wants clean source pixels
      textureCompress({ encoder: sharp, targetFormat: 'png', resize: [size, size] }),
      // Colour: sRGB
      ktx2({
        ...etc1s,
        slots: /^(baseColorTexture|emissiveTexture)$/,
        imageDecoder,
      }),
      // Occlusion / roughness / metalness: linear data
      ktx2({
        ...etc1s,
        ...linear,
        slots: /^(metallicRoughnessTexture|occlusionTexture)$/,
        imageDecoder,
      }),
      ktx2({
        ...linear,
        isUASTC: true,
        isNormalMap: true,
        needSupercompression: true,
        // Rate-distortion optimisation: near-identical output, compresses far better
        enableRDO: true,
        rdoQualityLevel: 1.25,
        generateMipmap: true,
        slots: /^normalTexture$/,
        imageDecoder,
      }),
      prune(),
      reorder({ encoder: MeshoptEncoder }),
      meshopt({ encoder: MeshoptEncoder, level: 'high' })
    );
    document.createExtension(EXTMeshoptCompression).setRequired(true);
    await io.write(output, document);
    console.log(`${level}/${name}: ${kb(input)} → ${kb(output)}`);
  }
}
