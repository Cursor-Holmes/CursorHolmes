/* ===== scene.js ===== */

/* fbS: keyword fallback scene state (선언 위치 — scene.js 상단) */
const fbS = {
  location:'street',
  entities:{},
  props:{},
  si:{height:'unknown', build:null, clothing_top:null, clothing_bottom:null, face:null, other:null}
};

/* ═══════════════════════════════════════════════
   BUILDING RECOLOR
═══════════════════════════════════════════════ */
const BUILDING_COLORS = {
  벽돌:0x9c5b4a, 적벽돌:0x9c5b4a, 붉은:0x9c5b4a,
  통유리:0x86a2bd, 유리:0x86a2bd,
  하얀:0xf4f7fa, 흰:0xf4f7fa, 하양:0xf4f7fa,
  검은:0x40454d, 검정:0x40454d, 회색:0x9aa3ad,
  파란:0x3f6fb0, 파랑:0x3f6fb0, 빨간:0xb1503f, 빨강:0xb1503f,
  노란:0xd8b24a, 갈색:0x7a5a3a, 베이지:0xd8cdb4, 초록:0x3f8f63, 주황:0xdb8a3c
};
function buildingColorFrom(t){ for(const k of Object.keys(BUILDING_COLORS)){ if(t.includes(k)) return BUILDING_COLORS[k]; } return null; }
function hexStr(n){ return '#'+(n>>>0).toString(16).padStart(6,'0').slice(-6); }

function centroidMeters(f){
  const o=SCENE_ORIGIN, gm=f.geometry; let coords;
  if(gm.type==='Polygon') coords=gm.coordinates[0];
  else if(gm.type==='MultiPolygon') coords=gm.coordinates[0][0];
  else return null;
  let lng=0,lat=0; coords.forEach(c=>{lng+=c[0];lat+=c[1];}); lng/=coords.length; lat/=coords.length;
  const mLat=111320, mLon=111320*Math.cos(o[1]*Math.PI/180);
  return {fid:f.id, ex:(lng-o[0])*mLon, nz:(lat-o[1])*mLat};
}
function pickBuildingFeature(t){
  if(!map || !map.getLayer('3d-buildings')) return null;
  const feats=map.queryRenderedFeatures({layers:['3d-buildings']});
  const cands=feats.map(centroidMeters).filter(c=>c && c.fid!=null);
  if(!cands.length) return null;
  if(/그 ?건물|아까 ?그|방금 ?그/.test(t) && lastBuildingFid!=null){ const mm=cands.find(c=>c.fid===lastBuildingFid); if(mm) return mm; }
  if(/왼쪽/.test(t))            return cands.slice().sort((a,b)=>a.ex-b.ex)[0];
  if(/오른쪽/.test(t))          return cands.slice().sort((a,b)=>b.ex-a.ex)[0];
  if(/앞|정면|건너편/.test(t))  return cands.slice().sort((a,b)=>b.nz-a.nz)[0];
  if(/뒤/.test(t))              return cands.slice().sort((a,b)=>a.nz-b.nz)[0];
  const pool=cands.filter(c=>!buildingState.has(c.fid)).length?cands.filter(c=>!buildingState.has(c.fid)):cands;
  return pool.slice().sort((a,b)=>(a.ex*a.ex+a.nz*a.nz)-(b.ex*b.ex+b.nz*b.nz))[0];
}
function applyBuildingMention(t){
  if(!/건물|빌딩|상가|타워|아파트|상점|가게|편의점|건너편|벽돌/.test(t)) return false;
  const sel=pickBuildingFeature(t); if(!sel) return false;
  const col=buildingColorFrom(t); const hex=col!=null?hexStr(col):'#c9a86a';
  map.setFeatureState({source:'composite',sourceLayer:'building',id:sel.fid},{color:hex});
  buildingState.set(sel.fid,hex); lastBuildingFid=sel.fid;
  return true;
}
function resetBuildingColors(){
  if(map && map.getLayer('3d-buildings')) map.removeFeatureState({source:'composite',sourceLayer:'building'});
  buildingState.clear(); lastBuildingFid=null;
}

/* 진술에서 지명 추출 → 자동 지오코딩(베스트에포트) */
function extractPlace(t){
  const m=t.match(/([가-힣A-Za-z0-9]{2,}(?:역|공원|사거리|교차로|시장|광장|대학교|대학|병원|타워|허브|호텔|터미널))/);
  return m?m[1]:null;
}

/* ═══════════════════════════════════════════════
   SCENE APPLY (피규어/소품 → three 커스텀 레이어)
═══════════════════════════════════════════════ */
function applyScene(s){
  if(!s) return;
  if(s.location) document.getElementById('locTag').textContent=LOC_NAMES[s.location]||s.location;
  const seenE=new Set(), seenP=new Set();
  (s.props||[]).forEach(p=>{
    seenP.add(p.id);
    if(!props.has(p.id)){
      const mk=PROP_MAKERS[p.kind]; if(!mk) return;
      const grp=p.kind==='crosswalk'?mk(p.width):mk(); grp.position.set(p.pos[0],0,p.pos[1]); grp.scale.set(.01,.01,.01);
      if(p.rotation!==undefined) grp.rotation.y=p.rotation;
      sceneGroup.add(grp); props.set(p.id,{group:grp,grew:false});
    }
    const rec=props.get(p.id);
    if(rec){
      rec.group.position.set(p.pos[0],rec.group.position.y,p.pos[1]);
      if(p.rotation!==undefined) rec.group.rotation.y=p.rotation;
    }
  });
  (s.entities||[]).forEach(e=>{
    seenE.add(e.id);
    let rec=entities.get(e.id);
    const kindColor=e.color||KIND_COLOR[e.kind]||'#9aa6b6';
    if(!rec){
      const figCfg={height_scale:e.height_scale||1.0,top_type:e.top_type,top_color:e.top_color,
        bottom_type:e.bottom_type,bottom_color:e.bottom_color,hat:e.hat,hat_color:e.hat_color,
        mask:e.mask,glasses:e.glasses,shoe_color:e.shoe_color,
        bag_type:e.bag_type||(e.holding==='bag'?'handbag':null),bag_color:e.bag_color,holding:e.holding};
      const group=makeFigure(figCfg);
      if(e.label) group.add(makeLabel(e.label,kindColor));
      group.position.set(e.pos[0],0,e.pos[1]); group.scale.set(.01,.01,.01);
      applyFigurePose(group,e.pose,e.height_scale||1.0,e.rotation);
      sceneGroup.add(group);
      rec={group,target:{x:e.pos[0],z:e.pos[1]},grew:false,id:e.id,kind:e.kind,label:e.label,color:kindColor,top_color:e.top_color||kindColor};
      entities.set(e.id,rec);
    }
    rec.target={x:e.pos[0],z:e.pos[1]};
    rec.kind=e.kind; rec.label=e.label; rec.color=kindColor; rec.top_color=e.top_color||kindColor;
    applyFigurePose(rec.group,e.pose,e.height_scale||1.0,e.rotation);
  });
  // 수동 배치 피규어(manual:true)는 AI 재분석 시에도 유지
  [...entities.keys()].forEach(id=>{const r=entities.get(id);if(!seenE.has(id)&&!r.manual){sceneGroup.remove(r.group);entities.delete(id);}});
  [...props.keys()].forEach(id=>{if(!seenP.has(id)){sceneGroup.remove(props.get(id).group);props.delete(id);}});
  if(map) map.triggerRepaint();
  updateMontage(s); refreshEntityList();
}
function clearScene(){
  entities.forEach(r=>sceneGroup&&sceneGroup.remove(r.group)); entities.clear();
  props.forEach(r=>sceneGroup&&sceneGroup.remove(r.group)); props.clear();
  document.getElementById('locTag').textContent='위치 미상';
}

/* ═══════════════════════════════════════════════
   KEYWORD FALLBACK
═══════════════════════════════════════════════ */
function kw(text){ return t=>new RegExp(t).test(text); }
function keywordScene(sentence, all){
  const t=all.toLowerCase(); const K=kw(t);
  if(K('편의점|슈퍼|마트')) fbS.location='store_front'; else if(K('골목')) fbS.location='alley';
  else if(K('주차장')) fbS.location='parking'; else if(K('공원')) fbS.location='park';
  else if(K('횡단보도|신호등')) fbS.location='crosswalk'; else if(K('카페|커피')) fbS.location='cafe';
  else if(K('지하철')) fbS.location='subway';
  function addProp(id,kind,pos){ if(!fbS.props[id]) fbS.props[id]={id,kind,pos}; }
  if(K('편의점|가게|슈퍼')) addProp('store','store',[0,-6]);
  if(K('가로등')) addProp('sl','streetlight',[-7,-2]);
  if(K('벤치')) addProp('bench','bench',[3,3]);
  if(K('횡단보도')) addProp('xwalk','crosswalk',[0,3]);
  if(K('자전거')) addProp('bike','bicycle',[3,0]);
  if(K('오토바이|모터')) addProp('moto','motorcycle',[4,1]);
  if(K('버스(?!정류)')) addProp('bus','bus',[5,0]);
  if(K('트럭|화물차')) addProp('truck','truck',[5,-1]);
  if(K('택시')) addProp('taxi','taxi',[4,-2]); else if(K('자동차|차량|차가|승용차')) addProp('car','car',[4,-2]);
  if(K('나무')) addProp('tree','tree',[-7,-5]);
  const si=fbS.si;
  if(K('키 큰|크고|장신')) si.height='tall'; else if(K('키 작|작고|단신')) si.height='short'; else if(K('보통 키|중간 키')) si.height='medium';
  // 상의/하의 컨텍스트 구분 색상 파싱
  const TOP_CTX='반팔|긴팔|나시|민소매|탱크탑|셔츠|티셔츠|티|후드|패딩|점퍼|자켓|재킷|코트|상의';
  const BOT_CTX='바지|청바지|하의|치마|스커트|반바지|쇼츠|레깅스';
  function ctxColor(text, ctxKw){
    const pairs=[['검은|검정|블랙','#1a1a1a'],['흰|하얀|흰색','#eeeeee'],['빨간|빨강','#cc2222'],
      ['파란|파랑','#2244cc'],['초록|녹색','#226622'],['노란|노랑','#ccaa00'],
      ['회색','#888888'],['갈색','#8b4513'],['주황|오렌지','#cc5500'],['보라','#662266'],
      ['남색','#1a2266'],['베이지|카키','#aa9966']];
    for(const [cp,hex] of pairs){
      if(new RegExp(`(${cp})색?\\s*(?:${ctxKw})`).test(text)) return hex;
    }
    return null;
  }
  let topType='long', topColor='#334466';
  if(K('나시|민소매|탱크탑')) topType='tank'; else if(K('반팔')) topType='short';
  // 상의 후드/패딩 고유 패턴 먼저
  if(K('검은 후드|검정 후드')){topColor='#1a1a1a';si.clothing_top='검은 후드티';}
  else if(K('흰 후드|하얀 후드')){topColor='#eeeeee';si.clothing_top='흰 후드티';}
  else if(K('회색 패딩')){topColor='#888888';si.clothing_top='회색 패딩';}
  else{
    const c=ctxColor(t, TOP_CTX);
    if(c){topColor=c; const nm=['','검은','흰','빨간','파란','초록','노란','회색','갈색','주황','보라','남색','베이지'][['#1a1a1a','#eeeeee','#cc2222','#2244cc','#226622','#ccaa00','#888888','#8b4513','#cc5500','#662266','#1a2266','#aa9966'].indexOf(c)+'1'.slice(0,-1)]||'';
      si.clothing_top=(topType==='short'?'반팔 상의':topType==='tank'?'민소매 상의':'긴팔 상의');}
    // 컨텍스트 없이 단독 색상 (fallback)
    else if(K('빨간|빨강')){topColor='#cc2222';si.clothing_top='빨간 상의';}
    else if(K('파란|파랑')&&!ctxColor(t,BOT_CTX)){topColor='#2244cc';si.clothing_top='파란 상의';}
    else if(K('흰|하얀')&&!ctxColor(t,BOT_CTX)){topColor='#dddddd';si.clothing_top='흰 상의';}
    else if(K('검은|검정|블랙')&&!ctxColor(t,BOT_CTX)){topColor='#1a1a1a';si.clothing_top='검은 상의';}
  }
  let botType='long_pants', botColor='#1a2244';
  if(K('짧은 치마|미니스커트')) botType='short_skirt'; else if(K('긴 치마|롱스커트')) botType='long_skirt'; else if(K('반바지|쇼츠|짧은 하의')) botType='shorts';
  {
    const c=ctxColor(t, BOT_CTX);
    if(c){botColor=c; si.clothing_bottom=(botType==='long_skirt'?'긴 치마':botType==='short_skirt'?'짧은 치마':botType==='shorts'?'반바지':'바지');}
    else if(K('청바지')){botColor='#1e44aa';si.clothing_bottom='청바지';}
    else if(K('검은 바지|검정 바지')){botColor='#111111';si.clothing_bottom='검은 바지';}
    else if(K('회색 바지')){botColor='#888888';si.clothing_bottom='회색 바지';}
    else if(K('베이지|카키')){botColor='#aa9966';si.clothing_bottom='베이지 바지';}
  }
  let hat=null,mask=false,glasses=null;
  if(K('캡모자|야구모자')) hat='cap'; else if(K('비니|털모자')) hat='beanie';
  if(K('마스크')){mask=true;si.face=(si.face||'')+' 마스크';}
  if(K('선글라스')) glasses='sunglasses'; else if(K('안경')) glasses='glasses';
  if(K('뚱뚱|통통')) si.build='통통한 체형'; else if(K('마른|날씬')) si.build='마른 체형'; else if(K('건장|근육')) si.build='건장한 체형';
  let shoeCol='#1a1a1a'; if(K('흰 신발|흰 운동화')) shoeCol='#eeeeee'; else if(K('빨간 신발')) shoeCol='#cc2222';
  function getPos(id,d){ return fbS.entities[id]?.pos || d; }
  // [수정됨] 인물의 "등장 여부"와 "이동/행동"은 누적 텍스트(t) 대신 이번 진술 문장(sentence)만으로 판단한다.
  // 기존엔 K(누적 텍스트)로 체크해서, 예전 진술에 있던 "도망쳤다" 같은 단어가 누적 텍스트에 영원히 남아
  // 그 이후의 모든 새 진술에서도 매번 다시 같은 이동을 반복 적용하는 버그가 있었음
  // (예: "남자가 편의점으로 돌아왔어요"만 말해도 피해자가 또 움직임).
  // [수정됨] 한국어는 주어를 자주 생략하므로("편의점에서 나와서…" = 주어는 직전 문장의 "남자"),
  // 이번 문장 하나만 보면 그런 연속 문장을 놓친다. 그렇다고 전체 누적을 보면 예전 버그(영원히 따라다니는 키워드)가
  // 재발하므로, "이번 문장 + 바로 직전 문장" 2개만 함께 보는 것으로 절충한다.
  fbS.recentSentences=(fbS.recentSentences||[]).concat([sentence]).slice(-2);
  const Ks=kw(fbS.recentSentences.join(' ').toLowerCase());
  // [추가됨] Kcur = 이번 문장만(직전 문장 제외) — "등장 여부"는 주어 생략 대응을 위해 Ks(윈도우)를 쓰지만,
  // "어떤 행동을 했는지/어디로 이동했는지"는 이번 문장에만 있는 동작 표현을 따라야 한다.
  // 안 그러면 직전 문장의 "들어가는" 같은 단어가 섞여서 정반대 행동("나오다")을 잘못 덮어쓴다.
  const Kcur=kw(sentence.toLowerCase());
  if(Ks('남자|남성|용의자|범인|도둑|강도|피의자')){
    let pos=getPos('sus',[-2,-2]);
    if(Kcur('골목.*뛰|뛰.*골목|골목.*도망|도주.*골목')) pos=[-9,5];
    else if(Kcur('주차장.*도망|차.*타고|도주.*차')) pos=[9,7];
    else if(Kcur('도망|달아나|탈주|도주|뛰어가|달려가')) pos=[-8,4];
    else if(Kcur('접근|다가|달려들')){ const v=fbS.entities['vic']; if(v) pos=[v.pos[0]-.8,v.pos[1]]; }
    else if(Kcur('끌고|잡아끌|강제로|납치|데려')){ const v=fbS.entities['vic']; if(v) pos=[v.pos[0]-.6,v.pos[1]-.6]; else pos=[-1,-3]; }
    else if(Kcur('때리|폭행|밀치|공격|치고')) { const v=fbS.entities['vic']; if(v) pos=[v.pos[0]-.5,v.pos[1]]; }
    else if(Kcur('나왔|나오|나가|나갔')) pos=[2,-4];   // [추가됨] 편의점/건물에서 "나오는" 동작 — 기존엔 이 패턴이 전혀 없었음
    else if(Kcur('가게.*들어|편의점.*들어|건물.*들어|돌아왔|돌아가')) pos=[0,-5];
    else if(Kcur('뒤.*따라|쫓아|추격')) { const v=fbS.entities['vic']; if(v) pos=[v.pos[0]-1,v.pos[1]-1]; }
    const hasBag=Kcur('가방.*빼앗|낚아채|탈취|훔쳐|뺐')?'handbag':(fbS.entities['sus']?.bag_type||null);
    fbS.entities['sus']={id:'sus',kind:'suspect',label:'용의자',color:topColor,height_scale:si.height==='tall'?1.3:si.height==='short'?0.8:1.0,pos,top_type:topType,top_color:topColor,bottom_type:botType,bottom_color:botColor,hat,mask,glasses,shoe_color:shoeCol,bag_type:hasBag};
  }
  if(Ks('여자|여성|피해자|아가씨')){
    const susHasBag=Kcur('가방.*빼앗|낚아채|탈취');
    let vicPos=getPos('vic',[2,-2]);
    const sus=fbS.entities['sus'];
    if(Kcur('도망|피해|달아나|비명|소리치|쓰러')) vicPos=[vicPos[0]+3,vicPos[1]+2];
    else if(Kcur('끌려|잡혀|붙잡혀')) { if(sus) vicPos=[sus.pos[0]+.5,sus.pos[1]+.5]; }
    fbS.entities['vic']={id:'vic',kind:'victim',label:'피해자',color:'#3ecfb4',height_scale:1.0,pos:vicPos,top_type:'short',top_color:'#3ecfb4',bottom_type:'long_pants',bottom_color:'#2244aa',hat:null,mask:false,glasses:null,shoe_color:'#333333',bag_type:(!susHasBag&&Kcur('가방'))?'handbag':(fbS.entities['vic']?.bag_type||null)};
  }
  if(Ks('경찰|형사|수사관')){
    fbS.entities['off']={id:'off',kind:'officer',label:'경찰',color:'#f5c842',height_scale:1.05,pos:getPos('off',[5,1]),top_type:'long',top_color:'#1a3a6a',bottom_type:'long_pants',bottom_color:'#1a2244',hat:null,mask:false,glasses:null,shoe_color:'#111111',bag_type:null};
  }
  if(Ks('목격자|할머니|행인|아저씨|보행자|시민')){
    fbS.entities['bys']={id:'bys',kind:'bystander',label:'목격자',color:'#7d90a8',height_scale:0.95,pos:getPos('bys',[-5,3]),top_type:'long',top_color:'#556677',bottom_type:'long_pants',bottom_color:'#334455',hat:null,mask:false,glasses:null,shoe_color:'#333333',bag_type:null};
  }
  return {location:fbS.location,entities:Object.values(fbS.entities),props:Object.values(fbS.props),key_event:sentence.slice(0,50),suspect_info:{...fbS.si},contradiction:null};
}

/* ═══════════════════════════════════════════════
   ENTITY LIST REFRESH (AI + 수동 배치 통합)
═══════════════════════════════════════════════ */
function refreshEntityList(){
  const items=[];
  entities.forEach(r=>items.push({kind:r.kind,label:r.label||r.id,color:r.color||KIND_COLOR[r.kind],top_color:r.top_color||KIND_COLOR[r.kind]}));
  updateEntityList(items);
}

/* 저장된 sceneEnts로 피규어 복원 — map style.load 후 호출 */
function restoreSceneEntities(sceneEnts){
  if(!sceneGroup || !sceneEnts || !sceneEnts.length) return;
  // 기존 엔티티 제거 (새 sceneGroup에 재부착)
  entities.forEach(r=>sceneGroup.remove(r.group));
  entities.clear();
  manualCount.suspect=0; manualCount.victim=0; manualCount.bystander=0; manualCount.officer=0;
  sceneEnts.forEach(e=>{
    const d=ROLE_DEFAULTS[e.kind]||ROLE_DEFAULTS.bystander;
    const kindColor=e.color||KIND_COLOR[e.kind]||'#9aa6b6';
    const group=makeFigure({top_type:d.top_type,top_color:e.top_color||d.top_color,
      bottom_type:d.bottom_type,bottom_color:d.bottom_color,shoe_color:d.shoe_color});
    group.add(makeLabel(e.label||d.label,kindColor));
    group.position.set(e.x,0,e.z);
    group.scale.set(FIGURE_SCALE,FIGURE_SCALE,FIGURE_SCALE); // 복원 시 즉시 표시
    sceneGroup.add(group);
    entities.set(e.id,{id:e.id,kind:e.kind,label:e.label,color:kindColor,
      top_color:e.top_color||kindColor,group,target:{x:e.x,z:e.z},grew:true,manual:!!e.manual});
    // manualCount 업데이트 (중복 ID 방지)
    const m=e.id&&e.id.match&&e.id.match(/_m_(\w+)_(\d+)/);
    if(m&&manualCount[m[1]]<parseInt(m[2])) manualCount[m[1]]=parseInt(m[2]);
  });
  refreshEntityList();
  if(map) map.triggerRepaint();
}

/* ═══════════════════════════════════════════════
   DIRECT PLACEMENT + DRAG REPOSITIONING
═══════════════════════════════════════════════ */
let placementMode=null;
const dragState={active:false,entity:null};
const manualCount={suspect:0,victim:0,bystander:0,officer:0};
const ROLE_DEFAULTS={
  suspect:  {label:'용의자',top_type:'long', top_color:'#1a1a1a',bottom_type:'long_pants', bottom_color:'#111111',shoe_color:'#111111'},
  victim:   {label:'피해자',top_type:'short',top_color:'#3ecfb4',bottom_type:'long_pants', bottom_color:'#2244aa',shoe_color:'#333333'},
  bystander:{label:'목격자',top_type:'long', top_color:'#556677',bottom_type:'long_pants', bottom_color:'#334455',shoe_color:'#333333'},
  officer:  {label:'경찰',  top_type:'long', top_color:'#1a3a6a',bottom_type:'long_pants', bottom_color:'#1a2244',shoe_color:'#111111'},
};

function lngLatToScene(lng,lat){
  const mLon=111320*Math.cos(SCENE_ORIGIN[1]*Math.PI/180);
  return [(lng-SCENE_ORIGIN[0])*mLon, -((lat-SCENE_ORIGIN[1])*111320)];
}
function sceneToLngLat(x,z){
  const mLon=111320*Math.cos(SCENE_ORIGIN[1]*Math.PI/180);
  return [SCENE_ORIGIN[0]+x/mLon, SCENE_ORIGIN[1]-z/111320];
}

function placeEntityOnMap(role,x,z){
  if(!sceneGroup){setStatus('지도 로딩 후 배치 가능합니다.',false);return;}
  const d=ROLE_DEFAULTS[role];
  manualCount[role]++;
  const n=manualCount[role];
  const id=`_m_${role}_${n}`;
  const label=d.label+(n>1?` ${n}`:'');
  const kindColor=KIND_COLOR[role];
  const group=makeFigure({kind:role,top_type:d.top_type,top_color:d.top_color,
    bottom_type:d.bottom_type,bottom_color:d.bottom_color,shoe_color:d.shoe_color});
  group.add(makeLabel(label,kindColor));
  group.position.set(x,0,z); group.scale.set(0.01,0.01,0.01);
  sceneGroup.add(group);
  entities.set(id,{id,kind:role,label,color:kindColor,top_color:d.top_color,group,target:{x,z},grew:false,manual:true});
  if(map) map.triggerRepaint();
  refreshEntityList();
  if(currentCase) saveCurrentCase(); // 직접 배치 즉시 저장
}

function enterPlacementMode(role){
  placementMode=role;
  document.querySelectorAll('.role-btn').forEach(b=>b.classList.toggle('active',b.dataset.role===role));
  document.getElementById('placeHint').style.display='block';
  if(map) map.getCanvas().style.cursor='crosshair';
}
function exitPlacementMode(){
  placementMode=null;
  document.querySelectorAll('.role-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('placeHint').style.display='none';
  if(map) map.getCanvas().style.cursor='';
}

document.querySelectorAll('.role-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const role=btn.dataset.role;
    if(placementMode===role) exitPlacementMode();
    else enterPlacementMode(role);
  });
});
document.addEventListener('keydown',e=>{if(e.key==='Escape') exitPlacementMode();});

function registerPlacementAndDrag(){
  // 클릭 → 배치
  map.on('click',e=>{
    if(!placementMode) return;
    const[x,z]=lngLatToScene(e.lngLat.lng,e.lngLat.lat);
    placeEntityOnMap(placementMode,x,z);
    exitPlacementMode();
  });

  // 드래그 → 위치 재조정
  const canvas=map.getCanvas();
  canvas.addEventListener('mousedown',e=>{
    if(placementMode||e.button!==0) return;
    const rect=canvas.getBoundingClientRect();
    const mx=e.clientX-rect.left, my=e.clientY-rect.top;
    let nearest=null, nearestDist=40;
    entities.forEach(rec=>{
      const[lng,lat]=sceneToLngLat(rec.group.position.x,rec.group.position.z);
      const pt=map.project([lng,lat]);
      const d=Math.hypot(pt.x-mx,pt.y-my);
      if(d<nearestDist){nearestDist=d;nearest=rec;}
    });
    if(nearest){
      dragState.active=true; dragState.entity=nearest;
      map.dragPan.disable(); map.dragRotate.disable();
      canvas.style.cursor='grabbing';
    }
  });
  canvas.addEventListener('mousemove',e=>{
    if(!dragState.active) return;
    const rect=canvas.getBoundingClientRect();
    const ll=map.unproject([e.clientX-rect.left,e.clientY-rect.top]);
    const[x,z]=lngLatToScene(ll.lng,ll.lat);
    dragState.entity.target={x,z};
    dragState.entity.group.position.set(x,0,z);
    map.triggerRepaint();
  });
  const stopDrag=()=>{
    if(!dragState.active) return;
    dragState.active=false; dragState.entity=null;
    map.dragPan.enable(); map.dragRotate.enable();
    if(map.getCanvas().style.cursor==='grabbing') map.getCanvas().style.cursor='';
    if(currentCase) saveCurrentCase(); // 드래그 후 위치 자동 저장
  };
  canvas.addEventListener('mouseup',stopDrag);
  canvas.addEventListener('mouseleave',stopDrag);

  // 더블클릭 → 피규어 삭제 (map.on 사용 — Mapbox dblclick 줌 이벤트보다 먼저 처리)
  map.on('dblclick',e=>{
    if(placementMode) return;
    const rect=canvas.getBoundingClientRect();
    const mx=e.originalEvent.clientX-rect.left, my=e.originalEvent.clientY-rect.top;
    let nearest=null, nearestDist=40;
    entities.forEach(rec=>{
      const[lng,lat]=sceneToLngLat(rec.group.position.x,rec.group.position.z);
      const pt=map.project([lng,lat]);
      const d=Math.hypot(pt.x-mx,pt.y-my);
      if(d<nearestDist){nearestDist=d;nearest=rec;}
    });
    if(nearest){
      e.preventDefault(); // 지도 줌인 방지
      if(confirm(`"${nearest.label||nearest.id}"을(를) 삭제하시겠습니까?`)){
        sceneGroup.remove(nearest.group);
        entities.delete(nearest.id);
        refreshEntityList();
        map.triggerRepaint();
        if(currentCase) saveCurrentCase();
        setStatus(`"${nearest.label||nearest.id}" 삭제됨`,false);
      }
    }
  });
}
