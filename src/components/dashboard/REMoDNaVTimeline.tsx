/**
 * REMoDNaV Timeline Visualization
 * Horizontal timeline showing saccades, fixations, PSOs, and regressions
 */

import { useRef, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { ZoomIn, ZoomOut, Download, Play, Pause, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import type { MovementEvent } from '@/hooks/useREMoDNaVClassifier';

interface REMoDNaVTimelineProps {
  events: MovementEvent[];
  totalDuration: number;
  currentTime?: number;
  onTimeSeek?: (time: number) => void;
  isPlaying?: boolean;
  onPlayPause?: () => void;
}

const EVENT_COLORS = {
  fixation: '#3b82f6', // blue
  saccade: '#f97316', // orange
  pso: '#a855f7', // purple
  glissade: '#ec4899', // pink
  blink: '#6b7280', // gray
  unknown: '#9ca3af', // light gray
};

const REGRESSION_COLOR = '#ef4444'; // red

export function REMoDNaVTimeline({
  events,
  totalDuration,
  currentTime = 0,
  onTimeSeek,
  isPlaying = false,
  onPlayPause,
}: REMoDNaVTimelineProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<MovementEvent | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<MovementEvent | null>(null);

  const width = 800;
  const height = 120;
  const padding = { top: 20, bottom: 30, left: 50, right: 20 };
  const timelineHeight = 40;

  const visibleDuration = totalDuration / zoom;
  const startTime = events.length > 0 ? events[0].startTime : 0;

  const xScale = (time: number) => {
    const relativeTime = time - startTime - panOffset;
    return padding.left + (relativeTime / visibleDuration) * (width - padding.left - padding.right);
  };

  const timeFromX = (x: number) => {
    const relativeX = x - padding.left;
    const fraction = relativeX / (width - padding.left - padding.right);
    return startTime + panOffset + fraction * visibleDuration;
  };

  const visibleEvents = useMemo(() => {
    const viewStart = startTime + panOffset;
    const viewEnd = viewStart + visibleDuration;
    return events.filter(
      (e) => e.endTime >= viewStart && e.startTime <= viewEnd
    );
  }, [events, startTime, panOffset, visibleDuration]);

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || !onTimeSeek) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = timeFromX(x);
    onTimeSeek(Math.max(startTime, Math.min(time, startTime + totalDuration)));
  };

  const handleExport = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'remodnav-timeline.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (ms: number) => {
    const seconds = ms / 1000;
    return seconds < 60 ? `${seconds.toFixed(1)}s` : `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(0).padStart(2, '0')}`;
  };

  // Generate time ticks
  const tickCount = 10;
  const tickInterval = visibleDuration / tickCount;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => startTime + panOffset + i * tickInterval);

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Eye Movement Timeline</CardTitle>
          <div className="flex items-center gap-2">
            {/* Legend */}
            <div className="flex gap-2 text-xs">
              {Object.entries(EVENT_COLORS).slice(0, 4).map(([type, color]) => (
                <div key={type} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
                  <span className="capitalize">{type}</span>
                </div>
              ))}
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: REGRESSION_COLOR }} />
                <span>Regression</span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Controls */}
        <div className="flex items-center gap-3">
          {onPlayPause && (
            <Button size="sm" variant="outline" onClick={onPlayPause}>
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
          )}
          <div className="flex items-center gap-2">
            <ZoomOut className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[zoom]}
              onValueChange={([v]) => setZoom(v)}
              min={1}
              max={10}
              step={0.5}
              className="w-24"
            />
            <ZoomIn className="h-4 w-4 text-muted-foreground" />
          </div>
          <Button size="sm" variant="ghost" onClick={() => { setZoom(1); setPanOffset(0); }}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={handleExport}>
            <Download className="h-4 w-4" />
          </Button>
          {selectedEvent && (
            <Badge variant="secondary" className="ml-auto">
              {selectedEvent.type}: {selectedEvent.duration.toFixed(0)}ms
              {selectedEvent.isRegression && ' (Regression)'}
            </Badge>
          )}
        </div>

        {/* Pan slider for zoomed view */}
        {zoom > 1 && (
          <Slider
            value={[panOffset]}
            onValueChange={([v]) => setPanOffset(v)}
            min={0}
            max={totalDuration - visibleDuration}
            step={100}
            className="w-full"
          />
        )}

        {/* SVG Timeline */}
        <div className="relative overflow-hidden rounded-lg bg-muted/30">
          <svg
            ref={svgRef}
            width="100%"
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="cursor-crosshair"
            onClick={handleSvgClick}
          >
            {/* Background grid */}
            {ticks.map((tick, i) => (
              <g key={i}>
                <line
                  x1={xScale(tick)}
                  y1={padding.top}
                  x2={xScale(tick)}
                  y2={height - padding.bottom}
                  stroke="currentColor"
                  strokeOpacity={0.1}
                  strokeDasharray="2,2"
                />
                <text
                  x={xScale(tick)}
                  y={height - 10}
                  textAnchor="middle"
                  fontSize={10}
                  fill="currentColor"
                  opacity={0.5}
                >
                  {formatTime(tick - startTime)}
                </text>
              </g>
            ))}

            {/* Events */}
            {visibleEvents.map((event, i) => {
              const x = xScale(event.startTime);
              const eventWidth = Math.max(2, ((event.duration) / visibleDuration) * (width - padding.left - padding.right));
              const color = event.isRegression ? REGRESSION_COLOR : EVENT_COLORS[event.type];
              const isSelected = selectedEvent === event;
              const isHovered = hoveredEvent === event;

              return (
                <motion.g
                  key={`${event.startTime}-${i}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onMouseEnter={() => setHoveredEvent(event)}
                  onMouseLeave={() => setHoveredEvent(null)}
                  onClick={(e) => { e.stopPropagation(); setSelectedEvent(event); }}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    x={x}
                    y={padding.top + 5}
                    width={eventWidth}
                    height={timelineHeight}
                    fill={color}
                    opacity={isSelected || isHovered ? 1 : 0.7}
                    rx={2}
                    stroke={isSelected ? 'white' : 'none'}
                    strokeWidth={2}
                  />
                  {/* Amplitude indicator for saccades */}
                  {event.type === 'saccade' && eventWidth > 20 && (
                    <line
                      x1={x + eventWidth / 2}
                      y1={padding.top + 5 + timelineHeight / 2}
                      x2={x + eventWidth / 2 + (event.isRegression ? -8 : 8)}
                      y2={padding.top + 5 + timelineHeight / 2}
                      stroke="white"
                      strokeWidth={2}
                      markerEnd="url(#arrow)"
                    />
                  )}
                </motion.g>
              );
            })}

            {/* Current time indicator */}
            {currentTime > 0 && (
              <line
                x1={xScale(currentTime)}
                y1={padding.top}
                x2={xScale(currentTime)}
                y2={height - padding.bottom}
                stroke="hsl(var(--primary))"
                strokeWidth={2}
              />
            )}

            {/* Arrow marker definition */}
            <defs>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX={5}
                refY={5}
                markerWidth={4}
                markerHeight={4}
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="white" />
              </marker>
            </defs>
          </svg>

          {/* Hover tooltip */}
          {hoveredEvent && (
            <div
              className="absolute bg-popover text-popover-foreground p-2 rounded shadow-lg text-xs pointer-events-none z-10"
              style={{
                left: Math.min(xScale(hoveredEvent.startTime), width - 150),
                top: padding.top - 5,
              }}
            >
              <p className="font-medium capitalize">{hoveredEvent.type}</p>
              <p>Duration: {hoveredEvent.duration.toFixed(0)}ms</p>
              <p>Velocity: {hoveredEvent.peakVelocity.toFixed(1)}°/s</p>
              {hoveredEvent.isRegression && <p className="text-red-500">← Regression</p>}
            </div>
          )}
        </div>

        {/* Summary stats */}
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Total: {events.length} events</span>
          <span>Duration: {formatTime(totalDuration)}</span>
          <span>
            Fixations: {events.filter(e => e.type === 'fixation').length} |
            Saccades: {events.filter(e => e.type === 'saccade').length} |
            Regressions: {events.filter(e => e.isRegression).length}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
