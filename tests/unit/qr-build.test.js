import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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

function generateQr(outputPath, injectedUrl) {
  return spawnSync(
    process.execPath,
    ['scripts/generate-share-qr.mjs'],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        GIFT_PUBLIC_URL: injectedUrl,
        QR_OUTPUT_PATH: outputPath,
      },
    },
  );
}

test('share QR generation only uses the clean Birthday target from site.json', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'birthday-qr-'));
  try {
    const outputPath = join(fixtureRoot, 'share-qr.svg');
    const safeRun = generateQr(
      outputPath,
      'https://example.com/gift/?to=PrivateName',
    );
    assert.equal(safeRun.status, 0, `${safeRun.stdout}\n${safeRun.stderr}`);
    const svg = readFileSync(outputPath, 'utf8');
    const publicUrl = 'https://thiep-cho-em.vercel.app/birthday/';
    const digest = createHash('sha256').update(publicUrl).digest('hex');
    assert.match(svg, /<svg/);
    assert.match(svg, new RegExp(`gift-public-url-sha256:${digest}`));
    assert.match(safeRun.stdout, new RegExp(publicUrl.replaceAll('/', '\\/')));
    assert.doesNotMatch(svg, /PrivateName|example\.com|Thuy Hien|Yours Truly/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
