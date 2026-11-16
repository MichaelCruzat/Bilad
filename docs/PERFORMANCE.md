# Visual performance review — 2026-11-15

The globe had a real main-thread bottleneck. CPU sampling identified repeated
`CanvasRenderingContext2D.closePath()` calls inside a very large colour batch
as the dominant work. World year playback also sorted the complete annual
dataset to choose its colour scale on every year change.

## Changes retained

- Globe: build a geographic texture when the data mode changes, then project
  it through WebGL as the camera moves. Nearest-neighbour sampling keeps each
  native cell's categorical colour. Borders and graticules share the texture;
  selection outlines and interaction feedback remain vector overlays.
- Fallback: omit redundant `closePath()` calls (`fill()` closes subpaths) and
  fill at most 128 visible polygons per batch. Lack of WebGL, shader failure,
  or context loss falls back to the 2D renderer.
- World: calculate the annual colour limit once per dataset. Use exact
  quickselect for the 95th percentile instead of sorting the full array.
  Equivalence tests cover ordered, reversed, tied, and missing values and
  verify that source arrays remain unchanged.
- World: cache the geographic scene so hover, crosshair, and cell selection
  only redraw overlays. Data, camera, size, or country-outline changes
  invalidate that cache.
- Home: remove rankings, the detailed coverage ledger,
  validation receipts, and glossary. The user's later global correction
  restores the full acronym, mission, beneficiaries, worldwide scope, and
  global highlights, replacing the seeded national comparison with a pinned
  geographic evidence trail. The user then requested the case list on Home
  and a separate Impact tab for the detailed significance explanation.

## Measurements

Local Chrome headless, 1440 × 900, device scale 1, **4× CPU throttle**, loaded
data, three nominal three-second samples per scenario. The finished WebGL
run used Chrome 157.0.8103.51 and explicitly enabled **SwiftShader software
WebGL**. Ordinary headless Chrome on this machine returned no WebGL context,
so the before/after fallback comparison uses 2D throughout.

These are main-thread `requestAnimationFrame` intervals. They describe
responsiveness, not a promise of presented frames per second. Ranges below
span the three runs; raw samples are in [performance-results.json](performance-results.json).

| Scenario | Before | After |
|---|---:|---:|
| Globe, 2D: median interval | 2,750–4,117 ms | 117–133 ms |
| Globe, 2D: p95 interval | 3,167–4,117 ms | 133–134 ms |
| World year playback: p95 interval | 2,833–3,500 ms | 33–67 ms |

The separate SwiftShader globe run recorded a 16.7 ms median and 33.4 ms p95
in each sample, with 114–131 actual WebGL draws per sample. Shader compilation
reported no errors. This demonstrates the accelerated path working under a
software renderer; it is not a controlled before/after hardware-GPU benchmark.

Removing `closePath()` alone reduced 2D median intervals to 167–183 ms.
Bounding the batches further reduced them to 117–133 ms, so both changes were
kept. WebGL avoids rebuilding the cell polygons during camera movement.

## Reproduce

Build first; avoid running other heavy jobs during profiling. Chrome may need
permission to launch outside the command sandbox on this machine.

```sh
pnpm build
PROFILE_RENDERER=2d PROFILE_OUTPUT=/tmp/trace-2d.json pnpm profile:visuals
PROFILE_SWIFTSHADER=1 PROFILE_SCENARIO=globe PROFILE_OUTPUT=/tmp/trace-webgl.json pnpm profile:visuals
pnpm smoke
SMOKE_WEBGL=1 pnpm smoke
```

`PROFILE_CPU=1` prints the top CPU samples. `PROFILE_ARTIFACT_DIR` saves a
paused screenshot after each measured scenario. Reports include context
availability, draw counts, shader errors, script time, and task time.

## Verification and limits

The earlier global/motion build passed 24 browser checks, including all three
scroll stages, a pinned globe, global walkthroughs outside the supplemental
packs, reduced motion, and forced 2D fallback. Its final SwiftShader globe
run recorded 16.7 ms median intervals and 16.7–16.8 ms p95 intervals, with
170–180 actual WebGL draws per sample and no shader errors. The globe is now
smaller than in the original homepage, so this is a final-build observation,
not an isolated measurement of the projection correction.

World playback under the original 2D launch conditions recorded 16.7 ms median
and 33.3–33.4 ms p95 intervals in all three final samples. In the separate
SwiftShader session, World samples included p95 spikes of 100 and 283 ms.
That variation is retained in the raw report rather than discarded. Graphics
backend and device testing remain necessary; the measurements do not prove
uniform performance on all machines.

The initial optimization's browser runs passed all 21 checks, with WebGL explicitly
enabled in one run and the forced-unavailable fallback checked in both.
Desktop and phone screenshots were reviewed. Tests cover pause, keyboard
selection and announcements, reduced motion, early nation selection, flight
cleanup, data-download failures, and retries.

The baseline globe only produced two or three sampled callbacks per run;
its p95 is consequently a coarse description of severe stalls. These are
short local measurements, not a field-performance study. The 2D fallback
remains slower than the accelerated renderer, and older phones, high pixel
density, zoom, and different graphics drivers need device testing. Cold
downloads and the initial witness calculations are outside these warm-data
samples. Statistics and agreement colours are unchanged by rendering changes.

## Regional outlines and Midnight blue follow-up

Natural Earth admin-1 geometry is generalized from 415,835 to 61,012 vertices
and contains no names or properties. The file is 995,291 bytes, about 309 KiB
gzipped. It is requested only after 3× zoom and shared by all three maps.
The source revision, checksum, license and simplification are recorded in
`public/data/admin1.meta.json`.

An initial vector implementation reprojected regional lines on every globe
frame. It was visibly slower, so it was replaced with a separate cached
WebGL texture. Linear filtering smooths the outline layer; the climate data
retain nearest-neighbour sampling. The World map similarly caches its
country/regional lines in geographic coordinates and culls off-screen cells.
The 2D globe fallback culls regional lines by its visible spherical cap.

Same local Chrome version, 1440×900, SwiftShader and 4× CPU throttle as above;
three three-second samples per case. The zoomed globe rotates, and the flat
map pans over North America. Values are callback intervals, not presented FPS.

| Scenario | Initial vector p95 | Retained renderer p95 |
| --- | ---: | ---: |
| Zoomed globe with regional lines | 83.3–116.6 ms | 16.7–16.8 ms |
| Zoomed World map while panning | 183.3–350 ms | 33.4 ms |
| World year playback | — | 16.8–33.4 ms |

An empty-regional-layer control in the retained implementation measured
16.7–16.8 ms p95 for the globe and 50–133.4 ms for World. The control being
slower than the real layer illustrates run variation; adding boundaries is
not an optimization by itself. Warm-data samples exclude the first asset
download and texture upload. Older phones and hardware GPUs still need
device testing. Each cached 2304×1440 outline raster uses about 13 MB before
browser/GPU copies.

| Experiment | Decision | Evidence |
| --- | --- | --- |
| Cache the filtered relief image | Reverted | Zoomed World p95 stayed around 183–250 ms. |
| Cull off-screen cell rectangles | Kept | Script time fell substantially; zoomed p95 reached 150–167 ms before caching outlines. |
| Cache the climate grid as an image | Reverted | No consistent frame-time improvement; spikes reached 667 ms. |
| Cache country/regional line geometry as an image | Kept | World p95 fell to 33–50 ms in the isolated run and 33.4 ms in the combined run. |

Raw runs, including rejected attempts, are in
[regional-performance-results.json](regional-performance-results.json).

```sh
pnpm build
PROFILE_REGIONS=1 PROFILE_SWIFTSHADER=1 PROFILE_OUTPUT=/tmp/regions.json pnpm profile:visuals
PROFILE_REGIONS=1 PROFILE_REGION_BASELINE=1 PROFILE_SWIFTSHADER=1 PROFILE_OUTPUT=/tmp/empty-regions.json pnpm profile:visuals
```

These measurements predate the later help/copy review and the requested
continuous-scroll change. Scrolling now preserves the selected data view,
camera and running rotation; it does not trigger a fly-to or globe fade.
Reduced motion and the explicit pause control remain supported.
