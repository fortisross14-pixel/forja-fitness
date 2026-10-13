import test from 'node:test';
import assert from 'node:assert/strict';
import {newSave,generateQuest,recordRound,earnedBadge} from './coach.js';
import {monthCells,weekOverview,activityStatus,addMonth,isRecorded} from './history-model.js';

test('Calendar begins on Monday and shows complete months (October 2026)',()=>{
 const c=monthCells('2026-10');
 assert.equal(c.length,35);
 assert.deepEqual(c.slice(0,4),[null,null,null,'2026-10-01']);
 assert.equal(c.filter(Boolean).length,31);
 assert.equal(addMonth('2026-12',1),'2027-01');
});
test('Opening an empty date is not recorded as a workout',()=>{
 const s=newSave({},'2026-10-01');
 const q=generateQuest(s,'2026-10-01');
 assert.equal(isRecorded(q),false);
 assert.equal(activityStatus(q), 'empty');
 assert.equal(weekOverview({...s,quests:{'2026-10-01':q}},'2026-10-08').reduce((sum,w)=>sum+w.active,0),0);
});
test('Partially completed sessions differ from badge days',()=>{
 let s=newSave({},'2026-10-01');
 const date='2026-10-01';
 const q=generateQuest(s,date,'A');
 s={...s,quests:{[date]:q}};
 s=recordRound(s,date,Object.fromEntries(q.tasks.map(t=>[t.id,{actual:t.target,effort:'ok'}])));
 assert.equal(activityStatus(s.quests[date]),'started');
 assert.equal(earnedBadge(s.quests[date]),false);
 for(let i=1;i<3;i++)s=recordRound(s,date,Object.fromEntries(q.tasks.map(t=>[t.id,{actual:t.target,effort:'ok'}])));
 assert.equal(activityStatus(s.quests[date]),'badge');
 assert.equal(weekOverview(s,'2026-10-01').at(-1).badges,1);
});
test('Migrated legacy days appear in activity count without unearned badge',()=>{
 const s=newSave({},'2026-10-01');
 s.legacyEntries=[{date:'2026-10-02',type:'A',count:3}];
 const w=weekOverview(s,'2026-10-04').at(-1);
 assert.equal(w.active,1);
 assert.equal(w.badges,0);
 assert.equal(activityStatus(null,true),'started');
});
