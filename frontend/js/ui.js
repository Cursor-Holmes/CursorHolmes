/* ===== ui.js ===== */
const logEl=document.getElementById('log');
function fmtTs(d){
  d=d||new Date();
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function getStmtTs(){
  const g=id=>parseInt(document.getElementById(id)?.value||0);
  const now=new Date();
  return `${g('stmtMonth')||now.getMonth()+1}/${g('stmtDay')||now.getDate()} ${String(g('stmtHour')).padStart(2,'0')}:${String(g('stmtMin')).padStart(2,'0')}`;
}
function initStmtTimeSelects(baseDate){
  const d=baseDate?new Date(baseDate):new Date();
  function fill(id,vals,cur){
    const s=document.getElementById(id); if(!s) return;
    s.innerHTML='';
    vals.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=String(v).padStart(2,'0');if(v===cur)o.selected=true;s.appendChild(o);});
  }
  fill('stmtMonth',[...Array(12)].map((_,i)=>i+1),d.getMonth()+1);
  fill('stmtDay',[...Array(31)].map((_,i)=>i+1),d.getDate());
  fill('stmtHour',[...Array(24)].map((_,i)=>i),d.getHours());
  fill('stmtMin',[...Array(60)].map((_,i)=>i),Math.floor(d.getMinutes()/5)*5);
}
function addLogDOM(text,witName,ts){
  const el=document.createElement('div'); el.className='entry';
  const wt=witName?`<span class="wit-tag">${witName}</span>`:'';
  el.innerHTML=`<span class="t">${ts||fmtTs()}</span>${wt}${text}`;
  logEl.appendChild(el); logEl.scrollTop=logEl.scrollHeight;
}
function addLog(text,interim,witName){
  if(interim){
    let el=document.getElementById('interimEntry');
    if(!el){el=document.createElement('div');el.id='interimEntry';el.className='entry interim';logEl.appendChild(el);}
    el.innerHTML='<span class="t">인식 중…</span>'+text;
  } else {
    const old=document.getElementById('interimEntry'); if(old) old.remove();
    const ts=getStmtTs();
    logEntries.push({text,ts,witName:witName||''});
    addLogDOM(text,witName,ts);
  }
  logEl.scrollTop=logEl.scrollHeight;
}
// [변경됨] knownScene 파라미터 추가 + scene을 저장하고 item 참조를 반환 (호출부에서 나중에 scene을 채울 수 있도록)
function addTimelineItem(text,witName,knownScene){
  const ts=getStmtTs();
  const item={time:ts,event:text.slice(0,60)+(text.length>60?'…':''),witness:witName,scene:knownScene||null};
  timelineItems.push(item);
  renderTimeline();
  return item;   // [추가됨] 호출부에서 나중에 item.scene을 채울 수 있도록 참조 반환
}
// [변경됨] scene이 있는 항목은 클릭 가능하게 표시하고, 클릭 시 그 시점 장면을 재현
function renderTimeline(){
  const wrap=document.getElementById('timelineItems');
  if(!timelineItems.length){wrap.innerHTML='<div class="tl-empty">진술이 추가되면 타임라인이 자동으로 생성됩니다</div>';return;}
  wrap.innerHTML=timelineItems.map((item,i)=>`
    <div class="tl-item ${item.scene?'tl-clickable':''}" data-idx="${i}" title="${item.scene?'클릭하면 이 진술 시점의 장면을 재현합니다':'장면 분석 중…'}"><div style="display:flex;flex-direction:column;align-items:center">
      <div class="tl-dot ${i<timelineItems.length-1?'past':''}"></div>
      ${i<timelineItems.length-1?'<div class="tl-line" style="flex:1;min-height:24px"></div>':''}
    </div><div class="tl-info"><div class="tl-time">🕐 ${item.time}</div>
    <div class="tl-event">${item.event}</div><div class="tl-wit">${item.witness}${item.scene?' · ▶ 재현':''}</div></div></div>`).join('');
  // [추가됨] 타임라인 클릭 → 그 시점 장면으로 재현
  wrap.querySelectorAll('.tl-clickable').forEach(el=>{
    el.onclick=()=>{
      const item=timelineItems[+el.dataset.idx];
      if(!item || !item.scene) return;
      applyScene(item.scene);
      if(item.scene.suspect_info) updateMontage(item.scene);
      setStatus(`타임라인 재현 · ${item.witness} · ${item.time}`,false,true);
    };
  });
}
function showContradiction(text){
  setStatus("⚠ 모순 감지: "+text,false,false);
  const wrap=document.getElementById('reportWrap');
  const box=document.createElement('div'); box.className='contradiction-box';
  box.innerHTML=`<div class="lbl">⚠ 모순 감지</div>${text}`; wrap.prepend(box); setTimeout(()=>box.remove(),8000);
}
function setStatus(txt,busy,ok){
  document.getElementById('statusTxt').textContent=txt;
  document.getElementById('statusBar').classList.toggle('busy',!!busy);
  const pill=document.getElementById('statPill');
  if(busy){pill.textContent='PROCESSING';pill.className='stat-pill';}
  else if(ok===true){pill.textContent='LIVE';pill.className='stat-pill ok';}
  else if(ok===false){pill.textContent='WARN';pill.className='stat-pill warn';}
  else{pill.textContent='READY';pill.className='stat-pill ok';}
}

/* ════════════════════════════════════════════════════════
   [추가됨] 사건 시각 자동 추출 (절대/상대 표현) — 진술 입력 시 드롭다운을 자동으로 채워줌.
   사용자가 드롭다운을 직접 조작하면 그 값이 우선되며, 이 함수는 "보조 추천"으로만 동작.
   ════════════════════════════════════════════════════════ */
// [추가됨] "오후 3시", "15:20" 같은 절대 시각 표현 인식
function extractIncidentTime(text){
  if(/자정/.test(text)) return {h:0,m:0};
  if(/정오/.test(text)) return {h:12,m:0};
  const m2=text.match(/(오전|오후|새벽|저녁|밤|아침)?\s?(\d{1,2})\s?시\s?(반)?\s?(\d{1,2}\s?분)?/);
  if(m2){
    let period=m2[1], h=parseInt(m2[2],10);
    let min = m2[3] ? 30 : (m2[4] ? parseInt(m2[4],10) : 0);
    if(h>=1&&h<=12){
      if(period==='오후'||period==='저녁'||period==='밤'){ if(h<12) h+=12; }
      else if(period==='오전'||period==='새벽'||period==='아침'){ if(h===12) h=0; }
    }
    if(h<0||h>23) return null;
    return {h,m:min};
  }
  const m3=text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if(m3) return {h:parseInt(m3[1],10),m:parseInt(m3[2],10)};
  return null;
}
// [추가됨] "10분쯈 지나서", "5분 후", "1분도 안 돼서", "바로/그러고는" 같은 상대 시간 표현 → 분 단위 오프셋
function extractRelativeMinutes(text){
  let m=text.match(/(\d+)\s*분\s*(쯈|쯔음|정도|가량)?\s*(이?\s*지나서|뒤에|후에|만에)/);
  if(m) return parseInt(m[1],10);
  m=text.match(/(\d+)\s*분도\s*(채\s*)?안\s*(되|돼|지나)/);
  if(m) return 0;
  if(/잠시\s*후|곧이어|이어서|바로|즉시|그러고는|그\s*직후/.test(text)) return 0;
  return null;
}
// [추가됨] 사건 진행 시계 — 진술이 추가될 때마다 이어진다 (사건 시각 드롭다운의 현재 값을 출발점으로 사용)
let caseClock = null;
// [추가됨] 사건 시각 드롭다운 4개 값을 Date로 합쳐서 읽기
function getStmtDate(){
  const g=id=>parseInt(document.getElementById(id)?.value||0);
  const now=new Date();
  return new Date(now.getFullYear(), g('stmtMonth')-1||now.getMonth(), g('stmtDay')||now.getDate(), g('stmtHour')||0, g('stmtMin')||0);
}
// [추가됨] 추출/계산된 시각을 사건 시각 드롭다운에 다시 써넣기 (추천값 표시)
function setStmtDate(d){
  const set=(id,v)=>{const el=document.getElementById(id); if(el) el.value=v;};
  set('stmtMonth', d.getMonth()+1); set('stmtDay', d.getDate()); set('stmtHour', d.getHours()); set('stmtMin', d.getMinutes());
}
// [추가됨] 진술 텍스트에서 절대/상대 시간을 분석해 사건 시각을 결정하고, 드롭다운에 자동 반영
function resolveStatementTime(text){
  // [수정됨] 이전엔 caseClock을 드롭다운보다 우선시해서, 두 번째 진술부터는 사용자가 직접 바꾼
  // "사건 시각" 드롭다운 값이 무시되는 버그가 있었음. 이제는 드롭다운의 현재값을 항상 기준(base)으로 쓴다 —
  // 절대 시각 표현이면 그 시:분으로 덮어쓰고, 상대 표현("10분쯈 지나서")이면 그 기준에서 흘려보내고,
  // 아무 표현도 없으면 드롭다운 값을 그대로 사용한다.
  const base = getStmtDate();   // 사용자가 지금 드롭다운에 설정해둔 값을 최우선으로 사용
  const abs = extractIncidentTime(text);
  let result;
  if(abs){
    result = new Date(base); result.setHours(abs.h, abs.m, 0, 0);
  } else {
    const rel = extractRelativeMinutes(text);
    result = (rel!=null) ? new Date(base.getTime()+rel*60000) : base;
  }
  caseClock = result;     // (참고용 — 초기화 시 리셋되는 값일 뿐, 더 이상 기준값으로 쓰이지 않음)
  setStmtDate(result);    // 드롭다운에 결과 반영 (필요하면 사용자가 다시 직접 조정 가능)
  return result;
}


const witnessRow=document.getElementById('witnessRow'); const addWitBtn=document.getElementById('addWitBtn');
function renderWitnesses(){
  witnessRow.querySelectorAll('.wit-chip:not(.add)').forEach(e=>e.remove());
  witnesses.forEach(w=>{
    const chip=document.createElement('button');
    chip.className='wit-chip'+(w.id===activeWitId?' active':'');
    chip.textContent=w.name; chip.title='더블클릭으로 이름 변경';
    chip.onclick=e=>{if(e.detail>=2)return; activeWitId=w.id;renderWitnesses();};
    chip.ondblclick=e=>{
      e.stopPropagation();
      const inp=document.createElement('input'); inp.type='text'; inp.value=w.name;
      inp.className='wit-chip-input'; chip.replaceWith(inp); inp.focus(); inp.select();
      const commit=()=>{w.name=inp.value.trim()||w.name; renderWitnesses(); if(currentCase) saveCurrentCase();};
      inp.onblur=commit;
      inp.onkeydown=ev=>{if(ev.key==='Enter'){ev.preventDefault();commit();}if(ev.key==='Escape')renderWitnesses();};
    };
    witnessRow.insertBefore(chip,addWitBtn);
  });
  document.getElementById('witCount').textContent=`증인 ${witnesses.length}명`;
}
addWitBtn.onclick=()=>{
  const names=['A','B','C','D','E','F'];
  const id=Date.now();
  witnesses.push({id,name:`증인 ${names[witnesses.length]||witnesses.length+1}`,statements:[]});
  activeWitId=id; renderWitnesses();
  // 추가 직후 바로 이름 편집 모드 진입
  const chips=witnessRow.querySelectorAll('.wit-chip:not(.add)');
  const last=chips[chips.length-1]; if(last) last.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));
};

/* TABS */
document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.onclick=()=>{
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
    if(btn.dataset.tab==='montage'){
      requestAnimationFrame(()=>{
        const canvas=document.getElementById('montageCanvas');
        const w=canvas.clientWidth||340,h=canvas.clientHeight||240;
        const dpr=window.devicePixelRatio||1;
        if(canvas.width!==w*dpr||canvas.height!==h*dpr){
          canvas.width=w*dpr; canvas.height=h*dpr;
          if(montageRenderer) montageRenderer.setSize(w,h);
          if(montageCamera){ montageCamera.aspect=w/h; montageCamera.updateProjectionMatrix(); }
        }
        if(!montageRenderer) initMontageRenderer();
      });
    }
  };
});
