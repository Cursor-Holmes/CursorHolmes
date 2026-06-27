/* ===== speech.js ===== */
const micBtn=document.getElementById('micBtn'),micLabel=document.getElementById('micLabel'),recDot=document.getElementById('recDot');
let recog=null,listening=false; const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
function createRecog(){ if(!SR) return null; const r=new SR(); r.lang='ko-KR'; r.continuous=false; r.interimResults=true;
  r.onresult=e=>{let interim="";for(let i=e.resultIndex;i<e.results.length;i++){const res=e.results[i];if(res.isFinal)processStatement(res[0].transcript);else interim+=res[0].transcript;}if(interim)addLog(interim,true);};
  r.onerror=e=>{if(e.error!=='no-speech')setStatus("음성 오류: "+e.error,false,false);scheduleRestart();};
  r.onend=()=>scheduleRestart(); return r; }
let restartTimer=null;
function scheduleRestart(){ if(!listening)return; clearTimeout(restartTimer); restartTimer=setTimeout(()=>{if(!listening)return;recog=createRecog();if(recog)recog.start();},120); }
function startMic(){ if(!SR){setStatus("음성 인식 미지원 — Chrome 권장",false);return;} listening=true; recog=createRecog(); if(recog)recog.start(); micBtn.classList.add('on'); micLabel.textContent='■ 녹음 중지'; recDot.classList.add('live'); setStatus("듣는 중 — 진술하세요.",false,true); }
function stopMic(){ listening=false; clearTimeout(restartTimer); if(recog){try{recog.stop();}catch(_){}recog=null;} micBtn.classList.remove('on'); micLabel.textContent='🎙 음성 진술 시작'; recDot.classList.remove('live'); setStatus("음성 인식 중지됨.",false); }
micBtn.onclick=()=>listening?stopMic():startMic();
