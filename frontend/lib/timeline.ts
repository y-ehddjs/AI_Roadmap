export interface NodePosition {
  xPercent: number;
  y: number;
  side: 'left' | 'right';
}

const LEFT_PERCENT = 0.15;
const RIGHT_PERCENT = 0.75;
const ROW_HEIGHT = 140;
const TOP_OFFSET = 40;

export function computeNodePositions(count: number): NodePosition[] {
  const positions: NodePosition[] = [];
  for (let i = 0; i < count; i++) {
    const side: 'left' | 'right' = i % 2 === 0 ? 'left' : 'right';
    positions.push({ xPercent: side === 'left' ? LEFT_PERCENT : RIGHT_PERCENT, y: TOP_OFFSET + i * ROW_HEIGHT, side });
  }
  return positions;
}

// 노드들을 잇는 지그재그 곡선의 SVG path `d` 속성값을 만든다. 좌표계는
// x=xPercent*100(0~100, viewBox 폭을 100으로 잡고 preserveAspectRatio="none"으로
// 늘려서 노드 div들의 퍼센트 기반 위치와 항상 맞아떨어지게 함), y=픽셀. 각 구간은
// 세로로 ROW_HEIGHT/2만큼 뻗은 제어점을 가진 큐빅 베지어라서 좌/우로 부드럽게 꺾인다.
export function computeTimelinePath(positions: NodePosition[]): string {
  if (positions.length < 2) return '';
  const half = ROW_HEIGHT / 2;
  const toX = (p: NodePosition) => Math.round(p.xPercent * 100);
  let d = `M${toX(positions[0])},${positions[0].y}`;
  for (let i = 1; i < positions.length; i++) {
    const prev = positions[i - 1];
    const curr = positions[i];
    d += ` C${toX(prev)},${prev.y + half} ${toX(curr)},${curr.y - half} ${toX(curr)},${curr.y}`;
  }
  return d;
}
