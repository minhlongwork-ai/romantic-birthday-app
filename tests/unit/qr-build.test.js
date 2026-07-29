import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));

function generateQr(outputPath, publicUrl) {
  return spawnSync(
    process.execPath,
    ['scripts/generate-share-qr.mjs'],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        GIFT_PUBLIC_URL: publicUrl,
        QR_OUTPUT_PATH: outputPath,
      },
    },
  );
}

test('share QR generation rejects personalized URLs and emits a generic SVG', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'birthday-qr-'));
  try {
    const outputPath = join(fixtureRoot, 'share-qr.svg');
    const unsafeRun = generateQr(
      outputPath,
      'https://example.com/gift/?to=PrivateName',
    );
    assert.equal(unsafeRun.status, 1);
    assert.match(unsafeRun.stderr, /cannot contain.*query parameters/i);

    const safeRun = generateQr(outputPath, 'https://example.com/gift/');
    assert.equal(safeRun.status, 0, `${safeRun.stdout}\n${safeRun.stderr}`);
    const svg = readFileSync(outputPath, 'utf8');
    assert.match(svg, /<svg/);
    assert.match(svg, /gift-public-url-sha256:[a-f0-9]{64}/);
    assert.doesNotMatch(svg, /PrivateName|Thuy Hien|Yours Truly/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
