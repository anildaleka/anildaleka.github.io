/* scheduler.js
   Gjeneron orarin javor për të gjitha klasat duke shmangur:
   - dy orë njëkohësisht për të njëjtin mësues
   - dy lëndë njëkohësisht për të njëjtën klasë
   dhe duke u munduar t'i shpërndajë orët e së njëjtës lëndë në ditë të ndryshme.

   - Mbështet MË SHUMË SE NJË MËSUES për të njëjtën lëndë+klasë (p.sh. Fiskulturë:
     një mësues për vajza, një për djem — të dy zënë njëkohësisht të njëjtën periudhë).
   - Mbështet orë/javë me presje (p.sh. 1.5): ruhen saktë në kurrikulë, por në orarin
     me periudha të plota përdoret numri i rrumbullakosur (me një vërejtje përkatëse).
   - Mbështet KYÇJE MANUALE (data.manualLocks): kuti të caktuara me dorë që NUK
     ndryshohen nga algoritmi — pjesa tjetër plotësohet automatikisht rreth tyre.
     Struktura: data.manualLocks[classId]["<dita>_<ora>"] = {subjectId, teacherIds:[...]}
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
  data: full DB object (settings, subjects, teachers, curriculum, assignments, manualLocks)
  returns { schedule, teacherSchedule, unplaced, teacherHours, warnings }
*/
function generateTimetable(data){
  const days = data.settings.days;
  const periods = data.settings.periodsPerDay;
  const classes = buildClassList();
  const locks = data.manualLocks || {};

  function lockedCountFor(classId, subjectId){
    const clsLocks = locks[classId] || {};
    return Object.values(clsLocks).filter(l=>l.subjectId===subjectId).length;
  }

  // Build task list: {classId, subjectId, teacherIds:[...], hours} — hours minus locked occurrences
  let tasks = [];
  const warnings = [];
  classes.forEach(cls=>{
    const curr = data.curriculum[cls.grade] || {};
    Object.keys(curr).forEach(subjId=>{
      const rawHours = curr[subjId];
      if(!rawHours) return;
      const roundedHours = Math.round(rawHours);
      if(Math.abs(rawHours - roundedHours) > 0.001){
        warnings.push(`Klasa ${cls.id}: lënda "${subjectName(data,subjId)}" ka ${formatHours(rawHours)} orë/javë (numër jo i plotë) — në orar u vendos si ${roundedHours} periudha. Për të alternuar saktë çdo javë tjetër, përdor Redaktimin Manual.`);
      }
      const teacherIds = ((data.assignments[cls.id] || {})[subjId]) || [];
      const remaining = Math.max(0, roundedHours - lockedCountFor(cls.id, subjId));
      if(remaining>0) tasks.push({classId:cls.id, subjectId:subjId, teacherIds, hours:remaining});
    });
  });

  const unassignedTasks = tasks.filter(t=> !t.teacherIds || t.teacherIds.length===0);
  tasks = tasks.filter(t=> t.teacherIds && t.teacherIds.length>0);
  unassignedTasks.forEach(t=>{
    warnings.push(`Klasa ${t.classId}: lënda "${subjectName(data,t.subjectId)}" nuk ka mësues të caktuar (${t.hours} orë/javë të papërcaktuara).`);
  });

  function applyLocks(classGrid, teacherGrid){
    Object.keys(locks).forEach(classId=>{
      if(!classGrid[classId]) return;
      const clsLocks = locks[classId];
      Object.keys(clsLocks).forEach(key=>{
        const parts = key.split('_');
        const d = parseInt(parts[0],10), p = parseInt(parts[1],10);
        if(isNaN(d) || isNaN(p) || !classGrid[classId][d]) return;
        const lock = clsLocks[key];
        const teacherIds = lock.teacherIds || [];
        classGrid[classId][d][p] = {subjectId:lock.subjectId, teacherIds, locked:true};
        teacherIds.forEach(tid=>{ if(teacherGrid[tid]) teacherGrid[tid][d][p] = classId; });
      });
    });
  }

  const ATTEMPTS = 60;
  let best = null;

  for(let attempt=0; attempt<ATTEMPTS; attempt++){
    const classGrid = {};
    const teacherGrid = {};

    classes.forEach(c=>{
      classGrid[c.id] = Array.from({length:days.length},()=>Array(periods).fill(null));
    });
    data.teachers.forEach(t=>{
      teacherGrid[t.id] = Array.from({length:days.length},()=>Array(periods).fill(null));
    });

    applyLocks(classGrid, teacherGrid);

    let unplacedCount = 0;
    const orderedTasks = shuffle(tasks).sort((a,b)=> b.hours - a.hours);

    orderedTasks.forEach(task=>{
      const dayOrder = shuffle(days.map((_,i)=>i));
      let toPlace = task.hours;

      for(const d of dayOrder){
        if(toPlace<=0) break;
        const slot = findFreeSlot(classGrid[task.classId][d], task.teacherIds.map(id=>teacherGrid[id][d]));
        if(slot!==-1){
          classGrid[task.classId][d][slot] = {subjectId:task.subjectId, teacherIds:task.teacherIds};
          task.teacherIds.forEach(id=> teacherGrid[id][d][slot] = task.classId);
          toPlace--;
        }
      }
      let safety = 0;
      while(toPlace>0 && safety < days.length*periods){
        safety++;
        const d = dayOrder[safety % dayOrder.length];
        const slot = findFreeSlot(classGrid[task.classId][d], task.teacherIds.map(id=>teacherGrid[id][d]));
        if(slot!==-1){
          classGrid[task.classId][d][slot] = {subjectId:task.subjectId, teacherIds:task.teacherIds};
          task.teacherIds.forEach(id=> teacherGrid[id][d][slot] = task.classId);
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
    warnings.push(`${best.unplacedCount} orë nuk u vendosën dot në orar (konflikte mësuesish ose mungesë vendesh të lira). Provo të rigjenerosh, kontrollo kurrikulën/caktimet, ose lehtëso ndonjë kyçje manuale.`);
  }

  return {
    schedule: best.classGrid,
    teacherSchedule: best.teacherGrid,
    unplaced: best.unplacedCount,
    teacherHours,
    warnings
  };
}

// classDayArr: periods array for the class on that day
// teacherDayArrs: array of periods-arrays, one per required teacher, for that same day
function findFreeSlot(classDayArr, teacherDayArrs){
  for(let p=0;p<classDayArr.length;p++){
    if(classDayArr[p]!==null) continue;
    let free = true;
    for(const arr of teacherDayArrs){ if(arr[p]!==null){ free=false; break; } }
    if(free) return p;
  }
  return -1;
}

function subjectName(data, id){
  const s = data.subjects.find(s=>s.id===id);
  return s ? s.name : '—';
}

function formatHours(n){
  return (Math.round(n*100)/100).toString().replace('.', ',');
}
