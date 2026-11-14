# Earth / Resonance

Cosmic Siblings: Hoi Wen Han and Hoi Shao Xuan Crystal.

Pick a patch of NASA ocean or aerosol imagery and hear its colors as musical notes. A moving scan line shows the pixels being played. Compare saved regions, play them in order or together, and shape the sound in Sound Lab. A separate atmosphere model shows how temperature and wind can bend a sound path.

## Run locally

Use Python 3.11 or 3.12. No AI checkpoint or GPU is needed.

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python server.py
```

Open http://127.0.0.1:8766/. On Windows, `Open Sound Lab.cmd` can launch the configured environment. The first new atmospheric selection needs internet access to the public GEOS-Chem archive; subsequent requests use a local cache. Keep the server local.

## What the controls do

- In order scans each checked region once, then moves to the next.
- Together mixes checked regions at the same time.
- Melody uses assigned notes; imagery changes their tone and loudness.
- Listen follows the selected node mode in Regions view. On the map it plays the current selection.
- Repeat nodes repeats a node sequence. Echo adds an optional modeled delayed arrival.
- Scan speed changes image-scanning speed. Melody tempo is separate.
- Saved regions, scan speed, templates and Echo preference stay in that browser and site address.

## Data and interpretation

- Ocean: NASA SVS 3912 / ECCO2, 25 March 2007 to 3 March 2008.
- Aerosols: NASA SVS 5572 / GEOS, 1 August to 14 September 2024.
- Atmosphere: NASA MERRA-2, regridded by GEOS-Chem, 1 January 2025 at 01:30 UTC; coarse 4 by 5 degree cells.

Imagery dates and atmospheric dates differ. Surface height represents image brightness, not real terrain. Sounds are synthesized, not recordings of Earth. The simplified atmospheric ray model is educational; arrival playback compresses travel time by 1,000 and is not a validated audible-sound simulation. Ocean month labels are approximate. Read Sources & method in the app and `dist/assets/provenance.json` for credits and limitations.

The short Sweden practice preset credits C418 / Daniel Rosenfeld and a publisher score preview. It is a separate composed example, not NASA-derived melody or a full song. No rights to the composition are claimed.

## Repository layout

`dist/` contains the current browser app, embedded imagery and calculated example profiles. Python files provide geographic profile lookup and ray calculations. `data/` holds the vertical grid and source metadata. Large duplicate source movies, old model experiments, logs and generated audio are excluded. The embedded JavaScript media bundles are included so a clone can display the imagery.

`build_demo.py --data-only` rebuilds the example profiles. Historical audio-export mode and source-media preparation require the separate research workspace and are not needed to run this app.

## Checks

With Node.js installed:

```powershell
node verify_music_nodes.cjs
node verify_region_group.cjs
node verify_node_melody.cjs
node verify_echo.cjs
node verify_saved_regions.cjs
```

## Team workflow

Wen Han uses `main` for functions; Crystal uses `ui-crystal` for interface work. See [COLLABORATION.md](COLLABORATION.md).

The initial commits import an already-developed app in component groups. The push/pull exercise uses today's actual operations; it does not reconstruct past development or claim that either contributor individually wrote all imported code. AI assistance was used in implementation and documentation.
