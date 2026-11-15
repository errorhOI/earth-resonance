# Development

## Hosting

`render.yaml` describes a **Free** Render Python web service. The browser UI and `/api/profile` calculations share one HTTPS address. No database or GPU is required.

- Branch: `main`; runtime: Python 3.11.11.
- Build: `pip install -r requirements-hosting.txt && python prepare_hosting.py`
- Start: `python web_app.py`
- Health check: `/api/health`

The production server uses Waitress. The build extracts the existing videos into unchanged binary files so browsers can stream and seek them, and compresses text assets. Only tracked `dist/` files enter the public web directory. User-imported files stay in their browser.

The 3.8 MB `data/hosted-fields.npz` contains the same decoded MERRA-2 temperature, humidity, surface pressure and wind arrays as the local source reader. Its checksum, dates and source URLs are in `data/hosted-fields.json`. Heights, atmospheric layers and 24 ray paths are still calculated for the selected grid cell in Python. Reproduce the bundle with `python prepare_hosting.py --rebuild-fields` (requires the source archive or local range cache).

Render Free sleeps after 15 minutes without traffic; the next visitor may wait about a minute. It has monthly runtime, bandwidth and build limits. Videos can consume the bandwidth allowance quickly. See [Render's current free-service limits](https://render.com/docs/free). No paid plan is required by this configuration.

Regions, scan speed and templates are saved per browser and site address. Existing settings at `127.0.0.1` do not automatically move to the hosted URL. Keep using the same hosted link to retain new saved settings.

For a local production check, install `requirements-hosting.txt`, run `python prepare_hosting.py`, then `python verify_hosting.py` and `python web_app.py`. The default production-test port is 8767; hosting uses the supplied `PORT`.

## Repository layout

`dist/` contains the current browser app, embedded imagery and calculated example profiles. Python files provide geographic profile lookup and ray calculations. `data/` holds the vertical grid and source metadata. `docs/media/` contains the README screenshots and short audio examples. Large duplicate source movies, old model experiments, logs and other generated audio are excluded. The embedded JavaScript media bundles are included so a clone can display the imagery.

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
