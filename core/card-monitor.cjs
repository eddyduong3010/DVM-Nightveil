function cardChange(state, differences) {
  if (!Array.isArray(differences) || differences.length !== 3 || differences.some(d => !Number.isFinite(d))) return false;
  const strong = differences.filter(d => d >= .12).length;
  const moderate = differences.filter(d => d >= .07).length;
  if (strong >= 1 || moderate >= 2) state.suspected++;
  else state.suspected = 0;
  return strong >= 2 || state.suspected >= 2;
}

module.exports = { cardChange };
