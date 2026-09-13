/* scheduler.js
   Gjeneron orarin javor për të gjitha klasat duke shmangur:
   - dy orë njëkohësisht për të njëjtin mësues
   - dy lëndë njëkohësisht për të njëjtën klasë
   dhe duke u munduar t'i shpërndajë orët e së njëjtës lëndë në ditë të ndryshme.
*/

function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

function buildClassList(){
  const grades = [6,7,8,9];
  const sections = ['A','B','C'];
  const list = [];
  grades.forEach(g=> sections.forEach(s=> list.push({id:`${g}${s}`, grade:g, section:s})));
  return list;
}

/*
  data: full DB object (settings, subjects, teachers, curriculum, assignments)
  returns { schedule, unplaced, teacherHours, warnings }
*/
function generateTimetable(data){
  const days = data.settings.days;
  const periods = data.settings.periodsPerDay;
  const classes = buildClassList();

  // Build task list: {classId, subjectId, teacherId, hours}
  let tasks = [];
  classes.forEach(cls=>{
    const curr = data.curriculum[cls.grade] || {};
    Object.keys(curr).forEach(subjId=>{
      const hours = curr[subjId];
      if(!hours) return;
      const teacherId = (data.assignments[cls.id] || {})[subjId] || null;
      tasks.push({classId:cls.id, subjectId:subjId, teacherId, hours});
    });
  });

  const warnings = [];
  const unassignedTasks = tasks.filter(t=>!t.teacherId);
  tasks = tasks.filter(t=>t.teacherId);
  unassignedTasks.forEach(t=>{
    warnings.push(`Klasa ${t.classId}: lënda "${subjectName(data,t.subjectId)}" nuk ka mësues të caktuar (${t.hours} orë/javë të papërcaktuara).`);
  });

  const ATTEMPTS = 60;
  let best = null;

  for(let attempt=0; attempt<ATTEMPTS; attempt++){
    const classGrid = {};   // classId -> [day][period] = {subjectId,teacherId} | null
    const teacherGrid = {}; // teacherId -> [day][period] = classId | null

    classes.forEach(c=>{
      classGrid[c.id] = Array.from({length:days.length},()=>Array(periods).fill(null));
    });
    data.teachers.forEach(t=>{
      teacherGrid[t.id] = Array.from({length:days.length},()=>Array(periods).fill(null));
    });

    let unplacedCount = 0;
    const orderedTasks = shuffle(tasks).sort((a,b)=> b.hours - a.hours);

    orderedTasks.forEach(task=>{
      const dayOrder = shuffle(days.map((_,i)=>i));
      // track which days already used for this subject in this class
      const usedDays = new Set();
      let toPlace = task.hours;

      // First pass: one occurrence per day (spread out)
      for(const d of dayOrder){
        if(toPlace<=0) break;
        const slot = findFreeSlot(classGrid[task.classId][d], teacherGrid[task.teacherId][d]);
        if(slot!==-1){
          classGrid[task.classId][d][slot] = {subjectId:task.subjectId, teacherId:task.teacherId};
          teacherGrid[task.teacherId][d][slot] = task.classId;
          usedDays.add(d);
          toPlace--;
        }
      }
      // Second pass: if more hours remain than days available, allow repeats on other periods same day
      let safety = 0;
      while(toPlace>0 && safety < days.length*periods){
        safety++;
        const d = dayOrder[safety % dayOrder.length];
        const slot = findFreeSlot(classGrid[task.classId][d], teacherGrid[task.teacherId][d]);
        if(slot!==-1){
          classGrid[task.classId][d][slot] = {subjectId:task.subjectId, teacherId:task.teacherId};
          teacherGrid[task.teacherId][d][slot] = task.classId;
          toPlace--;
        }
      }
      unplacedCount += toPlace;
    });

    if(best===null || unplacedCount < best.unplacedCount){
      best = {classGrid, teacherGrid, unplacedCount};
      if(unplacedCount===0) break;
    }
  }

  // teacher weekly hour totals
  const teacherHours = {};
  data.teachers.forEach(t=>{
    let total = 0;
    best.teacherGrid[t.id].forEach(dayArr=> dayArr.forEach(cell=>{ if(cell) total++; }));
    teacherHours[t.id] = total;
  });

  data.teachers.forEach(t=>{
    const used = teacherHours[t.id] || 0;
    if(t.maxHours && used > t.maxHours){
      warnings.push(`Mësues/e ${t.name}: ${used} orë të planifikuara, mbi normën prej ${t.maxHours} orësh.`);
    }
  });

  if(best.unplacedCount>0){
    warnings.push(`${best.unplacedCount} orë nuk u vendosën dot në orar (konflikte mësuesish ose mungesë vendesh të lira). Provo të rigjenerosh ose kontrollo kurrikulën/caktimet.`);
  }

  return {
    schedule: best.classGrid,
    teacherSchedule: best.teacherGrid,
    unplaced: best.unplacedCount,
    teacherHours,
    warnings
  };
}

function findFreeSlot(classDayArr, teacherDayArr){
  for(let p=0;p<classDayArr.length;p++){
    if(classDayArr[p]===null && teacherDayArr[p]===null) return p;
  }
  return -1;
}

function subjectName(data, id){
  const s = data.subjects.find(s=>s.id===id);
  return s ? s.name : '—';
}
