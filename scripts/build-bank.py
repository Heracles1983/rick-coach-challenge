#!/usr/bin/env python3
"""Validate original question sources and emit the buildless browser bundle."""
import json
from collections import Counter
from pathlib import Path

root = Path(__file__).resolve().parents[1] / 'quiz-series'
questions = []
for filename in ['nsca.json', 'ace-nasm.json', 'acsm.json', 'vol2-nsca.json', 'vol2-ace-nasm.json', 'vol2-acsm.json']:
    part = json.loads((root / 'data' / filename).read_text())
    for q in part:
        q.setdefault('volume', 'vol1')
    questions.extend(part)
assert len(questions) == 120
assert len({q['id'] for q in questions}) == 120
assert len({q['question'] for q in questions}) == 120, 'Duplicate question text'
for volume in ['vol1', 'vol2']:
    group = [q for q in questions if q['volume'] == volume]
    assert len(group) == 60, volume
    assert Counter(q['track'] for q in group) == {t: 12 for t in ['nsca-cpt', 'cscs', 'ace', 'nasm', 'acsm']}, volume
required = {'id', 'track', 'topic', 'level', 'question', 'options', 'answer', 'explanation', 'takeaway', 'source', 'volume'}
for q in questions:
    assert required <= q.keys(), q['id']
    assert len(q['options']) == 4 and len(set(q['options'])) == 4, q['id']
    assert type(q['answer']) is int and 0 <= q['answer'] <= 3, q['id']
    assert q['source'] == q['track'], q['id']
    assert q['level'] in ['基础', '应用'], q['id']
    assert 80 <= len(q['explanation']) <= 160, q['id']
    assert 20 <= len(q['takeaway']) <= 45, q['id']
    assert all(isinstance(q[k], str) and q[k].strip() for k in required - {'options', 'answer'}), q['id']
(root / 'questions.js').write_text('/* 原创题库；编辑 data/*.json 后运行 scripts/build-bank.py。 */\nwindow.QUESTION_BANK = ' + json.dumps(questions, ensure_ascii=False, indent=2) + ';\n')
print('Validated and bundled 120 original questions in 2 volumes, each with 5 tracks.')
