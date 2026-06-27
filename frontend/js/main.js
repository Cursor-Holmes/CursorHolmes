/* ===== main.js ===== */

/* TEXT INPUT */
const textIn=document.getElementById('textIn');
document.getElementById('sendBtn').onclick=()=>{const v=textIn.value;textIn.value='';processStatement(v);};
textIn.addEventListener('keydown',e=>{if(e.key==='Enter'){const v=textIn.value;textIn.value='';processStatement(v);}});

/* PLACE SEARCH */
const placeIn=document.getElementById('placeIn');
document.getElementById('loadBtn').onclick=()=>{ const v=placeIn.value.trim(); if(v) loadPlace(v).catch(err=>setStatus('검색 실패: '+err.message,false,false)); };
placeIn.addEventListener('keydown',e=>{ if(e.key==='Enter'){ const v=placeIn.value.trim(); if(v) loadPlace(v).catch(err=>setStatus('검색 실패: '+err.message,false,false)); }});

/* RESET */
document.getElementById('resetBtn').onclick=()=>{
  clearScene(); resetBuildingColors(); accumulated=""; lastAutoPlace=""; logEntries.length=0;
  Object.keys(fbS.entities).forEach(k=>delete fbS.entities[k]);
  Object.keys(fbS.props).forEach(k=>delete fbS.props[k]);
  fbS.location='street'; fbS.si={height:'unknown',build:null,clothing_top:null,clothing_bottom:null,face:null,other:null}; fbS.lastSubject=null; // [변경됨]
  witnesses.forEach(w=>w.statements=[]); timelineItems=[]; caseClock=null; // [변경됨] caseClock도 함께 리셋
  logEl.querySelectorAll('.entry').forEach(e=>e.remove());
  document.getElementById('timelineItems').innerHTML='<div class="tl-empty">진술이 추가되면 타임라인이 자동으로 생성됩니다</div>';
  document.getElementById('montageContent').innerHTML='<div class="montage-empty">진술을 입력하면 용의자 인상착의가 자동 추출됩니다</div>';
  document.getElementById('reportWrap').innerHTML='<div style="font-size:12px;color:var(--ink3);text-align:center;padding:32px 0;font-style:italic">진술 입력 후 보고서 생성 버튼을 누르세요</div>';
  setStatus("장면 초기화됨 (지도/건물 유지).",false);
};

/* SETTINGS */
const overlay=document.getElementById('settingsOverlay');
document.getElementById('settingsBtn').onclick=()=>overlay.style.display='flex';
document.getElementById('settingsClose').onclick=()=>overlay.style.display='none';
document.getElementById('settingsClose2').onclick=()=>overlay.style.display='none';
document.getElementById('saveApiKey').onclick=()=>{
  const newMapboxToken=document.getElementById('mapboxInput').value.trim();
  const newApiKey=document.getElementById('apiKeyInput').value.trim();
  // [변경됨] 비워두면 키 모드 해제(키워드 모드로 동작) — 예전엔 비워도 안 지워지는 버그가 있었음
  API_KEY=newApiKey;
  try{
    if(newApiKey) localStorage.setItem('recon_api_key',API_KEY);
    else localStorage.removeItem('recon_api_key'); // [추가됨]
  }catch(_){}
  const newSeoulKey=document.getElementById('seoulApiKeyInput').value.trim();
  SEOUL_API_KEY=newSeoulKey; // [변경됨] 같은 방식으로 비우면 삭제되게 통일
  try{
    if(newSeoulKey) localStorage.setItem('recon_seoul_api_key',SEOUL_API_KEY);
    else localStorage.removeItem('recon_seoul_api_key'); // [추가됨]
  }catch(_){}
  if(newMapboxToken && newMapboxToken!==MAPBOX_TOKEN){
    MAPBOX_TOKEN=newMapboxToken;
    try{localStorage.setItem('recon_mapbox_token',MAPBOX_TOKEN);}catch(_){}
    overlay.style.display='none';
    setStatus("지도 초기화 중…",true);
    if(currentCase) saveCurrentCase(); // 토큰 변경 전 현재 피규어 위치 저장
    if(map){map.remove();map=null;}
    initMap();
  } else {
    overlay.style.display='none';
    // [변경됨] 키 저장/삭제 상태를 메시지로 구분해서 표시
    setStatus(API_KEY?"API 키 저장됨 (AI 모드).":"API 키 삭제됨 — 키워드 모드로 동작합니다.",false,true);
  }
};
/* localStorage 복원 */
try{
  const mt=localStorage.getItem('recon_mapbox_token');
  if(mt){MAPBOX_TOKEN=mt;document.getElementById('mapboxInput').value=mt;}
  const ak=localStorage.getItem('recon_api_key');
  if(ak){API_KEY=ak;document.getElementById('apiKeyInput').value=ak;}
  const sk=localStorage.getItem('recon_seoul_api_key');
  if(sk){SEOUL_API_KEY=sk;document.getElementById('seoulApiKeyInput').value=sk;}
}catch(_){}
/* config.js 키 폴백 */
try{
  if(window.RECON_CONFIG){
    if(!MAPBOX_TOKEN && window.RECON_CONFIG.MAPBOX_TOKEN) MAPBOX_TOKEN=window.RECON_CONFIG.MAPBOX_TOKEN;
    if(!API_KEY      && window.RECON_CONFIG.ANTHROPIC_API_KEY) API_KEY=window.RECON_CONFIG.ANTHROPIC_API_KEY;
    if(!SEOUL_API_KEY && window.RECON_CONFIG.SEOUL_API_KEY) SEOUL_API_KEY=window.RECON_CONFIG.SEOUL_API_KEY;
  }
}catch(_){}

/* CAPTURE */
document.getElementById('captureBtn').onclick=()=>{ if(!map)return; map.triggerRepaint(); requestAnimationFrame(()=>{const link=document.createElement('a');link.download=`recon_${Date.now()}.png`;link.href=map.getCanvas().toDataURL('image/png');link.click();}); };

/* REPORT */
document.getElementById('genReportBtn').onclick=async()=>{
  if(!accumulated.trim()){setStatus("진술이 없습니다.",false);return;}
  setStatus("보고서 생성 중…",true);
  try{
    const r=await generateReport(accumulated);
    document.getElementById('reportWrap').innerHTML=`
      <div class="report-section"><h4>사건 개요</h4><p>${r.case_summary||'—'}</p></div>
      <div class="report-section"><h4>용의자 프로파일</h4><p>${r.suspect_profile||'정보 부족'}</p></div>
      <div class="report-section"><h4>사건 타임라인</h4><p>${formatReportTimeline(r.timeline)}</p></div>
      <div class="report-section"><h4>핵심 증거</h4><p>${(r.key_evidence||[]).map(e=>`• ${e}`).join('<br>')}</p></div>
      <div class="report-section"><h4>추가 수사 제언</h4><p>${(r.recommendation||'—').replace(/\n/g,'<br>')}</p></div>`;
    reportText=JSON.stringify(r,null,2);
    setStatus(r._apiNotice
      ? `보고서 생성 완료 (키워드 폴백 — ${r._apiNotice})`
      : '보고서 생성 완료', false, true);
    document.querySelector('[data-tab="report"]').click();
  }catch(err){setStatus("보고서 생성 실패: "+err.message,false,false);}
};
document.getElementById('copyReportBtn').onclick=()=>{ if(!reportText){setStatus("보고서를 먼저 생성하세요.",false);return;} navigator.clipboard.writeText(reportText).then(()=>setStatus("보고서 복사 완료!",false,true)); };

/* PRESETS */
const PRESETS=[
  {name:"증인 A 증언", steps:(()=>{
    const ROT=Math.PI/4;
    const c=Math.cos(ROT), s=Math.sin(ROT);
    const p=(x,z)=>[+(x*c+z*s-3).toFixed(2), +(-x*s+z*c-3).toFixed(2)];
    const _XW=p(-4,0);
    const XW=[+(_XW[0]-2).toFixed(2), _XW[1]];
    const XW_R=ROT+Math.PI/12-Math.PI/4-Math.PI/6-Math.PI/12-Math.PI/18-Math.PI/36-Math.PI/36-Math.PI/60;  // -50° → 시계 3° ≈ -53°
    const XW_W=3.5;                       // 너비 7m → 절반
    const CAR_R=Math.PI/6+100*Math.PI/180;  // 80° → 반시계 50° = 130°
    const VIC_R=Math.PI/12;
    const SL=p(-9,-4);
    const xw=()=>({id:"xwalk",kind:"crosswalk",pos:XW,rotation:XW_R,width:XW_W});
    const car=(x,z)=>{const q=p(x,z); return {id:"car",kind:"car",pos:[+(q[0]-0.5).toFixed(2), q[1]],rotation:CAR_R};};
    const vic=(x,z,extra)=>({id:"vic",kind:"victim",label:"피해자",color:"#3ecfb4",height_scale:1.0,
      pos:p(x,z),rotation:VIC_R,...extra});
    return [
    {line:"쇼핑백을 든 남자가 횡단보도를 건너고 있었어요.",
     scene:{location:"crosswalk",
       props:[xw(),{id:"sl",kind:"streetlight",pos:SL}],
       entities:[
         vic(-4,-2,{top_type:"long",top_color:"#336699",bottom_type:"long_pants",
          bottom_color:"#222222",hat:null,mask:false,glasses:null,shoe_color:"#333333",
          bag_type:"handbag",bag_color:"#dddddd"})
       ],
       suspect_info:{height:"unknown",build:null,clothing_top:null,clothing_bottom:null,face:null,other:null}}},
    {line:"갑자기 차가 돌진해서 피해자를 쳤고, 남자가 나동그라지면서 쇼핑백이 도로에 떨어졌어요.",
     scene:{location:"crosswalk",
       props:[xw(),car(-4,3),{id:"sl",kind:"streetlight",pos:SL}],
       entities:[
         vic(-4,0.3,{pose:'lying',top_type:"long",top_color:"#336699",bottom_type:"long_pants",
          bottom_color:"#222222",hat:null,mask:false,glasses:null,shoe_color:"#333333",
          bag_type:null,bag_color:null})
       ],
       suspect_info:{height:"unknown",build:null,clothing_top:null,clothing_bottom:null,face:null,other:null}}},
    {line:"차가 멈추더니 운전자가 내려서 쓰러진 피해자 쪽을 잠깐 쳐다봤어요. 40대 초반 남자였고, 회색 후드티에 청바지, 검은 야구모자를 쓰고 있었어요.",
     scene:{location:"crosswalk",
       props:[xw(),car(-4,2.5),{id:"sl",kind:"streetlight",pos:SL}],
       entities:[
         {id:"sus",kind:"suspect",label:"가해자",color:"#888888",height_scale:1.05,
          pos:p(-5.5,1),top_type:"long",top_color:"#888888",bottom_type:"long_pants",
          bottom_color:"#1e44aa",hat:"cap",hat_color:"#1a1a1a",mask:false,glasses:null,
          shoe_color:"#333333",bag_type:null},
         vic(-4,0.3,{pose:'lying',top_type:"long",top_color:"#336699",bottom_type:"long_pants",
          bottom_color:"#222222",hat:null,mask:false,glasses:null,shoe_color:"#333333",bag_type:null})
       ],
       suspect_info:{height:"medium",build:"보통 체형",clothing_top:"회색 후드티",clothing_bottom:"청바지",face:"각진 턱",other:"검은색 야구모자"}}},
    {line:"그러고는 바닥에 떨어진 쇼핑백을 집어들고 다시 차에 탔어요.",
     scene:{location:"crosswalk",
       props:[xw(),car(-4,2.5),{id:"sl",kind:"streetlight",pos:SL}],
       entities:[
         {id:"sus",kind:"suspect",label:"가해자",color:"#888888",height_scale:1.05,
          pos:p(-4.5,2),top_type:"long",top_color:"#888888",bottom_type:"long_pants",
          bottom_color:"#1e44aa",hat:"cap",hat_color:"#1a1a1a",mask:false,glasses:null,
          shoe_color:"#333333",bag_type:"handbag",bag_color:"#dddddd"},
         vic(-4,0.3,{pose:'lying',top_type:"long",top_color:"#336699",bottom_type:"long_pants",
          bottom_color:"#222222",hat:null,mask:false,glasses:null,shoe_color:"#333333",bag_type:null})
       ],
       suspect_info:{height:"medium",build:"보통 체형",clothing_top:"회색 후드티",clothing_bottom:"청바지",face:"각진 턱",other:"검은색 야구모자"}}},
    {line:"차가 피해자를 두고 그대로 가버렸어요.",
     scene:{location:"crosswalk",
       props:[xw(),car(-4,-8),{id:"sl",kind:"streetlight",pos:SL}],
       entities:[
         vic(-4,0.3,{pose:'lying',top_type:"long",top_color:"#336699",bottom_type:"long_pants",
          bottom_color:"#222222",hat:null,mask:false,glasses:null,shoe_color:"#333333",bag_type:null})
       ],
       suspect_info:{height:"medium",build:"보통 체형",clothing_top:"회색 후드티",clothing_bottom:"청바지",face:"각진 턱",other:"검은색 야구모자"}}}
  ];})()},
];
const presetsEl=document.getElementById('presets');
PRESETS.forEach((p,i)=>{const b=document.createElement('button');b.className='preset-btn';b.innerHTML=`<b>${String(i+1).padStart(2,'0')}.</b> ${p.name}`;b.onclick=()=>playPreset(p);presetsEl.appendChild(b);});
let playing=false;
async function playPreset(p){
  if(playing)return; playing=true; document.getElementById('resetBtn').onclick();
  setStatus("시나리오 재생 중…",true);
  for(const step of p.steps){
    addLog(step.line,false,witnesses[0].name); accumulated+=(accumulated?" ":"")+step.line;
    resolveStatementTime(step.line); // [추가됨] 시나리오 대사에서도 시간 표현 인식
    addTimelineItem(step.line,witnesses[0].name,step.scene); // [변경됨] 원본 step.scene을 그대로 저장 → 재생 장면과 100% 동일하게 재현됨
    applyBuildingMention(step.line); applyScene(step.scene); if(step.scene.suspect_info) updateMontage(step.scene);
    await new Promise(r=>setTimeout(r,2400));
  }
  setStatus("시나리오 재생 완료",false,true); playing=false;
}

/* 로그인 핸들러 */
document.getElementById('loginBtn').onclick=()=>{
  const name=document.getElementById('detName').value.trim();
  const badge=document.getElementById('detBadge').value.trim();
  if(!name){document.getElementById('detName').focus();return;}
  investigator={name,badge};
  persistInvestigator(investigator);
  document.getElementById('loginOverlay').style.display='none';
  document.getElementById('detBadgeDisplay').textContent=`${name} 수사관  ·  배지 #${badge}`;
  renderCaseList();
  document.getElementById('caseOverlay').style.display='flex';
};
document.getElementById('detName').onkeydown=e=>{if(e.key==='Enter')document.getElementById('detBadge').focus();};
document.getElementById('detBadge').onkeydown=e=>{if(e.key==='Enter')document.getElementById('loginBtn').click();};

/* 새 사건 생성 핸들러 */
/* 날짜 드롭다운 초기화 */
(()=>{
  const now=new Date();
  const sel=(id,opts,cur)=>{const s=document.getElementById(id);opts.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=String(v).padStart(2,'0');if(v===cur)o.selected=true;s.appendChild(o);});};
  const yrs=[]; for(let y=now.getFullYear()-5;y<=now.getFullYear()+1;y++) yrs.push(y);
  sel('cdYear',yrs,now.getFullYear());
  sel('cdMonth',[...Array(12)].map((_,i)=>i+1),now.getMonth()+1);
  sel('cdDay',[...Array(31)].map((_,i)=>i+1),now.getDate());
  sel('cdHour',[...Array(24)].map((_,i)=>i),now.getHours());
  sel('cdMin',[...Array(60)].map((_,i)=>i),Math.floor(now.getMinutes()/5)*5);
})();

document.getElementById('newCaseBtn').onclick=()=>{
  document.getElementById('newCaseForm').style.display='flex';
  document.getElementById('caseNameInput').focus();
};
document.getElementById('cancelCaseBtn').onclick=()=>{document.getElementById('newCaseForm').style.display='none';};
document.getElementById('createCaseBtn').onclick=()=>{
  const name=document.getElementById('caseNameInput').value.trim()||'새 사건';
  const g=id=>parseInt(document.getElementById(id).value);
  const incidentAt=new Date(g('cdYear'),g('cdMonth')-1,g('cdDay'),g('cdHour'),g('cdMin')).getTime();
  const id='CASE-'+String(Math.floor(Math.random()*9000)+1000);
  startApp({id,name,incidentAt,detective:investigator,createdAt:Date.now(),updatedAt:Date.now()},true);
};
document.getElementById('caseNameInput').onkeydown=e=>{if(e.key==='Enter')document.getElementById('createCaseBtn').click();};

/* ═══════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════ */
investigator=getStoredInvestigator();
if(investigator){
  document.getElementById('loginOverlay').style.display='none';
  document.getElementById('detBadgeDisplay').textContent=`${investigator.name} 수사관  ·  배지 #${investigator.badge}`;
  renderCaseList();
  document.getElementById('caseOverlay').style.display='flex';
}
