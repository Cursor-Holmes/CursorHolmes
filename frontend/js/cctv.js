/* ===== cctv.js =====
   서울열린데이터광장 고정형CCTV 위치 데이터 → Mapbox 레이어 표시
   API: http://openapi.seoul.go.kr:8088/{KEY}/json/TbOpendataFixedcctv/{START}/{END}/
   출력: FIX_CCTV_ADDR, LAT, LOT(경도), CGG_CD(자치구), CRDN_BRNCH_NM(단속지점명), GRNDS_SE(현장구분)
*/

const CCTV_SOURCE_ID  = 'seoul-cctv';
const CCTV_LAYER_DOT  = 'cctv-dot';
const CCTV_LAYER_HALO = 'cctv-halo';
const CCTV_CACHE_KEY  = 'recon_cctv_cache';
const CCTV_CACHE_TTL  = 86400 * 1000; // 24h
const BATCH_SIZE      = 1000;

let cctvVisible  = false;
let cctvLoaded   = false;
let cctvPopup    = null;

/* ──────────────────────────────────────────
   1. 데이터 로드 (localStorage 캐시 우선)
────────────────────────────────────────── */
async function fetchCCTVBatch(key, start, end) {
  const url = `http://openapi.seoul.go.kr:8088/${key}/json/TbOpendataFixedcctv/${start}/${end}/`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const body = json.TbOpendataFixedcctv || json.RESULT;
  if (!body) throw new Error('응답 형식 오류');
  if (body.RESULT && body.RESULT.CODE !== 'INFO-000') {
    throw new Error(body.RESULT.MESSAGE || '서울 API 오류');
  }
  return body.row || [];
}

async function loadCCTVData(key) {
  // 캐시 확인
  try {
    const cached = localStorage.getItem(CCTV_CACHE_KEY);
    if (cached) {
      const { ts, rows } = JSON.parse(cached);
      if (Date.now() - ts < CCTV_CACHE_TTL) return rows;
    }
  } catch (_) {}

  // 첫 요청으로 총 건수 파악
  setStatus('CCTV 데이터 수집 중…', true);
  const firstBatch = await fetchCCTVBatch(key, 1, 1);
  // 총 건수는 list_total_count 필드에 있음 — 다시 최상위 조회
  const url0 = `http://openapi.seoul.go.kr:8088/${key}/json/TbOpendataFixedcctv/1/1/`;
  const res0 = await fetch(url0);
  const json0 = await res0.json();
  const totalCount = parseInt(json0.TbOpendataFixedcctv?.list_total_count || 5000);

  // 배치 병렬 로드
  const batches = [];
  for (let s = 1; s <= totalCount; s += BATCH_SIZE) {
    const e = Math.min(s + BATCH_SIZE - 1, totalCount);
    batches.push(fetchCCTVBatch(key, s, e));
  }
  const results = await Promise.all(batches);
  const rows = results.flat();

  // 캐시 저장
  try {
    localStorage.setItem(CCTV_CACHE_KEY, JSON.stringify({ ts: Date.now(), rows }));
  } catch (_) {}

  return rows;
}

/* ──────────────────────────────────────────
   2. GeoJSON 변환
────────────────────────────────────────── */
function rowsToGeoJSON(rows) {
  const features = rows
    .filter(r => r.LAT && r.LOT && !isNaN(parseFloat(r.LAT)) && !isNaN(parseFloat(r.LOT)))
    .map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [parseFloat(r.LOT), parseFloat(r.LAT)] },
      properties: {
        addr:     r.FIX_CCTV_ADDR   || '',
        district: r.CGG_CD           || '',
        name:     r.CRDN_BRNCH_NM   || '',
        type:     r.GRNDS_SE         || '',
      }
    }));
  return { type: 'FeatureCollection', features };
}

/* ──────────────────────────────────────────
   3. Mapbox 레이어 추가/제거
────────────────────────────────────────── */
function addCCTVLayers(geojson) {
  if (!map) return;

  // 기존 레이어·소스 제거 (재로드 방지)
  if (map.getLayer(CCTV_LAYER_HALO)) map.removeLayer(CCTV_LAYER_HALO);
  if (map.getLayer(CCTV_LAYER_DOT))  map.removeLayer(CCTV_LAYER_DOT);
  if (map.getSource(CCTV_SOURCE_ID)) map.removeSource(CCTV_SOURCE_ID);

  map.addSource(CCTV_SOURCE_ID, { type: 'geojson', data: geojson, cluster: false });

  // halo → dot 순서로 추가 (dot이 위에 렌더링)
  map.addLayer({
    id:     CCTV_LAYER_HALO,
    type:   'circle',
    source: CCTV_SOURCE_ID,
    paint: {
      'circle-radius':       ['interpolate', ['linear'], ['zoom'], 13, 7,  17, 12, 20, 18],
      'circle-color':        '#00ffcc',
      'circle-opacity':      0.13,
      'circle-stroke-width': 0,
    }
  });
  map.addLayer({
    id:     CCTV_LAYER_DOT,
    type:   'circle',
    source: CCTV_SOURCE_ID,
    paint: {
      'circle-radius':       ['interpolate', ['linear'], ['zoom'], 13, 3,  17, 5,  20, 8],
      'circle-color':        '#00ffcc',
      'circle-opacity':      0.85,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#003322',
    }
  });

  // 클릭 팝업
  map.on('click', CCTV_LAYER_DOT, e => {
    const p = e.features[0].properties;
    const coords = e.features[0].geometry.coordinates.slice();
    const content = `
      <div class="cctv-popup">
        <div class="cctv-popup-title">📹 고정형 CCTV</div>
        ${p.name     ? `<div class="cctv-popup-row"><span>단속지점</span>${p.name}</div>` : ''}
        ${p.addr     ? `<div class="cctv-popup-row"><span>주소</span>${p.addr}</div>` : ''}
        ${p.district ? `<div class="cctv-popup-row"><span>자치구</span>${p.district}</div>` : ''}
        ${p.type     ? `<div class="cctv-popup-row"><span>현장구분</span>${p.type}</div>` : ''}
      </div>`;
    if (cctvPopup) cctvPopup.remove();
    cctvPopup = new mapboxgl.Popup({ offset: 8, closeButton: true, className: 'cctv-mapbox-popup' })
      .setLngLat(coords)
      .setHTML(content)
      .addTo(map);
  });

  map.on('mouseenter', CCTV_LAYER_DOT, () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', CCTV_LAYER_DOT, () => { map.getCanvas().style.cursor = ''; });
}

function removeCCTVLayers() {
  if (!map) return;
  if (cctvPopup) { cctvPopup.remove(); cctvPopup = null; }
  if (map.getLayer(CCTV_LAYER_HALO)) map.removeLayer(CCTV_LAYER_HALO);
  if (map.getLayer(CCTV_LAYER_DOT))  map.removeLayer(CCTV_LAYER_DOT);
  if (map.getSource(CCTV_SOURCE_ID)) map.removeSource(CCTV_SOURCE_ID);
}

/* ──────────────────────────────────────────
   4. 토글 진입점 (버튼에서 호출)
────────────────────────────────────────── */
async function toggleCCTV() {
  const btn = document.getElementById('cctvToggleBtn');

  if (cctvVisible) {
    removeCCTVLayers();
    cctvVisible = false;
    if (btn) { btn.classList.remove('cctv-on'); btn.textContent = '📹 CCTV 표시'; }
    setStatus('CCTV 레이어 숨김', false);
    return;
  }

  if (!SEOUL_API_KEY) {
    setStatus('서울 Open API 키를 설정에서 입력하세요.', false, false);
    document.getElementById('settingsOverlay').style.display = 'flex';
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = '⏳ 로딩 중…'; }
  try {
    const rows    = await loadCCTVData(SEOUL_API_KEY);
    const geojson = rowsToGeoJSON(rows);
    addCCTVLayers(geojson);
    cctvVisible = true;
    cctvLoaded  = true;
    if (btn) {
      btn.disabled = false;
      btn.classList.add('cctv-on');
      btn.textContent = `📹 CCTV 숨기기 (${geojson.features.length.toLocaleString()}개)`;
    }
    setStatus(`CCTV ${geojson.features.length.toLocaleString()}개 표시 중`, false, true);
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = '📹 CCTV 표시'; }
    setStatus('CCTV 로드 실패: ' + err.message, false, false);
    console.error('[CCTV]', err);
  }
}

/* 지도 스타일 재로드 시 레이어 자동 복원 */
function restoreCCTVIfNeeded() {
  if (cctvVisible && cctvLoaded) {
    try {
      const cached = localStorage.getItem(CCTV_CACHE_KEY);
      if (cached) {
        const { rows } = JSON.parse(cached);
        addCCTVLayers(rowsToGeoJSON(rows));
      }
    } catch (_) {}
  }
}
