import test from 'node:test';
import assert from 'node:assert/strict';
import {newSave,generateQuest,recordRound,recordRun,recordTest,getGameXP,getPerformance,getStreak,earnedBadge,coachingDecision,migrate,verifiedCapacity,getSummaryForAI,unlockProgress} from './coach.js';
const start='2026-09-01';
function withQuest(save,date,mode='A'){return {...save,quests:{...save.quests,[date]:generateQuest(save,date,mode)}};}
function finish(save,date,effort='ok',difference=0){
 const q=save.quests[date];
 for(let i=0;i<q.tasks[0].sets;i++){
  const rows=Object.fromEntries(save.quests[date].tasks.map(t=>[t.id,{actual:Math.max(0,t.target+difference),effort}]));
  save=recordRound(save,date,rows);
 }
 return save;
}
test('First mission prescribes tasks / sets instead of accepting free XP',()=>{
 const s=newSave({},start);const q=generateQuest(s,'2026-09-07','A');
 assert.equal(q.tasks.find(t=>t.id==='push').sets,3);assert.ok(q.tasks.find(t=>t.id==='push').target<5);
 assert.equal(q.tasks.find(t=>t.id==='squat').target,8);assert.equal(getGameXP(s,'2026-09-07').xp,0);
});
test('Successful three blocks earn one badge, no repeated awards',()=>{
 let s=newSave({},start);s=withQuest(s,'2026-09-07');s=finish(s,'2026-09-07');
 assert.equal(earnedBadge(s.quests['2026-09-07']),true);
 assert.equal(getGameXP(s,'2026-09-07').badges,1);
 assert.equal(getGameXP(s,'2026-09-07').xp,120);
 assert.throws(()=>recordRound(s,'2026-09-07',{}));
});
test('A round failed to meet every target does not earn the badge',()=>{
 let s=withQuest(newSave({},start),'2026-09-07');s=finish(s,'2026-09-07','too_hard',-3);
 assert.equal(earnedBadge(s.quests['2026-09-07']),false);
 assert.equal(getGameXP(s,'2026-09-07').xp,60);
});
test('Easy feedback advances the next prescription; hard lowers it',()=>{
 let s=withQuest(newSave({},start),'2026-09-07','A');const initial=s.quests['2026-09-07'].tasks.find(t=>t.id==='push').target;
 s=finish(s,'2026-09-07','easy');
 let next=generateQuest(s,'2026-09-09','A');
 assert.ok(next.tasks.find(t=>t.id==='push').target>initial);
 let hardSave=withQuest(newSave({},start),'2026-09-07','A');hardSave=finish(hardSave,'2026-09-07','hard');
 next=generateQuest(hardSave,'2026-09-09','A');
 assert.ok(next.tasks.find(t=>t.id==='push').target<initial);
});
test('Arbitrary 200 reps at once cannot yield many levels',()=>{
 let s=withQuest(newSave({},start),'2026-09-07','A');
 for(let i=0;i<3;i++){
  s=recordRound(s,'2026-09-07',Object.fromEntries(s.quests['2026-09-07'].tasks.map(t=>[t.id,{actual:t.id==='push'?200:t.target,effort:'easy'}])));
 }
 assert.equal(getPerformance(s,'2026-09-07').skills.strength.level,1);
 assert.ok(s.quests['2026-09-07'].tasks.find(t=>t.id==='push').rounds[0].actual===200);
});
test('Two push/pull tests over months reproduce ~8 real strength levels',()=>{
 let s=newSave({},start);
 for(const date of ['2026-12-01','2026-12-08']){s=recordTest(s,date,'push',25);s=recordTest(s,date,'pull',5);}
 const p=getPerformance(s,'2026-12-09');
 assert.equal(p.capacities.push.verified,25);
 assert.equal(p.capacities.pull.verified,5);
 assert.equal(p.skills.strength.gain,8);
});
test('A lone maximal test on day one remains unverified',()=>{
 let s=newSave({},start);s=recordTest(s,start,'push',200);
 assert.equal(verifiedCapacity(s,'push',start).verified,5);
});
test('4km @6:30 to 6:25 gives no unearned speed level',()=>{
 let s=newSave({runDistance:4,runPace:390},start);
 for(const date of ['2026-11-01','2026-11-08']){
 s=withQuest(s,date,'RUN');s=recordRun(s,date,4,25+40/60,'ok');
 }
 const p=getPerformance(s,'2026-11-09');
 assert.equal(p.running.pace,385);assert.equal(p.skills.speed.gain,0);
 assert.equal(p.skills.stamina.gain,0);
});
test('Five then six days provide +80 then +100 streak bonus',()=>{
 let s=newSave({},start);
 for(let i=0;i<6;i++){const day=`2026-09-0${i+1}`;s=withQuest(s,day,'R');s=finish(s,day);}
 assert.equal(getStreak(s,'2026-09-05').xp,80);
 assert.equal(getStreak(s,'2026-09-06').xp,180);
});
test('One missed day reduces streak, second clears it',()=>{
 let s=newSave({},start);
 for(let i=0;i<5;i++){const day=`2026-09-0${i+1}`;s=withQuest(s,day,'R');s=finish(s,day);}
 assert.equal(getStreak(s,'2026-09-07').streak,4);
 assert.equal(getStreak(s,'2026-09-08').streak,0);
});
test('Importing v2 preserves entries and seed measures, no re-awarded XP',()=>{
 const s=migrate({entries:[{id:'a',date:start,type:'A',count:1,reps:{push:6,squat:12},stages:{push:0,squat:0},plank:20}],measurements:[{id:'m',date:start,weight:95}]},'2026-09-10');
 assert.equal(s.baseline.push,6);assert.equal(s.legacyEntries.length,1);assert.equal(s.measurements.length,1);
 assert.equal(getGameXP(s,'2026-09-10').xp,0);
});
test('Optional AI receives only summary, not waist or weight',()=>{
 const s=newSave({},start);s.measurements=[{date:start,weight:95,waist:100}];
 const j=JSON.stringify(getSummaryForAI(s,'2026-09-10'));
 assert.ok(!j.includes('waist'));assert.ok(!j.includes('weight'));
});

test('Progression preview exposes genuine variant unlock milestone',()=>{
 const s=newSave({},start);const p=unlockProgress(s,'push','2026-09-07');
 assert.equal(p.next,'Tempo 3 s');assert.equal(p.required,6);assert.equal(p.earned,0);
});

test('Running target reacts to easy repeats and backs down after hard feedback',()=>{
 let s=newSave({runDistance:4,runPace:390},start);
 for(const date of ['2026-09-14','2026-09-17']){
  s=withQuest(s,date,'RUN');s=recordRun(s,date,4.1,26,'easy');
 }
 let q=generateQuest(s,'2026-09-20','RUN');
 assert.ok(q.runTarget>4);
 s=withQuest(s,'2026-09-20','RUN');
 s=recordRun(s,'2026-09-20',3.4,24,'too_hard');
 q=generateQuest(s,'2026-09-23','RUN');
 assert.ok(q.runTarget<4.25);
});
