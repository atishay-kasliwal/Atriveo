export interface TimeSeriesPoint {
  time: string;
  value: number;
}

export interface Last24HoursChartProps {
  title: string;
  metricTotal: number;
  changePercent?: number;
  data: TimeSeriesPoint[];
}
