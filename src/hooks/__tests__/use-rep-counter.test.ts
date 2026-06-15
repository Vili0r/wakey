import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// 1. Read use-rep-counter.ts and replace React imports with a pure JS mock
const hookPath = path.join(import.meta.dirname, '../use-rep-counter.ts');
const mockHookPath = path.join(import.meta.dirname, './use-rep-counter-mocked.ts');

const hookContent = fs.readFileSync(hookPath, 'utf8');
const mockedContent = hookContent.replace(
  "import { useCallback, useRef } from 'react';",
  `
// Mock React hooks for pure JS testing
export let mockRefs: any[] = [];
export let mockRefIndex = 0;

export function resetMockHooks() {
  mockRefs = [];
  mockRefIndex = 0;
}

function useRef<T>(val: T) {
  const idx = mockRefIndex++;
  if (mockRefs[idx] === undefined) {
    mockRefs[idx] = { current: val };
  }
  return mockRefs[idx];
}

function useCallback<T extends Function>(fn: T, deps?: any[]): T {
  return fn;
}
`
);

fs.writeFileSync(mockHookPath, mockedContent, 'utf8');

// 2. Import the mocked hook and helpers dynamically
// @ts-ignore
const { useRepCounter, resetMockHooks } = await import('./use-rep-counter-mocked.ts');

test('useRepCounter - clean reps', () => {
  resetMockHooks();
  let repCount = 0;
  const { push } = useRepCounter({
    downThreshold: 100,
    upThreshold: 160,
    minIntervalMs: 0, // 0 for instant consecutive counting in tests
    onRep: (c: number) => {
      repCount = c;
    },
  });

  // Start standing (up phase)
  push(170);
  assert.strictEqual(repCount, 0);

  // Go down (knee bent)
  push(90);
  assert.strictEqual(repCount, 0);

  // Come back up (arms/legs extended) -> 1st rep
  push(170);
  assert.strictEqual(repCount, 1);

  // Go down again
  push(90);
  assert.strictEqual(repCount, 1);

  // Come back up again -> 2nd rep
  push(170);
  assert.strictEqual(repCount, 2);
});

test('useRepCounter - jitter around downThreshold', () => {
  resetMockHooks();
  let repCount = 0;
  const { push } = useRepCounter({
    downThreshold: 100,
    upThreshold: 160,
    minIntervalMs: 0,
    onRep: (c: number) => {
      repCount = c;
    },
  });

  push(170);
  
  // Oscillate around down threshold without crossing up threshold
  push(95);  // enters down phase
  push(105); // still in down phase
  push(95);  // still in down phase
  assert.strictEqual(repCount, 0);

  // Cross up threshold -> should count exactly 1 rep
  push(165);
  assert.strictEqual(repCount, 1);
});

test('useRepCounter - too-fast double rep (minIntervalMs)', () => {
  resetMockHooks();
  let repCount = 0;
  const { push } = useRepCounter({
    downThreshold: 100,
    upThreshold: 160,
    minIntervalMs: 350,
    onRep: (c: number) => {
      repCount = c;
    },
  });

  const originalDateNow = Date.now;
  let mockTime = 1000;
  Date.now = () => mockTime;

  try {
    push(170);
    push(90);
    push(170);
    assert.strictEqual(repCount, 1); // 1st rep counted at mockTime = 1000

    // Try a very fast second rep
    mockTime += 100; // only 100ms passed
    push(90);
    push(170);
    assert.strictEqual(repCount, 1); // ignored because of minIntervalMs!

    // Try after sufficient time
    mockTime += 300; // total 400ms passed since 1st rep
    push(90);
    push(170);
    assert.strictEqual(repCount, 2); // counted!
  } finally {
    Date.now = originalDateNow;
  }
});

test('useRepCounter - incomplete reps', () => {
  resetMockHooks();
  let repCount = 0;
  const { push } = useRepCounter({
    downThreshold: 100,
    upThreshold: 160,
    minIntervalMs: 0,
    onRep: (c: number) => {
      repCount = c;
    },
  });

  push(170);
  push(120); // does not go below 100
  push(170);
  assert.strictEqual(repCount, 0); // never reached down threshold
});
