import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_BYTES = 1024 * 1024;
const MAX_DIMENSION = 1024;

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function abort(message: string): never {
  console.error(`entry check failed: ${message}`);
  process.exit(1);
}

function readPng(path: string): Buffer {
  if (!existsSync(path)) {
    abort(`source image not found at ${path}`);
  }
  if (!statSync(path).isFile()) {
    abort(`source image is not a regular file: ${path}`);
  }
  const bytes = readFileSync(path);
  if (bytes.length < 1 || bytes.length > MAX_BYTES) {
    abort(`source image is ${bytes.length} bytes, outside the 1..${MAX_BYTES}-byte limit`);
  }
  if (bytes.length < PNG_SIGNATURE.length || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    abort(`source image does not start with the 8-byte PNG signature`);
  }
  if (bytes.length < 33) {
    abort(`source image is only ${bytes.length} bytes, too short to hold a complete PNG IHDR chunk (33 bytes minimum)`);
  }
  if (bytes.toString("ascii", 12, 16) !== "IHDR") {
    abort(`source image does not begin with an IHDR chunk (found "${bytes.toString("ascii", 12, 16)}")`);
  }
  const ihdrLength = bytes.readUInt32BE(8);
  if (ihdrLength !== 13) {
    abort(`source image has a malformed IHDR chunk: declared data length ${ihdrLength}, expected 13`);
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width < 1 || width > MAX_DIMENSION || height < 1 || height > MAX_DIMENSION) {
    abort(`source image is ${width}x${height} px, outside the 1..${MAX_DIMENSION} px limit on each side`);
  }
  return bytes;
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(scriptDir, "entry.png");
const sourceBytes = readPng(sourcePath);

const outputDir = process.env.MAKEFUN_OUTPUT_DIR
  ? resolve(process.env.MAKEFUN_OUTPUT_DIR)
  : "/output";
mkdirSync(outputDir, { recursive: true });
const outputPath = join(outputDir, "entry.png");
writeFileSync(outputPath, sourceBytes);

const written = readFileSync(outputPath);
if (!written.equals(sourceBytes)) {
  abort(`output ${outputPath} (${written.length} bytes) does not match the source (${sourceBytes.length} bytes)`);
}

console.log(`source: ${sourcePath} (${sourceBytes.length} bytes)`);
console.log(`output: ${outputPath} (${written.length} bytes)`);
console.log(`sha256: ${sha256(sourceBytes)}`);
