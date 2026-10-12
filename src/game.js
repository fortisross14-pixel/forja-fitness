/** Lógica pura para que el progreso y los desbloqueos puedan probarse sin React. */
export const SKILLS = {
  strength: {label:'Fuerza',symbol:'◆',color:'#b9f474',description:'Flexiones, sentadillas, zancadas y trabajo muscular',meaning:'Capacidad muscular · nivel de actividad, no fuerza medida'},
  stamina: {label:'Resistencia',symbol:'◉',color:'#60d8cc',description:'Correr, caminar a paso ligero, cardio',meaning:'Trabajo aeróbico acumulado'},
  speed: {label:'Velocidad',symbol:'➤',color:'#ffad66',description:'Carrera y desplazamientos rápidos',meaning:'Práctica de desplazamiento; el ritmo registrado mide la mejora'},
  agility: {label:'Agilidad',symbol:'✧',color:'#ab9dff',description:'Cambios de dirección, coordinación y burpees',meaning:'Coordinación y cambios de dirección practicados'},
  core: {label:'Core',symbol:'⬡',color:'#78b8ff',description:'Planchas, dead bug y estabilidad',meaning:'Trabajo de estabilidad del tronco'},
  mobility: {label:'Movilidad',symbol:'↝',color:'#f6a2bf',description:'Movilidad suave y recuperación activa',meaning:'Movimientos de movilidad practicados'}
};

// Cada actividad distribuye SOLAMENTE su XP base entre atributos.
// La XP de rachas y logros sube el nivel general, pero no las habilidades.
export const TYPES = {
  A: { label:'Fuerza A', short:'Pecho + piernas', kind:'circuit', xp:50, accent:'lime', description:'Flexiones · sentadillas · plancha · ángeles inversos', tracks:['push','squat'], weights:{strength:0.72,core:0.24,stamina:0.04} },
  B: { label:'Fuerza B', short:'Tríceps + glúteos', kind:'circuit', xp:50, accent:'purple', description:'Flexiones cerradas · zancadas · puente · dead bug', tracks:['triceps'], weights:{strength:0.70,core:0.24,agility:0.06} },
  C: { label:'Cardio', short:'Pulso + burpees', kind:'circuit', xp:40, accent:'orange', description:'Burpees · jumping jacks · marcha rápida', tracks:['burpee'], weights:{stamina:0.45,agility:0.27,speed:0.16,strength:0.12} },
  AGI: {label:'Agilidad', short:'Pies + coordinación', kind:'circuit', xp:40, accent:'purple', description:'Pasos laterales rápidos · cambios de dirección · equilibrio dinámico (5 min por circuito)', tracks:[], weights:{agility:0.68,speed:0.20,stamina:0.12}},
  RUN: {label:'Correr', short:'Ritmo + fondo', kind:'time', xp:0, accent:'orange', description:'Registra los minutos y, si los sabes, los kilómetros. Desarrolla resistencia y velocidad.', tracks:[], weights:{stamina:0.72,speed:0.28}},
  WALK: {label:'Caminar', short:'Paseo activo', kind:'time', xp:0, accent:'sky', description:'Caminar a paso vivo. La XP es deliberadamente moderada y tiene un límite diario.', tracks:[], weights:{stamina:0.85,mobility:0.15}},
  R: { label:'Recuperación', short:'Movilidad suave', kind:'recovery', xp:15, accent:'sky', description:'Movilidad, estiramientos o paseo tranquilo. Máximo 15 XP por día.', tracks:[], weights:{mobility:0.85,core:0.15} }
};

export function isCircuitType(type) {return TYPES[type]?.kind==='circuit';}
export function entryBaseXP(entry) {
  if(!TYPES[entry.type]) return 0;
  if(entry.type==='R')return 15;
  if(entry.type==='RUN')return Math.min(180,Math.round(Number(entry.minutes||0)*2+Number(entry.distance||0)*2));
  if(entry.type==='WALK')return Math.min(70,Math.round(Number(entry.minutes||0)*0.8));
  return Number(entry.count)*TYPES[entry.type].xp;
}

export function allocateSkillXP(entry, xp=entryBaseXP(entry)) {
  const weights=entry.type==='RUN' && !entry.distance ? {stamina:0.9,speed:0.1} : TYPES[entry.type]?.weights||{};
  const keys=Object.keys(weights), allocation={};
  let given=0;
  for(const k of keys.slice(0,-1)){allocation[k]=Math.round(xp*weights[k]);given+=allocation[k];}
  if(keys.length)allocation[keys.at(-1)]=Math.max(0,xp-given);
  return allocation;
}

export function skillLevel(xp) {
  let level=1, spent=0;
  const goal=l=>Math.round(100+70*(l-1)+10*(l-1)**2);
  while(level<100 && xp>=spent+goal(level)){spent+=goal(level);level++;}
  const next=goal(level);
  return {xp,level,levelXP:xp-spent,nextLevelXP:next,pct:Math.min(100,Math.round(100*(xp-spent)/next))};
}

// Evita que un día repetido de recuperación/paseo genere XP sin límite.
export function creditedWorkouts(entries,today=todayISO()) {
  const creditByDate=new Map();
  return entries.filter(e=>validISO(e.date)&&e.date<=today&&TYPES[e.type]).slice().sort((a,b)=>a.date.localeCompare(b.date)||Number(a.createdAt||0)-Number(b.createdAt||0)||String(a.id).localeCompare(String(b.id))).map(e=>{
    const key=e.date, consumed=creditByDate.get(key)||{recovery:0,walking:0};
    let xp=entryBaseXP(e);
    if(e.type==='R'){xp=Math.min(xp,Math.max(0,15-consumed.recovery));consumed.recovery+=xp;}
    if(e.type==='WALK'){xp=Math.min(xp,Math.max(0,70-consumed.walking));consumed.walking+=xp;}
    creditByDate.set(key,consumed);
    return {entry:e,xp,allocation:allocateSkillXP(e,xp)};
  });
}

export function skillWeeks(entries,today=todayISO(),count=8){
  const day=dayNumber(today),monday=day-((new Date(`${today}T12:00:00Z`).getUTCDay()+6)%7);
  const credits=creditedWorkouts(entries,today);
  return Array.from({length:count},(_,i)=>{
    const start=monday-(count-i-1)*7;
    const snapshot={label:humanDate(isoFromDayNumber(start)),date:isoFromDayNumber(start)};
    for(const skill of Object.keys(SKILLS))snapshot[skill]=credits.filter(c=>dayNumber(c.entry.date)<=Math.min(day,start+6)).reduce((sum,c)=>sum+(c.allocation[skill]||0),0);
    return snapshot;
  });
}

export function runningSeries(entries,today=todayISO()) {
  return entries.filter(e=>e.type==='RUN'&&e.date<=today&&Number(e.distance)>=1&&Number(e.minutes)>=5)
    .map(e=>({date:e.date,short:humanDate(e.date),distance:e.distance,minutes:e.minutes,pace:+(e.minutes/e.distance).toFixed(2)}))
    .sort((a,b)=>a.date.localeCompare(b.date));
}

export const TRACKS = {
  push: { label: 'Flexiones', short: 'Flexiones', symbol: '↗', type: 'A', unit: 'reps', stages: [
    { name: 'Inclinadas', full: 'Flexiones inclinadas', target: 10, circuits: 12, suggestion: 8 },
    { name: 'De rodillas', full: 'Flexiones de rodillas', target: 10, circuits: 16, suggestion: 8 },
    { name: 'Estándar', full: 'Flexiones estándar', target: 12, circuits: 20, suggestion: 6 },
    { name: 'Tempo 3 s', full: 'Flexiones lentas (3 s de bajada)', target: null, circuits: null, suggestion: 6 }
  ]},
  squat: { label: 'Sentadillas', short: 'Sentadillas', symbol: '⌄', type: 'A', unit: 'reps', stages: [
    { name: 'Clásicas', full: 'Sentadillas clásicas', target: 15, circuits: 15, suggestion: 12 },
    { name: 'Con pausa', full: 'Sentadillas con pausa abajo', target: 15, circuits: 18, suggestion: 12 },
    { name: 'Tempo 3 s', full: 'Sentadillas lentas (3 s bajada)', target: null, circuits: null, suggestion: 10 }
  ]},
  triceps: { label: 'Tríceps', short: 'Tríceps', symbol: '↗', type: 'B', unit: 'reps', stages: [
    { name: 'Cerradas inclinadas', full: 'Flexiones cerradas inclinadas', target: 8, circuits: 10, suggestion: 8 },
    { name: 'Cerradas rodillas', full: 'Flexiones cerradas de rodillas', target: 10, circuits: 16, suggestion: 8 },
    { name: 'Cerradas suelo', full: 'Flexiones cerradas estándar', target: null, circuits: null, suggestion: 6 }
  ]},
  burpee: { label: 'Burpees', short: 'Burpees', symbol: '↟', type: 'C', unit: 'reps', stages: [
    { name: 'Sin salto', full: 'Burpee sin salto ni flexión', target: 5, circuits: 10, suggestion: 5 },
    { name: 'Completo', full: 'Burpee completo controlado', target: 8, circuits: 14, suggestion: 5 },
    { name: 'Con salto alto', full: 'Burpee completo con salto alto', target: 10, circuits: 20, suggestion: 6 },
    { name: 'Avanzado', full: 'Burpee avanzado', target: null, circuits: null, suggestion: 6 }
  ]}
};

const DAY_MS = 86400000;
export function dayNumber(iso) { return Math.floor(Date.parse(`${iso}T12:00:00Z`) / DAY_MS); }
export function isoFromDayNumber(n) { return new Date(n * DAY_MS).toISOString().slice(0,10); }
export function todayISO(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function validISO(iso) { if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false; const d = new Date(`${iso}T12:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10) === iso; }
export function humanDate(iso, opts = {}) { if (!validISO(iso)) return iso; return new Intl.DateTimeFormat('es-ES', { day:'numeric', month:'short', ...(opts.year ? { year:'numeric' }: {}) }).format(new Date(`${iso}T12:00:00Z`)); }
const MONTHS = { january:1,jan:1,enero:1,ene:1, february:2,feb:2,febrero:2, march:3,mar:3,marzo:3, april:4,apr:4,abril:4,abr:4, may:5,mayo:5, june:6,jun:6,junio:6, july:7,jul:7,julio:7, august:8,aug:8,agosto:8,ago:8, september:9,sep:9,sept:9,septiembre:9,setiembre:9, october:10,oct:10,octubre:10, november:11,nov:11,noviembre:11, december:12,dec:12,diciembre:12,dic:12 };
export function parseHumanDate(raw, now = new Date()) {
  const input = String(raw || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[,\.]/g,' ').replace(/\s+/g,' ').trim();
  const current = todayISO(now);
  if (['hoy','today'].includes(input)) return current;
  if (['ayer','yesterday'].includes(input)) return isoFromDayNumber(dayNumber(current)-1);
  if (validISO(input)) return input <= current ? input : null;
  let day, month, year;
  const slash = input.match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?$/);
  if (slash) { day = Number(slash[1]); month = Number(slash[2]); year = slash[3] && Number(slash[3]); }
  else {
    const words = input.replace(/\b(de|del|the|of)\b/g,'').split(' ').filter(Boolean);
    if (words.length < 2 || words.length > 3) return null;
    const key = words.find(w => MONTHS[w]);
    if (!key) return null;
    month = MONTHS[key];
    const numbers = words.filter(w=>/^\d{1,4}$/.test(w));
    if (!numbers.length) return null;
    day= Number(numbers[0]); year=numbers[1] ? Number(numbers[1]):null;
  }
  if (year && year < 100) year += 2000;
  const explicit = Boolean(year);
  year ||= now.getFullYear();
  const build=()=>`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  let result=build();
  if (!explicit && result>current) { year--; result=build(); }
  return validISO(result) && result <= current ? result : null;
}

export function getTrackProgress(entries) {
  const result = {};
  for (const [key, track] of Object.entries(TRACKS)) {
    const qualified = track.stages.map((stage, stageIndex) => entries.reduce((count,e) =>
      count + ((e.type===track.type && Number(e.stages?.[key]??0)===stageIndex && Number(e.reps?.[key])>=stage.target && stage.target !== null) ? Number(e.count) : 0),0));
    let unlocked=0;
    while (unlocked < track.stages.length - 1 && qualified[unlocked] >= track.stages[unlocked].circuits) unlocked++;
    const stage=track.stages[unlocked];
    const atStage=entries.filter(e=>e.type===track.type && Number(e.stages?.[key]??0)===unlocked);
    const best=atStage.reduce((p,e)=>Math.max(p,Number(e.reps?.[key]||0)),0);
    result[key]={ level:unlocked, stage, best, qualified:qualified[unlocked]||0, target:stage.circuits, qualifyingReps:stage.target, unlockedNames:track.stages.slice(0,unlocked+1).map(x=>x.name), levelsUnlocked:unlocked };
  }
  return result;
}

export function calculateGame(entries, metrics=[], today=todayISO()) {
  const clean=entries.filter(e=>validISO(e.date) && e.date<=today && TYPES[e.type] && Number(e.count)>0);
  const daysMap=new Map();
  for(const entry of clean){
    if(!daysMap.has(entry.date))daysMap.set(entry.date,[]);
    daysMap.get(entry.date).push(entry);
  }
  const credits=creditedWorkouts(clean,today);
  const creditedByDay=new Map();
  for(const c of credits)creditedByDay.set(c.entry.date,(creditedByDay.get(c.entry.date)||0)+c.xp);
  const dates=Array.from(daysMap.keys()).sort();
  let streak=0, maxStreak=0, misses=0, dailyXP=0, activeDays=0;
  const days=[];
  if(dates.length){
    const beginning=dayNumber(dates[0]);
    const end=dayNumber(today);
    for(let num=beginning;num<=end;num++){
      const date=isoFromDayNumber(num), dayEntries=daysMap.get(date)||[];
      if(dayEntries.length){
        if(misses>=2)streak=0;
        streak+=1;misses=0;activeDays++;
        const blocks=dayEntries.filter(e=>isCircuitType(e.type)).reduce((n,e)=>n+Number(e.count),0);
        const bases=creditedByDay.get(date)||0;
        const momentum=streak>=5? Math.min(160,80+(streak-5)*20):0;
        const xp=bases+(blocks>0?10:0)+(blocks>=3?15:0)+momentum;
        dailyXP+=xp;
        maxStreak=Math.max(maxStreak,streak);
        days.push({date,active:true,streak,blocks,xp,bonus:momentum});
      }else if(date!==today){
        misses++;
        if(misses===1) streak=Math.max(0,streak-1);
        if(misses>=2)streak=0;
        days.push({date,active:false,streak,blocks:0,xp:0,bonus:0});
      }
    }
  }
  const tracks=getTrackProgress(clean);
  const circuitTotal=clean.filter(e=>isCircuitType(e.type)).reduce((n,e)=>n+Number(e.count),0);
  const allBlocks=clean.reduce((n,e)=>n+Number(e.count),0);
  const skillXP=Object.fromEntries(Object.keys(SKILLS).map(k=>[k,0]));
  for(const c of credits)for(const [k,xp]of Object.entries(c.allocation))skillXP[k]+=xp;
  const totalSkillXP=Object.values(skillXP).reduce((a,b)=>a+b,0);
  const skills=Object.fromEntries(Object.entries(skillXP).map(([k,xp])=>[k,{...skillLevel(xp),share:totalSkillXP?Math.round(xp/totalSkillXP*100):0}]));
  const running=runningSeries(clean,today);
  const bestPace=running.length ? Math.min(...running.map(r=>r.pace)):null;
  const kmRun=clean.filter(e=>e.type==='RUN').reduce((a,e)=>a+Number(e.distance||0),0);
  const awarded=[
    {id:'first',name:'Primera chispa',description:'Completa tu primer circuito',xp:25,done:circuitTotal>=1,icon:'zap'},
    {id:'ten',name:'En movimiento',description:'Acumula 10 circuitos',xp:50,done:circuitTotal>=10,icon:'target'},
    {id:'streak',name:'Imparable',description:'Alcanza una racha de 5 días',xp:120,done:maxStreak>=5,icon:'flame'},
    {id:'evolve',name:'Evolución',description:'Desbloquea una nueva variante',xp:100,done:Object.values(tracks).some(t=>t.level>=1),icon:'sparkles'},
    {id:'fifty',name:'50 circuitos',description:'Completa 50 circuitos',xp:200,done:circuitTotal>=50,icon:'medal'},
    {id:'consistency',name:'Constancia',description:'Entrena o recupérate 20 días distintos',xp:140,done:activeDays>=20,icon:'calendar'},
    {id:'measure',name:'Cintura a raya',description:'Registra dos mediciones de cintura',xp:40,done:metrics.filter(m=>m.waist>0).length>=2,icon:'ruler'},
    {id:'runner',name:'Primeros kilómetros',description:'Registra 5 km acumulados corriendo',xp:70,done:kmRun>=5,icon:'footprints'},
    {id:'balanced',name:'Perfil versátil',description:'Alcanza el nivel 3 en cuatro atributos',xp:160,done:Object.values(skills).filter(s=>s.level>=3).length>=4,icon:'activity'}
  ];
  const achievementXP=awarded.filter(b=>b.done).reduce((n,b)=>n+b.xp,0);
  const xp=dailyXP+achievementXP;
  let level=1,spent=0;
  const goal=lv=>Math.round(180+75*(lv-1)+16*(lv-1)**2);
  while(level<100 && xp>=spent+goal(level)) {spent+=goal(level);level++;}
  const next=goal(level);
  const ranks=['RECLUTA','INICIADO','CONSTANTE','IMPARABLE','ATLETA','VETERANO','ÉLITE','TITÁN','LEYENDA'];
  const rank=ranks[Math.min(ranks.length-1,Math.floor((level-1)/2))];
  const focus=Object.entries(skills).sort((a,b)=>b[1].xp-a[1].xp)[0]?.[0]||'strength';
  return {xp,dailyXP,achievementXP,level,rank,levelXP:xp-spent,nextLevelXP:next,levelPct:Math.min(100,Math.round((xp-spent)/next*100)),streak,maxStreak,misses,days,tracks,awarded,skills,skillXP,totalSkillXP,focus,bestPace,kmRun,activeDays,circuitTotal,allBlocks,totalStrength:clean.filter(e=>e.type==='A'||e.type==='B').reduce((n,e)=>n+e.count,0), lastDay:dates.at(-1)||null};
}

export function lastWeeks(entries, stats, today=todayISO(), count=8) {
  const current=dayNumber(today);
  const monday=current-((new Date(`${today}T12:00:00Z`).getUTCDay()+6)%7);
  const result=[];
  for(let week=count-1;week>=0;week--){
    const start=monday-week*7,end=start+6;
    const weekEntries=entries.filter(e=> {const n=dayNumber(e.date);return n>=start&&n<=end && n<=current;});
    const xp=stats.days.filter(d=> {const n=dayNumber(d.date);return n>=start&&n<=end;}).reduce((a,d)=>a+d.xp,0);
    result.push({label:humanDate(isoFromDayNumber(start)), date:isoFromDayNumber(start),circuits:weekEntries.filter(e=>isCircuitType(e.type)).reduce((a,e)=>a+Number(e.count),0),xp});
  }
  return result;
}

export function strengthSeries(entries, trackKey, stage, today=todayISO()) {
  const track=TRACKS[trackKey];
  const dateMap=new Map();
  for(const e of entries){
    if(e.date>today || e.type!==track.type || Number(e.stages?.[trackKey]??0)!==stage)continue;
    dateMap.set(e.date,Math.max(dateMap.get(e.date)||0,Number(e.reps?.[trackKey]||0)));
  }
  return Array.from(dateMap).sort((a,b)=>a[0].localeCompare(b[0])).map(([date,reps])=>({date,short:humanDate(date),reps}));
}

export function sanitizeEntry(e) {
  if(!e||!validISO(e.date)||!TYPES[e.type])return null;
  const type=TYPES[e.type];
  const count=type.kind==='circuit' ? Math.floor(Number(e.count)) : 1;
  if(count<1||count>30)return null;
  const reps={}, stages={};
  for(const key of type.tracks){
    const n=Number(e.reps?.[key]);
    const s=Number(e.stages?.[key]??0);
    if(!Number.isFinite(n)||n<1||n>500 || !Number.isInteger(s)||s<0||s>=TRACKS[key].stages.length)return null;
    reps[key]=Math.floor(n);stages[key]=s;
  }
  let minutes=0, distance=0;
  if(type.kind==='time'){
    minutes=Number(e.minutes);
    distance=e.distance===''||e.distance==null?0:Number(e.distance);
    if(!Number.isInteger(minutes)||minutes<5||minutes>(e.type==='RUN'?180:240))return null;
    if(!Number.isFinite(distance)||distance<0||distance>100)return null;
    if(e.type==='RUN' && distance>0 && (minutes/distance<2.5||minutes/distance>25))return null;
  }
  return {id:String(e.id||`${Date.now()}-${Math.random()}`),date:e.date,type:e.type,count,reps,stages,plank:Math.min(900,Math.max(0,Number(e.plank)||0)),minutes,distance:Math.round(distance*100)/100,createdAt:Number(e.createdAt)||Date.now()};
}
