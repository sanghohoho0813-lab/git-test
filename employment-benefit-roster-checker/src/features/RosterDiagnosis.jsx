// ============================================================
// 4대보험 명부 고용혜택 1분 진단기 — 분석 화면(독립앱)
// 고용지원금 Pro 의 PayrollDiagnosis 기능을 그대로 분리.
// 계산/판정 로직은 ../domain/payrollDiagnosis 에 모듈화되어 있다.
// 개인정보: 파일/명부는 브라우저 메모리에서만 처리(서버·DB 업로드 없음).
// ============================================================
import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import * as PD from "../domain/payrollDiagnosis";
import { SERVICE } from "../config/service";

// ── 폰트/버튼/유틸 (원본 공용 토큰에서 필요한 것만 발췌) ──
export var FF = "'Pretendard','Pretendard Variable',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans KR',sans-serif";
var FS_INPUT="clamp(15px,4vw,17px)";
var FS_SECTION="clamp(19px,4.4vw,24px)";
var btnP = {background:"#2563EB",color:"#fff",border:"none",borderRadius:10,padding:"12px 24px",fontSize:FS_INPUT,fontWeight:600,cursor:"pointer",fontFamily:FF,boxShadow:"0 1px 2px rgba(37,99,235,0.18)",whiteSpace:"nowrap"};
var btnS = {background:"#fff",color:"#475569",border:"1.5px solid #E2E8F0",borderRadius:10,padding:"12px 24px",fontSize:FS_INPUT,fontWeight:500,cursor:"pointer",fontFamily:FF,whiteSpace:"nowrap"};
function uid(){ return Date.now().toString(36)+Math.random().toString(36).substr(2,6); }

// ── 전역 토스트 ──────────────────────────────────────────
var _toastFn=null;
function toast(msg,type){ if(_toastFn)_toastFn(msg,type||"success"); }
export function ToastHost(){
  var st=useState([]);
  useEffect(function(){
    _toastFn=function(msg,type){
      var id=Date.now()+"-"+Math.random();
      st[1](function(a){return a.concat([{id:id,msg:msg,type:type}]);});
      setTimeout(function(){ st[1](function(a){return a.filter(function(t){return t.id!==id;});}); },3400);
    };
    return function(){_toastFn=null;};
  },[]);
  var C={success:{bg:"#ECFDF5",bd:"#6EE7B7",c:"#047857",i:"\u2705"},warn:{bg:"#F1F5F9",bd:"#CBD5E1",c:"#475569",i:"\u26A0\uFE0F"},error:{bg:"#FEF2F2",bd:"#FECACA",c:"#DC2626",i:"\u26D4"},info:{bg:"#EFF6FF",bd:"#BFDBFE",c:"#1D4ED8",i:"\u2139\uFE0F"}};
  return(<div style={{position:"fixed",bottom:24,right:24,zIndex:6000,display:"flex",flexDirection:"column",gap:10,pointerEvents:"none"}}>
    {st[0].map(function(t){var s=C[t.type]||C.success;return(
      <div key={t.id} className="slide-in" style={{display:"flex",alignItems:"center",gap:10,background:s.bg,border:"1.5px solid "+s.bd,color:s.c,borderRadius:12,padding:"13px 18px",fontSize:15,fontWeight:600,fontFamily:FF,boxShadow:"0 8px 28px rgba(15,23,42,0.16)",maxWidth:400}}>
        <span style={{fontSize:18,flexShrink:0}}>{s.i}</span><span style={{lineHeight:1.4}}>{t.msg}</span>
      </div>
    );})}
  </div>);
}

// ── 모달 (포탈) ──────────────────────────────────────────
function Modal(props){
  useEffect(function(){
    if(!props.open||typeof document==="undefined")return;
    document.body.classList.add("no-scroll");
    return function(){document.body.classList.remove("no-scroll");};
  },[props.open]);
  if(!props.open||typeof document==="undefined")return null;
  return createPortal(
    <div className="modal-overlay" style={{position:"fixed",inset:0,zIndex:2000,background:"rgba(15,23,42,0.48)",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"16px",overflowY:"auto",WebkitOverflowScrolling:"touch"}} onClick={props.onClose}>
      <div className="modal-pop" style={{background:"#fff",borderRadius:18,width:"100%",maxWidth:props.width||640,margin:"auto",maxHeight:"calc(100dvh - 32px)",display:"flex",flexDirection:"column",minHeight:0,boxShadow:"0 24px 64px rgba(15,23,42,0.28)"}} onClick={function(e){e.stopPropagation();}}>
        <div style={{padding:"18px clamp(16px,4vw,28px)",borderBottom:"1px solid #F1F5F9",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexShrink:0,borderRadius:"16px 16px 0 0",background:"#fff"}}>
          <h3 style={{margin:0,fontSize:FS_SECTION,fontWeight:700,wordBreak:"keep-all",minWidth:0}}>{props.title}</h3>
          {props.onClose&&!props.noClose&&<button onClick={props.onClose} style={{background:"none",border:"none",fontSize:28,cursor:"pointer",color:"#94A3B8",flexShrink:0,lineHeight:1}}>\u2715</button>}
        </div>
        <div style={{padding:"clamp(16px,4vw,28px)",overflowY:"auto",flex:1,minHeight:0}}>{props.children}</div>
      </div>
    </div>,
    document.body
  );
}

function PayrollDiagnosis(props){
  var compact=props.compact;
  var stOpen=useState(props.autoOpen?true:false);
  var stBusy=useState(false);
  var stEmps=useState(null);        // 추출된 직원 배열(메모리)
  var stFile=useState(null);        // 선택된 파일(분석 전, 메모리만 · 저장 안 함)
  var stBase=useState(function(){return new Date().toISOString().split("T")[0];});
  var stTab=useState("emp");
  var stCopied=useState(false);
  var stPhase=useState("");          // PDF 분석 진행 상태 문구
  var stMissing=useState(0);         // 일부 항목 미확인(확인 필요) 직원 수
  var stErr=useState("");            // 모달 내부에 유지되는 오류 안내(앱 튕김 방지)
  var stStep=useState(1);            // 1 파일 선택 · 2 추출 내용 확인 · 3 명부 정리 · 4 진단 결과
  var stMode=useState("file");       // step1: 'file' | 'paste'
  var stText=useState("");           // PDF에서 읽은/붙여넣은/검수한 텍스트
  var stCand=useState([]);           // 직원 후보(검수·수정용)
  var stOnlyCheck=useState(false);   // '확인 필요만 보기'
  var stStats=useState(null);        // 분석 로그(텍스트 길이·주민번호 수·날짜 수·후보 수)
  var stIssueDate=useState(null);    // 명부 발급/출력일(최신성 경고용)
  var stPick=useState({clicked:false,returned:false,name:"",type:"",ext:"",supported:null}); // 파일 선택 로그
  var fileRef=useRef(null);
  var pickerOpenRef=useRef(false);   // 파일 선택기 열림 상태(복귀 시 상태 보호용)
  var changedRef=useRef(false);      // 이번 선택에서 onChange 발생 여부(취소 감지)

  // 모바일 환경 추정 + PDF 안전 제한값
  function isMobileEnv(){
    try{ return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (window.innerWidth||1024) < 768; }
    catch{ return false; }
  }
  var PDF_MOBILE_MAX_MB=5;
  var PDF_MAX_PAGES_MOBILE=5, PDF_MAX_PAGES_DESKTOP=30;
  var PDF_TIMEOUT_MS_MOBILE=15000, PDF_TIMEOUT_MS_DESKTOP=30000;
  // 추가 입력값
  var stRegion=useState("metro");   // metro|local (수도권/비수도권 세그먼트)
  var stSize=useState("sme");       // sme|mid|other
  var stIndustry=useState("normal");// normal|excluded|check
  var stYear=useState(function(){return new Date().getFullYear();});
  var stPrevTotal=useState("");     // "" | number | "unknown"
  var stPrevYouth=useState("");
  var stCurTotal=useState("");      // 명부 자동추정 후 수정 가능
  var stCurYouth=useState("");
  var stUnitY=useState(0);
  var stUnitN=useState(0);

  function reset(){
    stEmps[1](null);stFile[1](null);stBusy[1](false);stTab[1]("emp");stCopied[1](false);stPhase[1]("");stMissing[1](0);stErr[1]("");
    stStep[1](1);stMode[1]("file");stText[1]("");stCand[1]([]);stOnlyCheck[1](false);stStats[1](null);stIssueDate[1](null);
    stPrevTotal[1]("");stPrevYouth[1]("");stCurTotal[1]("");stCurYouth[1]("");
    if(fileRef.current)fileRef.current.value="";
  }

  // 기본 단가 자동 세팅(소재지/기업구분 변경 시)
  useEffect(function(){
    var u=PD.defaultTaxUnits(stRegion[0],stSize[0]);
    stUnitY[1](u.youth);stUnitN[1](u.normal);
  },[stRegion[0],stSize[0]]);

  function fileExt(f){return f?(f.name.split(".").pop()||"").toLowerCase():"";}
  function fmtSize(bytes){
    if(bytes==null)return "";
    if(bytes<1024)return bytes+" B";
    if(bytes<1024*1024)return (Math.round(bytes/102.4)/10)+" KB";
    return (Math.round(bytes/104857.6)/10)+" MB";
  }

  // 파일 형식 판정 헬퍼 (MIME 만 믿지 않고 확장자도 확인)
  function isPdfFile(f){ if(!f)return false; var nm=(f.name||"").toLowerCase(); return nm.endsWith(".pdf")||f.type==="application/pdf"; }
  function isExcelCsv(f){ if(!f)return false; var e=fileExt(f); return ["xlsx","xls","csv"].indexOf(e)>=0; }
  function isImageFile(f){ if(!f)return false; var e=fileExt(f); if((f.type||"").indexOf("image/")===0)return true; return ["jpg","jpeg","png","heic","heif","webp","gif","bmp","tif","tiff"].indexOf(e)>=0; }
  function isSupportedFile(f){ return isPdfFile(f)||isExcelCsv(f); }

  // 1) 파일 선택창 열기 — mode: 'pdf' | 'excel' | 'any'
  //  - capture/multiple 사용 안 함(카메라·사진첩 우선 방지)
  //  - 복귀 시 상태 보호: pickerOpenRef 로 표시(앱 전체 언마운트는 useAuth 에서 이미 방지)
  function openPicker(mode){
    try{
      if(!fileRef.current)throw new Error("no ref");
      var accept = mode==="pdf" ? ".pdf,application/pdf"
        : mode==="excel" ? ".xlsx,.xls,.csv"
        : "";   // 'any' → accept 비움(안드로이드/구글드라이브에서 파일이 보이도록)
      fileRef.current.accept=accept;
      fileRef.current.value="";        // 같은 파일 재선택 가능하도록 초기화
      pickerOpenRef.current=true; changedRef.current=false;
      stPick[1](Object.assign({},stPick[0],{clicked:true,returned:false,supported:null}));
      // 선택기 복귀(window focus) 감지 → 취소 안내(모달은 그대로 유지)
      var onFocus=function(){
        window.removeEventListener("focus",onFocus);
        setTimeout(function(){
          pickerOpenRef.current=false;
          stPick[1](function(p){return Object.assign({},p,{returned:true});});
          if(!changedRef.current){ toast("파일이 선택되지 않았습니다. 다시 선택해주세요.","error"); }
        },700);
      };
      window.addEventListener("focus",onFocus);
      fileRef.current.click();
    }catch(err){
      console.error("[명부진단] 파일 선택창 열기 실패:",err);
      toast("파일 선택창을 열 수 없습니다. 다시 시도해주세요.","error");
    }
  }

  // 2) 파일 선택됨 — 분석 전에 파일 정보만 표시(저장 안 함). 이미지/미지원은 거부.
  function onFileChange(file){
    changedRef.current=true; pickerOpenRef.current=false;
    if(!file){ return; }   // 선택 취소 — 모달 유지
    var ext=fileExt(file);
    stPick[1](Object.assign({},stPick[0],{clicked:true,returned:true,name:file.name,type:file.type||"(없음)",ext:ext||"(없음)",supported:isSupportedFile(file)}));
    stEmps[1](null);
    if(isImageFile(file)){
      // 사진/이미지: OCR 미지원 → 분석하지 않음. 모달 유지, 파일은 보류.
      stFile[1](file); stErr[1]("사진/이미지 파일은 아직 자동진단에서 지원하지 않습니다. 4대보험 명부 PDF(또는 엑셀)를 올려주세요. 사진으로 저장된 명부는 글자가 이미지라 정확히 읽기 어렵습니다 — 4대보험 EDI/사회보험통합징수포털에서 PDF·엑셀로 내려받는 것이 가장 안정적입니다.");
      return;
    }
    stErr[1]("");
    stFile[1](file);        // 선택 시점에는 파일 정보만 저장(무거운 분석 실행 안 함)
    if(!isSupportedFile(file)){
      stErr[1]("지원하지 않는 형식입니다. PDF 또는 엑셀(xlsx·xls)·CSV 파일을 올려주세요.");
    }else{
      toast("파일을 선택했습니다: "+file.name+" (아직 저장되지 않음)","success");
    }
  }

  // PDF 진행 상태 콜백 → 사용자 친화 문구
  function onPdfProgress(phase,cur,total){
    if(phase==="read")stPhase[1]("PDF를 읽는 중입니다…");
    else if(phase==="extract")stPhase[1]("페이지 텍스트를 추출하는 중입니다… ("+cur+"/"+total+")");
    else if(phase==="find")stPhase[1]("직원 정보를 찾는 중입니다…");
  }

  // 타임아웃 래퍼 — PDF 분석이 너무 오래 걸리면 대기를 끊고 안내(앱 유지)
  function withTimeout(promise,ms){
    return new Promise(function(resolve){
      var done=false;
      var t=setTimeout(function(){ if(!done){ done=true; resolve({ok:false,error:"timeout"}); } },ms);
      promise.then(function(v){ if(!done){ done=true; clearTimeout(t); resolve(v); } },
                   function(e){ if(!done){ done=true; clearTimeout(t); console.error("[명부진단] 분석 예외:",e); resolve({ok:false,error:"read_failed",message:e&&e.message}); } });
    });
  }

  // 후보 변환/편집 헬퍼
  function toCandidates(emps){
    return (emps||[]).map(function(e){
      var c=Object.assign({},e);
      c.id=uid(); c.excluded=false; c.confirmed=false;
      c.ins=c.ins||{np:false,hi:false,ei:false,wc:false};
      c.rel=c.rel||"none";
      return c;
    });
  }
  function candNeedsCheck(c){ return !c.name || c.name==="(이름 확인 필요)" || !c.birthDate || !c.hireDate; }
  function updateCand(id,patch){ stCand[1](stCand[0].map(function(c){ return c.id===id?Object.assign({},c,patch):c; })); }
  function updateIns(id,key,val){ stCand[1](stCand[0].map(function(c){ return c.id===id?Object.assign({},c,{ins:Object.assign({},c.ins||{},(function(){var o={};o[key]=val;return o;})())}):c; })); }
  function addCand(){ stCand[1](stCand[0].concat([{id:uid(),name:"",birthDate:"",gender:"",rrnMasked:null,hireDate:"",loseDate:null,statusRaw:"취득",insuranceRaw:"",ins:{np:false,hi:false,ei:false,wc:false},workplace:"",bizNo:"",excluded:false,confirmed:false}])); }
  function confirmAll(){ stCand[1](stCand[0].map(function(c){ return c.excluded?c:Object.assign({},c,{confirmed:true}); })); }
  // 후보 0명일 때: 빈 명부로 직접 입력 진행
  function goManual(){ stErr[1](""); stCand[1]([{id:uid(),name:"",birthDate:"",gender:"",rrnMasked:null,hireDate:"",loseDate:null,statusRaw:"취득",insuranceRaw:"",ins:{np:false,hi:false,ei:false,wc:false},workplace:"",bizNo:"",excluded:false,confirmed:false}]); stStep[1](3); }

  // 1단계 → : 엑셀/CSV 는 곧장 명부 정리(3), PDF 는 글자 읽기 후 검수(2)
  async function startFromFile(){
    var file=stFile[0];
    if(!file){toast("먼저 명부 파일을 선택해주세요.","error");return;}
    var isPdf=isPdfFile(file);
    if(isImageFile(file)){ stErr[1]("사진/이미지 파일은 자동진단에서 지원하지 않습니다. 4대보험 명부 PDF(또는 엑셀)를 올려주세요."); return; }
    if(!isSupportedFile(file)){ stErr[1]("지원하지 않는 형식입니다. PDF 또는 엑셀(xlsx·xls)·CSV 파일을 올려주세요."); return; }
    stErr[1]("");
    var mobile=isMobileEnv();
    if(isPdf&&mobile&&file.size>PDF_MOBILE_MAX_MB*1024*1024){
      stErr[1]("스마트폰에서는 큰 PDF("+PDF_MOBILE_MAX_MB+"MB 초과)에서 글자 읽기가 불안정할 수 있습니다. PDF 내용을 복사해 붙여넣거나, 엑셀 파일로 올리면 더 안정적입니다.");
      stMode[1]("paste"); stText[1](""); stStep[1](1);
      return;
    }
    stBusy[1](true);
    if(isPdf){
      stPhase[1]("PDF에서 글자를 읽는 중입니다…");
      var opts={maxPages:mobile?PDF_MAX_PAGES_MOBILE:PDF_MAX_PAGES_DESKTOP};
      var to=mobile?PDF_TIMEOUT_MS_MOBILE:PDF_TIMEOUT_MS_DESKTOP;
      var r=await withTimeout(PD.extractPdfText(file,onPdfProgress,opts),to);
      stBusy[1](false);stPhase[1]("");
      if(!r||!r.ok){
        if(r&&r.message)console.error("[명부진단] PDF 텍스트 추출 실패:",r.error,r.message);
        // 실패해도 검수 화면으로 보내 직접 붙여넣을 수 있게(앱 유지)
        stText[1]((r&&r.text)||"");
        stErr[1](r&&r.error==="timeout"?"PDF에서 글자 읽기가 길어 중단했습니다. 아래에 PDF 내용을 복사해 붙여넣거나, 엑셀 파일로 올려주세요.":"PDF에서 글자를 충분히 읽지 못했습니다. 아래에 PDF 내용을 복사해 붙여넣거나, 엑셀 파일로 올려주세요.");
        stStep[1](2);
        return;
      }
      stText[1](r.text||"");
      if(r.truncated)toast("PDF "+r.totalPages+"쪽 중 앞부분만 읽었습니다. 필요하면 직접 보완해주세요.","success");
      stStep[1](2);
    }else{
      stPhase[1]("명부를 읽는 중입니다…");
      var r2=await withTimeout(PD.parseRosterFile(file),20000);
      stBusy[1](false);stPhase[1]("");
      if(!r2||!r2.ok){
        var e2=r2?r2.error:"read_failed";
        if(r2&&r2.message)console.error("[명부진단] 엑셀/CSV 읽기 실패:",e2,r2.message);
        stErr[1]((e2==="empty"||e2==="no_rows")?"명부에서 직원 행을 찾지 못했습니다. 성명·생년월일(또는 주민번호)·자격취득일 항목이 있는지 확인해주세요.":"파일을 읽지 못했습니다. 엑셀 파일인지 확인해주세요.");
        return;
      }
      stCand[1](toCandidates(r2.employees));
      stStep[1](3);
    }
  }

  // 2단계(또는 붙여넣기) → 3단계: 텍스트에서 직원 후보 추출
  function textToCandidates(){
    var text=stText[0]||"";
    if(!text.trim()){ stErr[1]("내용이 비어 있습니다. PDF 내용을 복사해 붙여넣거나, 엑셀 파일로 올려주세요."); return; }
    var res=PD.parseTextRoster(text);
    stStats[1](res.stats);
    if(res.meta&&res.meta.issueDate)stIssueDate[1](res.meta.issueDate);
    if(!res.employees.length){ stErr[1]("직원 후보를 찾지 못했습니다. 주민번호(예: 900101-1******)나 생년월일이 보이도록 정리해 보거나, 아래 ‘직원 직접 입력’으로 진행하거나 엑셀 파일로 올려주세요."); return; }
    stErr[1]("");
    stCand[1](toCandidates(res.employees));
    stStep[1](3);
  }

  // 3단계 → 4단계: 검수된 명부로 1차 진단 실행
  function runDiagnosis(){
    var list=stCand[0].filter(function(c){return !c.excluded;}).map(function(c){
      var ins=c.ins||{};
      var insStr=[ins.np?"국민":"",ins.hi?"건강":"",ins.ei?"고용":"",ins.wc?"산재":""].filter(Boolean).join("·");
      return {name:(c.name||"").trim()||"(이름 확인 필요)",birthDate:c.birthDate||null,gender:c.gender||null,rrnMasked:c.rrnMasked||null,hireDate:c.hireDate||null,loseDate:c.loseDate||null,statusRaw:c.statusRaw||"",ins:c.ins,insKnown:c.insKnown,rel:c.rel||"none",insuranceRaw:insStr||c.insuranceRaw||"",workplace:c.workplace||"",bizNo:c.bizNo||""};
    });
    if(!list.length){ stErr[1]("진단할 직원이 없습니다. 직원을 추가하거나 ‘제외’를 해제해주세요."); return; }
    stErr[1]("");
    var an=PD.analyzeRoster(list,{baseDate:stBase[0],year:stYear[0]});
    stCurTotal[1](String(an.counts.activeCount));
    stCurYouth[1](String(an.counts.youthCount));
    stMissing[1](list.filter(function(c){return !c.birthDate||!c.hireDate||c.name==="(이름 확인 필요)";}).length);
    stEmps[1](list);
    stStep[1](4);
  }

  var analysis=useMemo(function(){
    if(!stEmps[0])return null;
    return PD.analyzeRoster(stEmps[0],{baseDate:stBase[0],year:stYear[0]});
  },[stEmps[0],stBase[0],stYear[0]]);

  function numOrNull(v){var s=String(v).trim();if(s===""||s==="unknown")return null;var n=Number(s);return isFinite(n)?n:null;}
  var estimate=useMemo(function(){
    return PD.estimateTaxCredit({
      region:stRegion[0],sizeType:stSize[0],
      prevTotal:numOrNull(stPrevTotal[0]),prevYouth:numOrNull(stPrevYouth[0]),
      curTotal:numOrNull(stCurTotal[0]),curYouth:numOrNull(stCurYouth[0]),
      unitYouth:stUnitY[0],unitNormal:stUnitN[0],
    });
  },[stRegion[0],stSize[0],stPrevTotal[0],stPrevYouth[0],stCurTotal[0],stCurYouth[0],stUnitY[0],stUnitN[0]]);

  var stale=useMemo(function(){
    return stIssueDate[0]?PD.rosterStaleness(stIssueDate[0],stBase[0]):null;
  },[stIssueDate[0],stBase[0]]);
  // 영업용 최대 예상 혜택 (지원금 + 세액공제)
  var subsidyMax=analysis?PD.estimateSubsidyTotal(analysis.subsidySummary):0;
  var creditMax=(estimate.computable&&!estimate.overYouth&&estimate.creditTotal!=null)?estimate.creditTotal:0;
  var totalBenefit=subsidyMax+creditMax;
  function staleText(){ return stale?("발급 후 "+stale.days+"일 경과"):""; }

  function doCopy(){
    if(!analysis)return;
    var text=PD.buildCopyText({
      company:(props.companyName||""),
      totalEmp:analysis.counts.totalEmp,youthCount:analysis.counts.youthCount,seniorCount:analysis.counts.seniorCount,
      eiCheckCount:analysis.eiCheckCount,wcCheckCount:analysis.wcCheckCount,partialInsCount:analysis.partialInsCount,relCheckCount:analysis.relCheckCount,
      candidateSubsidyCount:analysis.candidateSubsidyCount,estimate:estimate,
      issueDate:stIssueDate[0],staleText:staleText(),
    });
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(function(){stCopied[1](true);setTimeout(function(){stCopied[1](false);},2200);toast("상담용 요약을 복사했습니다. (주민번호·직원별 정보 미포함)","success");},function(){toast("복사에 실패했습니다.","error");});
    }else{toast("이 브라우저에서는 복사를 지원하지 않습니다.","error");}
  }

  var inpS={width:"100%",boxSizing:"border-box",padding:"11px 13px",fontSize:19,borderRadius:9,border:"1.5px solid #E2E8F0",fontFamily:FF,background:"#fff",color:"#1E293B"};
  var labS={fontSize:17.5,fontWeight:700,color:"#475569",marginBottom:6,display:"block"};

  // 진입 버튼 (업체 관리 상단 / 채용 진단 등에서 재사용)
  var btn=compact?(
    <button onClick={function(){stOpen[1](true);}} className="prog-tap" style={{background:"#0F766E",color:"#fff",border:"none",borderRadius:11,padding:"12px 20px",fontSize:21.5,fontWeight:800,whiteSpace:"nowrap",cursor:"pointer",fontFamily:FF,boxShadow:"0 2px 8px rgba(15,118,110,0.28)"}}>🩺 4대보험 명부 진단</button>
  ):(
    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:4}}>
      <button onClick={function(){stOpen[1](true);}} className="prog-tap" style={{background:"#0F766E",color:"#fff",border:"none",borderRadius:11,padding:"13px 22px",fontSize:21.5,fontWeight:800,whiteSpace:"nowrap",cursor:"pointer",fontFamily:FF,boxShadow:"0 2px 8px rgba(15,118,110,0.28)"}}>🩺 4대보험 명부 진단</button>
      <span style={{fontSize:17,color:"#64748B",whiteSpace:"nowrap",fontWeight:600}}>가입자 명부를 올리면 지원금 후보와 세액공제 가능성을 자동으로 분류합니다.</span>
    </div>
  );

  return(
    <React.Fragment>
      {!props.hideEntry&&btn}
      <Modal open={stOpen[0]} onClose={function(){if(props.hideEntry)return;if(stBusy[0])return;var dirty=(stStep[0]>1||stFile[0]||(stText[0]&&stText[0].trim())||stCand[0].length);if(dirty&&!window.confirm("정말 닫을까요? 분석 내용은 저장되지 않습니다."))return;stOpen[1](false);}} noClose={props.hideEntry} title={<span style={{fontSize:26.5,fontWeight:800}}>{SERVICE.name}</span>} width={960}>
        <div style={{display:"grid",gap:14}}>
          {/* 단계 이동(뒤로/앞으로) — 제목 바로 아래 보조 버튼 */}
          {(function(){
            var maxReach=stEmps[0]?4:(stCand[0].length?3:((stText[0]&&stText[0].trim())?2:1));
            var canBack=stStep[0]>1, canFwd=stStep[0]<maxReach;
            return(
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <button type="button" disabled={!canBack||stBusy[0]} onClick={function(){if(canBack)stStep[1](stStep[0]-1);}}
                  style={{padding:"7px 14px",fontSize:17,fontWeight:800,borderRadius:9,border:"1.5px solid #E2E8F0",background:canBack?"#fff":"#F1F5F9",color:canBack?"#0F766E":"#CBD5E1",cursor:canBack?"pointer":"default",fontFamily:FF}}>← 뒤로가기</button>
                <button type="button" disabled={!canFwd||stBusy[0]} onClick={function(){if(canFwd)stStep[1](stStep[0]+1);}}
                  style={{padding:"7px 14px",fontSize:17,fontWeight:800,borderRadius:9,border:"1.5px solid #E2E8F0",background:canFwd?"#fff":"#F1F5F9",color:canFwd?"#0F766E":"#CBD5E1",cursor:canFwd?"pointer":"default",fontFamily:FF}}>앞으로가기 →</button>
                <span style={{fontSize:15.5,color:"#94A3B8",marginLeft:"auto"}}>{stStep[0]}/4 단계</span>
              </div>
            );
          })()}
          {/* 개인정보/면책 안내 (항상 표시) */}
          <div style={{padding:"12px 15px",background:"#F0FDFA",border:"1px solid #99F6E4",borderRadius:10,fontSize:17,color:"#0F766E",lineHeight:1.7,wordBreak:"keep-all"}}>
            🔒 <strong>분석은 브라우저에서만 처리됩니다.</strong> 파일은 아직 저장되지 않으며, 서버·DB에 업로드하지 않습니다.
            주민등록번호 등 민감정보는 화면에 <strong>마스킹</strong>(예: 900101-1******)되어 표시되고, 결과 복사에도 포함되지 않습니다.
          </div>

          {/* 숨김 파일 input — 항상 렌더되어 ref 가 끊기지 않도록 모달 최상위에 둠 */}
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.pdf" style={{display:"none"}}
            onChange={function(e){var f=e.target.files&&e.target.files[0];onFileChange(f);}}/>

          {/* 단계 표시 (1 파일 선택 · 2 추출 내용 확인 · 3 명부 정리 · 4 진단 결과) */}
          <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
            {[[1,"파일 선택"],[2,"추출 내용 확인"],[3,"명부 정리"],[4,"1차 진단 결과"]].map(function(s,i){
              var n=s[0],on=stStep[0]===n,done=stStep[0]>n;
              return(<React.Fragment key={n}>
                {i>0&&<span style={{flex:"0 0 12px",height:2,background:(done||on)?"#5EEAD4":"#E2E8F0"}}/>}
                <span style={{display:"inline-flex",alignItems:"center",gap:7,fontSize:17.5,fontWeight:800,color:(on||done)?"#0F766E":"#94A3B8",whiteSpace:"nowrap"}}>
                  <span style={{width:25,height:25,borderRadius:13,background:on?"#0F766E":done?"#CCFBF1":"#F1F5F9",color:on?"#fff":done?"#0F766E":"#94A3B8",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800}}>{done?"✓":n}</span>
                  <span className="hide-mobile">{s[1]}</span>
                </span>
              </React.Fragment>);
            })}
          </div>

          {/* 진행 상태 (공통) */}
          {stBusy[0]&&stPhase[0]&&(
            <div style={{display:"flex",alignItems:"center",gap:9,padding:"11px 14px",background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:9,fontSize:18,color:"#1D4ED8",fontWeight:700}}>
              <span className="spin" style={{width:16,height:16,border:"2px solid #BFDBFE",borderTopColor:"#1D4ED8",borderRadius:"50%",display:"inline-block"}}/>
              {stPhase[0]}
            </div>
          )}
          {/* 오류/안내 (공통, 모달 내부 유지 — 앱이 홈으로 튕기지 않음) */}
          {stErr[0]&&!stBusy[0]&&stStep[0]!==4&&(
            <div style={{padding:"12px 14px",background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:9,fontSize:17.5,color:"#991B1B",lineHeight:1.7}}>⚠️ {stErr[0]}</div>
          )}

          {/* ── 1단계: 파일 선택 / 텍스트 붙여넣기 ── */}
          {stStep[0]===1&&(
            <div style={{display:"grid",gap:12}}>
              <div style={{padding:"13px 16px",background:"#ECFDF5",border:"1px solid #A7F3D0",borderRadius:12,fontSize:16,color:"#065F46",lineHeight:1.7}}>
                명부를 올리면 <strong>읽은 내용을 먼저 확인·수정</strong>한 뒤, <strong>지원금 후보</strong>와 <strong>통합고용세액공제</strong>를 <strong>1차 검토</strong>합니다. (확정 아님)
              </div>
              {/* 모드 탭 */}
              <div style={{display:"flex",gap:8}}>
                {[["file","📎 파일 올리기"],["paste","✍️ 텍스트 붙여넣기"]].map(function(m){var on=stMode[0]===m[0];return(
                  <button key={m[0]} type="button" onClick={function(){stMode[1](m[0]);stErr[1]("");}}
                    style={{flex:1,padding:"10px",borderRadius:10,border:"1.5px solid "+(on?"#0F766E":"#E2E8F0"),background:on?"#0F766E":"#fff",color:on?"#fff":"#475569",fontSize:17,fontWeight:800,cursor:"pointer",fontFamily:FF}}>{m[1]}</button>
                );})}
              </div>

              {stMode[0]==="file"&&(
                <React.Fragment>
                  <div style={{border:"2px dashed #99F6E4",borderRadius:14,padding:"22px 18px",background:"#F8FFFE"}}>
                    <div style={{fontSize:38.5,marginBottom:8,textAlign:"center"}}>🗂️</div>
                    <div style={{display:"flex",flexDirection:"column",gap:9,maxWidth:420,margin:"0 auto"}}>
                      <button type="button" onClick={function(){openPicker("pdf");}} className="prog-tap"
                        style={{background:"#0F766E",color:"#fff",border:"none",borderRadius:11,padding:"13px 18px",fontSize:19,fontWeight:800,cursor:"pointer",fontFamily:FF}}>📄 PDF 명부 선택</button>
                      <button type="button" onClick={function(){openPicker("excel");}}
                        style={{background:"#fff",color:"#0F766E",border:"1.5px solid #99F6E4",borderRadius:11,padding:"12px 18px",fontSize:18,fontWeight:800,cursor:"pointer",fontFamily:FF}}>📊 엑셀/CSV 선택</button>
                      <button type="button" onClick={function(){openPicker("any");}}
                        style={{background:"#F1F5F9",color:"#475569",border:"1px solid #E2E8F0",borderRadius:11,padding:"11px 18px",fontSize:17,fontWeight:700,cursor:"pointer",fontFamily:FF}}>📁 파일이 안 보이면 전체 파일에서 선택</button>
                    </div>
                    <div style={{fontSize:15.5,color:"#64748B",marginTop:11,lineHeight:1.7,wordBreak:"keep-all"}}>
                      📱 스마트폰에서는 ‘내 파일’ 또는 ‘구글드라이브’에서 PDF 명부를 선택해주세요.<br/>
                      PDF가 목록에 안 보이면 ‘전체 파일에서 선택’을 눌러 직접 고를 수 있습니다.<br/>
                      사진첩 이미지나 캡처본은 현재 분석하지 않습니다. 글자 선택이 가능한 PDF가 가장 안정적입니다.
                    </div>
                  </div>
                  {/* N: PDF 인식 차이 안내 */}
                  <details style={{fontSize:15,color:"#64748B"}}>
                    <summary style={{cursor:"pointer",fontWeight:700,color:"#475569"}}>PDF가 어떤 건 읽히고 어떤 건 안 읽히나요?</summary>
                    <div style={{marginTop:7,padding:"11px 13px",background:"#F8FAFC",border:"1px solid #EEF2F6",borderRadius:9,lineHeight:1.75}}>
                      같은 PDF라도 저장 방식에 따라 다르게 인식될 수 있습니다.<br/>
                      · <strong>글자 선택/복사가 되는 PDF</strong>: 텍스트가 들어 있어 자동으로 읽을 수 있어요.<br/>
                      · <strong>글자 선택이 안 되는 PDF</strong>: 스캔 이미지 PDF일 가능성이 높아 자동으로 읽기 어렵습니다.<br/>
                      · 일부 PDF는 한글 폰트·보안·출력 방식 때문에 글자 순서가 깨질 수 있습니다(검수 단계에서 직접 수정 가능).<br/>
                      · 가장 안정적인 방법은 <strong>4대보험 EDI / 사회보험통합징수포털</strong>에서 명부를 <strong>엑셀로 내려받아 올리기</strong>입니다.
                    </div>
                  </details>
                  {stFile[0]&&(function(){
                    var ext=fileExt(stFile[0]);
                    var isPdf=isPdfFile(stFile[0]);
                    var isImg=isImageFile(stFile[0]);
                    var supported=isSupportedFile(stFile[0]);
                    return(
                      <div style={{border:"1px solid "+(supported?"#A7F3D0":"#FDE68A"),background:supported?"#F0FDF4":"#FFFBEB",borderRadius:12,padding:"14px 16px",display:"grid",gap:10}}>
                        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                          <span style={{fontSize:29}}>{isPdf?"📄":(ext==="csv"?"📑":supported?"📊":isImg?"🖼️":"📁")}</span>
                          <div style={{minWidth:0,flex:"1 1 220px"}}>
                            <div style={{fontSize:18.5,fontWeight:800,color:"#1E293B",wordBreak:"break-all"}}>선택된 파일: {stFile[0].name}</div>
                            <div style={{fontSize:16,color:"#64748B",marginTop:2}}>형식: {ext?ext.toUpperCase():(isPdf?"PDF":"알 수 없음")} · 크기: {fmtSize(stFile[0].size)} · {supported?"처리 가능":isImg?"이미지(미지원)":"미지원 형식"}</div>
                          </div>
                        </div>
                        <div style={{fontSize:15.5,color:"#475569",lineHeight:1.6}}>파일은 아직 저장되지 않습니다. 브라우저에서만 읽고, 주민등록번호 등 민감정보는 화면에 마스킹합니다.</div>
                        {isPdf&&isMobileEnv()&&(
                          <div style={{padding:"10px 13px",background:"#FEF9C3",border:"1px solid #FDE68A",borderRadius:9,fontSize:15.5,color:"#92400E",lineHeight:1.7}}>💡 스마트폰에서는 PDF 글자 읽기가 제한될 수 있습니다. PDF 내용을 복사해 <strong>‘텍스트 붙여넣기’</strong>로 올리거나, 엑셀 파일로 올리면 더 안정적입니다.</div>
                        )}
                        <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
                          <button type="button" disabled={stBusy[0]} onClick={function(){openPicker("any");}} style={Object.assign({},btnS,{padding:"11px 16px",fontSize:17.5,opacity:stBusy[0]?0.6:1})}>파일 다시 선택</button>
                          <button type="button" disabled={!supported||stBusy[0]} onClick={startFromFile}
                            style={{flex:"1 1 200px",background:(!supported||stBusy[0])?"#CBD5E1":"#0F766E",color:"#fff",border:"none",borderRadius:10,padding:"12px 18px",fontSize:18.5,fontWeight:800,cursor:(!supported||stBusy[0])?"default":"pointer",fontFamily:FF}}>
                            {stBusy[0]?"읽는 중…":isPdf?"PDF에서 글자 읽기 →":"이 파일로 명부 정리하기 →"}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                  {/* H: 파일 선택 로그(접이식) */}
                  <details style={{fontSize:15,color:"#64748B"}}>
                    <summary style={{cursor:"pointer",fontWeight:700,color:"#475569"}}>파일 선택 로그 보기</summary>
                    <div style={{marginTop:6,padding:"9px 12px",background:"#F8FAFC",border:"1px solid #EEF2F6",borderRadius:8,lineHeight:1.8}}>
                      선택 버튼 클릭: {stPick[0].clicked?"예":"아니오"} · 선택기 복귀: {stPick[0].returned?"예":"아니오"}<br/>
                      파일명: {stPick[0].name||"—"} · MIME: {stPick[0].type||"—"} · 확장자: {stPick[0].ext||"—"} · 지원: {stPick[0].supported===null?"—":(stPick[0].supported?"예":"아니오")}<br/>
                      현재 단계: {stStep[0]}단계 · 마지막 오류: {stErr[0]?stErr[0].slice(0,60):"없음"}
                    </div>
                  </details>
                </React.Fragment>
              )}

              {stMode[0]==="paste"&&(
                <div style={{display:"grid",gap:10}}>
                  <div style={{fontSize:18,fontWeight:800,color:"#1E293B"}}>명부 내용을 직접 붙여넣기</div>
                  <div style={{fontSize:15,color:"#64748B",lineHeight:1.6}}>PDF에서 복사한 텍스트나 4대보험 명부 내용을 붙여넣으면, 직원 후보를 찾아 1차 진단합니다.</div>
                  <textarea value={stText[0]} onChange={function(e){stText[1](e.target.value);}} rows={9}
                    placeholder={"여기에 4대보험 가입자 명부 내용을 붙여넣어 주세요.\n예: 이름 / 주민번호 앞자리 / 자격취득일 / 사업장명 등"}
                    style={{width:"100%",boxSizing:"border-box",padding:"13px 15px",fontSize:18,lineHeight:1.7,borderRadius:10,border:"1.5px solid #E2E8F0",fontFamily:FF,resize:"vertical"}}/>
                  <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
                    <button type="button" onClick={goManual} style={Object.assign({},btnS,{padding:"12px 16px",fontSize:17})}>직원 직접 입력</button>
                    <button type="button" onClick={textToCandidates} style={{flex:"1 1 200px",background:"#0F766E",color:"#fff",border:"none",borderRadius:10,padding:"12px",fontSize:18,fontWeight:800,cursor:"pointer",fontFamily:FF}}>붙여넣은 내용으로 명부 정리하기 →</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 2단계: 추출 내용 확인 ── */}
          {stStep[0]===2&&(
            <div style={{display:"grid",gap:11}}>
              <div style={{fontSize:23,fontWeight:800,color:"#1E293B"}}>PDF에서 읽은 내용을 확인해주세요</div>
              <div style={{fontSize:15,color:"#64748B",lineHeight:1.6}}>PDF 양식에 따라 글자가 일부 깨지거나 순서가 어긋날 수 있습니다. 아래 내용을 확인한 뒤, 필요하면 수정하고 다음 단계로 넘어가세요.</div>
              <textarea value={stText[0]} onChange={function(e){stText[1](e.target.value);}} rows={11}
                placeholder={"PDF에서 읽은 내용이 여기에 표시됩니다. 비어 있다면 PDF 내용을 복사해 직접 붙여넣어 주세요."}
                style={{width:"100%",boxSizing:"border-box",padding:"13px 15px",fontSize:18,lineHeight:1.7,borderRadius:10,border:"1.5px solid #E2E8F0",fontFamily:FF,resize:"vertical"}}/>
              <div style={{fontSize:14.5,color:"#92400E",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:9,padding:"9px 12px",lineHeight:1.6}}>
                텍스트가 거의 비어 있다면, 해당 PDF는 스캔 이미지일 가능성이 높습니다. 이 경우 엑셀 파일로 내려받아 올리거나, PDF 내용을 복사해 붙여넣어 주세요.
              </div>
              {/* 분석 로그(접이식) — 추출은 됐는데 후보가 안 잡히는지 진단 */}
              {(function(){
                var quickRrn=(stText[0].match(/\d{6}\s*-\s*[0-9*]/g)||[]).length;
                return(
                  <details style={{fontSize:14.5,color:"#64748B"}}>
                    <summary style={{cursor:"pointer",fontWeight:700}}>분석 로그 보기</summary>
                    <div style={{marginTop:6,padding:"8px 11px",background:"#F8FAFC",border:"1px solid #EEF2F6",borderRadius:8,lineHeight:1.7}}>
                      읽은 글자 수: {stText[0].length}자 · 발견된 주민번호 패턴(원문): 약 {quickRrn}건
                      {stStats[0]&&(<div style={{marginTop:4}}>직전 인식 결과 — 정규화 후 글자 {stStats[0].normLen}자 · 주민번호 {stStats[0].rrnCount}건 · 날짜 {stStats[0].dateCount}개 · 직원 후보 {stStats[0].candCount}명</div>)}
                      {stStats[0]&&stStats[0].preview&&(<div style={{marginTop:4,color:"#94A3B8",wordBreak:"break-all"}}>정규화 미리보기(주민번호 마스킹): {stStats[0].preview}…</div>)}
                    </div>
                  </details>
                );
              })()}
              <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
                <button type="button" onClick={function(){stErr[1]("");stStep[1](1);}} style={Object.assign({},btnS,{padding:"11px 16px",fontSize:17})}>← 파일 다시 선택</button>
                <button type="button" onClick={goManual} style={Object.assign({},btnS,{padding:"11px 16px",fontSize:17})}>직원 직접 입력</button>
                <button type="button" onClick={textToCandidates} style={{flex:"1 1 200px",background:"#0F766E",color:"#fff",border:"none",borderRadius:10,padding:"11px 18px",fontSize:18,fontWeight:800,cursor:"pointer",fontFamily:FF}}>이 내용으로 명부 정리하기 →</button>
              </div>
            </div>
          )}

          {/* ── 3단계: 명부 정리(직원 후보 확인/수정) ── */}
          {stStep[0]===3&&(function(){
            var cands=stCand[0];
            var notExcluded=cands.filter(function(c){return !c.excluded;});
            var needCheck=notExcluded.filter(function(c){return candNeedsCheck(c)&&!c.confirmed;});
            var confirmedCnt=notExcluded.filter(function(c){return c.confirmed;}).length;
            var excludedCnt=cands.length-notExcluded.length;
            var shown=stOnlyCheck[0]?cands.filter(function(c){return !c.excluded&&candNeedsCheck(c)&&!c.confirmed;}):cands;
            var cellS={padding:"8px",verticalAlign:"middle"};
            var smInp={width:"100%",boxSizing:"border-box",padding:"7px 9px",fontSize:17,borderRadius:7,border:"1px solid #E2E8F0",fontFamily:FF};
            return(
              <div style={{display:"grid",gap:12}}>
                <div style={{fontSize:23,fontWeight:800,color:"#1E293B"}}>직원 후보를 확인해주세요</div>
                <div style={{fontSize:17,color:"#64748B",lineHeight:1.65}}>자동으로 찾은 직원 정보입니다. 잘못 읽힌 부분은 수정하고, 빠진 직원은 추가한 뒤 진단을 시작하세요. 주민등록번호는 <strong>900101-1******</strong> 형태로만 표시됩니다.</div>
                {/* 요약 */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:8}}>
                  {[["찾은 직원",notExcluded.length,"#1E293B"],["확인 완료",confirmedCnt,"#059669"],["확인 필요",needCheck.length,"#B45309"],["제외 예정",excludedCnt,"#94A3B8"]].map(function(k){return(
                    <div key={k[0]} style={{background:"#F8FAFC",border:"1px solid #EEF2F6",borderRadius:10,padding:"9px 11px"}}><div style={{fontSize:14,color:"#94A3B8",fontWeight:700}}>{k[0]}</div><div style={{fontSize:20.5,fontWeight:800,color:k[2]}}>{k[1]}명</div></div>
                  );})}
                </div>
                {stStats[0]&&(
                  <details style={{fontSize:14.5,color:"#64748B"}}>
                    <summary style={{cursor:"pointer",fontWeight:700}}>분석 로그 보기</summary>
                    <div style={{marginTop:6,padding:"8px 11px",background:"#F8FAFC",border:"1px solid #EEF2F6",borderRadius:8,lineHeight:1.7}}>읽은 글자 {stStats[0].rawLen||stStats[0].textLen}자 · 정규화 후 {stStats[0].normLen}자 · 주민번호 {stStats[0].rrnCount}건 · 날짜 {stStats[0].dateCount}개 · 직원 후보 {stStats[0].candCount}명</div>
                  </details>
                )}
                <div style={{display:"flex",gap:9,flexWrap:"wrap",alignItems:"center"}}>
                  <button type="button" onClick={addCand} style={Object.assign({},btnS,{padding:"8px 14px",fontSize:15.5})}>+ 직원 직접 추가</button>
                  <button type="button" onClick={confirmAll} style={Object.assign({},btnS,{padding:"8px 14px",fontSize:15.5})}>전체 확인 완료</button>
                  <label style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:15.5,color:"#475569",cursor:"pointer",marginLeft:"auto"}}>
                    <input type="checkbox" checked={stOnlyCheck[0]} onChange={function(e){stOnlyCheck[1](e.target.checked);}}/> 확인 필요만 보기
                  </label>
                </div>
                {cands.length===0?(
                  <div style={{padding:"22px",textAlign:"center",fontSize:16,color:"#94A3B8",border:"1px dashed #E2E8F0",borderRadius:10}}>직원 후보가 없습니다. “+ 직원 직접 추가”로 직접 입력하거나, 이전 단계에서 내용을 보완해주세요.</div>
                ):(
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:17,minWidth:920}}>
                      <thead><tr style={{background:"#F8FAFC",textAlign:"left",color:"#64748B"}}>
                        {["이름","주민(마스킹)","생년월일","성별","나이","입사일","4대보험(연금·건강·산재·고용)","구분","상태","관리"].map(function(h){return <th key={h} style={{padding:"8px",fontWeight:700,whiteSpace:"nowrap",borderBottom:"1px solid #E2E8F0",fontSize:17}}>{h}</th>;})}
                      </tr></thead>
                      <tbody>
                        {shown.map(function(c){
                          var age=PD.calcAge(c.birthDate,stBase[0]);
                          var need=candNeedsCheck(c);
                          return(
                            <tr key={c.id} style={{borderBottom:"1px solid #F1F5F9",opacity:c.excluded?0.5:1}}>
                              <td style={cellS}>
                                <input value={c.name||""} onChange={function(e){updateCand(c.id,{name:e.target.value});}} style={Object.assign({},smInp,{minWidth:84})} placeholder="이름"/>
                                {(function(){var miss=c.ins?[c.ins.np,c.ins.hi,c.ins.wc,c.ins.ei].filter(function(b){return !b;}).length:0;return (miss>=2&&c.rel==="none")?<div style={{fontSize:15.5,fontWeight:700,color:"#C2410C",marginTop:3,whiteSpace:"normal",lineHeight:1.45}}>⚠ 특수관계자·대표자·임원 여부 확인 필요</div>:null;})()}
                              </td>
                              <td style={Object.assign({},cellS,{fontFamily:"monospace",color:"#64748B",whiteSpace:"nowrap"})}>{c.rrnMasked||"—"}</td>
                              <td style={cellS}><input type="date" value={c.birthDate||""} onChange={function(e){updateCand(c.id,{birthDate:e.target.value});}} style={Object.assign({},smInp,{minWidth:130})}/></td>
                              <td style={cellS}>
                                <select value={c.gender||""} onChange={function(e){updateCand(c.id,{gender:e.target.value});}} style={Object.assign({},smInp,{minWidth:60})}>
                                  <option value="">-</option><option value="M">남</option><option value="F">여</option>
                                </select>
                              </td>
                              <td style={Object.assign({},cellS,{whiteSpace:"nowrap",color:"#475569"})}>{age!=null?age+"세":"—"}</td>
                              <td style={cellS}>
                                <input type="date" value={c.hireDate||""} onChange={function(e){updateCand(c.id,{hireDate:e.target.value});}} style={Object.assign({},smInp,{minWidth:130})}/>
                                {c.multiDates&&<div style={{fontSize:12.5,color:"#B45309",marginTop:2}}>취득일 후보 여러 개 · 확인</div>}
                              </td>
                              <td style={Object.assign({},cellS,{whiteSpace:"nowrap"})}>
                                {[["np","연금","국민연금"],["hi","건강","건강보험"],["wc","산재","산재보험"],["ei","고용","고용보험"]].map(function(k){var on=!!(c.ins&&c.ins[k[0]]);return(
                                  <label key={k[0]} title={k[2]} style={{display:"inline-flex",alignItems:"center",gap:3,marginRight:9,fontSize:16,color:on?"#0F766E":"#94A3B8",cursor:"pointer"}}>
                                    <input type="checkbox" checked={on} onChange={function(e){updateIns(c.id,k[0],e.target.checked);}}/>{k[1]}
                                  </label>
                                );})}
                              </td>
                              <td style={cellS}>
                                <select value={c.rel||"none"} onChange={function(e){updateCand(c.id,{rel:e.target.value});}} style={Object.assign({},smInp,{minWidth:96,color:(c.rel&&c.rel!=="none")?"#B45309":"#475569"})} title="대표자/임원/특수관계자 여부">
                                  <option value="none">해당 없음</option><option value="ceo">대표자</option><option value="exec">임원</option><option value="special">특수관계자</option>
                                </select>
                              </td>
                              <td style={Object.assign({},cellS,{whiteSpace:"nowrap"})}>
                                {c.confirmed?<span style={{fontSize:15.5,fontWeight:800,color:"#059669"}}>✓ 확인</span>:need?<span style={{fontSize:15.5,fontWeight:800,color:"#B45309"}}>확인 필요</span>:<span style={{fontSize:15.5,color:"#64748B"}}>—</span>}
                              </td>
                              <td style={Object.assign({},cellS,{whiteSpace:"nowrap"})}>
                                <button type="button" onClick={function(){updateCand(c.id,{confirmed:!c.confirmed});}} style={{marginRight:5,padding:"4px 8px",borderRadius:6,border:"1px solid "+(c.confirmed?"#A7F3D0":"#E2E8F0"),background:c.confirmed?"#ECFDF5":"#fff",color:c.confirmed?"#059669":"#64748B",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:FF}}>확인</button>
                                <button type="button" onClick={function(){updateCand(c.id,{excluded:!c.excluded});}} style={{padding:"4px 8px",borderRadius:6,border:"1px solid "+(c.excluded?"#FECACA":"#E2E8F0"),background:c.excluded?"#FEF2F2":"#fff",color:c.excluded?"#DC2626":"#64748B",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:FF}}>{c.excluded?"되돌리기":"제외"}</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
                  <button type="button" onClick={function(){stErr[1]("");stStep[1](1);}} style={Object.assign({},btnS,{padding:"11px 16px",fontSize:17})}>← 처음으로</button>
                  <button type="button" onClick={runDiagnosis} style={{flex:"1 1 200px",background:"#0F766E",color:"#fff",border:"none",borderRadius:10,padding:"11px 18px",fontSize:18,fontWeight:800,cursor:"pointer",fontFamily:FF}}>이 명부로 자동진단 시작 →</button>
                </div>
              </div>
            );
          })()}

          {stStep[0]===4&&stEmps[0]&&analysis&&(
            <div style={{display:"grid",gap:16}}>
              <div style={{padding:"11px 15px",background:"#F0FDFA",border:"1px solid #99F6E4",borderRadius:10,fontSize:17,color:"#0F766E",lineHeight:1.7}}>
                이 결과는 <strong>사용자가 확인한 명부</strong>를 기준으로 한 <strong>1차 검토</strong>입니다. 실제 신청 가능 여부와 세액공제 금액은 공식 요건과 세무 검토가 필요합니다.
              </div>
              {stMissing[0]>0&&(
                <div style={{padding:"10px 14px",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:10,fontSize:15,color:"#92400E",lineHeight:1.6}}>
                  ⚠️ 일부 항목(이름·생년월일·입사일 등)이 확인되지 않은 직원이 <strong>{stMissing[0]}명</strong> 있습니다. 해당 항목은 “확인 필요”로 반영되며, 이전 단계(명부 정리)에서 보완하면 더 정확합니다.
                </div>
              )}
              {/* 명부 최신성 경고 (I) */}
              {stale&&stale.level!=="ok"&&(
                <div style={{padding:"11px 14px",background:stale.level==="high"?"#FEF2F2":"#FFFBEB",border:"1px solid "+(stale.level==="high"?"#FECACA":"#FDE68A"),borderRadius:10,fontSize:16,color:stale.level==="high"?"#991B1B":"#92400E",lineHeight:1.7}}>
                  🕒 이 명부는 <strong>발급일({stIssueDate[0]}) 기준</strong> 자료로, 분석 기준일({stBase[0]})까지 <strong>약 {stale.days}일</strong> 경과했습니다. 현재 재직자·4대보험 가입 상태가 달라졌을 수 있으니 최신 명부로 재검토하세요.
                  {stale.level==="high"&&<span> 발급일로부터 90일이 지난 경우 발급사실 확인 가능 기간도 지났을 수 있습니다.</span>}
                </div>
              )}
              {/* 상단 요약 — 핵심 3개만 크게 (Toss 스타일) */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
                {[
                  {l:"총 직원",v:analysis.counts.totalEmp+"명",c:"#1E293B"},
                  {l:"청년 추정",v:analysis.counts.youthCount+"명",c:"#0F766E"},
                  {l:"1차 검토 후보",v:analysis.candidateSubsidyCount+"건",c:"#1D4ED8"},
                ].map(function(k){return(
                  <div key={k.l} style={{background:"#fff",border:"1px solid #EEF2F6",borderRadius:14,padding:"18px 14px",textAlign:"center",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
                    <div style={{fontSize:15,color:"#94A3B8",fontWeight:700,marginBottom:7}}>{k.l}</div>
                    <div style={{fontSize:30,fontWeight:800,color:k.c,letterSpacing:"-0.5px",wordBreak:"keep-all"}}>{k.v}</div>
                  </div>
                );})}
              </div>
              {/* 확인 필요 요약 — 한 줄 컴팩트 스트립 */}
              {(analysis.eiCheckCount+analysis.wcCheckCount+analysis.relCheckCount)>0&&(
                <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",padding:"12px 15px",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:12,fontSize:15,color:"#92400E",fontWeight:600}}>
                  <span style={{fontSize:16}}>⚠️ 확인 필요</span>
                  <span>고용보험 {analysis.eiCheckCount}명</span><span style={{color:"#FCD34D"}}>·</span>
                  <span>산재보험 {analysis.wcCheckCount}명</span><span style={{color:"#FCD34D"}}>·</span>
                  <span>특수관계자·임원 {analysis.relCheckCount}명</span>
                </div>
              )}

              {/* 기준일 + 다시 올리기 */}
              <div style={{display:"flex",alignItems:"flex-end",gap:12,flexWrap:"wrap"}}>
                <div>
                  <label style={labS}>나이 계산 기준일</label>
                  <input type="date" value={stBase[0]} onChange={function(e){stBase[1](e.target.value);}} style={Object.assign({},inpS,{width:"auto"})}/>
                </div>
                <div>
                  <label style={labS}>귀속연도</label>
                  <input type="number" value={stYear[0]} onChange={function(e){stYear[1](Number(e.target.value)||stYear[0]);}} style={Object.assign({},inpS,{width:110})}/>
                </div>
                <button onClick={reset} style={Object.assign({},btnS,{padding:"9px 14px",fontSize:15.5})}>↻ 다른 명부 올리기</button>
              </div>

              {/* 추가 입력 카드 (E: 전년/올해 구분 · F: 소재지) — Toss 스타일: 기본 접힘 */}
              <details style={{borderRadius:14,border:"1px solid #E2E8F0",background:"#F8FAFC",overflow:"hidden"}}>
                <summary style={{cursor:"pointer",padding:"15px 16px",fontSize:20.5,fontWeight:800,color:"#1E293B",listStyle:"none"}}>➕ 통합고용세액공제 입력 <span style={{fontSize:17,fontWeight:600,color:"#94A3B8"}}>(전년도·소재지 입력 → 펼치기)</span></summary>
              <div style={{background:"#F8FAFC",padding:"0 16px 18px"}}>

                {/* 소재지: 수도권/비수도권 세그먼트 (H) */}
                <div style={{marginBottom:14}}>
                  <label style={labS}>사업장 소재지</label>
                  <div style={{display:"inline-flex",border:"1.5px solid #E2E8F0",borderRadius:10,overflow:"hidden"}}>
                    {[["metro","수도권 (서울·경기·인천)"],["local","비수도권 / 지방"]].map(function(o){var on=stRegion[0]===o[0];return(
                      <button key={o[0]} type="button" onClick={function(){stRegion[1](o[0]);}} style={{padding:"10px 16px",fontSize:18,fontWeight:800,border:"none",background:on?"#0F766E":"#fff",color:on?"#fff":"#475569",cursor:"pointer",fontFamily:FF}}>{o[1]}</button>
                    );})}
                  </div>
                  <div style={{fontSize:15.5,color:"#64748B",marginTop:7,lineHeight:1.6}}>통합고용세액공제 예상 검토는 사업장 소재지에 따라 달라질 수 있습니다. 이번 단계에서는 <strong>수도권/비수도권</strong> 기준으로 1차 검토합니다. (경기도 시흥시는 수도권) <span style={{color:"#B45309"}}>금액 단가는 최신 법령 확인 필요·직접 수정 가능</span></div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12,marginBottom:14}}>
                  <div><label style={labS}>기업 구분</label>
                    <select value={stSize[0]} onChange={function(e){stSize[1](e.target.value);}} style={inpS}>
                      <option value="sme">중소기업</option><option value="mid">중견기업</option><option value="other">기타/확인 필요</option>
                    </select></div>
                  <div><label style={labS}>업종</label>
                    <select value={stIndustry[0]} onChange={function(e){stIndustry[1](e.target.value);}} style={inpS}>
                      <option value="normal">일반 업종</option><option value="excluded">소비성 서비스업 등 제외 가능성</option><option value="check">확인 필요</option>
                    </select></div>
                </div>

                {/* 전년도(블루) / 올해(그린) 구분 */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12}}>
                  <div style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:10,padding:"13px 14px"}}>
                    <div style={{fontSize:17,fontWeight:800,color:"#1D4ED8",marginBottom:9}}>전년도 (직접 입력)</div>
                    <label style={labS}>전년도 평균 상시근로자 수 <span style={{color:"#94A3B8",fontWeight:500}}>(전체)</span></label>
                    <div style={{display:"flex",gap:6,marginBottom:9}}>
                      <input type="number" min="0" placeholder="숫자" value={stPrevTotal[0]==="unknown"?"":stPrevTotal[0]} disabled={stPrevTotal[0]==="unknown"} onChange={function(e){stPrevTotal[1](e.target.value);}} style={inpS}/>
                      <button onClick={function(){stPrevTotal[1](stPrevTotal[0]==="unknown"?"":"unknown");}} style={{flexShrink:0,padding:"0 11px",borderRadius:9,border:"1.5px solid "+(stPrevTotal[0]==="unknown"?"#1D4ED8":"#E2E8F0"),background:stPrevTotal[0]==="unknown"?"#1D4ED8":"#fff",color:stPrevTotal[0]==="unknown"?"#fff":"#64748B",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:FF}}>모름</button>
                    </div>
                    <label style={labS}>전년도 청년 등 상시근로자 수</label>
                    <div style={{display:"flex",gap:6}}>
                      <input type="number" min="0" placeholder="숫자" value={stPrevYouth[0]==="unknown"?"":stPrevYouth[0]} disabled={stPrevYouth[0]==="unknown"} onChange={function(e){stPrevYouth[1](e.target.value);}} style={inpS}/>
                      <button onClick={function(){stPrevYouth[1](stPrevYouth[0]==="unknown"?"":"unknown");}} style={{flexShrink:0,padding:"0 11px",borderRadius:9,border:"1.5px solid "+(stPrevYouth[0]==="unknown"?"#1D4ED8":"#E2E8F0"),background:stPrevYouth[0]==="unknown"?"#1D4ED8":"#fff",color:stPrevYouth[0]==="unknown"?"#fff":"#64748B",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:FF}}>모름</button>
                    </div>
                  </div>
                  <div style={{background:"#ECFDF5",border:"1px solid #A7F3D0",borderRadius:10,padding:"13px 14px"}}>
                    <div style={{fontSize:17,fontWeight:800,color:"#0F766E",marginBottom:9}}>올해 (명부 자동추정 · 수정 가능)</div>
                    <label style={labS}>올해 평균 상시근로자 수 <span style={{color:"#94A3B8",fontWeight:500}}>(전체)</span></label>
                    <input type="number" min="0" value={stCurTotal[0]} onChange={function(e){stCurTotal[1](e.target.value);}} style={Object.assign({},inpS,{marginBottom:9})}/>
                    <label style={labS}>올해 청년 등 상시근로자 수</label>
                    <input type="number" min="0" value={stCurYouth[0]} onChange={function(e){stCurYouth[1](e.target.value);}} style={inpS}/>
                  </div>
                </div>
                {/* 검증 경고 (D) */}
                {estimate.overYouth&&(
                  <div style={{marginTop:12,padding:"11px 13px",background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:9,fontSize:16,color:"#991B1B",fontWeight:700,lineHeight:1.7}}>
                    ⚠️ 청년 등 증가 인원({estimate.incYouth}명)이 전체 상시근로자 증가 인원({estimate.incTotal}명)보다 큽니다. 전년도 청년 수 또는 올해 상시근로자 수 입력값을 재확인하세요. (예상 공제액은 입력값 재확인 전까지 신뢰할 수 없습니다)
                  </div>
                )}
              </div>
              </details>

              {/* 탭 (G: 글자 확대 · L: 추가 확인자료) */}
              <div style={{display:"flex",gap:7,borderBottom:"2px solid #F1F5F9",flexWrap:"wrap"}}>
                {[{k:"emp",l:"직원별 진단"},{k:"subsidy",l:"지원금별 요약"},{k:"tax",l:"통합고용세액공제 예상"},{k:"total",l:"💰 총 혜택 요약"},{k:"docs",l:"추가 확인자료"}].map(function(t){var on=stTab[0]===t.k;return(
                  <button key={t.k} onClick={function(){stTab[1](t.k);}} style={{padding:"11px 16px",fontSize:20,fontWeight:800,border:"none",background:"none",color:on?"#0F766E":"#94A3B8",borderBottom:"2px solid "+(on?"#0F766E":"transparent"),marginBottom:-2,cursor:"pointer",fontFamily:FF}}>{t.l}</button>
                );})}
              </div>

              {/* 탭: 직원별 진단 */}
              {stTab[0]==="emp"&&(
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:17.5}}>
                    <thead><tr style={{background:"#F8FAFC",textAlign:"left",color:"#64748B"}}>
                      {["직원명","주민(마스킹)","나이","성별","입사일","청년 추정","1차 검토 후보 / 확인 필요"].map(function(h){return <th key={h} style={{padding:"9px 10px",fontWeight:700,whiteSpace:"nowrap",borderBottom:"1px solid #E2E8F0",fontSize:17}}>{h}</th>;})}
                    </tr></thead>
                    <tbody>
                      {analysis.rows.map(function(r,idx){var e=r.emp,d=r.diag;
                        var flags=[];
                        if(d.eiNeedsCheck)flags.push("고용보험 확인 필요");
                        if(d.wcNeedsCheck)flags.push("산재보험 확인 필요");
                        if(d.onlyNpHi)flags.push("연금·건강만 가입 확인");
                        if(d.relCheck)flags.push("특수관계자·임원 여부 확인 필요");
                        return(
                        <tr key={idx} style={{borderBottom:"1px solid #F1F5F9",opacity:d.active?1:0.55}}>
                          <td style={{padding:"10px",fontWeight:700,color:"#1E293B",fontSize:19,minWidth:88}}>
                            {e.name}{!d.active&&<span style={{marginLeft:6,fontSize:14.5,color:"#94A3B8"}}>(상실 추정)</span>}
                            {flags.length>0&&<div style={{marginTop:3,fontSize:14.5,fontWeight:700,color:"#B45309",lineHeight:1.5,whiteSpace:"normal"}}>{flags.join(" · ")}</div>}
                          </td>
                          <td style={{padding:"10px",color:"#64748B",whiteSpace:"nowrap",fontFamily:"monospace",fontSize:17}}>{e.rrnMasked||"—"}</td>
                          <td style={{padding:"10px",whiteSpace:"nowrap",fontSize:18}}>{d.age!=null?d.age+"세":"—"}</td>
                          <td style={{padding:"10px",whiteSpace:"nowrap",fontSize:18}}>{e.gender==="M"?"남":e.gender==="F"?"여":"—"}</td>
                          <td style={{padding:"10px",whiteSpace:"nowrap",color:"#475569",fontSize:17.5}}>{e.hireDate||"—"}</td>
                          <td style={{padding:"10px",whiteSpace:"nowrap"}}>{d.isYouth?<span style={{fontSize:15.5,fontWeight:800,color:"#0F766E"}}>청년 추정</span>:<span style={{color:"#CBD5E1"}}>—</span>}</td>
                          <td style={{padding:"10px"}}>
                            {d.candidates.length===0?<span style={{color:"#94A3B8",fontSize:17}}>현재 자료만으로 판단 불가</span>:(
                              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                                {d.candidates.map(function(c,ci){return(
                                  <span key={ci} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:999,background:(PD.LEVELS[c.level]||PD.LEVELS.unknown).bg,border:"1px solid "+(PD.LEVELS[c.level]||PD.LEVELS.unknown).bd}}>
                                    <span style={{fontSize:15.5,fontWeight:800,color:(PD.LEVELS[c.level]||PD.LEVELS.unknown).color}}>{PD.subsidyName(c.key)}</span>
                                  </span>
                                );})}
                              </div>
                            )}
                          </td>
                        </tr>
                      );})}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 탭: 지원금별 요약 */}
              {stTab[0]==="subsidy"&&(
                <div style={{display:"grid",gap:10}}>
                  {analysis.subsidySummary.map(function(s){var cm=PD.CONFIDENCE_META[s.confidence]||PD.CONFIDENCE_META.more;return(
                    <div key={s.key} style={{border:"1px solid #EEF2F6",borderRadius:12,padding:"14px 16px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                      <div style={{flex:"1 1 260px",minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                          <span style={{fontSize:20.5,fontWeight:800,color:"#1E293B"}}>{s.name}</span>
                          <span style={{fontSize:14.5,fontWeight:800,padding:"2px 9px",borderRadius:999,background:cm.bg,color:cm.color,border:"1px solid "+cm.color+"33"}}>신뢰도: {cm.label}</span>
                        </div>
                        <div style={{fontSize:15.5,color:"#64748B",marginTop:5,lineHeight:1.55}}>사유: {s.confReason||s.note}</div>
                      </div>
                      <div style={{display:"flex",gap:16,flexShrink:0}}>
                        <div style={{textAlign:"center"}}><div style={{fontSize:14,color:"#94A3B8",fontWeight:700}}>후보</div><div style={{fontSize:23,fontWeight:800,color:"#1D4ED8"}}>{s.candidateCount}</div></div>
                        <div style={{textAlign:"center"}}><div style={{fontSize:14,color:"#94A3B8",fontWeight:700}}>확인 필요</div><div style={{fontSize:23,fontWeight:800,color:"#B45309"}}>{s.check}</div></div>
                        <div style={{textAlign:"center"}}><div style={{fontSize:14,color:"#94A3B8",fontWeight:700}}>추가자료</div><div style={{fontSize:23,fontWeight:800,color:"#64748B"}}>{s.more}</div></div>
                      </div>
                      <button type="button" onClick={function(e){e.preventDefault();e.stopPropagation();try{window.open(s.site,"_blank","noopener,noreferrer");}catch(err){void err;}}} style={{flexShrink:0,fontSize:15.5,fontWeight:700,color:"#0F766E",background:"#fff",border:"1px solid #99F6E4",borderRadius:8,padding:"8px 12px",cursor:"pointer",fontFamily:FF}}>공식 안내 ↗</button>
                    </div>
                  );})}
                  <div style={{padding:"10px 14px",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:10,fontSize:15.5,color:"#92400E",lineHeight:1.7}}>
                    이 결과는 4대보험 명부 기준 1차 검토입니다. 실제 신청 가능 여부는 공식 요건과 추가자료 확인이 필요합니다.
                  </div>
                  {/* 하단 큰 요약: 조건 충족 시 최대 예상 지원금 */}
                  <div style={{background:"#F0FDFA",border:"1px solid #99F6E4",borderRadius:14,padding:"18px 16px",textAlign:"center"}}>
                    <div style={{fontSize:18,fontWeight:700,color:"#0F766E",marginBottom:6}}>조건 충족 시 최대 예상 지원금 총액</div>
                    <div style={{fontSize:38.5,fontWeight:800,color:"#0F766E",letterSpacing:"-0.5px"}}>{subsidyMax>0?PD.formatWon(subsidyMax):"검토 필요"}</div>
                    <div style={{fontSize:15,color:"#94A3B8",marginTop:6}}>최대 가능 추정 · 1차 (확정 아님)</div>
                  </div>
                </div>
              )}

              {/* 탭: 통합고용세액공제 예상 */}
              {stTab[0]==="tax"&&(
                <div style={{display:"grid",gap:13}}>
                  <div style={{padding:"11px 14px",background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:10,fontSize:16,color:"#991B1B",lineHeight:1.7}}>
                    ⚠️ 아래 금액은 <strong>확정 공제액이 아니라 입력값 기준 1차 추정</strong>입니다. 단가는 귀속연도별 <strong>법령표 확인이 필요</strong>하며 직접 수정할 수 있습니다. 실제 공제액은 <strong>세무대리인 검토와 최신 법령 확인</strong>이 필요합니다.
                  </div>
                  {estimate.overYouth&&(
                    <div style={{padding:"11px 14px",background:"#FFF7ED",border:"1px solid #FDBA74",borderRadius:10,fontSize:16,color:"#9A3412",fontWeight:700,lineHeight:1.7}}>
                      🔎 입력값 재확인 필요: 청년 등 증가({estimate.incYouth}명)가 전체 증가({estimate.incTotal}명)를 초과합니다. 입력값을 바로잡기 전까지 예상 공제액을 신뢰하지 마세요.
                    </div>
                  )}

                  {/* 1) 명부 기준 직원 분류 */}
                  <div style={{border:"1px solid #EEF2F6",borderRadius:12,padding:"13px 15px"}}>
                    <div style={{fontSize:17,fontWeight:800,color:"#1E293B",marginBottom:9}}>① 명부 기준 직원 분류</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10}}>
                      {[["전체 직원",analysis.counts.totalEmp],["청년 등 추정",analysis.counts.youthCount],["일반 추정",analysis.counts.generalCount],["신규 입사 추정",analysis.counts.newHireCount]].map(function(k){return(
                        <div key={k[0]} style={{background:"#F8FAFC",borderRadius:10,padding:"10px 12px"}}><div style={{fontSize:14.5,color:"#94A3B8",fontWeight:700}}>{k[0]}</div><div style={{fontSize:21.5,fontWeight:800,color:"#1E293B"}}>{k[1]}명</div></div>
                      );})}
                    </div>
                  </div>

                  {/* 2) 예상 증가 인원 */}
                  <div style={{border:"1px solid #EEF2F6",borderRadius:12,padding:"13px 15px"}}>
                    <div style={{fontSize:17,fontWeight:800,color:"#1E293B",marginBottom:9}}>② 예상 증가 인원 <span style={{fontSize:14.5,color:"#94A3B8",fontWeight:600}}>(올해 − 전년)</span></div>
                    {!estimate.computable?(
                      <div style={{fontSize:15.5,color:"#B45309"}}>전년도 평균 상시근로자 수를 입력하면 증가 인원을 계산합니다. (현재 “모름” 또는 미입력)</div>
                    ):(
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10}}>
                        {[["전체 증가",estimate.incTotal],["청년 등 증가",estimate.incYouth],["일반 증가",estimate.incNormal]].map(function(k){return(
                          <div key={k[0]} style={{background:"#F0FDFA",borderRadius:10,padding:"10px 12px"}}><div style={{fontSize:14.5,color:"#0F766E",fontWeight:700}}>{k[0]}</div><div style={{fontSize:21.5,fontWeight:800,color:"#0F766E"}}>{k[1]==null?"확인 필요":k[1]+"명"}</div></div>
                        );})}
                      </div>
                    )}
                  </div>

                  {/* 3) 단가 + 예상 세액공제 */}
                  <div style={{border:"1px solid #EEF2F6",borderRadius:12,padding:"13px 15px"}}>
                    <div style={{fontSize:18.5,fontWeight:800,color:"#1E293B",marginBottom:4}}>③ 예상 세액공제 <span style={{fontSize:15,color:"#B45309",fontWeight:700}}>· 입력값 기준 1차 추정 · 법령표 확인 필요</span></div>
                    <div style={{fontSize:14.5,color:"#94A3B8",marginBottom:11}}>1인당 단가(만원)는 {stSize[0]==="sme"?"중소기업":stSize[0]==="mid"?"중견기업":"기타"}·{stRegion[0]==="metro"?"수도권":"지방"} 기본값입니다. 실제 귀속연도 법령표에 맞게 수정하세요.</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:13}}>
                      <div><label style={labS}>청년 등 1인당 단가(만원)</label><input type="number" min="0" value={stUnitY[0]} onChange={function(e){stUnitY[1](Number(e.target.value)||0);}} style={inpS}/></div>
                      <div><label style={labS}>일반 1인당 단가(만원)</label><input type="number" min="0" value={stUnitN[0]} onChange={function(e){stUnitN[1](Number(e.target.value)||0);}} style={inpS}/></div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>
                      {[["청년 등 증가분",estimate.creditYouth],["일반 증가분",estimate.creditNormal],["총 예상 공제액",estimate.creditTotal]].map(function(k,ki){return(
                        <div key={k[0]} style={{background:ki===2?"#F5F3FF":"#F8FAFC",border:ki===2?"1px solid #DDD6FE":"1px solid #EEF2F6",borderRadius:10,padding:"12px 14px"}}>
                          <div style={{fontSize:15,color:"#94A3B8",fontWeight:700}}>{k[0]}</div>
                          <div style={{fontSize:ki===2?22:19,fontWeight:800,color:ki===2?"#7C3AED":"#1E293B"}}>{estimate.overYouth?"입력값 재확인":(k[1]==null?"검토 필요":PD.formatWon(k[1]))}</div>
                        </div>
                      );})}
                    </div>
                    <div style={{marginTop:10,fontSize:15.5,fontWeight:700,color:"#DC2626"}}>※ 확정 아님 / 입력값 기준 1차 추정 / 세무 검토 필요</div>
                  </div>

                  {/* 4) 확인 필요 체크리스트 */}
                  <div style={{border:"1px solid #EEF2F6",borderRadius:12,padding:"13px 15px"}}>
                    <div style={{fontSize:17,fontWeight:800,color:"#1E293B",marginBottom:9}}>④ 확인 필요 체크리스트</div>
                    <div style={{display:"grid",gap:6}}>
                      {PD.TAX_CHECKLIST.map(function(t){return(
                        <div key={t} style={{display:"flex",alignItems:"center",gap:8,fontSize:17,color:"#475569"}}><span>⬜</span><span>{t}</span></div>
                      );})}
                    </div>
                  </div>
                  {/* 하단 강조: 총 예상 공제액 재강조 */}
                  <div style={{background:"#F5F3FF",border:"1px solid #DDD6FE",borderRadius:14,padding:"18px 16px",textAlign:"center"}}>
                    <div style={{fontSize:18,fontWeight:700,color:"#7C3AED",marginBottom:6}}>총 예상 세액공제액</div>
                    <div style={{fontSize:38.5,fontWeight:800,color:"#7C3AED",letterSpacing:"-0.5px"}}>{estimate.overYouth?"입력값 재확인 필요":(estimate.computable&&estimate.creditTotal!=null?PD.formatWon(estimate.creditTotal):"전년도 인원 입력 후 산출")}</div>
                    <div style={{fontSize:15,color:"#94A3B8",marginTop:6}}>입력값 기준 1차 추정 · 확정 아님 / 세무 검토 필요</div>
                  </div>
                </div>
              )}

              {/* 탭: 총 혜택 요약 (영업용) */}
              {stTab[0]==="total"&&(
                <div style={{display:"grid",gap:16}}>
                  <div style={{fontSize:18,color:"#64748B",lineHeight:1.7,textAlign:"center"}}>조건이 모두 충족됐을 때 받을 수 있는 <strong>최대 예상 혜택</strong>을 한눈에 보여줍니다. (최대 가능 추정 · 1차)</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>
                    <div style={{background:"#F0FDFA",border:"1px solid #99F6E4",borderRadius:14,padding:"20px 16px",textAlign:"center"}}>
                      <div style={{fontSize:18,fontWeight:700,color:"#0F766E",marginBottom:8}}>최대 예상 지원금</div>
                      <div style={{fontSize:36,fontWeight:800,color:"#0F766E",letterSpacing:"-0.5px"}}>{subsidyMax>0?PD.formatWon(subsidyMax):"검토 필요"}</div>
                      <div style={{fontSize:15,color:"#94A3B8",marginTop:6}}>1차 검토 후보 기준 최대 가능 추정</div>
                    </div>
                    <div style={{background:"#F5F3FF",border:"1px solid #DDD6FE",borderRadius:14,padding:"20px 16px",textAlign:"center"}}>
                      <div style={{fontSize:18,fontWeight:700,color:"#7C3AED",marginBottom:8}}>최대 예상 세액공제</div>
                      <div style={{fontSize:36,fontWeight:800,color:"#7C3AED",letterSpacing:"-0.5px"}}>{creditMax>0?PD.formatWon(creditMax):(estimate.overYouth?"입력값 재확인":"검토 필요")}</div>
                      <div style={{fontSize:15,color:"#94A3B8",marginTop:6}}>통합고용세액공제 입력값 기준 추정</div>
                    </div>
                  </div>
                  <div style={{background:"linear-gradient(90deg,#0F766E,#0EA5A0)",borderRadius:16,padding:"26px 18px",textAlign:"center",boxShadow:"0 4px 16px rgba(15,118,110,0.25)"}}>
                    <div style={{fontSize:20.5,fontWeight:800,color:"#CCFBF1",marginBottom:8}}>최대 예상 총 혜택</div>
                    <div style={{fontSize:50.5,fontWeight:800,color:"#fff",letterSpacing:"-1px",lineHeight:1.1,wordBreak:"keep-all"}}>{totalBenefit>0?PD.formatWon(totalBenefit):"추가 입력·검토 필요"}</div>
                    <div style={{fontSize:17,color:"#99F6E4",marginTop:10,fontWeight:600}}>지원금 + 세액공제 합산 (최대 가능 추정)</div>
                  </div>
                  <div style={{fontSize:15,color:"#94A3B8",textAlign:"center",lineHeight:1.7}}>실제 지원 가능 여부와 금액은 추가자료 및 요건 확인 후 달라질 수 있습니다. (확정 금액 아님)</div>
                </div>
              )}

              {/* 탭: 추가 확인자료 (L) */}
              {stTab[0]==="docs"&&(
                <div style={{display:"grid",gap:13}}>
                  <div style={{padding:"11px 14px",background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:10,fontSize:16,color:"#1D4ED8",lineHeight:1.7}}>
                    아래 자료를 확보하면 1차 검토 후보를 실제 신청 가능 여부로 좁힐 수 있습니다. 상담 시 대표님께 요청할 목록입니다.
                  </div>
                  <div style={{border:"1px solid #EEF2F6",borderRadius:12,padding:"14px 16px"}}>
                    <div style={{fontSize:19,fontWeight:800,color:"#1E293B",marginBottom:4}}>공통 추가 확인자료</div>
                    <div style={{fontSize:15.5,color:"#94A3B8",marginBottom:10}}>요건에 따라 필요할 수 있는 자료입니다(확정 필수서류 아님).</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:7}}>
                      {PD.EMP_DOC_CHECKLIST.map(function(t){return(
                        <div key={t} style={{display:"flex",alignItems:"center",gap:8,fontSize:17,color:"#475569"}}><span>⬜</span><span>{t}</span></div>
                      );})}
                    </div>
                  </div>
                  <div style={{border:"1px solid #EEF2F6",borderRadius:12,padding:"14px 16px"}}>
                    <div style={{fontSize:19,fontWeight:800,color:"#1E293B",marginBottom:10}}>지원금별 확인자료 <span style={{fontSize:15,color:"#94A3B8",fontWeight:600}}>(요건에 따라 필요할 수 있음)</span></div>
                    <div style={{display:"grid",gap:10}}>
                      {analysis.subsidySummary.filter(function(s){return s.candidateCount>0||s.more>0;}).map(function(s){return(
                        <div key={s.key} style={{background:"#F8FAFC",borderRadius:10,padding:"11px 13px"}}>
                          <div style={{fontSize:17.5,fontWeight:800,color:"#1E293B",marginBottom:5}}>{s.name}</div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                            {(s.docs||[]).map(function(dn){return <span key={dn} style={{fontSize:15,color:"#475569",background:"#fff",border:"1px solid #E2E8F0",borderRadius:8,padding:"4px 9px"}}>📄 {dn}</span>;})}
                          </div>
                        </div>
                      );})}
                      {analysis.subsidySummary.filter(function(s){return s.candidateCount>0||s.more>0;}).length===0&&(
                        <div style={{fontSize:16,color:"#94A3B8"}}>표시할 후보가 없습니다. 명부 정리에서 직원 정보를 보완해 보세요.</div>
                      )}
                    </div>
                  </div>
                  {(analysis.eiCheckCount>0||analysis.wcCheckCount>0)&&(
                    <div style={{padding:"11px 14px",background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:10,fontSize:16,color:"#991B1B",lineHeight:1.7}}>
                      고용보험 확인 필요 {analysis.eiCheckCount}명 · 산재보험 확인 필요 {analysis.wcCheckCount}명. 고용·산재 미가입/확인 불가 직원은 <strong>대표자·임원·특수관계자 여부</strong>와 <strong>고용보험 피보험자격</strong>을 먼저 확인하세요.
                    </div>
                  )}
                </div>
              )}

              {/* CTA + 단계 이동(A) */}
              <div style={{borderTop:"1px solid #F1F5F9",paddingTop:14,display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
                <button onClick={function(){stStep[1](3);}} style={Object.assign({},btnS,{padding:"11px 16px",fontSize:17})}>← 명부 정리로 돌아가기</button>
                <button onClick={doCopy} style={Object.assign({},btnP,{background:stCopied[0]?"#059669":"#0F766E",padding:"12px 20px",fontSize:18.5})}>{stCopied[0]?"✓ 복사됨 (주민번호 미포함)":"📋 상담용 요약 복사"}</button>
                <button onClick={function(){toast("고객 보고서 반영·업체 임시저장·PDF 내보내기는 다음 단계로 준비 중입니다.","success");}} style={Object.assign({},btnS,{padding:"11px 18px",fontSize:17,color:"#94A3B8"})}>🗂️ 보고서 반영·저장·PDF (다음 단계)</button>
                <span style={{fontSize:14.5,color:"#94A3B8",marginLeft:"auto"}}>분석은 브라우저에서만 처리 · 저장되지 않음</span>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </React.Fragment>
  );
}


export default PayrollDiagnosis;
