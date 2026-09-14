import styled from 'styled-components';

type PerformanceLevel = 'low' | 'medium' | 'high';

const COLOR_BY_LEVEL: Record<PerformanceLevel, string> = {
  low: '#c0392b',
  medium: '#d68910',
  high: '#1e8449',
};

function levelFor(value: number): PerformanceLevel {
  if (value <= 49) return 'low';
  if (value <= 74) return 'medium';
  return 'high';
}

const Dot = styled.span<{ $level: PerformanceLevel }>`
  display: inline-block;
  width: 0.6em;
  height: 0.6em;
  border-radius: 50%;
  background-color: ${({ $level }) => COLOR_BY_LEVEL[$level]};
`;

type PerformanceIndicatorProps = {
  value: number;
};

export function PerformanceIndicator({ value }: PerformanceIndicatorProps) {
  const level = levelFor(value);

  return (
    <span>
      <Dot $level={level} aria-hidden="true" data-testid="performance-dot" />
      <span>{value}</span>
    </span>
  );
}
