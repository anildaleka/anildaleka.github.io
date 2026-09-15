/* app.js — Orari Mësimor, Shkolla 9-Vjeçare */

const STORAGE_KEY = 'orari-shkolla-db-v1';
const GRADES = [6,7,8,9];
const SECTIONS = ['A','B','C'];

function defaultDB(){
  return {
    settings:{ days:['Hënë','Martë','Mërkurë','Enjte','Premte'], periodsPerDay:7 },
    subjects:[],
    teachers:[],
    curriculum:{6:{},7:{},8:{},9:{}},
    assignments:{},
    manualLocks:{},
    timetable:null
  };
}

let DB = loadDB();
let currentTab = 'dashboard';
let currentAssignClass = classList()[0].id;
let currentTTClass = classList()[0].id;
let manualEditMode = false;
let saveTimer = null;

function classList(){
  const list = [];
  GRADES.forEach(g=> SECTIONS.forEach(s=> list.push({id:`${g}${s}`, grade:g, section:s})));
  return list;
}
function gradeChipClass(g){ return `chip-g${g}`; }

function uid(){
  if(window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function loadDB(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultDB();
    const parsed = JSON.parse(raw);
    // fill gaps for forward-compat
    const d = defaultDB();
    const merged = Object.assign(d, parsed);
    return migrateDB(merged);
  }catch(e){
    console.error('Gabim gjatë leximit të databazës', e);
    return defaultDB();
  }
}

/* Converts data saved by older versions of the app (single teacherId per
   class+subject) into the current format (array of teacherIds), so old
   exported .json files keep working after importing them. */
function migrateDB(db){
  Object.keys(db.assignments||{}).forEach(clsId=>{
    const subjMap = db.assignments[clsId];
    Object.keys(subjMap).forEach(subjId=>{
      const v = subjMap[subjId];
      if(typeof v === 'string') subjMap[subjId] = [v];
      else if(!Array.isArray(v)) subjMap[subjId] = [];
    });
  });
  Object.keys(db.manualLocks||{}).forEach(clsId=>{
    const clsLocks = db.manualLocks[clsId];
    Object.keys(clsLocks).forEach(key=>{
      const lock = clsLocks[key];
      if(lock && lock.teacherId && !lock.teacherIds){
        lock.teacherIds = [lock.teacherId];
        delete lock.teacherId;
      }else if(lock && !Array.isArray(lock.teacherIds)){
        lock.teacherIds = [];
      }
    });
  });
  return db;
}

function saveDB(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
  const el = document.getElementById('saveStatus');
  el.textContent = 'Duke ruajtur…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(()=>{ el.textContent = 'Ruajtur'; }, 350);
}

function escapeHtml(str){
  return String(str??'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(()=> t.classList.remove('show'), 2400);
}

/* ---------------- Modal ---------------- */
function openModal(title, bodyHtml, onSubmit, opts={}){
  const backdrop = document.getElementById('modalBackdrop');
  const modal = document.getElementById('modal');
  modal.innerHTML = `
    <h3>${escapeHtml(title)}</h3>
    <form id="modalForm">${bodyHtml}
      <div class="modal-actions">
        <button type="button" class="btn" id="modalCancel">Anulo</button>
        <button type="submit" class="btn btn-primary">${escapeHtml(opts.submitLabel||'Ruaj')}</button>
      </div>
    </form>`;
  backdrop.classList.add('open');
  document.getElementById('modalCancel').onclick = closeModal;
  backdrop.onclick = (e)=>{ if(e.target===backdrop) closeModal(); };
  const form = document.getElementById('modalForm');
  form.onsubmit = (e)=>{
    e.preventDefault();
    onSubmit(new FormData(form), form);
  };
  const firstInput = form.querySelector('input,select,textarea');
  if(firstInput) setTimeout(()=>firstInput.focus(), 30);
}
function closeModal(){
  document.getElementById('modalBackdrop').classList.remove('open');
}

/* ---------------- Navigation ---------------- */
function switchTab(tab){
  currentTab = tab;
  document.querySelectorAll('.nav-item').forEach(b=> b.classList.toggle('active', b.dataset.tab===tab));
  document.querySelectorAll('.tab-panel').forEach(p=> p.classList.toggle('active', p.id === 'tab-'+tab));
  closeSidebarMobile();
  render();
}
function closeSidebarMobile(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarBackdrop').classList.remove('open');
}

function render(){
  switch(currentTab){
    case 'dashboard': renderDashboard(); break;
    case 'teachers': renderTeachers(); break;
    case 'subjects': renderSubjects(); break;
    case 'curriculum': renderCurriculum(); break;
    case 'assignments': renderAssignments(); break;
    case 'timetable': renderTimetableTab(); break;
    case 'master': renderMasterTab(); break;
    case 'search': renderSearch(); break;
    case 'settings': renderSettings(); break;
    case 'database': renderDatabase(); break;
  }
}

/* ---------------- Dashboard ---------------- */
function renderDashboard(){
  const el = document.getElementById('tab-dashboard');
  const totalClasses = classList().length;
  const totalCurrHours = GRADES.reduce((sum,g)=>{
    const curr = DB.curriculum[g]||{};
    return sum + Object.values(curr).reduce((a,b)=>a+(b||0),0);
  },0);
  const unassignedCount = countUnassigned();

  el.innerHTML = `
    <div class="page-head">
      <div><h1>Paneli</h1><p>Përmbledhje e shpejtë e shkollës suaj 9-vjeçare.</p></div>
    </div>
    <div class="grid-stats">
      <div class="stat"><div class="num">${totalClasses}</div><div class="lbl">Klasa (6–9, A/B/C)</div></div>
      <div class="stat"><div class="num">${DB.teachers.length}</div><div class="lbl">Mësues</div></div>
      <div class="stat"><div class="num">${DB.subjects.length}</div><div class="lbl">Lëndë</div></div>
      <div class="stat"><div class="num">${totalCurrHours}</div><div class="lbl">Orë/javë (mesatarisht/klasë)</div></div>
    </div>
    ${unassignedCount>0 ? `<div class="note-box">${unassignedCount} çift(e) lëndë–klasë nuk kanë ende mësues të caktuar. Shko te <strong>Caktimet</strong> për t'i plotësuar përpara se të gjenerosh orarin.</div>` : ''}
    <div class="card">
      <h2>Si funksionon</h2>
      <p class="hint">1. Shto <strong>Lëndët</strong> → 2. Shto <strong>Mësuesit</strong> (me lëndët që japin dhe normën javore) → 3. Plotëso <strong>Kurrikulën</strong> (sa orë/javë ka çdo lëndë për secilën klasë) → 4. Bëj <strong>Caktimet</strong> (cili mësues i jep cilës klasë) → 5. Shko te <strong>Gjenero Orarin</strong>.</p>
    </div>
  `;
}

function countUnassigned(){
  let count = 0;
  classList().forEach(cls=>{
    const curr = DB.curriculum[cls.grade]||{};
    Object.keys(curr).forEach(subjId=>{
      if(!curr[subjId]) return;
      const arr = (DB.assignments[cls.id]||{})[subjId];
      if(!arr || !arr.length) count++;
    });
  });
  return count;
}

/* ---------------- Teachers ---------------- */
function renderTeachers(){
  const el = document.getElementById('tab-teachers');
  const rows = DB.teachers.map(t=>{
    const subjNames = t.subjectIds.map(id=>{
      const s = DB.subjects.find(s=>s.id===id);
      return s ? s.name : null;
    }).filter(Boolean);
    return `<tr>
      <td>${escapeHtml(t.name)}</td>
      <td>${subjNames.map(n=>`<span class="chip chip-muted">${escapeHtml(n)}</span>`).join(' ') || '<span class="hint">—</span>'}</td>
      <td>${t.maxHours} orë/javë</td>
      <td style="text-align:right; white-space:nowrap;">
        <button class="btn btn-sm" data-edit-teacher="${t.id}">Ndrysho</button>
        <button class="btn btn-sm btn-danger" data-del-teacher="${t.id}">Fshi</button>
      </td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="page-head">
      <div><h1>Mësuesit</h1><p>Emri, lëndët që jep dhe norma javore e detyrueshme e orëve.</p></div>
      <button class="btn btn-primary" id="addTeacherBtn">+ Shto mësues</button>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Emri</th><th>Lëndët</th><th>Norma</th><th></th></tr></thead>
          <tbody>${rows || `<tr class="empty-row"><td colspan="4">Ende s'ka mësues. Shto të parin.</td></tr>`}</tbody>
        </table>
      </div>
    </div>
  `;
  document.getElementById('addTeacherBtn').onclick = ()=> teacherModal();
  el.querySelectorAll('[data-edit-teacher]').forEach(b=> b.onclick = ()=> teacherModal(b.dataset.editTeacher));
  el.querySelectorAll('[data-del-teacher]').forEach(b=> b.onclick = ()=>{
    if(confirm('Të fshihet ky mësues? Caktimet e tij në klasa do të hiqen gjithashtu.')){
      const id = b.dataset.delTeacher;
      DB.teachers = DB.teachers.filter(t=>t.id!==id);
      Object.keys(DB.assignments).forEach(clsId=>{
        Object.keys(DB.assignments[clsId]).forEach(subjId=>{
          DB.assignments[clsId][subjId] = (DB.assignments[clsId][subjId]||[]).filter(tid=>tid!==id);
          if(!DB.assignments[clsId][subjId].length) delete DB.assignments[clsId][subjId];
        });
      });
      Object.keys(DB.manualLocks).forEach(clsId=>{
        Object.keys(DB.manualLocks[clsId]).forEach(key=>{
          const lock = DB.manualLocks[clsId][key];
          if(lock.teacherIds && lock.teacherIds.includes(id)) delete DB.manualLocks[clsId][key];
        });
      });
      saveDB(); toast('Mësuesi u fshi.'); renderTeachers();
    }
  });
}

function teacherModal(id){
  const t = id ? DB.teachers.find(x=>x.id===id) : null;
  const subjectPills = DB.subjects.map(s=>{
    const checked = t && t.subjectIds.includes(s.id);
    return `<label class="check-pill ${checked?'checked':''}">
      <input type="checkbox" name="subjectIds" value="${s.id}" ${checked?'checked':''}> ${escapeHtml(s.name)}
    </label>`;
  }).join('') || '<p class="hint">Shto më parë lëndë te skeda "Lëndët".</p>';

  openModal(t ? 'Ndrysho mësuesin' : 'Shto mësues', `
    <div class="field">
      <label>Emri i plotë</label>
      <input type="text" name="name" required value="${t?escapeHtml(t.name):''}" placeholder="p.sh. Elira Hoxha">
    </div>
    <div class="field">
      <label>Lëndët që jep</label>
      <div class="check-list">${subjectPills}</div>
    </div>
    <div class="field">
      <label>Norma javore e detyrueshme (orë)</label>
      <input type="number" name="maxHours" min="1" max="40" required value="${t?t.maxHours:22}">
    </div>
  `, (fd)=>{
    const name = fd.get('name').trim();
    if(!name) return;
    const subjectIds = fd.getAll('subjectIds');
    const maxHours = parseInt(fd.get('maxHours'),10) || 0;
    if(t){
      t.name = name; t.subjectIds = subjectIds; t.maxHours = maxHours;
    }else{
      DB.teachers.push({id:uid(), name, subjectIds, maxHours});
    }
    saveDB(); closeModal(); toast('U ruajt.'); renderTeachers();
  });

  // live toggle style on check
  document.querySelectorAll('.check-pill input').forEach(cb=>{
    cb.addEventListener('change', ()=> cb.closest('.check-pill').classList.toggle('checked', cb.checked));
  });
}

/* ---------------- Subjects ---------------- */
function renderSubjects(){
  const el = document.getElementById('tab-subjects');
  const rows = DB.subjects.map(s=>`
    <tr>
      <td>${escapeHtml(s.name)}</td>
      <td style="text-align:right; white-space:nowrap;">
        <button class="btn btn-sm" data-edit-subject="${s.id}">Ndrysho</button>
        <button class="btn btn-sm btn-danger" data-del-subject="${s.id}">Fshi</button>
      </td>
    </tr>`).join('');

  el.innerHTML = `
    <div class="page-head">
      <div><h1>Lëndët</h1><p>Lista e lëndëve mësimore që jepen në shkollë.</p></div>
      <button class="btn btn-primary" id="addSubjectBtn">+ Shto lëndë</button>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Emri i lëndës</th><th></th></tr></thead>
          <tbody>${rows || `<tr class="empty-row"><td colspan="2">Ende s'ka lëndë. Shto të parën (p.sh. Matematikë).</td></tr>`}</tbody>
        </table>
      </div>
    </div>
  `;
  document.getElementById('addSubjectBtn').onclick = ()=> subjectModal();
  el.querySelectorAll('[data-edit-subject]').forEach(b=> b.onclick = ()=> subjectModal(b.dataset.editSubject));
  el.querySelectorAll('[data-del-subject]').forEach(b=> b.onclick = ()=>{
    if(confirm('Të fshihet kjo lëndë? Do të hiqet edhe nga kurrikula, caktimet dhe mësuesit.')){
      const id = b.dataset.delSubject;
      DB.subjects = DB.subjects.filter(s=>s.id!==id);
      GRADES.forEach(g=> delete DB.curriculum[g][id]);
      Object.keys(DB.assignments).forEach(clsId=> delete DB.assignments[clsId][id]);
      DB.teachers.forEach(t=> t.subjectIds = t.subjectIds.filter(sid=>sid!==id));
      Object.keys(DB.manualLocks).forEach(clsId=>{
        Object.keys(DB.manualLocks[clsId]).forEach(key=>{
          if(DB.manualLocks[clsId][key].subjectId===id) delete DB.manualLocks[clsId][key];
        });
      });
      saveDB(); toast('Lënda u fshi.'); renderSubjects();
    }
  });
}

function subjectModal(id){
  const s = id ? DB.subjects.find(x=>x.id===id) : null;
  openModal(s?'Ndrysho lëndën':'Shto lëndë', `
    <div class="field">
      <label>Emri i lëndës</label>
      <input type="text" name="name" required value="${s?escapeHtml(s.name):''}" placeholder="p.sh. Gjuhë Shqipe">
    </div>
  `, (fd)=>{
    const name = fd.get('name').trim();
    if(!name) return;
    if(s){ s.name = name; }
    else{ DB.subjects.push({id:uid(), name}); }
    saveDB(); closeModal(); toast('U ruajt.'); renderSubjects();
  });
}

/* ---------------- Curriculum (hours/week per grade) ---------------- */
function renderCurriculum(){
  const el = document.getElementById('tab-curriculum');
  if(DB.subjects.length===0){
    el.innerHTML = `<div class="page-head"><div><h1>Kurrikula</h1><p>Orët javore për çdo lëndë, sipas klasës.</p></div></div>
      <div class="note-box">Shto së pari lëndët te skeda "Lëndët".</div>`;
    return;
  }
  const rows = DB.subjects.map(s=>{
    const cells = GRADES.map(g=>{
      const val = DB.curriculum[g][s.id] || 0;
      return `<td><input type="number" min="0" max="15" step="0.5" style="width:64px; text-align:center;"
        data-curr-subject="${s.id}" data-curr-grade="${g}" value="${formatHoursInput(val)}"></td>`;
    }).join('');
    return `<tr><td>${escapeHtml(s.name)}</td>${cells}</tr>`;
  }).join('');

  const totals = GRADES.map(g=>{
    const curr = DB.curriculum[g]||{};
    return Object.values(curr).reduce((a,b)=>a+(b||0),0);
  });

  el.innerHTML = `
    <div class="page-head">
      <div><h1>Kurrikula</h1><p>Sa orë në javë ka çdo lëndë, për secilën klasë (6–9). Pranohen edhe numra me presje, p.sh. 1,5. Vlera vlen për të gjitha ndarjet A/B/C të asaj klase.</p></div>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Lënda</th>${GRADES.map(g=>`<th style="text-align:center;">Klasa ${g}</th>`).join('')}</tr></thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr style="font-weight:600;"><td>Total orë/javë</td>${totals.map(t=>`<td style="text-align:center;">${formatHoursInput(t)}</td>`).join('')}</tr>
          </tfoot>
        </table>
      </div>
      <p class="hint">Kujdes: totali për javë nuk duhet ta kalojë numrin e periudhave në dispozicion (ditë × orë/ditë, shiko "Cilësimet"). Orët me presje (p.sh. 1,5) ruhen saktë këtu; në orarin me periudha të plota përdoret numri i rrumbullakosur (1,5 → 2), me një vërejtje përkatëse te "Gjenero Orarin".</p>
    </div>
  `;
  el.querySelectorAll('input[data-curr-subject]').forEach(inp=>{
    inp.addEventListener('change', ()=>{
      const subjId = inp.dataset.currSubject;
      const grade = inp.dataset.currGrade;
      let val = parseFloat(inp.value);
      if(isNaN(val) || val<0) val = 0;
      val = Math.round(val*2)/2; // rrumbullakos vetëm te gjysma më e afërt (0.5), asnjëherë te e plota
      DB.curriculum[grade][subjId] = val;
      saveDB();
      renderCurriculum();
    });
  });
}

function formatHoursInput(n){
  // avoids ugly floating point artifacts like 1.4999999
  return (Math.round(n*100)/100);
}

/* ---------------- Assignments (teacher per class+subject) ---------------- */
function renderAssignments(){
  const el = document.getElementById('tab-assignments');
  const classes = classList();

  const tabsHtml = classes.map(c=>`<button class="class-tab ${c.id===currentAssignClass?'active':''}" data-cls="${c.id}">${c.id}</button>`).join('');

  const cls = classes.find(c=>c.id===currentAssignClass);
  const curr = DB.curriculum[cls.grade] || {};
  const subjIds = Object.keys(curr).filter(id=>curr[id]>0);

  let bodyHtml;
  if(subjIds.length===0){
    bodyHtml = `<div class="note-box">Klasa ${cls.grade} nuk ka ende orë të përcaktuara në Kurrikulë.</div>`;
  }else{
    const rows = subjIds.map(subjId=>{
      const subj = DB.subjects.find(s=>s.id===subjId);
      const eligibleTeachers = DB.teachers.filter(t=>t.subjectIds.includes(subjId));
      const currentIds = ((DB.assignments[cls.id]||{})[subjId]) || [];
      const pills = eligibleTeachers.map(t=>{
        const checked = currentIds.includes(t.id);
        return `<label class="check-pill ${checked?'checked':''}">
          <input type="checkbox" data-assign-subject="${subjId}" data-assign-teacher="${t.id}" ${checked?'checked':''}> ${escapeHtml(t.name)}
        </label>`;
      }).join('') || `<span class="badge-warn">Asnjë mësues nuk jep këtë lëndë</span>`;
      return `<tr>
        <td>${escapeHtml(subj?subj.name:'—')}</td>
        <td>${formatHoursInput(curr[subjId])} orë/javë</td>
        <td><div class="check-list">${pills}</div></td>
      </tr>`;
    }).join('');
    bodyHtml = `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Lënda</th><th>Orë/javë</th><th>Mësues(it) e caktuar (zgjidh 1 ose më shumë)</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
      <p class="hint">Për lëndë si Fiskultura, kur ke dy mësues njëkohësisht (p.sh. vajza / djem), thjesht zgjidh të dy — do të vendosen gjithmonë në të njëjtën periudhë.</p>`;
  }

  el.innerHTML = `
    <div class="page-head">
      <div><h1>Caktimet Mësues ↔ Klasë</h1><p>Zgjidh cili/cilët mësues e japin secilën lëndë, për secilën klasë.</p></div>
    </div>
    <div class="class-tabs">${tabsHtml}</div>
    <div class="card">${bodyHtml}</div>
  `;

  el.querySelectorAll('.class-tab').forEach(b=> b.onclick = ()=>{ currentAssignClass = b.dataset.cls; renderAssignments(); });
  el.querySelectorAll('[data-assign-teacher]').forEach(cb=>{
    cb.addEventListener('change', ()=>{
      const subjId = cb.dataset.assignSubject;
      const teacherId = cb.dataset.assignTeacher;
      if(!DB.assignments[cls.id]) DB.assignments[cls.id] = {};
      let arr = DB.assignments[cls.id][subjId] || [];
      if(cb.checked){ if(!arr.includes(teacherId)) arr.push(teacherId); }
      else{ arr = arr.filter(id=>id!==teacherId); }
      if(arr.length) DB.assignments[cls.id][subjId] = arr;
      else delete DB.assignments[cls.id][subjId];
      cb.closest('.check-pill').classList.toggle('checked', cb.checked);
      saveDB();
    });
  });
}

/* ---------------- Manual locks (fixed cells) ---------------- */
function cellKey(d,p){ return `${d}_${p}`; }

function getLock(classId,d,p){
  const clsLocks = DB.manualLocks[classId];
  return clsLocks ? clsLocks[cellKey(d,p)] : undefined;
}

function emptyGrid(){
  const days = DB.settings.days.length;
  const periods = DB.settings.periodsPerDay;
  return Array.from({length:days},()=>Array(periods).fill(null));
}

function getDisplayGrid(classId){
  let grid;
  if(DB.timetable && DB.timetable.schedule[classId]){
    grid = DB.timetable.schedule[classId].map(row=>row.slice());
  }else{
    grid = emptyGrid();
  }
  const clsLocks = DB.manualLocks[classId] || {};
  Object.keys(clsLocks).forEach(key=>{
    const parts = key.split('_');
    const d = parseInt(parts[0],10), p = parseInt(parts[1],10);
    const lock = clsLocks[key];
    if(grid[d]) grid[d][p] = {subjectId:lock.subjectId, teacherIds:lock.teacherIds||[], locked:true};
  });
  return grid;
}

/* Sets a manual lock for classId at day d, period p, with one or more teachers
   (e.g. Fiskulturë: një mësues për vajza, një për djem, njëkohësisht). If
   another class has a MANUAL lock sharing any of these teachers at the same
   slot, this is rejected (the user must remove that lock first). If another
   class has one of these teachers only from AUTO-generation (not locked),
   that other cell is freed up so the next "Gjenero/Rigjenero" repairs it. */
function applyManualLock(classId, d, p, subjectId, teacherIds){
  for(const otherClassId in DB.manualLocks){
    if(otherClassId===classId) continue;
    const other = getLock(otherClassId,d,p);
    if(other && other.teacherIds && other.teacherIds.some(id=>teacherIds.includes(id))){
      alert(`Konflikt: një nga këta mësues është kyçur manualisht te klasa ${otherClassId} në këtë orë. Hiqe atë kyçje së pari.`);
      return false;
    }
  }
  if(DB.timetable){
    classList().forEach(c=>{
      if(c.id===classId) return;
      if(getLock(c.id,d,p)) return; // handled above
      const cell = DB.timetable.schedule[c.id] && DB.timetable.schedule[c.id][d][p];
      if(cell && cell.teacherIds && cell.teacherIds.some(id=>teacherIds.includes(id))){
        DB.timetable.schedule[c.id][d][p] = null; // do t'i rikthehet gjenerimit automatik
      }
    });
    if(!DB.timetable.schedule[classId]) DB.timetable.schedule[classId] = emptyGrid();
    const prevCell = DB.timetable.schedule[classId][d][p];
    if(prevCell && prevCell.teacherIds){
      prevCell.teacherIds.forEach(id=>{ if(DB.timetable.teacherSchedule[id]) DB.timetable.teacherSchedule[id][d][p] = null; });
    }
    DB.timetable.schedule[classId][d][p] = {subjectId, teacherIds, locked:true};
    teacherIds.forEach(id=>{
      if(!DB.timetable.teacherSchedule[id]) DB.timetable.teacherSchedule[id] = emptyGrid();
      DB.timetable.teacherSchedule[id][d][p] = classId;
    });
  }
  if(!DB.manualLocks[classId]) DB.manualLocks[classId] = {};
  DB.manualLocks[classId][cellKey(d,p)] = {subjectId, teacherIds};
  saveDB();
  return true;
}

function clearManualLock(classId,d,p){
  if(DB.manualLocks[classId]) delete DB.manualLocks[classId][cellKey(d,p)];
  if(DB.timetable && DB.timetable.schedule[classId]){
    const cell = DB.timetable.schedule[classId][d][p];
    if(cell){
      (cell.teacherIds||[]).forEach(id=>{ if(DB.timetable.teacherSchedule[id]) DB.timetable.teacherSchedule[id][d][p] = null; });
      DB.timetable.schedule[classId][d][p] = null;
    }
  }
  saveDB();
}

function openCellEditModal(classId, d, p){
  const cls = classList().find(c=>c.id===classId);
  const prevLock = getLock(classId,d,p);
  const prevTeacherIds = prevLock ? (prevLock.teacherIds||[]) : [];
  const curr = DB.curriculum[cls.grade] || {};
  const subjIds = Object.keys(curr).filter(id=>curr[id]>0);
  if(subjIds.length===0){
    toast('Kjo klasë nuk ka lëndë të përcaktuara në Kurrikulë.');
    return;
  }
  const dayName = DB.settings.days[d];
  const subjectOptions = `<option value="">— Zbraz (lëre automatike) —</option>` + subjIds.map(id=>{
    const s = DB.subjects.find(x=>x.id===id);
    const sel = prevLock && prevLock.subjectId===id ? 'selected' : '';
    return `<option value="${id}" ${sel}>${escapeHtml(s?s.name:'—')}</option>`;
  }).join('');

  openModal(`${classId} · ${dayName}, Ora ${p+1}`, `
    <div class="field">
      <label>Lënda</label>
      <select name="subjectId" id="cellSubjectSelect">${subjectOptions}</select>
    </div>
    <div class="field">
      <label>Mësues(it) — zgjidh 1 ose më shumë (p.sh. Fiskulturë: vajza + djem)</label>
      <div class="check-list" id="cellTeacherList"></div>
    </div>
    <p class="hint">Kutitë e tjera rregullohen automatikisht sa herë klikon "Gjenero/Rigjenero", pa e prekur këtë caktim.</p>
  `, (fd)=>{
    const subjectId = fd.get('subjectId');
    const teacherIds = fd.getAll('cellTeacherIds');
    if(!subjectId){
      clearManualLock(classId,d,p);
      toast('Kutia u liruar — do të plotësohet automatikisht.');
    }else{
      if(!teacherIds.length){ toast('Zgjidh të paktën një mësues.'); return; }
      const ok = applyManualLock(classId,d,p,subjectId,teacherIds);
      if(!ok) return;
      toast('U kyç manualisht.');
    }
    closeModal();
    renderTimetableTab();
  }, {submitLabel:'Ruaj'});

  function populateTeacherChecklist(subjectId){
    const wrap = document.getElementById('cellTeacherList');
    const eligible = DB.teachers.filter(t=>t.subjectIds.includes(subjectId));
    const others = DB.teachers.filter(t=>!t.subjectIds.includes(subjectId));
    const pill = (t)=>{
      const checked = prevTeacherIds.includes(t.id);
      return `<label class="check-pill ${checked?'checked':''}">
        <input type="checkbox" name="cellTeacherIds" value="${t.id}" ${checked?'checked':''}> ${escapeHtml(t.name)}
      </label>`;
    };
    let html = eligible.map(pill).join('');
    if(others.length) html += others.map(pill).join('');
    wrap.innerHTML = html || '<p class="hint">Nuk ka mësues në sistem.</p>';
    wrap.querySelectorAll('input').forEach(cb=>{
      cb.addEventListener('change', ()=> cb.closest('.check-pill').classList.toggle('checked', cb.checked));
    });
  }
  const initialSubject = prevLock ? prevLock.subjectId : subjIds[0];
  document.getElementById('cellSubjectSelect').value = prevLock ? prevLock.subjectId : '';
  populateTeacherChecklist(initialSubject);
  document.getElementById('cellSubjectSelect').addEventListener('change', (e)=> populateTeacherChecklist(e.target.value || subjIds[0]));
}

/* ---------------- Teacher colors ---------------- */
const TEACHER_PALETTE = ['#3B6EA5','#2F8F72','#C97A2B','#7A4E82','#B3432E','#1F7A8C','#8C6E1F','#4D7EA8','#9C4F96','#3F8F3F','#A85D3B','#5A6ACF','#B0447A','#3F9B8C','#8A8A1F','#6E4F9C'];
function getTeacherColor(teacherId){
  const idx = DB.teachers.findIndex(t=>t.id===teacherId);
  if(idx===-1) return '#9AA5A8';
  return TEACHER_PALETTE[idx % TEACHER_PALETTE.length];
}
function renderTeacherColorLegend(){
  if(!DB.teachers.length) return '';
  const items = DB.teachers.map(t=>`<span class="legend-item"><span class="dot" style="background:${getTeacherColor(t.id)}"></span>${escapeHtml(t.name)}</span>`).join('');
  return `<div class="card legend-card"><h2>Legjenda e ngjyrave (sipas mësuesit)</h2><div class="legend-wrap">${items}</div></div>`;
}

/* ---------------- Timetable generation & view ---------------- */
function renderTimetableTab(){
  const el = document.getElementById('tab-timetable');
  const classes = classList();
  const hasData = DB.subjects.length && DB.teachers.length;

  const tabsHtml = classes.map(c=>`<button class="class-tab ${c.id===currentTTClass?'active':''}" data-cls="${c.id}">${c.id}</button>`).join('');

  const warningsHtml = DB.timetable
    ? (DB.timetable.warnings.length
        ? `<div class="note-box"><strong>Vërejtje:</strong><ul style="margin:6px 0 0 18px; padding:0;">${DB.timetable.warnings.map(w=>`<li>${escapeHtml(w)}</li>`).join('')}</ul></div>`
        : `<div class="card" style="background:var(--accent-soft); border-color:var(--accent);"><strong style="color:var(--accent-dark);">✓ Orari u gjenerua pa konflikte.</strong></div>`)
    : `<div class="note-box">Ende nuk ka orar të gjeneruar plotësisht. Mund të fillosh duke kyçur disa kuti manualisht më poshtë, pastaj kliko "Gjenero / Rigjenero" që sistemi të plotësojë automatikisht pjesën tjetër.</div>`;

  const toolbarHtml = `<div class="toolbar">
    <button class="btn ${manualEditMode?'btn-primary':''}" id="manualModeBtn">${manualEditMode?'✓ Modaliteti manual aktiv — kliko një kuti':'✎ Redakto manualisht'}</button>
    <button class="btn btn-sm btn-danger" id="clearClassLocksBtn">Pastro kyçjet e ${currentTTClass}</button>
  </div>`;

  const legendHtml = manualEditMode ? `<p class="hint" style="margin-bottom:10px;">📌 = caktim i kyçur manualisht — nuk preket nga gjenerimi automatik. Kliko çdo kuti për ta caktuar ose liruar.</p>` : '';

  el.innerHTML = `
    <div class="page-head">
      <div><h1>Gjenero Orarin</h1><p>Krijon automatikisht orarin javor për 12 klasat, duke shmangur përplasjet e mësuesve.</p></div>
      <button class="btn btn-primary" id="genBtn" ${hasData?'':'disabled'}>⟳ Gjenero / Rigjenero</button>
    </div>
    ${!hasData ? `<div class="note-box">Plotëso së pari Lëndët, Mësuesit, Kurrikulën dhe Caktimet.</div>` : ''}
    <div class="class-tabs">${tabsHtml}</div>
    ${toolbarHtml}
    ${legendHtml}
    ${warningsHtml}
    <div class="card">${renderClassGrid(currentTTClass)}</div>
    ${renderTeacherColorLegend()}
    ${DB.timetable ? renderTeacherLoadTable() : ''}
  `;

  document.getElementById('genBtn')?.addEventListener('click', ()=>{
    document.getElementById('genBtn').textContent = 'Duke gjeneruar…';
    setTimeout(()=>{
      const result = generateTimetable(DB);
      DB.timetable = result;
      saveDB();
      toast('Orari u gjenerua. Kyçjet manuale u ruajtën.');
      renderTimetableTab();
    }, 30);
  });
  el.querySelectorAll('.class-tab').forEach(b=> b.onclick = ()=>{ currentTTClass = b.dataset.cls; renderTimetableTab(); });
  document.getElementById('manualModeBtn').onclick = ()=>{ manualEditMode = !manualEditMode; renderTimetableTab(); };
  document.getElementById('clearClassLocksBtn').onclick = ()=>{
    if(confirm(`Të pastrohen të gjitha kyçjet manuale të klasës ${currentTTClass}?`)){
      delete DB.manualLocks[currentTTClass];
      saveDB();
      toast('U pastruan. Kliko "Gjenero / Rigjenero" për t\'i rimbushur automatikisht.');
      renderTimetableTab();
    }
  };
  if(manualEditMode){
    el.querySelectorAll('.tt-cell-editable').forEach(td=>{
      td.addEventListener('click', ()=>{
        openCellEditModal(currentTTClass, parseInt(td.dataset.day,10), parseInt(td.dataset.period,10));
      });
    });
  }
}

function renderClassGrid(classId){
  const days = DB.settings.days;
  const periods = DB.settings.periodsPerDay;
  const grid = getDisplayGrid(classId);

  let head = `<tr><th>Ora</th>${days.map(d=>`<th>${escapeHtml(d)}</th>`).join('')}</tr>`;
  let body = '';
  for(let p=0;p<periods;p++){
    body += `<tr><td class="period-lbl">${p+1}</td>`;
    for(let d=0; d<days.length; d++){
      const cell = grid[d][p];
      const editableCls = manualEditMode ? ' tt-cell-editable' : '';
      if(cell){
        const subj = DB.subjects.find(s=>s.id===cell.subjectId);
        const teacherIds = cell.teacherIds || [];
        const lockedCls = cell.locked ? ' tt-cell-locked' : '';
        const pin = cell.locked ? '<span class="pin">📌</span>' : '';
        const mainColor = teacherIds.length ? getTeacherColor(teacherIds[0]) : 'transparent';
        const teachHtml = teacherIds.map(id=>{
          const t = DB.teachers.find(x=>x.id===id);
          const c = getTeacherColor(id);
          return `<span class="teach"><span class="dot" style="background:${c}"></span>${escapeHtml(t?t.name:'')}</span>`;
        }).join('');
        body += `<td class="tt-cell${lockedCls}${editableCls}" style="--tcolor:${mainColor}" data-day="${d}" data-period="${p}">${pin}<span class="subj">${escapeHtml(subj?subj.name:'—')}</span>${teachHtml}</td>`;
      }else{
        body += `<td class="tt-cell empty${editableCls}" data-day="${d}" data-period="${p}">—</td>`;
      }
    }
    body += '</tr>';
  }
  return `<div class="table-wrap"><table class="tt-grid">${head}${body}</table></div>`;
}

function renderTeacherLoadTable(){
  if(!DB.teachers.length) return '';
  const rows = DB.teachers.map(t=>{
    const used = DB.timetable.teacherHours[t.id] || 0;
    const over = t.maxHours && used > t.maxHours;
    const under = t.maxHours && used < t.maxHours;
    const badge = over ? `<span class="badge-danger">${used} / ${t.maxHours} orë</span>`
                : under ? `<span class="badge-warn">${used} / ${t.maxHours} orë</span>`
                : `<span class="badge-ok">${used} / ${t.maxHours} orë</span>`;
    return `<tr><td>${escapeHtml(t.name)}</td><td>${badge}</td></tr>`;
  }).join('');
  return `<div class="card"><h2>Ngarkesa e mësuesve</h2><div class="table-wrap"><table class="data-table">
    <thead><tr><th>Mësuesi</th><th>Orë të planifikuara</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

/* ---------------- Grafiku i Plotë (master view — for the whole school) ---------------- */
function renderMasterTab(){
  const el = document.getElementById('tab-master');
  if(!DB.timetable){
    el.innerHTML = `
      <div class="page-head"><div><h1>Grafiku i Plotë</h1><p>Orari i të gjithë mësuesve, në një tabelë të vetme — për ta printuar dhe varur në shkollë.</p></div></div>
      <div class="note-box">Gjenero orarin së pari te skeda "Gjenero Orarin".</div>`;
    return;
  }
  const days = DB.settings.days;
  const periods = DB.settings.periodsPerDay;
  const sortedTeachers = DB.teachers.slice().sort((a,b)=>a.name.localeCompare(b.name,'sq'));

  let dayHeader = `<th class="mc-corner">Mësuesi</th>`;
  days.forEach(d=> dayHeader += `<th colspan="${periods}">${escapeHtml(d)}</th>`);
  let periodHeader = '<th></th>';
  days.forEach(()=>{ for(let p=1;p<=periods;p++) periodHeader += `<th>${p}</th>`; });

  let rows = sortedTeachers.map(t=>{
    const color = getTeacherColor(t.id);
    const tGrid = DB.timetable.teacherSchedule[t.id];
    let cells = '';
    for(let d=0; d<days.length; d++){
      for(let p=0;p<periods;p++){
        const clsId = tGrid ? tGrid[d][p] : null;
        cells += clsId
          ? `<td class="mc-cell" style="--tcolor:${color}">${escapeHtml(clsId)}</td>`
          : `<td class="mc-cell empty">—</td>`;
      }
    }
    return `<tr><td class="mc-teacher" style="--tcolor:${color}"><span class="dot" style="background:${color}"></span>${escapeHtml(t.name)}</td>${cells}</tr>`;
  }).join('');

  el.innerHTML = `
    <div class="page-head">
      <div><h1>Grafiku i Plotë</h1><p>Orari i të gjithë mësuesve, në një tabelë të vetme — për ta printuar dhe varur në shkollë.</p></div>
      <button class="btn btn-primary" id="printMasterBtn">🖶 Printo</button>
    </div>
    ${sortedTeachers.length===0 ? `<div class="note-box">Ende s'ka mësues.</div>` : `
    <div class="card printable-area" id="printArea">
      <h2 style="text-align:center; margin-bottom:14px;">Orari i Përgjithshëm i Shkollës</h2>
      <div class="table-wrap">
        <table class="tt-grid master-grid">
          <thead><tr>${dayHeader}</tr><tr>${periodHeader}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
    ${renderTeacherColorLegend()}
    `}
  `;
  document.getElementById('printMasterBtn')?.addEventListener('click', ()=> window.print());
}

/* ---------------- Search ---------------- */
function renderSearch(){
  const el = document.getElementById('tab-search');
  el.innerHTML = `
    <div class="page-head"><div><h1>Kërko Mësues</h1><p>Gjej shpejt orarin javor të një mësuesi/eje.</p></div></div>
    <div class="search-box"><input type="text" id="teacherSearchInput" placeholder="Shkruaj emrin e mësuesit…" autocomplete="off"></div>
    <div class="search-results" id="teacherSearchResults"></div>
    <div id="teacherSearchGrid"></div>
  `;
  const input = document.getElementById('teacherSearchInput');
  const resultsEl = document.getElementById('teacherSearchResults');
  const gridEl = document.getElementById('teacherSearchGrid');

  function showResults(query){
    const q = query.trim().toLowerCase();
    const matches = q ? DB.teachers.filter(t=> t.name.toLowerCase().includes(q)) : DB.teachers;
    resultsEl.innerHTML = matches.map(t=>`<div class="search-result-item" data-t="${t.id}">
      <span>${escapeHtml(t.name)}</span><span class="hint">${t.maxHours} orë/javë</span></div>`).join('')
      || `<p class="hint">Asnjë mësues nuk u gjet.</p>`;
    resultsEl.querySelectorAll('[data-t]').forEach(item=>{
      item.onclick = ()=> showTeacherSchedule(item.dataset.t);
    });
  }

  function showTeacherSchedule(teacherId){
    const t = DB.teachers.find(x=>x.id===teacherId);
    if(!t) return;
    if(!DB.timetable){
      gridEl.innerHTML = `<div class="note-box" style="margin-top:14px;">Ende nuk ka orar të gjeneruar. Shko te "Gjenero Orarin".</div>`;
      return;
    }
    const days = DB.settings.days;
    const periods = DB.settings.periodsPerDay;
    const tGrid = DB.timetable.teacherSchedule[teacherId];
    let head = `<tr><th>Ora</th>${days.map(d=>`<th>${escapeHtml(d)}</th>`).join('')}</tr>`;
    let body = '';
    for(let p=0;p<periods;p++){
      body += `<tr><td class="period-lbl">${p+1}</td>`;
      for(let d=0; d<days.length; d++){
        const clsId = tGrid[d][p];
        if(clsId){
          const cell = DB.timetable.schedule[clsId][d][p];
          const subj = DB.subjects.find(s=>s.id===cell.subjectId);
          const others = (cell.teacherIds||[]).filter(id=>id!==teacherId).map(id=>{
            const ot = DB.teachers.find(x=>x.id===id); return ot?ot.name:null;
          }).filter(Boolean);
          const withNote = others.length ? `<span class="teach">me ${escapeHtml(others.join(', '))}</span>` : '';
          body += `<td class="tt-cell" style="--tcolor:${getTeacherColor(teacherId)}"><span class="subj">${escapeHtml(clsId)}</span><span class="teach">${escapeHtml(subj?subj.name:'')}</span>${withNote}</td>`;
        }else{
          body += `<td class="tt-cell empty">—</td>`;
        }
      }
      body += '</tr>';
    }
    gridEl.innerHTML = `<div class="card" style="margin-top:14px;"><h2><span class="dot" style="background:${getTeacherColor(teacherId)}"></span> Orari i ${escapeHtml(t.name)}</h2>
      <div class="table-wrap"><table class="tt-grid">${head}${body}</table></div></div>`;
  }

  input.addEventListener('input', ()=> showResults(input.value));
  showResults('');
}

/* ---------------- Settings ---------------- */
function renderSettings(){
  const el = document.getElementById('tab-settings');
  el.innerHTML = `
    <div class="page-head"><div><h1>Cilësimet</h1><p>Ditët e javës dhe numri i orëve mësimore në ditë.</p></div></div>
    <div class="card">
      <div class="field">
        <label>Ditët mësimore (të ndara me presje)</label>
        <input type="text" id="daysInput" value="${DB.settings.days.map(escapeHtml).join(', ')}">
      </div>
      <div class="field">
        <label>Orë mësimore në ditë</label>
        <input type="number" id="periodsInput" min="1" max="12" value="${DB.settings.periodsPerDay}">
      </div>
      <button class="btn btn-primary" id="saveSettingsBtn">Ruaj cilësimet</button>
    </div>
  `;
  document.getElementById('saveSettingsBtn').onclick = ()=>{
    const days = document.getElementById('daysInput').value.split(',').map(s=>s.trim()).filter(Boolean);
    const periods = Math.max(1, parseInt(document.getElementById('periodsInput').value,10)||7);
    if(days.length<1){ toast('Duhet të paktën një ditë.'); return; }
    DB.settings.days = days;
    DB.settings.periodsPerDay = periods;
    saveDB();
    toast('Cilësimet u ruajtën. Rigjenero orarin nëse ke ndryshuar diçka.');
  };
}

/* ---------------- Database (import/export) ---------------- */
function renderDatabase(){
  const el = document.getElementById('tab-database');
  el.innerHTML = `
    <div class="page-head"><div><h1>Databaza</h1><p>Eksporto/importo të gjitha të dhënat në një skedar JSON — ideale për të punuar në GitHub Pages dhe për backup.</p></div></div>
    <div class="card">
      <h2>Eksporto</h2>
      <p class="hint">Shkarkon një skedar .json me mësuesit, lëndët, kurrikulën, caktimet, cilësimet dhe orarin e gjeneruar.</p>
      <div class="toolbar" style="margin-top:12px;">
        <button class="btn btn-primary" id="exportBtn">⇩ Eksporto databazën (.json)</button>
        <button class="btn" id="exportExcelBtn">⇩ Eksporto orarin e plotë (.xlsx)</button>
      </div>
      <p class="hint" style="margin-top:8px;">Excel-i përfshin: një fletë "Përmbledhje" (listë e sheshtë e gjithë orarit), një fletë për secilën klasë dhe një fletë për secilin mësues.</p>
    </div>
    <div class="card">
      <h2>Importo</h2>
      <p class="hint">Zgjidh një skedar .json të eksportuar më parë. Kjo do të zëvendësojë të dhënat aktuale.</p>
      <div class="toolbar" style="margin-top:12px;"><button class="btn" id="importBtn">⇧ Importo databazë</button></div>
    </div>
    <div class="card">
      <h2>Rrezik</h2>
      <div class="toolbar">
        <button class="btn btn-danger" id="clearAllLocksBtn">Fshi të gjitha kyçjet manuale të orarit</button>
        <button class="btn btn-danger" id="resetBtn">Fshi gjithçka dhe fillo nga e para</button>
      </div>
    </div>
  `;
  document.getElementById('exportBtn').onclick = exportDB;
  document.getElementById('exportExcelBtn').onclick = exportExcel;
  document.getElementById('importBtn').onclick = ()=> document.getElementById('fileImportInput').click();
  document.getElementById('clearAllLocksBtn').onclick = ()=>{
    if(confirm('Të fshihen të gjitha kyçjet manuale (në të gjitha klasat)? Orari i gjeneruar nuk fshihet, por rigjenerimi i ardhshëm do t\'i rregullojë ato kuti automatikisht.')){
      DB.manualLocks = {};
      saveDB();
      toast('U fshinë të gjitha kyçjet.');
    }
  };
  document.getElementById('resetBtn').onclick = ()=>{
    if(confirm('Je i/e sigurt? Kjo do të fshijë përgjithmonë të gjitha të dhënat lokale.')){
      DB = defaultDB();
      saveDB();
      toast('U fshi. Fillim i ri.');
      switchTab('dashboard');
    }
  };
}

function exportDB(){
  const blob = new Blob([JSON.stringify(DB, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0,10);
  a.href = url; a.download = `orari-shkolla-${stamp}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast('Databaza u eksportua.');
}

function uniqueSheetName(wb, base){
  let name = base.slice(0,31).replace(/[\\/?*[\]:]/g,'').trim() || 'Fleta';
  let candidate = name;
  let i = 2;
  while(wb.SheetNames.includes(candidate)){
    const suffix = ` (${i})`;
    candidate = name.slice(0, 31-suffix.length) + suffix;
    i++;
  }
  return candidate;
}

function exportExcel(){
  if(typeof XLSX === 'undefined'){ toast('Libraria Excel nuk u ngarkua. Kontrollo lidhjen me internetin.'); return; }
  if(!DB.timetable){ toast('Duhet të gjenerosh orarin së pari.'); return; }
  const days = DB.settings.days;
  const periods = DB.settings.periodsPerDay;
  const wb = XLSX.utils.book_new();

  // Fleta 1: Përmbledhje (listë e sheshtë)
  const flatRows = [['Dita','Ora','Klasa','Lënda','Mësues(it)']];
  classList().forEach(cls=>{
    const grid = DB.timetable.schedule[cls.id];
    if(!grid) return;
    for(let d=0; d<days.length; d++){
      for(let p=0;p<periods;p++){
        const cell = grid[d][p];
        if(!cell) continue;
        const subj = DB.subjects.find(s=>s.id===cell.subjectId);
        const teacherNames = (cell.teacherIds||[]).map(id=>{
          const t = DB.teachers.find(x=>x.id===id); return t?t.name:'';
        }).filter(Boolean).join(' + ');
        flatRows.push([days[d], p+1, cls.id, subj?subj.name:'', teacherNames]);
      }
    }
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(flatRows), 'Përmbledhje');

  // Nga një fletë për secilën klasë
  classList().forEach(cls=>{
    const grid = DB.timetable.schedule[cls.id];
    if(!grid) return;
    const rows = [['Ora', ...days]];
    for(let p=0;p<periods;p++){
      const row = [p+1];
      for(let d=0; d<days.length; d++){
        const cell = grid[d][p];
        if(cell){
          const subj = DB.subjects.find(s=>s.id===cell.subjectId);
          const teacherNames = (cell.teacherIds||[]).map(id=>{
            const t = DB.teachers.find(x=>x.id===id); return t?t.name:'';
          }).filter(Boolean).join(' + ');
          row.push(`${subj?subj.name:''}${teacherNames?(' / '+teacherNames):''}`);
        }else row.push('');
      }
      rows.push(row);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), uniqueSheetName(wb, cls.id));
  });

  // Nga një fletë për secilin mësues
  DB.teachers.forEach(t=>{
    const tGrid = DB.timetable.teacherSchedule[t.id];
    if(!tGrid) return;
    const rows = [['Ora', ...days]];
    for(let p=0;p<periods;p++){
      const row = [p+1];
      for(let d=0; d<days.length; d++){
        const clsId = tGrid[d][p];
        if(clsId){
          const cell = DB.timetable.schedule[clsId][d][p];
          const subj = DB.subjects.find(s=>s.id===cell.subjectId);
          row.push(`${clsId} — ${subj?subj.name:''}`);
        }else row.push('');
      }
      rows.push(row);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), uniqueSheetName(wb, t.name));
  });

  XLSX.writeFile(wb, `orari-shkolla-${new Date().toISOString().slice(0,10)}.xlsx`);
  toast('Excel u eksportua.');
}

function importDBFromFile(file){
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const parsed = JSON.parse(reader.result);
      const d = defaultDB();
      DB = migrateDB(Object.assign(d, parsed));
      saveDB();
      toast('Databaza u importua me sukses.');
      switchTab('dashboard');
    }catch(e){
      alert('Skedari nuk është JSON i vlefshëm.');
    }
  };
  reader.readAsText(file);
}

/* ---------------- Boot ---------------- */
document.addEventListener('DOMContentLoaded', ()=>{
  document.querySelectorAll('.nav-item').forEach(b=>{
    b.addEventListener('click', ()=> switchTab(b.dataset.tab));
  });
  document.getElementById('hamburgerBtn').addEventListener('click', ()=>{
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarBackdrop').classList.toggle('open');
  });
  document.getElementById('sidebarBackdrop').addEventListener('click', closeSidebarMobile);
  document.getElementById('fileImportInput').addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(file) importDBFromFile(file);
    e.target.value = '';
  });
  render();
});
