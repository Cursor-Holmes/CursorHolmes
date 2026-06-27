/* ===== montage.js ===== */
let montageRenderer=null,montageScene=null,montageCamera=null;
let montageFigure=null,montageAutoRot=true,montageAnimId=null,montageAngle=0;
const MONTAGE_VIEWS={
  front:{angle:0},left:{angle:Math.PI/2},right:{angle:-Math.PI/2},back:{angle:Math.PI}
};
let currentViewAngle=0,targetViewAngle=0;

function initMontageRenderer(){
  const canvas=document.getElementById('montageCanvas');
  const w=canvas.clientWidth||340,h=canvas.clientHeight||240;
  canvas.width=w*(window.devicePixelRatio||1); canvas.height=h*(window.devicePixelRatio||1);
  montageScene=new THREE.Scene();
  montageCamera=new THREE.PerspectiveCamera(42,w/h,0.05,100);
  montageRenderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
  montageRenderer.setSize(w,h); montageRenderer.setPixelRatio(window.devicePixelRatio||1);
  montageRenderer.setClearColor(0x06090f,1);
  montageScene.add(new THREE.AmbientLight(0x8a9aaa,0.8));
  const key=new THREE.DirectionalLight(0xfff4e0,1.6); key.position.set(3,6,5); montageScene.add(key);
  const fill=new THREE.DirectionalLight(0x4466cc,0.5); fill.position.set(-4,2,3); montageScene.add(fill);
  const rim=new THREE.DirectionalLight(0xff6b35,0.45); rim.position.set(0,4,-5); montageScene.add(rim);
  const bot=new THREE.DirectionalLight(0x223344,0.3); bot.position.set(0,-3,2); montageScene.add(bot);
  const floor=new THREE.Mesh(new THREE.CylinderGeometry(1.4,1.4,0.025,32),
    new THREE.MeshStandardMaterial({color:0x0d1521,roughness:.9}));
  montageScene.add(floor);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1.4,0.04,8,48),
    new THREE.MeshStandardMaterial({color:0xff6b35,emissive:new THREE.Color(0xff6b35),emissiveIntensity:.6}));
  ring.rotation.x=Math.PI/2; ring.position.y=0.013; montageScene.add(ring);
  const bg=new THREE.Mesh(new THREE.CylinderGeometry(8,8,14,32,1,true),
    new THREE.MeshBasicMaterial({color:0x0a0e16,side:THREE.BackSide}));
  bg.position.y=7; montageScene.add(bg);
  montageCamera.position.set(0,1.3,5.2); montageCamera.lookAt(0,1.0,0);
  montageTick();
}
function montageTick(){
  montageAnimId=requestAnimationFrame(montageTick);
  if(!montageScene||!montageCamera||!montageRenderer) return;
  if(montageFigure){
    if(montageAutoRot){ montageAngle+=0.008; montageFigure.rotation.y=montageAngle; }
    else{ currentViewAngle+=(targetViewAngle-currentViewAngle)*0.12; montageFigure.rotation.y=currentViewAngle; }
  }
  montageRenderer.render(montageScene,montageCamera);
}
function setMontageView(viewName){
  montageAutoRot=false;
  const ab=document.getElementById('autoRotBtn'); if(ab) ab.classList.remove('active');
  document.querySelectorAll('.view-btn').forEach(b=>{
    b.classList.toggle('active',b.textContent.trim()==={front:'정면',left:'좌측면',right:'우측면',back:'후면'}[viewName]);
  });
  let diff=MONTAGE_VIEWS[viewName].angle-currentViewAngle;
  while(diff>Math.PI) diff-=Math.PI*2; while(diff<-Math.PI) diff+=Math.PI*2;
  targetViewAngle=currentViewAngle+diff;
}
function toggleMontageAuto(){
  montageAutoRot=!montageAutoRot;
  const btn=document.getElementById('autoRotBtn'); if(btn) btn.classList.toggle('active',montageAutoRot);
  document.querySelectorAll('.view-btn').forEach(b=>{if(b!==btn) b.classList.remove('active');});
  if(montageAutoRot) montageAngle=montageFigure?montageFigure.rotation.y:0;
}
function updateMontageFigure(entityData){
  if(!montageRenderer) initMontageRenderer();
  const el=document.getElementById('montageEmpty'); if(el) el.style.display='none';
  if(montageFigure){ montageScene.remove(montageFigure); montageFigure=null; }
  const fig=makeFigure({
    height_scale:entityData.height_scale||1.0,
    top_type:entityData.top_type,      top_color:entityData.top_color,
    bottom_type:entityData.bottom_type, bottom_color:entityData.bottom_color,
    hat:entityData.hat,                hat_color:entityData.hat_color,
    mask:entityData.mask,              glasses:entityData.glasses,
    shoe_color:entityData.shoe_color,
    bag_type:entityData.bag_type,      bag_color:entityData.bag_color,
  });
  fig.position.set(0,0,0);
  montageFigure=fig; montageScene.add(fig);
  if(!montageAutoRot) fig.rotation.y=currentViewAngle;
}

function updateMontage(sd){
  if(!sd.suspect_info) return; const si=sd.suspect_info;
  if(!Object.values(si).some(v=>v&&v!=='unknown'&&v!==null)) return;
  const sus=(sd.entities||[]).find(e=>e.kind==='suspect'); const col=sus?.top_color||sus?.color||'#888';
  const hv={tall:3,medium:2,short:1,unknown:0}[si.height]||0;
  document.getElementById('montageContent').innerHTML=`
    <div class="mont-row"><span class="key">키</span>
      <div class="height-bar">${[1,2,3].map(v=>`<div style="height:${v*12}px" class="${v<=hv?'hi':''}"></div>`).join('')}</div>
      <span style="font-family:var(--mono);font-size:11px;color:var(--ink2);margin-left:8px">${si.height==='tall'?'큰 키':si.height==='medium'?'보통':si.height==='short'?'작은 키':'미상'}</span></div>
    ${si.build?`<div class="mont-row"><span class="key">체형</span><span class="val">${si.build}</span></div>`:''}
    ${si.clothing_top?`<div class="mont-row"><span class="key">상의</span><span class="val">${si.clothing_top}</span><div class="swatch" style="background:${col}"></div></div>`:''}
    ${si.clothing_bottom?`<div class="mont-row"><span class="key">하의</span><span class="val">${si.clothing_bottom}</span></div>`:''}
    ${si.face?`<div class="mont-row"><span class="key">얼굴</span><span class="val">${si.face}</span></div>`:''}
    ${si.other?`<div class="mont-row"><span class="key">특징</span><span class="val">${si.other}</span></div>`:''}`;
  // 3D 피규어 업데이트
  if(sus) updateMontageFigure(sus);
  else updateMontageFigure({
    top_type:'long', top_color:col,
    bottom_type:'long_pants', bottom_color:'#1a2244'
  });
}
function updateEntityList(el){
  const div=document.getElementById('entityList');
  if(!el.length){div.innerHTML='아직 등록된 인물이 없습니다.';return;}
  div.innerHTML=el.map(e=>{const k={suspect:'용의자',victim:'피해자',bystander:'목격자',officer:'경찰'}[e.kind]||e.kind;
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
      <div style="width:10px;height:10px;border-radius:50%;background:${e.top_color||e.color||KIND_COLOR[e.kind]||'#888'};flex:none"></div>
      <span style="color:var(--ink);font-weight:600">${e.label||e.id}</span>
      <span style="color:var(--ink3);font-size:11px">${k}</span></div>`;}).join('');
}
