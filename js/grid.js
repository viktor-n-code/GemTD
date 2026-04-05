/**
 * grid.js - Game grid and pathfinding
 * Manages the game grid layout, tower placement validation, and enemy pathfinding.
 *
 * Grid is 42 columns × 47 rows, 1-indexed on both axes.
 * Access cells as grid[y][x].
 *
 * Cell types:
 *   'empty'   — open cell, traversable by enemies, tower can be placed here
 *   'rock'    — placed stone tower, NOT traversable (blocks maze)
 *   'gem'     — placed gem tower, NOT traversable (blocks maze)
 *   'blocked' — special zone (checkpoints, entry, exit, borders),
 *               traversable by enemies but CANNOT place towers
 *
 * For pathfinding enemies can pass through 'empty' and 'blocked' cells only.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const GRID_COLS = 42;
export const GRID_ROWS = 47;
export const CELL_SIZE = 16; // pixels per cell

export const ENTRY = { x: 1, y: 9 };
export const EXIT  = { x: 42, y: 35 };

// Each checkpoint stores the top-left cell of the 2×2 aim-point block.
// Enemies aim for the corner between that block's 4 tiles, which in pixels
// is (cp.x * CELL_SIZE, cp.y * CELL_SIZE) — see enemy.js moveEnemy.
export const CHECKPOINTS = [
  { x: 9,  y: 9  }, // CP1 — aim corner of (9,9)–(10,10), arrow points south
  { x: 9,  y: 23 }, // CP2 — aim corner of (9,23)–(10,24), arrow points east
  { x: 33, y: 23 }, // CP3 — aim corner of (33,23)–(34,24), arrow points north
  { x: 33, y: 9  }, // CP4 — aim corner of (33,9)–(34,10), arrow points west
  { x: 21, y: 9  }, // CP5 — aim corner of (21,9)–(22,10), arrow points south
  { x: 21, y: 35 }, // CP6 — aim corner of (21,35)–(22,36), arrow points east
];

// ---------------------------------------------------------------------------
// Blocked-zone definitions
// Every cell in these ranges is pre-marked 'blocked' (no tower placement).
// Checkpoint cells themselves are inside the playable corridor so they remain
// 'empty' — they are listed in CHECKPOINTS above and must stay traversable.
// ---------------------------------------------------------------------------

// Each checkpoint arrow is 16 tiles: a 6×2 body bar + a 2×2 tip pointing
// toward the next checkpoint.  The 2×2 aim-point block sits at the centre of
// the body; enemies aim for the corner between those 4 tiles.
// Entry/exit are 2-tile strips on the left/right border (already covered by
// the border marking, listed here for clarity and renderer reference).
const BLOCKED_ZONES = [
  // Entry — 2 tiles on left border (x=1, y=9–10)
  { x1: 1,  y1: 9,  x2: 1,  y2: 10 },
  // Exit  — 2 tiles on right border (x=42, y=35–36)
  { x1: 42, y1: 35, x2: 42, y2: 36 },
  // CP1 (aim 9,9): arrives from west, tip points south
  { x1: 7,  y1: 9,  x2: 12, y2: 10 }, // body (horizontal)
  { x1: 9,  y1: 11, x2: 10, y2: 12 }, // tip  (south)
  // CP2 (aim 9,23): arrives from north, tip points east
  { x1: 9,  y1: 21, x2: 10, y2: 26 }, // body (vertical)
  { x1: 11, y1: 23, x2: 12, y2: 24 }, // tip  (east)
  // CP3 (aim 33,23): arrives from west, tip points north
  { x1: 31, y1: 23, x2: 36, y2: 24 }, // body (horizontal)
  { x1: 33, y1: 21, x2: 34, y2: 22 }, // tip  (north)
  // CP4 (aim 33,9): arrives from south, tip points west
  { x1: 33, y1: 7,  x2: 34, y2: 12 }, // body (vertical)
  { x1: 31, y1: 9,  x2: 32, y2: 10 }, // tip  (west)
  // CP5 (aim 21,9): arrives from east, tip points south
  { x1: 19, y1: 9,  x2: 24, y2: 10 }, // body (horizontal)
  { x1: 21, y1: 11, x2: 22, y2: 12 }, // tip  (south)
  // CP6 (aim 21,35): arrives from north, tip points east
  { x1: 21, y1: 33, x2: 22, y2: 38 }, // body (vertical)
  { x1: 23, y1: 35, x2: 24, y2: 36 }, // tip  (east)
];

// ---------------------------------------------------------------------------
// createGrid
// ---------------------------------------------------------------------------

/**
 * Creates a new 1-indexed 2D grid (grid[y][x]).
 * Rows: y=1..GRID_ROWS, Cols: x=1..GRID_COLS.
 *
 * @returns {Array} 2D array of cell objects { type, gemId }
 */
export function createGrid() {
  // Allocate grid[y][x]; indices 0 are unused (1-indexed).
  const grid = new Array(GRID_ROWS + 1);
  for (let y = 0; y <= GRID_ROWS; y++) {
    grid[y] = new Array(GRID_COLS + 1);
    for (let x = 0; x <= GRID_COLS; x++) {
      grid[y][x] = { type: 'empty', gemId: null };
    }
  }

  // Mark all predefined blocked zones.
  for (const zone of BLOCKED_ZONES) {
    for (let y = zone.y1; y <= zone.y2; y++) {
      for (let x = zone.x1; x <= zone.x2; x++) {
        if (y >= 1 && y <= GRID_ROWS && x >= 1 && x <= GRID_COLS) {
          grid[y][x].type = 'blocked';
        }
      }
    }
  }

  // Checkpoint cells must remain traversable ('empty') even if a blocked-zone
  // rectangle would otherwise cover them.  The ENTRY and EXIT cells are
  // already inside their respective blocked zones, but enemies start/end
  // there, so they too must be 'blocked' (traversable, no tower allowed) —
  // they are already handled correctly by the border + zone marking above.
  // Checkpoint cells (CP1-CP6) are the exact waypoints enemies travel through;
  // restore them to 'empty' so pathfinding can traverse them freely.
  for (const cp of CHECKPOINTS) {
    if (cp.y >= 1 && cp.y <= GRID_ROWS && cp.x >= 1 && cp.x <= GRID_COLS) {
      // Only change to 'empty' if currently 'blocked' (from a zone overlap).
      // This ensures the actual checkpoint cell is always traversable and that
      // A* can treat it as a normal open cell.
      if (grid[cp.y][cp.x].type === 'blocked') {
        grid[cp.y][cp.x].type = 'empty';
      }
    }
  }

  return grid;
}

// ---------------------------------------------------------------------------
// findPath  (A*)
// ---------------------------------------------------------------------------

/**
 * A* pathfinding through the grid.
 *
 * Passable cell types: 'empty', 'blocked'.
 * Impassable: 'rock', 'gem'.
 *
 * @param {Array}  grid - The game grid (grid[y][x])
 * @param {{x:number,y:number}} from - Start cell (1-indexed)
 * @param {{x:number,y:number}} to   - End cell (1-indexed)
 * @returns {Array<{x:number,y:number}>|null} Path from→to inclusive, or null
 */
export function findPath(grid, from, to) {
  if (!from || !to) return null;

  const { x: sx, y: sy } = from;
  const { x: ex, y: ey } = to;

  // Quick bounds check
  if (sx < 1 || sx > GRID_COLS || sy < 1 || sy > GRID_ROWS) return null;
  if (ex < 1 || ex > GRID_COLS || ey < 1 || ey > GRID_ROWS) return null;

  // Already there
  if (sx === ex && sy === ey) return [{ x: sx, y: sy }];

  const isPassable = (x, y) => {
    if (x < 1 || x > GRID_COLS || y < 1 || y > GRID_ROWS) return false;
    const t = grid[y][x].type;
    return t === 'empty' || t === 'blocked';
  };

  const heuristic = (x, y) => Math.abs(x - ex) + Math.abs(y - ey);

  // Encode/decode (x,y) as a single integer key for fast lookups.
  const key = (x, y) => y * (GRID_COLS + 1) + x;

  // Open set implemented as a simple min-heap on f = g + h.
  // Node: { x, y, g, f, parentKey }
  const openMap  = new Map(); // key → node (best known so far)
  const closedSet = new Set();
  const parentOf  = new Map(); // key → parent node

  const startNode = { x: sx, y: sy, g: 0, f: heuristic(sx, sy) };
  openMap.set(key(sx, sy), startNode);

  // MinHeap helper (simple sorted array — grid is small enough).
  // For a 42×47 grid (1 974 cells) this is fast enough in practice.
  const heap = [startNode];

  const heapPush = (node) => {
    heap.push(node);
    // Bubble up
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent].f <= heap[i].f) break;
      [heap[parent], heap[i]] = [heap[i], heap[parent]];
      i = parent;
    }
  };

  const heapPop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0) {
      heap[0] = last;
      // Sift down
      let i = 0;
      while (true) {
        let smallest = i;
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        if (l < heap.length && heap[l].f < heap[smallest].f) smallest = l;
        if (r < heap.length && heap[r].f < heap[smallest].f) smallest = r;
        if (smallest === i) break;
        [heap[i], heap[smallest]] = [heap[smallest], heap[i]];
        i = smallest;
      }
    }
    return top;
  };

  const DIRS = [
    { dx:  0, dy: -1 },
    { dx:  0, dy:  1 },
    { dx: -1, dy:  0 },
    { dx:  1, dy:  0 },
  ];

  while (heap.length > 0) {
    const current = heapPop();
    const ck = key(current.x, current.y);

    if (closedSet.has(ck)) continue;
    closedSet.add(ck);

    // Reached the goal?
    if (current.x === ex && current.y === ey) {
      // Reconstruct path
      const path = [];
      let node = current;
      while (node) {
        path.push({ x: node.x, y: node.y });
        node = parentOf.get(key(node.x, node.y));
      }
      path.reverse();
      return path;
    }

    for (const { dx, dy } of DIRS) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (!isPassable(nx, ny)) continue;

      const nk = key(nx, ny);
      if (closedSet.has(nk)) continue;

      const g = current.g + 1;
      const existing = openMap.get(nk);
      if (existing && existing.g <= g) continue;

      const node = { x: nx, y: ny, g, f: g + heuristic(nx, ny) };
      openMap.set(nk, node);
      parentOf.set(nk, current);
      heapPush(node);
    }
  }

  // No path found
  return null;
}

// ---------------------------------------------------------------------------
// validatePlacement
// ---------------------------------------------------------------------------

/**
 * Returns true if a 2×2 tower can be placed with top-left corner at (x, y).
 *
 * Rules:
 *  1. All 4 cells must currently be 'empty'.
 *  2. Temporarily marking those 4 cells as 'rock' must NOT block the enemy
 *     route ENTRY → CP1 → CP2 → CP3 → CP4 → CP5 → CP6 → EXIT.
 *
 * @param {Array}  grid
 * @param {number} x - Top-left column (1-indexed)
 * @param {number} y - Top-left row (1-indexed)
 * @returns {boolean}
 */
export function validatePlacement(grid, x, y) {
  // 1. Bounds check: the 2×2 block must fit inside the grid.
  if (x < 1 || x + 1 > GRID_COLS || y < 1 || y + 1 > GRID_ROWS) return false;

  const cells = [
    { cx: x,     cy: y     },
    { cx: x + 1, cy: y     },
    { cx: x,     cy: y + 1 },
    { cx: x + 1, cy: y + 1 },
  ];

  // 2. All 4 cells must be 'empty'.
  for (const { cx, cy } of cells) {
    if (grid[cy][cx].type !== 'empty') return false;
  }

  // 3. Temporarily mark cells as 'rock'.
  for (const { cx, cy } of cells) {
    grid[cy][cx].type = 'rock';
  }

  // 4. Verify full path: ENTRY → each CP in order → EXIT.
  const waypoints = [ENTRY, ...CHECKPOINTS, EXIT];
  let valid = true;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const segment = findPath(grid, waypoints[i], waypoints[i + 1]);
    if (!segment) {
      valid = false;
      break;
    }
  }

  // 5. Restore cells.
  for (const { cx, cy } of cells) {
    grid[cy][cx].type = 'empty';
  }

  return valid;
}

// ---------------------------------------------------------------------------
// Tower helpers
// ---------------------------------------------------------------------------

/**
 * Places a rock (stone obstacle) at the 2×2 block with top-left at (x, y).
 * Does NOT validate — call validatePlacement first.
 *
 * @param {Array}  grid
 * @param {number} x
 * @param {number} y
 */
export function placeRock(grid, x, y) {
  grid[y    ][x    ].type = 'rock';
  grid[y    ][x + 1].type = 'rock';
  grid[y + 1][x    ].type = 'rock';
  grid[y + 1][x + 1].type = 'rock';
}

/**
 * Places a gem tower at the 2×2 block with top-left at (x, y).
 *
 * @param {Array}  grid
 * @param {number} x
 * @param {number} y
 * @param {*}      gemId - Identifier for the gem (e.g. an id or object ref)
 */
export function placeGem(grid, x, y, gemId) {
  grid[y    ][x    ] = { type: 'gem', gemId };
  grid[y    ][x + 1] = { type: 'gem', gemId };
  grid[y + 1][x    ] = { type: 'gem', gemId };
  grid[y + 1][x + 1] = { type: 'gem', gemId };
}

/**
 * Removes a rock from the 2×2 block at (x, y), restoring cells to 'empty'.
 * Only cells currently set to 'rock' are changed.
 *
 * @param {Array}  grid
 * @param {number} x
 * @param {number} y
 */
export function removeRock(grid, x, y) {
  // Accept any cell in the 2×2 block — find the actual top-left corner.
  const candidates = [[x, y], [x-1, y], [x, y-1], [x-1, y-1]];
  for (const [rx, ry] of candidates) {
    if (
      grid[ry  ]?.[rx  ]?.type === 'rock' &&
      grid[ry  ]?.[rx+1]?.type === 'rock' &&
      grid[ry+1]?.[rx  ]?.type === 'rock' &&
      grid[ry+1]?.[rx+1]?.type === 'rock'
    ) {
      grid[ry  ][rx  ].type = 'empty';
      grid[ry  ][rx+1].type = 'empty';
      grid[ry+1][rx  ].type = 'empty';
      grid[ry+1][rx+1].type = 'empty';
      return;
    }
  }
}
