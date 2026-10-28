import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { shuffle, questionVolume, selectQuestions, sessionVolume, createSession, remaining, grade, validSession } from '../quiz-series/core.mjs';

const sandbox = { window: {} };
vm.runInNewContext(readFileSync(new URL('../quiz-series/questions.js', import.meta.url), 'utf8'), sandbox);
// Normalize the generated browser data into this test's realm for strict comparisons.
const bank = JSON.parse(JSON.stringify(sandbox.window.QUESTION_BANK));
const allIds = bank.map(q => q.id);
const firstVolume = selectQuestions(bank, 'vol1');
const ids = firstVolume.map(q => q.id);
const tracks = [...new Set(bank.map(q => q.track))];
const now = 1_800_000_000_000;
const fresh = () => createSession(ids, 'exam', '五方向综合练习', now);

test('the real bank supplies two sixty-question volumes with five equal topics each', () => {
  assert.equal(bank.length, 120);
  assert.equal(new Set(allIds).size, 120);
  assert.equal(tracks.length, 5);
  for (const volume of ['vol1', 'vol2']) {
    const questions = selectQuestions(bank, volume);
    assert.equal(questions.length, 60, volume);
    for (const track of tracks) assert.equal(questions.filter(q => q.track === track).length, 12, `${volume}/${track}`);
  }
  for (const q of bank) {
    assert.equal(q.options.length, 4, q.id);
    assert.equal(new Set(q.options).size, 4, q.id);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4, q.id);
  }
});

test('shuffling preserves each real question once without changing the original bank order', () => {
  const original = [...allIds];
  let seed = 42;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const shuffled = shuffle(allIds, random);
  assert.deepEqual(allIds, original);
  assert.notStrictEqual(shuffled, allIds);
  assert.deepEqual([...shuffled].sort(), [...allIds].sort());
  assert.equal(new Set(shuffled).size, allIds.length);
  assert.notDeepEqual(shuffled, allIds);
  assert.deepEqual(shuffle([], random), []);
  assert.deepEqual(shuffle([ids[0]], random), [ids[0]]);
});

test('each volume gives its sixty-question exam 45 minutes and each topic 9 minutes', () => {
  for (const volume of ['vol1', 'vol2']) {
    const whole = createSession(selectQuestions(bank, volume).map(q => q.id), 'exam', volume, now);
    const topic = createSession(selectQuestions(bank, volume, tracks[0]).map(q => q.id), 'exam', '专题', now);
    assert.equal(whole.deadline, now + 45 * 60 * 1000, volume);
    assert.equal(topic.deadline, now + 9 * 60 * 1000, volume);
    assert.equal(remaining(whole, now), 2700, volume);
    assert.equal(remaining(topic, now), 540, volume);
  }
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
  for (const [i, q] of firstVolume.entries()) {
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

test('volume and topic selection cannot mix questions from the other volume', () => {
  const firstIds = new Set(ids);
  const second = selectQuestions(bank, 'vol2');
  assert.equal(second.length, 60);
  assert.ok(second.every(q => !firstIds.has(q.id)));
  for (const volume of ['vol1', 'vol2']) {
    for (const track of tracks) {
      const questions = selectQuestions(bank, volume, track);
      assert.equal(questions.length, 12, `${volume}/${track}`);
      assert.ok(questions.every(q => questionVolume(q) === volume && q.track === track));
      const attempt = createSession(questions.map(q => q.id), 'learn', '专题', now);
      assert.equal(sessionVolume(attempt, bank), volume);
    }
  }
  assert.deepEqual(selectQuestions(bank, 'missing-volume'), []);
  assert.deepEqual(selectQuestions(bank, 'vol1', 'missing-track'), []);
});

test('a legacy attempt without a volume field still restores and grades only its original sixty questions', () => {
  const legacyBank = firstVolume.map(({ volume, ...q }) => q);
  assert.ok(legacyBank.every(q => questionVolume(q) === 'vol1'));
  assert.deepEqual(selectQuestions(legacyBank, 'vol1').map(q => q.id), ids);
  const legacy = JSON.parse(JSON.stringify(fresh()));
  delete legacy.volume;
  for (const q of firstVolume) legacy.answers[q.id] = q.answer;
  legacy.finishedAt = now + 1000;
  assert.ok(!Object.hasOwn(legacy, 'volume'));
  assert.ok(validSession(legacy, bank));
  assert.equal(sessionVolume(legacy, bank), 'vol1');
  assert.equal(sessionVolume(legacy, legacyBank), 'vol1');
  const previous = grade(legacy, legacyBank);
  const current = grade(legacy, bank);
  assert.deepEqual(current, previous);
  assert.equal(current.total, 60);
  assert.equal(current.correct, 60);
  assert.deepEqual(current.unanswered, []);
  for (const track of tracks) assert.deepEqual(current.tracks[track], { total: 12, correct: 12 });
});

test('mixed-volume review groups the same track together without duplicating or dropping results', () => {
  const selected = [];
  for (const track of tracks) {
    selected.push(...selectQuestions(bank, 'vol1', track).slice(0, 2));
    selected.push(...selectQuestions(bank, 'vol2', track).slice(0, 2));
  }
  const mixed = createSession(selected.map(q => q.id), 'learn', '跨辑错题复习', now);
  const wrong = [], unanswered = [];
  for (const [i, q] of selected.entries()) {
    if (i % 4 === 0 || i % 4 === 2) mixed.answers[q.id] = q.answer;
    else if (i % 4 === 1) { mixed.answers[q.id] = (q.answer + 1) % 4; wrong.push(q.id); }
    else unanswered.push(q.id);
  }
  assert.ok(validSession(mixed, bank));
  assert.equal(sessionVolume(mixed, bank), 'mixed');
  const result = grade(mixed, bank);
  assert.equal(result.total, 20);
  assert.equal(result.correct, 10);
  assert.deepEqual(result.wrong, wrong);
  assert.deepEqual(result.unanswered, unanswered);
  assert.equal(Object.keys(result.tracks).length, 5);
  for (const track of tracks) assert.deepEqual(result.tracks[track], { total: 4, correct: 2 });
});
