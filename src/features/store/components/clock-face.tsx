// Mặt đồng hồ vẽ ở server: 0KB JS, có trong HTML prerender nên hiện ngay cả trước khi JS chạy / khi tắt JS (kim do
// StoreClock vẽ ở client). Hệ tọa độ 0–100 khớp với SVG kim trong StoreClock, tâm (50, 50).

const TICKS = Array.from({ length: 12 }, (_, index) => index)

/** 12 vạch giờ, vạch ở 12 / 3 / 6 / 9 dài và đậm hơn. Không số trên mặt. */
export function ClockFace() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="absolute inset-0 size-full">
      {TICKS.map((index) => {
        const major = index % 3 === 0
        return (
          <line
            key={index}
            x1="50"
            y1="7"
            x2="50"
            y2={major ? 17 : 12}
            transform={`rotate(${index * 30} 50 50)`}
            className="stroke-muted-foreground"
            strokeWidth={major ? 2.5 : 1.5}
            strokeLinecap="round"
          />
        )
      })}
    </svg>
  )
}
