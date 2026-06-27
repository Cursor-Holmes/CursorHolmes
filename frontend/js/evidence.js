/* ===== evidence.js =====
   목격자가 증거물을 언급하면 현장(지도)에 하나씩 등장.
   기존 코드는 건드리지 않는 독립 모듈:
   - 증거물은 자체 Map(evidenceItems)으로 관리 → applyScene의 props culling 영향 없음
   - processStatement에서 applyEvidenceMention(sen) 1줄만 호출
   - 초기화 버튼은 addEventListener로 추가 hook (기존 onclick 유지) */

const evidenceItems = new Map();   // type -> THREE.Group

/* ── 증거물 키워드 정의 (먼저 매칭되는 것 우선) ── */
const EVIDENCE_DEFS = [
  {type:'knife',     name:'흉기(칼)',  re:/칼|흉기|식칼|단검|나이프|과도/},
  {type:'gun',       name:'총기',      re:/권총|엽총|총기|총을|총이|총으로|총 /},
  {type:'blood',     name:'혈흔',      re:/혈흔|핏자국|피자국|유혈/},
  {type:'phone',     name:'휴대폰',    re:/휴대폰|핸드폰|스마트폰|폰을|폰이|폰을 떨/},
  {type:'wallet',    name:'지갑',      re:/지갑/},
  {type:'money',     name:'현금',      re:/현금|지폐|돈다발|수표|돈을|돈이/},
  {type:'bottle',    name:'유리병',    re:/유리병|술병|소주병|맥주병|깨진 병|병이|병을/},
  {type:'cigarette', name:'담배꽁초',  re:/담배꽁초|꽁초|담배/},
  {type:'shoe',      name:'신발',      re:/신발|운동화|구두|슬리퍼/},
  {type:'key',       name:'열쇠',      re:/열쇠|차키|자동차 키|키뭉치/},
  {type:'glove',     name:'장갑',      re:/장갑/},
  {type:'shell',     name:'탄피',      re:/탄피|약협/},
  {type:'bag',       name:'유류품 가방', re:/버려진 가방|떨어진 가방|유류품/},
];

/* ── 증거물 3D 모델 (저폴리) ── */
const EVIDENCE_MODELS = {
  knife:()=>{const g=new THREE.Group();const bl=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.02,0.34),mat(0xcdd6e0,0.3,0.8));bl.position.set(0,0.02,0.16);g.add(bl);const hd=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.06,0.16),mat(0x222222,0.6));hd.position.set(0,0.03,-0.06);g.add(hd);return g;},
  gun:()=>{const g=new THREE.Group();const br=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.08,0.3),mat(0x33373d,0.4,0.6));br.position.set(0,0.09,0.05);g.add(br);const gp=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.18,0.09),mat(0x222426,0.5));gp.position.set(0,0.04,-0.11);gp.rotation.x=0.3;g.add(gp);return g;},
  phone:()=>{const g=new THREE.Group();const b=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.03,0.36),mat(0x111317,0.3,0.5));b.position.y=0.02;g.add(b);const sc=new THREE.Mesh(new THREE.PlaneGeometry(0.14,0.3),new THREE.MeshBasicMaterial({color:0x3b6ea5}));sc.rotation.x=-Math.PI/2;sc.position.y=0.036;g.add(sc);return g;},
  wallet:()=>{const g=new THREE.Group();const b=new THREE.Mesh(new THREE.BoxGeometry(0.24,0.07,0.18),mat(0x6a4a2a,0.6));b.position.y=0.035;g.add(b);return g;},
  money:()=>{const g=new THREE.Group();for(let i=0;i<4;i++){const n=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.014,0.16),mat(0x3a7d52,0.7));n.position.set(i*0.012,0.02+i*0.016,0);n.rotation.y=i*0.12;g.add(n);}return g;},
  bottle:()=>{const g=new THREE.Group();const b=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,0.3,12),mat(0x2f6f4f,0.2,0.4));b.position.y=0.15;g.add(b);const nk=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.06,0.12,10),mat(0x2f6f4f,0.2,0.4));nk.position.y=0.35;g.add(nk);return g;},
  cigarette:()=>{const g=new THREE.Group();const c=new THREE.Mesh(new THREE.CylinderGeometry(0.014,0.014,0.14,8),mat(0xeee4d0,0.7));c.rotation.z=Math.PI/2;c.position.y=0.014;g.add(c);const f=new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.015,0.04,8),mat(0xd2a14a,0.7));f.rotation.z=Math.PI/2;f.position.set(0.07,0.014,0);g.add(f);return g;},
  blood:()=>{const g=new THREE.Group();const main=new THREE.Mesh(new THREE.CircleGeometry(0.42,20),new THREE.MeshBasicMaterial({color:0x8a0f12,transparent:true,opacity:0.85}));main.rotation.x=-Math.PI/2;main.position.y=0.015;g.add(main);[[0.32,0.22,0.13],[-0.28,0.3,0.09],[0.12,-0.34,0.08]].forEach(([x,z,r])=>{const d=new THREE.Mesh(new THREE.CircleGeometry(r,12),new THREE.MeshBasicMaterial({color:0x8a0f12,transparent:true,opacity:0.8}));d.rotation.x=-Math.PI/2;d.position.set(x,0.015,z);g.add(d);});return g;},
  shoe:()=>{const g=new THREE.Group();const s=new THREE.Mesh(new THREE.BoxGeometry(0.13,0.08,0.3),mat(0xdddddd,0.6));s.position.y=0.04;g.add(s);const sole=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.03,0.32),mat(0x222222,0.7));sole.position.y=0.015;g.add(sole);return g;},
  key:()=>{const g=new THREE.Group();const ring=new THREE.Mesh(new THREE.TorusGeometry(0.06,0.014,8,16),mat(0xc9a227,0.3,0.7));ring.rotation.x=-Math.PI/2;ring.position.set(0,0.02,-0.09);g.add(ring);const sh=new THREE.Mesh(new THREE.BoxGeometry(0.025,0.014,0.18),mat(0xc9a227,0.3,0.7));sh.position.set(0,0.02,0.06);g.add(sh);return g;},
  glove:()=>{const g=new THREE.Group();const b=new THREE.Mesh(new THREE.BoxGeometry(0.15,0.05,0.22),mat(0x223a55,0.7));b.position.y=0.025;g.add(b);return g;},
  shell:()=>{const g=new THREE.Group();const c=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.07,10),mat(0xc9a227,0.3,0.8));c.rotation.z=Math.PI/2;c.position.y=0.025;g.add(c);return g;},
  bag:()=>{const g=new THREE.Group();const b=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.24,0.16),mat(0x6a4a2a,0.6));b.position.y=0.12;g.add(b);return g;},
};

/* ── 증거물 마커(노란 포렌식 표식 + 비콘 + 물품 + 라벨) ── */
function makeEvidenceMarker(num, name, type){
  const g = new THREE.Group();
  // 바닥 글로우 (크게 — 기본 줌에서도 보이게)
  const disc=new THREE.Mesh(new THREE.CircleGeometry(1.4,28),new THREE.MeshBasicMaterial({color:0xffd400,transparent:true,opacity:0.25}));
  disc.rotation.x=-Math.PI/2; disc.position.y=0.03; g.add(disc);
  // 비콘 기둥 (높고 밝게)
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.13,4.0,10),new THREE.MeshBasicMaterial({color:0xffd400,transparent:true,opacity:0.55}));
  beam.position.y=2.0; g.add(beam);
  // 비콘 상단 구 (포인트)
  const knob=new THREE.Mesh(new THREE.SphereGeometry(0.28,14,14),new THREE.MeshBasicMaterial({color:0xfff2a0}));
  knob.position.y=4.0; g.add(knob);
  // 노란 증거 표식 카드
  const card=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.35,0.1),mat(0xf5c842,0.5));
  card.position.set(0,1.7,0); g.add(card);
  // 물품 모델 (크게)
  const mk=EVIDENCE_MODELS[type];
  if(mk){ const it=mk(); it.scale.setScalar(6.5); g.add(it); }
  // 라벨
  const lbl=makeLabel('증거 '+num+' · '+name, '#f5c842');
  lbl.position.y=4.8; lbl.scale.set(5.4,1.5,1); g.add(lbl);
  return g;
}

/* ── 등장 애니메이션 (pop-in) ── */
function popInEvidence(group){
  group.scale.setScalar(0.01);
  const start=performance.now(), dur=420;
  (function step(){
    const k=Math.min(1,(performance.now()-start)/dur);
    const s=0.01+(1-0.01)*(1-Math.pow(1-k,3));   // easeOut
    group.scale.setScalar(s);
    if(map) map.triggerRepaint();
    if(k<1) requestAnimationFrame(step);
  })();
}

/* ── 증거물 하나 배치 ── */
function placeEvidence(type, name){
  if(!sceneGroup || evidenceItems.has(type)) return;
  const num = evidenceItems.size + 1;
  const i   = evidenceItems.size;
  const ang = 0.6 + i*1.0;
  const rad = 5.0 + (i%3)*2.2;
  const g = makeEvidenceMarker(num, name, type);
  g.position.set(Math.cos(ang)*rad, 0, Math.sin(ang)*rad);
  sceneGroup.add(g);
  evidenceItems.set(type, g);
  popInEvidence(g);
  if(typeof setStatus==='function') setStatus(`🔎 증거물 등장: ${name} (총 ${num}점)`, false, true);
}

/* ── 진술 → 증거물 감지 (processStatement에서 호출) ── */
function applyEvidenceMention(sentence){
  if(!sceneGroup || !sentence) return;
  let placed = false;
  for(const def of EVIDENCE_DEFS){
    if(evidenceItems.has(def.type)) continue;
    if(def.re.test(sentence)){ placeEvidence(def.type, def.name); placed = true; }
  }
  // 구체 품목은 없지만 '증거물/유류품' 같은 일반 언급
  if(!placed && /증거물|증거가|유류품|증거를/.test(sentence) && !evidenceItems.has('generic')){
    placeEvidence('generic', '증거물');
  }
}

/* ── 증거물 초기화 (기존 초기화 버튼에 additive hook) ── */
function clearEvidence(){
  evidenceItems.forEach(g=>{ if(sceneGroup) sceneGroup.remove(g); });
  evidenceItems.clear();
  if(map) map.triggerRepaint();
}
document.getElementById('resetBtn')?.addEventListener('click', clearEvidence);
