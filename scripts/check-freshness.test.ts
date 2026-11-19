// Run with: pnpm exec vitest run scripts/check-freshness.test.ts
import assert from 'node:assert/strict';
import { it } from 'vitest';
import {
  checkItems,
  engineFloor,
  formatReport,
  newestEligible,
  nodeFloorResult,
  parseList,
  parseVersion,
  readPin,
  type FetchJson,
  type FreshnessList,
} from './check-freshness';

const NOW = Date.parse('2026-11-15T12:00:00Z');
const daysAgo = (days: number): string => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();

it('a stable version is read from a version or a tag; pre-releases are not versions', () => {
  assert.deepEqual(parseVersion('v8.30.1'), [8, 30, 1]);
  assert.deepEqual(parseVersion('rust-v1.2.3'), [1, 2, 3]);
  assert.deepEqual(parseVersion('12.21.0'), [12, 21, 0]);
  assert.equal(parseVersion('2.0.0-rc.1'), undefined);
  assert.equal(parseVersion('nightly'), undefined);
  assert.equal(parseVersion(undefined), undefined);
});

it('the newest eligible release skips releases younger than the release age', () => {
  const releases = [
    { publishedAt: daysAgo(30), version: 'v1.9.0' },
    { publishedAt: daysAgo(8), version: 'v1.10.0' },
    { publishedAt: daysAgo(2), version: 'v1.11.0' },
    { publishedAt: daysAgo(20), version: 'v2.0.0-beta.1' },
  ];
  assert.deepEqual(newestEligible(releases, { minAgeDays: 7, nowMs: NOW }), [1, 10, 0]);
  assert.deepEqual(newestEligible(releases, { minAgeDays: 0, nowMs: NOW }), [1, 11, 0]);
  assert.equal(newestEligible(releases, { minAgeDays: 60, nowMs: NOW }), undefined);
});

it('a pin is read through the first capture group, and a lost pattern reads as undefined', () => {
  const workflow = 'env:\n  GITLEAKS_VERSION: "8.30.1"\n  GITLEAKS_SHA256: abc\n';
  assert.deepEqual(readPin(workflow, 'GITLEAKS_VERSION:[ "]*([0-9.]+)'), [8, 30, 1]);
  assert.equal(readPin(workflow, 'ACTIONLINT_VERSION:[ "]*([0-9.]+)'), undefined);
  assert.deepEqual(readPin('{ "packageManager": "pnpm@12.14.0" }', '"packageManager": "pnpm@([0-9.]+)"'), [12, 14, 0]);
});

it('the engines floor is the first full version of the range', () => {
  assert.deepEqual(engineFloor('^26.12.1'), [26, 12, 1]);
  assert.deepEqual(engineFloor('>=26.13.1 <27'), [26, 13, 1]);
  assert.equal(engineFloor('>=26'), undefined);
});

const NODE_INDEX = [
  { security: false, version: 'v27.0.0' },
  { security: true, version: 'v26.13.1' },
  { security: false, version: 'v26.13.0' },
  { security: true, version: 'v26.12.1' },
  { security: true, version: 'v24.22.1' },
];

it('a floor below the newest security release of the .nvmrc line is outdated', () => {
  const result = nodeFloorResult({ engines: '^26.12.1', index: NODE_INDEX, nvmrc: '26\n' });
  assert.equal(result.status, 'outdated');
  assert.match(result.text, /set engines.node to \^26\.13\.1 /);
});

it('the suggested range keeps the operator the project uses', () => {
  const result = nodeFloorResult({ engines: '>=26.12.1', index: NODE_INDEX, nvmrc: '26' });
  assert.match(result.text, /set engines.node to >=26\.13\.1 /);
});

it('a floor at the newest security release, or a line without one, is current', () => {
  assert.equal(nodeFloorResult({ engines: '^26.13.1', index: NODE_INDEX, nvmrc: '26' }).status, 'ok');
  assert.equal(nodeFloorResult({ engines: '^28.0.0', index: NODE_INDEX, nvmrc: 'v28' }).status, 'ok');
});

it('a floor that cannot be read is reported, not passed', () => {
  assert.equal(nodeFloorResult({ engines: '^26.13.1', index: NODE_INDEX, nvmrc: 'lts/*' }).status, 'unreadable');
  assert.equal(nodeFloorResult({ engines: '>=26', index: NODE_INDEX, nvmrc: '26' }).status, 'unreadable');
});

const LIST = {
  items: [
    { mechanism: 'dependabot', name: 'npm dependencies', where: 'npm, /' },
    { mechanism: 'check-latest', name: 'Node patch', where: '.nvmrc line, setup-node check-latest' },
    { check: { nodeFloor: true }, mechanism: 'job', name: 'Node floor' },
    {
      check: { file: 'package.json', npm: 'pnpm', pattern: '"packageManager": "pnpm@([0-9.]+)"' },
      howToBump: 'set packageManager to the new version and run pnpm install',
      mechanism: 'job',
      name: 'pnpm',
    },
    {
      check: { file: '.github/workflows/security.yml', github: 'gitleaks/gitleaks', pattern: 'GITLEAKS_VERSION:[ "]*([0-9.]+)' },
      howToBump: 'update GITLEAKS_VERSION and GITLEAKS_SHA256',
      mechanism: 'job',
      name: 'gitleaks',
    },
    {
      check: { file: '.github/zizmor-requirements.txt', pattern: 'zizmor==([0-9.]+)', pypi: 'zizmor' },
      howToBump: 'update the version and the hashes in the requirements line',
      mechanism: 'job',
      name: 'zizmor',
    },
  ],
  minimumReleaseAgeDays: 7,
};

it('a valid list parses; every item needs a mechanism and every non-job item says where', () => {
  assert.equal(parseList(LIST).ok, true);
  const broken = parseList({
    items: [
      { mechanism: 'renovate', name: 'a' },
      { mechanism: 'dependabot', name: 'b' },
      { check: { file: 'x', pattern: '(1)' }, mechanism: 'job', name: 'c' },
      { check: { file: 'x', npm: 'd', pattern: '(1)' }, mechanism: 'job', name: 'd' },
    ],
  });
  assert.equal(broken.ok, false);
  assert.deepEqual(broken.error, [
    'a: mechanism must be one of dependabot, check-latest, job, manual',
    'a: where must say which configuration keeps it current',
    'b: where must say which configuration keeps it current',
    'c: a job check needs nodeFloor: true, or file, pattern and one of github, npm or pypi',
    'c: howToBump is missing',
    'd: howToBump is missing',
  ]);
  assert.equal(parseList({ items: [] }).ok, false);
});

const FILES: Record<string, string> = {
  '.github/workflows/security.yml': 'env:\n  GITLEAKS_VERSION: 8.30.1\n',
  '.github/zizmor-requirements.txt': 'zizmor==1.30.0 --hash=sha256:abc\n',
  '.nvmrc': '26\n',
  'package.json': JSON.stringify({ engines: { node: '^26.13.1' }, packageManager: 'pnpm@12.14.0' }, null, 2),
};
const RESPONSES: Record<string, unknown> = {
  'https://api.github.com/repos/gitleaks/gitleaks/releases?per_page=100': [
    { draft: false, prerelease: false, published_at: daysAgo(50), tag_name: 'v8.30.1' },
    { draft: false, prerelease: false, published_at: daysAgo(3), tag_name: 'v8.31.0' },
  ],
  'https://nodejs.org/dist/index.json': NODE_INDEX,
  'https://pypi.org/pypi/zizmor/json': {
    releases: {
      '1.30.0': [{ upload_time_iso_8601: daysAgo(60) }],
      '1.31.0': [{ upload_time_iso_8601: daysAgo(20) }],
      '1.32.0': [{ upload_time_iso_8601: daysAgo(15), yanked: true }],
      '1.33.0': [],
    },
  },
  'https://registry.npmjs.org/pnpm': {
    time: { '12.14.0': daysAgo(40), '12.21.0': daysAgo(10), '13.0.0': daysAgo(1) },
    versions: { '12.14.0': {}, '12.21.0': {}, '13.0.0': {} },
  },
};

const readFixture = (file: string): string => {
  const content = FILES[file];
  if (content === undefined) throw Object.assign(new Error(`ENOENT: ${file}`), { code: 'ENOENT' });
  return content;
};
const fetchFixture: FetchJson = async (url, schema) => schema.parse(await Promise.resolve(RESPONSES[url]));
const parsedList = (): FreshnessList => {
  const list = parseList(LIST);
  if (!list.ok) throw new Error(list.error.join('; '));
  return list.value;
};

it('only job items are checked, with the release age applied to pins', async () => {
  const results = await checkItems({
    fetchJson: fetchFixture,
    list: parsedList(),
    nowMs: NOW,
    readText: readFixture,
  });
  assert.deepEqual(
    results.map(({ name, status }) => [name, status]),
    [
      ['Node floor', 'ok'],
      ['pnpm', 'outdated'],
      ['gitleaks', 'ok'],
      ['zizmor', 'outdated'],
    ],
  );
  assert.match(results[3]?.text ?? '', /pinned 1\.30\.0, latest 1\.31\.0/);
  assert.match(results[1]?.text ?? '', /pinned 12\.14\.0, latest 12\.21\.0: set packageManager/);
});

it('the Node floor reads .node-version when the repository has no .nvmrc', async () => {
  const results = await checkItems({
    fetchJson: fetchFixture,
    list: parsedList(),
    nowMs: NOW,
    readText: (file) => readFixture(file === '.node-version' ? '.nvmrc' : file === '.nvmrc' ? '.missing' : file),
  });
  assert.equal(results[0]?.status, 'ok');
});

it('the report fails on any item that is not current and names it', () => {
  const report = formatReport([
    { name: 'gitleaks', status: 'ok', text: 'pinned 8.30.1, latest 8.30.1' },
    { name: 'pnpm', status: 'outdated', text: 'pinned 12.14.0, latest 12.21.0: bump' },
  ]);
  assert.equal(report.exitCode, 1);
  assert.equal(report.text, 'gitleaks: pinned 8.30.1, latest 8.30.1\npnpm: OUTDATED, pinned 12.14.0, latest 12.21.0: bump\n');
  assert.equal(formatReport([{ name: 'x', status: 'ok', text: 'fine' }]).exitCode, 0);
});

it('a network failure propagates so the caller exits with 2', async () => {
  await assert.rejects(
    checkItems({
      fetchJson: async () => {
        await Promise.resolve();
        throw new Error('503 from api');
      },
      list: parsedList(),
      nowMs: NOW,
      readText: readFixture,
    }),
    /503/,
  );
});

it('pre-releases without a hyphen (PyPI rc, alpha, beta) are not stable', () => {
  assert.equal(parseVersion('1.33.0rc1'), undefined);
  assert.equal(parseVersion('2.0.0b2'), undefined);
  assert.equal(parseVersion('1.32.0')?.join('.'), '1.32.0');
});

it('the floor of a range is its lowest lower bound, whatever the order', () => {
  assert.equal(engineFloor('<27.0.0 >=26.12.1')?.join('.'), '26.12.1');
  assert.equal(engineFloor('>= 26.12.1 < 27')?.join('.'), '26.12.1');
  assert.equal(engineFloor('>=26.13.1 >=26.12.1')?.join('.'), '26.13.1');
  assert.equal(engineFloor('26.12.1 - 26.14.0')?.join('.'), '26.12.1');
  assert.equal(engineFloor('^24.12.0 || ^26.12.1')?.join('.'), '24.12.0');
  assert.equal(engineFloor('26'), undefined);
});
