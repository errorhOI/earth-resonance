"""Educational 2-D rays in a horizontally uniform effective sound-speed profile.

Uses dry-air c=sqrt(gamma*R*T) plus the horizontal wind along the bearing.
This scalar effective-speed approximation omits crosswind advection, curvature,
terrain, attenuation and horizontal changes. It is not a validated forecast.
"""
import math
import numpy as np


def segment(dz, c1, c2, p):
    """Exact x/time integrals through one linearly varying speed segment."""
    if dz <= 0:
        return 0., 0.
    q1, q2 = p*c1, min(1., p*c2)
    if not (0 < q1 < 1 and 0 < q2 <= 1):
        raise ValueError('Invalid ray parameter in traversed segment')
    s1, s2 = math.sqrt(max(0., 1-q1*q1)), math.sqrt(max(0., 1-q2*q2))
    gradient = (c2-c1)/dz
    if abs(c2-c1) < 1e-7:
        return dz*q1/s1, dz/(c1*s1)
    distance = (s1-s2)/(p*gradient)
    duration = math.log((q2/(1+s2))/(q1/(1+s1)))/gradient
    return distance, duration


def trace(z, speed, angle_degrees, max_range_m=2_000_000):
    z, speed = np.asarray(z, float), np.asarray(speed, float)
    if len(z) < 3 or len(z) != len(speed) or np.any(np.diff(z) <= 0):
        raise ValueError('Need increasing heights and equally sized speed values')
    if not np.isfinite(z).all() or not np.isfinite(speed).all() or np.any(speed <= 0):
        raise ValueError('Profile contains invalid values')
    if not 0 < angle_degrees < 90:
        raise ValueError('Launch elevation must be between 0 and 90 degrees')
    p = math.cos(math.radians(angle_degrees))/speed[0]
    turn_speed = 1/p
    points = [[0., float(z[0])]]
    times = [0.]
    x, elapsed = 0., 0.
    turned = False
    for i in range(len(z)-1):
        za, zb, ca, cb = z[i], z[i+1], speed[i], speed[i+1]
        if cb >= turn_speed and cb > ca:
            zb = za + (turn_speed-ca)*(zb-za)/(cb-ca)
            cb = turn_speed
            turned = True
        # Subdivide only for display; analytic integrals remain exact.
        for fraction in np.linspace(.2, 1, 5):
            dz = (zb-za)*fraction
            cp = ca+(cb-ca)*fraction
            dx, dt = segment(dz, ca, cp, p)
            points.append([float(x+dx), float(za+dz)])
            times.append(float(elapsed+dt))
        dx, dt = segment(zb-za, ca, cb, p)
        x += dx
        elapsed += dt
        if x > max_range_m:
            return dict(status='range_limit', angle_deg=float(angle_degrees), path_m=points, path_seconds=times)
        if turned:
            if 2*x > max_range_m:
                return dict(status='range_limit', angle_deg=float(angle_degrees), path_m=points, path_seconds=times)
            ascending = points.copy()
            points += [[float(2*x-px), pz] for px, pz in ascending[-2::-1]]
            times += [float(2*elapsed-t) for t in times[-2::-1]]
            return dict(status='returned', angle_deg=float(angle_degrees),
                landing_range_km=float(2*x/1000), travel_seconds=float(2*elapsed),
                turning_height_km=float(zb/1000), source_height_km=float(z[0]/1000),
                path_m=points, path_seconds=times)
    return dict(status='left_profile_top', angle_deg=float(angle_degrees), path_m=points, path_seconds=times,
        note='No return found within this profile; this is not proof of no return above it.')


def effective_speed(temperature_k, u_ms, v_ms, bearing_degrees):
    bearing = math.radians(bearing_degrees)
    return np.sqrt(1.4*287.05*np.asarray(temperature_k)) + np.asarray(u_ms)*math.sin(bearing) + np.asarray(v_ms)*math.cos(bearing)


def verify():
    # Constant speed: straight ray and no invented atmospheric return.
    z = np.array([0., 1000., 2000.])
    ray = trace(z, [340., 340., 340.], 20)
    assert ray['status'] == 'left_profile_top'
    assert abs(ray['path_m'][-1][0] - 2000/math.tan(math.radians(20))) < 1e-7
    # Linear positive gradient has an analytical turning height/range/time.
    c0, g, theta = 340., .005, math.radians(20)
    z = np.linspace(0, 20000, 81)
    ray = trace(z, c0+g*z, 20)
    p = math.cos(theta)/c0
    assert ray['status'] == 'returned'
    assert abs(ray['turning_height_km']*1000-(1/p-c0)/g) < 1e-6
    assert abs(ray['landing_range_km']*1000-2*math.sin(theta)/(p*g)) < 1e-5
    expected_time = -2*math.log(math.cos(theta)/(1+math.sin(theta)))/g
    assert abs(ray['travel_seconds']-expected_time) < 1e-6
    assert ray['path_m'][-1][1] == 0
    # Wind must change sign when the direction reverses.
    east = effective_speed([280], [20], [0], 90)[0]
    west = effective_speed([280], [20], [0], 270)[0]
    assert abs(east-west-40) < 1e-9
    print('Ray checks passed: straight path, analytical turning solution, bearing reversal.')


if __name__ == '__main__':
    verify()
