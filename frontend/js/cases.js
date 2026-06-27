/* ===== cases.js ===== */
function getStoredInvestigator(){try{return JSON.parse(localStorage.getItem('recon_investigator')||'null');}catch(_){return null;}}
function persistInvestigator(d){try{localStorage.setItem('recon_investigator',JSON.stringify(d));}catch(_){}}
function getAllCases(){try{return JSON.parse(localStorage.getItem('recon_cases')||'[]');}catch(_){return[];}}
function persistCases(arr){try{localStorage.setItem('recon_cases',JSON.stringify(arr));}catch(_){}}

function saveCurrentCase(){
  if(!currentCase) return;
  const sceneEnts=[];
  entities.forEach(r=>sceneEnts.push({id:r.id,kind:r.kind,label:r.label,color:r.color,
    top_color:r.top_color,x:r.group.position.x,z:r.group.position.z,manual:!!r.manual}));
  const saved=Object.assign({},currentCase,{
    updatedAt:Date.now(),
    location:{lngLat:[...SCENE_ORIGIN],name:document.getElementById('placeIn').value.trim()},
    witnesses:witnesses.map(w=>({id:w.id,name:w.name,statements:[...w.statements]})),
    accumulated,logEntries:[...logEntries],sceneEnts,
    timelineItems:JSON.parse(JSON.stringify(timelineItems)), // [추가됨] scene 포함 타임라인 전체를 그대로 저장 → 불러왔을 때도 "▶ 재현" 유지
    fbS:JSON.parse(JSON.stringify(fbS)),
  });
  const all=getAllCases();
  const i=all.findIndex(c=>c.id===currentCase.id);
  if(i>=0) all[i]=saved; else all.unshift(saved);
  persistCases(all); currentCase=saved;
}

function startApp(caseData, isNew){
  document.getElementById('loginOverlay').style.display='none';
  document.getElementById('caseOverlay').style.display='none';
  document.getElementById('appShell').style.display='flex';
  currentCase=caseData;
  document.getElementById('caseId').textContent=caseData.id;
  document.getElementById('hdrSub').textContent=`${investigator.name} 수사관  ·  ${caseData.name}`;
  renderWitnesses();
  initStmtTimeSelects(caseData.incidentAt||null);
  try{MAPBOX_TOKEN=localStorage.getItem('recon_mapbox_token')||'';}catch(_){}
  try{API_KEY=localStorage.getItem('recon_api_key')||'';}catch(_){}
  // config.js 값이 있으면 우선 적용 (localStorage보다 우선순위 낮음 — 설정창 수동 입력 우선)
  if(!MAPBOX_TOKEN && window.RECON_CONFIG?.MAPBOX_TOKEN) MAPBOX_TOKEN=window.RECON_CONFIG.MAPBOX_TOKEN;
  if(!API_KEY && window.RECON_CONFIG?.ANTHROPIC_API_KEY) API_KEY=window.RECON_CONFIG.ANTHROPIC_API_KEY;
  if(!GEMINI_API_KEY) try{GEMINI_API_KEY=localStorage.getItem('recon_gemini_key')||'';}catch(_){}
  if(!GEMINI_API_KEY && window.RECON_CONFIG?.GEMINI_API_KEY) GEMINI_API_KEY=window.RECON_CONFIG.GEMINI_API_KEY;
  if(!isNew) restoreCase(caseData);
  else document.getElementById('coordTag').textContent=SCENE_ORIGIN[1].toFixed(4)+', '+SCENE_ORIGIN[0].toFixed(4);
  if(MAPBOX_TOKEN){initMap();}
  else{setStatus("⚙ 설정에서 Mapbox 토큰을 입력하면 지도가 로드됩니다.",false);
    setTimeout(()=>{document.getElementById('settingsOverlay').style.display='flex';},400);}
}

function restoreCase(c){
  caseClock=null; // [추가됨] 불러온 사건은 사건 시각 드롭다운(initStmtTimeSelects 결과) 기준으로 새로 이어가도록 초기화
  witnesses.length=0;
  (c.witnesses||[{id:0,name:'증인 A',statements:[]}]).forEach(w=>witnesses.push(w));
  activeWitId=witnesses[0]?.id||0;
  accumulated=c.accumulated||'';
  logEntries.length=0;
  (c.logEntries||[]).forEach(e=>{logEntries.push(e);addLogDOM(e.text,e.witName,e.ts);});
  if(c.location?.name) document.getElementById('placeIn').value=c.location.name;
  if(c.location?.lngLat){SCENE_ORIGIN=[...c.location.lngLat];
    document.getElementById('coordTag').textContent=SCENE_ORIGIN[1].toFixed(4)+', '+SCENE_ORIGIN[0].toFixed(4);}
  if(c.fbS) try{Object.assign(fbS,JSON.parse(JSON.stringify(c.fbS)));}catch(_){}
  // [변경됨] 타임라인 복원 — scene이 포함된 저장본이면 그대로 복원(재현 버튼 유지),
  // 이 기능 추가 전에 저장된 옛 사건이면 logEntries 기반으로 재구성(scene 없이, 폴백)
  timelineItems.length=0;
  if(c.timelineItems && c.timelineItems.length){
    c.timelineItems.forEach(it=>timelineItems.push(it));
  } else {
    (c.logEntries||[]).forEach(e=>timelineItems.push({
      time:e.ts||'',
      event:(e.text||'').slice(0,60)+((e.text||'').length>60?'…':''),
      witness:e.witName||'',
      scene:null
    }));
  }
  renderTimeline();
  // 몽타주 복원 (저장된 fbS 기반)
  if(c.fbS&&c.fbS.si&&Object.values(c.fbS.si).some(v=>v&&v!=='unknown'&&v!==null)){
    try{updateMontage({suspect_info:c.fbS.si,entities:Object.values(c.fbS.entities||{})});}catch(_){}
  }
  renderWitnesses();
  setStatus(`사건 "${c.name}" 불러오기 완료`,false,true);
}

function renderCaseList(){
  const el=document.getElementById('caseListEl');
  const all=getAllCases();
  if(!all.length){el.innerHTML='<div class="case-empty">저장된 사건이 없습니다.<br>새 사건을 생성하여 시작하세요.</div>';return;}
  el.innerHTML=all.map(c=>`<div class="case-item" onclick="selectCase('${c.id}')">
    <div class="case-item-info">
      <div class="case-item-id">${c.id}</div>
      <div class="case-item-name">${c.name||'(이름 없음)'}</div>
      <div class="case-item-meta">${c.incidentAt?'사건 '+new Date(c.incidentAt).toLocaleString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})+' · ':''} ${c.detective?.name||''} 수사관 · 증인 ${(c.witnesses||[]).length}명</div>
    </div><div class="case-arrow">›</div></div>`).join('');
}
function selectCase(cid){const c=getAllCases().find(x=>x.id===cid);if(c)startApp(c,false);}
