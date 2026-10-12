import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowRight, ArrowUpRight, BadgeCheck, BarChart3, CalendarDays,
  Check, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, ClipboardList,
  Download, Dumbbell, Flame, Footprints, HeartPulse, Home, Info, LockKeyhole,
  Medal, Minus, Plus, RotateCcw, Ruler, Shield, Sparkles, Target, Trash2,
  TrendingUp, Trophy, Upload, X, Zap, Gauge, Wind, Crosshair
} from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { TYPES, TRACKS, SKILLS, calculateGame, dayNumber, humanDate, isoFromDayNumber,
  lastWeeks, parseHumanDate, sanitizeEntry, strengthSeries, skillWeeks, runningSeries,
  isCircuitType, entryBaseXP, allocateSkillXP, todayISO, validISO
} from './game.js';

const STORE_KEY = 'forja-fitness-v1';
const EMPTY = { entries:[], measurements:[] };
function loadData() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (!raw || !Array.isArray(raw.entries)) return EMPTY;
    return {entries:raw.entries.map(sanitizeEntry).filter(Boolean), measurements:Array.isArray(raw.measurements)?raw.measurements.filter(m=>validISO(m.date)&&((Number(m.weight)>0)||(Number(m.waist)>0))).map(m=>({id:String(m.id),date:m.date,weight:m.weight?Number(m.weight):null,waist:m.waist?Number(m.waist):null})):[]};
  } catch { return EMPTY; }
}
function makeId() { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
const NUM = new Intl.NumberFormat('es-ES');
const formatNumber = n => NUM.format(n);
const weekDays=['D','L','M','X','J','V','S'];
const nav=[{id:'inicio',name:'Cuartel',Icon:Home},{id:'registrar',name:'Registrar',Icon:Plus},{id:'perfil',name:'Atributos',Icon:Activity},{id:'evolucion',name:'Evolución',Icon:TrendingUp},{id:'insignias',name:'Logros',Icon:Trophy}];
const iconForAchievement={first:Zap,ten:Target,streak:Flame,evolve:Sparkles,fifty:Medal,consistency:CalendarDays,measure:Ruler,runner:Footprints,balanced:Activity};
const colors={A:'#b9f474',B:'#ab9dff',C:'#ffad66',AGI:'#ab9dff',RUN:'#ffad66',WALK:'#70cfed',R:'#70cfed'};
const typeIcons={A:Dumbbell,B:Target,C:HeartPulse,AGI:Crosshair,RUN:Wind,WALK:Footprints,R:HeartPulse};
const skillIcons={strength:Dumbbell,stamina:HeartPulse,speed:Wind,agility:Crosshair,core:Shield,mobility:Activity};
function paceText(minPerKm){if(!Number.isFinite(minPerKm))return '—';const n=Math.round(minPerKm*60);return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')} min/km`;}


function SectionHeading({eyebrow,title,subtitle,side}) {
  return <div className="section-head"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{side}</div>;
}
function ProgressBar({value=0,color='lime',height=8}) {
  return <div className={`progress-track track-${color}`} style={{height}}><div className="progress-fill" style={{width:`${Math.max(0,Math.min(100,value))}%`}} /></div>;
}
function StatCard({Icon,label,value,detail,color='lime'}) {
  return <div className="stat-card"><div className="stat-top"><span>{label}</span><div className={`stat-icon tone-${color}`}><Icon size={18}/></div></div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div></div>;
}
function NumberControl({value,onChange,min=1,max=99,label}) {
  return <div className="number-control" aria-label={label}><button type="button" onClick={()=>onChange(Math.max(min,value-1))} disabled={value<=min} aria-label={`Reducir ${label}`}><Minus size={17}/></button><strong>{value}</strong><button type="button" onClick={()=>onChange(Math.min(max,value+1))} disabled={value>=max} aria-label={`Aumentar ${label}`}><Plus size={17}/></button></div>;
}
function EmptyChart({Icon=BarChart3,label}) { return <div className="empty-chart"><div className="empty-chart-icon"><Icon size={25}/></div><strong>Aquí empieza tu historia</strong><span>{label}</span></div>; }
function formatTooltip(num, unit) {return `${formatNumber(num)} ${unit}`;}

function App() {
  const [data,setData]=useState(loadData);
  const [today,setToday]=useState(todayISO());
  const [activeNav,setActiveNav]=useState('inicio');
  const [settings,setSettings]=useState(false);
  const [notification,setNotification]=useState(null);
  const fileRef=useRef(null);
  const sections=useRef({});
  const [dateText,setDateText]=useState(humanDate(todayISO(),{year:true}));
  const [workout,setWorkout]=useState('A');
  const [count,setCount]=useState(1);
  const [formReps,setFormReps]=useState({push:8,squat:12,triceps:8,burpee:5});
  const [formStages,setFormStages]=useState({push:0,squat:0,triceps:0,burpee:0});
  const [plank,setPlank]=useState(25);
  const [minutes,setMinutes]=useState(30);
  const [distance,setDistance]=useState('');
  const [selectedSkill,setSelectedSkill]=useState('strength');
  const [error,setError]=useState('');
  const [chartMode,setChartMode]=useState('circuits');
  const [strengthTrack,setStrengthTrack]=useState('push');
  const [strengthStage,setStrengthStage]=useState(0);
  const [measurementDate,setMeasurementDate]=useState(today);
  const [weight,setWeight]=useState('');
  const [waist,setWaist]=useState('');

  const stats=useMemo(()=>calculateGame(data.entries,data.measurements,today),[data,today]);
  const chartWeeks=useMemo(()=>lastWeeks(data.entries,stats,today),[data.entries,stats,today]);
  const skillHistory=useMemo(()=>skillWeeks(data.entries,today),[data.entries,today]);
  const runningHistory=useMemo(()=>runningSeries(data.entries,today),[data.entries,today]);
  const radarData=useMemo(()=>Object.entries(SKILLS).map(([k,skill])=>({skill:skill.label,level:stats.skills[k].level+stats.skills[k].levelXP/stats.skills[k].nextLevelXP})),[stats.skills]);
  const previewWorkout={type:workout,count,minutes:Number(minutes)||0,distance:Number(distance)||0};
  const previewXP=entryBaseXP(previewWorkout);
  const previewSkills=allocateSkillXP(previewWorkout,previewXP);
  const strengthData=useMemo(()=>strengthSeries(data.entries,strengthTrack,strengthStage,today),[data.entries,strengthTrack,strengthStage,today]);
  const sortedEntries=useMemo(()=>[...data.entries].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt),[data.entries]);
  const orderedMeasurements=[...data.measurements].sort((a,b)=>b.date.localeCompare(a.date));
  const lastWeight=orderedMeasurements.find(m=>m.weight!==null)?.weight;
  const lastWaist=orderedMeasurements.find(m=>m.waist!==null)?.waist;
  const waistHistory=[...data.measurements].filter(m=>m.waist!==null).sort((a,b)=>a.date.localeCompare(b.date));
  const waistDiff=waistHistory.length>=2?(waistHistory.at(-1).waist-waistHistory[0].waist):null;

  useEffect(()=> {try{localStorage.setItem(STORE_KEY,JSON.stringify(data));}catch{setNotification({title:'Almacenamiento lleno',body:'No se pudo guardar en este navegador. Exporta tus datos.'});}},[data]);
  useEffect(()=> {const id=setInterval(()=>{const current=todayISO();setToday(p=>p===current?p:current);},60000);return ()=>clearInterval(id);},[]);
  useEffect(()=> {if(!notification)return;const id=setTimeout(()=>setNotification(null),5500);return()=>clearTimeout(id);},[notification]);
  useEffect(()=> {
    const stages={}, reps={};
    for(const key of Object.keys(TRACKS)){
      stages[key]=stats.tracks[key].level;
      reps[key]=TRACKS[key].stages[stages[key]].suggestion;
    }
    setFormStages(stages);setFormReps(reps);
  },[stats.tracks.push.level,stats.tracks.squat.level,stats.tracks.triceps.level,stats.tracks.burpee.level]);

  function jump(id){setActiveNav(id);sections.current[id]?.scrollIntoView({behavior:'smooth',block:'start'});}
  function addEntry(e){
    e.preventDefault();setError('');
    const date=parseHumanDate(dateText);
    if(!date){setError('Fecha no válida. Prueba «October 11», «11 oct 2026», «hoy» o usa el calendario.');return;}
    const clean=sanitizeEntry({id:makeId(),date,type:workout,count:isCircuitType(workout)?count:1,reps:formReps,stages:formStages,plank:workout==='A'?plank:0,minutes,distance,createdAt:Date.now()});
    if(!clean){setError('Revisa el registro: repeticiones válidas o, para correr/caminar, minutos (mínimo 5) y distancia opcional. Para correr el ritmo debe ser plausible.');return;}
    const nextEntries=[...data.entries,clean];
    const nextStats=calculateGame(nextEntries,data.measurements,today);
    const unlocked=Object.keys(TRACKS).filter(k=>nextStats.tracks[k].level>stats.tracks[k].level);
    const gained=nextStats.xp-stats.xp;
    setData(s=>({...s,entries:nextEntries}));
    const improvedSkills=Object.keys(SKILLS).filter(k=>nextStats.skills[k].level>stats.skills[k].level);
    const activityText=workout==='RUN'||workout==='WALK'?`${minutes} min de ${TYPES[workout].label.toLowerCase()}${clean.distance?` · ${clean.distance} km`:''}`:workout==='R'?'1 sesión de recuperación':`${count} ${count===1?'circuito':'circuitos'} de ${TYPES[workout].label}`;
    const skillText=improvedSkills.length?` · ¡SUBE ${improvedSkills.map(k=>SKILLS[k].label.toUpperCase()).join(', ')}!`:'';
    setNotification({title:unlocked.length?'¡NUEVA EVOLUCIÓN!':improvedSkills.length?'¡ATRIBUTO MEJORADO!':'ACTIVIDAD GUARDADA',body:`${activityText} · +${gained} XP${skillText}${unlocked.length?` · ${unlocked.map(k=>TRACKS[k].label+': '+nextStats.tracks[k].stage.name).join(' · ')}`:''}`,special:unlocked.length>0||improvedSkills.length>0});
  }
  function deleteEntry(id){if(!window.confirm('¿Eliminar este registro? Se recalcularán la experiencia, la racha y los desbloqueos.'))return;setData(s=>({...s,entries:s.entries.filter(e=>e.id!==id)}));}
  function addMeasurement(e){
    e.preventDefault();
    const w=weight.trim()?Number(weight):null, c=waist.trim()?Number(waist):null;
    if(!validISO(measurementDate)||measurementDate>today||(!w&&!c)||(w!==null&&(w<25||w>350))||(c!==null&&(c<40||c>250))) {setNotification({title:'Revisa las medidas',body:'Introduce una fecha no futura y un peso o cintura válidos.'});return;}
    setData(s=>({...s,measurements:[...s.measurements,{id:makeId(),date:measurementDate,weight:w,waist:c}]}));
    setWeight('');setWaist('');setNotification({title:'MEDIDAS GUARDADAS',body:'Tu evolución corporal ya está registrada.'});
  }
  function exportData(){
    const blob=new Blob([JSON.stringify({version:2,app:'FORJA',exportedAt:new Date().toISOString(),...data},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`forja-respaldo-${today}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  async function importData(e){
    const file=e.target.files?.[0];e.target.value='';if(!file)return;
    try {
      const parsed=JSON.parse(await file.text());
      if(!Array.isArray(parsed.entries)||!Array.isArray(parsed.measurements))throw new Error('bad format');
      const entries=parsed.entries.map(sanitizeEntry);
      if(entries.some(x=>!x)||parsed.entries.length>100000||parsed.measurements.length>100000)throw new Error('invalid entries');
      const measurements=parsed.measurements.map(m=>({id:String(m.id||makeId()),date:String(m.date),weight:m.weight===null?null:Number(m.weight),waist:m.waist===null?null:Number(m.waist)}));
      if(measurements.some(m=>!validISO(m.date)||(m.weight!==null&&(!Number.isFinite(m.weight)||m.weight<=0))||(m.waist!==null&&(!Number.isFinite(m.waist)||m.waist<=0))))throw new Error('invalid measures');
      if(!window.confirm(`Importar ${entries.length} entrenamientos y ${measurements.length} mediciones? Reemplazará los datos actuales.`))return;
      setData({entries,measurements});setSettings(false);setNotification({title:'DATOS RECUPERADOS',body:'Tu progreso se ha importado correctamente.'});
    } catch {setNotification({title:'Archivo no válido',body:'Importa un respaldo .json exportado desde FORJA.'});}
  }
  function resetData(){if(!window.confirm('¿Seguro que quieres borrar todo tu progreso de este navegador? Exporta antes si quieres conservarlo.'))return;if(!window.confirm('Última confirmación: esta acción no se puede deshacer.'))return;setData({entries:[],measurements:[]});setSettings(false);setNotification({title:'PROGRESO REINICIADO',body:'La pizarra está limpia. Puedes empezar de nuevo.'});}

  const daySet=new Set(stats.days.filter(d=>d.active).map(d=>d.date));
  const lastSeven=Array.from({length:7},(_,i)=>isoFromDayNumber(dayNumber(today)-(6-i)));
  const recentWeek=stats.days.filter(d=>dayNumber(d.date)>=dayNumber(today)-6 && d.active).length;
  const highlightTrack=Object.entries(stats.tracks).find(([,v])=>v.target!==null && v.target-v.qualified<=4) || Object.entries(stats.tracks).find(([,v])=>v.target!==null);

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={()=>jump('inicio')} aria-label="FORJA inicio"><span className="brand-logo"><Zap size={24} fill="currentColor" strokeWidth={2.5}/></span><span><strong>FORJA<span className="brand-dot">.</span></strong><small>LEVEL UP YOURSELF</small></span></button>
      <div className="sidebar-label">TU ESPACIO</div>
      <nav className="side-nav" aria-label="Secciones">
        {nav.map(({id,name,Icon})=><button key={id} className={`nav-link ${activeNav===id?'nav-active':''}`} onClick={()=>jump(id)}><Icon size={19}/><span>{name}</span>{id==='registrar'&&<span className="nav-plus">+</span>}</button>)}
      </nav>
      <div className="side-grow"/>
      <div className="sidebar-mini"><div className="mini-overline"><span className="live-dot"/> TU MISIÓN</div><div className="mini-title">Mejorar un 1% cada día.</div><div className="mini-copy">Cinco minutos son suficientes para empezar.</div><div className="mini-bars"><span/><span/><span/><span/><span/><span/><span/></div></div>
      <button className="sidebar-settings" onClick={()=>setSettings(true)}><Shield size={18}/> Tus datos <ChevronRight size={15}/></button>
      <div className="sidebar-foot">FORJA v2.0 <span>·</span> MODO LOCAL</div>
    </aside>

    <main className="main-content">
      <div className="topbar"><div className="breadcrumb">FITNESS / <strong>MI CUARTEL</strong></div><div className="topbar-actions"><span className="date-chip"><CalendarDays size={15}/> {humanDate(today,{year:true})}</span><button className="header-icon" aria-label="Abrir respaldo y ajustes" title="Respaldo y datos" onClick={()=>setSettings(true)}><Download size={19}/></button><div className="user-avatar">F</div></div></div>

      <section className="hero" ref={el=>sections.current.inicio=el}>
        <div className="hero-content"><div className="hero-kicker"><span className="kicker-dash"/> TU PROGRESO, TU JUEGO</div><div className="hero-title">NO ESPERES A<br/><em>ESTAR EN FORMA.</em><br/>CONSTRÚYELA.</div><p>Pequeños circuitos. Grandes cambios. Cada pausa entre reuniones cuenta para tu próximo nivel.</p><div className="hero-actions"><button className="btn btn-primary" onClick={()=>jump('registrar')}><Plus size={19}/> Registrar circuito <ArrowRight size={17}/></button><span className="hero-aside"><span className="hero-aside-line"/> SIN GIMNASIO. SIN EXCUSAS.</span></div></div>
        <div className="hero-art"><div className="orbit orbit-outer"/><div className="orbit orbit-middle"/><div className="orbit orbit-inner"/><div className="hero-level"><span>NIVEL ACTUAL</span><strong>{String(stats.level).padStart(2,'0')}</strong><span>{stats.rank}</span></div><div className="orbit-mark orbit-mark-a"/><div className="orbit-mark orbit-mark-b"/><div className="orbit-mark orbit-mark-c"/></div>
        <div className="hero-bottom"><div><Zap size={15} fill="currentColor"/><span>{formatNumber(stats.levelXP)} <b>/ {formatNumber(stats.nextLevelXP)} XP</b> AL SIGUIENTE NIVEL</span></div><div className="hero-level-line"><span style={{width:`${stats.levelPct}%`}}/></div></div>
      </section>

      <div className="stats-grid"><StatCard Icon={Zap} label="EXPERIENCIA TOTAL" value={formatNumber(stats.xp)} detail={`Nivel ${stats.level} · ${stats.rank.toLowerCase()}`} color="lime"/><StatCard Icon={Flame} label="RACHA ACTUAL" value={`${stats.streak} ${stats.streak===1?'día':'días'}`} detail={stats.misses===1?'Un día perdido · última oportunidad':stats.streak>=5?'¡Bonificación activa!':'El reto: 5 días de actividad'} color="orange"/><StatCard Icon={Dumbbell} label="CIRCUITOS COMPLETOS" value={formatNumber(stats.circuitTotal)} detail={`${stats.totalStrength} de fuerza · ${stats.activeDays} días activos`} color="purple"/><StatCard Icon={Trophy} label="INSIGNIAS" value={`${stats.awarded.filter(a=>a.done).length} / ${stats.awarded.length}`} detail="Desbloquea retos especiales" color="sky"/></div>

      <div className="dashboard-grid" ref={el=>sections.current.registrar=el}>
        <section className="card logger-card"><div className="card-header"><div><div className="eyebrow">01 / ENTRÉNATE</div><h2>Registrar actividad</h2><p>Terminas una serie, la registras. Así de sencillo.</p></div><div className="card-corner-icon"><ClipboardList size={21}/></div></div>
          <form onSubmit={addEntry}>
            <div className="field-label">ELIGE TU ACTIVIDAD</div>
            <div className="type-grid">{Object.entries(TYPES).map(([key,t])=>{const Icon=typeIcons[key];return <button key={key} type="button" className={`type-button ${workout===key?'type-selected':''} type-${t.accent}`} onClick={()=>{setWorkout(key);setError('');}}><span className="type-symbol"><Icon size={19}/></span><strong>{t.label}</strong><small>{t.short}</small></button>;})}</div>
            <div className="workout-info"><Info size={15}/><span>{TYPES[workout].description}</span><strong>{TYPES[workout].kind==='circuit'?`+${TYPES[workout].xp} XP/circuito`:TYPES[workout].kind==='time'?'XP según minutos':'15 XP/día máximo'}</strong></div>

            <div className="form-two-cols"><div className="field"><label htmlFor="date-text">FECHA</label><div className="date-input-group"><input id="date-text" value={dateText} onChange={e=>setDateText(e.target.value)} placeholder="October 11" autoComplete="off"/><input type="date" aria-label="Elegir fecha" title="Elegir fecha" value={parseHumanDate(dateText)||today} max={today} onChange={e=>setDateText(e.target.value)} className="date-native"/></div><div className="date-shortcuts"><button type="button" onClick={()=>setDateText('hoy')}>Hoy</button><button type="button" onClick={()=>setDateText('ayer')}>Ayer</button><span>Admite «October 11»</span></div></div>
              <div className="field"><label>{isCircuitType(workout)?'NÚMERO DE CIRCUITOS':TYPES[workout].kind==='time'?'TIEMPO DE ACTIVIDAD':'RECUPERACIÓN'}</label>{isCircuitType(workout)?<NumberControl label="circuitos" value={count} onChange={setCount} min={1} max={20}/>:TYPES[workout].kind==='time'?<div className="duration-input"><input type="number" min="5" max={workout==='RUN'?180:240} step="1" value={minutes} aria-label="Duración en minutos" onChange={e=>setMinutes(e.target.value)}/><span>minutos</span></div>:<div className="recovery-counter">1 sesión de recuperación</div>}<span className="field-hint">{isCircuitType(workout)?'Cada circuito debe estar completo.':TYPES[workout].kind==='time'?'Introduce tu tiempo real.':'Una sesión suave basta para mantener la racha.'}</span></div>
            </div>
            {TYPES[workout].kind==='time'&&<div className="distance-entry"><label>{workout==='RUN'?'DISTANCIA CORRIDA (OPCIONAL)':'DISTANCIA CAMINADA (OPCIONAL)'}</label><div className="duration-input"><input type="number" min="0" max="100" step="0.01" inputMode="decimal" value={distance} placeholder="5.0" aria-label="Distancia en kilómetros" onChange={e=>setDistance(e.target.value)}/><span>km</span></div><small>Se guarda el ritmo para ver si mejoras tu velocidad. Si no sabes los kilómetros, déjalo vacío.</small>{workout==='RUN'&&Number(distance)>0&&Number(minutes)>0&&<strong>Ritmo registrado: {paceText(Number(minutes)/Number(distance))}</strong>}</div>}
            {TYPES[workout].tracks.length>0?<div className="exercise-inputs"><div className="exercise-head"><span>REPETICIONES POR CIRCUITO</span><span>Tu evolución se mide aquí</span></div>{TYPES[workout].tracks.map(key=>{const tr=TRACKS[key],maxStage=stats.tracks[key].level;return <div className="exercise-row" key={key}><div className="exercise-meta"><strong>{tr.label}</strong><div className="select-shell"><select aria-label={`Variante de ${tr.label}`} value={Math.min(formStages[key],maxStage)} onChange={e=>{const n=Number(e.target.value);setFormStages(s=>({...s,[key]:n}));setFormReps(s=>({...s,[key]:tr.stages[n].suggestion}));}}>{tr.stages.map((stage,i)=><option value={i} key={stage.name} disabled={i>maxStage}>{stage.name}{i>maxStage?' 🔒':''}</option>)}</select><ChevronDown size={14}/></div></div><div className="rep-input"><input type="number" min="1" max="500" aria-label={`Repeticiones de ${tr.label}`} value={formReps[key]} onChange={e=>setFormReps(s=>({...s,[key]:e.target.value===''?'':Math.floor(Number(e.target.value))}))}/><span>reps</span></div></div>;})}{workout==='A'&&<div className="exercise-row minor-row"><div className="exercise-meta"><strong>Plancha</strong><small>Segundos por circuito</small></div><div className="rep-input"><input type="number" min="0" max="900" value={plank} onChange={e=>setPlank(Math.min(900,Math.max(0,Number(e.target.value)||0)))} aria-label="Segundos de plancha"/><span>seg</span></div></div>}</div>:<div className="recovery-note"><HeartPulse size={20}/><span>{workout==='R'?'Ideal para recuperar: mantiene la racha, máximo 15 XP diarios y mejora movilidad.':workout==='AGI'?'Un circuito son cinco minutos de pasos laterales, coordinación y cambios de dirección. No necesitas hacer burpees aquí.':workout==='RUN'?'Carrera: entrena resistencia y velocidad. La gráfica compara los ritmos registrados, no solo la XP.':'Camina a paso vivo. Este ejercicio trabaja principalmente resistencia, con XP limitada por día.'}</span></div>}
            {error&&<div className="error-text" role="alert">{error}</div>}
            <div className="submit-wrap"><button type="submit" className="btn btn-primary submit-button"><Plus size={20}/> GUARDAR ENTRENAMIENTO <ArrowUpRight size={18}/></button><span>+{previewXP} XP base estimada · racha y logros aparte</span><div className="skill-preview"><b>ATRIBUTOS QUE ENTRENARÁS</b><div>{Object.entries(previewSkills).filter(([,xp])=>xp>0).map(([key,xp])=><span key={key} style={{borderColor:SKILLS[key].color+'55',color:SKILLS[key].color}}>+{xp} {SKILLS[key].label}</span>)}</div></div></div>
          </form>
        </section>

        <div className="right-stack">
          <section className="card streak-card"><div className="small-card-heading"><div><div className="eyebrow">02 / CONSISTENCIA</div><h3>Racha de fuego <Flame size={21} className="orange-text" fill="currentColor"/></h3></div><span className="tag tag-orange">MÁX. {stats.maxStreak} D</span></div><div className="streak-huge"><strong>{stats.streak}</strong><span>DÍAS DE<br/>RACHA</span></div><div className="streak-week">{lastSeven.map((d,i)=><div className="streak-day" key={d}><span>{weekDays[new Date(`${d}T12:00:00Z`).getUTCDay()]}</span><div className={`streak-dot ${daySet.has(d)?'is-done':''} ${d===today?'is-today':''}`}>{daySet.has(d)?<Check size={14} strokeWidth={3}/>:new Date(`${d}T12:00:00Z`).getUTCDate()}</div></div>)}</div><div className="streak-rule"><div><span className="dot lime-dot"/><strong>DÍA 5</strong><span>+80 XP extra</span></div><div><span className="dot orange-dot"/><strong>DÍA 6</strong><span>+100 XP extra</span></div><div><span className="dot purple-dot"/><strong>DÍA 7+</strong><span>Más XP cada día</span></div></div><div className="streak-warning"><Shield size={17}/><span>1 día sin actividad: racha −1. <b>2 días seguidos: vuelve a 0.</b> El XP ganado no desaparece.</span></div></section>
          <section className="card mission-card"><div className="small-card-heading"><div><div className="eyebrow">03 / PRÓXIMO OBJETIVO</div><h3>Tu próxima evolución</h3></div><Target size={22} className="lime-text"/></div>{highlightTrack?<><div className="mission-detail"><div className="mission-symbol">{TRACKS[highlightTrack[0]].symbol}</div><div><span className="tiny-label">{TRACKS[highlightTrack[0]].label.toUpperCase()}</span><h4>{TRACKS[highlightTrack[0]].stages[highlightTrack[1].level+1]?.full}</h4><p>Completa {highlightTrack[1].target} circuitos con al menos {highlightTrack[1].qualifyingReps} reps en la variante actual.</p></div></div><div className="mission-barline"><strong>{highlightTrack[1].qualified} / {highlightTrack[1].target}</strong><span>{Math.round(highlightTrack[1].qualified/highlightTrack[1].target*100)}%</span></div><ProgressBar value={highlightTrack[1].qualified/highlightTrack[1].target*100}/><button className="text-link" onClick={()=>jump('evolucion')}>Ver todas las evoluciones <ArrowRight size={15}/></button></>:<div className="complete-msg"><BadgeCheck size={22}/> ¡Todas las variantes desbloqueadas!</div>}</section>
        </div>
      </div>

      <section className="rpg-section" ref={el=>sections.current.perfil=el}>
        <SectionHeading eyebrow="04 / TU PERSONAJE" title="Tu ficha de atributos" subtitle="Cada actividad hace subir habilidades distintas. Las rachas y logros dan XP general, no puntos de habilidad." side={<span className="outline-pill"><Activity size={15}/> BUILD EN PROGRESO</span>}/>
        <div className="profile-top"><div className="card radar-card"><div className="profile-heading"><div><div className="eyebrow">PERSONAJE / ESTADÍSTICAS</div><h3>Tu perfil RPG</h3></div><span className="profile-class">ESPECIALIDAD: {stats.totalSkillXP?SKILLS[stats.focus].label.toUpperCase():'POR DESCUBRIR'}</span></div><div className="radar-wrap"><ResponsiveContainer width="100%" height="100%"><RadarChart data={radarData} outerRadius="67%"><PolarGrid stroke="#435065"/><PolarAngleAxis dataKey="skill" tick={{fill:'#aebac9',fontSize:11,fontWeight:650}}/><PolarRadiusAxis domain={[0,Math.max(5,...radarData.map(d=>Math.ceil(d.level)))]} tick={false} axisLine={false}/><Radar name="Nivel" dataKey="level" stroke="#b9f474" fill="#b9f474" fillOpacity={.28} strokeWidth={2.5}/><Tooltip contentStyle={{background:'#1b2632',border:'1px solid #415065',borderRadius:9,color:'#f0f5f8'}} formatter={v=>[Number(v).toFixed(2),'Nivel y progreso']}/></RadarChart></ResponsiveContainer></div><div className="profile-explanation">Nivel global <strong>{stats.level}</strong> · XP física por habilidades <strong>{formatNumber(stats.totalSkillXP)}</strong>. El radar muestra los niveles de cada atributo, no una medición clínica de tu capacidad.</div></div>
          <div className="skills-grid">{Object.entries(SKILLS).map(([key,skill])=>{const p=stats.skills[key],Icon=skillIcons[key];return <div className="skill-card" key={key} style={{'--skill-color':skill.color}}><div className="skill-card-top"><span className="skill-icon"><Icon size={19}/></span><span className="skill-level">NIV. {String(p.level).padStart(2,'0')}</span></div><strong>{skill.label}</strong><div className="skill-xp">{formatNumber(p.xp)} XP <span>· {p.share}% del XP físico</span></div><div className="skill-meter"><span style={{width:p.pct+'%'}}/></div><div className="skill-next">{formatNumber(p.levelXP)}/{formatNumber(p.nextLevelXP)} XP para el siguiente nivel</div><p>{skill.description}</p></div>;})}</div>
        </div>
        <div className="charts-grid profile-charts"><div className="card chart-card"><div className="chart-header"><div><h3>Historia de tus habilidades</h3><p>XP acumulada a lo largo de las semanas</p></div><div className="select-shell chart-select"><select value={selectedSkill} aria-label="Habilidad en gráfica" onChange={e=>setSelectedSkill(e.target.value)}>{Object.entries(SKILLS).map(([key,v])=><option key={key} value={key}>{v.label}</option>)}</select><ChevronDown size={14}/></div></div>{stats.totalSkillXP?<div className="chart-area"><ResponsiveContainer width="100%" height="100%"><AreaChart data={skillHistory} margin={{top:20,right:16,left:-16,bottom:5}}><CartesianGrid vertical={false} stroke="#303846" strokeDasharray="3 5"/><XAxis dataKey="label" tick={{fill:'#8c96a9',fontSize:11}} tickLine={false} axisLine={false}/><YAxis allowDecimals={false} tick={{fill:'#8c96a9',fontSize:11}} tickLine={false} axisLine={false}/><Tooltip contentStyle={{background:'#202b37',border:'1px solid #364354',color:'#f2f6f5',borderRadius:12}} formatter={v=>[`${v} XP`,SKILLS[selectedSkill].label]}/><Area type="monotone" dataKey={selectedSkill} stroke={SKILLS[selectedSkill].color} strokeWidth={2.5} fill={SKILLS[selectedSkill].color} fillOpacity={.12} dot={{r:3}}/></AreaChart></ResponsiveContainer></div>:<EmptyChart label="Entrena para ver las curvas de evolución de cada habilidad."/>}</div>
          <div className="card chart-card"><div className="chart-header"><div><h3>Tu ritmo al correr</h3><p>Minutos por km · menos es más rápido</p></div><Gauge size={20} color="#ffad66"/></div>{runningHistory.length?<><div className="pace-best">MEJOR RITMO REGISTRADO <b>{paceText(stats.bestPace)}</b></div><div className="chart-area pace-area"><ResponsiveContainer width="100%" height="100%"><LineChart data={runningHistory} margin={{top:12,right:17,left:-9,bottom:5}}><CartesianGrid vertical={false} stroke="#303846" strokeDasharray="3 5"/><XAxis dataKey="short" tick={{fill:'#8c96a9',fontSize:11}} tickLine={false} axisLine={false}/><YAxis reversed domain={['dataMin - 0.5','dataMax + 0.5']} tick={{fill:'#8c96a9',fontSize:11}} tickLine={false} axisLine={false}/><Tooltip contentStyle={{background:'#202b37',border:'1px solid #364354',color:'#f2f6f5',borderRadius:12}} formatter={v=>[paceText(v),'Ritmo']}/><Line type="monotone" dataKey="pace" stroke="#ffad66" strokeWidth={3} dot={{fill:'#ffad66',r:4}}/></LineChart></ResponsiveContainer></div><div className="chart-help">Compara recorridos de distancia y terreno similares para valorar mejoras reales.</div></>:<EmptyChart Icon={Wind} label="Registra una carrera de al menos 1 km con tiempo y distancia para ver tu velocidad real."/>}</div></div>
        <p className="skill-disclaimer"><Info size={15}/> Los niveles reflejan la constancia y el volumen registrado; mejorar un atributo RPG no garantiza una mejora equivalente de rendimiento. Para ver avances reales, compara repeticiones por variante y ritmos en rutas similares.</p>
      </section>

      <section className="evolution-section" ref={el=>sections.current.evolucion=el}>
        <SectionHeading eyebrow="05 / SISTEMA DE EVOLUCIÓN" title="Desbloquea tu siguiente versión" subtitle="Subes de nivel por circuitos completados con técnica y repeticiones suficientes, no solo acumulando XP." side={<span className="outline-pill"><Sparkles size={14}/> PROGRESO REAL</span>}/>
        <div className="evolution-grid">{Object.entries(TRACKS).map(([key,track])=>{const p=stats.tracks[key],next=track.stages[p.level+1];const pct=p.target?Math.min(100,p.qualified/p.target*100):100;return <div className="evolution-card" key={key}><div className="evo-header"><div className="evo-icon">{key==='push'?<Dumbbell size={22}/>:key==='squat'?<Footprints size={22}/>:key==='triceps'?<Target size={22}/>:<HeartPulse size={22}/>}</div><span className={`evo-tier ${p.level>0?'tier-unlocked':''}`}>TIER {String(p.level+1).padStart(2,'0')} / {String(track.stages.length).padStart(2,'0')}</span></div><h3>{track.label}</h3><div className="evo-current"><span>VARIANTE ACTUAL</span><strong>{p.stage.full}</strong></div><div className="evo-progress-head"><span>{next?`PARA DESBLOQUEAR: ${next.name.toUpperCase()}`:'TODAS LAS EVOLUCIONES CONSEGUIDAS'}</span><b>{p.target?`${p.qualified}/${p.target}`:'MAX'}</b></div><ProgressBar value={pct} color={key==='burpee'?'orange':key==='triceps'?'purple':key==='squat'?'sky':'lime'}/><div className="evo-bottom">{next?<><LockKeyhole size={15}/><span>{p.qualified} de {p.target} circuitos con <b>{p.qualifyingReps}+ reps</b></span></>:<><CheckCircle2 size={16}/><span>Variante máxima desbloqueada</span></>}</div><div className="evo-record"><span>MEJOR SERIE EN ESTE TIER</span><strong>{p.best>0?`${p.best} reps`:'—'}</strong></div></div>;})}</div>
      </section>

      <section className="analytics-section"><SectionHeading eyebrow="06 / LA HISTORIA EN DATOS" title="Tu progreso, en gráficas" subtitle="Las repeticiones se comparan dentro de la misma variante para medir fuerza sin falsear el avance." />
        <div className="charts-grid"><div className="card chart-card"><div className="chart-header"><div><h3>Actividad semanal</h3><p>Últimas 8 semanas</p></div><div className="segmented" role="group" aria-label="Tipo de gráfica"><button className={chartMode==='circuits'?'selected':''} onClick={()=>setChartMode('circuits')}>Circuitos</button><button className={chartMode==='xp'?'selected':''} onClick={()=>setChartMode('xp')}>XP</button></div></div>{chartWeeks.some(w=>w.circuits>0||w.xp>0)?<div className="chart-area" role="img" aria-label="Gráfica semanal de actividad"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartWeeks} margin={{top:16,right:6,left:-25,bottom:5}}><CartesianGrid vertical={false} stroke="#303846" strokeDasharray="3 5"/><XAxis dataKey="label" tick={{fill:'#8c96a9',fontSize:11}} tickLine={false} axisLine={false} interval={0}/><YAxis allowDecimals={false} tick={{fill:'#8c96a9',fontSize:11}} tickLine={false} axisLine={false}/><Tooltip cursor={{fill:'rgba(185,244,116,.05)'}} contentStyle={{background:'#202b37',border:'1px solid #364354',color:'#f2f6f5',borderRadius:12}} formatter={v=>[formatNumber(v),chartMode==='xp'?'XP':'Circuitos']}/><Bar dataKey={chartMode==='xp'?'xp':'circuits'} fill="#b9f474" radius={[6,6,0,0]} maxBarSize={36}/></BarChart></ResponsiveContainer></div>:<EmptyChart label="Registra tus primeros circuitos para ver tus semanas comparadas."/>}</div>
        <div className="card chart-card"><div className="chart-header"><div><h3>Fuerza por ejercicio</h3><p>Récord de reps por día, misma variante</p></div><div className="select-shell chart-select"><select value={strengthTrack} aria-label="Ejercicio de la gráfica" onChange={e=>{const key=e.target.value;setStrengthTrack(key);setStrengthStage(stats.tracks[key].level);}}>{Object.entries(TRACKS).map(([k,t])=><option value={k} key={k}>{t.label}</option>)}</select><ChevronDown size={14}/></div></div><div className="tier-select-row"><span>VARIANTE:</span><div className="select-shell compact-select"><select value={strengthStage} aria-label="Variante de la gráfica" onChange={e=>setStrengthStage(Number(e.target.value))}>{TRACKS[strengthTrack].stages.map((s,i)=><option key={i} value={i}>{s.name}</option>)}</select><ChevronDown size={14}/></div></div>{strengthData.length?<div className="chart-area" role="img" aria-label="Gráfica de evolución de repeticiones"><ResponsiveContainer width="100%" height="100%"><AreaChart data={strengthData} margin={{top:20,right:18,left:-22,bottom:5}}><defs><linearGradient id="colorReps" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ad9cff" stopOpacity={.25}/><stop offset="95%" stopColor="#ad9cff" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#303846" strokeDasharray="3 5"/><XAxis dataKey="short" tick={{fill:'#8c96a9',fontSize:11}} tickLine={false} axisLine={false}/><YAxis allowDecimals={false} domain={[0,'dataMax + 2']} tick={{fill:'#8c96a9',fontSize:11}} tickLine={false} axisLine={false}/><Tooltip contentStyle={{background:'#202b37',border:'1px solid #364354',color:'#f2f6f5',borderRadius:12}} formatter={v=>[`${v} reps`,'Mejor serie']}/><Area type="monotone" dataKey="reps" stroke="#ad9cff" strokeWidth={3} fill="url(#colorReps)" dot={{fill:'#ad9cff',r:4,stroke:'#202734',strokeWidth:2}} activeDot={{r:6}}/></AreaChart></ResponsiveContainer></div>:<EmptyChart Icon={TrendingUp} label="Añade series de este ejercicio y variante para ver tu fuerza crecer."/>}</div></div>
      </section>

      <section className="lower-grid"><div className="card history-card"><div className="card-header compact-head"><div><div className="eyebrow">07 / TU HISTORIAL</div><h2>Últimas sesiones</h2></div><span className="count-badge">{data.entries.length} REGISTROS</span></div>{sortedEntries.length===0?<div className="blank-history"><div className="empty-emblem"><ClipboardList size={30}/></div><strong>Tu primera victoria te espera.</strong><p>Cuando registres un circuito aparecerá aquí, con fecha y repeticiones.</p><button className="btn btn-ghost" onClick={()=>jump('registrar')}>Empezar ahora <ArrowRight size={16}/></button></div>:<div className="history-list">{sortedEntries.slice(0,9).map(entry=><div className="history-item" key={entry.id}><div className={`history-mark mark-${TYPES[entry.type].accent}`}>{React.createElement(typeIcons[entry.type],{size:18})}</div><div className="history-content"><strong>{TYPES[entry.type].label} <span>× {entry.count}</span></strong><span>{humanDate(entry.date,{year:true})} · {TYPES[entry.type].kind==='time'?`${entry.minutes} min${entry.distance?` · ${entry.distance} km`:''}`:TYPES[entry.type].tracks.map(k=>`${entry.reps[k]} ${TRACKS[k].short.toLowerCase()} (${TRACKS[k].stages[entry.stages[k]||0].name})`).join(' · ') || (entry.type==='AGI'?'coordinación y cambios de dirección':'movilidad / descanso activo')}</span></div><div className="history-xp">+{entryBaseXP(entry)} XP*</div><button className="trash-button" onClick={()=>deleteEntry(entry.id)} aria-label={`Eliminar entrenamiento ${humanDate(entry.date)}`} title="Eliminar"><Trash2 size={16}/></button></div>)}<div className="history-note">*XP base indicativa. Los bonos de día, racha e insignias aparecen en el total. Paseos y recuperación tienen límites diarios.</div></div>}</div>
        <div className="card body-card"><div className="card-header compact-head"><div><div className="eyebrow">08 / COMPOSICIÓN CORPORAL</div><h2>La cintura también cuenta</h2></div><Ruler size={22} className="lime-text"/></div><p className="body-intro">La fuerza no siempre se refleja en la báscula. Mide tu cintura una vez a la semana, a la misma altura.</p><div className="body-reading"><div><span>ÚLTIMO PESO</span><strong>{lastWeight?`${lastWeight.toLocaleString('es-ES')} kg`:'—'}</strong></div><div><span>ÚLTIMA CINTURA</span><strong>{lastWaist?`${lastWaist.toLocaleString('es-ES')} cm`:'—'}</strong></div></div>{waistDiff!==null&&<div className={`body-diff ${waistDiff<0?'good':''}`}>{waistDiff<0?'↓':'↑'} {Math.abs(waistDiff).toFixed(1)} cm desde la primera medida</div>}
          <form className="measurement-form" onSubmit={addMeasurement}><label>REGISTRAR MEDIDA</label><input type="date" aria-label="Fecha de medida" value={measurementDate} max={today} onChange={e=>setMeasurementDate(e.target.value)}/><div className="measure-fields"><div className="unit-field"><input type="number" step="0.1" min="25" max="350" placeholder="Peso" aria-label="Peso en kilogramos" value={weight} onChange={e=>setWeight(e.target.value)}/><span>kg</span></div><div className="unit-field"><input type="number" step="0.1" min="40" max="250" placeholder="Cintura" aria-label="Cintura en centímetros" value={waist} onChange={e=>setWaist(e.target.value)}/><span>cm</span></div></div><button type="submit" className="btn btn-secondary"><Plus size={16}/> Guardar medida</button></form>{waistHistory.length>=2&&<div className="waist-mini"><div className="waist-header">CINTURA · HISTÓRICO</div><ResponsiveContainer width="100%" height={120}><LineChart data={waistHistory.map(m=>({label:humanDate(m.date),waist:m.waist}))} margin={{top:12,bottom:0,right:10,left:-25}}><XAxis dataKey="label" tick={{fontSize:10,fill:'#96a0ad'}} axisLine={false} tickLine={false}/><YAxis domain={['dataMin - 1','dataMax + 1']} tick={{fontSize:10,fill:'#96a0ad'}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{background:'#202b37',border:'1px solid #364354',color:'#f2f6f5',borderRadius:10}}/><Line type="monotone" dataKey="waist" stroke="#b9f474" strokeWidth={2.5} dot={{fill:'#b9f474',r:3}}/></LineChart></ResponsiveContainer></div>}</div></section>

      <section className="achievements-section" ref={el=>sections.current.insignias=el}><SectionHeading eyebrow="09 / SALA DE TROFEOS" title="Insignias desbloqueables" subtitle="Retos especiales con puntos extra. Las victorias pequeñas también merecen celebrarse." side={<span className="outline-pill"><Trophy size={14}/> {stats.awarded.filter(a=>a.done).length} DE {stats.awarded.length} LOGRADAS</span>}/><div className="achievements-grid">{stats.awarded.map(a=>{const Icon=iconForAchievement[a.id];return <div className={`achievement ${a.done?'achievement-earned':'achievement-locked'}`} key={a.id}><div className="achievement-icon">{a.done?<Icon size={23}/>:<LockKeyhole size={21}/>}</div><div><strong>{a.name}</strong><p>{a.description}</p><span>{a.done?<><CheckCircle2 size={13}/> DESBLOQUEADA</>:<><Zap size={13}/> +{a.xp} XP</>}</span></div></div>;})}</div></section>
      <footer className="footer"><div><Zap size={16} fill="currentColor"/> <b>FORJA</b> <span>· La disciplina se construye circuito a circuito.</span></div><button onClick={()=>setSettings(true)}>Tus datos están en este navegador <Shield size={15}/></button></footer>
    </main>

    <nav className="mobile-nav" aria-label="Navegación móvil">{nav.map(({id,name,Icon})=><button key={id} className={activeNav===id?'mobile-selected':''} onClick={()=>jump(id)}><Icon size={20}/><span>{name}</span></button>)}</nav>
    {notification&&<div className={`toast ${notification.special?'toast-special':''}`} role="status"><div className="toast-icon">{notification.special?<Trophy size={22}/>:<CheckCircle2 size={22}/>}</div><div><strong>{notification.title}</strong><span>{notification.body}</span></div><button aria-label="Cerrar aviso" onClick={()=>setNotification(null)}><X size={17}/></button></div>}
    {settings&&<div className="modal-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setSettings(false);}}><section className="modal" role="dialog" aria-modal="true" aria-label="Tus datos y ajustes"><div className="modal-head"><div className="eyebrow">TU PARTIDA, TUS DATOS</div><button onClick={()=>setSettings(false)} aria-label="Cerrar"><X size={21}/></button></div><h2>Respaldo y privacidad</h2><p>FORJA guarda tus registros en el <b>almacenamiento local del navegador</b>. No necesita cuenta ni envía tus sesiones a servidores. Si borras los datos del navegador o cambias de dispositivo, los perderás salvo que hayas exportado un respaldo.</p><div className="modal-summary"><div><span>ENTRENAMIENTOS</span><strong>{data.entries.length}</strong></div><div><span>MEDICIONES</span><strong>{data.measurements.length}</strong></div><div><span>XP</span><strong>{formatNumber(stats.xp)}</strong></div></div><button className="btn btn-primary modal-button" onClick={exportData}><Download size={18}/> Exportar mi partida (.json)</button><button className="btn btn-secondary modal-button" onClick={()=>fileRef.current?.click()}><Upload size={18}/> Importar respaldo</button><input type="file" accept=".json,application/json" className="hidden-input" ref={fileRef} onChange={importData}/><div className="modal-help"><Info size={18}/><span>Importar reemplaza los registros de este navegador, no los fusiona.</span></div><button className="reset-button" onClick={resetData}><RotateCcw size={15}/> Borrar todo y empezar de cero</button></section></div>}
  </div>;
}

export default App;
