import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { shuffle, createSession, remaining, grade, validSession } from '../quiz-series/core.mjs';

const sandbox = { window: {} };
vm.runInNewContext(readFileSync(new URL('../quiz-series/questions.js', import.meta.url), 'utf8'), sandbox);
// Normalize the generated browser data into this test's realm for strict comparisons.
const bank = JSON.parse(JSON.stringify(sandbox.window.QUESTION_BANK));
const ids = bank.map(q => q.id);
const tracks = [...new Set(bank.map(q => q.track))];
const now = 1_800_000_000_000;
const fresh = () => createSession(ids, 'exam', '五方向综合练习', now);

test('the real bank supplies sixty unique, answerable questions in five equal topics', () => {
  assert.equal(bank.length, 60);
  assert.equal(new Set(ids).size, 60);
  assert.equal(tracks.length, 5);
  for (const track of tracks) assert.equal(bank.filter(q => q.track === track).length, 12);
  for (const q of bank) {
    assert.equal(q.options.length, 4, q.id);
    assert.equal(new Set(q.options).size, 4, q.id);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4, q.id);
  }
});

test('shuffling preserves each real question once without changing the original bank order', () => {
  const original = [...ids];
  let seed = 42;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const shuffled = shuffle(ids, random);
  assert.deepEqual(ids, original);
  assert.notStrictEqual(shuffled, ids);
  assert.deepEqual([...shuffled].sort(), [...ids].sort());
  assert.equal(new Set(shuffled).size, ids.length);
  assert.notDeepEqual(shuffled, ids);
  assert.deepEqual(shuffle([], random), []);
  assert.deepEqual(shuffle([ids[0]], random), [ids[0]]);
});

test('exam deadlines give the sixty-question set 45 minutes and a twelve-question topic 9 minutes', () => {
  const whole = fresh();
  const topic = createSession(bank.filter(q => q.track === tracks[0]).map(q => q.id), 'exam', '专题', now);
  assert.equal(whole.deadline, now + 45 * 60 * 1000);
  assert.equal(topic.deadline, now + 9 * 60 * 1000);
  assert.equal(remaining(whole, now), 2700);
  assert.equal(remaining(topic, now), 540);
  assert.equal(createSession(ids, 'learn', '练习', now).deadline, null);
  assert.equal(createSession(ids, 'cards', '翻卡', now).deadline, null);
});

test('remaining time survives a saved-session round trip and stops at zero after the deadline', () => {
  const saved = JSON.parse(JSON.stringify(fresh()));
  assert.equal(remaining(saved, now + 44 * 60 * 1000), 60);
  assert.equal(remaining(saved, saved.deadline - 1), 1);
  assert.equal(remaining(saved, saved.deadline), 0);
  assert.equal(remaining(saved, saved.deadline + 10 * 60 * 1000), 0);
});

test('grading distinguishes correct, wrong and unanswered questions with accurate topic totals', () => {
  const session = fresh();
  const expectedWrong = [], expectedUnanswered = [];
  for (const [i, q] of bank.entries()) {
    if (i % 3 === 0) session.answers[q.id] = q.answer;
    else if (i % 3 === 1) {
      session.answers[q.id] = (q.answer + 1) % 4;
      expectedWrong.push(q.id);
    } else expectedUnanswered.push(q.id);
  }
  const snapshot = JSON.stringify(session);
  const result = grade(session, bank);
  assert.equal(result.total, 60);
  assert.equal(result.correct, 20);
  assert.deepEqual(result.wrong, expectedWrong);
  assert.deepEqual(result.unanswered, expectedUnanswered);
  assert.equal(result.correct + result.wrong.length + result.unanswered.length, result.total);
  for (const track of tracks) assert.deepEqual(result.tracks[track], { total: 12, correct: 4 });
  assert.equal(JSON.stringify(session), snapshot, 'grading must not mutate recorded answers');
});

test('validSession accepts a real saved attempt but rejects duplicate IDs and invalid answers', () => {
  const session = fresh();
  session.answers[ids[0]] = 0;
  session.checked[ids[0]] = true;
  session.revealed[ids[1]] = false;
  session.viewed[ids[1]] = true;
  session.flags.push(ids[2]);
  assert.ok(validSession(JSON.parse(JSON.stringify(session)), bank));
  const duplicate = fresh(); duplicate.ids[1] = duplicate.ids[0];
  assert.ok(!validSession(duplicate, bank));
  for (const answer of [-1, 4, 1.5, '1', null]) {
    const invalid = fresh(); invalid.answers[ids[0]] = answer;
    assert.ok(!validSession(invalid, bank), `answer ${String(answer)}`);
  }
  const unknownAnswer = fresh(); unknownAnswer.answers['missing-question'] = 0;
  assert.ok(!validSession(unknownAnswer, bank));
  const unknownId = fresh(); unknownId.ids[0] = 'missing-question';
  assert.ok(!validSession(unknownId, bank));
});

test('corrupt boolean dictionaries cannot enter a resumed session', () => {
  for (const field of ['checked', 'revealed', 'viewed']) {
    for (const value of [null, 1, true, 'yes', [], { [ids[0]]: 1 }, { [ids[0]]: 'false' }, { 'missing-question': true }]) {
      const invalid = fresh(); invalid[field] = value;
      assert.ok(!validSession(invalid, bank), `${field}: ${JSON.stringify(value)}`);
    }
    const valid = fresh(); valid[field] = { [ids[0]]: true, [ids[1]]: false };
    assert.ok(validSession(valid, bank), `${field} allows explicit true and false`);
  }
});
