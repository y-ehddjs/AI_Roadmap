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
