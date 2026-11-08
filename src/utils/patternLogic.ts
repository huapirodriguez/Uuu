import { GridSize, PatternPreset, PatternSecurityReport } from '../types.ts';

/**
 * Returns { row, col } (0-indexed) for a given dot ID in a N x N grid.
 */
export function getCoordinates(id: number, size: GridSize): { row: number; col: number } {
  return {
    row: Math.floor(id / size),
    col: id % size,
  };
}

/**
 * Returns dot ID for a given { row, col } in a N x N grid.
 */
export function getIdFromCoordinates(row: number, col: number, size: GridSize): number {
  return row * size + col;
}

/**
 * Greatest common divisor
 */
function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

/**
 * Genuine Android pass-through node solver:
 * When moving from `fromId` to `toId`, finds any intermediate nodes along the direct ray.
 * If any intermediate node hasn't been visited yet, it must be automatically collected first!
 */
export function getIntermediateNodes(
  fromId: number,
  toId: number,
  size: GridSize,
  visited: Set<number>
): number[] {
  const p1 = getCoordinates(fromId, size);
  const p2 = getCoordinates(toId, size);

  const deltaRow = p2.row - p1.row;
  const deltaCol = p2.col - p1.col;
  const divisor = gcd(deltaRow, deltaCol);

  if (divisor <= 1) {
    return [];
  }

  const stepRow = deltaRow / divisor;
  const stepCol = deltaCol / divisor;

  const result: number[] = [];
  for (let i = 1; i < divisor; i++) {
    const r = p1.row + stepRow * i;
    const c = p1.col + stepCol * i;
    const interId = getIdFromCoordinates(r, c, size);
    if (!visited.has(interId)) {
      result.push(interId);
    }
  }

  return result;
}

/**
 * Check if two patterns are identical
 */
export function arePatternsEqual(p1: number[], p2: number[]): boolean {
  if (p1.length !== p2.length) return false;
  return p1.every((val, idx) => val === p2[idx]);
}

/**
 * Analyze pattern security strength, entropy, and vulnerabilities
 */
export function analyzePatternSecurity(pattern: number[], size: GridSize): PatternSecurityReport {
  const len = pattern.length;

  if (len === 0) {
    return {
      score: 0,
      rating: 'Muy débil',
      color: 'text-rose-400',
      entropyBits: 0,
      totalCombinations: '0',
      length: 0,
      directionChanges: 0,
      crossovers: 0,
      knightMoves: 0,
      warnings: ['Dibuja al menos 4 puntos para comenzar.'],
      tips: ['Los patrones seguros utilizan al menos 6 o 7 nodos y cruzan el centro.'],
    };
  }

  if (len < 4) {
    return {
      score: Math.min(25, len * 8),
      rating: 'Muy débil',
      color: 'text-rose-500',
      entropyBits: Math.round(len * 2.8),
      totalCombinations: '< 500',
      length: len,
      directionChanges: 0,
      crossovers: 0,
      knightMoves: 0,
      warnings: ['Demasiado corto: se requieren al menos 4 nodos por estándar de seguridad.'],
      tips: ['Añade más nodos para evitar ataques de fuerza bruta.'],
    };
  }

  // Count direction changes and knight moves
  let directionChanges = 0;
  let knightMoves = 0;
  let crossovers = 0;

  for (let i = 0; i < len - 1; i++) {
    const c1 = getCoordinates(pattern[i], size);
    const c2 = getCoordinates(pattern[i + 1], size);
    const dr = Math.abs(c2.row - c1.row);
    const dc = Math.abs(c2.col - c1.col);

    if ((dr === 1 && dc === 2) || (dr === 2 && dc === 1)) {
      knightMoves++;
    }

    if (i < len - 2) {
      const c3 = getCoordinates(pattern[i + 2], size);
      const v1x = c2.col - c1.col;
      const v1y = c2.row - c1.row;
      const v2x = c3.col - c2.col;
      const v2y = c3.row - c2.row;

      // Cross product to detect change of angle
      if (v1x * v2y !== v1y * v2x) {
        directionChanges++;
      }
    }
  }

  // Segment intersections (crossovers)
  for (let i = 0; i < len - 1; i++) {
    const p1 = getCoordinates(pattern[i], size);
    const p2 = getCoordinates(pattern[i + 1], size);

    for (let j = i + 2; j < len - 1; j++) {
      if (Math.abs(i - j) <= 1) continue;
      const p3 = getCoordinates(pattern[j], size);
      const p4 = getCoordinates(pattern[j + 1], size);

      if (segmentsIntersect(p1, p2, p3, p4)) {
        crossovers++;
      }
    }
  }

  // Shape recognition for 3x3
  let detectedShape: string | undefined;
  const patStr = pattern.join('-');
  const warnings: string[] = [];
  const tips: string[] = [];

  // Common predictable patterns (3x3)
  if (size === 3) {
    if (patStr === '0-1-2-5-8' || patStr === '0-3-6-7-8') detectedShape = 'Letra "L"';
    else if (patStr === '0-1-2-4-6-7-8') detectedShape = 'Letra "Z"';
    else if (patStr === '2-1-0-3-6-7-8') detectedShape = 'Letra "C"';
    else if (patStr === '6-3-0-4-8-5-2' || patStr === '6-3-0-4-2-5-8') detectedShape = 'Letra "N"';
    else if (patStr === '0-3-6-7-8-5-2') detectedShape = 'Letra "U"';
    else if (patStr === '0-1-2-5-8-7-6-3') detectedShape = 'Perímetro cuadrado';
    else if (patStr === '0-4-8' || patStr === '2-4-6') detectedShape = 'Línea diagonal';
    else if (patStr === '0-1-2-3-4-5-6-7-8') detectedShape = 'Lectura lineal continua';
  }

  if (detectedShape) {
    warnings.push(`Forma común detectada (${detectedShape}): Es uno de los patrones más predecibles en estudios de seguridad móvil.`);
  }

  // Starts from top-left (0) - 44% of people start from dot 0
  if (pattern[0] === 0) {
    warnings.push('Comienza en la esquina superior izquierda (utilizado por el 44% de los usuarios).');
  }

  // Length score (up to 40 pts)
  const maxSafeLen = size * size;
  const lenScore = Math.min(40, (len / 9) * 40);

  // Complexity score (up to 30 pts)
  const complexityScore = Math.min(30, directionChanges * 5 + knightMoves * 8 + crossovers * 10);

  // Non-adjacent jumps score (up to 20 pts)
  const jumpScore = Math.min(20, knightMoves * 10 + crossovers * 8);

  // Shape penalty
  let penalty = 0;
  if (detectedShape) penalty += 25;
  if (pattern[0] === 0) penalty += 5;
  if (len === 4) penalty += 15;

  let totalScore = Math.round(Math.max(10, Math.min(100, lenScore + complexityScore + jumpScore + 15 - penalty)));

  // Entropy estimate
  // 3x3 combinations: 4 dots ~ 1,624; 5 dots ~ 7,152; 6 dots ~ 26,016; 7 dots ~ 72,960; 8 dots ~ 140,704; 9 dots ~ 140,704. Total 3x3 = 389,112.
  const entropyBits = Math.min(19, Math.round(Math.log2(Math.max(100, Math.pow(size * size, len * 0.75)))));
  const totalCombinations = size === 3 ? '389,112' : size === 4 ? '> 1.6 × 10¹⁰' : '> 1.5 × 10²⁰';

  let rating: PatternSecurityReport['rating'] = 'Media';
  let color = 'text-amber-400';

  if (totalScore < 35) {
    rating = 'Muy débil';
    color = 'text-rose-400';
  } else if (totalScore < 55) {
    rating = 'Débil';
    color = 'text-orange-400';
  } else if (totalScore < 75) {
    rating = 'Media';
    color = 'text-amber-400';
  } else if (totalScore < 90) {
    rating = 'Fuerte';
    color = 'text-emerald-400';
  } else {
    rating = 'Excelente';
    color = 'text-cyan-400';
  }

  if (len < 6) {
    tips.push('Aumenta el número de nodos a 6 o más para incrementar el espacio de claves.');
  }
  if (knightMoves === 0) {
    tips.push('Incorpora movimientos en "L" (salto de caballo) para despistar a observadores físicos.');
  }
  if (crossovers === 0) {
    tips.push('Cruzar líneas crea intersecciones que dificultan el análisis de manchas en pantalla.');
  }
  if (pattern[0] === 0 || pattern[0] === 2) {
    tips.push('Comenzar en el centro o en el cuadrante inferior rompe los patrones más frecuentes.');
  }

  return {
    score: totalScore,
    rating,
    color,
    entropyBits,
    totalCombinations,
    length: len,
    directionChanges,
    crossovers,
    knightMoves,
    detectedShape,
    warnings,
    tips,
  };
}

// Helper: check if two 2D line segments cross
function segmentsIntersect(
  a: { row: number; col: number },
  b: { row: number; col: number },
  c: { row: number; col: number },
  d: { row: number; col: number }
): boolean {
  function ccw(p1: { row: number; col: number }, p2: { row: number; col: number }, p3: { row: number; col: number }) {
    return (p3.row - p1.row) * (p2.col - p1.col) > (p2.row - p1.row) * (p3.col - p1.col);
  }
  return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
}

/**
 * Curated preset patterns for demonstrations & training
 */
export const PRESET_PATTERNS: PatternPreset[] = [
  {
    id: 'ninja-star',
    name: 'Estrella Ninja',
    description: 'Cruces diagonales en 4 direcciones con 8 nodos entrelazados.',
    pattern: [4, 0, 7, 2, 3, 8, 1, 6],
    difficulty: 'Difícil',
    shape: 'Estrella simétrica',
  },
  {
    id: 'hourglass',
    name: 'Reloj de Arena',
    description: 'Doble triángulo invertido que pasa por el nodo central.',
    pattern: [0, 1, 2, 4, 6, 7, 8, 4],
    difficulty: 'Medio',
    shape: 'Reloj de arena',
  },
  {
    id: 'quantum-key',
    name: 'Llave Cuántica',
    description: 'Movimientos de caballo combinados con cruces no adyacentes.',
    pattern: [4, 1, 8, 3, 2, 7, 0, 5],
    difficulty: 'Extremo',
    shape: 'Complejo ortogonal',
  },
  {
    id: 'spiral-cipher',
    name: 'Espiral Cifrada',
    description: 'Espiral concéntrica en sentido horario desde el exterior hacia el núcleo.',
    pattern: [0, 1, 2, 5, 8, 7, 6, 3, 4],
    difficulty: 'Medio',
    shape: 'Espiral 9 nodos',
  },
  {
    id: 'shield',
    name: 'Escudo Blindado',
    description: 'Geometría defensiva con salto inverso y anclaje central.',
    pattern: [1, 6, 8, 1, 4, 7],
    difficulty: 'Fácil',
    shape: 'Escudo triangular',
  },
];
