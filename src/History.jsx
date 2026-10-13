import React,{useMemo,useState} from 'react';
import {BarChart,Bar,CartesianGrid,ResponsiveContainer,XAxis,YAxis,Tooltip} from 'recharts';
import {CalendarDays,ChevronLeft,ChevronRight,CheckCircle2,Clock3,Flame,Footprints,Target,Trophy} from 'lucide-react';
import {dayNumber,humanDate} from './game.js';
import {earnedBadge,MODE} from './coach.js';
import {isoMonth,addMonth,monthTitle,isRecorded,activityStatus,monthCells,weekOverview} from './history-model.js';
import './history.css';

export function HistoryView({save,today,streak,onWorkout}){
 const [month,setMonth]=useState(isoMonth(today));
 const [chosen,setChosen]=useState(today);
 const pastQuests=useMemo(()=>Object.values(save.quests||{}).filter(isRecorded).filter(q=>q.date<=today).sort((a,b)=>b.date.localeCompare(a.date)),[save,today]);
 const legacy=useMemo(()=>save.legacyEntries||[],[save]);
 const byDate=save.quests||{};
 const legacySet=new Set(legacy.map(e=>e.date));
 const chosenQuest=byDate[chosen];
 const chosenLegacy=legacy.filter(e=>e.date===chosen);
 const weeks=useMemo(()=>weekOverview(save,today),[save,today]);
 const cells=monthCells(month);
 const activeDates=new Set([...pastQuests.map(q=>q.date),...legacySet]);
 const days30=[...activeDates].filter(d=>d<=today&&dayNumber(today)-dayNumber(d)<30).length;
 const badges30=pastQuests.filter(q=>dayNumber(today)-dayNumber(q.date)<30&&earnedBadge(q)).length;
 const list=[...new Set([...pastQuests.map(q=>q.date),...legacySet])].filter(d=>d<=today).sort((a,b)=>b.localeCompare(a)).slice(0,14);
 function pick(date){setChosen(date);setMonth(isoMonth(date));}
 function navigateMonth(shift){const next=addMonth(month,shift);if(next>isoMonth(today))return;setMonth(next);if(isoMonth(chosen)!==next){const candidate=next===isoMonth(today)?today:`${next}-01`;setChosen(candidate);}}
 return <div className="history-page">
  <header className="view-heading"><div className="eyebrow"><CalendarDays size={15}/> YOUR TRAINING STORY</div><h1>Calendar <span>/ History</span></h1><p>Un calendario de lo que hiciste realmente. Cada badge tiene detrás una sesión, no un simple check.</p></header>
  <div className="history-metrics"><div><small>DÍAS ACTIVOS · 30 DÍAS</small><strong>{days30}</strong><span>Constancia real</span></div><div><small>BADGES · 30 DÍAS</small><strong>{badges30}</strong><span>Objetivos conquistados</span></div><div><small>RACHA ACTUAL</small><strong>{streak.streak}<small> días</small></strong><span>{streak.grace===1?'Día de gracia usado':`Récord · ${streak.best} días`}</span></div></div>
  <div className="history-layout">
   <section className="panel calendar-panel"><div className="calendar-head"><div><span className="eyebrow">ACTIVITY CALENDAR</span><h2>{monthTitle(month)}</h2></div><div className="calendar-controls"><button type="button" aria-label="Mes anterior" onClick={()=>navigateMonth(-1)}><ChevronLeft size={19}/></button><button type="button" aria-label="Mes siguiente" disabled={month>=isoMonth(today)} onClick={()=>navigateMonth(1)}><ChevronRight size={19}/></button></div></div>
   <div className="calendar-grid weekdays">{['L','M','X','J','V','S','D'].map((d,i)=><div key={i}>{d}</div>)}</div>
   <div className="calendar-grid calendar-days">{cells.map((date,i)=>date?<button type="button" key={date} disabled={date>today} onClick={()=>pick(date)} className={`calendar-day ${activityStatus(byDate[date],legacySet.has(date))} ${chosen===date?'chosen':''} ${date===today?'today':''}`} aria-label={`${date}: ${activityStatus(byDate[date],legacySet.has(date))}`} aria-pressed={chosen===date}><span>{Number(date.slice(-2))}</span>{earnedBadge(byDate[date]||{})?<Trophy size={12}/>:activityStatus(byDate[date],legacySet.has(date))==='done'?<CheckCircle2 size={12}/>:activityStatus(byDate[date],legacySet.has(date))==='started'?<span className="day-dot"/>:null}</button>:<div className="calendar-empty" key={`e-${i}`}/> )}</div>
   <div className="calendar-legend"><span><i className="legend-badge"/> Badge</span><span><i className="legend-done"/> Finalizada</span><span><i className="legend-started"/> Parcial / anterior</span></div></section>
   <section className="panel day-review"><div className="eyebrow">DAY DETAILS</div><h2>{humanDate(chosen)}</h2>{isRecorded(chosenQuest)?<><div className="day-mode"><div className={`history-status ${earnedBadge(chosenQuest)?'is-badge':''}`}>{earnedBadge(chosenQuest)?<Trophy size={25}/>:chosenQuest.finishedAt?<CheckCircle2 size={25}/>:<Clock3 size={25}/>}</div><div><strong>{MODE[chosenQuest.mode]?.name||chosenQuest.mode}</strong><span>{earnedBadge(chosenQuest)?'Badge conseguido':chosenQuest.finishedAt?'Sesión finalizada':'Entrenamiento en curso'}</span></div></div>
    {chosenQuest.mode==='RUN'?<div className="day-run"><Footprints size={18}/>{chosenQuest.runDistance||0} km · {chosenQuest.runMinutes||0} min</div>:<div className="day-exercises">{chosenQuest.tasks?.map(t=><div key={t.id}><span>{t.name}</span><strong>{t.rounds.length? t.rounds.map(r=>r.actual).join(' / '):'—'} <small>/ {t.target} objetivo</small></strong></div>)}</div>}
    {chosen===today&&!chosenQuest.finishedAt&&<button className="button primary block" onClick={onWorkout}><Target size={16}/> CONTINUAR MISIÓN</button>}
   </>:chosenLegacy.length?<div className="past-legacy"><CheckCircle2 size={24}/><strong>{chosenLegacy.length} registro(s) de la versión anterior</strong><p>Conservados en tu historial. No los convertimos en badges ficticios.</p></div>:<div className="past-empty"><CalendarDays size={29}/><strong>Sin entrenamiento registrado</strong><p>Este día no tiene una sesión guardada. Los descansos también forman parte del progreso.</p>{chosen===today&&<button className="button primary" onClick={onWorkout}>VER MISIÓN DE HOY</button>}</div>}</section>
  </div>
  <div className="history-bottom"><section className="panel consistency-panel"><div className="eyebrow"><Flame size={15}/> CONSISTENCY</div><h2>Las últimas 10 semanas</h2><p>Días con actividad registrada y misiones con badge.</p><div className="consistency-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={weeks} margin={{left:-28,right:0,top:15,bottom:0}}><CartesianGrid stroke="#273944" vertical={false}/><XAxis dataKey="week" tick={{fontSize:10,fill:'#91a5b3'}} axisLine={false} tickLine={false}/><YAxis domain={[0,7]} allowDecimals={false} tick={{fontSize:10,fill:'#91a5b3'}} axisLine={false} tickLine={false}/><Tooltip cursor={{fill:'#ffffff09'}} contentStyle={{background:'#1d2e39',border:'1px solid #455762',borderRadius:11,color:'#eaf6f4'}}/><Bar name="Días activos" dataKey="active" fill="#718a97" radius={[5,5,0,0]} barSize={17}/><Bar name="Badges" dataKey="badges" fill="#bbfa7a" radius={[5,5,0,0]} barSize={17}/></BarChart></ResponsiveContainer></div><div className="consistency-note">La XP recompensa la constancia; las habilidades se basan en capacidad corroborada.</div></section>
  <section className="panel recent-panel"><div className="eyebrow">RECENT SESSIONS</div><h2>Últimos entrenamientos</h2><div className="recent-scroll">{list.length?list.map(date=>{const q=byDate[date];const badge=earnedBadge(q||{});return <button type="button" className={`recent-workout ${chosen===date?'selected':''}`} key={date} onClick={()=>pick(date)}><span className={`recent-icon ${badge?'badge-icon':''}`}>{badge?<Trophy size={17}/>:<Target size={17}/>}</span><span className="recent-name"><strong>{q?MODE[q.mode]?.name||q.mode:'Sesión anterior'}</strong><small>{humanDate(date)}</small></span><span className="recent-right">{badge?'BADGE':q?.finishedAt?'HECHA':'PARCIAL'}<ChevronRight size={15}/></span></button>}):<p className="empty-recent">Cuando completes tu primera pausa aparecerá aquí.</p>}</div></section></div>
 </div>;
}
