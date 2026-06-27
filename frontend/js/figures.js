/* ===== figures.js ===== */
const SKIN = 0xe2cdb0;
function hi(hex){ return parseInt((hex||'#888888').replace('#',''),16); }
function mat(color,rough=0.7,metal=0){ return new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal}); }
function addTube(g,x1,y1,z1,x2,y2,z2,r,col){
  const dx=x2-x1,dy=y2-y1,dz=z2-z1; const len=Math.sqrt(dx*dx+dy*dy+dz*dz);
  if(len<0.001) return;
  const tube=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,6),mat(col,0.4,0.3));
  tube.position.set((x1+x2)/2,(y1+y2)/2,(z1+z2)/2);
  tube.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(dx/len,dy/len,dz/len));
  g.add(tube);
}

function makeFigure(cfg={}){
  const g  = new THREE.Group();
  const h  = cfg.height_scale || 1.0;
  const topCol  = hi(cfg.top_color)    || 0x334466;
  const botCol  = hi(cfg.bottom_color) || 0x1a2244;
  const shoeCol = hi(cfg.shoe_color)   || 0x1a1a1a;
  const hatCol  = hi(cfg.hat_color)    || 0x222222;
  const bagCol  = hi(cfg.bag_color)    || 0xaa8833;
  const topType = cfg.top_type    || 'long';
  const botType = cfg.bottom_type || 'long_pants';
  [-1,1].forEach(s=>{
    const shoe=new THREE.Mesh(new THREE.BoxGeometry(0.17*h,0.1*h,0.32*h),mat(shoeCol,0.5));
    shoe.position.set(s*0.16*h,0.05*h,0.05*h); g.add(shoe);
  });
  if(botType==='long_skirt'){
    const sk=new THREE.Mesh(new THREE.CylinderGeometry(0.3*h,0.42*h,0.72*h,16),mat(botCol));
    sk.position.y=0.46*h; g.add(sk);
  } else if(botType==='short_skirt'){
    const sk=new THREE.Mesh(new THREE.CylinderGeometry(0.28*h,0.38*h,0.3*h,16),mat(botCol));
    sk.position.y=0.67*h; g.add(sk);
    [-1,1].forEach(s=>{
      const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.1*h,0.09*h,0.5*h,8),mat(SKIN));
      leg.position.set(s*0.16*h,0.27*h,0); g.add(leg);
    });
  } else {
    const upperMat=mat(botCol), lowerMat=botType==='shorts'?mat(SKIN):mat(botCol);
    [-1,1].forEach(s=>{
      const ul=new THREE.Mesh(new THREE.CylinderGeometry(0.14*h,0.12*h,0.32*h,8),upperMat.clone());
      ul.position.set(s*0.16*h,0.62*h,0); g.add(ul);
      const ll=new THREE.Mesh(new THREE.CylinderGeometry(0.11*h,0.10*h,0.38*h,8),lowerMat.clone());
      ll.position.set(s*0.16*h,0.24*h,0); g.add(ll);
    });
  }
  const torso=new THREE.Mesh(new THREE.BoxGeometry(0.56*h,0.54*h,0.3*h),mat(topCol));
  torso.position.y=1.07*h; g.add(torso);
  [-1,1].forEach(s=>{
    const uMat = topType==='tank' ? mat(SKIN) : mat(topCol);
    const lMat = topType==='long' ? mat(topCol) : mat(SKIN);
    const ua=new THREE.Mesh(new THREE.CylinderGeometry(0.1*h,0.09*h,0.3*h,8),uMat.clone());
    ua.position.set(s*0.36*h,1.1*h,0); ua.rotation.z=s*0.28; g.add(ua);
    const la=new THREE.Mesh(new THREE.CylinderGeometry(0.085*h,0.08*h,0.28*h,8),lMat.clone());
    la.position.set(s*0.44*h,0.82*h,0); la.rotation.z=s*0.18; g.add(la);
    const hd=new THREE.Mesh(new THREE.SphereGeometry(0.085*h,8,8),mat(SKIN));
    hd.position.set(s*0.49*h,0.66*h,0); g.add(hd);
  });
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.1*h,0.11*h,0.18*h,8),mat(SKIN));
  neck.position.y=1.42*h; g.add(neck);
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.28*h,16,16),mat(SKIN));
  head.position.y=1.72*h; g.add(head);
  if(cfg.hat==='cap'){
    const crown=new THREE.Mesh(new THREE.CylinderGeometry(0.27*h,0.3*h,0.22*h,14),mat(hatCol));
    crown.position.y=2.04*h; g.add(crown);
    const brim=new THREE.Mesh(new THREE.CylinderGeometry(0.43*h,0.43*h,0.05*h,16),mat(hatCol));
    brim.position.set(0.06*h,1.94*h,0.1*h); g.add(brim);
  } else if(cfg.hat==='beanie'){
    const bn=new THREE.Mesh(new THREE.SphereGeometry(0.32*h,16,12,0,Math.PI*2,0,Math.PI*0.62),mat(hatCol));
    bn.position.y=1.82*h; g.add(bn);
    const band=new THREE.Mesh(new THREE.CylinderGeometry(0.31*h,0.31*h,0.1*h,14),mat(hatCol,0.8));
    band.position.y=1.67*h; g.add(band);
  }
  if(cfg.mask){
    const mk=new THREE.Mesh(new THREE.BoxGeometry(0.46*h,0.22*h,0.13*h),mat(0xeeeeee,0.5));
    mk.position.set(0,1.58*h,0.22*h); g.add(mk);
  }
  if(cfg.glasses){
    const gc=cfg.glasses==='sunglasses'?0x111111:0xbbbbbb;
    const gm=mat(gc,0.3,cfg.glasses==='sunglasses'?0.1:0.7);
    [-0.13,0.13].forEach(x=>{
      const lens=new THREE.Mesh(new THREE.TorusGeometry(0.09*h,0.015*h,8,16),gm.clone());
      lens.position.set(x*h,1.74*h,0.26*h); g.add(lens);
      if(cfg.glasses==='sunglasses'){
        const fill=new THREE.Mesh(new THREE.CircleGeometry(0.09*h,16),mat(0x111111,0.2));
        fill.position.set(x*h,1.74*h,0.261*h); g.add(fill);
      }
    });
  }
  const bagType = cfg.bag_type || (cfg.holding==='bag'?'handbag':null);
  if(bagType){
    const bm=mat(bagCol,0.6);
    if(bagType==='backpack'){
      const bp=new THREE.Mesh(new THREE.BoxGeometry(0.42*h,0.5*h,0.22*h),bm.clone());
      bp.position.set(0,1.05*h,-0.27*h); g.add(bp);
    } else if(bagType==='crossbody'){
      const cb=new THREE.Mesh(new THREE.BoxGeometry(0.26*h,0.22*h,0.1*h),bm.clone());
      cb.position.set(0.44*h,0.9*h,0.04*h); g.add(cb);
      const st=new THREE.Mesh(new THREE.BoxGeometry(0.04*h,0.58*h,0.03*h),bm.clone());
      st.position.set(0.28*h,1.12*h,0); st.rotation.z=-0.36; g.add(st);
    } else {
      const hb=new THREE.Mesh(new THREE.BoxGeometry(0.28*h,0.24*h,0.14*h),bm.clone());
      hb.position.set(0.48*h,0.74*h,0); g.add(hb);
    }
  }
  const sh=new THREE.Mesh(new THREE.CircleGeometry(0.5*h,20),new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.25}));
  sh.rotation.x=-Math.PI/2; sh.position.y=0.02; g.add(sh);
  return g;
}

function applyFigurePose(group, pose, h, rotY){
  const lying=pose==='lying'||pose==='fallen';
  group.rotation.order='YXZ';
  if(rotY!==undefined) group.rotation.y=rotY;
  group.rotation.x=lying?Math.PI/2:0;
  group.rotation.z=0;
  group.position.y=lying?0.14*(h||1):0;
}

/* ── PROPS / VEHICLES ── */
function makeStore(){const g=new THREE.Group();const b=new THREE.Mesh(new THREE.BoxGeometry(5,3.2,3.4),mat(0x1e2d3d,0.9));b.position.y=1.6;g.add(b);const sign=new THREE.Mesh(new THREE.BoxGeometry(5.1,0.65,0.18),mat(0x3ecfb4,0.4));sign.position.set(0,3.0,1.75);g.add(sign);const door=new THREE.Mesh(new THREE.BoxGeometry(1.2,2.1,0.1),mat(0x0d1520,0.9));door.position.set(0,1.05,1.72);g.add(door);return g;}
function makeCar(color=0x2e3f58){const g=new THREE.Group();const m=mat(color,0.45,0.35);const base=new THREE.Mesh(new THREE.BoxGeometry(3.7,0.9,1.75),m.clone());base.position.y=0.7;g.add(base);const top=new THREE.Mesh(new THREE.BoxGeometry(2.1,0.8,1.55),m.clone());top.position.set(-0.1,1.4,0);g.add(top);const wm=mat(0x111418,0.5);[[1.1,.72],[1.1,-.72],[-1.1,.72],[-1.1,-.72]].forEach(([x,z])=>{const wn=new THREE.Mesh(new THREE.CylinderGeometry(.38,.38,.28,14),wm.clone());wn.rotation.x=Math.PI/2;wn.position.set(x,.42,z);g.add(wn);});return g;}
function makeTaxi(){const g=makeCar(0xe8c030);const sign=new THREE.Mesh(new THREE.BoxGeometry(0.56,0.22,0.28),mat(0x111111,0.5));sign.position.set(0,2.04,0);g.add(sign);return g;}
function makeTree(){const g=new THREE.Group();const tr=new THREE.Mesh(new THREE.CylinderGeometry(.16,.22,1.4,8),mat(0x4a3826,0.9));tr.position.y=.7;g.add(tr);const lf=new THREE.Mesh(new THREE.ConeGeometry(1.0,2.1,10),mat(0x2a5230,0.8));lf.position.y=2.2;g.add(lf);return g;}
function makeStreetlight(){const g=new THREE.Group();const p=new THREE.Mesh(new THREE.CylinderGeometry(.07,.1,4,8),mat(0x3a454f,0.5,0.3));p.position.y=2;g.add(p);const lamp=new THREE.Mesh(new THREE.SphereGeometry(.26,12,12),mat(0xffe9a0,0.4));lamp.material.emissive=new THREE.Color(0xffc850);lamp.material.emissiveIntensity=0.9;lamp.position.y=4.1;g.add(lamp);return g;}
function makeBench(){const g=new THREE.Group();const seat=new THREE.Mesh(new THREE.BoxGeometry(1.6,.1,.6),mat(0x7a5c3a,0.8));seat.position.y=.7;g.add(seat);const back=new THREE.Mesh(new THREE.BoxGeometry(1.6,.5,.08),mat(0x7a5c3a,0.8));back.position.set(0,.95,-.26);g.add(back);return g;}
function makeBusStop(){const g=new THREE.Group();const pole=new THREE.Mesh(new THREE.CylinderGeometry(.06,.07,3.5,8),mat(0x4a5560,0.4,0.3));pole.position.y=1.75;g.add(pole);const roof=new THREE.Mesh(new THREE.BoxGeometry(2.6,.12,1.2),mat(0x3a5070,0.6));roof.position.set(0,3.3,-.3);g.add(roof);return g;}
function makeBicycle(color=0x5588cc){const g=new THREE.Group();const wm=mat(0x222222,0.5);[-0.82,0.82].forEach(x=>{const wheel=new THREE.Mesh(new THREE.TorusGeometry(.42,.07,8,20),wm.clone());wheel.rotation.y=Math.PI/2;wheel.position.set(x,.42,0);g.add(wheel);});const c=hi('#'+color.toString(16).padStart(6,'0'));addTube(g,0,.42,0,0,.96,0,.042,c);addTube(g,0,.96,0,.82,.9,0,.038,c);addTube(g,.38,.42,0,.82,.9,0,.038,c);return g;}
function makeMotorcycle(color=0x222222){const g=new THREE.Group();const wm=mat(0x111111,0.4);[-1.1,1.1].forEach(x=>{const w=new THREE.Mesh(new THREE.TorusGeometry(.5,.12,10,24),wm.clone());w.rotation.y=Math.PI/2;w.position.set(x,.5,0);g.add(w);});const body=new THREE.Mesh(new THREE.BoxGeometry(1.6,.6,.6),mat(color,0.3,0.4));body.position.set(0,.7,0);g.add(body);return g;}
function makeScooter(color=0x4488cc){const g=new THREE.Group();const wm=mat(0x222222,0.5);[-0.55,0.55].forEach(x=>{const w=new THREE.Mesh(new THREE.TorusGeometry(.22,.07,8,16),wm.clone());w.rotation.y=Math.PI/2;w.position.set(x,.22,0);g.add(w);});const deck=new THREE.Mesh(new THREE.BoxGeometry(1.1,.08,.22),mat(color,0.3,0.2));deck.position.y=.3;g.add(deck);return g;}
function makeBus(color=0xe8c030){const g=new THREE.Group();const body=new THREE.Mesh(new THREE.BoxGeometry(7,3,2.6),mat(color,0.7));body.position.y=1.7;g.add(body);return g;}
function makeTruck(color=0x5577aa){const g=new THREE.Group();const cab=new THREE.Mesh(new THREE.BoxGeometry(2.2,2.6,2.4),mat(color,0.5,0.2));cab.position.set(2.2,1.4,0);g.add(cab);const cargo=new THREE.Mesh(new THREE.BoxGeometry(4.5,2.8,2.4),mat(0xdddddd,0.8));cargo.position.set(-.8,1.6,0);g.add(cargo);return g;}
function makeAtm(){const g=new THREE.Group();const box=new THREE.Mesh(new THREE.BoxGeometry(.9,1.9,.7),mat(0x2a3a4a,0.5,0.3));box.position.y=.95;g.add(box);return g;}
function makeAlleyWall(){const g=new THREE.Group();const w=new THREE.Mesh(new THREE.BoxGeometry(8,.2,3),mat(0x1a2230,0.95));w.position.set(0,1.5,-1.5);w.rotation.x=Math.PI/2;g.add(w);return g;}
function makeFence(){const g=new THREE.Group();const pm=mat(0x5a3e28,0.8);const r1=new THREE.Mesh(new THREE.BoxGeometry(5.0,.08,.08),pm.clone());r1.position.y=0.9;g.add(r1);[-2.2,-1.1,0,1.1,2.2].forEach(x=>{const p=new THREE.Mesh(new THREE.BoxGeometry(.12,1.2,.12),pm.clone());p.position.set(x,0.6,0);g.add(p);});return g;}
function makeCrosswalk(width){
  const g=new THREE.Group();
  const w=width??7.0;
  for(let i=0;i<6;i++){
    const s=new THREE.Mesh(new THREE.BoxGeometry(w,.05,.44),mat(0xffffff,0.9));
    s.position.set(0,.05,i*.88-2.2);
    g.add(s);
  }
  return g;
}
const PROP_MAKERS={store:makeStore,car:()=>makeCar(),taxi:makeTaxi,bus:()=>makeBus(),truck:()=>makeTruck(),bicycle:()=>makeBicycle(),motorcycle:()=>makeMotorcycle(),scooter:makeScooter,tree:makeTree,streetlight:makeStreetlight,bench:makeBench,bus_stop:makeBusStop,atm:makeAtm,wall:makeAlleyWall,fence:makeFence,crosswalk:makeCrosswalk};

function makeLabel(text,color){
  const cv=document.createElement('canvas'); cv.width=256; cv.height=72;
  const x=cv.getContext('2d');
  function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
  x.fillStyle='rgba(8,12,18,.92)'; rr(x,6,6,244,54,7); x.fill();
  x.strokeStyle=color; x.lineWidth=2; rr(x,6,6,244,54,7); x.stroke();
  x.fillStyle='#fff'; x.font='600 28px Inter,system-ui,sans-serif';
  x.textAlign='center'; x.textBaseline='middle'; x.fillText(text,128,36);
  const tex=new THREE.CanvasTexture(cv);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));
  sp.scale.set(3.5,1.0,1); sp.position.y=2.9; return sp;
}
