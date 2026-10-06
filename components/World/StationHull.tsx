'use client';

import { prepareHull } from './hull';
import { Model } from './Model';
import { hullUrl } from './routes';
import { useLite } from './stationHooks';

import type { StationKey } from './routes';
import type { GroupProps } from './types';
import type { WorldTheme } from './utils';

/**
 * A station's hull: the image-to-3D craft that hosts the page (desktop or
 * lite build, see scripts/optimize-stations.mjs), with glowing windows and
 * shadows. Nothing shows until it has loaded and compiled.
 */
export function StationHull({
  station,
  height,
  theme,
  lite: forceLite,
  ...props
}: GroupProps & {
  station: StationKey;
  height: number;
  theme: WorldTheme;
  /** Use the lite build regardless of device (small or repeated hulls) */
  lite?: boolean;
}) {
  const lite = useLite();
  return (
    <Model
      url={hullUrl(station, forceLite ?? lite)}
      height={height}
      theme={theme}
      envIntensity={1}
      placeholder={false}
      prepare={prepareHull}
      {...props}
    />
  );
}
