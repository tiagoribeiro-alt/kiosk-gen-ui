import { journeyConnectorClassNames } from '../theme'

type JourneyConnectorProps = {
  count: number
}

type Point = {
  x: number
  y: number
}

type Footprint = Point & {
  rotation: number
  isLeft: boolean
}

type Segment = {
  start: Point
  control1: Point
  control2: Point
  end: Point
}

function getJourneyPoints(count: number): Array<Point> {
  if (count <= 0) {
    return []
  }

  const usable = Math.min(count, 4)
  // Each card occupies an equal flex-1 slice; centre of slice i = (i + 0.5) / usable * 100
  const cardCentres = Array.from({ length: usable }, (_, i) => ((i + 0.5) / usable) * 100)
  const offsets = [56, 44, 60, 48]

  return cardCentres.map((x, index) => ({
    x,
    y: offsets[index % offsets.length],
  }))
}

function buildSegmentPath(start: Point, end: Point): string {
  const controlOffset = (end.x - start.x) * 0.35

  return [
    `M ${start.x} ${start.y}`,
    `C ${start.x + controlOffset} ${start.y}, ${end.x - controlOffset} ${end.y}, ${end.x} ${end.y}`,
  ].join(' ')
}

function getPointOnCubicBezier(t: number, segment: Segment): Point {
  const mt = 1 - t
  const mt2 = mt * mt
  const mt3 = mt2 * mt
  const t2 = t * t
  const t3 = t2 * t

  return {
    x:
      mt3 * segment.start.x +
      3 * mt2 * t * segment.control1.x +
      3 * mt * t2 * segment.control2.x +
      t3 * segment.end.x,
    y:
      mt3 * segment.start.y +
      3 * mt2 * t * segment.control1.y +
      3 * mt * t2 * segment.control2.y +
      t3 * segment.end.y,
  }
}

function getTangentOnCubicBezier(t: number, segment: Segment): number {
  const mt = 1 - t
  const mt2 = mt * mt
  const t2 = t * t

  const dx =
    3 * mt2 * (segment.control1.x - segment.start.x) +
    6 * mt * t * (segment.control2.x - segment.control1.x) +
    3 * t2 * (segment.end.x - segment.control2.x)

  const dy =
    3 * mt2 * (segment.control1.y - segment.start.y) +
    6 * mt * t * (segment.control2.y - segment.control1.y) +
    3 * t2 * (segment.end.y - segment.control2.y)

  return Math.atan2(dy, dx) * (180 / Math.PI)
}

function getSegments(points: Array<Point>): Array<Segment> {
  return points.slice(0, -1).map((start, index) => {
    const end = points[index + 1]
    const controlOffset = (end.x - start.x) * 0.35

    return {
      start,
      control1: { x: start.x + controlOffset, y: start.y },
      control2: { x: end.x - controlOffset, y: end.y },
      end,
    }
  })
}

function getFootprints(segments: Array<Segment>): Array<Footprint> {
  const footprints: Array<Footprint> = []
  let footprintIndex = 0

  segments.forEach((segment) => {
    const distance = Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y)
    const steps = Math.max(4, Math.round(distance / 9))

    for (let step = 1; step <= steps; step += 1) {
      const t = step / (steps + 1)
      const point = getPointOnCubicBezier(t, segment)
      const angle = getTangentOnCubicBezier(t, segment)
      const isLeft = footprintIndex % 2 === 0
      const lateralOffset = isLeft ? -2.1 : 2.1
      const radians = ((angle + 90) * Math.PI) / 180
      const forwardRadians = (angle * Math.PI) / 180
      const longitudinalOffset = isLeft ? -0.6 : 0.6

      footprints.push({
        x:
          point.x +
          Math.cos(radians) * lateralOffset +
          Math.cos(forwardRadians) * longitudinalOffset,
        y:
          point.y +
          Math.sin(radians) * lateralOffset +
          Math.sin(forwardRadians) * longitudinalOffset,
        rotation: angle + (isLeft ? -18 : 18),
        isLeft,
      })

      footprintIndex += 1
    }
  })

  return footprints
}

export function JourneyConnector({ count }: JourneyConnectorProps) {
  const points = getJourneyPoints(count)

  if (points.length === 0) {
    return null
  }

  const cubicSegments = getSegments(points)
  const footprints = getFootprints(cubicSegments)

  return (
    <svg
      aria-hidden="true"
      data-journey-connector="true"
      data-journey-footprints="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={journeyConnectorClassNames.canvas}
    >
      <path
        d={`M 0 64 Q 4 58, ${points[0]?.x ?? 12.5} ${points[0]?.y ?? 56}`}
        fill="none"
        stroke="transparent"
        strokeWidth="1"
      />
      {cubicSegments.map((segment, index) => (
        <path
          key={index}
          d={buildSegmentPath(segment.start, segment.end)}
          fill="none"
          stroke="transparent"
          strokeWidth="1"
        />
      ))}
      {footprints.map((point, index) => (
        <g key={index} transform={`translate(${point.x} ${point.y}) rotate(${point.rotation})`}>
          {/* sole */}
          <path
            d={
              point.isLeft
                ? 'M -2.4 -7.5 Q -3.4 -5 -3.2 -1.5 Q -3 1.5 -0.8 2.8 Q 0.5 3.4 2.4 1.5 Q 3.4 -0.5 3.1 -4 Q 2.7 -7.5 0.2 -8.5 Q -1.3 -8.8 -2.4 -7.5 Z'
                : 'M 2.4 -7.5 Q 3.4 -5 3.2 -1.5 Q 3 1.5 0.8 2.8 Q -0.5 3.4 -2.4 1.5 Q -3.4 -0.5 -3.1 -4 Q -2.7 -7.5 -0.2 -8.5 Q 1.3 -8.8 2.4 -7.5 Z'
            }
            fill={journeyConnectorClassNames.footprintFill}
            opacity="0.9"
          />
          {/* heel */}
          <ellipse cx="0" cy="7" rx="1.8" ry="2.2" fill={journeyConnectorClassNames.footprintFill} opacity="0.9" />
        </g>
      ))}
    </svg>
  )
}
