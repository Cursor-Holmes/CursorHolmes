/* ===== mapbox-layer.js ===== */
const customLayer = {
  id:'witness-3d', type:'custom', renderingMode:'3d',
  onAdd:function(m, gl){
    three.camera = new THREE.Camera();
    three.scene  = new THREE.Scene();
    three.scene.add(new THREE.AmbientLight(0xffffff, 1.15));
    const d1=new THREE.DirectionalLight(0xffffff,0.9); d1.position.set(0,80,100); three.scene.add(d1);
    const d2=new THREE.DirectionalLight(0xbcd2ff,0.4); d2.position.set(0,60,-80); three.scene.add(d2);
    sceneGroup=new THREE.Group(); three.scene.add(sceneGroup);
    three.renderer=new THREE.WebGLRenderer({canvas:m.getCanvas(),context:gl,antialias:true});
    three.renderer.autoClear=false;
  },
  render:function(gl, matrix){
    // 인물/소품 애니메이션 (등장·이동)
    entities.forEach(r=>{
      r.group.position.x += (r.target.x - r.group.position.x)*0.1;
      r.group.position.z += (r.target.z - r.group.position.z)*0.1;
      if(!r.grew){ const s=r.group.scale.x+(FIGURE_SCALE-r.group.scale.x)*0.15; r.group.scale.set(s,s,s); if(s>FIGURE_SCALE*0.99){r.group.scale.set(FIGURE_SCALE,FIGURE_SCALE,FIGURE_SCALE);r.grew=true;} }
    });
    props.forEach(r=>{ if(!r.grew){ const s=r.group.scale.x+(FIGURE_SCALE-r.group.scale.x)*0.15; r.group.scale.set(s,s,s); if(s>FIGURE_SCALE*0.99){r.group.scale.set(FIGURE_SCALE,FIGURE_SCALE,FIGURE_SCALE);r.grew=true;} } });

    const origin = mapboxgl.MercatorCoordinate.fromLngLat({lng:SCENE_ORIGIN[0],lat:SCENE_ORIGIN[1]}, 0);
    const scale  = origin.meterInMercatorCoordinateUnits();
    const rotX = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1,0,0), Math.PI/2);
    const m4 = new THREE.Matrix4().fromArray(matrix);
    const l = new THREE.Matrix4()
      .makeTranslation(origin.x, origin.y, origin.z)
      .scale(new THREE.Vector3(scale, -scale, scale))
      .multiply(rotX);
    three.camera.projectionMatrix = m4.multiply(l);
    three.renderer.resetState();
    three.renderer.render(three.scene, three.camera);
    map.triggerRepaint();
  }
};

function initMap(){
  mapboxgl.accessToken = MAPBOX_TOKEN;
  map = new mapboxgl.Map({
    container:'map',
    style:'mapbox://styles/mapbox/dark-v11',
    center:SCENE_ORIGIN, zoom:17.2, pitch:60, bearing:-20,
    antialias:true, projection:'mercator', preserveDrawingBuffer:true
  });
  map.on('style.load', ()=>{
    // 실제 3D 건물 (Mapbox 벡터타일 building 레이어 압출)
    map.addLayer({
      id:'3d-buildings', source:'composite', 'source-layer':'building',
      filter:['==','extrude','true'], type:'fill-extrusion', minzoom:14,
      paint:{
        'fill-extrusion-color':['coalesce',['feature-state','color'],'#2a3543'],
        'fill-extrusion-height':['interpolate',['linear'],['zoom'],14,0,15.5,['get','height']],
        'fill-extrusion-base':['get','min_height'],
        'fill-extrusion-opacity':0.92
      }
    });
    map.addLayer(customLayer);   // three.js 피규어 레이어 (건물 위에 정확한 깊이로)
    registerPlacementAndDrag();
    // 저장된 피규어 위치 복원
    if(currentCase && currentCase.sceneEnts && currentCase.sceneEnts.length){
      restoreSceneEntities(currentCase.sceneEnts);
    }
    setStatus('지도 로드 완료 · 진술을 시작하세요', false, true);
    restoreCCTVIfNeeded();   // 지도 재로드 시 CCTV 레이어 복원
  });
  // 사용자 조작 시 자동회전 중지
  map.on('mousedown', ()=>{ autoRotate=false; });
  map.on('touchstart', ()=>{ autoRotate=false; });
  startAutoRotate();
}

/* 부드러운 자동 회전 (조작 전까지) */
let autoRotate=true;
function sceneAnimating(){
  let a=false;
  entities.forEach(r=>{ if(!r.grew || Math.abs(r.target.x-r.group.position.x)>0.01 || Math.abs(r.target.z-r.group.position.z)>0.01) a=true; });
  props.forEach(r=>{ if(!r.grew) a=true; });
  return a;
}
function startAutoRotate(){
  function tick(){
    if(map){
      // isMoving() 중에는 setBearing 호출 금지 — flyTo 애니메이션을 interrupt하지 않도록
      if(autoRotate && !map.isMoving()) map.setBearing(map.getBearing()+0.06);
      if(autoRotate || sceneAnimating()) map.triggerRepaint();
    }
    requestAnimationFrame(tick);
  }
  tick();
}
