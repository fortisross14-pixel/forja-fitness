import {dayNumber,isoFromDayNumber} from './game.js';
import {earnedBadge,roundIndex} from './coach.js';

export const isoMonth=(date)=>date.slice(0,7);
export function addMonth(month,n){const [y,m]=month.split('-').map(Number);const d=new Date(Date.UTC(y,m-1+n,1));return d.toISOString().slice(0,7);}
export function monthTitle(month){return new Intl.DateTimeFormat('es-ES',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${month}-01T12:00:00Z`));}
export function isRecorded(q){return Boolean(q&&(q.finishedAt||roundIndex(q)>0));}
export function activityStatus(q,legacy=false){if(q&&earnedBadge(q))return 'badge';if(q?.finishedAt)return 'done';if(isRecorded(q)||legacy)return 'started';return 'empty';}
export function monthCells(month){
 const start=new Date(`${month}-01T12:00:00Z`);
 const offset=(start.getUTCDay()+6)%7;
 const days=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0)).getUTCDate();
 const cells=[...Array(offset).fill(null),...Array.from({length:days},(_,i)=>`${month}-${String(i+1).padStart(2,'0')}`)];
 while(cells.length%7)cells.push(null);
 return cells;
}
export function weekOverview(save,today){
 const end=dayNumber(today),legacy=save.legacyEntries||[];
 return Array.from({length:10},(_,i)=>{
  const first=end-(9-i)*7-6,last=end-(9-i)*7;
  const records=Object.values(save.quests||{}).filter(q=>dayNumber(q.date)>=first&&dayNumber(q.date)<=last&&q.date<=today);
  const days=new Set(records.filter(isRecorded).map(q=>q.date));
  for(const item of legacy)if(item.date<=today&&dayNumber(item.date)>=first&&dayNumber(item.date)<=last)days.add(item.date);
  const label=new Date(`${isoFromDayNumber(last)}T12:00:00Z`).toLocaleDateString('es-ES',{day:'numeric',month:'short',timeZone:'UTC'});
  return {week:label,active:days.size,badges:records.filter(earnedBadge).length};
 });
}
