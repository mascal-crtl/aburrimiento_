/* ══════════════════════════════════════════════
   TOUCH CONTROLS — botones virtuales D-pad
   ══════════════════════════════════════════════ */

.tBtn {
  width: 56px;
  height: 56px;
  background: rgba(255, 107, 107, 0.15);
  border: 2px solid rgba(255, 107, 107, 0.4);
  border-radius: 12px;
  color: #ff6b6b;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.1s;
  user-select: none;
}

.tBtn:active {
  background: rgba(255, 107, 107, 0.4);
}

.tBtnLg {
  width: 130px;
  height: 60px;
  font-family: 'Press Start 2P', monospace;
  font-size: 10px;
  letter-spacing: 1px;
}
