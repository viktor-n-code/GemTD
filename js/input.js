// input.js — Mouse & touch input handling for Gem TD
// Tracks cursor/finger position, derives hover state, and queues pending actions.

import { CELL_SIZE, GRID_COLS, GRID_ROWS } from './grid.js';
import { BTN_COMBINE, BTN_COMBINE4, BTN_KEEP, BTN_UPGRADE, BTN_RESTART, BTN_REMOVE,
         BTN_COMBINE_SPECIAL, BTN_UPGRADE_GEM, BTN_BUY_LIFE, BTN_REPICK, BTN_DOWNGRADE,
         BTN_FORFEIT, BTN_SPEED, BTN_SAVE_LOAD, PANEL_Y } from './ui.js';
import { findAvailableRecipes } from './specialgem.js';

// ---------------------------------------------------------------------------
// Private helper
// ---------------------------------------------------------------------------

let touchActive = false;

/** Returns true once a touch event has been detected this session. */
export function isTouchDevice() { return touchActive; }

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
    this.restartConfirmUntil = 0; // timestamp until which the restart confirm is active
    this.forfeitConfirmUntil = 0;

    // Cached from update() for use in click handler
    this._phase          = 'build';
    this._enemies        = [];
    this._placedThisRound = [];
    this._grid           = null;

    // Pinch-to-zoom state (mobile only)
    this._zoom       = 1;       // current zoom level (1 = no zoom)
    this._panX       = 0;       // CSS px offset (in zoomed space)
    this._panY       = 0;
    this._pinching   = false;   // true while 2+ fingers are down
    this._pinchDist0 = 0;       // initial distance between fingers
    this._pinchZoom0 = 1;       // zoom level when pinch started
    this._pinchMidX0 = 0;      // initial midpoint (screen px)
    this._pinchMidY0 = 0;
    this._pinchPanX0 = 0;      // pan when pinch started
    this._pinchPanY0 = 0;
    this._lastTapTime = 0;      // for double-tap-to-reset detection

    this._attachListeners();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /** Returns a snapshot of the current input state for ui.js / renderer.js. */
  getState() {
    return {
      hoveredCell:          this.hoveredCell,
      hoveredGemId:         this.hoveredGemId,
      selectedGemId:        this.selectedGemId,
      selectedEnemyId:      this.selectedEnemyId,
      selectedRockPos:      this.selectedRockPos,
      combineStep:          this.combineStep,
      restartConfirmUntil:  this.restartConfirmUntil,
      forfeitConfirmUntil:  this.forfeitConfirmUntil,
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
    this._gems            = state.gems || {};
    this.hoveredGemId = null;
    // Clear hover state when game tab is not active (canvas is hidden)
    if (window.gameTabActive === false) {
      this.hoveredCell      = null;
      this.pendingPlacement = null;
      this.pendingAction    = null;
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

    // Touch support — passive:false so we can preventDefault to suppress
    // the browser's delayed synthetic click and prevent scroll/zoom on canvas
    this.canvas.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
    this.canvas.addEventListener('touchmove',  (e) => this._onTouchMove(e),  { passive: false });
    this.canvas.addEventListener('touchend',   (e) => this._onTouchEnd(e),   { passive: false });
  }

  /** Convert a MouseEvent to canvas-local pixel coordinates. */
  _canvasPos(e) {
    const rect    = this.canvas.getBoundingClientRect();
    // Guard against hidden canvas (display:none → zero dimensions → Infinity scale)
    if (rect.width === 0 || rect.height === 0) return { x: -1, y: -1 };
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
    this._updateHoveredCell(x, y);
  }

  /** Derive the grid cell under the given canvas-pixel position. */
  _updateHoveredCell(x, y) {
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

  // -------------------------------------------------------------------------
  // Touch handlers
  // -------------------------------------------------------------------------

  _onTouchStart(e) {
    e.preventDefault();
    touchActive = true;
    if (e.touches.length === 0) return;

    if (e.touches.length >= 2) {
      // Start a pinch gesture
      this._pinching   = true;
      this._pinchDist0 = this._touchDist(e.touches[0], e.touches[1]);
      this._pinchZoom0 = this._zoom;
      const mid = this._touchMid(e.touches[0], e.touches[1]);
      this._pinchMidX0 = mid.x;
      this._pinchMidY0 = mid.y;
      this._pinchPanX0 = this._panX;
      this._pinchPanY0 = this._panY;
      return;
    }

    // Single finger — normal interaction
    const touch = e.touches[0];
    const { x, y } = this._canvasPos(touch);
    this.mouseX = x;
    this.mouseY = y;
    this._updateHoveredCell(x, y);

    // Record start for tap-vs-drag and single-finger-pan detection
    this._touchStartX     = x;
    this._touchStartY     = y;
    this._touchStartTime  = Date.now();
    this._touchScreenX0   = touch.clientX;  // screen px for panning
    this._touchScreenY0   = touch.clientY;
    this._panStartX       = this._panX;
    this._panStartY       = this._panY;
    this._isDraggingPan   = false;
  }

  _onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 0) return;

    if (e.touches.length >= 2) {
      // Pinch in progress — update zoom and pan
      this._pinching = true;
      const dist = this._touchDist(e.touches[0], e.touches[1]);
      const mid  = this._touchMid(e.touches[0], e.touches[1]);

      // Zoom: proportional to finger distance change
      let newZoom = this._pinchZoom0 * (dist / this._pinchDist0);
      newZoom = Math.max(1, Math.min(4, newZoom));  // clamp 1x–4x

      // Pan: follow the midpoint shift so the content under the fingers stays put
      const midDx = mid.x - this._pinchMidX0;
      const midDy = mid.y - this._pinchMidY0;
      let newPanX = this._pinchPanX0 + midDx;
      let newPanY = this._pinchPanY0 + midDy;

      // Clamp pan so the canvas doesn't slide off-screen
      const rect = this.canvas.getBoundingClientRect();
      const displayW = rect.width / this._zoom; // un-zoomed display width
      const displayH = rect.height / this._zoom;
      const maxPanX = displayW * (newZoom - 1);
      const maxPanY = displayH * (newZoom - 1);
      newPanX = Math.max(-maxPanX, Math.min(0, newPanX));
      newPanY = Math.max(-maxPanY, Math.min(0, newPanY));

      this._zoom = newZoom;
      this._panX = newPanX;
      this._panY = newPanY;
      this._applyZoomTransform();
      return;
    }

    // Single finger — skip if we were just pinching
    if (this._pinching) return;
    const touch = e.touches[0];

    // When zoomed in, single-finger drag pans the view
    if (this._zoom > 1) {
      const screenDx = touch.clientX - (this._touchScreenX0 ?? touch.clientX);
      const screenDy = touch.clientY - (this._touchScreenY0 ?? touch.clientY);
      if (!this._isDraggingPan && Math.abs(screenDx) + Math.abs(screenDy) > 8) {
        this._isDraggingPan = true;
      }
      if (this._isDraggingPan) {
        let newPanX = this._panStartX + screenDx;
        let newPanY = this._panStartY + screenDy;
        // Clamp so canvas stays on-screen
        const rect = this.canvas.getBoundingClientRect();
        const displayW = rect.width / this._zoom;
        const displayH = rect.height / this._zoom;
        const maxPanX = displayW * (this._zoom - 1);
        const maxPanY = displayH * (this._zoom - 1);
        newPanX = Math.max(-maxPanX, Math.min(0, newPanX));
        newPanY = Math.max(-maxPanY, Math.min(0, newPanY));
        this._panX = newPanX;
        this._panY = newPanY;
        this._applyZoomTransform();
        return;
      }
    }

    // Normal hover update (zoom=1 or small movement)
    const { x, y } = this._canvasPos(touch);
    this.mouseX = x;
    this.mouseY = y;
    this._updateHoveredCell(x, y);
  }

  _onTouchEnd(e) {
    e.preventDefault();

    // If fingers drop from 2 to 1, stay in pinch mode until all fingers are up
    if (e.touches.length >= 1 && this._pinching) return;

    if (this._pinching) {
      this._pinching = false;
      return; // Don't fire a tap after a pinch
    }

    // Don't fire a tap if the user was panning while zoomed
    if (this._isDraggingPan) {
      this._isDraggingPan = false;
      this.hoveredCell = null;
      return;
    }

    const touch = e.changedTouches[0];
    if (!touch) return;
    const { x, y } = this._canvasPos(touch);

    // Treat as a tap if short duration and small movement
    const dx       = x - (this._touchStartX ?? x);
    const dy       = y - (this._touchStartY ?? y);
    const dist     = Math.sqrt(dx * dx + dy * dy);
    const duration = Date.now() - (this._touchStartTime ?? 0);

    if (duration < 400 && dist < 15) {
      // Double-tap detection: reset zoom if tapped twice quickly
      const now = Date.now();
      if (now - this._lastTapTime < 350 && this._zoom > 1) {
        this._zoom = 1;
        this._panX = 0;
        this._panY = 0;
        this._applyZoomTransform();
        this._lastTapTime = 0;
        this.hoveredCell = null;
        return;
      }
      this._lastTapTime = now;

      // Normal tap — simulate a click
      this.mouseX = x;
      this.mouseY = y;
      this._updateHoveredCell(x, y);
      this._processClick(x, y);
    }

    // Clear hover after finger lifts
    this.hoveredCell = null;
  }

  // -------------------------------------------------------------------------
  // Zoom helpers
  // -------------------------------------------------------------------------

  /** Distance between two Touch objects in screen pixels. */
  _touchDist(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** Midpoint between two Touch objects in screen pixels. */
  _touchMid(t1, t2) {
    return {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    };
  }

  /** Apply the current zoom/pan as a CSS transform on the canvas. */
  _applyZoomTransform() {
    if (this._zoom <= 1) {
      this.canvas.style.transformOrigin = '';
      this.canvas.style.transform = '';
    } else {
      this.canvas.style.transformOrigin = '0 0';
      this.canvas.style.transform =
        `translate(${this._panX}px, ${this._panY}px) scale(${this._zoom})`;
    }
  }

  // -------------------------------------------------------------------------
  // Click / tap processing
  // -------------------------------------------------------------------------

  _onClick(e) {
    // On touch devices the touchend handler drives clicks; skip the synthetic one
    if (touchActive) return;
    const { x, y } = this._canvasPos(e);
    this.mouseX = x;
    this.mouseY = y;
    this._processClick(x, y);
  }

  /** Shared click/tap logic used by both mouse and touch paths. */
  _processClick(x, y) {
    if (y >= PANEL_Y) {
      // -----------------------------------------------------------------------
      // Click inside the build panel
      // -----------------------------------------------------------------------
      // Downgrade shares row 1 space — check first since it's only visible during defend
      if (this._phase === 'defend' && hitTest(BTN_DOWNGRADE, x, y)) {
        this.pendingAction = { type: 'downgrade' };
        return;
      }
      if (hitTest(BTN_COMBINE, x, y)) {
        this.pendingAction = { type: 'combine', selectedGemId: this.selectedGemId };
        return;
      }
      if (hitTest(BTN_COMBINE4, x, y)) {
        this.pendingAction = { type: 'combine4', selectedGemId: this.selectedGemId };
        return;
      }
      if (hitTest(BTN_REPICK, x, y)) {
        this.pendingAction = { type: 'repick' };
        return;
      }
      if (hitTest(BTN_KEEP, x, y)) {
        if (this.selectedGemId !== null && this._placedThisRound.includes(this.selectedGemId)) {
          this.pendingAction = { type: 'keep', gemId: this.selectedGemId };
        }
        return;
      }
      if (hitTest(BTN_UPGRADE, x, y)) {
        this.pendingAction = { type: 'upgrade' };
        return;
      }
      if (hitTest(BTN_BUY_LIFE, x, y)) {
        this.pendingAction = { type: 'buyLife' };
        return;
      }
      if (hitTest(BTN_FORFEIT, x, y)) {
        if (Date.now() < this.forfeitConfirmUntil) {
          this.forfeitConfirmUntil = 0;
          this.pendingAction = { type: 'forfeit' };
        } else {
          this.forfeitConfirmUntil = Date.now() + 3000;
        }
        return;
      }
      if (hitTest(BTN_RESTART, x, y)) {
        if (Date.now() < this.restartConfirmUntil) {
          // Second click within window — confirmed
          this.restartConfirmUntil = 0;
          this.pendingAction = { type: 'restart' };
        } else {
          // First click — arm confirm window (3 s)
          this.restartConfirmUntil = Date.now() + 3000;
        }
        return;
      }
      if (hitTest(BTN_REMOVE, x, y)) {
        if (this.selectedRockPos !== null) {
          this.pendingAction   = { type: 'removeRock', x: this.selectedRockPos.x, y: this.selectedRockPos.y };
          this.selectedRockPos = null;
        }
        return;
      }
      if (hitTest(BTN_COMBINE_SPECIAL, x, y)) {
        if (this.selectedGemId !== null) {
          const phase   = this._phase === 'build' ? 'build' : 'defend';
          const recipes = findAvailableRecipes(
            this.selectedGemId, this._gems, this._placedThisRound, phase
          );
          if (recipes.length > 0) {
            this.pendingAction = {
              type: 'combineSpecial',
              selectedGemId: this.selectedGemId,
              recipeId: recipes[0].def.id,
            };
          }
        }
        return;
      }
      if (hitTest(BTN_UPGRADE_GEM, x, y)) {
        if (this.selectedGemId !== null) {
          this.pendingAction = { type: 'upgradeSpecial', gemId: this.selectedGemId };
        }
        return;
      }
      if (hitTest(BTN_SPEED, x, y)) {
        this.pendingAction = { type: 'toggleSpeed' };
        return;
      }
      if (hitTest(BTN_SAVE_LOAD, x, y)) {
        this.pendingAction = { type: 'openSaveLoad' };
        return;
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
