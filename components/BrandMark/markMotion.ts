import { stationForPath } from 'components/World/routes';
import { worldMode } from 'components/World/worldMode';
import { worldStore } from 'components/World/worldStore';

import { stationSlots } from './markGeometry';

/* ------------------------------------------------------------------
   How the mark moves, shared by the SVG and the WebGL versions. Angles
   are round the ring (markGeometry: 0 at the right end, π/2 front and
   centre). The moon orbits all the time, front left to right, slipping
   behind the letters on the way round; a camera flight or free roam
   speeds it up (the faster the camera, the faster it goes, with a
   trail). A notch on the ring marks the station you're docked at and
   slides to the next one in step with a flight. Hovering speeds the
   moon up too. Reduced motion holds the moon at the notch.
   ------------------------------------------------------------------ */

/** The moon's resting pace: one lap every eight seconds */
const restRate = (Math.PI * 2) / 8;

const smootherstep = (x: number) => {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/** The station the mark should point at: the camera's, or the page's without the world */
export function dockedStation() {
  const worldOn = document.documentElement.dataset.world === 'on';
  const { to } = worldStore.flight;
  return worldOn && to ? to : stationForPath(window.location.pathname);
}

export const slotFor = (station: string) => stationSlots[station] ?? stationSlots.home;

export interface MarkPose {
  /** The moon's angle round the ring */
  moon: number;
  /** The station notch's angle */
  notch: number;
  /** 0..1: how hard the moon is racing (draws its trail) */
  rush: number;
  station: string;
}

export function createMarkMotion() {
  const pose: MarkPose = { moon: 0, notch: 0, rush: 0, station: '' };
  let from = 0;
  let flying = false;
  let started = false;

  return {
    pose,
    /** Advances by `dt` seconds; `hover` speeds the moon up, `still` holds it (reduced motion) */
    step(dt: number, hover: boolean, still: boolean) {
      const station = dockedStation();
      const target = slotFor(station);
      pose.station = station;
      if (!started) {
        started = true;
        pose.notch = target;
        pose.moon = target;
      }
      const { flight } = worldStore;
      const worldOn = document.documentElement.dataset.world === 'on';

      if (worldOn && flight.active && !still) {
        if (!flying) from = pose.notch;
        flying = true;
        pose.notch = from + (target - from) * smootherstep(flight.progress);
      } else {
        flying = false;
        pose.notch = still ? target : pose.notch + (target - pose.notch) * (1 - Math.exp(-5 * dt));
      }

      if (still) {
        pose.moon = pose.notch;
        pose.rush = 0;
        return pose;
      }
      const moving = worldOn && (flight.active || worldMode.get().mode === 'explore');
      const boost = moving ? Math.min(worldStore.velocity / 14, 6) : 0;
      const rate = restRate * (hover ? 3 : 1) + boost;
      pose.moon -= rate * dt;
      pose.rush +=
        (Math.min(boost / 3 + (hover ? 0.3 : 0), 1) - pose.rush) * (1 - Math.exp(-6 * dt));
      return pose;
    },
  };
}
