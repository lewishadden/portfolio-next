import './Background.scss';

const particleCount = 60;

export const Background = () => (
  <div className="bg-container" aria-hidden="true">
    {/* Ambient gradient orbs */}
    <div className="bg-container__orb bg-container__orb--1" />
    <div className="bg-container__orb bg-container__orb--2" />
    <div className="bg-container__orb bg-container__orb--3" />

    {/* Floating particles */}
    <div className="bg-container__particles">
      {Array.from({ length: particleCount }, (_, i) => (
        <div className="bg-particle" key={i}>
          <div className="bg-particle__dot" />
        </div>
      ))}
    </div>
  </div>
);

export default Background;
