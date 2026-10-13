function augmentGate(level, gameTime) {
  if (level >= 15) return 15;
  if (level >= 11) return 11;
  if (level >= 7) return 7;
  return gameTime < 180 ? 1 : 0;
}

function shouldAutoScan(state, { level, gameTime, isDead, focused, busy, now }) {
  const gate = augmentGate(level, gameTime);
  if (state.gate !== gate) {
    state.gate = gate;
    state.attempts = 0;
    state.nextAt = 0;
    state.complete = false;
  }
  if (!gate || !focused || busy || state.complete || state.attempts >= 24 || now < state.nextAt) return false;
  if (gate !== 1 && !isDead) return false;
  state.attempts++;
  state.nextAt = now + 5000;
  return true;
}

module.exports = { augmentGate, shouldAutoScan };
