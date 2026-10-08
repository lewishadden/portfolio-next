import Link from 'next/link';
import { Icon } from '@iconify/react';

import Magnet from 'components/Magnet/Magnet';
import { Marquee } from 'components/Marquee/Marquee';
import { ScrambleText } from 'components/Motion/ScrambleText';
import { SplitText } from 'components/Motion/SplitText';
import { StationReadout } from 'components/StationReadout/StationReadout';
import { HeroHud } from './HeroHud';
import { RoleRotator } from './RoleRotator';
import { StationFallback, illustrations } from 'components/World/StationFallback';
import { WorldLaunch } from 'components/WorldLaunch/WorldLaunch';
import { InspectButton } from 'components/World/InspectButton';

import { Home as HomeProps } from '@/types';

import './Home.scss';

export const Home = ({
  home,
  openToWork,
  openToWorkText,
  location,
}: {
  home: HomeProps;
  openToWork: boolean;
  openToWorkText: string;
  location: string;
}) => {
  const { name, titles, tagline, cta } = home;
  const [firstName, ...restName] = name.split(' ');
  const surname = restName.join(' ');

  return (
    <>
      <section id="home" className="hero" aria-labelledby="home-heading">
        {/* On narrow screens the astronaut floats in this space above the copy */}
        <div className="hero__stage" aria-hidden="true" />
        <StationFallback src={illustrations.astronaut} />

        <div className="hero__content">
          <div className="hero__meta">
            {openToWork && (
              <p className="hero__badge">
                <span className="hero__badge-dot" aria-hidden="true" />
                {openToWorkText}
              </p>
            )}
            <StationReadout className="hero__station" />
          </div>

          <p className="hero__greeting">
            <ScrambleText text="// hello world, I'm" trigger="mount" delay={150} />
          </p>

          <h1 id="home-heading" className="hero__name">
            <span className="hero__line">
              <SplitText text={firstName} delay={250} />
            </span>
            <span className="hero__line">
              <SplitText text={surname} delay={520} gradient />
            </span>
          </h1>

          <RoleRotator titles={titles} />

          <p className="hero__tag">{tagline}</p>

          <div className="hero__ctas">
            <Magnet>
              <Link
                href={cta.primary.url}
                className="btn btn--primary"
                aria-label={cta.primary.ariaLabel}
              >
                {cta.primary.icon && (
                  <Icon icon={cta.primary.icon} width={18} height={18} aria-hidden="true" />
                )}
                <span>{cta.primary.text}</span>
              </Link>
            </Magnet>
            <Magnet>
              <Link
                href={cta.secondary.url}
                className="btn btn--ghost"
                aria-label={cta.secondary.ariaLabel}
              >
                {cta.secondary.icon && (
                  <Icon icon={cta.secondary.icon} width={18} height={18} aria-hidden="true" />
                )}
                <span>{cta.secondary.text}</span>
              </Link>
            </Magnet>
          </div>
          <div className="hero__orientation">
            <span className="hero__orientation-label">Gateway console</span>
            <InspectButton selection={{ kind: 'station', id: 'home', station: 'home' }}>
              Open orientation display
            </InspectButton>
          </div>
          <WorldLaunch />
        </div>

        <HeroHud location={location} />
      </section>

      <Marquee
        items={[...titles, openToWorkText]}
        className="hero__marquee"
        duration={40}
        label={titles.join(', ')}
      />
    </>
  );
};

export default Home;
