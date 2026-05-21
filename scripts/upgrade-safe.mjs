#!/usr/bin/env node
/**
 * Supply-chain-aware upgrader.
 *
 * Runs `npm update --before "<N days ago>"` so freshly-published versions
 * (the window where compromised releases tend to be caught and pulled)
 * are skipped. Default window is 7 days; override with UPGRADE_DELAY_DAYS.
 */
import { execSync } from 'node:child_process';

const days = parseInt(process.env.UPGRADE_DELAY_DAYS || '7', 10);
if (!Number.isFinite(days) || days < 0) {
  console.error(
    `UPGRADE_DELAY_DAYS must be a non-negative integer (got: ${process.env.UPGRADE_DELAY_DAYS})`,
  );
  process.exit(1);
}

const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const iso = cutoff.toISOString().slice(0, 10);

console.log(`Upgrading to packages published on or before ${iso} (${days} days ago).`);
console.log('Override the window with UPGRADE_DELAY_DAYS=<n>.');
console.log('');

execSync(`npm update --before "${iso}"`, { stdio: 'inherit' });

console.log('');
console.log('Run `npm audit` and `npm audit signatures` to verify.');
