# RECON MAP — 진술 기반 사건 재구성 시스템

> **Branch:** `feature/yerin`  
> **담당:** 탁예린 (ANSL Lab, 숙명여자대학교 인공지능공학부)

Mapbox GL JS + Three.js를 결합한 3D 사건 현장 재구성 웹 애플리케이션입니다.  
목격자 진술을 입력하면 실제 지도 위에 용의자·피해자 피규어가 실시간으로 배치되고, 몽타주와 타임라인이 자동 생성됩니다.

---

## 주요 기능

### 🗺 3D 현장 재구성
- Mapbox GL JS v3.8.0 + Three.js r128 커스텀 레이어로 실제 3D 건물 위에 피규어 오버레이
- 진술 입력 시 키워드 분석 또는 Claude AI API를 통해 자동 장면 생성
- 인물(용의자/피해자/목격자/경찰)·소품(편의점/차량/가로등 등) 18종 3D 모델

### 👤 인물 배치 및 관리
- **직접 배치**: 역할 버튼 클릭 → 지도 클릭으로 원하는 위치에 배치
- **드래그 이동**: 배치된 피규어를 드래그해 위치 재조정
- **더블클릭 삭제**: 피규어 위에서 더블클릭 → 삭제 확인 다이얼로그
- **위치 자동 저장**: 배치·이동 즉시 localStorage에 저장, 재로드 시 복원

### 🕵️ 몽타주 3D 뷰어
- 별도 Three.js 씬에서 용의자 피규어를 스튜디오 조명으로 클로즈업 렌더링
- 정면/좌측면/우측면/후면 뷰 전환 및 자동 회전
- 진술에서 상의·하의 색상을 **컨텍스트 기반 파싱**으로 구분 추출
  - 예: "검은색 반팔 상의, 초록색 짧은 하의" → 상의/하의 색상 각각 인식
- 사건 재로드 시 마지막 인상착의 자동 복원

### 📋 진술 로그 · 타임라인
- 월/일/시/분 타임스탬프 포함 진술 기록
- 사건 재로드 시 타임라인 자동 재구성 (로그 엔트리 기반)

### 📄 AI 사건 보고서
- Anthropic API 연동 시 Claude 기반 정밀 보고서 생성
- **API 키 없을 때 키워드 분석 기반 기본 보고서** 자동 생성 (폴백)

### 🔑 API 키 관리
- `config.js` 파일에 키 입력 (`.gitignore`로 커밋 제외)
- 우선순위: 설정창 수동 입력 > localStorage > `config.js`

---

## 파일 구조

```
frontend/
├── index.html              # 앱 진입점 (HTML 골격)
├── config.js               # API 키 설정 (gitignore — 직접 생성 필요)
├── config.example.js       # config.js 작성 참고 예시
├── css/
│   └── style.css           # 전체 다크 테마 스타일
└── js/
    ├── state.js            # 전역 상태 (map, entities, witnesses 등)
    ├── figures.js          # 3D 피규어·소품 생성 함수 (18종)
    ├── scene.js            # 장면 적용, 키워드 파서, 배치/드래그
    ├── mapbox-layer.js     # Three.js 커스텀 레이어, 지도 초기화
    ├── montage.js          # 몽타주 전용 3D 렌더러
    ├── api.js              # Claude API 연동, 지오코딩, 진술 처리
    ├── ui.js               # 로그, 타임라인, 증인 칩, 탭 전환
    ├── speech.js           # 음성 인식 (Web Speech API)
    ├── cases.js            # 사건 저장/불러오기 (localStorage)
    └── main.js             # 이벤트 핸들러, 프리셋, 부팅 시퀀스
```

---

## 시작하기

### 1. config.js 생성

```bash
cp frontend/config.example.js frontend/config.js
```

`frontend/config.js`를 열고 키를 입력합니다:

```javascript
window.RECON_CONFIG = {
  ANTHROPIC_API_KEY: 'sk-ant-api03-...',   // 선택 — 없으면 키워드 모드로 동작
  MAPBOX_TOKEN:      'pk.eyJ1Ij...',        // 필수 — mapbox.com 무료 가입 후 발급
};
```

### 2. 실행

```bash
open frontend/index.html
```

브라우저에서 파일을 직접 열거나 로컬 서버로 서빙합니다.

---

## 기술 스택

| 분류 | 기술 |
|------|------|
| 지도 | Mapbox GL JS v3.8.0 |
| 3D 렌더링 | Three.js r128 |
| AI 분석 | Anthropic Claude Sonnet (선택) |
| 음성 인식 | Web Speech API |
| 저장소 | localStorage |
| 빌드 도구 | 없음 (순수 HTML/CSS/JS) |

---

## 구현 메모

- Three.js 좌표계: x = 동쪽, z = 남쪽 (음수 = 북쪽), 1unit = 1m
- `manual:true` 플래그로 수동 배치 피규어를 AI 재분석 시에도 유지
- Mapbox `dblclick` 이벤트는 줌 처리를 가로채므로 `map.on('dblclick', e => e.preventDefault())` 패턴 사용
- `restoreSceneEntities`는 반드시 `style.load` 이후 호출 (sceneGroup 의존)
