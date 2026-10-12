import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateGame,parseHumanDate,getTrackProgress,lastWeeks,sanitizeEntry,validISO,strengthSeries} from './game.js';
const baseDate='2026-10-01';
function e(date='2026-10-01',type='A',count=1,reps={push:10,squat:15},stages={push:0,squat:0}) {return sanitizeEntry({id:`${date}-${type}`,date,type,count,reps,stages});}
function stepDays(s,n){const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
test('Fecha natural en inglés, español, ISO y ayer',()=>{
 const now=new Date('2026-10-11T16:00:00Z');
 assert.equal(parseHumanDate('October 11',now),'2026-10-11');
 assert.equal(parseHumanDate('11 de octubre de 2026',now),'2026-10-11');
 assert.equal(parseHumanDate('11/10/2026',now),'2026-10-11');
 assert.equal(parseHumanDate('hoy',now),'2026-10-11');
 assert.equal(parseHumanDate('ayer',now),'2026-10-10');
 assert.equal(parseHumanDate('Nov 11',now),'2025-11-11');
 assert.equal(parseHumanDate('2026-02-31',now),null);
 assert.equal(parseHumanDate('october 12 2026',now),null);
});
test('Racha 5 días bonus 80 y 6 bonus 100',()=>{
 const entries=Array.from({length:6},(_,i)=>e(stepDays(baseDate,i)));
 const s=calculateGame(entries,[],stepDays(baseDate,5));
 assert.equal(s.streak,6);assert.equal(s.maxStreak,6);
 assert.equal(s.days[4].bonus,80);assert.equal(s.days[5].bonus,100);
 assert.equal(s.circuitTotal,6);assert.ok(s.xp > 6*50);
});
test('Primer día perdido baja una racha, dos seguidos la eliminan; hoy aún no se penaliza',()=>{
 const entries=Array.from({length:5},(_,i)=>e(stepDays(baseDate,i)));
 assert.equal(calculateGame(entries,[],'2026-10-05').streak,5);
 assert.equal(calculateGame(entries,[],'2026-10-06').streak,5);
 assert.equal(calculateGame(entries,[],'2026-10-07').streak,4);
 assert.equal(calculateGame(entries,[],'2026-10-08').streak,0);
 const back=[...entries,e('2026-10-07')];
 assert.equal(calculateGame(back,[],'2026-10-07').streak,5);
});
test('Desbloqueos exigen circuitos y mínimo de reps por nivel',()=>{
 const entries=[e('2026-10-01','A',11),e('2026-10-02','A',1,{push:9,squat:15}),e('2026-10-03','A',1)];
 assert.equal(getTrackProgress(entries).push.level,1);
 assert.equal(getTrackProgress(entries).squat.level,0);
 const second=[...entries,e('2026-10-04','A',16,{push:10,squat:10},{push:1,squat:0})];
 assert.equal(getTrackProgress(second).push.level,2);
});
test('Recuperación cap XP diario y no cuenta como fuerza',()=>{
 const entries=[e('2026-10-01','R',12,{},{}),e('2026-10-01','R',5,{}, {})];
 const s=calculateGame(entries,[],'2026-10-01');
 assert.equal(s.dailyXP,15);assert.equal(s.circuitTotal,0);assert.equal(s.activeDays,1);
});
test('Gráficas no confunden variantes e historial',()=>{
 const entries=[e('2026-10-01'),e('2026-10-02','A',2,{push:12,squat:15}),e('2026-10-03','A',2,{push:6,squat:16},{push:1,squat:0})];
 assert.deepEqual(strengthSeries(entries,'push',0,'2026-10-11').map(x=>x.reps),[10,12]);
 assert.deepEqual(strengthSeries(entries,'push',1,'2026-10-11').map(x=>x.reps),[6]);
 assert.equal(lastWeeks(entries,calculateGame(entries,[],'2026-10-11'),'2026-10-11').at(-2).circuits,5);
});

// Sistema RPG 2.0
import {SKILLS,TYPES,allocateSkillXP,creditedWorkouts,entryBaseXP,skillLevel,skillWeeks,runningSeries} from './game.js';
test('Correr entrena resistencia y velocidad, pero no fuerza ni agilidad',()=>{
 const run=sanitizeEntry({id:'run',date:'2026-10-02',type:'RUN',minutes:30,distance:5});
 assert.ok(run);
 assert.equal(entryBaseXP(run),70);
 const allocation=allocateSkillXP(run);
 assert.equal(allocation.stamina+allocation.speed,70);
 assert.equal(allocation.strength,undefined);
 const result=calculateGame([run],[],'2026-10-02');
 assert.ok(result.skills.stamina.xp>result.skills.speed.xp);
 assert.equal(result.skills.strength.xp,0);
 assert.equal(result.circuitTotal,0);
 assert.equal(result.bestPace,6);
});
test('Fuerza A alimenta fuerza + core, agilidad trabaja agilidad',()=>{
 const strength=e('2026-10-02','A',2);
 const agility=sanitizeEntry({id:'agi',date:'2026-10-02',type:'AGI',count:2});
 const result=calculateGame([strength,agility],[],'2026-10-02');
 assert.ok(result.skills.strength.xp>0);
 assert.ok(result.skills.core.xp>0);
 assert.ok(result.skills.agility.xp>0);
 assert.equal(result.skills.mobility.xp,0);
 assert.equal(result.circuitTotal,4);
});
test('Rachas y logros solo suman XP general, no regalan habilidades',()=>{
 const entries=Array.from({length:6},(_,i)=>e(stepDays(baseDate,i)));
 const s=calculateGame(entries,[],stepDays(baseDate,5));
 const base=6*TYPES.A.xp;
 assert.equal(s.totalSkillXP,base);
 assert.ok(s.xp>base);
 assert.ok(s.skills.strength.xp>s.skills.core.xp);
});
test('No se farmea XP de movilidad repitiendo recuperación ni caminata en un día',()=>{
 const data=[
  sanitizeEntry({id:'r1',date:baseDate,type:'R'}),
  sanitizeEntry({id:'r2',date:baseDate,type:'R'}),
  sanitizeEntry({id:'w1',date:baseDate,type:'WALK',minutes:240}),
  sanitizeEntry({id:'w2',date:baseDate,type:'WALK',minutes:240}),
 ];
 const credits=creditedWorkouts(data,baseDate);
 assert.equal(credits.reduce((a,c)=>a+c.xp,0),85);
 assert.equal(calculateGame(data,[],baseDate).dailyXP,85);
});
test('Historial del corredor y series de habilidad respetan fechas y distancias',()=>{
 const entries=[sanitizeEntry({id:'run1',date:'2026-10-02',type:'RUN',minutes:30,distance:5}),
                sanitizeEntry({id:'run2',date:'2026-10-09',type:'RUN',minutes:28,distance:5}),
                e('2026-10-09','A',2)];
 const running=runningSeries(entries,'2026-10-11');
 assert.deepEqual(running.map(x=>x.pace),[6,5.6]);
 const hist=skillWeeks(entries,'2026-10-11',3);
 assert.ok(hist.at(-1).speed>hist.at(-2).speed);
 assert.ok(hist.at(-1).strength>hist.at(-2).strength);
});
test('Sanitización conserva circuitos de v1 y evita ritmos o minutos irreales',()=>{
 const old={id:'legacy',date:'2026-10-01',type:'A',count:2,reps:{push:8,squat:12},stages:{push:0,squat:0}};
 assert.equal(sanitizeEntry(old).minutes,0);
 assert.equal(sanitizeEntry(old).count,2);
 assert.equal(sanitizeEntry({date:baseDate,type:'RUN',minutes:3,distance:1}),null);
 assert.equal(sanitizeEntry({date:baseDate,type:'RUN',minutes:10,distance:50}),null);
 assert.ok(sanitizeEntry({date:baseDate,type:'RUN',minutes:30,distance:''}));
 assert.equal(skillLevel(0).level,1);
 assert.equal(skillLevel(100).level,2);
});
