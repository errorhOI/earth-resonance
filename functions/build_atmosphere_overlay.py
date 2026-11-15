import hashlib
import json
import time
from collections import Counter
from pathlib import Path

import numpy as np
from profile_service import load_fields
from build_demo import height_profile
from ray_model import effective_speed, trace

ROOT = Path(__file__).resolve().parent.parent
BEARINGS = [90, 270, 0, 180]
ANGLES = [5, 10, 15, 20, 25, 30]


def main():
    started = time.perf_counter()
    fields = load_fields()
    grid = json.loads((ROOT / 'data/vertical-grid.json').read_text())
    coverage, statuses, counts = [], [[] for _ in range(24)], Counter()
    for y, lat in enumerate(fields['lat']):
        for x, lon in enumerate(fields['lon']):
            t, q, u, v = [fields[k][:, y, x] for k in ['T', 'QV', 'U', 'V']]
            ps = float(fields['PS'][y, x])
            valid = bool(20000 < ps < 120000 and np.all((t > 140) & (t < 350))
                         and all(np.isfinite(a).all() for a in [t, q, u, v]))
            if valid:
                z, _ = height_profile(t, q, ps, grid)
                keep = z <= 60000
                z, t, u, v = [a[keep] for a in [z, t, u, v]]
                valid = bool(len(z) >= 3 and np.isfinite(z).all() and np.all(np.diff(z) > 0))
            coverage.append(int(valid))
            for bi, bearing in enumerate(BEARINGS):
                speed = effective_speed(t, u, v, bearing) if valid else None
                for ai, angle in enumerate(ANGLES):
                    status = trace(z, speed, angle)['status'] if valid else 'unavailable'
                    counts[status] += 1
                    statuses[bi * len(ANGLES) + ai].append(
                        {'unavailable': 0, 'returned': 1, 'left_profile_top': 2, 'range_limit': 3}[status])
        print(f'Atmosphere overlay: row {y + 1}/{len(fields["lat"])}', flush=True)
    digest = hashlib.sha256()
    for k in ['lat', 'lon', 'T', 'QV', 'PS', 'U', 'V']:
        digest.update(np.ascontiguousarray(fields[k]).tobytes())
    result = dict(latitude=fields['lat'].tolist(), longitude=fields['lon'].tolist(),
                  coverage=coverage, statuses=statuses, bearings=BEARINGS, angles=ANGLES,
                  codes={'unavailable': 0, 'returned': 1, 'left_profile_top': 2, 'range_limit': 3},
                  time='2025-01-01T01:30:00Z', grid='4 degrees latitude by 5 degrees longitude',
                  model='Same trace() as profile_service; highest layer center below 60 km; 2000 km range limit.',
                  source='NASA MERRA-2 regridded by GEOS-Chem; T/QV/PS interpolated 00-03 UTC, U/V 00-03 mean.',
                  fields_sha256=digest.hexdigest(), ray_model_sha256=hashlib.sha256((ROOT/'functions/ray_model.py').read_bytes()).hexdigest())
    target = ROOT/'functions/atmosphere-coverage.json'
    target.write_text(json.dumps(result, separators=(',', ':'), allow_nan=False), encoding='utf-8')
    print(json.dumps(dict(cells=len(coverage), available=sum(coverage), outcomes=counts,
                          seconds=round(time.perf_counter()-started, 2), bytes=target.stat().st_size)), flush=True)


if __name__ == '__main__':
    main()
