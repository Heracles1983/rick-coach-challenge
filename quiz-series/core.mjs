export function shuffle(items, random = Math.random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function createSession(ids, mode, title, now = Date.now()) {
  return {version: 1, ids: [...ids], mode, title, index: 0, answers: {}, checked: {}, flags: [], revealed: {}, viewed: {}, startedAt: now, deadline: mode === 'exam' ? now + ids.length * 45000 : null, finishedAt: null};
}
export function remaining(session, now = Date.now()) { return Math.max(0, Math.ceil(((session.deadline ?? now) - now) / 1000)); }
export function grade(session, bank) {
  const questions = session.ids.map(id => bank.find(q => q.id === id)).filter(Boolean);
  const result = {total: questions.length, correct: 0, wrong: [], unanswered: [], tracks: {}};
  for (const q of questions) {
    const a = session.answers[q.id];
    const right = a === q.answer;
    const t = result.tracks[q.track] ??= {total: 0, correct: 0}; t.total++;
    if (right) {result.correct++; t.correct++;} else if (a === undefined) result.unanswered.push(q.id); else result.wrong.push(q.id);
  }
  return result;
}
export function validSession(s, bank) {
  const ids = new Set(bank.map(q => q.id));
  const boolMap = value => value && !Array.isArray(value) && typeof value === 'object' && Object.entries(value).every(([id,v]) => s.ids.includes(id) && typeof v === 'boolean');
  return !!s && s.version === 1 && typeof s.title === 'string' && ['learn','exam','cards'].includes(s.mode) && Array.isArray(s.ids) && s.ids.length > 0 && s.ids.length <= bank.length && new Set(s.ids).size === s.ids.length && s.ids.every(id => ids.has(id)) && Number.isInteger(s.index) && s.index >= 0 && s.index < s.ids.length && s.answers && !Array.isArray(s.answers) && typeof s.answers === 'object' && Object.entries(s.answers).every(([id,a]) => s.ids.includes(id) && Number.isInteger(a) && a >= 0 && a < 4) && boolMap(s.checked) && boolMap(s.revealed) && boolMap(s.viewed) && Array.isArray(s.flags) && s.flags.every(id=>s.ids.includes(id)) && Number.isFinite(s.startedAt) && (s.mode !== 'exam' || Number.isFinite(s.deadline)) && (s.finishedAt === null || Number.isFinite(s.finishedAt));
}
