const pool=require('./db');
const DAY=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function urgencyRaw(task,now=new Date()) {
  const days=Math.max(0,(new Date(task.deadline)-now)/86400000);
  return 1/(1+days);
}
function priorityScore(task,weights,now=new Date(),urgencyRange=null) {
  const raw=urgencyRaw(task,now);
  const urgency=urgencyRange&&urgencyRange.max>urgencyRange.min?(raw-urgencyRange.min)/(urgencyRange.max-urgencyRange.min):raw;
  const workload=Math.min(1,Number(task.estimatedWorkloadHours)/20);
  const preference=(Number(task.preferenceWeight)-1)/4;
  return Number(weights.urgencyWeight)*urgency+Number(weights.workloadWeight)*workload+Number(weights.preferenceWeight)*preference;
}
function rankTasks(tasks,weights,now=new Date()) {
  const range=tasks.reduce((r,t)=>{const raw=urgencyRaw(t,now);return {min:Math.min(r.min,raw),max:Math.max(r.max,raw)};},{min:Infinity,max:-Infinity});
  return tasks.map(t=>({...t,priorityScore:priorityScore(t,weights,now,range)})).sort((a,b)=>b.priorityScore-a.priorityScore);
}
function nextSlots(availability, days=28, now=new Date()) {
  const slots=[]; const start=new Date(now); start.setSeconds(0,0); start.setMinutes(0);
  for(let offset=0;offset<days;offset++) {
    const date=new Date(start); date.setDate(start.getDate()+offset);
    for(const a of availability.filter(x=>x.dayOfWeek===DAY[date.getDay()])) {
      const [sh,sm]=String(a.startTime).slice(0,5).split(':').map(Number),[eh,em]=String(a.endTime).slice(0,5).split(':').map(Number);
      const from=new Date(date); from.setHours(sh,sm,0,0); const to=new Date(date); to.setHours(eh,em,0,0);
      let cursor=new Date(Math.max(from, start)); cursor.setMinutes(Math.ceil(cursor.getMinutes()/30)*30,0,0);
      while(cursor.getTime()+1800000<=to.getTime()) { const end=new Date(cursor.getTime()+1800000); if(cursor>now) slots.push({start:new Date(cursor),end}); cursor=end; }
    }
  }
  return slots;
}
async function generate(userId) {
  const conn=await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[weights]]=await conn.query('SELECT * FROM scheduling_weights WHERE userId=?',[userId]);
    const [tasks]=await conn.query("SELECT * FROM tasks WHERE userId=? AND status<>'Completed' ORDER BY deadline",[userId]);
    const [availability]=await conn.query('SELECT * FROM availability WHERE userId=? ORDER BY dayOfWeek,startTime',[userId]);
    const [completedSessions]=await conn.query('SELECT ss.scheduledStart,ss.scheduledEnd FROM study_sessions ss JOIN tasks t ON t.taskId=ss.taskId WHERE t.userId=? AND ss.completed=1',[userId]);
    await conn.query('DELETE ss FROM study_sessions ss JOIN tasks t ON ss.taskId=t.taskId WHERE t.userId=? AND ss.completed=0',[userId]);
    if(!tasks.length) {await conn.commit();return {scheduled:0,unscheduled:0,tasks:[]};}
    const occupied=completedSessions.map(s=>[new Date(s.scheduledStart).getTime(),new Date(s.scheduledEnd).getTime()]);
    const slots=nextSlots(availability).filter(slot=>!occupied.some(([start,end])=>slot.start.getTime()<end&&slot.end.getTime()>start)); let slotIndex=0; const results=[];
    const defaults={urgencyWeight:.55,workloadWeight:.25,preferenceWeight:.20};
    const sorted=rankTasks(tasks,weights||defaults);
    for(const task of sorted) {
      let remaining=Number(task.estimatedWorkloadHours),allocated=0;
      while(remaining>0.001 && slotIndex<slots.length) {
        const slot=slots[slotIndex]; if(slot.start>=new Date(task.deadline)) break; slotIndex++;
        await conn.query('INSERT INTO study_sessions(taskId,scheduledStart,scheduledEnd) VALUES(?,?,?)',[task.taskId,slot.start,slot.end]);
        remaining-=.5; allocated+=.5;
      }
      const status=remaining<=.001?'Scheduled':'Unscheduled';
      await conn.query('UPDATE tasks SET status=? WHERE taskId=?',[status,task.taskId]);
      results.push({taskId:task.taskId,title:task.title,priorityScore:task.priorityScore,allocatedHours:allocated,remainingHours:Math.max(0,remaining),status});
    }
    await conn.commit(); return {scheduled:results.filter(t=>t.status==='Scheduled').length,unscheduled:results.filter(t=>t.status==='Unscheduled').length,tasks:results};
  } catch(e){await conn.rollback();throw e;} finally{conn.release();}
}
module.exports={priorityScore,urgencyRaw,rankTasks,nextSlots,generate};
