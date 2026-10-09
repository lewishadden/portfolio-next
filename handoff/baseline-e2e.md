# Baseline e2e (foundation, before any lane)

Run on 9 Oct 2026 in the cloud container, commit `ceb02b8` (Wave 0 complete), Linux, Playwright 1.63,
Chromium 1194, SwiftShader for the `@webgl` project.

- `npm run verify`: pass. `npm run build`: pass.
- `npx playwright test`: **97 passed, 1 failed** (17.9 min).

Failing test:

```
[chromium-webgl] tests/e2e/mobile-menu.spec.ts:90 › mobile menu › with 3D effects on ›
  the world stops drawing while the menu covers it @webgl

  Error: expect(received).toBeGreaterThan(expected)   Expected: > 0   Received: 0
    133 |         expect(await drawsOver(1500)).toBeGreaterThan(0);
```

The world drew 0 frames in 1.5s at phone size *before* the menu was opened, so the test never reached the
pause check. This test was added with the foundation (A15 menu pause, commit `7634433`). Either a real
foundation bug (for example the lite/phone frameloop not running after boot) or SwiftShader starving the
render loop. Not yet investigated: check it on the Mac first (real GPU); if it still fails there, it is a bug.
