/* ===== state.js ===== */
let MAPBOX_TOKEN = "";
let API_KEY = "";        // Anthropic Claude API 키
let GEMINI_API_KEY = ""; // Google Gemini API 키 (무료 대안)
let SEOUL_API_KEY = "";   // 서울열린데이터광장 Open API 인증키
let investigator = null;   // {name, badge}
let currentCase  = null;   // 현재 열린 사건 객체
const logEntries = [];     // [{text, ts, witName}] — 저장/복원용
const witnesses = [{id:0, name:"증인 A", statements:[]}];
let activeWitId = 0;
let accumulated = "";
let timelineItems = [];
let reportText = "";

let SCENE_ORIGIN = [127.0376, 37.4659];   // [lng,lat] — 서울 AI 허브
let lastAutoPlace = "";

/* three.js (Mapbox custom layer) */
let map = null;
let three = {scene:null, camera:null, renderer:null};
let sceneGroup = null;
const entities = new Map();
const props    = new Map();
const KIND_COLOR = {suspect:'#ff4d4d', victim:'#3ecfb4', bystander:'#7d90a8', officer:'#f5c842'};
const FIGURE_SCALE = 1;   // 1 unit = 1m — 실제 사람 키 약 2m, 건물 대비 현실 스케일
const LOC_NAMES = {street:'도로', store_front:'편의점 앞', alley:'골목', park:'공원', parking:'주차장', crosswalk:'횡단보도', subway:'지하철역', cafe:'카페'};

/* building recolor state */
const buildingState = new Map();   // fid -> hex
let lastBuildingFid = null;
