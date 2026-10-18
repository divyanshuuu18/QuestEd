import assert from 'node:assert/strict';
import {defaults,scoreQuiz,streak,weekKey,dayKey,shiftDay} from '../lib/game.ts';
for(let i=0;i<10;i++){const correct=i%6;const answers=Array.from({length:5},(_,j)=>j<correct?0:1);assert.equal(scoreQuiz(answers,[0,0,0,0,0],defaults).xp,15+5*correct)}
assert.throws(()=>scoreQuiz([0],[0,1],defaults));assert.throws(()=>scoreQuiz([99],[0],defaults));
assert.equal(streak(['2026-10-08','2026-10-09'],'2026-10-10'),2);
assert.equal(streak(['2026-10-08','2026-10-10'],'2026-10-10'),1);
assert.equal(weekKey('2026-10-11'),'2026-10-05');
assert.equal(dayKey(new Date('2026-10-09T19:00:00Z')),'2026-10-10');
assert.equal(shiftDay('2026-11-01',-1),'2026-10-31');
assert.equal(shiftDay('2027-01-01',-1),'2026-12-31');
assert.throws(()=>scoreQuiz(null,[0],defaults));
console.log('PASS: 10 student scoring scenarios, invalid answer validation, streak gaps, weekly reset and India day boundary');
