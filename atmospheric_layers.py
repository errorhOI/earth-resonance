import numpy as np

METHOD = {
    'tropopause': 'Lowest sampled level from 5 to 22 km above model surface with '
        'forward lapse rate <=2 K/km and mean lapse rates to ALL higher levels '
        'within 2 km <=2 K/km. Piecewise-linear temperature, including the exact '
        '2 km endpoint. First lapse-rate tropopause estimate only; no secondary '
        'tropopauses. Search floor excludes shallow boundary-layer inversions.',
    'stratopause': 'Warmest sampled level from 35 to 58 km, only if an interior '
        'local maximum with cooler temperatures 2 km below and above. No spline '
        'or invented 50 km boundary. Adjacent model centers bracket sampling '
        'resolution, not a statistical confidence interval. An elevated or '
        'ambiguous stratopause outside this search cannot be diagnosed.',
    'geometry': 'All heights above model surface. Shell radius = Earth radius + '
        'height times 40; identical height scaling for shells and acoustic rays. '
        'The selected regional column is extended uniformly around the globe '
        'as a schematic; it is not a measured global boundary map. Layer opacity '
        'and color are illustrative, not density measurements. Surface to the '
        'lowest center is unobserved; lower-zone shading extends to surface.',
    'sources': [
        'https://acp.copernicus.org/articles/19/5661/2019/',
        'https://acp.copernicus.org/articles/26/2161/2026/',
        'https://www.nasa.gov/image-article/earths-atmospheric-layers-3/',
    ],
}


def diagnose(height_m, temperature_k):
    z = np.asarray(height_m, float) / 1000
    t = np.asarray(temperature_k, float)
    if len(z) < 3 or z.shape != t.shape or not np.isfinite([z, t]).all() or np.any(np.diff(z) <= 0):
        raise ValueError('Need finite temperatures and increasing heights')
    trop = strat = None
    for i in range(len(z)-1):
        if not 5 <= z[i] <= 22 or z[i]+2 > z[-1]:
            continue
        lapse = -(t[i+1]-t[i])/(z[i+1]-z[i])
        if lapse > 2 + 1e-9:
            continue
        above = np.append(z[(z > z[i]) & (z < z[i]+2)], z[i]+2)
        means = (t[i]-np.interp(above, z, t))/(above-z[i])


        if np.all(means <= 2 + 1e-9):
            trop = dict(height_km=float(z[i]), temperature_k=float(t[i]),
                        sample_bracket_km=[float(z[max(0,i-1)]),float(z[i+1])],
                        max_mean_lapse_k_per_km=float(max(lapse, np.max(means))))
            break
    candidates = np.where((z >= 35) & (z <= 58))[0]
    if len(candidates):
        i = int(candidates[np.argmax(t[candidates])])
        if 0 < i < len(z)-1 and z[0] <= z[i]-2 and z[i]+2 <= z[-1]:
            if t[i] > max(t[i-1], t[i+1], np.interp(z[i]-2,z,t), np.interp(z[i]+2,z,t)):
                strat = dict(height_km=float(z[i]), temperature_k=float(t[i]),
                             sample_bracket_km=[float(z[i-1]),float(z[i+1])])
    layers = []
    if trop and strat and trop['height_km'] < strat['height_km'] < z[-1]:
        edges = [0.,trop['height_km'],strat['height_km'],float(z[-1])]
        for name,low,high in zip(['Troposphere','Stratosphere','Lower mesosphere'],edges[:-1],edges[1:]):
            layers.append(dict(name=name,bottom_km=low,top_km=high,thickness_km=high-low))
    return dict(status='estimated' if layers else 'unresolved',tropopause=trop,
                stratopause=strat,coverage_top_km=float(z[-1]),
                lowest_sample_km=float(z[0]),layers=layers)


def verify():
    z=np.arange(0.,61.)
    t=np.interp(z,[0,11,20,47,60],[288,216.5,216.5,270,230])
    d=diagnose(z*1000,t)
    assert d['tropopause']['height_km']==11 and d['stratopause']['height_km']==47
    assert [x['thickness_km'] for x in d['layers']]==[11,36,13]

    z2=np.array([0,5,5.5,6,7,8,9,10,11,12,13,14,15,20,35,45,47,49,55,60.])
    t2=np.array([300,270,270,264,266,260,254,248,242,236,230,230,230,240,250,265,270,265,245,230.])
    d2=diagnose(z2*1000,t2)
    assert d2['tropopause']['height_km']!=5

    assert diagnose(z*1000,300-z*6)['stratopause'] is None
    assert diagnose(z*1000,300-z*6)['layers']==[]


if __name__=='__main__':
    verify()
    print('Thermal layer checks passed.')
