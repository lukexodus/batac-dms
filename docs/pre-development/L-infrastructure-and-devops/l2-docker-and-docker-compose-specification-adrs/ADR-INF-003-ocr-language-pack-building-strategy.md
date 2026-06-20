# ADR-L2-03 — OCR Language Pack Bundling Strategy

**Status:** Decided  
**Date:** June 2026  
**Resolves:** L2 Part 13 open decision L2-03  
**Author:** Architecture review

---

## Context

The stack uses `tesseract.js` (`OCR_ENGINE=tesseract`, the L1 default) for OCR. `tesseract.js` is pure JavaScript/WebAssembly — it does not call a system `tesseract` binary and requires no `apk add` in the Docker image.

By default, `tesseract.js` fetches language pack `.traineddata` files from the network on first OCR execution. This is acceptable in environments with reliable internet access. It is not acceptable in the on-premise City Hall deployment, where internet connectivity is not guaranteed.

Phase 1 production must support both deployment targets:
- Cloud VPS (internet available at build and runtime)
- On-premise City Hall / Barangay (no guaranteed internet)

The Dockerfile's existing `production` stage is shared across both targets. Language packs not bundled into the image must be retrieved from the network — which fails silently or at invocation time in offline environments.

The L2 document (Part 4) already contains an `[Inference]`-labeled Dockerfile block for bundling the language packs, and notes that the exact `TESSDATA_PREFIX` path requires confirmation against the `tesseract.js` API.

---

## Decision

**Always bundle language packs into the production Docker image, regardless of deployment target.**

Bundle English (`eng`) and Filipino (`fil`) language packs in all production builds. Do not rely on runtime network fetching in any deployment context.

Rationale:

1. **A single image must work in both deployment targets.** Maintaining separate Dockerfiles per deployment target (one with bundled packs, one without) doubles the build and maintenance surface. A single image that bundles packs works in both cloud and on-premise contexts without modification.

2. **Runtime fetching is a latency and reliability risk in cloud too.** Even in a cloud VPS, network fetching on first OCR invocation adds cold-start latency and creates a failure mode if the CDN serving `naptha/tessdata` is temporarily unavailable. Bundling eliminates this dependency entirely.

3. **Image size is an acceptable trade-off.** The `eng.traineddata` and `fil.traineddata` files are approximately 10 MB and 3 MB respectively (best-quality models). This is a one-time addition to the production image size, which is acceptable given that the alternative is a runtime network dependency that breaks in one of the two mandatory deployment targets.

4. **Consistency across environments.** Bundled packs mean staging and production OCR behavior is identical to local dev (if local dev also bundles) and does not depend on external CDN availability at any stage.

---

## Implementation

Add the following block to the `production` stage of `apps/server/Dockerfile`, before `USER node`:

```dockerfile
# OCR language packs — bundled for offline on-premise compatibility
# tesseract.js reads TESSDATA_PREFIX at runtime to locate .traineddata files.
# [Inference] Confirm TESSDATA_PREFIX path against tesseract.js scheduler config
# in OcrService before first OCR feature deployment.
ENV TESSDATA_PREFIX=/app/tessdata
RUN mkdir -p /app/tessdata && \
    wget -q -O /app/tessdata/eng.traineddata.gz \
      https://github.com/naptha/tessdata/raw/gh-pages/4.0.0_best/eng.traineddata.gz && \
    wget -q -O /app/tessdata/fil.traineddata.gz \
      https://github.com/naptha/tessdata/raw/gh-pages/4.0.0_best/fil.traineddata.gz && \
    gunzip /app/tessdata/*.gz && \
    chown -R node:node /app/tessdata
```

> **[Inference — not confirmed]** The path `/app/tessdata` and the `TESSDATA_PREFIX` environment variable name are illustrative, sourced from the L2 document's own `[Inference]`-labeled block. The actual path that `tesseract.js` reads language data from depends on how `OcrService` configures the Tesseract scheduler. Confirm against the `tesseract.js` API documentation and the project's `OcrService` wrapper before the OCR feature is implemented. If the path differs, update both the `ENV` line and the `mkdir`/`chown` targets.

### Language packs included

| Pack | File | Approximate size | Use |
|------|------|-----------------|-----|
| English | `eng.traineddata` | ~10 MB | Standard document text |
| Filipino | `fil.traineddata` | ~3 MB | Filipino-language document content |

Additional language packs (e.g., Ilocano) should be evaluated when the OCR feature is built. Ilocano OCR support via `tesseract.js` is [Unverified] — confirm availability in the `naptha/tessdata` repository before committing to it.

### Build-time network requirement

The `wget` commands in the `production` stage run at `docker build` time, not at container runtime. The Docker build environment requires internet access to `github.com` (specifically `raw.githubusercontent.com` or the GitHub CDN serving `naptha/tessdata`). This is a build-time constraint only — the built image has no network dependency for OCR.

For fully air-gapped CI environments, the `.traineddata` files should be committed to a project-controlled location (e.g., `tools/tessdata/`) and copied in via `COPY` instead of `wget`. This is not required for Phase 1 but is the correct path if the CI runner has no outbound access.

---

## Consequences

### Status update in L2 Part 13

L2-03 moves from `Unresolved` to `Resolved — language packs bundled in all production builds`.

### Action required before OCR feature implementation

1. Confirm `TESSDATA_PREFIX` path against `tesseract.js` scheduler API. Update the Dockerfile block if the path differs from `/app/tessdata`.
2. Evaluate whether Ilocano (`ilo`) pack is needed and available in `naptha/tessdata`.
3. Add the Dockerfile block in the same PR that implements `OcrService`.

---

## Rejected alternative

Maintaining separate build targets (bundled vs. runtime-fetch) was rejected because it requires build-time environment knowledge to select the correct target, adds CI complexity, and creates a risk of deploying the wrong image variant to the wrong environment.