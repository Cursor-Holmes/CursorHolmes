/* ===== api.js ===== */

/* ═══════════════════════════════════════════════
   GEOCODING  (지명/좌표 → 지도 이동)
═══════════════════════════════════════════════ */
async function geocode(query){
  // 1차: Mapbox (POI·장소·주소·지역 모두 포함)
  const url=`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`
    +`?access_token=${MAPBOX_TOKEN}&limit=1&language=ko&country=KR`
    +`&types=poi,place,address,locality,neighborhood,district,region`;
  const res=await fetch(url); if(!res.ok) throw new Error('지오코딩 '+res.status);
  const j=await res.json();
  if(j.features&&j.features.length) return j.features[0].center;
  // 2차: Nominatim 폴백 (무료 OSM)
  const nm=await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query+' 대한민국')}&format=json&limit=1`,
    {headers:{'Accept-Language':'ko'}});
  const nd=await nm.json();
  if(nd&&nd.length) return [parseFloat(nd[0].lon), parseFloat(nd[0].lat)];
  throw new Error('검색 결과 없음');
}
async function loadPlace(input){
  let lng,lat;
  const m=input.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if(m){ lat=parseFloat(m[1]); lng=parseFloat(m[2]); }
  else { setStatus('지명 검색 중… ('+input+')', true); const c=await geocode(input); lng=c[0]; lat=c[1]; }
  SCENE_ORIGIN=[lng,lat];
  autoRotate=false;   // flyTo 중 setBearing 충돌 방지
  if(map) map.flyTo({center:[lng,lat], zoom:17.2, pitch:60, duration:1600});
  document.getElementById('coordTag').textContent=lat.toFixed(4)+', '+lng.toFixed(4);
  setStatus('현장 이동: '+input, false, true);
}

/* ═══════════════════════════════════════════════
   GEMINI API 공통 호출 (무료 대안)
═══════════════════════════════════════════════ */
async function callGemini(prompt, retries=2){
  const url=`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  for(let attempt=0; attempt<=retries; attempt++){
    const res=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({contents:[{parts:[{text:prompt}]}],
        generationConfig:{temperature:0.2,maxOutputTokens:1400}})});
    if(res.status===429 && attempt<retries){
      await new Promise(r=>setTimeout(r, 2000*(attempt+1)));
      continue;
    }
    if(!res.ok){
      let detail='';
      try{ const errBody=await res.json(); detail=errBody?.error?.message||''; }catch(_){}
      throw new Error('Gemini '+res.status+(detail?(': '+detail):''));
    }
    const data=await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text||'';
  }
  throw new Error('Gemini 429');
}
function parseJson(txt){
  txt=txt.replace(/```json/gi,"").replace(/```/g,"").trim();
  const a=txt.indexOf("{"),b=txt.lastIndexOf("}");
  if(a>=0&&b>=0) return JSON.parse(txt.slice(a,b+1));
  throw new Error("JSON 파싱 실패");
}

/* ═══════════════════════════════════════════════
   CLAUDE API (선택)
═══════════════════════════════════════════════ */
const SCHEMA_PROMPT=`너는 목격자 진술을 3D 장면 데이터로 변환하는 수사 보조 AI다. 누적된 모든 진술을 종합해 현재 장면 상태를 JSON으로만 출력한다.
{"location":"street|store_front|alley|park|parking|crosswalk|subway|cafe","entities":[{"id":"","kind":"suspect|victim|bystander|officer","label":"짧은한글","color":"#hex","height_scale":1.0,"pos":[x,z],"top_type":"long|short|tank","top_color":"#hex","bottom_type":"long_pants|shorts|long_skirt|short_skirt","bottom_color":"#hex","hat":"cap|beanie|null","hat_color":"#hex|null","mask":false,"glasses":"sunglasses|glasses|null","shoe_color":"#hex","bag_type":"backpack|crossbody|handbag|null","bag_color":"#hex|null"}],"props":[{"id":"","kind":"store|car|taxi|bus|truck|bicycle|motorcycle|scooter|tree|streetlight|bench|bus_stop|atm|wall|fence|crosswalk","pos":[x,z]}],"key_event":"한문장","suspect_info":{"height":"tall|medium|short|unknown","build":null,"clothing_top":null,"clothing_bottom":null,"face":null,"other":null},"contradiction":null}
규칙: 좌표 -11~11. 같은 인물 같은 id. JSON만.`;
async function statementToScene(transcript){
  const prompt=SCHEMA_PROMPT+"\n\n[누적 진술]\n"+transcript+"\n\n[JSON]";
  // 1순위: Anthropic Claude
  if(API_KEY){
    const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",
      headers:{"Content-Type":"application/json","x-api-key":API_KEY,
        "anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
      body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1400,messages:[{role:"user",content:prompt}]})});
    if(!res.ok) throw new Error("Claude API "+res.status);
    const data=await res.json();
    return parseJson((data.content||[]).map(b=>b.text||"").join(""));
  }
  // 2순위: Gemini
  if(GEMINI_API_KEY){
    return parseJson(await callGemini(prompt));
  }
  throw new Error('no_key');
}

function buildKeywordRecommendations(all, si, ents){
  const tips=[];
  const t=(all||'').toLowerCase();
  if(/차|차량|승용|택시|버스|도주|뛰|교통|횡단/.test(t))
    tips.push('현장 주변 CCTV·블랙박스 영상 확보 및 차량 번호판 역추적');
  if(/횡단보도|신호/.test(t))
    tips.push('교차로 신호등·횡단보도 CCTV 및 신호 기록 확인');
  if(/가방|쇼핑백|뺏|탈취|훔/.test(t))
    tips.push('탈취물(쇼핑백 등) 특징 기록 및 유통·폐기 경로 조사');
  if(/편의점|상가|건물|골목/.test(t))
    tips.push('주변 상가·건물 CCTV 및 출입 기록 확인');
  if(Object.values(ents).some(e=>e.kind==='suspect')||/용의|가해|남자|여자/.test(t))
    tips.push('용의자 인상착의 몽타주 배포 및 추가 목격자 신문');
  if(si?.clothing_top)
    tips.push(`의류 특징(${si.clothing_top}) 기준 주변 CCTV·목격 정보 교차 검증`);
  if(/목격|증인/.test(t))
    tips.push('복수 증인 진술 타임라인 대조 및 모순 지점 확인');
  if(!tips.length)
    tips.push('추가 목격자 확보 및 진술 교차 검증');
  tips.push('3D 타임라인 재현 장면과 진술 문장 대조 검토');
  return tips.map((line,i)=>`${i+1}. ${line}`).join('\n');
}

function generateKeywordReport(all){
  const lines=(all||'').split(/(?<=[.!?！？])\s+/).filter(s=>s.trim().length>4);
  const si=fbS?.si||{};
  const ents=Object.values(fbS?.entities||{});
  const htMap={tall:'키 큰',medium:'보통 키',short:'키 작은'};
  const suspectParts=[si.height&&si.height!=='unknown'?htMap[si.height]:'',si.clothing_top||'',si.clothing_bottom||'',si.face||''].filter(Boolean);
  return {
    case_summary:'진술 요약: '+(lines[0]||'진술 없음'),
    suspect_profile:suspectParts.length?suspectParts.join(' / '):'용의자 인상착의 정보 불충분',
    timeline:lines.slice(0,6).map(l=>l.trim()),
    key_evidence:ents.map(e=>`${e.label||e.kind} — 현장 위치 확인됨`).slice(0,4),
    recommendation:buildKeywordRecommendations(all, si, ents),
  };
}

function formatReportTimeline(items){
  return (items||[]).map((raw,i)=>{
    const text=String(raw).replace(/^\d+\.\s*/,'').trim();
    return `${i+1}. ${text}`;
  }).join('<br>');
}

async function generateReport(all){
  const reportPrompt=`다음 목격자 진술을 수사 보고서로 요약. JSON만 출력:\n[진술]\n${all}\n{"case_summary":"","suspect_profile":"","timeline":[],"key_evidence":[],"recommendation":""}`;

  // 1순위: Anthropic Claude
  if(API_KEY){
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":API_KEY,
          "anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1000,messages:[{role:"user",content:reportPrompt}]})});
      if(!res.ok) throw new Error("Claude API "+res.status);
      const data=await res.json();
      return parseJson((data.content||[]).map(b=>b.text||"").join(""));
    }catch(err){
      console.warn('[generateReport] Claude failed:', err.message);
      const fb=generateKeywordReport(all);
      fb._apiNotice=`Claude API 오류(${err.message}) — 키워드 분석 보고서로 생성`;
      return fb;
    }
  }
  // 2순위: Gemini (무료) — 429 등 실패 시 키워드 폴백
  if(GEMINI_API_KEY){
    try{
      return parseJson(await callGemini(reportPrompt));
    }catch(err){
      console.warn('[generateReport] Gemini failed:', err.message);
      const fb=generateKeywordReport(all);
      fb._apiNotice=/429/.test(err.message)
        ? 'Gemini 할당량 초과(429) — 키워드 분석 보고서로 생성. aistudio.google.com에서 할당량 확인'
        : `Gemini API 오류(${err.message}) — 키워드 분석 보고서로 생성`;
      return fb;
    }
  }
  // 3순위: 키워드 기반
  return generateKeywordReport(all);
}

/* ═══════════════════════════════════════════════
   PROCESS STATEMENT
═══════════════════════════════════════════════ */
async function processStatement(sentence){
  if(!sentence.trim()) return;
  const sen=sentence.trim();
  const wit=witnesses.find(w=>w.id===activeWitId);
  wit.statements.push(sen);
  accumulated+=(accumulated?" ":"")+sen;

  resolveStatementTime(sen); // [추가됨] 진술 속 절대/상대 시간 표현을 인식해 "사건 시각" 드롭다운에 추천값 반영

  addLog(sen,false,wit.name);
  const tlItem = addTimelineItem(sen,wit.name); // [변경됨] scene은 아래에서 채워짐(분석 완료 시점의 누적 장면 스냅샷)

  // 진술에서 지명 추출 → 자동 지오코딩 (처음 발견된 새 지명만)
  const place=extractPlace(sen);
  if(place && place!==lastAutoPlace){ lastAutoPlace=place; loadPlace(place).catch(()=>{}); }
  // 언급한 건물 색칠
  applyBuildingMention(sen);
  // 언급한 증거물 현장에 배치 (하나씩 등장)
  applyEvidenceMention(sen);

  if(!API_KEY){
    setStatus("키워드 분석 중…",true);
    const sd=keywordScene(sen,accumulated); applyScene(sd);
    tlItem.scene=sd; renderTimeline(); // [추가됨] 타임라인 클릭 재현용 장면 스냅샷 저장
    setStatus(`재현 완료 (키워드 모드) · ${sd.entities.length}명 — ⚙ API 키 입력 시 AI 정밀 재현`,false,true);
    if(currentCase) saveCurrentCase(); return;
  }
  setStatus("AI 분석 중 — 재구성…",true);
  try{
    const sd=await statementToScene(accumulated); applyScene(sd);
    tlItem.scene=sd; renderTimeline(); // [추가됨] 타임라인 클릭 재현용 장면 스냅샷 저장
    if(sd.contradiction) showContradiction(sd.contradiction);
    setStatus(`재현 완료 · ${(sd.entities||[]).length}명 · ${(sd.props||[]).length}개 객체`,false,true);
  }catch(err){
    const sd=keywordScene(sen,accumulated); applyScene(sd);
    tlItem.scene=sd; renderTimeline(); // [추가됨] 타임라인 클릭 재현용 장면 스냅샷 저장
    setStatus("AI 오류 → 키워드 모드: "+err.message,false,false);
  }
  if(currentCase) saveCurrentCase();
}
