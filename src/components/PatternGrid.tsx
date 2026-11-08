import React, { useRef, useState, useEffect, useCallback } from 'react';
import { CustomGridStyle, GridSize, NodeShape, ThemeConfig } from '../types.ts';
import { getCoordinates, getIntermediateNodes } from '../utils/patternLogic.ts';
import { playDotSound, triggerHaptic } from '../utils/sound.ts';

interface PatternGridProps {
  gridSize?: GridSize;
  theme: ThemeConfig;
  status?: 'idle' | 'drawing' | 'success' | 'error';
  hideTrail?: boolean;
  soundEnabled?: boolean;
  hapticsEnabled?: boolean;
  disabled?: boolean;
  onPatternChange?: (pattern: number[]) => void;
  onPatternComplete: (pattern: number[]) => void;
  // External preview/animation pattern (for demo or memory challenge)
  highlightPattern?: number[];
  showNumbers?: boolean;
  customStyle?: Partial<CustomGridStyle>;
}

export const PatternGrid: React.FC<PatternGridProps> = ({
  gridSize = 3,
  theme,
  status = 'idle',
  hideTrail = false,
  soundEnabled = true,
  hapticsEnabled = true,
  disabled = false,
  onPatternChange,
  onPatternComplete,
  highlightPattern,
  showNumbers = false,
  customStyle,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedDots, setSelectedDots] = useState<number[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 300, height: 300 });

  // Update container dimensions
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const size = Math.min(rect.width, rect.height || rect.width);
        setDimensions({ width: size, height: size });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Sync external highlighted pattern (e.g. for Memory Game or Presets)
  useEffect(() => {
    if (highlightPattern && highlightPattern.length > 0) {
      setSelectedDots(highlightPattern);
    } else if (!isDrawing) {
      setSelectedDots([]);
    }
  }, [highlightPattern, isDrawing]);

  // Dot coordinates in SVG space [0..100]
  const dotCoords = useCallback(
    (index: number) => {
      const { row, col } = getCoordinates(index, gridSize);
      const step = 100 / (gridSize + 1);
      const x = step * (col + 1);
      const y = step * (row + 1);
      return { x, y };
    },
    [gridSize]
  );

  // Check if pointer is near a dot
  const getDotUnderPointer = useCallback(
    (pointerX: number, pointerY: number): number | null => {
      if (!containerRef.current) return null;
      const rect = containerRef.current.getBoundingClientRect();
      const relX = ((pointerX - rect.left) / rect.width) * 100;
      const relY = ((pointerY - rect.top) / rect.height) * 100;

      // Hitbox radius: smaller for 4x4 and 5x5
      const hitRadius = gridSize === 3 ? 12 : gridSize === 4 ? 9 : 7;

      const totalDots = gridSize * gridSize;
      for (let i = 0; i < totalDots; i++) {
        const { x, y } = dotCoords(i);
        const dist = Math.hypot(relX - x, relY - y);
        if (dist <= hitRadius) {
          return i;
        }
      }
      return null;
    },
    [dotCoords, gridSize]
  );

  const addDot = useCallback(
    (dotId: number, currentList: number[]) => {
      if (currentList.includes(dotId)) return currentList;

      const visited = new Set(currentList);
      let updated = [...currentList];

      if (currentList.length > 0) {
        const lastDot = currentList[currentList.length - 1];
        const intermediate = getIntermediateNodes(lastDot, dotId, gridSize, visited);

        // Add intermediate nodes first
        for (const inter of intermediate) {
          if (!updated.includes(inter)) {
            updated.push(inter);
            visited.add(inter);
            playDotSound(updated.length - 1, soundEnabled);
            triggerHaptic('light', hapticsEnabled);
          }
        }
      }

      updated.push(dotId);
      playDotSound(updated.length - 1, soundEnabled);
      triggerHaptic('medium', hapticsEnabled);

      if (onPatternChange) {
        onPatternChange(updated);
      }
      return updated;
    },
    [gridSize, hapticsEnabled, onPatternChange, soundEnabled]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // pointer capture fallback
    }

    const dot = getDotUnderPointer(e.clientX, e.clientY);
    setIsDrawing(true);

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * 100;
    const relY = ((e.clientY - rect.top) / rect.height) * 100;
    setCurrentPos({ x: relX, y: relY });

    if (dot !== null) {
      const next = addDot(dot, []);
      setSelectedDots(next);
    } else {
      setSelectedDots([]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || disabled) return;

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const relY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setCurrentPos({ x: relX, y: relY });

    const dot = getDotUnderPointer(e.clientX, e.clientY);
    if (dot !== null && !selectedDots.includes(dot)) {
      setSelectedDots((prev) => addDot(dot, prev));
    }
  };

  const finishDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setCurrentPos(null);

    if (selectedDots.length > 0) {
      onPatternComplete(selectedDots);
    }
  };

  const handlePointerUp = () => {
    finishDrawing();
  };

  const handlePointerCancel = () => {
    finishDrawing();
  };

  // Determine active visual styles
  const shape: NodeShape = customStyle?.nodeShape || theme.nodeShape || 'dots';
  const customNodeColor = customStyle?.nodeColor || theme.dotColor;
  const customConnColor = customStyle?.connectionColor || theme.dotActiveColor;
  const customSuccColor = customStyle?.successColor || theme.dotSuccessColor;
  const customErrColor = customStyle?.errorColor || theme.dotErrorColor;

  // Color selection based on status
  const currentLineColor =
    status === 'error'
      ? customErrColor
      : status === 'success'
      ? customSuccColor
      : customConnColor;

  // Line width multiplier
  const widthMode = customStyle?.lineWidth || 'medium';
  const baseLineWidth = widthMode === 'thin' ? (gridSize === 3 ? 1.8 : 1.4) : widthMode === 'thick' ? (gridSize === 3 ? 4.2 : 3.2) : (gridSize === 3 ? 2.8 : 2.2);

  const glowIntensity = customStyle?.glowIntensity || 'vibrant';
  const glowDrop = glowIntensity === 'none' ? 'none' : glowIntensity === 'subtle' ? `drop-shadow(0 0 3px ${currentLineColor}66)` : `drop-shadow(0 0 7px ${currentLineColor}bb)`;

  const totalDots = gridSize * gridSize;
  const isDisplayingDots = highlightPattern && highlightPattern.length > 0 ? highlightPattern : selectedDots;

  // Dot radius scale
  const dotRadius = gridSize === 3 ? 4.2 : gridSize === 4 ? 3.4 : 2.7;
  const activeDotRadius = gridSize === 3 ? 6.2 : gridSize === 4 ? 5.0 : 4.0;
  const outerRingRadius = gridSize === 3 ? 12.0 : gridSize === 4 ? 9.5 : 7.5;

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className={`relative w-full aspect-square max-w-[340px] mx-auto select-none touch-none cursor-crosshair rounded-3xl p-2 transition-all ${
        status === 'error' ? 'animate-shake' : ''
      }`}
      style={{ touchAction: 'none' }}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full overflow-visible drop-shadow-md"
      >
        {/* Decorative Grid Background (if configured) */}
        {customStyle?.gridBg === 'grid' && (
          <g stroke="rgba(255, 255, 255, 0.04)" strokeWidth="0.5">
            {Array.from({ length: gridSize }).map((_, r) => {
              const { y } = dotCoords(r * gridSize);
              return <line key={`h-${r}`} x1="8" y1={y} x2="92" y2={y} strokeDasharray="1 3" />;
            })}
            {Array.from({ length: gridSize }).map((_, c) => {
              const { x } = dotCoords(c);
              return <line key={`v-${c}`} x1={x} y1="8" x2={x} y2="92" strokeDasharray="1 3" />;
            })}
          </g>
        )}

        {customStyle?.gridBg === 'radar' && (
          <g stroke="rgba(255, 255, 255, 0.05)" strokeWidth="0.5" fill="none">
            <circle cx="50" cy="50" r="22" strokeDasharray="2 2" />
            <circle cx="50" cy="50" r="38" strokeDasharray="2 2" />
            <line x1="50" y1="10" x2="50" y2="90" strokeDasharray="1 3" />
            <line x1="10" y1="50" x2="90" y2="50" strokeDasharray="1 3" />
          </g>
        )}

        {/* Connection Lines */}
        {!hideTrail && (
          <g>
            {/* Committed lines */}
            {isDisplayingDots.map((dotId, idx) => {
              if (idx === 0) return null;
              const prev = dotCoords(isDisplayingDots[idx - 1]);
              const curr = dotCoords(dotId);
              return (
                <line
                  key={`line-${idx}`}
                  x1={prev.x}
                  y1={prev.y}
                  x2={curr.x}
                  y2={curr.y}
                  stroke={currentLineColor}
                  strokeWidth={baseLineWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-colors duration-150"
                  style={{
                    filter: glowDrop,
                  }}
                />
              );
            })}

            {/* Live line tracking cursor/finger */}
            {isDrawing && currentPos && selectedDots.length > 0 && status !== 'error' && (
              <line
                x1={dotCoords(selectedDots[selectedDots.length - 1]).x}
                y1={dotCoords(selectedDots[selectedDots.length - 1]).y}
                x2={currentPos.x}
                y2={currentPos.y}
                stroke={currentLineColor}
                strokeWidth={baseLineWidth * 0.8}
                strokeDasharray="2 1"
                strokeLinecap="round"
                className="opacity-75"
              />
            )}
          </g>
        )}

        {/* Nodes / Dots with selectable geometric shapes */}
        {Array.from({ length: totalDots }).map((_, id) => {
          const { x, y } = dotCoords(id);
          const isSelected = isDisplayingDots.includes(id);
          const selectionOrder = isDisplayingDots.indexOf(id);

          let nodeColor = customNodeColor;
          if (isSelected) {
            if (status === 'error') nodeColor = customErrColor;
            else if (status === 'success') nodeColor = customSuccColor;
            else nodeColor = customConnColor;
          }

          const currentR = isSelected ? activeDotRadius : dotRadius;
          const squareSize = currentR * 1.8;
          const diamondR = currentR * 1.25;

          return (
            <g key={`dot-${id}`} className="transition-transform duration-150">
              {/* Outer touch target hitbox */}
              <circle
                cx={x}
                cy={y}
                r={outerRingRadius}
                fill="transparent"
                className="cursor-pointer"
              />

              {/* Halo when selected */}
              {isSelected && (
                <circle
                  cx={x}
                  cy={y}
                  r={outerRingRadius}
                  fill={nodeColor}
                  fillOpacity="0.16"
                  stroke={nodeColor}
                  strokeWidth="0.8"
                  strokeOpacity="0.6"
                  className="animate-pulse"
                />
              )}

              {/* Geometric Node Shape Rendering */}
              {shape === 'dots' && (
                <circle
                  cx={x}
                  cy={y}
                  r={currentR}
                  fill={nodeColor}
                  stroke={isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.15)'}
                  strokeWidth={isSelected ? '0.9' : '0.4'}
                  style={{
                    filter: isSelected && glowIntensity !== 'none' ? `drop-shadow(0 0 6px ${nodeColor})` : 'none',
                    transition: 'all 0.12s ease',
                  }}
                />
              )}

              {shape === 'circles' && (
                <g>
                  {/* Outer hollow ring */}
                  <circle
                    cx={x}
                    cy={y}
                    r={currentR * 1.3}
                    fill={isSelected ? `${nodeColor}33` : 'transparent'}
                    stroke={nodeColor}
                    strokeWidth={isSelected ? '1.5' : '1.0'}
                    style={{
                      filter: isSelected && glowIntensity !== 'none' ? `drop-shadow(0 0 5px ${nodeColor})` : 'none',
                      transition: 'all 0.12s ease',
                    }}
                  />
                  {/* Inner center pinpoint */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isSelected ? currentR * 0.5 : currentR * 0.35}
                    fill={isSelected ? '#ffffff' : nodeColor}
                  />
                </g>
              )}

              {shape === 'squares' && (
                <rect
                  x={x - squareSize / 2}
                  y={y - squareSize / 2}
                  width={squareSize}
                  height={squareSize}
                  rx={squareSize * 0.25}
                  fill={nodeColor}
                  stroke={isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.15)'}
                  strokeWidth={isSelected ? '1.0' : '0.5'}
                  style={{
                    filter: isSelected && glowIntensity !== 'none' ? `drop-shadow(0 0 6px ${nodeColor})` : 'none',
                    transition: 'all 0.12s ease',
                  }}
                />
              )}

              {shape === 'diamonds' && (
                <polygon
                  points={`${x},${y - diamondR} ${x + diamondR},${y} ${x},${y + diamondR} ${x - diamondR},${y}`}
                  fill={nodeColor}
                  stroke={isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.15)'}
                  strokeWidth={isSelected ? '1.0' : '0.5'}
                  style={{
                    filter: isSelected && glowIntensity !== 'none' ? `drop-shadow(0 0 6px ${nodeColor})` : 'none',
                    transition: 'all 0.12s ease',
                  }}
                />
              )}

              {/* Optional Step Sequence Number inside node */}
              {showNumbers && isSelected && (
                <text
                  x={x}
                  y={y + 0.8}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#ffffff"
                  fontSize={gridSize === 3 ? '3.5' : '2.8'}
                  fontWeight="bold"
                  fontFamily="sans-serif"
                  className="pointer-events-none select-none drop-shadow"
                >
                  {selectionOrder + 1}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
