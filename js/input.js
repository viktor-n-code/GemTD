// input.js — Mouse input handling for Gem TD
// Tracks mouse position, derives hover state, and queues pending actions.

import { CELL_SIZE, GRID_COLS, GRID_ROWS } from './grid.js';
import { GEM_SLOTS, BTN_COMBINE, BTN_KEEP, BTN_UPGRADE, BTN_RESTART, BTN_REMOVE, PANEL_Y } from './ui.js';

// ---------------------------------------------------------------------------
// Private helper
// ---------------------------------------------------------------------------

/**
 * Returns true if pixel (px, py) is inside the given rect.
 * @param {{ x, y, w, h }} rect
 * @param {number} px
 * @param {number} py
 */
function hitTest(rect, px, py) {
  return px >= rect.x && px < rect.x + rect.w &&
         py >= rect.y && py < rect.y + rect.h;
}

// ---------------------------------------------------------------------------
// InputHandler
// ---------------------------------------------------------------------------

export class InputHandler {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;

    // Raw canvas-pixel coordinates of the mouse cursor
    this.mouseX = 0;
    this.mouseY = 0;

    // Derived hover state (updated on mousemove + update())
    this.hoveredCell  = null;   // { x, y } grid cell (1-indexed), or null
    this.hoveredGemId = null;   // gem id when mouse is over a populated slot, else null

    // Pending actions consumed by the gameloop each frame
    this.pendingPlacement = null;  // { x, y } grid cell
    this.pendingAction    = null;  // { type, ... }

    // Selection state
    this.selectedGemId   = null;  // gem id selected in the build panel
    this.selectedEnemyId = null;  // enemy id selected by clicking during defend
    this.selectedRockPos = null;  // { x, y } of a selected rock cell, or null
    this.combineStep     = 0;     // 0 = idle, 1 = first gem, 2 = second gem

    // Cached from update() for use in click handler
    this._phase          = 'build';
    this._enemies        = [];
    this._placedThisRound = [];
    this._grid           = null;

    this._attachListeners();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /** Returns a snapshot of the current input state for ui.js / renderer.js. */
  getState() {
    return {
      hoveredCell:     this.hoveredCell,
      hoveredGemId:    this.hoveredGemId,
      selectedGemId:   this.selectedGemId,
      selectedEnemyId: this.selectedEnemyId,
      selectedRockPos: this.selectedRockPos,
      combineStep:     this.combineStep,
    };
  }

  /** Consume and return the pending grid-placement request (null if none). */
  consumePlacement() {
    const p = this.pendingPlacement;
    this.pendingPlacement = null;
    return p;
  }

  /** Consume and return the pending UI action (null if none). */
  consumeAction() {
    const a = this.pendingAction;
    this.pendingAction = null;
    return a;
  }

  /**
   * Called by the gameloop each frame to sync state-dependent hover info
   * (e.g. which gem id lives in the slot under the mouse).
   *
   * @param {Object} state — full game state
   */
  update(state) {
    this._phase           = state.phase;
    this._enemies         = state.enemies || [];
    this._placedThisRound = state.placedThisRound || [];
    this._grid            = state.grid || null;
    if (this.mouseY >= PANEL_Y) {
      // Find which gem slot (if any) the cursor is over
      let found = null;
      for (let i = 0; i < GEM_SLOTS.length; i++) {
        if (hitTest(GEM_SLOTS[i], this.mouseX, this.mouseY)) {
          found = state.placedThisRound[i] ?? null;
          break;
        }
      }
      this.hoveredGemId = found;
    } else {
      this.hoveredGemId = null;
    }
  }

  /** Called by the gameloop when a new build phase begins. */
  resetBuildState() {
    this.selectedGemId    = null;
    this.selectedEnemyId  = null;
    this.selectedRockPos  = null;
    this.combineStep      = 0;
    this.pendingPlacement = null;
    this.pendingAction    = null;
  }

  // -------------------------------------------------------------------------
  // Private — event listeners
  // -------------------------------------------------------------------------

  _attachListeners() {
    this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    this.canvas.addEventListener('click',     (e) => this._onClick(e));
  }

  /** Convert a MouseEvent to canvas-local pixel coordinates. */
  _canvasPos(e) {
    const rect    = this.canvas.getBoundingClientRect();
    const scaleX  = this.canvas.width  / rect.width;
    const scaleY  = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    };
  }

  _onMouseMove(e) {
    const { x, y } = this._canvasPos(e);
    this.mouseX = x;
    this.mouseY = y;

    // Derive grid cell hover (above the panel only)
    if (y < PANEL_Y) {
      const gx = Math.floor(x / CELL_SIZE) + 1;
      const gy = Math.floor(y / CELL_SIZE) + 1;
      if (gx >= 1 && gx <= GRID_COLS && gy >= 1 && gy <= GRID_ROWS) {
        this.hoveredCell = { x: gx, y: gy };
      } else {
        this.hoveredCell = null;
      }
    } else {
      this.hoveredCell = null;
    }
  }

  _onClick(e) {
    const { x, y } = this._canvasPos(e);
    this.mouseX = x;
    this.mouseY = y;

    if (y >= PANEL_Y) {
      // -----------------------------------------------------------------------
      // Click inside the build panel
      // -----------------------------------------------------------------------
      if (hitTest(BTN_COMBINE, x, y)) {
        this.pendingAction = { type: 'combine', selectedGemId: this.selectedGemId };
        return;
      }
      if (hitTest(BTN_KEEP, x, y)) {
        if (this.selectedGemId !== null) {
          this.pendingAction = { type: 'keep', gemId: this.selectedGemId };
        }
        return;
      }
      if (hitTest(BTN_UPGRADE, x, y)) {
        this.pendingAction = { type: 'upgrade' };
        return;
      }
      if (hitTest(BTN_RESTART, x, y)) {
        this.pendingAction = { type: 'restart' };
        return;
      }
      if (hitTest(BTN_REMOVE, x, y)) {
        if (this.selectedRockPos !== null) {
          this.pendingAction   = { type: 'removeRock', x: this.selectedRockPos.x, y: this.selectedRockPos.y };
          this.selectedRockPos = null;
        }
        return;
      }
      // Check gem slots — derive gem ID directly from cached placedThisRound
      // so clicks are never dependent on hoveredGemId being current.
      for (let i = 0; i < GEM_SLOTS.length; i++) {
        if (hitTest(GEM_SLOTS[i], x, y)) {
          const gemId = this._placedThisRound[i] ?? null;
          if (gemId != null) {
            this.selectedGemId = gemId;
            this.pendingAction = { type: 'selectGem', gemId };
          }
          return;
        }
      }
    } else {
      // -----------------------------------------------------------------------
      // Click on the game grid
      // -----------------------------------------------------------------------

      // Build phase: click on rock → select it
      if (this._phase === 'build' && this.hoveredCell !== null) {
        const { x: gx, y: gy } = this.hoveredCell;
        const cell = this._grid?.[gy]?.[gx];
        if (cell?.type === 'rock') {
          // Each rock cell stores its block's top-left at placement time
          const tl = cell.rockTopLeft;
          this.selectedRockPos = tl ? { x: tl.x, y: tl.y } : null;
          this.selectedGemId   = null;
          return;
        }
      }

      // Check if click lands on a gem cell (works in any phase)
      if (this.hoveredCell !== null) {
        const { x: gx, y: gy } = this.hoveredCell;
        const cell = this._grid?.[gy]?.[gx];
        if (cell?.type === 'gem' && cell.gemId != null) {
          this.selectedGemId   = cell.gemId;
          this.selectedEnemyId = null;
          this.selectedRockPos = null;
          return;
        }
      }

      // During defend phase: check for enemy click (6px body + 4px buffer)
      if (this._phase === 'defend') {
        for (const e of this._enemies) {
          if (e.dead || e.exited) continue;
          const dx = x - e.x;
          const dy = y - e.y;
          if (Math.sqrt(dx * dx + dy * dy) <= 10) {
            this.selectedEnemyId = e.id;
            this.selectedGemId   = null;
            this.selectedRockPos = null;
            return;
          }
        }
      }

      // Tower placement — build phase only; deselects rock
      if (this._phase === 'build' && this.hoveredCell !== null) {
        this.selectedRockPos  = null;
        this.pendingPlacement = { x: this.hoveredCell.x, y: this.hoveredCell.y };
      }
    }
  }
}
