import './Background.scss';

export const Background = () => {
  const circleCount = 100;
  const circles = Array.from({ length: circleCount }, (_, i) => (
    <div className="circle-container" key={i}>
      <div className="circle"></div>
    </div>
  ));

  return <div className="bg-container">{circles}</div>;
};

export default Background;
