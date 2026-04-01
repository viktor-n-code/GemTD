/**
 * renderer.js - Canvas rendering
 * Handles all visual output to the game canvas.
 */

/**
 * Main render function - draws the entire game state to canvas
 *
 * ctx is obtained by gameloop.js calling canvas.getContext('2d').
 * Canvas width/height must match GRID_COLS*CELL_SIZE and GRID_ROWS*CELL_SIZE respectively.
 *
 * @param {CanvasRenderingContext2D} ctx - The 2D canvas context
 * @param {Object} state - Current game state
 * @param {Array<Array<Object>>} grid - The game grid
 * @param {Array<Object>} enemies - Array of enemies to render
 * @param {Array<Object>} gems - Array of gems/towers to render
 * @todo Implement all rendering: grid, enemies, gems, effects, UI elements
 */
export function render(ctx, state, grid, enemies, gems) {
  // TODO: Clear canvas
  // TODO: Draw grid cells
  // TODO: Draw gems/towers
  // TODO: Draw enemies
  // TODO: Draw effects and projectiles
  // TODO: Draw tooltips or selection indicators
}
