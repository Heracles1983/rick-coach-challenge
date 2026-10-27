#!/usr/bin/env python3
"""Validate original question sources and emit the buildless browser bundle."""
import json
from collections import Counter
from pathlib import Path

root = Path(__file__).resolve().parents[1] / 'quiz-series'
questions = []
for filename in ['nsca.json', 'ace-nasm.json', 'acsm.json']:
    questions.extend(json.loads((root / 'data' / filename).read_text()))
assert len(questions) == 60
assert len({q['id'] for q in questions}) == 60
assert Counter(q['track'] for q in questions) == {t: 12 for t in ['nsca-cpt', 'cscs', 'ace', 'nasm', 'acsm']}
required = {'id', 'track', 'topic', 'level', 'question', 'options', 'answer', 'explanation', 'takeaway', 'source'}
for q in questions:
    assert required <= q.keys(), q['id']
    assert len(q['options']) == 4 and len(set(q['options'])) == 4, q['id']
    assert type(q['answer']) is int and 0 <= q['answer'] <= 3, q['id']
    assert q['source'] == q['track'], q['id']
    assert q['level'] in ['基础', '应用'], q['id']
    assert len(q['explanation']) >= 80, q['id']
    assert all(isinstance(q[k], str) and q[k].strip() for k in required - {'options', 'answer'}), q['id']
(root / 'questions.js').write_text('/* 原创题库；编辑 data/*.json 后运行 scripts/build-bank.py。 */\nwindow.QUESTION_BANK = ' + json.dumps(questions, ensure_ascii=False, indent=2) + ';\n')
print('Validated and bundled 60 original questions across 5 tracks.')
