import './Background.scss';

export const Background = () => {
  const arr = [];
  for (let i = 0; i < 100; i += 1) {
    arr.push(
      <div className="circle-container" key={i}>
        <div className="circle"></div>
      </div>
    );
  }
  return <div className="bg-container">{arr.map((input) => input)}</div>;
};

export default Background;
