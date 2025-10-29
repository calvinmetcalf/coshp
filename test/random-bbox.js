import {randomPosition} from '@turf/random'
const maBounds = [
    -73.50821046061365,
    41.18705440018156,
    -69.85886099999999,
    42.88677831582657
  ];
  const makeBBOX = ()=>{
    const p1 = randomPosition(maBounds);
    const p2 = randomPosition(maBounds);
    return [
        Math.min(p1[0], p2[0]),
        Math.min(p1[1], p2[1]),
        Math.max(p1[0], p2[0]),
        Math.max(p1[1], p2[1])
    ]
  }
export default makeBBOX;