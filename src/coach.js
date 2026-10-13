// FORJA 3 — deterministic coaching engine. No network access, no token consumption.
import {todayISO, validISO, dayNumber, isoFromDayNumber, sanitizeEntry} from './game.js';
export const VERSION = 3;
export const KEY = 'forja-coach-v3';
export const OLD_KEY = 'forja-fitness-v1';
export const EXERCISES = {
 push:{name:'Flexiones',unit:'reps',skill:'strength',maxSet:60,variants:['Inclinadas','De rodillas','Estándar','Tempo 3 s']},
 squat:{name:'Sentadillas',unit:'reps',skill:'strength',maxSet:80,variants:['Clásicas','Con pausa','Tempo 3 s']},
 pull:{name:'Dominadas',unit:'reps',skill:'strength',maxSet:30,variants:['Dominadas asistidas','Dominadas estrictas']},
 triceps:{name:'Flexiones de tríceps',unit:'reps',skill:'strength',maxSet:40,variants:['Cerradas inclinadas','Cerradas rodillas','Cerradas en suelo']},
 lunge:{name:'Zancadas inversas',unit:'reps/lado',skill:'strength',maxSet:45,variants:['Asistidas','Clásicas','Con pausa']},
 bridge:{name:'Puente de glúteos',unit:'reps',skill:'strength',maxSet:55,variants:['Clásico','Una pierna']},
 plank:{name:'Plancha',unit:'seg',skill:'core',maxSet:180,variants:['Antebrazos','Con elevación de pierna']},
 deadbug:{name:'Dead bug',unit:'reps/lado',skill:'core',maxSet:35,variants:['Clásico','Lento controlado']},
 jacks:{name:'Jumping jacks',unit:'reps',skill:'stamina',maxSet:140,variants:['Sin salto','Clásicos','Rápidos']},
 burpee:{name:'Burpees',unit:'reps',skill:'agility',maxSet:35,variants:['Sin salto','Clásicos','Con salto alto']},
 agility:{name:'Pasos laterales',unit:'seg',skill:'agility',maxSet:120,variants:['Controlados','Rápidos']},
 mobility:{name:'Movilidad suave',unit:'min',skill:'mobility',maxSet:30,variants:['Articulaciones y estiramientos']},
};
export const MODE={
 A:{name:'Fuerza · Torso + core',icon:'dumbbell',color:'#bdff77',ids:['push','squat','plank','jacks'],rounds:3,note:'3 microbloques. Sepáralos entre reuniones y trabaja con técnica.'},
 B:{name:'Fuerza · Piernas + tríceps',icon:'shield',color:'#b9a5ff',ids:['triceps','lunge','bridge','deadbug'],rounds:3,note:'Movimiento controlado, sin necesidad de equipo.'},
 C:{name:'Cardio · Agilidad',icon:'zap',color:'#ffad77',ids:['jacks','burpee','agility'],rounds:2,note:'2 bloques cortos; la respiración debe recuperarse al terminar.'},
 R:{name:'Recuperación activa',icon:'heart',color:'#6fd7c8',ids:['mobility'],rounds:1,note:'La recuperación también cuenta. No hace falta hacer fuerza a diario.'},
 RUN:{name:'Correr · Fondo y ritmo',icon:'footprints',color:'#ffad77',ids:[],rounds:1,note:'Carrera cómoda, pudiendo hablar en frases completas.'},
};
export const SKILLS={strength:{name:'Fuerza',color:'#bdff77'},stamina:{name:'Resistencia',color:'#6fd7c8'},speed:{name:'Velocidad',color:'#ffad77'},agility:{name:'Agilidad',color:'#b9a5ff'},core:{name:'Core',color:'#79adff'},mobility:{name:'Movilidad',color:'#f6a2bf'}};
export const DEFAULT_BASELINE={push:5,squat:11,pull:0,triceps:5,lunge:10,bridge:12,plank:20,deadbug:8,jacks:30,burpee:3,agility:25,mobility:5,runDistance:4,runPace:390};
export const EFFORTS=[{id:'easy',label:'Muy fácil',hint:'Podría hacer muchas más'},{id:'ok',label:'Justo',hint:'Me quedan 2–3 repeticiones'},{id:'hard',label:'Difícil',hint:'Casi al límite'},{id:'too_hard',label:'Demasiado',hint:'Necesité parar o fallé'}];
export const clamp=(n,low,high)=>Math.max(low,Math.min(high,Number.isFinite(+n)?+n:low));
const round=(n)=>Math.round(n);
export function newSave(base={},start=todayISO(),equipmentPullup=false){
  return {schema:VERSION,startDate:start,baseline:{...DEFAULT_BASELINE,...base},equipmentPullup:Boolean(equipmentPullup),quests:{},runs:[],tests:[],legacyEntries:[],measurements:[],coachTweaks:{},review:null};
}
export function validSave(data){return Boolean(data&&typeof data==='object'&&data.schema===3&&validISO(data.startDate)&&data.quests&&typeof data.quests==='object'&&data.baseline&&Array.isArray(data.runs)&&Array.isArray(data.tests));}
export function migrate(old,now=todayISO()){
 const entries=Array.isArray(old?.entries)?old.entries.map(sanitizeEntry).filter(Boolean):[];
 const earliest=entries.slice().sort((a,b)=>a.date.localeCompare(b.date));
 const first=earliest[0]?.date||now;
 const baseline={...DEFAULT_BASELINE};
 const keys={push:'push',squat:'squat',triceps:'triceps',burpee:'burpee'};
 for(const [key,oldKey] of Object.entries(keys)){
   const found=earliest.find(e=>e.reps?.[oldKey]>0);if(found)baseline[key]=found.reps[oldKey];
 }
 const firstRun=earliest.find(e=>e.type==='RUN'&&e.distance>=1);
 if(firstRun){baseline.runDistance=firstRun.distance;baseline.runPace=round(firstRun.minutes*60/firstRun.distance);}
 const save=newSave(baseline,first);save.legacyEntries=entries;
 save.measurements=Array.isArray(old?.measurements)?old.measurements.filter(m=>validISO(m.date)).map(m=>({...m})):[];
 save.runs=earliest.filter(e=>e.type==='RUN'&&e.distance>0).map(e=>({date:e.date,distance:e.distance,minutes:e.minutes,effort:'ok',legacy:true}));
 return save;
}
function exposureList(save,id,before){
 const sessions=[];
 for(const q of Object.values(save.quests||{})){
  if(q.date>=before)continue;
  const task=q.tasks?.find(t=>t.id===id);
  if(!task)continue;
  const valid=(task.rounds||[]).filter(r=>Number.isFinite(+r.actual)&&r.actual>=0);
  if(valid.length) sessions.push({date:q.date,target:task.target,sets:task.sets,reps:round(valid.reduce((x,r)=>x+Number(r.actual),0)/valid.length),coverage:valid.length/task.sets,effort:valid.at(-1).effort||'ok',variant:task.variant});
 }
 return sessions.sort((a,b)=>b.date.localeCompare(a.date));
}
export function coachingDecision(save,id,date=todayISO()){
 const hist=exposureList(save,id,date).slice(0,3);
 if(!hist.length)return {delta:0,reason:'Punto de partida: vamos a calibrar sin llegar al fallo.'};
 const last=hist[0];
 if(last.effort==='too_hard'||last.coverage<0.75||last.reps<last.target*0.8)return {delta:-2,reason:'La última sesión fue excesiva o quedó incompleta. Bajamos la carga.'};
 if(last.effort==='hard')return {delta:-1,reason:'Costó demasiado: bajamos ligeramente las repeticiones.'};
 if(last.effort==='easy'&&last.reps>=last.target)return {delta:1,reason:'¡Te sobró energía! Subimos un poco el próximo objetivo.'};
 if(hist.length>=2&&hist.slice(0,2).every(h=>h.reps>=h.target&&h.coverage>=0.99&&h.effort==='ok'))return {delta:1,reason:'Dos sesiones sólidas. Progresión gradual de +1.'};
 return {delta:0,reason:'Consolidamos técnica y consistencia antes de subir.'};
}
const INITIAL_MULT={push:.65,squat:.7,pull:.55,triceps:.65,lunge:.75,bridge:.75,plank:.8,deadbug:.8,jacks:.85,burpee:.72,agility:.8,mobility:1};
const STEP={push:1,squat:2,pull:1,triceps:1,lunge:2,bridge:2,plank:5,deadbug:1,jacks:5,burpee:1,agility:5,mobility:1};
function desiredProgression(save,id,date,variant=0){
 const base=Number(save.baseline?.[id])||0;
 const hist=exposureList(save,id,date).filter(h=>h.variant===variant);
 const nativePush=(id==='push'&&variant===2&&base>3&&!exposureList(save,id,date).some(h=>h.variant===0||h.variant===1));
 const startingTarget=variant>0&&!nativePush
   ?({push:[0,7,6,5],triceps:[0,6,5],squat:[0,12,10],burpee:[0,5,5]}[id]?.[variant]||Math.max(2,Math.round(base*.6)))
   :Math.max(id==='mobility'?3:id==='plank'||id==='agility'?10:1,round(base*(INITIAL_MULT[id]||.7)));
 let target=startingTarget;
 // Replay only actual sessions of this variation; feedback changes load gradually.
 for(let i=hist.length-1;i>=0;i--){
   const delta=coachingDecisionFromHistory(hist.slice(i));
   target=Math.max(1,target+Math.sign(delta)*STEP[id]);
   const weeks=Math.max(0,(dayNumber(date)-dayNumber(save.startDate))/7);
   target=Math.min(target,startingTarget+Math.ceil(weeks+1)*STEP[id]*2);
 }
 return round(clamp(target,1,EXERCISES[id].maxSet));
}
function coachingDecisionFromHistory(hist){
 const [last,prev]=hist;if(!last)return 0;
 if(last.effort==='too_hard'||last.coverage<.75||last.reps<last.target*.8)return -1;
 if(last.effort==='hard')return -1;
 if(last.effort==='easy'&&last.reps>=last.target)return 1;
 if(prev?.effort==='ok'&&last.effort==='ok'&&last.reps>=last.target&&prev.reps>=prev.target&&last.coverage>=.99&&prev.coverage>=.99)return 1;
 return 0;
}
function chooseVariant(save,id,date){
 const ex=EXERCISES[id],hist=exposureList(save,id,date);
 if(id==='push'){
   if(save.baseline.push<=3){
     const incline=hist.filter(h=>h.variant===0&&h.reps>=10&&h.effort!=='too_hard');
     if(incline.length<3)return 0;
     const knees=hist.filter(h=>h.variant===1&&h.reps>=10&&h.effort!=='too_hard');
     if(knees.length<3)return 1;
   }
   const standard=hist.filter(h=>h.variant===2&&h.reps>=14&&h.effort!=='too_hard');
   return standard.length>=6?3:2;
 }
 if(['triceps','squat','burpee','jacks','agility'].includes(id)){
   const required={triceps:10,squat:18,burpee:8,jacks:45,agility:45}[id];
   const first=hist.filter(h=>h.variant===0&&h.reps>=required&&h.effort!=='too_hard');
   if(first.length<3)return 0;
   const next=hist.filter(h=>h.variant===1&&h.reps>=required&&h.effort!=='too_hard');
   return Math.min(ex.variants.length-1,next.length>=5?2:1);
 }
 return 0;
}
export function unlockProgress(save,id,date=todayISO()){
 const ex=EXERCISES[id];if(!ex)return null;
 const variant=chooseVariant(save,id,date);
 if(variant>=ex.variants.length-1)return {variant,next:null,earned:0,required:0,target:0};
 const target=id==='push'?(variant===2?14:10):{triceps:10,squat:18,burpee:8,jacks:45,agility:45}[id];
 if(!target)return null;
 const required=id==='push'?(variant===2?6:3):(variant===1?5:3);
 const earned=exposureList(save,id,date).filter(h=>h.variant===variant&&h.reps>=target&&h.coverage>=.99&&h.effort!=='too_hard').length;
 return {variant,next:ex.variants[variant+1],earned:Math.min(required,earned),required,target};
}
export function recommendedMode(date){
 const day=new Date(date+'T12:00:00Z').getUTCDay();
 return ({0:'R',1:'A',2:'B',3:'C',4:'A',5:'B',6:'R'})[day];
}
export function generateQuest(save,date=todayISO(),override=null){
 if(!validISO(date))throw Error('Fecha inválida');
 const mode=override||(date===save.startDate&&!Object.keys(save.quests).length?'A':recommendedMode(date));
 if(!MODE[mode])throw Error('Modalidad inválida');
 const ids=[...MODE[mode].ids];
 if(save.equipmentPullup&&mode==='B')ids.push('pull');
 const tasks=ids.map(id=>{
   const variant=chooseVariant(save,id,date);
   const baseTarget=desiredProgression(save,id,date,variant);
   const tweak=clamp(save.coachTweaks?.[id]||0,-1,1);
   const target=round(clamp(baseTarget+tweak,1,EXERCISES[id].maxSet));
   return {id,name:EXERCISES[id].name,variant,target,sets:MODE[mode].rounds,rounds:[]};
 });
 const runningBaseline=Number(save.baseline.runDistance)||4;
 const runs=Object.values(save.quests).filter(q=>q.mode==='RUN'&&q.finishedAt&&q.date<date)
   .sort((a,b)=>b.date.localeCompare(a.date));
 const [last,previous]=runs;
 let runTarget=last?.runTarget||runningBaseline;
 if(last){
  const missed=last.runDistance<last.runTarget*.85||['hard','too_hard'].includes(last.runEffort);
  if(missed)runTarget=Math.max(1,runTarget-.5);
  else if(last.runEffort==='easy'&&previous?.runEffort==='easy'&&last.runDistance>=last.runTarget&&previous.runDistance>=previous.runTarget)runTarget+=.25;
 }
 // No sudden distance jumps, even with frequent 'easy' feedback.
 const elapsedWeeks=Math.max(0,(dayNumber(date)-dayNumber(save.startDate))/7);
 runTarget=Math.round(clamp(runTarget,1,Math.min(21,runningBaseline+elapsedWeeks*.6+.5))*100)/100;
 return {date,mode,tasks,runTarget,runMinutes:null,runDistance:null,runEffort:'ok',createdAt:Date.now(),finishedAt:null};
}
export function roundIndex(q){return q.mode==='RUN'?(q.finishedAt?1:0):(q.tasks?.length?Math.min(...q.tasks.map(t=>t.rounds.length)):0);}
export function isQuestComplete(q){
 if(q.mode==='RUN')return Boolean(q.finishedAt&&q.runDistance>0&&q.runMinutes>0);
 return Boolean(q.tasks?.length)&&q.tasks.every(t=>t.rounds.length>=t.sets);
}
export function earnedBadge(q){
 if(!isQuestComplete(q))return false;
 if(q.mode==='RUN')return q.runDistance>=q.runTarget*.9;
 return q.tasks.every(t=>t.rounds.filter(r=>r.actual>=t.target).length>=t.sets);
}
export function recordRound(save,date,rows){
 const q=save.quests[date];if(!q||q.mode==='RUN'||isQuestComplete(q))throw Error('No quedan bloques.');
 const tasks=q.tasks.map(t=>{
  const row=rows[t.id];if(!row)throw Error(`Falta ${t.id}`);
  const actual=Number(row.actual);
  if(!Number.isInteger(actual)||actual<0||actual>999)throw Error('Repeticiones inválidas');
  if(!EFFORTS.some(e=>e.id===row.effort))throw Error('Esfuerzo inválido');
  return {...t,rounds:[...t.rounds,{actual,effort:row.effort}]};
 });
 const next={...q,tasks};if(isQuestComplete(next))next.finishedAt=Date.now();
 return {...save,quests:{...save.quests,[date]:next}};
}
export function recordRun(save,date,distance,minutes,effort){
 const q=save.quests[date];if(!q||q.mode!=='RUN'||q.finishedAt)throw Error('La carrera no está disponible');
 distance=Number(distance);minutes=Number(minutes);
 if(!Number.isFinite(distance)||distance<.25||distance>100||!Number.isFinite(minutes)||minutes<3||minutes>360||minutes/distance<2.5||minutes/distance>25||!EFFORTS.some(e=>e.id===effort))throw Error('Distancia, tiempo o esfuerzo inválidos');
 const done={...q,runDistance:distance,runMinutes:minutes,runEffort:effort,finishedAt:Date.now()};
 return {...save,quests:{...save.quests,[date]:done},runs:[...save.runs,{date,distance,minutes,effort}]};
}
export function recordTest(save,date,id,value){
 if(!validISO(date)||!Object.hasOwn(EXERCISES,id))throw Error('Test no válido');
 const n=Number(value);if(!Number.isInteger(n)||n<0||n>999)throw Error('Valor no válido');
 const other=save.tests.filter(t=>!(t.date===date&&t.id===id));
 return {...save,tests:[...other,{date,id,value:n}]};
}
export function getStreak(save,today=todayISO()){
 const earned=new Set(Object.values(save.quests).filter(earnedBadge).filter(q=>q.date<=today).map(q=>q.date));
 if(!earned.size)return {streak:0,best:0,xp:0,badges:0,grace:0};
 const start=dayNumber([...earned].sort()[0]);let streak=0,best=0,misses=0,xp=0;
 for(let day=start;day<=dayNumber(today);day++){
   const date=isoFromDayNumber(day);
   if(earned.has(date)){
     if(misses>=2)streak=0;
     streak++;misses=0;best=Math.max(best,streak);
     xp+=streak===5?80:streak===6?100:streak>6?Math.min(160,100+10*(streak-6)):0;
   }else if(date!==today){misses++;if(misses===1)streak=Math.max(0,streak-1);if(misses>=2)streak=0;}
 }
 return {streak,best,xp,badges:earned.size,grace:misses};
}
export function getGameXP(save,today=todayISO()){
 const quests=Object.values(save.quests).filter(q=>q.date<=today);
 const actionXP=quests.reduce((sum,q)=>sum+(q.mode==='RUN'?(q.finishedAt?35:0):Math.min(3,roundIndex(q))*20),0);
 const badges=quests.filter(earnedBadge).length;
 const streak=getStreak(save,today);
 const xp=actionXP+badges*60+streak.xp;
 let level=1,remaining=xp;while(remaining>=level*140&&level<100){remaining-=level*140;level++;}
 return {xp,level,next:level*140,progress:round(remaining/(level*140)*100),actionXP,badges,streak};
}
const LOGSTEP=1.18;
function gain(current,base,offset=1,step=LOGSTEP){return Math.max(0,Math.log((current+offset)/(base+offset))/Math.log(step));}
function latestByDay(qs,id){const out=[];
 for(const q of Object.values(qs)){
  const t=q.tasks?.find(t=>t.id===id);if(!t)continue;
  const full=(t.rounds||[]).filter(r=>r.actual>=0&&r.effort!=='too_hard');
  if(full.length>=Math.max(1,t.sets-1)){
   const median=full.map(x=>x.actual).sort((a,b)=>a-b)[Math.floor(full.length/2)];
   const e=full.at(-1).effort;
   const factor=e==='easy'?.72:e==='ok'?.85:.96;
   out.push({date:q.date,value:Math.round(median/factor),source:'series'});
  }
 }
 return out;
}
export function verifiedCapacity(save,id,today=todayISO()){
 const initial=Number(save.baseline[id]||0);
 const tests=save.tests.filter(t=>t.id===id&&t.date<=today).map(t=>({date:t.date,value:t.value,source:'test'}));
 const sessions=latestByDay(save.quests,id).filter(x=>x.date<=today);
 const points=[...tests,...sessions].filter(p=>dayNumber(today)-dayNumber(p.date)<=150).sort((a,b)=>b.value-a.value);
 // A new personal best needs corroboration from a separate date at >= 90% of that value.
 let credible=initial;
 for(const p of points){
   if(p.value<=credible)break;
   const corroborated=points.some(v=>v.date!==p.date&&v.value>=p.value*.9);
   if(!corroborated)continue;
   const weeks=Math.max(0,(dayNumber(today)-dayNumber(save.startDate))/7);
   const limit=id==='pull'?Math.ceil(initial+weeks*.55):Math.ceil((initial+2)*(1+weeks*.25)-2);
   credible=Math.max(credible,Math.min(p.value,limit));
 }
 const best=points[0]?.value||initial;
 return {initial,verified:credible,best,unverified:best>credible,change:credible-initial};
}
function twoRunMetrics(save,today){
 const runs=save.runs.filter(r=>r.date<=today&&r.distance>0&&r.minutes>0).filter(r=>dayNumber(today)-dayNumber(r.date)<=150);
 const startD=Number(save.baseline.runDistance)||4, startP=Number(save.baseline.runPace)||390;
 const comparable=runs.filter(r=>r.distance>=startD*.9&&r.distance<=startD*1.15).map(r=>({...r,pace:r.minutes*60/r.distance})).sort((a,b)=>a.pace-b.pace);
 let pace=startP;
 for(const r of comparable){if(r.pace>=pace)break;if(comparable.some(x=>x.date!==r.date&&x.pace<=r.pace*1.015)){pace=Math.min(pace,r.pace);break;}}
 const distances=runs.filter(r=>r.minutes*60/r.distance<=startP*1.15).sort((a,b)=>b.distance-a.distance);
 let distance=startD;
 for(const r of distances){if(r.distance<=distance)break;if(distances.some(x=>x.date!==r.date&&x.distance>=r.distance*.9)){distance=r.distance;break;}}
 const weeks=Math.max(0,(dayNumber(today)-dayNumber(save.startDate))/7);
 pace=Math.max(startP*(1-Math.min(.45,weeks*.025)),pace);
 distance=Math.min(startD+weeks*.6,distance);
 return {pace:round(pace),distance:Math.round(distance*100)/100,baselinePace:startP,baselineDistance:startD,comparable:comparable.length};
}
export function getPerformance(save,today=todayISO()){
 const keys=Object.keys(EXERCISES),capacities=Object.fromEntries(keys.map(id=>[id,verifiedCapacity(save,id,today)]));
 const running=twoRunMetrics(save,today);
 const strengthGain=.65*gain(capacities.push.verified,capacities.push.initial,1)+.25*gain(capacities.pull.verified,capacities.pull.initial,2)+.1*gain(capacities.squat.verified,capacities.squat.initial,1);
 const coreGain=gain(capacities.plank.verified,capacities.plank.initial,5,1.15);
 const agilityGain=.65*gain(capacities.burpee.verified,capacities.burpee.initial,2)+.35*gain(capacities.agility.verified,capacities.agility.initial,10);
 const staminaGain=gain(running.distance,running.baselineDistance,1,1.12);
 const speedGain=running.pace<running.baselinePace?Math.log(running.baselinePace/running.pace)/Math.log(1.05):0;
 // Mobility is practice, not a measured flexibility level: report XP but never invent capacity gains.
 const levelGain={strength:Math.floor(strengthGain+.5),core:Math.floor(coreGain+.5),agility:Math.floor(agilityGain+.5),stamina:Math.floor(staminaGain+.5),speed:Math.floor(speedGain+.5),mobility:0};
 const skills=Object.fromEntries(Object.entries(levelGain).map(([id,levels])=>[id,{name:SKILLS[id].name,level:1+levels,gain:levels,color:SKILLS[id].color}]));
 return {skills,capacities,running};
}
export function getPerformanceTimeline(save,today=todayISO(),points=12){
 const start=dayNumber(save.startDate),end=dayNumber(today);const dates=[];
 for(let i=0;i<points;i++){const day=round(start+(end-start)*(i/(points-1)));dates.push(isoFromDayNumber(day));}
 return [...new Set(dates)].map(date=>{
  const p=getPerformance(save,date);return {date,short:date.slice(5),strength:p.skills.strength.level,stamina:p.skills.stamina.level,speed:p.skills.speed.level,core:p.skills.core.level,agility:p.skills.agility.level};
 });
}
export function getSummaryForAI(save,today=todayISO()){
 const quests=Object.values(save.quests).filter(q=>q.date<=today).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,12);
 const performance=getPerformance(save,today),game=getGameXP(save,today);
 return {language:'es',xp:game.xp,streak:game.streak.streak,baseline:save.baseline,performance:{skills:performance.skills,capacities:Object.fromEntries(Object.entries(performance.capacities).map(([k,v])=>[k,{initial:v.initial,verified:v.verified}])),run:performance.running},recent:quests.map(q=>({date:q.date,mode:q.mode,badge:earnedBadge(q),tasks:q.tasks?.map(t=>({id:t.id,target:t.target,actual:t.rounds.map(r=>r.actual),effort:t.rounds.map(r=>r.effort)})),run:q.mode==='RUN'?{km:q.runDistance,min:q.runMinutes,effort:q.runEffort}:undefined}))};
}
