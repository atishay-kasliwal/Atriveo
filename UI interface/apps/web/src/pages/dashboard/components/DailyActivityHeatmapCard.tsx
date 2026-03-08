import { MONTH_NAMES } from "../constants";

type HeatmapCell = {
  day: string;
  dayNum: number;
  value: number;
};

type MonthHeatmap = {
  month: number;
  year: number;
  todayDay: number;
  todayIso: string;
  cells: HeatmapCell[];
};

type Props = {
  monthHeatmap: MonthHeatmap | null;
};

export default function DailyActivityHeatmapCard({ monthHeatmap }: Props) {
  return (
    <div className="card card-heatmap">
      <h2>Daily Activity</h2>
      <p className="chart-subtitle">
        {monthHeatmap ? `${MONTH_NAMES[monthHeatmap.month]} ${String(monthHeatmap.year).slice(2)}` : "This month"}
      </p>
      <div className="heatmap-weekdays">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={`weekday-${i}`} className="heatmap-weekday">
            {d}
          </div>
        ))}
      </div>
      <div className="heatmap-grid">
        {monthHeatmap?.cells.map((cell, idx) => {
          if (!cell.dayNum) return <div key={`empty-${idx}`} className="heatmap-cell heatmap-empty" />;
          if (cell.dayNum > monthHeatmap.todayDay) {
            return (
              <div key={cell.day} className="heatmap-cell heatmap-future" title={`${cell.day}: future`}>
                <span>{cell.dayNum}</span>
              </div>
            );
          }
          let level = 0;
          if (cell.value > 35) level = 4;
          else if (cell.value >= 25) level = 3;
          else if (cell.value >= 13) level = 2;
          else if (cell.value >= 1) level = 1;
          const isToday = monthHeatmap.todayIso === cell.day;
          return (
            <div
              key={cell.day}
              className={`heatmap-cell heatmap-${level}${isToday ? " heatmap-today" : ""}`}
              title={`${cell.day}: ${cell.value}`}
            >
              <span>{cell.dayNum}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
