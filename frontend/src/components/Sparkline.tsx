type SparklineProps = {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
};

export default function Sparkline({
  values,
  width = 160,
  height = 40,
  stroke = '#3b82f6',
  fill = 'none',
  strokeWidth = 2
}: SparklineProps) {
  const len = values.length;
  if (!values || len === 0) {
    return <svg width={width} height={height} />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const stepX = width / Math.max(1, len - 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  });

  const d = `M ${points.join(' L ')}`;

  return (
    <svg width={width} height={height}>
      <path d={d} stroke={stroke} fill={fill} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}


