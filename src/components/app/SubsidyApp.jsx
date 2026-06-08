import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { TeamSettings } from "../TeamSettings";
import { validateUploadFile, ALLOWED_FILE_EXT, MAX_FILE_MB } from "../../hooks/useData";

// ── 상수 ──────────────────────────────────────────────────
var MIN_WAGE_2026 = 10320;
var MIN_WAGE_MONTH_2026 = 2156880;
var BOSU_FLOOR_2026 = 1240000;
var GROUP_COLORS = {
  "신규채용":{base:"#2563EB",light:"#DBEAFE",text:"#1D4ED8",dark:"#1E40AF",badge:"#EFF6FF",icon:"🆕"},
  "재직자유지":{base:"#475569",light:"#E2E8F0",text:"#334155",dark:"#1E293B",badge:"#F1F5F9",icon:"🔄"},
  "육아":{base:"#059669",light:"#D1FAE5",text:"#047857",dark:"#065F46",badge:"#ECFDF5",icon:"🤱"},
  "커스텀":{base:"#6B7280",light:"#F1F5F9",text:"#4B5563",dark:"#374151",badge:"#F8FAFC",icon:"⚙️"}
};
function gc(group,key){ var g=GROUP_COLORS[group]||GROUP_COLORS["커스텀"]; return g[key]||g.base; }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).substr(2,6); }
function ruuid(){ return crypto.randomUUID?crypto.randomUUID():"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c==="x"?r:(r&0x3|0x8)).toString(16);}); }
function fD(ds){ if(!ds) return ""; var d=new Date(ds); return d.getFullYear()+"."+(d.getMonth()+1)+"."+d.getDate(); }
function fDFull(ds){ if(!ds) return ""; var d=new Date(ds); return d.getFullYear()+"년 "+(d.getMonth()+1)+"월 "+d.getDate()+"일"; }
function fMan(n){ var v=Math.abs(n||0); return v>=10000?Math.round(n/10000).toLocaleString()+"만 원":((n||0).toLocaleString())+"원"; }
function fManS(n){ var v=Math.abs(n||0); return v>=10000?Math.round(n/10000)+"만":String(n||0); }
function fProgramAmt(p){ var r=p.rounds||[]; if(r.length===1&&(r[0].label||"").indexOf("월")>=0){return"월 최대 "+fMan(r[0].amount);} return"1인당 최대 "+fMan(p.totalAmount||0); }
function addMo(ds,m){ if(!ds) return ""; var d=new Date(ds); d.setMonth(d.getMonth()+m); return d.toISOString().split("T")[0]; }
function getDday(ds){ if(!ds) return null; var today=new Date(); today.setHours(0,0,0,0); var target=new Date(ds); target.setHours(0,0,0,0); return Math.ceil((target-today)/(1000*60*60*24)); }
function formatDday(d){ if(d===null) return ""; if(d===0) return "D-Day"; if(d<0) return "D+"+Math.abs(d); return "D-"+d; }
function isFuture(ds){ if(!ds) return true; return new Date(ds)>new Date(); }
function calcAgeDetailed(b,r){ if(!b) return null; var bd=new Date(b); var rd=r?new Date(r):new Date(); var years=rd.getFullYear()-bd.getFullYear(); var months=rd.getMonth()-bd.getMonth(); if(rd.getDate()<bd.getDate()) months--; if(months<0){years--;months+=12;} return {years:years,months:months,totalMonths:years*12+months}; }
function cAge(b,r){ var d=calcAgeDetailed(b,r); return d?d.years:null; }
function calcMilitaryLimit(milMonths){ var base=34*12; var ext=base+(milMonths||0); var capped=Math.min(ext,39*12); return{maxTotalMonths:capped,maxYears:Math.floor(capped/12),maxRemainMonths:capped%12,isBorderline:milMonths>0&&capped>34*12}; }
function fDateTime(ds){ if(!ds) return ""; var d=new Date(ds); var y=d.getFullYear(); var mo=d.getMonth()+1; var day=d.getDate(); var h=d.getHours(); var mi=d.getMinutes(); var ampm=h>=12?"오후":"오전"; var h12=h%12; if(h12===0)h12=12; return y+"."+mo+"."+day+" "+ampm+" "+h12+":"+(mi<10?"0"+mi:mi); }
function parseJumin(jumin){ if(!jumin||jumin.length<7) return null; var clean=jumin.replace(/[^0-9]/g,""); if(clean.length<7) return null; var yy=parseInt(clean.substring(0,2)); var mm=parseInt(clean.substring(2,4)); var dd=parseInt(clean.substring(4,6)); var gc2=parseInt(clean.substring(6,7)); var century=1900; var gender="male"; if(gc2===1||gc2===2){century=1900;}else if(gc2===3||gc2===4){century=2000;}else if(gc2===9||gc2===0){century=1800;} if(gc2%2===0){gender="female";} var year=century+yy; var bd=year+"-"+(mm<10?"0"+mm:mm)+"-"+(dd<10?"0"+dd:dd); return{birthDate:bd,gender:gender,year:year}; }
// ── 입력값 검증/포맷 유틸 (보안: 잘못된/위험한 값 차단) ──────
function fmtBizNo(v){ var d=(v||"").replace(/[^0-9]/g,"").substring(0,10); if(d.length<4)return d; if(d.length<6)return d.substring(0,3)+"-"+d.substring(3); return d.substring(0,3)+"-"+d.substring(3,5)+"-"+d.substring(5); }
function fmtPhone(v){ var d=(v||"").replace(/[^0-9]/g,"").substring(0,11); if(d.length<3)return d; if(d.startsWith("02")){ if(d.length<6)return d.substring(0,2)+"-"+d.substring(2); if(d.length<10)return d.substring(0,2)+"-"+d.substring(2,5)+"-"+d.substring(5); return d.substring(0,2)+"-"+d.substring(2,6)+"-"+d.substring(6,10); } if(d.length<8)return d.substring(0,3)+"-"+d.substring(3); if(d.length<11)return d.substring(0,3)+"-"+d.substring(3,6)+"-"+d.substring(6); return d.substring(0,3)+"-"+d.substring(3,7)+"-"+d.substring(7); }
function isValidEmail(v){ if(!v)return true; return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
var MAX_MONEY=10000000000; // 100억 — 비정상 입력 방지 상한
function clampMoney(v){ var n=Number(v); if(isNaN(n)||n<0)return 0; if(n>MAX_MONEY)return MAX_MONEY; return n; }
function clampRate(v){ var n=Number(v); if(isNaN(n)||n<0)return 0; if(n>100)return 100; return n; }
function checkWage(monthlyPay,weeklyHours){ if(!monthlyPay||monthlyPay<=0) return null; var wh=weeklyHours||40; var mh=wh>=40?209:Math.round((wh+(wh>=15?wh/40*8:0))*4.345); var hourlyWage=Math.round(monthlyPay/mh); var minMonthly=Math.round(MIN_WAGE_2026*mh); return{hourlyWage:hourlyWage,monthlyHours:mh,minMonthly:minMonthly,minHourly:MIN_WAGE_2026,isAboveMin:hourlyWage>=MIN_WAGE_2026,isAboveFloor:monthlyPay>=BOSU_FLOOR_2026,gap:hourlyWage-MIN_WAGE_2026}; }
function makeExcelData(companies,employees,programs){ var rows=[["업체명","사업자번호","대표자","직원명","지원금","상태","입사일","총예정","수령완료"]]; employees.forEach(function(emp){ var c=companies.find(function(x){return x.id===emp.companyId;}); var p=programs[emp.programId]; var st=STS.find(function(s){return s.key===emp.status;}); var rcv=(emp.rounds||[]).reduce(function(s,r){return s+(r.isPaid?r.received||0:0);},0); rows.push([c?c.name:"",c?c.bizNo||"":"",c?c.ceoName||"":"",emp.name,p?p.name:"",st?st.label:"",emp.startDate||"",emp.totalExpected||0,rcv]); }); return rows.map(function(r){return r.join("\t");}).join("\n"); }
function makeExcelTemplate(){ return "이름\t주민번호앞7자리\t입사일\t연락처\t이메일\t지원금ID\n예시직원\t9501011\t2026-01-15\t010-1234-5678\thong@email.com\tyouth_jump"; }
function parseExcelData(text,programs){ var lines=text.trim().split("\n"); if(lines.length<2) return []; var results=[]; for(var i=1;i<lines.length;i++){ var cols=lines[i].split("\t"); if(cols.length<3) continue; var name=(cols[0]||"").trim(); var parsed=parseJumin((cols[1]||"").trim()); if(!name) continue; var pid=(cols[5]||"youth_jump").trim(); results.push({name:name,birthDate:parsed?parsed.birthDate:"2000-01-01",gender:parsed?parsed.gender:"male",startDate:(cols[2]||"").trim(),phone:(cols[3]||"").trim(),email:(cols[4]||"").trim(),programId:programs[pid]?pid:"youth_jump"}); } return results; }

// ── 지원금 데이터 ───────────────────────────────────────────
var DEFAULT_PROGRAMS = {
  youth_jump:{id:"youth_jump",name:"청년일자리도약장려금",year:2026,group:"신규채용",color:"#1D4ED8",totalAmount:7200000,rounds:[{month:6,amount:3600000,label:"1차(6개월)"},{month:9,amount:1800000,label:"2차(9개월)"},{month:12,amount:1800000,label:"3차(12개월)"}],companyDocs:["사업자등록증","사업참여신청서","사업주확인서","협약서","기업통장사본","4대보험가입자명부","개인정보동의서(사업주)","고용보험취득확인서"],employeeDocs:["근로계약서","임금대장(6개월)","급여이체확인서류","개인정보동의서(근로자)","최종학력확인서(졸업증명서)","사실증명확인서"],hasEligibility:true,isCustom:false,isBuiltIn:true,note:"수도권: 기업 720만(취업애로요건 필수). 비수도권: 기업 720만+청년 근속인센티브 480~720만. 사전신청 후 채용(예외: 입사일 기준 3개월 내). 6개월 유지 후 1차 지급.",applyUrl:"고용24(work24.go.kr)",match:{cats:["청년"],ageMin:15,ageMax:34,milExtend:true,gender:"any",empTypes:["정규직"],preApply:true,companyMax:null,regionSensitive:true,bosuFloor:true}},
  work_exp:{id:"work_exp",name:"미래내일 일경험",year:2026,group:"신규채용",color:"#2563EB",totalAmount:1400000,rounds:[{month:1,amount:200000,label:"1개월"},{month:2,amount:200000,label:"2개월"},{month:3,amount:200000,label:"3개월"},{month:4,amount:200000,label:"4개월"}],companyDocs:["사업자등록증","사업참여신청서","운영계획서","협약서","개인정보동의서"],employeeDocs:["참여신청서","동의서및서약서","출근부","수당지급확인서"],isCustom:false,isBuiltIn:true,note:"인턴형 기준 기업 월20만+멘토수당 별도. 청년 주35만 수당. 기업 고용보험 10인↑(예외 벤처/이노/메인). 청년 미취업·사업자등록 불가.",applyUrl:"고용24 / 1811-8447",match:{cats:["청년"],ageMin:15,ageMax:34,milExtend:true,gender:"any",empTypes:["인턴"],preApply:true,companyMax:null,regionSensitive:false,bosuFloor:false}},
  saeil_women:{id:"saeil_women",name:"새일여성인턴제",year:2026,group:"신규채용",color:"#2563EB",totalAmount:4000000,rounds:[{month:1,amount:800000,label:"인턴1개월"},{month:2,amount:800000,label:"인턴2개월"},{month:3,amount:800000,label:"인턴3개월"},{month:9,amount:800000,label:"고용유지1차"},{month:15,amount:800000,label:"고용유지2차"}],companyDocs:["사업자등록증","사업참여신청서","인턴약정서","협약서","기업통장사본"],employeeDocs:["구직등록확인서","근로계약서","임금대장","급여이체확인서류"],isCustom:false,isBuiltIn:true,note:"기업 최대 400만. 새일센터 연계·인턴약정 먼저. 고용보험 5인↑~1000인미만. 가족채용 영구배제.",applyUrl:"여성새로일하기센터(saeil.mogef.go.kr)",match:{cats:["여성"],ageMin:null,ageMax:null,gender:"female",empTypes:["인턴","정규직"],preApply:true,companyMax:1000,regionSensitive:false,bosuFloor:false,special:["경력단절"]}},
  emp_promo:{id:"emp_promo",name:"고용촉진장려금",year:2026,group:"신규채용",color:"#0284C7",totalAmount:7200000,rounds:[{month:6,amount:3600000,label:"1회차(6개월)"},{month:12,amount:3600000,label:"2회차(12개월)"}],companyDocs:["사업자등록증","고용촉진장려금 지급신청서","근로계약서","고용보험확인서"],employeeDocs:["근로계약서","월별급여대장","급여이체증빙","취업지원프로그램 이수증"],isCustom:false,isBuiltIn:true,note:"우선지원/중견 연 720만. 취업지원프로그램 이수자·중증장애인·여성가장 정규직. 보수 124만↑. 12개월 내 첫 신청.",applyUrl:"고용24(work24.go.kr)",match:{cats:["취약계층"],ageMin:null,ageMax:null,gender:"any",empTypes:["정규직"],preApply:false,companyMax:null,regionSensitive:false,bosuFloor:true,special:["프로그램이수"]}},
  senior_intern:{id:"senior_intern",name:"시니어 인턴십",year:2026,group:"신규채용",color:"#2563EB",totalAmount:5500000,rounds:[{month:3,amount:1200000,label:"1단계(3개월)"},{month:9,amount:1500000,label:"2단계(6개월)"},{month:18,amount:900000,label:"3단계(18개월)"},{month:24,amount:900000,label:"3단계(24개월)"},{month:36,amount:1000000,label:"3단계(36개월)"}],companyDocs:["사업자등록증","사업참여신청서","협약서","4대보험가입자명부"],employeeDocs:["근로계약서","사전교육 이수증","월별급여대장"],isCustom:false,isBuiltIn:true,note:"일반형 최대 550만. 만60세↑. 한국노인인력개발원 사전승인 필수. 요양보호사·경비·청소 등 단순노무 제외.",applyUrl:"한국노인인력개발원 / seniorro.or.kr",match:{cats:["고령자"],ageMin:60,ageMax:null,gender:"any",empTypes:["정규직","인턴"],preApply:true,companyMax:null,regionSensitive:false,bosuFloor:false}},
  disabled_emp:{id:"disabled_emp",name:"장애인 고용장려금",year:2026,group:"신규채용",color:"#1E3A5F",totalAmount:5400000,rounds:[{month:1,amount:450000,label:"월(예시·중증여)"}],companyDocs:["고용장려금 지급신청서","장애인 근로자 명부","근로계약서"],employeeDocs:["장애인증명서","근로계약서","월별임금대장"],isCustom:false,isBuiltIn:true,note:"경증 남35/여50, 중증 남70/여90만 매월. 고용보험 가입+최저임금↑ 필수.",applyUrl:"한국장애인고용공단 e-신고(esingo.or.kr)",match:{cats:["장애인"],ageMin:null,ageMax:null,gender:"any",empTypes:["정규직","계약직"],preApply:false,companyMax:null,regionSensitive:false,bosuFloor:false,special:["장애"]}},
  regular_convert:{id:"regular_convert",name:"정규직 전환 지원금",year:2026,group:"재직자유지",color:"#475569",totalAmount:7200000,rounds:[{month:3,amount:1800000,label:"1차(3개월)"},{month:6,amount:1800000,label:"2차(6개월)"},{month:9,amount:1800000,label:"3차(9개월)"},{month:12,amount:1800000,label:"4차(12개월)"}],companyDocs:["사업참여신청서","정규직전환 근로계약서","사업자등록증","취업규칙"],employeeDocs:["전환 전 근로계약서","전환 후 근로계약서","월별임금대장"],isCustom:false,isBuiltIn:true,note:"기본 월40만+임금인상보전 월20만=연720. 5~30인미만. 2026 예산 한정·상반기 사전승인 필수. 6개월↑ 기간제→정규직. 먼저 전환하면 0원.",applyUrl:"고용24(work24.go.kr)",match:{cats:["재직"],ageMin:null,ageMax:null,gender:"any",empTypes:["계약직"],preApply:true,companyMax:30,regionSensitive:false,bosuFloor:true,special:["정규직전환"]}},
  senior_continue:{id:"senior_continue",name:"고령자 계속고용 장려금",year:2026,group:"재직자유지",color:"#475569",totalAmount:7200000,rounds:[{month:3,amount:900000,label:"1분기"},{month:6,amount:900000,label:"2분기"},{month:9,amount:900000,label:"3분기"},{month:12,amount:900000,label:"4분기"}],companyDocs:["지급신청서","취업규칙(정년 명문화)","재고용 근로계약서"],employeeDocs:["근로계약서","월별임금대장"],isCustom:false,isBuiltIn:true,note:"수도권 분기90만 2년 최대720. 비수도권 분기120만 3년 최대1440(2026). 정년연장/폐지/재고용 취업규칙 필수. 100인미만.",applyUrl:"고용24(work24.go.kr)",match:{cats:["고령자","재직"],ageMin:55,ageMax:null,gender:"any",empTypes:["정규직"],preApply:false,companyMax:100,regionSensitive:true,bosuFloor:false,special:["정년도달"]}},
  worklife45:{id:"worklife45",name:"워라밸+4.5 프로젝트",year:2026,group:"재직자유지",color:"#475569",totalAmount:7200000,rounds:[{month:3,amount:1800000,label:"1분기"},{month:6,amount:1800000,label:"2분기"},{month:9,amount:1800000,label:"3분기"},{month:12,amount:1800000,label:"4분기"}],companyDocs:["노사합의서","사업참여신청서(재단)","근태관리 증빙","취업규칙"],employeeDocs:["변경 근로계약서"],isCustom:false,isBuiltIn:true,note:"기존직원 부분단축 연240/전면단축 연720. 신규채용 보너스 별도. 20인↑. 노사발전재단(nosa.or.kr) 사전신청.",applyUrl:"노사발전재단(nosa.or.kr)",match:{cats:["재직"],ageMin:null,ageMax:null,gender:"any",empTypes:["정규직"],preApply:true,companyMin:20,companyMax:null,regionSensitive:false,bosuFloor:false,special:["주4.5일제"]}},
  parental_leave:{id:"parental_leave",name:"육아휴직 지원금(사업주)",year:2026,group:"육아",color:"#059669",totalAmount:3600000,rounds:[{month:3,amount:900000,label:"1차(3개월)"},{month:6,amount:900000,label:"2차(6개월)"},{month:9,amount:900000,label:"3차(9개월)"},{month:12,amount:900000,label:"4차(12개월)"}],companyDocs:["육아휴직 확인서","사업자등록증","근로계약서"],employeeDocs:["육아휴직 신청서","가족관계증명서","휴직 발령 증빙"],isCustom:false,isBuiltIn:true,note:"사업주 월30만(남성 +10만). 생후12개월내 특례 첫3개월 월100만. 우선지원대상+30일↑ 허용.",applyUrl:"고용24(work24.go.kr)",match:{cats:["육아"],ageMin:null,ageMax:null,gender:"any",empTypes:["정규직"],preApply:false,companyMax:null,regionSensitive:false,bosuFloor:true,special:["육아휴직"]}},
  parental_reduce:{id:"parental_reduce",name:"육아기 근로시간 단축(사업주)",year:2026,group:"육아",color:"#059669",totalAmount:3600000,rounds:[{month:3,amount:900000,label:"1차(3개월)"},{month:6,amount:900000,label:"2차(6개월)"},{month:9,amount:900000,label:"3차(9개월)"},{month:12,amount:900000,label:"4차(12개월)"}],companyDocs:["근로시간 단축 확인서","사업자등록증","변경 근로계약서"],employeeDocs:["단축 신청서","가족관계증명서","변경 근로계약서"],isCustom:false,isBuiltIn:true,note:"사업주 월30만(남성 +10만). 근로자 단축급여 월최대250만. 만12세↓ 자녀, 최대3년.",applyUrl:"고용24(work24.go.kr)",match:{cats:["육아"],ageMin:null,ageMax:null,gender:"any",empTypes:["정규직"],preApply:false,companyMax:null,regionSensitive:false,bosuFloor:true,special:["근로시간단축"]}},
  replace_worker:{id:"replace_worker",name:"대체인력 지원금",year:2026,group:"육아",color:"#047857",totalAmount:21000000,rounds:[{month:1,amount:1400000,label:"월(예시·30인미만)"}],companyDocs:["대체인력 채용 증빙","육아휴직 확인서","사업자등록증"],employeeDocs:["대체인력 근로계약서","월별임금대장","급여이체증빙"],isCustom:false,isBuiltIn:true,note:"육아휴직 대체 30인미만 월최대140(최대15개월=2100). 100% 즉시 선지급. 채용전3개월~후1년 감원 시 전액환수.",applyUrl:"고용24 + 인재채움뱅크",match:{cats:["육아"],ageMin:null,ageMax:null,gender:"any",empTypes:["계약직","정규직"],preApply:false,companyMax:null,regionSensitive:false,bosuFloor:true,special:["대체인력"]}},
  work_share:{id:"work_share",name:"동료 업무분담 지원금",year:2026,group:"육아",color:"#059669",totalAmount:600000,rounds:[{month:1,amount:600000,label:"월(예시)"}],companyDocs:["업무분담수당 지급 증빙","육아휴직 확인서"],employeeDocs:["임금명세서(업무분담수당 명시)"],isCustom:false,isBuiltIn:true,note:"육아휴직 분담 30인미만 월최대60(2026 3배인상). 대체인력과 중복불가.",applyUrl:"고용24(work24.go.kr)",match:{cats:["육아"],ageMin:null,ageMax:null,gender:"any",empTypes:["정규직"],preApply:false,companyMax:null,regionSensitive:false,bosuFloor:false,special:["업무분담"]}},
  emp_retention:{id:"emp_retention",name:"고용유지지원금",year:2026,group:"재직자유지",color:"#475569",totalAmount:6000000,rounds:[{month:1,amount:1500000,label:"1개월"},{month:2,amount:1500000,label:"2개월"},{month:3,amount:1500000,label:"3개월"},{month:4,amount:1500000,label:"4개월"}],companyDocs:["고용유지조치계획서","사업자등록증","임금대장","고용보험 피보험자 명부","휴업·단축 협약서"],employeeDocs:["고용유지조치 동의서","월별임금대장","출근부(단축 확인)"],isCustom:false,isBuiltIn:true,note:"경영 위기 시 해고 대신 휴업·단축 선택 기업 지원. 우선지원 2/3, 대규모 1/2 보전. 연간 최대 180일(고용위기지역 등 특례). 사전 계획 신청 필수.",applyUrl:"고용24(work24.go.kr)",match:{cats:["재직"],ageMin:null,ageMax:null,gender:"any",empTypes:["정규직","계약직"],preApply:true,companyMax:null,regionSensitive:false,bosuFloor:true}},
  job_sharing:{id:"job_sharing",name:"일자리함께하기 지원금",year:2026,group:"재직자유지",color:"#475569",totalAmount:7200000,rounds:[{month:3,amount:1800000,label:"1분기"},{month:6,amount:1800000,label:"2분기"},{month:9,amount:1800000,label:"3분기"},{month:12,amount:1800000,label:"4분기"}],companyDocs:["사업참여신청서","노사합의서(단축협약)","취업규칙","4대보험 피보험자 명부","근태관리 증빙"],employeeDocs:["변경 근로계약서","월별임금대장"],isCustom:false,isBuiltIn:true,note:"재직자 근로시간 단축 후 신규 채용 시 지원. 교대제 도입·심야근로 단축·정년연장형 등 유형별 지원. 우선지원 연최대 720만. 사전승인 필수.",applyUrl:"고용24(work24.go.kr)",match:{cats:["재직"],ageMin:null,ageMax:null,gender:"any",empTypes:["정규직"],preApply:true,companyMin:null,companyMax:null,regionSensitive:false,bosuFloor:false,special:["일자리나누기"]}}
};

// 기본 활성 지원금 (신규 사용자 기준: 청년일자리도약장려금만 ON)
var PROGRAM_ENABLED_DEFAULTS={youth_jump:true};

// 지원금별 확인 체크리스트
var PROGRAM_CHECKLISTS={
  youth_jump:["청년 나이 확인 (만 15~34세, 군복무 연장 적용 가능)","수도권 사업장: 취업애로요건 최소 1개 해당 여부 확인","사전신청 완료 여부 (또는 입사 후 3개월 내 사후신청)","보수 월 124만 원 이상 지급 계획 확인","6개월 이상 계속 고용 계획","최근 3개월 내 감원 이력 없음 확인"],
  replace_worker:["육아휴직·출산전후휴가·근로시간 단축 등 대체인력 발생 사유 확인","대체인력 채용일 확인","대체인력 고용보험 가입 여부 확인","대체 대상 근로자의 휴직·휴가 기간 확인","대체인력 근무기간 요건 확인","임금 지급 및 근로계약서 작성 여부 확인","동일 근로자 중복 지원 여부 확인","신청 기한 확인"],
  senior_intern:["연령 요건 확인 (만 60세 이상)","참여 가능 직무 여부 확인 (단순노무직 제외)","인턴 약정 기간 확인","고용보험 가입 여부 확인","운영기관(한국노인인력개발원) 사전 승인 여부 확인","기존 근로자 전환 여부 확인","중복 지원 제한 여부 확인"],
  regular_convert:["전환 전 고용형태 확인 (6개월↑ 기간제·파견)","정규직 전환일 확인","임금 감소 여부 확인","고용유지 기간 확인","전환 대상자 중복 지원 여부 확인","신청 기한 확인","사전 신청 또는 승인(전환계획서) 필요 여부 확인"],
  senior_continue:["정년제도 운영 여부 확인","계속고용제도(연장·폐지·재고용) 도입 여부 확인","대상 근로자 연령 요건 확인 (만 55세 이상)","고용유지 여부 확인","취업규칙 또는 사내규정 정비 여부 확인","신청 기한 확인","중복 지원 여부 확인"],
  work_exp:["신청 대상 사업장 여부 확인 (고용보험 10인↑ 등 요건)","대상 근로자 요건 확인 (미취업 청년, 사업자등록 없음)","고용보험 가입 여부 확인","신청 기한 확인","중복 지원 제한 여부 확인","필수 서류 준비 여부 확인","운영기관(고용24/1811-8447) 기준 추가 확인 필요"],
  saeil_women:["신청 대상 사업장 여부 확인 (고용보험 5인↑~1000인미만)","대상 근로자 요건 확인 (경력단절 여성, 새일센터 연계)","고용보험 가입 여부 확인","신청 기한 확인","중복 지원 제한 여부 확인","필수 서류 준비 여부 확인","운영기관(여성새로일하기센터) 기준 추가 확인 필요"],
  emp_promo:["신청 대상 사업장 여부 확인","대상 근로자 요건 확인 (취업지원프로그램 이수 등)","고용보험 가입 및 보수 124만↑ 확인","신청 기한 확인 (12개월 내 첫 신청)","중복 지원 제한 여부 확인","필수 서류 준비 여부 확인","운영기관 또는 공고문 기준 추가 확인 필요"],
  disabled_emp:["신청 대상 사업장 여부 확인","장애 등급 확인 (경증·중증)","고용보험 가입 및 최저임금 이상 지급 확인","신청 기한 확인","중복 지원 제한 여부 확인","필수 서류 준비 여부 확인 (장애인증명서 등)","운영기관(한국장애인고용공단) 기준 추가 확인 필요"],
  worklife45:["신청 대상 사업장 여부 확인 (20인↑)","노사합의서 및 취업규칙 정비 여부 확인","고용보험 가입 여부 확인","신청 기한 확인","중복 지원 제한 여부 확인","필수 서류 준비 여부 확인","운영기관(노사발전재단) 기준 추가 확인 필요"],
  parental_leave:["신청 대상 사업장 여부 확인 (우선지원대상기업)","대상 근로자 요건 확인 (육아휴직 30일↑ 허용)","고용보험 가입 여부 확인","신청 기한 확인","중복 지원 제한 여부 확인","필수 서류 준비 여부 확인","운영기관 또는 공고문 기준 추가 확인 필요"],
  parental_reduce:["신청 대상 사업장 여부 확인","대상 근로자 요건 확인 (만 12세↓ 자녀, 최대 3년)","고용보험 가입 여부 확인","신청 기한 확인","중복 지원 제한 여부 확인","필수 서류 준비 여부 확인","운영기관 또는 공고문 기준 추가 확인 필요"],
  work_share:["신청 대상 사업장 여부 확인 (30인미만)","업무분담수당 지급 계획 확인","고용보험 가입 여부 확인","신청 기한 확인","대체인력과 중복 신청 여부 확인","필수 서류 준비 여부 확인","운영기관 또는 공고문 기준 추가 확인 필요"],
  emp_retention:["경영 위기 사유 확인 (매출 감소 등)","고용유지조치계획서 사전 신청 여부 확인","대상 근로자 요건 확인","신청 기한 확인 (연간 180일 한도)","중복 지원 제한 여부 확인","필수 서류 준비 여부 확인","운영기관 또는 공고문 기준 추가 확인 필요"],
  job_sharing:["신청 대상 사업장 여부 확인","근로시간 단축 유형 확인 (교대제·심야단축·정년연장형 등)","신규 채용 계획 확인","사전 신청(승인) 여부 확인","고용보험 가입 여부 확인","신청 기한 확인","운영기관 또는 공고문 기준 추가 확인 필요"]
};

// 업체 기본 서류 템플릿 (카테고리별)
var COMPANY_DEFAULT_DOCS=[
  {cat:"기본 사업자 서류",docs:["사업자등록증","법인등기사항전부증명서 (법인)","대표자 신분증 사본","기업 통장 사본"]},
  {cat:"고용보험 관련",docs:["고용보험 성립 신고서","4대보험 가입자 명부","고용보험 피보험자격 취득·상실 이력"]},
  {cat:"세무·재무",docs:["법인세(소득세) 신고서","재무제표 (손익계산서·대차대조표)","국세 완납 증명서"]},
  {cat:"근로자 관련",docs:["근로계약서 (전 직원)","임금대장","취업규칙"]},
  {cat:"지원금별 추가",docs:["협약서","사업참여신청서","개인정보 동의서 (사업주)"]}
];

// 업종 선택지
var INDUSTRY_OPTIONS=["제조업","건설업","도소매업","음식·숙박업","운수·창고업","정보통신업","금융·보험업","부동산업","전문·과학·기술업","교육 서비스업","보건·사회복지업","예술·스포츠·여가업","협회·단체","기타 서비스업","기타/직접입력"];

var ELIG = [
  {id:"e1",label:"실업 4개월 이상",desc:"고용보험 피보험자격 상실 후 연속 4개월 이상 실업"},
  {id:"e2",label:"고졸 이하 학력",desc:"대학 미진학, 최종학력 고등학교 졸업 이하"},
  {id:"e3",label:"고용보험 가입 12개월 미만",desc:"생애 전체 고용보험 총 피보험기간 12개월 미만"},
  {id:"e4",label:"고용촉진장려금 대상자",desc:"취업지원프로그램 이수자"},
  {id:"e5",label:"국민취업지원제도 참여자",desc:"국취제(I/II유형) 참여"},
  {id:"e6",label:"청년도전 지원사업 수료자",desc:"청년도전 지원사업 프로그램 수료"},
  {id:"e7",label:"자립준비청년",desc:"보호종료 청년"},
  {id:"e8",label:"북한이탈청년",desc:"북한이탈주민 중 청년"},
  {id:"e9",label:"폐업 경험 청년",desc:"창업 후 폐업 경험(2년 이내)"},
  {id:"e10",label:"기타 장관 인정",desc:"기타 고용노동부 장관이 취업애로청년으로 인정"}
];
var EXCL = [
  {id:"x1",label:"재학 중이 아닐 것",desc:"정규 교육기관 재학 중 제외"},
  {id:"x2",label:"사업주 가족이 아닐 것",desc:"배우자·직계존비속·형제자매 제외"},
  {id:"x3",label:"외국인이 아닐 것",desc:"외국인 제외(F-2,F-5,F-6 예외)"},
  {id:"x4",label:"중복수급이 아닐 것",desc:"타 고용지원금과 중복수급 불가"},
  {id:"x5",label:"자영업자·사업자가 아닐 것",desc:"사업자등록증 소지자 제외"}
];
var STS = [
  {key:"preparing",label:"준비중",color:"#64748B",bg:"#F1F5F9",icon:"⏳"},
  {key:"submitted",label:"서류접수",color:"#2563EB",bg:"#EFF6FF",icon:"📨"},
  {key:"reviewing",label:"심사중",color:"#475569",bg:"#E2E8F0",icon:"🔍"},
  {key:"approved",label:"승인",color:"#059669",bg:"#ECFDF5",icon:"✅"},
  {key:"inprogress",label:"지급중",color:"#2563EB",bg:"#DBEAFE",icon:"💸"},
  {key:"completed",label:"최종지급완료",color:"#059669",bg:"#D1FAE5",icon:"🎉"},
  {key:"resigned",label:"퇴사",color:"#94A3B8",bg:"#F1F5F9",icon:"🚪"}
];
var TAGS = [
  {id:"vip",label:"VIP",color:"#1D4ED8",bg:"#EFF6FF"},
  {id:"new",label:"신규",color:"#2563EB",bg:"#DBEAFE"},
  {id:"caution",label:"주의",color:"#DC2626",bg:"#FEE2E2"},
  {id:"priority",label:"우선",color:"#2563EB",bg:"#EFF6FF"},
  {id:"hold",label:"보류",color:"#64748B",bg:"#F1F5F9"},
  {id:"stop",label:"중단",color:"#6B7280",bg:"#E5E7EB"},
  {id:"star",label:"⭐즐겨찾기",color:"#475569",bg:"#F1F5F9"}
];
var CERT_TYPES = [
  {id:"venture",label:"벤처기업 인증",color:"#2563EB"},
  {id:"innobiz",label:"이노비즈 인증",color:"#059669"},
  {id:"mainbiz",label:"메인비즈 인증",color:"#1E40AF"},
  {id:"research",label:"기업부설연구소",color:"#DC2626"},
  {id:"family",label:"가족친화기업",color:"#059669"},
  {id:"youth",label:"청년친화기업",color:"#2563EB"},
  {id:"other",label:"기타",color:"#6B7280"}
];
var COMMON_EXTRA_DOCS = ["신분증 사본","근로자 통장사본","연차사용 증빙","재직증명서","사직서","육아휴직서","주민등록등본","원천징수영수증","4대보험 가입확인서","운영기관 자체 서식"];
// 업체 서류 탭 기본 표시·빠른추가 목록
var COMPANY_DOC_DEFAULTS = ["사업자등록증","법인등기부등본","기업통장사본","협약서","4대보험 사업장 가입자 명부","4대보험 가입확인서","원천징수영수증","급여대장","급여이체증","운영기관 자체 서식"];
var COMPANY_QUICK_DOCS = COMPANY_DOC_DEFAULTS;
var EMP_QUICK_DOCS = ["근로계약서","임금대장","급여이체증","졸업증명서","사실증명확인서","신분증 사본","근로자 통장사본","재직증명서","주민등록등본"];
// 서류명 정규화 — 공백·괄호·점·중점·대소문자 차이를 무시하고 중복 판정
function normDoc(s){ return (s||"").replace(/[\s()（）·.\-]/g,"").toLowerCase(); }

// 업무 일지 유형
var NOTE_TYPES = [
  {id:"전화",icon:"📞"},{id:"카톡",icon:"💬"},{id:"이메일",icon:"✉️"},
  {id:"서류요청",icon:"📤"},{id:"서류수령",icon:"📥"},{id:"신청완료",icon:"📨"},
  {id:"지급확인",icon:"💸"},{id:"고객미응답",icon:"🔕"},{id:"보완요청",icon:"📝"},
  {id:"수수료청구",icon:"🧾"},{id:"수수료입금",icon:"💰"},{id:"상태변경",icon:"🔄"},{id:"기타",icon:"🗒️"}
];
function noteTypeMeta(id){ return NOTE_TYPES.find(function(t){return t.id===id;})||NOTE_TYPES[NOTE_TYPES.length-1]; }

// 서류 진행 상태 (체크박스 done 과 병행)
var DOC_STATUS = [
  {id:"none",label:"미요청",color:"#94A3B8",bg:"#F1F5F9"},
  {id:"requested",label:"요청완료",color:"#2563EB",bg:"#EFF6FF"},
  {id:"submitted",label:"제출완료",color:"#0D9488",bg:"#F0FDFA"},
  {id:"revise",label:"보완필요",color:"#DC2626",bg:"#FEF2F2"},
  {id:"confirmed",label:"확인완료",color:"#059669",bg:"#ECFDF5"}
];
function docStatusMeta(id){ return DOC_STATUS.find(function(s){return s.id===id;})||DOC_STATUS[0]; }
// 서류 done(boolean) ↔ status(string) 동기화 유틸
function docEffStatus(d){ if(d.status)return d.status; return d.done?"confirmed":"none"; }
function docIsDone(d){ var s=docEffStatus(d); return s==="submitted"||s==="confirmed"||d.done===true&&!d.status; }

// ── 스타일 상수 ──────────────────────────────────────────
var FF = "'Pretendard','Pretendard Variable',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans KR',sans-serif";
// 반응형 타이포 스케일 (clamp: 모바일 축소 · 데스크톱 균형)
var FS_INPUT="clamp(15px,4vw,17px)";   // 입력창·기본 버튼
var FS_BTN_SM="clamp(13px,3.4vw,15px)"; // 보조 버튼
var FS_LABEL="clamp(13px,3.4vw,14px)";  // 라벨
var FS_BADGE="clamp(11px,3vw,13px)";    // 배지
var FS_PAGE_TITLE="clamp(20px,5vw,26px)"; // 페이지 메인 제목
var FS_SECTION="clamp(17px,4.4vw,22px)";  // 섹션 제목
var FS_CARD_TITLE="clamp(15px,4vw,18px)"; // 카드 제목
var FS_HERO_NUM="clamp(28px,8.5vw,44px)"; // 히어로 수치(시뮬레이터 총액 등)
var FS_BODY="clamp(13px,3.6vw,15px)";     // 본문/설명
var FS_LIST="clamp(13px,3.6vw,16px)";     // 표/리스트
var inp = {width:"100%",padding:"12px 15px",borderRadius:10,border:"1.5px solid #E2E8F0",fontSize:FS_INPUT,outline:"none",boxSizing:"border-box",fontFamily:FF,color:"#1E293B",background:"#fff",transition:"border-color 0.15s"};
var inpKo = Object.assign({},inp,{lang:"ko"});
var btnP = {background:"#2563EB",color:"#fff",border:"none",borderRadius:10,padding:"12px 24px",fontSize:FS_INPUT,fontWeight:600,cursor:"pointer",fontFamily:FF,boxShadow:"0 1px 2px rgba(37,99,235,0.18)",whiteSpace:"nowrap"};
var btnS = {background:"#fff",color:"#475569",border:"1.5px solid #E2E8F0",borderRadius:10,padding:"12px 24px",fontSize:FS_INPUT,fontWeight:500,cursor:"pointer",fontFamily:FF,whiteSpace:"nowrap"};
var btnSm = {background:"#F8FAFC",color:"#64748B",border:"1px solid #E2E8F0",borderRadius:8,padding:"9px 16px",fontSize:FS_BTN_SM,cursor:"pointer",fontFamily:FF,whiteSpace:"nowrap"};

// ── 공통 색상 토큰 (의미 기반) ─────────────────────────────
var COLORS = {
  primary:"#2563EB", primarySoft:"#EFF6FF",
  danger:"#DC2626",  dangerSoft:"#FEF2F2",
  success:"#059669", successSoft:"#ECFDF5",
  warning:"#475569", warningSoft:"#F1F5F9",
  text:"#0F172A", subtext:"#64748B",
  grayText:"#64748B",
  border:"#E5E7EB", bg:"#F8FAFC",
  card:"#FFFFFF", sidebar:"#0F172A"
};

// ── 전역 토스트 ───────────────────────────────────────────
var _toastFn=null;
function toast(msg,type){ if(_toastFn)_toastFn(msg,type||"success"); }
function ToastHost(){
  var st=useState([]);
  useEffect(function(){
    _toastFn=function(msg,type){
      var id=Date.now()+"-"+Math.random();
      st[1](function(a){return a.concat([{id:id,msg:msg,type:type}]);});
      setTimeout(function(){ st[1](function(a){return a.filter(function(t){return t.id!==id;});}); },3400);
    };
    return function(){_toastFn=null;};
  },[]);
  var C={success:{bg:"#ECFDF5",bd:"#6EE7B7",c:"#047857",i:"✅"},warn:{bg:"#F1F5F9",bd:"#CBD5E1",c:"#475569",i:"⚠️"},error:{bg:"#FEF2F2",bd:"#FECACA",c:"#DC2626",i:"⛔"},info:{bg:"#EFF6FF",bd:"#BFDBFE",c:"#1D4ED8",i:"ℹ️"}};
  return(<div style={{position:"fixed",bottom:24,right:24,zIndex:6000,display:"flex",flexDirection:"column",gap:10,pointerEvents:"none"}}>
    {st[0].map(function(t){var s=C[t.type]||C.success;return(
      <div key={t.id} className="slide-in" style={{display:"flex",alignItems:"center",gap:10,background:s.bg,border:"1.5px solid "+s.bd,color:s.c,borderRadius:12,padding:"13px 18px",fontSize:15,fontWeight:600,fontFamily:FF,boxShadow:"0 8px 28px rgba(15,23,42,0.16)",maxWidth:400}}>
        <span style={{fontSize:18,flexShrink:0}}>{s.i}</span><span style={{lineHeight:1.4}}>{t.msg}</span>
      </div>
    );})}
  </div>);
}

// ── 요금제(플랜) 기능 게이트 ───────────────────────────────
var PLAN_TIERS={
  individual:{key:"individual",label:"개인 업체",maxCompanies:1,maxEmployees:Infinity,reportPerMonth:Infinity,
    feat:{commission:false,advancedAlerts:false,bulkUpload:true,agencyReport:true,team:false}},
  light:{key:"light",label:"컨설턴트 라이트",maxCompanies:5,maxEmployees:30,reportPerMonth:3,
    feat:{commission:false,advancedAlerts:false,bulkUpload:true,agencyReport:true,team:false}},
  pro:{key:"pro",label:"컨설턴트 프로",maxCompanies:Infinity,maxEmployees:Infinity,reportPerMonth:Infinity,
    feat:{commission:true,advancedAlerts:true,bulkUpload:true,agencyReport:true,team:false}},
  team:{key:"team",label:"팀 · 노무법인",maxCompanies:Infinity,maxEmployees:Infinity,reportPerMonth:Infinity,
    feat:{commission:true,advancedAlerts:true,bulkUpload:true,agencyReport:true,team:true}}
};
// sub.plan_type(individual|agency) + 체험여부 → 유효 등급
function effPlanKey(planType,isTrial){ if(isTrial)return "pro"; if(planType==="agency")return "pro"; return "individual"; }
function planTier(planType,isTrial){ return PLAN_TIERS[effPlanKey(planType,isTrial)]||PLAN_TIERS.individual; }
function PlanBadge(props){ return <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:6,background:"#DBEAFE",color:"#1D4ED8",marginLeft:6,verticalAlign:"middle"}}>{props.label||"PRO"}</span>; }

// ── 기본 UI 컴포넌트 ─────────────────────────────────────
function Modal(props){ if(!props.open) return null; return(<div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",overflowY:"auto"}} onClick={props.onClose}><div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:props.width||640,maxHeight:"calc(100dvh - 32px)",overflow:"auto",margin:"auto"}} onClick={function(e){e.stopPropagation();}}><div style={{padding:"18px clamp(16px,4vw,28px)",borderBottom:"1px solid #F1F5F9",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,position:"sticky",top:0,background:"#fff",zIndex:1}}><h3 style={{margin:0,fontSize:FS_SECTION,fontWeight:700,wordBreak:"keep-all",minWidth:0}}>{props.title}</h3><button onClick={props.onClose} style={{background:"none",border:"none",fontSize:28,cursor:"pointer",color:"#94A3B8",flexShrink:0,lineHeight:1}}>✕</button></div><div style={{padding:"clamp(16px,4vw,28px)"}}>{props.children}</div></div></div>); }
function Label(props){ return <label style={{fontSize:FS_LABEL,fontWeight:600,color:props.color||"#475569",marginBottom:6,display:"block"}}>{props.children}</label>; }
function Card(props){ return <div onClick={props.onClick} style={Object.assign({background:"#fff",borderRadius:14,border:"1px solid #F1F5F9",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"},props.style||{})}>{props.children}</div>; }
function Badge(props){ return <span style={{fontSize:FS_BADGE,fontWeight:600,padding:"4px 11px",borderRadius:20,background:props.bg||"#EFF6FF",color:props.color||"#2563EB",whiteSpace:"nowrap",display:"inline-block"}}>{props.children}</span>; }
// ── 통일 배지 시스템 (연한 배경 + 의미 텍스트 색만) ────────
var BADGE_BASE={fontSize:12,fontWeight:700,padding:"3px 10px",borderRadius:999,whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:4,lineHeight:1.4,border:"1px solid transparent"};
function neutralBadge(){ return Object.assign({},BADGE_BASE,{background:"#F1F5F9",color:"#475569",borderColor:"#E2E8F0"}); }
function primaryBadge(){ return Object.assign({},BADGE_BASE,{background:"#EFF6FF",color:"#1D4ED8",borderColor:"#DBEAFE"}); }
function dangerBadge(){ return Object.assign({},BADGE_BASE,{background:"#FEF2F2",color:"#DC2626",borderColor:"#FECACA"}); }
function successBadge(){ return Object.assign({},BADGE_BASE,{background:"#ECFDF5",color:"#059669",borderColor:"#A7F3D0"}); }
function UBadge(props){ var kind=props.kind||"neutral"; var st=kind==="danger"?dangerBadge():kind==="primary"?primaryBadge():kind==="success"?successBadge():neutralBadge(); return <span style={Object.assign(st,props.style||{})}>{props.children}</span>; }
function DdayBadge(props){ var d=props.dday; if(d===null) return null; var st=d<=0?dangerBadge():d<=7?primaryBadge():neutralBadge(); return <span style={st}>{formatDday(d)}</span>; }
function Notice(props){ return <div style={{padding:"10px 14px",background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:8,fontSize:17,color:"#475569",lineHeight:1.5,marginBottom:10}}>{props.children}</div>; }

// ── FileAt: 클라우드 파일 업로드 지원 ───────────────────
function FileAt(props){
  var ref=useRef(); var camRef=useRef(); var disabled=props.disabled;
  var uploadFn=props.uploadFn; var getUrlFn=props.getUrlFn;
  var stUp=useState(false); var uploading=stUp[0],setUploading=stUp[1];

  async function handleFile(file, nameOverride){
    if(disabled||uploading) return;
    var reason=validateUploadFile(file);
    if(reason){ toast(reason,"error"); return; }
    if(uploadFn){
      setUploading(true);
      try{
        var f2 = nameOverride ? new File([file],nameOverride,{type:file.type}) : file;
        var obj = await uploadFn(f2);
        props.onAdd(obj);
        toast("파일 업로드가 완료되었습니다.","success");
      }catch(e){ toast("파일 업로드 실패: "+(e.message||"오류"),"error"); }
      finally{ setUploading(false); }
    }else{
      var r=new FileReader();
      r.onload=function(){ props.onAdd({id:uid(),name:nameOverride||file.name,dataUrl:r.result,type:file.type}); };
      r.readAsDataURL(file);
    }
  }

  async function viewFile(f){
    if(f.storagePath&&getUrlFn){
      try{ var url=await getUrlFn(f.storagePath); if(url) window.open(url,"_blank"); }
      catch(e){ toast("파일 열기 실패","error"); }
    }else if(f.dataUrl){ window.open(f.dataUrl,"_blank"); }
  }

  return(
    <div>
      <input ref={ref} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,image/*" style={{display:"none"}} onChange={function(e){ if(disabled) return; var f=e.target.files&&e.target.files[0]; if(!f) return; handleFile(f,null); e.target.value=""; }}/>
      <input ref={camRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={function(e){ if(disabled) return; var f=e.target.files&&e.target.files[0]; if(!f) return; handleFile(f,"사진_"+fD(new Date())+".jpg"); e.target.value=""; }}/>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
        {(props.files||[]).map(function(f){
          var isImg=f.type&&f.type.startsWith("image/");
          var canView=isImg||f.storagePath||f.dataUrl;
          return(<div key={f.id} style={{display:"inline-flex",alignItems:"center",gap:4,background:disabled?"#F1F5F9":"#EFF6FF",border:disabled?"1px solid #E2E8F0":"1px solid #BFDBFE",borderRadius:8,padding:"5px 10px",fontSize:15,opacity:disabled?0.6:1,cursor:canView?"pointer":"default"}} onClick={canView?function(){viewFile(f);}:undefined} title={f.name}>
            <span style={{color:disabled?"#94A3B8":"#1D4ED8",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{isImg?"🖼️":"📎"}{f.name}</span>
            {!disabled&&<button onClick={function(e){e.stopPropagation();props.onRemove(f.id);}} style={{background:"none",border:"none",color:"#94A3B8",cursor:"pointer",fontSize:17,padding:0,lineHeight:1}}>×</button>}
          </div>);
        })}
        {uploading&&<span style={{fontSize:15,color:"#94A3B8"}}>업로드 중...</span>}
        {!disabled&&!uploading&&(<React.Fragment>
          <button onClick={function(){camRef.current&&camRef.current.click();}} style={{background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:8,padding:"6px 11px",fontSize:16,color:"#64748B",cursor:"pointer"}} title="카메라 촬영">📷</button>
          <button onClick={function(){ref.current&&ref.current.click();}} style={{background:"#F8FAFC",border:"1px dashed #CBD5E1",borderRadius:8,padding:"6px 11px",fontSize:16,color:"#64748B",cursor:"pointer"}} title="파일 첨부">📁</button>
        </React.Fragment>)}
      </div>
    </div>
  );
}

function ChkItem(props){
  var item=props.item; var isDisabled=props.disabled;
  var done=docIsDone(item); var eff=docEffStatus(item); var sm=docStatusMeta(eff);
  return(
    <div style={{padding:"12px 14px",borderRadius:10,background:isDisabled?"#F1F5F9":(done?"#F8FAFC":"#fff"),border:isDisabled?"1px solid #E2E8F0":(done?"1px solid #E2E8F0":"1px solid #E2E8F0"),borderLeft:isDisabled?"1px solid #E2E8F0":(done?"3px solid #059669":"3px solid #CBD5E1"),opacity:isDisabled?0.6:1}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:4,marginBottom:6}}>
        <label style={{display:"flex",alignItems:"center",gap:10,cursor:isDisabled?"not-allowed":"pointer",flex:1,minWidth:0}}>
          <input type="checkbox" checked={done} onChange={isDisabled?undefined:props.onToggle} disabled={isDisabled} style={{width:20,height:20,accentColor:"#059669",flexShrink:0}}/>
          <span style={{fontSize:16,fontWeight:500,color:isDisabled?"#94A3B8":(done?"#059669":"#334155"),textDecoration:done?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis"}}>{item.label}{item.isCustom&&<span style={{fontSize:13,color:"#94A3B8",marginLeft:4}}>(추가)</span>}</span>
        </label>
        <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
          {!isDisabled&&props.onCopyReq&&<button onClick={props.onCopyReq} style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:7,color:"#1D4ED8",cursor:"pointer",fontSize:13,padding:"3px 7px"}} title="이 서류 요청 문구 복사">📋</button>}
          {!isDisabled&&props.onDelete&&<button onClick={props.onDelete} style={{background:"none",border:"none",color:"#CBD5E1",cursor:"pointer",fontSize:17}} title="삭제">🗑️</button>}
        </div>
      </div>
      {!isDisabled&&(
        <div style={{marginLeft:24,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <select value={eff} onChange={props.onStatus} style={{fontSize:13,fontWeight:700,padding:"4px 8px",borderRadius:7,border:"1px solid "+sm.bg,background:sm.bg,color:sm.color,cursor:"pointer",fontFamily:FF,outline:"none"}}>
            {DOC_STATUS.map(function(s){return <option key={s.id} value={s.id}>{s.label}</option>;})}
          </select>
          <FileAt files={item.files||[]} onAdd={props.onFA} onRemove={props.onFR} uploadFn={props.uploadFn} getUrlFn={props.getUrlFn}/>
        </div>
      )}
    </div>
  );
}

function DocSection(props){
  var docs=props.docs||[]; var disabled=props.disabled;
  var uploadFn=props.uploadFn; var getUrlFn=props.getUrlFn;
  var st2=useState(""); var newName=st2[0],setNewName=st2[1];
  var stOther=useState(false); var showOther=stOther[0],setShowOther=stOther[1];
  var seeded=useState(false);
  var quickList=props.quickDocs||[];
  var done=docs.filter(function(d){return docIsDone(d);}).length;
  var missing=docs.filter(function(d){return !docIsDone(d);});

  // 서류 목록이 비어 있을 때만 기본 서류를 자동 표시(seed) — 기존 데이터는 건드리지 않음
  useEffect(function(){
    if(disabled)return;
    if(seeded[0])return;
    if(docs.length===0&&props.defaultDocs&&props.defaultDocs.length>0){
      seeded[1](true);
      props.onChange(props.defaultDocs.map(function(label){return {id:uid(),label:label,done:false,status:"none",files:[]};}));
    }
  },[]);

  function hasDoc(name){ var n=normDoc(name); return docs.some(function(d){return normDoc(d.label)===n;}); }
  function addDoc(name){
    if(!name||!name.trim())return false;
    var label=name.trim();
    if(hasDoc(label)){ toast("이미 추가된 서류입니다.","info"); return false; }
    props.onChange(docs.concat([{id:uid(),label:label,done:false,status:"none",files:[],isCustom:true}]));
    toast(label+"이(가) 추가되었습니다.","success");
    return true;
  }
  function delDoc(idx){ props.onChange(docs.filter(function(_,i){return i!==idx;})); }
  function copyOne(d){ var msg="대표님, "+(props.progName?props.progName+" ":"고용지원금 ")+"신청을 위해 '"+d.label+"' 서류가 필요합니다. 사진 또는 PDF 파일로 전달 부탁드립니다. 감사합니다."; navigator.clipboard.writeText(msg).then(function(){toast("서류 요청 문구가 복사되었습니다.","success");}); if(props.onLog)props.onLog("'"+d.label+"' 요청 문구 생성","서류요청"); }

  // 요청 메시지 — 미요청/요청완료 상태만 포함, 제출/확인완료 제외, 보완필요는 별도
  var reqDocs=docs.filter(function(d){var s=docEffStatus(d);return s==="none"||s==="requested";});
  var reviseDocs=docs.filter(function(d){return docEffStatus(d)==="revise";});
  // 급여일 연계 — 요청 목록에 급여 관련 서류(급여이체증·임금/급여대장)가 있으면 발급 시점 안내
  var hasPayDoc=reqDocs.some(function(d){var n=normDoc(d.label);return n.indexOf("급여이체")>=0||n.indexOf("이체증")>=0||n.indexOf("급여대장")>=0||n.indexOf("임금대장")>=0||n.indexOf("급여명세")>=0;});
  var greet=props.contactName?props.contactName+" 담당자님":"대표님";
  function buildRequestMsg(){
    var lines=reqDocs.length>0?reqDocs.map(function(d){return "- "+d.label;}).join("\n"):"- (요청할 서류가 없습니다)";
    var msg="안녕하세요 "+greet+".\n고용지원금 신청을 위해 필요한 서류 안내드립니다.\n\n필요한 서류는 아래와 같습니다.\n\n"+lines+"\n\n준비되시는 대로 사진 또는 PDF 파일로 전달 부탁드립니다.\n감사합니다.";
    if(reviseDocs.length>0){ msg+="\n\n[보완 필요 서류]\n"+reviseDocs.map(function(d){return "- "+d.label;}).join("\n"); }
    return msg;
  }
  function copyRequestMsg(){ navigator.clipboard.writeText(buildRequestMsg()).then(function(){toast("서류 요청 메시지를 복사했습니다.","success");}); if(props.onLog)props.onLog("서류 요청 메시지 복사("+reqDocs.length+"건)","서류요청"); }

  return(
    <Card style={{padding:"18px 20px",marginBottom:props.mb||12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <h4 style={{margin:0,fontSize:19,fontWeight:700}}>{props.icon} {props.title}</h4>
        <span style={done===docs.length&&docs.length>0?successBadge():neutralBadge()}>{done}/{docs.length}</span>
      </div>

      {/* 자주 쓰는 서류 빠른 추가 — 항상 표시 */}
      {!disabled&&(quickList.length>0)&&(
        <div style={{marginBottom:14,padding:"12px 14px",background:"#F8FAFC",borderRadius:10,border:"1px solid #F1F5F9"}}>
          <div style={{fontSize:13,fontWeight:700,color:"#475569",marginBottom:8}}>⚡ 자주 쓰는 서류 빠른 추가</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {quickList.map(function(d){var added=hasDoc(d);return(
              <button key={d} onClick={function(){if(added){toast("이미 추가된 서류입니다.","info");}else{addDoc(d);}}}
                style={{fontSize:13,padding:"6px 12px",borderRadius:8,cursor:"pointer",fontFamily:FF,border:"1px solid "+(added?"#E2E8F0":"#BFDBFE"),background:added?"#F1F5F9":"#EFF6FF",color:added?"#94A3B8":"#1D4ED8",fontWeight:added?400:600}}>
                {added?"✓ ":"+ "}{d}
              </button>
            );})}
            <button onClick={function(){setShowOther(!showOther);}} style={{fontSize:13,padding:"6px 12px",borderRadius:8,cursor:"pointer",fontFamily:FF,border:"1px dashed #CBD5E1",background:"#fff",color:"#475569"}}>＋ 기타 서류</button>
          </div>
          {showOther&&(
            <div style={{display:"flex",gap:6,marginTop:10}}>
              <input style={Object.assign({},inpKo,{flex:1,fontSize:15,padding:"9px 12px"})} value={newName} onChange={function(e){setNewName(e.target.value);}} placeholder="서류명 직접 입력 후 Enter" autoFocus onKeyDown={function(e){if(e.key==="Enter"){if(addDoc(newName))setNewName("");}}}/>
              <button style={Object.assign({},btnP,{padding:"9px 16px",fontSize:15})} onClick={function(){if(addDoc(newName))setNewName("");}}>추가</button>
            </div>
          )}
        </div>
      )}

      {docs.length===0?<p style={{margin:"4px 0 14px",fontSize:15,color:"#94A3B8"}}>위 버튼으로 필요한 서류를 추가하세요.</p>:(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))",gap:8,marginBottom:6}}>
          {docs.map(function(d,i){return <ChkItem key={d.id||i} item={d} disabled={disabled}
            uploadFn={uploadFn} getUrlFn={getUrlFn}
            onToggle={function(){var ds=docs.slice();var nd=!docIsDone(ds[i]);ds[i]=Object.assign({},ds[i],{done:nd,status:nd?"confirmed":"none"});props.onChange(ds);}}
            onStatus={function(e){var v=e.target.value;var ds=docs.slice();ds[i]=Object.assign({},ds[i],{status:v,done:(v==="confirmed"||v==="submitted")});props.onChange(ds);if(props.onLog)props.onLog("'"+d.label+"' 서류 "+docStatusMeta(v).label,"상태변경");}}
            onCopyReq={function(){copyOne(d);}}
            onDelete={function(){delDoc(i);}}
            onFA={function(f){var ds=docs.slice();ds[i]=Object.assign({},ds[i],{files:(ds[i].files||[]).concat([f])});props.onChange(ds);}}
            onFR={function(fid){var ds=docs.slice();ds[i]=Object.assign({},ds[i],{files:(ds[i].files||[]).filter(function(f){return f.id!==fid;})});props.onChange(ds);}}/>;
          })}
        </div>
      )}

      {/* 서류 요청 메시지 — 항상 표시 */}
      {!disabled&&(
        <div style={{marginTop:14,padding:"14px 16px",background:"#F0F9FF",borderRadius:12,border:"1px solid #BAE6FD"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap"}}>
            <span style={{fontSize:14,fontWeight:700,color:"#0284C7"}}>📨 서류 요청 메시지 {reqDocs.length>0&&<span style={{fontSize:12,color:"#64748B",fontWeight:500}}>· {reqDocs.length}건</span>}</span>
            <button style={Object.assign({},btnSm,{padding:"7px 14px",fontSize:13,background:"#0284C7",color:"#fff",border:"none"})} onClick={copyRequestMsg}>📋 복사하기</button>
          </div>
          {hasPayDoc&&<div style={{fontSize:12,color:"#B45309",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:8,padding:"8px 12px",marginBottom:8,lineHeight:1.5}}>💸 급여 관련 서류(급여이체증·임금대장 등)가 포함되어 있습니다. {props.payday?"이 업체 급여일은 매월 "+props.payday+"일이므로, 급여일 이후 발급이 가능합니다.":"급여 지급 이후 발급 가능한 서류이므로 급여일을 확인해 요청하세요."}</div>}
          <div style={{whiteSpace:"pre-line",fontSize:13,color:"#334155",lineHeight:1.7,background:"#fff",borderRadius:8,padding:"12px 14px",border:"1px solid #E0F2FE",maxHeight:240,overflow:"auto"}}>{buildRequestMsg()}</div>
        </div>
      )}
    </Card>
  );
}

// ── 진단·계산기 컴포넌트 ─────────────────────────────────
var DIAG_CATS=[{id:"청년",label:"청년 (만 15~34세)",icon:"🧑"},{id:"여성",label:"경력단절 여성",icon:"👩"},{id:"고령자",label:"만 60세 이상",icon:"👴"},{id:"장애인",label:"장애인",icon:"♿"},{id:"취약계층",label:"취업취약계층(프로그램 이수)",icon:"🪪"},{id:"일반",label:"해당 없음/일반",icon:"👤"}];

function diagnoseHiring(a,programs){ var results=[]; Object.keys(programs).forEach(function(key){ var p=programs[key]; var m=p.match||{}; var score=0; var reasons=[]; var blockers=[]; if(m.deprecated){results.push({program:p,status:"exclude",score:0,reasons:["2026년 신규 종료"],blockers:[]});return;} var catHit=(m.cats||[]).some(function(c){return(a.cats||[]).indexOf(c)>=0;}); if(catHit){score+=40;reasons.push("대상 유형 일치");} if(m.special&&m.special.length){var spHit=m.special.some(function(s){return(a.specials||[]).indexOf(s)>=0;});if(spHit){score+=35;reasons.push("상황 조건 일치");}} if(m.ageMin!=null||m.ageMax!=null){var maxAge=m.ageMax; if(m.milExtend&&a.gender==="male"&&a.milMonths>0){maxAge=calcMilitaryLimit(a.milMonths).maxYears;} if(a.age!=null){var ageOk=true; if(m.ageMin!=null&&a.age<m.ageMin)ageOk=false; if(maxAge!=null&&a.age>maxAge)ageOk=false; if(ageOk){score+=15;reasons.push("나이 요건 충족");}else{blockers.push("나이 요건 미충족");}}} if(m.gender&&m.gender!=="any"&&a.gender&&a.gender!==m.gender){blockers.push(m.gender==="female"?"여성 대상 제도":"성별 요건");} if(m.empTypes&&a.empType){if(m.empTypes.indexOf(a.empType)<0)blockers.push("채용형태("+m.empTypes.join("/")+") 요건");else score+=8;} if(m.companyMax!=null&&a.companySize!=null&&a.companySize>=m.companyMax){blockers.push(m.companyMax+"인 미만 대상");} if(m.companyMin!=null&&a.companySize!=null&&a.companySize<m.companyMin){blockers.push(m.companyMin+"인 이상 대상");} if(m.preApply&&a.preApply===false){if(p.id==="youth_jump"){reasons.push("사전신청 원칙(입사 3개월 내 예외)");}else{blockers.push("사전신청 필수");}} if(m.bosuFloor&&a.aboveFloor===false){blockers.push("월보수 124만↑ 필요");} if(a.noLayoff===false){blockers.push("최근 감원 이력—신청 제한");} if(p.id==="youth_jump"&&a.region==="수도권"&&a.youthEligible===false){blockers.push("수도권은 취업애로요건 필수");} if(p.id==="youth_jump"&&a.region==="비수도권"&&catHit){score+=12;reasons.push("비수도권: 기업+청년 합산 가능");} var status; if(blockers.length>0&&!catHit&&score<30)status="exclude"; else if(blockers.length>0)status="maybe"; else if(score>=55)status="recommend"; else if(score>=22)status="maybe"; else status="exclude"; results.push({program:p,status:status,score:score,reasons:reasons,blockers:blockers});}); results.sort(function(x,y){var o={recommend:0,maybe:1,exclude:2}; if(o[x.status]!==o[y.status])return o[x.status]-o[y.status]; return y.score-x.score;}); return results; }

function DiagRow(props){ var r=props.r; var p=r.program; var st1=useState(false); var gp=GROUP_COLORS[p.group]||GROUP_COLORS["커스텀"]; return(<div style={{borderRadius:12,border:"1.5px solid "+gp.light,marginBottom:8,overflow:"hidden",background:gp.badge}}><div style={{padding:"14px 16px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}} onClick={function(){st1[1](!st1[0]);}}><div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><span style={{width:10,height:10,borderRadius:5,background:gp.base,display:"inline-block",flexShrink:0}}></span><Badge color={gp.dark} bg={gp.light}>{gp.icon} {p.group}</Badge><span style={{fontSize:17,fontWeight:700,color:gp.dark}}>{p.name}</span><Badge color={gp.dark} bg="rgba(255,255,255,0.8)">{fMan(p.totalAmount)}</Badge></div><span style={{fontSize:16,color:"#94A3B8",flexShrink:0,marginLeft:8}}>{st1[0]?"▾":"▸"}</span></div>{st1[0]&&(<div style={{padding:"0 16px 16px",borderTop:"1px solid #F1F5F9"}}>{r.reasons.length>0&&<div style={{marginTop:10,fontSize:16,color:"#059669",lineHeight:1.6}}>👍 {r.reasons.join(" · ")}</div>}{r.blockers.length>0&&<div style={{marginTop:8,fontSize:16,color:"#DC2626",lineHeight:1.6}}>⚠️ {r.blockers.join(" · ")}</div>}<div style={{marginTop:10,fontSize:16,color:"#475569",lineHeight:1.7}}>{p.note}</div><div style={{marginTop:8,fontSize:16,color:"#2563EB",fontWeight:600}}>📍 {p.applyUrl}</div></div>)}</div>); }

function HiringDiagnosis(props){ var programs=props.programs; var st1=useState("new"),st2=useState([]),st3=useState(""),st4=useState(""),st5=useState(0),st6=useState("수도권"),st7=useState(""),st8=useState("정규직"),st9=useState(true),st10=useState(true),st11=useState(true),st12=useState(true),st13=useState([]),st14=useState(null); function toggle(arr,setArr,v){if(arr.indexOf(v)>=0)setArr(arr.filter(function(x){return x!==v;}));else setArr(arr.concat([v]));} var situation=st1[0]; var SPECIAL_OPTIONS=situation==="retain"?[{id:"정규직전환",label:"비정규직→정규직 전환"},{id:"정년도달",label:"정년 도달 직원"},{id:"유연근무",label:"유연근무 도입"},{id:"주4.5일제",label:"주 4.5일제 도입(20인↑)"}]:situation==="childcare"?[{id:"육아휴직",label:"직원 육아휴직"},{id:"근로시간단축",label:"육아기 근로시간 단축"},{id:"대체인력",label:"빈자리 대체 채용"},{id:"업무분담",label:"동료 업무분담"}]:[]; function runDiagnose(){var cats=st2[0].slice();if(situation==="childcare"&&cats.indexOf("육아")<0)cats.push("육아");if(situation==="retain"&&cats.indexOf("재직")<0)cats.push("재직");var specials=st13[0].slice();if(st2[0].indexOf("여성")>=0)specials.push("경력단절");if(st2[0].indexOf("취약계층")>=0)specials.push("프로그램이수");if(st2[0].indexOf("장애인")>=0)specials.push("장애");var answers={situation:situation,cats:cats,specials:specials,age:st3[0]!==""?Number(st3[0]):null,gender:st4[0]||null,milMonths:Number(st5[0])||0,region:st6[0],companySize:st7[0]!==""?Number(st7[0]):null,empType:st8[0],preApply:st9[0],noLayoff:st10[0],aboveFloor:st11[0],youthEligible:st12[0]};st14[1](diagnoseHiring(answers,programs));} var result=st14[0]; var recommend=result?result.filter(function(r){return r.status==="recommend";}):[];var maybe=result?result.filter(function(r){return r.status==="maybe";}):[];
  function SegBtn(cur,setCur,val,label){var on=cur===val;return <button onClick={function(){setCur(val);}} style={Object.assign({},btnSm,{background:on?"#DBEAFE":"#fff",color:on?"#2563EB":"#64748B",border:on?"2px solid #93C5FD":"1px solid #E2E8F0",fontSize:18})}>{label}</button>;}
  return(<div><div style={{marginBottom:20}}><h3 style={{margin:"0 0 6px",fontSize:22,fontWeight:800}}>🎯 채용 예정 진단</h3><p style={{margin:0,fontSize:17,color:"#64748B",lineHeight:1.6}}>채용 조건을 체크하면 가능성 높은 고용지원금을 안내해드려요. (가능성 안내이며, 실제 신청 전 공고 확인 필요)</p></div>
  <Card style={{padding:22,marginBottom:18}}>
    <div style={{marginBottom:18}}><Label>1. 상황</Label><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>{[["new","신규채용","🆕 신규 채용"],["retain","재직자유지","🔄 재직자 처우개선"],["childcare","육아","🤱 출산·육아"]].map(function(arr){var gp=GROUP_COLORS[arr[1]]||GROUP_COLORS["커스텀"];var on=st1[0]===arr[0];return(<button key={arr[0]} onClick={function(){st1[1](arr[0]);}} style={{padding:"18px 12px",borderRadius:14,cursor:"pointer",textAlign:"center",background:on?gp.base:gp.badge,color:on?"#fff":gp.dark,border:"2px solid "+(on?gp.base:gp.light),fontWeight:on?700:500,fontSize:17}}><div style={{fontSize:28,marginBottom:6}}>{arr[2].split(" ")[0]}</div><div>{arr[2].split(" ").slice(1).join(" ")}</div></button>);})}</div></div>
    {situation==="new"&&(<div style={{marginBottom:18}}><Label>2. 채용 대상자 (복수 선택)</Label><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:8}}>{DIAG_CATS.map(function(c){var on=st2[0].indexOf(c.id)>=0;return <button key={c.id} onClick={function(){toggle(st2[0],st2[1],c.id);}} style={{padding:"11px 14px",borderRadius:10,cursor:"pointer",fontSize:17,textAlign:"left",background:on?"#EFF6FF":"#fff",border:on?"2px solid #93C5FD":"1px solid #E2E8F0",color:on?"#2563EB":"#475569",fontWeight:on?600:400}}>{c.icon} {c.label}</button>;})}</div></div>)}
    {SPECIAL_OPTIONS.length>0&&(<div style={{marginBottom:18}}><Label>2. 구체적 상황 (복수 선택)</Label><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:8}}>{SPECIAL_OPTIONS.map(function(c){var on=st13[0].indexOf(c.id)>=0;return <button key={c.id} onClick={function(){toggle(st13[0],st13[1],c.id);}} style={{padding:"11px 14px",borderRadius:10,cursor:"pointer",fontSize:17,textAlign:"left",background:on?"#EFF6FF":"#fff",border:on?"2px solid #93C5FD":"1px solid #E2E8F0",color:on?"#2563EB":"#475569",fontWeight:on?600:400}}>{c.label}</button>;})}</div></div>)}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:14,marginBottom:16}}>
      <div><Label>나이(만)</Label><input type="number" style={inp} value={st3[0]} onChange={function(e){st3[1](e.target.value);}} placeholder="29"/></div>
      <div><Label>성별</Label><div style={{display:"flex",gap:6}}>{SegBtn(st4[0],st4[1],"male","남")}{SegBtn(st4[0],st4[1],"female","여")}</div></div>
      {st4[0]==="male"&&<div><Label>군복무(월)</Label><input type="number" style={inp} value={st5[0]} onChange={function(e){st5[1](e.target.value);}} placeholder="18"/></div>}
      <div><Label>회사 규모(고용보험)</Label><input type="number" style={inp} value={st7[0]} onChange={function(e){st7[1](e.target.value);}} placeholder="피보험자 수"/></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14,marginBottom:16}}>
      <div><Label>지역</Label><div style={{display:"flex",gap:6}}>{SegBtn(st6[0],st6[1],"수도권","수도권")}{SegBtn(st6[0],st6[1],"비수도권","비수도권")}</div></div>
      <div><Label>채용형태</Label><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{["정규직","계약직","인턴","대체인력"].map(function(t){return SegBtn(st8[0],st8[1],t,t);})}</div></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10,marginBottom:16}}>
      {[["채용 전(사전신청 가능)",st9],["최근 감원 이력 없음",st10],["월보수 124만원 이상",st11]].map(function(arr,i){var st=arr[1];return(<label key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",borderRadius:10,background:st[0]?"#ECFDF5":"#FEF2F2",border:st[0]?"1px solid #A7F3D0":"1px solid #FECACA",cursor:"pointer",fontSize:17}}><input type="checkbox" checked={st[0]} onChange={function(){st[1](!st[0]);}} style={{width:18,height:18,accentColor:"#059669"}}/><span style={{color:st[0]?"#059669":"#DC2626"}}>{arr[0]}</span></label>);})}
      {st2[0].indexOf("청년")>=0&&st6[0]==="수도권"&&(<label style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",borderRadius:10,background:st12[0]?"#ECFDF5":"#FEF2F2",border:st12[0]?"1px solid #A7F3D0":"1px solid #FECACA",cursor:"pointer",fontSize:17}}><input type="checkbox" checked={st12[0]} onChange={function(){st12[1](!st12[0]);}} style={{width:18,height:18,accentColor:"#059669"}}/><span style={{color:st12[0]?"#059669":"#DC2626"}}>취업애로요건 해당(청년·수도권)</span></label>)}
    </div>
    <button style={Object.assign({},btnP,{width:"100%",padding:16,fontSize:20})} onClick={runDiagnose}>🎯 지원금 가능성 진단</button>
  </Card>
  {result&&(<div>{recommend.length>0&&(<Card style={{padding:20,marginBottom:16,border:"2px solid #6EE7B7"}}><h4 style={{margin:"0 0 12px",fontSize:20,fontWeight:700,color:"#059669"}}>✅ 가능성 높음 ({recommend.length})</h4>{recommend.map(function(r){return <DiagRow key={r.program.id} r={r}/>;})}</Card>)}{maybe.length>0&&(<Card style={{padding:20,marginBottom:16,border:"1px solid #E2E8F0"}}><h4 style={{margin:"0 0 12px",fontSize:20,fontWeight:700,color:"#475569"}}>⚠️ 조건 확인 필요 ({maybe.length})</h4>{maybe.map(function(r){return <DiagRow key={r.program.id} r={r}/>;})}</Card>)}{recommend.length===0&&maybe.length===0&&(<Card style={{padding:36,textAlign:"center"}}><div style={{fontSize:40,marginBottom:10}}>🔍</div><p style={{color:"#94A3B8",fontSize:18,margin:0}}>입력 조건에 뚜렷하게 맞는 지원금이 없어요.</p></Card>)}<Notice>진단 결과는 가능성 안내이며 확정이 아닙니다. 실제 신청 전 최신 공고를 확인하세요.</Notice></div>)}</div>);
}

function WageCalc(){
  var st1=useState(""),st2=useState(40),st3=useState(1),stTab=useState("deduct");
  var stAnnual=useState(""); // 연봉→월급 변환
  var monthly=Number(st1[0])||0;
  var result=useMemo(function(){
    if(!monthly)return null;
    var wh=Number(st2[0])||40;
    var mh=wh>=40?209:Math.round((wh+(wh>=15?wh/40*8:0))*4.345);
    var hourlyWage=Math.round(monthly/mh);
    var minMonthly=Math.round(MIN_WAGE_2026*mh);
    // 4대보험 근로자
    var pensionBase=Math.min(monthly,5900000);
    var pension_ee=Math.round(pensionBase*0.045);
    var health_ee=Math.round(monthly*0.03545);
    var care_ee=Math.round(health_ee*0.1295);
    var employ_ee=Math.round(monthly*0.009);
    var total4_ee=pension_ee+health_ee+care_ee+employ_ee;
    // 4대보험 사업주
    var pension_er=Math.round(pensionBase*0.045);
    var health_er=Math.round(monthly*0.03545);
    var care_er=Math.round(health_er*0.1295);
    var employ_er=Math.round(monthly*0.009);
    var injury_er=Math.round(monthly*0.0143);
    var total4_er=pension_er+health_er+care_er+employ_er+injury_er;
    // 소득세 (간이세액표 근사)
    var annual=monthly*12;
    var emDed; if(annual<=5000000)emDed=annual*0.70; else if(annual<=15000000)emDed=3500000+(annual-5000000)*0.40; else if(annual<=45000000)emDed=7500000+(annual-15000000)*0.15; else if(annual<=100000000)emDed=12000000+(annual-45000000)*0.05; else emDed=14750000+(annual-100000000)*0.02;
    var deps=Math.max(1,Number(st3[0])||1);
    var taxBase=Math.max(0,annual-emDed-1500000*deps);
    var annTax; if(taxBase<=14000000)annTax=taxBase*0.06; else if(taxBase<=50000000)annTax=840000+(taxBase-14000000)*0.15; else if(taxBase<=88000000)annTax=6240000+(taxBase-50000000)*0.24; else if(taxBase<=150000000)annTax=15360000+(taxBase-88000000)*0.35; else annTax=37060000+(taxBase-150000000)*0.38;
    var credit=Math.min(annTax<=1300000?annTax*0.55:715000+(annTax-1300000)*0.30,740000);
    var incomeTax=Math.max(0,Math.round((annTax-credit)/12));
    var localTax=Math.round(incomeTax*0.10);
    return{
      hourlyWage:hourlyWage,monthlyHours:mh,minMonthly:minMonthly,isAboveMin:hourlyWage>=MIN_WAGE_2026,isAboveFloor:monthly>=BOSU_FLOOR_2026,gap:hourlyWage-MIN_WAGE_2026,
      pension_ee:pension_ee,health_ee:health_ee,care_ee:care_ee,employ_ee:employ_ee,total4_ee:total4_ee,
      pension_er:pension_er,health_er:health_er,care_er:care_er,employ_er:employ_er,injury_er:injury_er,total4_er:total4_er,
      incomeTax:incomeTax,localTax:localTax,
      totalDeduct:total4_ee+incomeTax+localTax,
      netPay:monthly-total4_ee-incomeTax-localTax,
      totalEmployerCost:monthly+total4_er
    };
  },[monthly,st2[0],st3[0]]);

  function DRow(label,pct,amount,accent){return(<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 16px",borderBottom:"1px solid rgba(0,0,0,0.04)",fontSize:15}}><div><span style={{color:"#1E293B"}}>{label}</span>{pct&&<span style={{fontSize:12,color:"#94A3B8",marginLeft:6}}>{pct}</span>}</div><span style={{fontWeight:600,color:accent||"#DC2626"}}>−{(amount||0).toLocaleString()}원</span></div>);}
  function ERow(label,pct,amount){return(<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 16px",borderBottom:"1px solid rgba(0,0,0,0.04)",fontSize:15}}><div><span style={{color:"#1E293B"}}>{label}</span>{pct&&<span style={{fontSize:12,color:"#94A3B8",marginLeft:6}}>{pct}</span>}</div><span style={{fontWeight:600,color:"#059669"}}>+{(amount||0).toLocaleString()}원</span></div>);}

  return(
    <div className="fade-in">
      <Card style={{padding:"20px 24px",marginBottom:16}}>
        <h2 style={{margin:"0 0 4px",fontSize:FS_PAGE_TITLE,fontWeight:800}}>🧮 급여 계산기</h2>
        <p style={{margin:"0 0 20px",fontSize:FS_BODY,color:"#64748B",lineHeight:1.6}}>2026년 기준 · 최저임금 시급 <strong>{MIN_WAGE_2026.toLocaleString()}원</strong> · 월환산 <strong>{MIN_WAGE_MONTH_2026.toLocaleString()}원</strong>(209h)</p>

        {/* 연봉↔월급 변환 */}
        <div style={{padding:"12px 16px",background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:10,marginBottom:20,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <span style={{fontSize:15,fontWeight:700,color:"#475569",flexShrink:0}}>💡 연봉 → 월급</span>
          <input type="number" style={Object.assign({},inp,{flex:1,minWidth:140,maxWidth:220,margin:0})} value={stAnnual[0]} onChange={function(e){stAnnual[1](e.target.value);var m=Math.round(Number(e.target.value)/12);if(m)st1[1](String(m));}} placeholder="연봉 입력 (예: 30000000)"/>
          {stAnnual[0]&&Number(stAnnual[0])>0&&<span style={{fontSize:15,color:"#1D4ED8",fontWeight:700}}>→ 월 {Math.round(Number(stAnnual[0])/12).toLocaleString()}원</span>}
        </div>

        {/* 주요 입력 */}
        <div className="wage-input-grid" style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:12,marginBottom:8}}>
          <div>
            <Label>월 급여 (세전, 원)</Label>
            <input type="number" style={inp} value={st1[0]} onChange={function(e){st1[1](e.target.value);stAnnual[1]("");}} placeholder="2,200,000"/>
            <div style={{display:"flex",gap:4,marginTop:6,flexWrap:"wrap"}}>
              {[2060000,2156880,2500000,3000000,4000000].map(function(v){return(
                <button key={v} onClick={function(){st1[1](String(v));stAnnual[1]("");}}
                  style={{padding:"3px 8px",fontSize:11,borderRadius:5,border:"1px solid #E2E8F0",background:monthly===v?"#DBEAFE":"#F8FAFC",color:monthly===v?"#2563EB":"#64748B",cursor:"pointer",fontFamily:FF}}>
                  {fManS(v)}
                </button>
              );})}
            </div>
          </div>
          <div>
            <Label>주 소정근로시간</Label>
            <select style={inp} value={st2[0]} onChange={function(e){st2[1](e.target.value);}}>
              {[[40,"40시간 (통상)"],[35,"35시간"],[30,"30시간"],[20,"20시간"],[15,"15시간"]].map(function(arr){return <option key={arr[0]} value={arr[0]}>{arr[1]}</option>;})}
            </select>
          </div>
          <div>
            <Label>부양가족 수 (본인포함)</Label>
            <select style={inp} value={st3[0]} onChange={function(e){st3[1](e.target.value);}}>
              {[1,2,3,4,5].map(function(n){return <option key={n} value={n}>{n}명</option>;})}
            </select>
          </div>
        </div>
      </Card>

      {!monthly&&(
        <Card style={{padding:"48px 24px",textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:12}}>🧮</div>
          <p style={{color:"#94A3B8",fontSize:18,margin:0}}>월 급여를 입력하면 실수령액, 4대보험, 사업주 부담금을 자동으로 계산해 드립니다.</p>
        </Card>
      )}

      {result&&(
        <div className="fade-in">
          {/* 탭 */}
          <div style={{display:"flex",gap:0,borderBottom:"2px solid #E2E8F0",marginBottom:20,background:"#fff",borderRadius:"12px 12px 0 0",overflow:"hidden"}}>
            {[["deduct","💰 실수령액"],["employer","🏢 사업주 부담"],["minwage","📊 최저임금 판정"]].map(function(arr){var on=stTab[0]===arr[0];return(
              <button key={arr[0]} onClick={function(){stTab[1](arr[0]);}}
                style={{flex:1,padding:"13px 6px",fontSize:FS_BODY,fontWeight:on?700:500,color:on?"#2563EB":"#64748B",background:on?"#EFF6FF":"transparent",border:"none",borderBottom:on?"3px solid #2563EB":"3px solid transparent",cursor:"pointer",fontFamily:FF,transition:"all 0.15s",whiteSpace:"nowrap"}}>
                {arr[1]}
              </button>
            );})}
          </div>

          {stTab[0]==="deduct"&&(
            <div className="fade-in">
              {/* 요약 배너 */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:16}}>
                {[["세전 월급",monthly,"#1E293B"],["총 공제액",result.totalDeduct,"#DC2626"],["실수령액",result.netPay,"#2563EB"]].map(function(arr,i){return(
                  <Card key={i} className="kpi-card" style={{padding:"16px 18px",textAlign:"center"}}>
                    <div style={{fontSize:13,color:"#64748B",marginBottom:4}}>{arr[0]}</div>
                    <div style={{fontSize:22,fontWeight:800,color:arr[2]}}>{arr[1].toLocaleString()}원</div>
                  </Card>
                );})}
              </div>
              {/* 공제 명세 */}
              <Card style={{padding:0,overflow:"hidden",marginBottom:12}}>
                <div style={{padding:"11px 16px",background:"#F8FAFC",borderBottom:"2px solid #E2E8F0",fontSize:15,fontWeight:700,color:"#1E293B"}}>급여 공제 내역</div>
                <div style={{background:"#F8FAFC"}}>
                  <div style={{padding:"8px 16px",fontSize:12,fontWeight:700,color:"#475569",letterSpacing:"0.05em"}}>▸ 4대보험 (총 {result.total4_ee.toLocaleString()}원)</div>
                  {DRow("국민연금","4.5%",result.pension_ee,"#475569")}
                  {DRow("건강보험","3.545%",result.health_ee,"#475569")}
                  {DRow("장기요양","건보×12.95%",result.care_ee,"#475569")}
                  {DRow("고용보험","0.9%",result.employ_ee,"#475569")}
                </div>
                <div style={{background:"#FEF2F2"}}>
                  <div style={{padding:"8px 16px",fontSize:12,fontWeight:700,color:"#991B1B",letterSpacing:"0.05em"}}>▸ 세금 (총 {(result.incomeTax+result.localTax).toLocaleString()}원)</div>
                  {DRow("소득세","근사치",result.incomeTax,"#DC2626")}
                  {DRow("지방소득세","소득세×10%",result.localTax,"#DC2626")}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 18px",background:"#2563EB"}}>
                  <span style={{fontSize:17,fontWeight:700,color:"#fff"}}>💵 실수령액</span>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:28,fontWeight:800,color:"#fff"}}>{result.netPay.toLocaleString()}원</div>
                    <div style={{fontSize:13,color:"rgba(255,255,255,0.75)"}}>세전의 {Math.round(result.netPay/monthly*100)}%</div>
                  </div>
                </div>
              </Card>
              <p style={{fontSize:12,color:"#94A3B8",margin:0}}>* 소득세는 간이세액표 근사치입니다. 실제 공제액은 연말정산 결과에 따라 달라질 수 있습니다.</p>
            </div>
          )}

          {stTab[0]==="employer"&&(
            <div className="fade-in">
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                {[["사업주 4대보험 부담",result.total4_er,"#059669"],["월 총 인건비",result.totalEmployerCost,"#2563EB"]].map(function(arr,i){return(
                  <Card key={i} className="kpi-card" style={{padding:"16px 18px",textAlign:"center"}}>
                    <div style={{fontSize:13,color:"#64748B",marginBottom:4}}>{arr[0]}</div>
                    <div style={{fontSize:22,fontWeight:800,color:arr[2]}}>{arr[1].toLocaleString()}원</div>
                  </Card>
                );})}
              </div>
              <Card style={{padding:0,overflow:"hidden",marginBottom:12}}>
                <div style={{padding:"11px 16px",background:"#F8FAFC",borderBottom:"2px solid #E2E8F0",fontSize:15,fontWeight:700,color:"#1E293B"}}>사업주 비용 명세</div>
                <div style={{padding:"11px 16px",display:"flex",justifyContent:"space-between",fontSize:16,borderBottom:"1px solid #F1F5F9"}}>
                  <span style={{color:"#1E293B"}}>근로자 월급</span><span style={{fontWeight:700}}>{monthly.toLocaleString()}원</span>
                </div>
                <div style={{background:"#F8FAFC"}}>
                  <div style={{padding:"8px 16px",fontSize:12,fontWeight:700,color:"#475569",letterSpacing:"0.05em"}}>▸ 4대보험 사업주 부담 (총 {result.total4_er.toLocaleString()}원)</div>
                  {ERow("국민연금","4.5%",result.pension_er)}
                  {ERow("건강보험","3.545%",result.health_er)}
                  {ERow("장기요양","건보×12.95%",result.care_er)}
                  {ERow("고용보험","0.9% (150인↓)",result.employ_er)}
                  {ERow("산재보험","1.43% (평균)",result.injury_er)}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 18px",background:"#0F172A"}}>
                  <span style={{fontSize:17,fontWeight:700,color:"#fff"}}>🏢 월 총 인건비</span>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:28,fontWeight:800,color:"#fff"}}>{result.totalEmployerCost.toLocaleString()}원</div>
                    <div style={{fontSize:13,color:"rgba(255,255,255,0.75)"}}>연간 약 {Math.round(result.totalEmployerCost*12/10000).toLocaleString()}만원</div>
                  </div>
                </div>
              </Card>
              <div style={{padding:"12px 16px",background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:8,fontSize:14,color:"#475569"}}>
                💡 사업주 부담 비율은 월급의 약 <strong style={{color:"#1D4ED8"}}>{Math.round(result.total4_er/monthly*100)}%</strong>입니다. 산재보험율은 업종별 상이(평균 1.43% 적용).
              </div>
            </div>
          )}

          {stTab[0]==="minwage"&&(
            <div className="fade-in">
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                <Card style={{padding:"18px",textAlign:"center",border:"1.5px solid "+(result.isAboveMin?"#6EE7B7":"#FECACA")}}>
                  <div style={{fontSize:14,color:"#64748B",marginBottom:4}}>환산 시급</div>
                  <div style={{fontSize:34,fontWeight:800,color:result.isAboveMin?"#059669":"#DC2626"}}>{result.hourlyWage.toLocaleString()}원</div>
                  <div style={{fontSize:12,color:"#94A3B8",marginTop:2}}>{result.monthlyHours}시간/월 기준</div>
                </Card>
                <Card style={{padding:"18px",textAlign:"center",border:"1.5px solid "+(result.gap>=0?"#6EE7B7":"#FECACA")}}>
                  <div style={{fontSize:14,color:"#64748B",marginBottom:4}}>최저임금 대비</div>
                  <div style={{fontSize:34,fontWeight:800,color:result.gap>=0?"#059669":"#DC2626"}}>{result.gap>=0?"+":""}{result.gap.toLocaleString()}원</div>
                  <div style={{fontSize:12,color:"#94A3B8",marginTop:2}}>기준: {MIN_WAGE_2026.toLocaleString()}원/h</div>
                </Card>
              </div>
              <div style={{display:"grid",gap:10}}>
                <div style={{padding:"16px 20px",borderRadius:12,fontSize:17,fontWeight:600,background:result.isAboveMin?"#D1FAE5":"#FEE2E2",color:result.isAboveMin?"#059669":"#DC2626",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span>{result.isAboveMin?"✅ 최저임금 충족":"❌ 최저임금 미달"}</span>
                  {!result.isAboveMin&&<span style={{fontSize:14,opacity:0.8}}>월 {result.minMonthly.toLocaleString()}원 이상 필요</span>}
                </div>
                <div style={{padding:"16px 20px",borderRadius:12,fontSize:17,fontWeight:600,background:result.isAboveFloor?"#EFF6FF":"#F1F5F9",color:result.isAboveFloor?"#2563EB":"#64748B"}}>
                  {result.isAboveFloor?"✅ 월보수 하한선(124만원) 충족 — 주요 지원금 신청 가능":"⚠️ 월보수 124만원 미만 — 고용촉진장려금·청년도약 등 원천 제외"}
                </div>
                <div style={{padding:"14px 20px",borderRadius:12,background:"#F8FAFC",border:"1px solid #E2E8F0",fontSize:15,color:"#475569",lineHeight:1.7}}>
                  <strong style={{color:"#1E293B"}}>참고</strong> · 2026년 최저임금 시급 {MIN_WAGE_2026.toLocaleString()}원 · 월환산 {MIN_WAGE_MONTH_2026.toLocaleString()}원(주40h·월209h 기준) · 고용보험 보수 하한선 {BOSU_FLOOR_2026.toLocaleString()}원<br/>
                  <span style={{color:"#94A3B8",fontSize:13}}>※ 4대보험·세액은 근사치이며, 실제 신고·근로계약 조건 및 연도별 최신 기준은 별도 확인이 필요합니다.</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Simulator(props){ var programs=props.programs; var st1=useState("youth_jump"),st2=useState(1),st3=useState(""); var selectedProgram=programs[st1[0]]; var results=useMemo(function(){if(!selectedProgram||!st2[0])return{monthly:[],total:0}; var count=parseInt(st2[0])||0; var startDate=st3[0]||new Date().toISOString().split("T")[0]; var monthly=[]; var totalAmount=0; for(var i=0;i<count;i++){(selectedProgram.rounds||[]).forEach(function(r){var eligDate=addMo(startDate,r.month);var ym=eligDate.substring(0,7);var existing=monthly.find(function(m){return m.month===ym;});if(existing){existing.amount+=r.amount;existing.count++;}else{monthly.push({month:ym,amount:r.amount,count:1});}totalAmount+=r.amount;});} return{monthly:monthly.sort(function(a,b){return a.month.localeCompare(b.month);}),total:totalAmount,perPerson:selectedProgram.totalAmount||0};}, [selectedProgram,st2[0],st3[0]]);
  return(<Card style={{padding:"clamp(16px,4vw,24px)",marginBottom:20}}>
    <h4 style={{margin:"0 0 16px",fontSize:FS_SECTION,fontWeight:800}}>📊 예상 수령액 시뮬레이터</h4>
    <div className="sim-grid" style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1.1fr)",gap:20,alignItems:"start"}}>
      {/* 좌: 입력 */}
      <div style={{minWidth:0}}>
        <div style={{marginBottom:16}}><Label>지원금 선택</Label>{["신규채용","재직자유지","육아"].map(function(grp){var gp=GROUP_COLORS[grp]||GROUP_COLORS["커스텀"];var items=Object.values(programs).filter(function(p){return p.group===grp;});if(!items.length)return null;return(<div key={grp} style={{marginBottom:10,padding:"12px 14px",borderRadius:12,background:gp.badge,border:"1.5px solid "+gp.light}}><div style={{fontSize:FS_BODY,fontWeight:700,color:gp.dark,marginBottom:8}}>{gp.icon} {grp}</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{items.map(function(p){var on=st1[0]===p.id;return(<button key={p.id} onClick={function(){st1[1](p.id);}} style={{padding:"7px 13px",borderRadius:8,fontSize:FS_BTN_SM,cursor:"pointer",fontWeight:on?700:500,background:on?gp.base:"#fff",color:on?"#fff":gp.text,border:on?"none":"1.5px solid "+gp.light}}>{p.name}</button>);})}</div></div>);})}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><Label>채용 예정 인원</Label><input type="number" style={inp} value={st2[0]} onChange={function(e){st2[1](e.target.value);}} min="1" placeholder="1"/></div><div><Label>예상 입사일</Label><input type="date" style={inp} value={st3[0]} onChange={function(e){st3[1](e.target.value);}}/></div></div>
      </div>
      {/* 우: 결과 */}
      <div style={{minWidth:0}}>
      {results.total>0?(<React.Fragment><div style={{padding:"20px 18px",background:"#2563EB",borderRadius:14,color:"#fff",marginBottom:16,textAlign:"center"}}><div style={{fontSize:FS_BODY,opacity:0.85,marginBottom:6,fontWeight:600}}>예상 총 수령액 (최대치)</div><div style={{fontSize:FS_HERO_NUM,fontWeight:800,letterSpacing:"-1px",lineHeight:1.1,wordBreak:"keep-all"}}>{fMan(results.total)}</div><div style={{fontSize:FS_BODY,opacity:0.75,marginTop:6}}>1인당 {fMan(results.perPerson)} × {st2[0]}명</div></div><div style={{fontSize:FS_CARD_TITLE,fontWeight:700,marginBottom:8}}>📅 월별 예상 수령</div><div style={{maxHeight:280,overflow:"auto",display:"grid",gap:4}}>{results.monthly.map(function(m,i){var d=new Date(m.month+"-01");return(<div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,padding:"10px 14px",background:i%2===0?"#F8FAFC":"#fff",borderRadius:8,border:"1px solid #F1F5F9"}}><span style={{fontSize:FS_BODY,color:"#475569",fontWeight:500,whiteSpace:"nowrap"}}>{d.getFullYear()}년 {d.getMonth()+1}월</span><div style={{textAlign:"right",whiteSpace:"nowrap"}}><span style={{fontSize:FS_LIST,fontWeight:700,color:"#2563EB"}}>{fMan(m.amount)}</span><span style={{fontSize:FS_BADGE,color:"#94A3B8",marginLeft:6}}>({m.count}건)</span></div></div>);})}</div><div style={{marginTop:14}}><button style={Object.assign({},btnP,{width:"100%",padding:"12px 18px"})} onClick={function(){var pname=(programs[st1[0]]||{}).name||"";var lines=results.monthly.map(function(m){var d=new Date(m.month+"-01");return d.getFullYear()+"년 "+(d.getMonth()+1)+"월 "+fMan(m.amount);});var txt="대표님, 현재 "+pname+" 기준으로 "+st2[0]+"명을 채용하실 경우\n총 예상 지원금은 최대 "+fMan(results.total)+"이며,\n"+lines.join(", ")+" 순으로 수령 가능성이 있습니다.\n단, 실제 지급 여부는 요건 충족 및 기관 심사 결과에 따라 달라질 수 있습니다.";navigator.clipboard.writeText(txt).then(function(){toast("상담용 문구가 복사되었습니다. 고객에게 바로 보내세요.","success");});}}>📋 상담용 문구 복사</button></div><div style={{marginTop:12,padding:"11px 14px",background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:10,fontSize:FS_BADGE,color:"#64748B",lineHeight:1.7}}>※ 예상 수령액은 공고 기준과 입력값을 바탕으로 계산한 <strong>참고 금액</strong>입니다. 실제 지급액은 심사 결과·예산·고용 유지 여부 등에 따라 달라질 수 있습니다.</div></React.Fragment>):(<div style={{padding:"40px 20px",textAlign:"center",background:"#F8FAFC",borderRadius:14,border:"1px dashed #CBD5E1"}}><div style={{fontSize:40,marginBottom:10}}>📊</div><div style={{fontSize:FS_BODY,color:"#94A3B8"}}>지원금·인원·입사일을 입력하면<br/>월별 예상 수령액이 표시됩니다.</div></div>)}
      </div>
    </div>
  </Card>); }

// ── 보조 컴포넌트 ─────────────────────────────────────────
function JuminInput(props){ var st1=useState(""); function handleChange(e){ var val=e.target.value.replace(/[^0-9]/g,"").substring(0,7); st1[1](val); if(val.length>=7){var parsed=parseJumin(val);if(parsed){props.onParsed(parsed);}}} return(<div><Label color="#1D4ED8">주민번호 앞 7자리 (자동입력)</Label><input style={Object.assign({},inp,{borderColor:"#93C5FD",background:"#fff"})} value={st1[0]} onChange={handleChange} placeholder="9501011" maxLength={7}/>{st1[0].length===7&&(<div style={{fontSize:11,color:"#059669",marginTop:4}}>✅ 생년월일/성별만 추출되어 저장됩니다 (주민번호 원본은 저장되지 않음)</div>)}<div style={{fontSize:11,color:"#475569",marginTop:6,padding:"7px 9px",background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:6,lineHeight:1.5}}>🔒 민감정보 보호를 위해 주민등록번호 전체 저장은 권장하지 않습니다. 생년월일과 성별만으로 지원금 요건을 판정합니다. 입력한 7자리는 생년월일·성별 변환에만 쓰이고 저장되지 않습니다.</div></div>); }

function EligChk(props){ var bd=props.bd,gen=props.gen,mil=props.mil,ec=props.ec,xc=props.xc,hd=props.hd; var ageD=calcAgeDetailed(bd,hd); var age=ageD?ageD.years:null; var ageMonths=ageD?ageD.totalMonths:0; var milLimit=gen==="male"?calcMilitaryLimit(mil):{maxTotalMonths:34*12,maxYears:34,maxRemainMonths:0}; var aOk=ageD!==null&&ageMonths>=15*12&&ageMonths<=milLimit.maxTotalMonths; var anyE=Object.values(ec).some(function(v){return v;}); var failedX=EXCL.filter(function(x){return xc[x.id]===false;}); var allXok=EXCL.every(function(x){return xc[x.id]===true;}); var ok=aOk&&anyE&&allXok; var has=bd&&bd!=="2000-01-01"; var maxLabel=milLimit.maxRemainMonths>0?"만"+milLimit.maxYears+"세"+milLimit.maxRemainMonths+"개월":"만"+milLimit.maxYears+"세"; var nearBorder=ageD&&gen==="male"&&mil>0&&ageMonths>34*12&&ageMonths<=milLimit.maxTotalMonths;
  return(<div style={{border:"2px solid #BFDBFE",borderRadius:10,padding:12,background:"#F0F7FF"}}><div style={{fontSize:14,fontWeight:700,color:"#1D4ED8",marginBottom:8}}>🔍 청년도약 자격요건</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}><div><Label color="#1D4ED8">생년월일</Label><input type="date" style={Object.assign({},inp,{borderColor:"#93C5FD",background:"#fff",fontSize:12,padding:"8px 10px"})} value={bd||"2000-01-01"} onChange={function(e){props.setBd(e.target.value);}}/></div><div><Label color="#1D4ED8">성별</Label><div style={{display:"flex",gap:3}}>{[["male","남"],["female","여"]].map(function(arr){return <button key={arr[0]} onClick={function(){props.setGen(arr[0]);}} style={Object.assign({},btnSm,{flex:1,background:gen===arr[0]?"#DBEAFE":"#fff",color:gen===arr[0]?"#2563EB":"#64748B",border:gen===arr[0]?"2px solid #93C5FD":"1px solid #E2E8F0",fontSize:11})}>{arr[1]}</button>;})}</div></div>{gen==="male"&&<div><Label color="#1D4ED8">군복무(월)</Label><input type="number" style={Object.assign({},inp,{borderColor:"#93C5FD",background:"#fff",fontSize:12,padding:"8px 10px"})} value={mil||""} onChange={function(e){props.setMil(Number(e.target.value));}} placeholder="18"/></div>}</div>{age!==null&&<div style={{padding:"4px 8px",borderRadius:4,marginBottom:6,background:aOk?"#D1FAE5":"#FEE2E2",fontSize:12,fontWeight:600}}>{aOk?<span style={{color:"#059669"}}>✅ 만{age}세 (상한: {maxLabel})</span>:<span style={{color:"#DC2626"}}>❌ 만{age}세 미충족</span>}</div>}{nearBorder&&<div style={{padding:"4px 8px",borderRadius:4,marginBottom:6,background:"#F1F5F9",fontSize:11,color:"#64748B"}}>⚠️ 경계선 — 관할기관 확인 필요</div>}<div style={{marginBottom:8}}><div style={{fontSize:12,fontWeight:600,marginBottom:4,color:"#1D4ED8"}}>📋 취업애로요건 (1개↑)</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:3}}>{ELIG.map(function(e){var isChecked=!!ec[e.id];return(<label key={e.id} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 6px",borderRadius:4,cursor:"pointer",background:isChecked?"#ECFDF5":"#fff",border:isChecked?"1px solid #A7F3D0":"1px solid #E2E8F0",fontSize:11}} title={e.desc}><input type="checkbox" checked={isChecked} onChange={function(){props.setEc(function(p){var n=Object.assign({},p);n[e.id]=!p[e.id];return n;});}} style={{accentColor:"#059669",width:12,height:12}}/><span style={{color:isChecked?"#059669":"#475569"}}>{e.label}</span></label>);})}</div></div><div style={{marginBottom:8}}><div style={{fontSize:12,fontWeight:600,marginBottom:4,color:"#DC2626"}}>🚫 제외요건 확인</div><div style={{display:"grid",gap:3}}>{EXCL.map(function(x){var isChecked=!!xc[x.id];return(<label key={x.id} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 6px",borderRadius:4,cursor:"pointer",background:isChecked?"#ECFDF5":"#FEF2F2",border:isChecked?"1px solid #A7F3D0":"1px solid #FECACA",fontSize:11}} title={x.desc}><input type="checkbox" checked={isChecked} onChange={function(){props.setXc(function(p){var n=Object.assign({},p);n[x.id]=!p[x.id];return n;});}} style={{accentColor:"#059669",width:12,height:12}}/><span style={{color:isChecked?"#059669":"#DC2626"}}>{x.label}</span></label>);})}</div></div>{has&&failedX.length>0&&<div style={{padding:"7px 10px",marginBottom:6,borderRadius:6,background:"#FEF2F2",border:"1px solid #FECACA",fontSize:11,color:"#DC2626",fontWeight:600,lineHeight:1.5}}>🚫 제외요건 {failedX.length}개에 해당할 수 있습니다. 진행 전 반드시 운영기관 확인이 필요합니다. (저장은 가능하며, 상태를 '보류'로 관리하세요)</div>}<div style={{padding:"8px",borderRadius:6,textAlign:"center",background:ok?"#ECFDF5":has?"#F1F5F9":"#F1F5F9",fontSize:13,fontWeight:700}}>{ok?<span style={{color:"#059669"}}>✅ 대상자 예상</span>:has?<span style={{color:"#64748B"}}>⚠️ 일부 요건 확인 필요</span>:<span style={{color:"#64748B"}}>정보입력</span>}</div></div>);
}

function BulkUpload(props){ var programs=props.programs,onUpload=props.onUpload; var st1=useState(false),st2=useState(""),st3=useState([]),st4=useState(""); function parseData(){if(!st2[0].trim()){st4[1]("데이터를 붙여넣어 주세요");return;}var parsed=parseExcelData(st2[0],programs);if(parsed.length===0){st4[1]("유효한 데이터가 없습니다.");return;}st3[1](parsed);st4[1]("");} function doUpload(){if(st3[0].length===0)return;var n=st3[0].length;onUpload(st3[0]);st1[1](false);st2[1]("");st3[1]([]);toast(n+"명이 등록되었습니다.","success");} function copyTemplate(){navigator.clipboard.writeText(makeExcelTemplate());toast("엑셀 양식이 복사되었습니다.","success");} return(<React.Fragment><button style={btnSm} onClick={function(){st1[1](true);st2[1]("");st3[1]([]);st4[1]("");}}>📥 일괄등록</button><Modal open={st1[0]} onClose={function(){st1[1](false);}} title="📥 직원 일괄 등록" width={600}><div style={{display:"grid",gap:16}}><div style={{padding:14,background:"#EFF6FF",borderRadius:10,border:"1px solid #BFDBFE"}}><div style={{fontSize:14,fontWeight:700,color:"#2563EB",marginBottom:8}}>Step 1. 양식 복사</div><button style={btnSm} onClick={copyTemplate}>📋 양식 복사</button></div><div style={{padding:14,background:"#F8FAFC",borderRadius:10,border:"1px solid #E2E8F0"}}><div style={{fontSize:14,fontWeight:700,color:"#475569",marginBottom:8}}>Step 2. 데이터 붙여넣기</div><textarea style={Object.assign({},inp,{height:110,resize:"none",fontFamily:"monospace",fontSize:11})} value={st2[0]} onChange={function(e){st2[1](e.target.value);st3[1]([]);}} placeholder={"이름\t주민번호앞7자리\t입사일\t연락처\t이메일\t지원금ID"}/>{st4[0]&&<p style={{fontSize:12,color:"#DC2626",marginTop:4}}>{st4[0]}</p>}<button style={Object.assign({},btnP,{marginTop:8})} onClick={parseData}>데이터 확인</button></div>{st3[0].length>0&&(<div style={{padding:14,background:"#F8FAFC",borderRadius:10,border:"1px solid #E2E8F0"}}><div style={{fontSize:14,fontWeight:700,color:"#475569",marginBottom:8}}>Step 3. 확인 및 등록 ({st3[0].length}명)</div><div style={{maxHeight:150,overflow:"auto",marginBottom:8}}>{st3[0].map(function(row,i){return(<div key={i} style={{fontSize:11,padding:"4px 0",borderBottom:"1px solid #F1F5F9"}}>{row.name} · {row.birthDate} · {row.startDate} · {row.phone}</div>);})}</div><button style={Object.assign({},btnP,{width:"100%"})} onClick={doUpload}>✅ {st3[0].length}명 등록하기</button></div>)}</div></Modal></React.Fragment>); }

function PDFReport(props){ var company=props.company,employees=props.employees,programs=props.programs,profile=props.profile; var st1=useState(false); var rd=useMemo(function(){ var emps=employees.filter(function(e){return e.companyId===company.id&&e.status!=="resigned";}); var totalReceived=emps.reduce(function(s,e){return s+(e.rounds||[]).reduce(function(ss,r){return ss+(r.isPaid?r.received||0:0);},0);},0); var totalExpected=emps.reduce(function(s,e){return s+(e.totalExpected||0);},0); var upcoming=[]; emps.forEach(function(e){var p=programs[e.programId];if(!e.startDate||!p)return;(e.rounds||[]).forEach(function(r){if(r.isPaid)return;var ed=addMo(e.startDate,r.month);var dd=getDday(ed);if(dd!==null&&dd>=0&&dd<=90)upcoming.push({empName:e.name,roundLabel:r.label,eligDate:ed,dday:dd,amount:r.expectedAmount});});}); upcoming.sort(function(a,b){return a.dday-b.dday;}); return{empCount:emps.length,totalExpected:totalExpected,totalReceived:totalReceived,remaining:totalExpected-totalReceived,upcomingRounds:upcoming.slice(0,10),employees:emps}; },[company,employees,programs]);
  function generatePDF(){ var cl=company.corpType==="법인"?(company.juPosition==="앞"?"(주)"+company.name:company.name+"(주)"):company.name; var today=new Date(); var rd2=today.getFullYear()+"년 "+(today.getMonth()+1)+"월 "+today.getDate()+"일"; var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+cl+' 고용지원금 현황</title><style>body{font-family:-apple-system,sans-serif;padding:40px;max-width:800px;margin:0 auto;color:#1E293B}h1{font-size:24px;border-bottom:3px solid #2563EB;padding-bottom:10px;margin-bottom:20px}h2{font-size:16px;color:#2563EB;margin-top:30px;border-left:4px solid #2563EB;padding-left:10px}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:15px;margin-bottom:30px}.sc{background:#F8FAFC;border-radius:8px;padding:15px;text-align:center}.sc .l{font-size:12px;color:#64748B}.sc .v{font-size:24px;font-weight:700;color:#2563EB}table{width:100%;border-collapse:collapse}th,td{border:1px solid #E2E8F0;padding:8px 12px;text-align:left;font-size:13px}th{background:#F8FAFC}@media print{body{padding:20px}}</style></head><body>'; html+='<h1>📋 '+cl+' 고용지원금 현황</h1><p style="color:#64748B;font-size:13px">작성일: '+rd2+' | 작성자: '+(profile.display_name||"")+" "+(profile.title||"")+'</p>'; html+='<div class="summary"><div class="sc"><div class="l">대상자</div><div class="v">'+rd.empCount+'명</div></div><div class="sc"><div class="l">수령완료</div><div class="v">'+fMan(rd.totalReceived)+'</div></div><div class="sc"><div class="l">수령예정</div><div class="v">'+fMan(rd.remaining)+'</div></div></div>'; if(rd.upcomingRounds.length>0){html+='<h2>🔔 향후 90일 내 신청 예정</h2><table><tr><th>직원</th><th>회차</th><th>신청가능일</th><th>D-Day</th><th>예상금액</th></tr>';rd.upcomingRounds.forEach(function(r){html+='<tr><td>'+r.empName+'</td><td>'+r.roundLabel+'</td><td>'+fD(r.eligDate)+'</td><td>D-'+r.dday+'</td><td>'+fMan(r.amount)+'</td></tr>';});html+='</table>';} html+='<h2>👤 직원별 현황</h2><table><tr><th>이름</th><th>지원금</th><th>상태</th><th>입사일</th><th>수령액</th></tr>';rd.employees.forEach(function(e){var p2=programs[e.programId];var s2=STS.find(function(s){return s.key===e.status;});var rcv=(e.rounds||[]).reduce(function(s,r){return s+(r.isPaid?r.received||0:0);},0);html+='<tr><td>'+e.name+'</td><td>'+(p2?p2.name:"")+'</td><td>'+(s2?s2.label:"")+'</td><td>'+(e.startDate||"-")+'</td><td>'+fMan(rcv)+'</td></tr>';});html+='</table>'; html+='<div style="margin-top:40px;padding-top:20px;border-top:1px solid #E2E8F0;text-align:center;font-size:12px;color:#64748B">고용지원금 매니저 Pro에서 자동 생성 · 신청 전 최신 공고 확인 필요</div></body></html>'; var blob=new Blob([html],{type:"text/html;charset=utf-8"});var url=URL.createObjectURL(blob);var a=document.createElement("a");a.href=url;a.download=cl+"_고용지원금_"+today.toISOString().split("T")[0]+".html";a.click();URL.revokeObjectURL(url);st1[1](false); if(props.onLog)props.onLog(company.id,"내부 관리 보고서 출력","기타"); toast("내부 보고서가 생성되었습니다.","success"); }
  return(<React.Fragment><button style={Object.assign({},btnSm,{background:"#334155",color:"#fff",border:"none"})} onClick={function(){st1[1](true);}}>📄 내부 보고서</button><Modal open={st1[0]} onClose={function(){st1[1](false);}} title="📄 내부 관리 보고서" width={480}><div style={{textAlign:"center",padding:"20px 0"}}><div style={{fontSize:48,marginBottom:16}}>📄</div><h3 style={{margin:"0 0 8px",fontSize:18,fontWeight:700}}>{company.name}</h3><p style={{color:"#64748B",fontSize:13,marginBottom:24}}>대상자 {rd.empCount}명 | 수령완료 {fMan(rd.totalReceived)}</p><button style={Object.assign({},btnP,{padding:"14px 40px",fontSize:15})} onClick={generatePDF}>📥 HTML 보고서 다운로드</button><p style={{fontSize:11,color:"#94A3B8",marginTop:12}}>브라우저에서 열어 인쇄(Ctrl+P)하면 PDF로 저장됩니다</p><div style={{marginTop:10,padding:"8px 12px",background:"#D1FAE5",borderRadius:8,fontSize:12,color:"#065F46",textAlign:"left"}}>💡 <strong>영업 팁:</strong> 보고서를 고객사 담당자에게 정기 공유하면 재계약률·추가 의뢰 확률이 높아집니다!</div></div></Modal></React.Fragment>); }

function CommissionReport(props){
  var company=props.company,employees=props.employees,programs=props.programs,profile=props.profile;
  var st1=useState(false);
  var stRate=useState(String((company.commission&&company.commission.rate)!=null?company.commission.rate:10));
  var activeEmps=employees.filter(function(e){return e.companyId===company.id&&e.status!=="resigned";});
  var totalReceived=activeEmps.reduce(function(s,e){return s+(e.rounds||[]).reduce(function(ss,r){return ss+(r.isPaid?r.received||0:0);},0);},0);
  var fee=Math.round(totalReceived*(Number(stRate[0])||0)/100);
  function generateReport(){
    var cl=company.name; var today=new Date(); var rd2=today.getFullYear()+"년 "+(today.getMonth()+1)+"월 "+today.getDate()+"일";
    var rows=activeEmps.map(function(e){var p=programs[e.programId];var rcv=(e.rounds||[]).reduce(function(s,r){return s+(r.isPaid?r.received||0:0);},0);return{name:e.name,program:p?p.name:"",received:rcv,fee:Math.round(rcv*(Number(stRate[0])||0)/100)};}).filter(function(r){return r.received>0;});
    var totalFee=rows.reduce(function(s,r){return s+r.fee;},0);
    var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>수수료 정산서</title><style>body{font-family:-apple-system,sans-serif;padding:40px;max-width:700px;margin:0 auto;color:#1E293B}h1{font-size:22px;border-bottom:3px solid #059669;padding-bottom:10px;margin-bottom:16px}.summary{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:20px 0}.sc{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:16px;text-align:center}.sc .l{font-size:12px;color:#64748B}.sc .v{font-size:22px;font-weight:700;color:#2563EB}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #E2E8F0;padding:10px 12px;font-size:13px;text-align:left}th{background:#F8FAFC;font-weight:700}.num{text-align:right}tfoot td{font-weight:700;background:#F8FAFC}@media print{body{padding:20px}}</style></head><body>';
    html+='<h1>💰 수수료 정산서</h1><p style="color:#64748B;font-size:13px">업체: <strong>'+cl+'</strong> | 정산일: '+rd2+' | 작성자: '+(profile&&profile.display_name||"")+'</p><p style="font-size:14px">수수료율: <strong style="color:#059669">'+stRate[0]+'%</strong></p>';
    html+='<div class="summary"><div class="sc"><div class="l">수령완료 합계</div><div class="v">'+fMan(totalReceived)+'</div></div><div class="sc"><div class="l">수수료율</div><div class="v">'+stRate[0]+'%</div></div><div class="sc"><div class="l">정산 수수료</div><div class="v" style="color:#059669">'+fMan(totalFee)+'</div></div></div>';
    html+='<table><thead><tr><th>직원명</th><th>지원금</th><th class="num">수령액 합계</th><th class="num">수수료 ('+stRate[0]+'%)</th></tr></thead><tbody>';
    rows.forEach(function(r){html+='<tr><td>'+r.name+'</td><td>'+r.program+'</td><td class="num">'+fMan(r.received)+'</td><td class="num" style="color:#059669;font-weight:600">'+fMan(r.fee)+'</td></tr>';});
    html+='</tbody><tfoot><tr><td colspan="2">합계</td><td class="num">'+fMan(totalReceived)+'</td><td class="num" style="color:#059669">'+fMan(totalFee)+'</td></tr></tfoot></table>';
    html+='<div style="margin-top:32px;padding-top:16px;border-top:1px solid #E2E8F0;font-size:11px;color:#94A3B8;text-align:center">고용지원금 매니저 Pro 자동 생성 · 실제 수수료는 계약서에 따름</div></body></html>';
    var blob=new Blob([html],{type:"text/html;charset=utf-8"});var url=URL.createObjectURL(blob);var a=document.createElement("a");a.href=url;a.download=cl+"_수수료정산_"+today.toISOString().split("T")[0]+".html";a.click();URL.revokeObjectURL(url);st1[1](false);
    if(props.onLog)props.onLog(company.id,"수수료 정산서 출력","수수료청구");
    toast("수수료 정산서가 생성되었습니다.","success");
  }
  return(
    <React.Fragment>
      <button style={Object.assign({},btnSm,{background:"#fff",color:"#475569",border:"1px solid #E2E8F0"})} onClick={function(){st1[1](true);}}>💰 수수료 정산</button>
      <Modal open={st1[0]} onClose={function(){st1[1](false);}} title="💰 수수료 정산서" width={440}>
        <div>
          <div style={{marginBottom:16}}>
            <Label>수수료율 (%)</Label>
            <input type="number" style={inp} value={stRate[0]} onChange={function(e){stRate[1](e.target.value);}} min="0" max="100" step="0.5" placeholder="5"/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
            <Card style={{padding:"14px 16px",textAlign:"center"}}><div style={{fontSize:13,color:"#64748B",marginBottom:4}}>수령완료 합계</div><div style={{fontSize:22,fontWeight:700,color:"#2563EB"}}>{fMan(totalReceived)}</div></Card>
            <Card style={{padding:"14px 16px",textAlign:"center"}}><div style={{fontSize:13,color:"#64748B",marginBottom:4}}>예상 수수료</div><div style={{fontSize:22,fontWeight:700,color:"#059669"}}>{fMan(fee)}</div></Card>
          </div>
          <div style={{fontSize:15,fontWeight:700,marginBottom:8,color:"#1E293B"}}>직원별 내역</div>
          <div style={{maxHeight:200,overflow:"auto",marginBottom:16}}>
            {(function(){var hasPaid=activeEmps.filter(function(e){return(e.rounds||[]).some(function(r){return r.isPaid;});});if(hasPaid.length===0)return <p style={{color:"#94A3B8",textAlign:"center",fontSize:14,padding:"16px 0"}}>수령 완료된 직원이 없습니다.</p>;return hasPaid.map(function(e){var rcv=(e.rounds||[]).reduce(function(s,r){return s+(r.isPaid?r.received||0:0);},0);var f=Math.round(rcv*(Number(stRate[0])||0)/100);return(<div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 12px",borderRadius:7,background:"#F8FAFC",marginBottom:4,fontSize:14}}><span style={{fontWeight:500}}>{e.name}</span><div style={{textAlign:"right"}}><div style={{color:"#64748B",fontSize:12}}>{fMan(rcv)}</div><div style={{fontWeight:700,color:"#059669"}}>{fMan(f)}</div></div></div>);})})()}
          </div>
          <button style={Object.assign({},btnP,{width:"100%",padding:"12px",fontSize:15})} onClick={generateReport}>📥 수수료 정산서 다운로드</button>
          <p style={{fontSize:11,color:"#94A3B8",textAlign:"center",marginTop:8}}>브라우저에서 열어 인쇄하면 PDF로 저장됩니다</p>
        </div>
      </Modal>
    </React.Fragment>
  );
}

function AgencyReport(props){
  var company=props.company,employees=props.employees,programs=props.programs,profile=props.profile;
  var st1=useState(false);
  var stName=useState((profile&&profile.display_name)||"");
  var stTitle2=useState((profile&&profile.title)||"");
  var stFirm=useState("");
  var stPhone=useState("");
  var stEmail=useState("");

  var rd=useMemo(function(){
    var emps=employees.filter(function(e){return e.companyId===company.id&&e.status!=="resigned";});
    var totalRcv=emps.reduce(function(s,e){return s+(e.rounds||[]).reduce(function(ss,r){return ss+(r.isPaid?r.received||0:0);},0);},0);
    var totalExp=emps.reduce(function(s,e){return s+(e.totalExpected||0);},0);
    var pct=totalExp>0?Math.round(totalRcv/totalExp*100):0;
    var upcoming=[]; var overdue=[];
    emps.forEach(function(e){
      var p=programs[e.programId]; if(!e.startDate||!p)return;
      (e.rounds||[]).forEach(function(r){
        if(r.isPaid)return;
        var ed=addMo(e.startDate,r.month); var dd=getDday(ed);
        var amt=r.expectedAmount||r.amount||0;
        if(dd!==null&&dd<0)overdue.push({empName:e.name,prog:p.name,roundLabel:r.label,eligDate:ed,dday:dd,amount:amt});
        else if(dd!==null&&dd<=90)upcoming.push({empName:e.name,prog:p.name,roundLabel:r.label,eligDate:ed,dday:dd,amount:amt});
      });
    });
    upcoming.sort(function(a,b){return a.dday-b.dday;});
    overdue.sort(function(a,b){return a.dday-b.dday;});
    var sc={};
    STS.forEach(function(s){sc[s.key]=0;});
    emps.forEach(function(e){if(sc[e.status]!==undefined)sc[e.status]++;});
    return{emps:emps,totalRcv:totalRcv,totalExp:totalExp,pct:pct,upcoming:upcoming,overdue:overdue,sc:sc};
  },[company,employees,programs]);

  function genHTML(){
    var today=new Date();
    var dateStr=today.getFullYear()+"년 "+(today.getMonth()+1)+"월 "+today.getDate()+"일";
    var cl=company.name;
    var stcol={preparing:"#64748B",submitted:"#2563EB",reviewing:"#475569",approved:"#059669",inprogress:"#2563EB",completed:"#059669",resigned:"#94A3B8"};
    var stmap={}; STS.forEach(function(s){stmap[s.key]=s;});
    function fN(n){return(n||0).toLocaleString();}
    function fM2(n){var v=Math.abs(n||0);return v>=100000000?Math.round(n/100000000)+"억 원":v>=10000?Math.round(n/10000).toLocaleString()+"만 원":fN(n)+"원";}

    var statusBarHtml=STS.map(function(s){
      var cnt=rd.sc[s.key]||0; if(!cnt||!rd.emps.length)return"";
      var w=Math.round(cnt/rd.emps.length*100);
      return'<div style="width:'+w+'%;background:'+stcol[s.key]+';display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;overflow:hidden;min-width:0">'+(w>9?cnt+"명":"")+'</div>';
    }).join("");

    var legendHtml=STS.map(function(s){
      var cnt=rd.sc[s.key]||0; if(!cnt)return"";
      return'<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#475569"><div style="width:10px;height:10px;border-radius:3px;background:'+stcol[s.key]+';flex-shrink:0"></div>'+s.label+' '+cnt+'명</div>';
    }).join("");

    var upcomingHtml=rd.upcoming.slice(0,12).map(function(u){
      var ddStyle=u.dday<=7?'background:#FEE2E2;color:#DC2626;font-weight:800':u.dday<=30?'background:#EFF6FF;color:#2563EB;font-weight:700':'background:#DBEAFE;color:#2563EB;font-weight:600';
      var ddLabel=u.dday===0?"D-Day":"D-"+u.dday;
      return'<tr><td style="font-weight:600;color:#0F172A">'+u.empName+'</td><td style="color:#64748B">'+u.prog+'</td><td>'+u.roundLabel+'</td><td style="color:#475569">'+fD(u.eligDate)+'</td><td><span style="padding:3px 10px;border-radius:20px;font-size:12px;'+ddStyle+'">'+ddLabel+'</span></td><td style="text-align:right;font-weight:700;color:#2563EB">'+fN(u.amount)+'원</td></tr>';
    }).join("");

    var empHtml=rd.emps.map(function(e){
      var p=programs[e.programId]; var s=stmap[e.status]||STS[0];
      var rcv=(e.rounds||[]).reduce(function(ss,r){return ss+(r.isPaid?r.received||0:0);},0);
      var exp=e.totalExpected||0; var epct=exp>0?Math.round(rcv/exp*100):0;
      var sc2=stcol[e.status]||"#64748B";
      var paidRounds=(e.rounds||[]).filter(function(r){return r.isPaid;}).length;
      var totalRounds=(e.rounds||[]).length;
      return'<tr><td style="font-weight:700;color:#0F172A">'+e.name+'</td><td style="color:#64748B;font-size:12px">'+(p?p.name:"-")+'</td><td><span style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:'+sc2+'22;color:'+sc2+'">'+s.icon+" "+s.label+'</span></td><td style="color:#64748B;font-size:12px">'+(e.startDate?fD(e.startDate):"-")+'</td><td style="color:#059669;font-weight:700">'+fN(rcv)+'원</td><td style="color:#2563EB">'+fN(exp-rcv)+'원</td><td style="min-width:90px"><div style="font-size:10px;color:#94A3B8;margin-bottom:3px">'+epct+'% · '+paidRounds+'/'+totalRounds+'회차</div><div style="height:6px;background:#E2E8F0;border-radius:3px;overflow:hidden"><div style="height:100%;width:'+epct+'%;background:#2563EB;border-radius:3px"></div></div></td></tr>';
    }).join("");

    var overdueHtml=rd.overdue.slice(0,12).map(function(o){
      return'<tr><td style="font-weight:600;color:#0F172A">'+o.empName+'</td><td style="color:#64748B">'+o.prog+'</td><td>'+o.roundLabel+'</td><td style="color:#475569">'+fD(o.eligDate)+'</td><td><span style="padding:3px 10px;border-radius:20px;font-size:12px;background:#FEE2E2;color:#DC2626;font-weight:800">'+Math.abs(o.dday)+'일 경과</span></td><td style="text-align:right;font-weight:700;color:#DC2626">'+fN(o.amount)+'원</td></tr>';
    }).join("");
    // 동적 섹션 번호
    var secO=rd.overdue.length>0, secU=rd.upcoming.length>0;
    var nNum=1; var nSummary=nNum; var nOverdue=secO?(++nNum):0; var nUpcoming=secU?(++nNum):0; var nEmp=(++nNum);
    var narrative='현재 <strong>'+cl+'</strong>은(는) 총 <strong>'+rd.emps.length+'명</strong>의 근로자에 대해 고용지원금 검토 및 관리를 진행 중입니다. 현재까지 수령 완료된 금액은 <strong style="color:#059669">'+fM2(rd.totalRcv)+'</strong>이며, 향후 예상 수령액은 <strong style="color:#2563EB">'+fM2(rd.totalExp-rd.totalRcv)+'</strong>입니다. 향후 90일 이내 신청 또는 확인이 필요한 건은 총 <strong>'+rd.upcoming.length+'건</strong>'+(secO?', 그중 신청기한이 지나 즉시 점검이 필요한 건은 <strong style="color:#DC2626">'+rd.overdue.length+'건</strong>':'')+'입니다.';
    var CSS=[
      '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}',
      'body{font-family:-apple-system,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic","Segoe UI",sans-serif;color:#0F172A;background:#fff;line-height:1.6;-webkit-print-color-adjust:exact;print-color-adjust:exact;}',
      '.cover{min-height:100vh;background:linear-gradient(145deg,#0F172A 0%,#1E3A8A 45%,#2563EB 100%);color:#fff;padding:80px 70px;display:flex;flex-direction:column;position:relative;overflow:hidden;}',
      '.cover-glow1{position:absolute;top:-120px;right:-120px;width:560px;height:560px;background:radial-gradient(circle,rgba(59,130,246,0.35) 0%,transparent 70%);border-radius:50%;pointer-events:none;}',
      '.cover-glow2{position:absolute;bottom:-80px;left:-80px;width:400px;height:400px;background:radial-gradient(circle,rgba(16,185,129,0.18) 0%,transparent 70%);border-radius:50%;pointer-events:none;}',
      '.page{padding:64px 70px;}',
      '.page+.page{border-top:10px solid #F1F5F9;}',
      '.sh{display:flex;align-items:center;gap:12px;margin-bottom:32px;padding-bottom:16px;border-bottom:2px solid #E2E8F0;}',
      '.sn{width:32px;height:32px;background:#2563EB;color:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;flex-shrink:0;}',
      '.st{font-size:22px;font-weight:800;color:#0F172A;letter-spacing:-0.5px;}',
      '.kr{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px;}',
      '.kc{background:#F8FAFC;border-radius:14px;padding:22px 18px;border:1px solid #E2E8F0;}',
      '.kc .l{font-size:11px;color:#64748B;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;}',
      '.kc .v{font-size:26px;font-weight:900;letter-spacing:-1px;}',
      'table{width:100%;border-collapse:collapse;font-size:13px;}',
      'thead tr{background:#F8FAFC;border-bottom:2px solid #E2E8F0;}',
      'th{padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.04em;white-space:nowrap;}',
      'td{padding:12px 14px;border-bottom:1px solid #F1F5F9;vertical-align:middle;}',
      'tr:last-child td{border-bottom:none;}',
      '.notice{background:#F8FAFC;border-left:4px solid #CBD5E1;border-radius:0 8px 8px 0;padding:14px 18px;font-size:12px;color:#475569;margin-top:24px;line-height:1.7;}',
      '.rfooter{background:#0F172A;color:#475569;padding:28px 70px;display:flex;justify-content:space-between;align-items:center;font-size:12px;gap:24px;flex-wrap:wrap;}',
      '@page{margin:0;}',
      '@media print{.cover{page-break-after:always;}.page{page-break-before:always;}}'
    ].join("");

    var parts=[
      '<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>',cl,' 고용지원금 현황보고서</title><style>',CSS,'</style></head><body>',

      // ── COVER ──
      '<div class="cover">',
        '<div class="cover-glow1"></div><div class="cover-glow2"></div>',
        '<div style="position:relative;z-index:1;flex:1;display:flex;flex-direction:column">',
          '<div style="font-size:12px;font-weight:700;letter-spacing:0.14em;opacity:0.5;text-transform:uppercase;margin-bottom:14px">Employment Subsidy Management Report</div>',
          '<div style="font-size:46px;font-weight:900;line-height:1.1;letter-spacing:-2px;margin-bottom:44px">고용지원금<br>관리 현황보고서</div>',
          '<div style="background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.20);border-radius:20px;padding:36px 40px;margin-bottom:32px">',
            '<div style="font-size:32px;font-weight:900;margin-bottom:8px;letter-spacing:-0.5px">',cl,'</div>',
            '<div style="font-size:14px;opacity:0.55;margin-bottom:28px;line-height:1.8">',
              (company.bizNo?'사업자등록번호 '+company.bizNo+'&nbsp;&nbsp;':''),
              (company.ceoName?'대표 '+company.ceoName+'&nbsp;&nbsp;':''),
              (company.addr||''),
            '</div>',
            '<div style="display:grid;grid-template-columns:1fr 1px 1fr 1px 1fr;gap:0;align-items:center">',
              '<div style="padding-right:24px"><div style="font-size:10px;opacity:0.5;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px">지원 대상자</div><div style="font-size:40px;font-weight:900;letter-spacing:-2px">',rd.emps.length,'명</div></div>',
              '<div style="background:rgba(255,255,255,0.2);height:52px"></div>',
              '<div style="padding:0 24px"><div style="font-size:10px;opacity:0.5;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px">수령완료</div><div style="font-size:40px;font-weight:900;letter-spacing:-2px">',fM2(rd.totalRcv),'</div></div>',
              '<div style="background:rgba(255,255,255,0.2);height:52px"></div>',
              '<div style="padding-left:24px"><div style="font-size:10px;opacity:0.5;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px">예상 잔여</div><div style="font-size:40px;font-weight:900;letter-spacing:-2px">',fM2(rd.totalExp-rd.totalRcv),'</div></div>',
            '</div>',
          '</div>',
          '<div style="margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;padding-top:28px;border-top:1px solid rgba(255,255,255,0.15)">',
            '<div>',
              (stName[0]?'<div style="font-size:18px;font-weight:800;margin-bottom:4px">'+stName[0]+'</div>':""),
              ((stTitle2[0]||stFirm[0])?'<div style="font-size:13px;opacity:0.6;line-height:1.9">'+(stTitle2[0]||"")+(stTitle2[0]&&stFirm[0]?" &middot; ":"")+(stFirm[0]||"")+'</div>':""),
              (stPhone[0]?'<div style="font-size:13px;opacity:0.6">&#128222; '+stPhone[0]+'</div>':""),
              (stEmail[0]?'<div style="font-size:13px;opacity:0.6">&#9993; '+stEmail[0]+'</div>':""),
            '</div>',
            '<div style="font-size:13px;opacity:0.45">보고일: '+dateStr+'</div>',
          '</div>',
        '</div>',
      '</div>',

      // ── SEC 1: 요약 현황 ──
      '<div class="page">',
        '<div class="sh"><div class="sn">'+nSummary+'</div><div class="st">요약 현황</div></div>',
        '<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-left:4px solid #2563EB;border-radius:0 10px 10px 0;padding:18px 22px;margin-bottom:26px;font-size:14px;line-height:1.85;color:#334155">',narrative,'</div>',
        '<div class="kr">',
          '<div class="kc"><div class="l">지원 대상자</div><div class="v" style="color:#2563EB">',rd.emps.length,'명</div></div>',
          '<div class="kc"><div class="l">수령완료 (누적)</div><div class="v" style="color:#059669">',fM2(rd.totalRcv),'</div></div>',
          '<div class="kc"><div class="l">예상 잔여</div><div class="v" style="color:#2563EB">',fM2(rd.totalExp-rd.totalRcv),'</div></div>',
          '<div class="kc"><div class="l">지원금 수령률</div><div class="v" style="color:#059669">',rd.pct,'%</div></div>',
        '</div>',
        '<div style="display:flex;justify-content:space-between;font-size:13px;color:#64748B;margin-bottom:8px"><span>지원금 수령 진행률</span><span style="font-weight:700;color:#2563EB">'+fN(rd.totalRcv)+'원 / '+fN(rd.totalExp)+'원</span></div>',
        '<div style="height:14px;background:#E2E8F0;border-radius:7px;overflow:hidden;margin-bottom:36px"><div style="height:100%;width:'+rd.pct+'%;background:#2563EB;border-radius:7px;transition:width 0.5s"></div></div>',
        '<div style="font-size:14px;font-weight:700;color:#0F172A;margin-bottom:14px">진행 단계별 인원 현황</div>',
        '<div style="display:flex;border-radius:10px;overflow:hidden;height:40px;margin-bottom:14px">',statusBarHtml,'</div>',
        '<div style="display:flex;flex-wrap:wrap;gap:14px">',legendHtml,'</div>',
      '</div>',

      // ── SEC: 확인 필요(지연) 건 (conditional) ──
      secO?[
        '<div class="page">',
          '<div class="sh"><div class="sn">'+nOverdue+'</div><div class="st">⚠️ 즉시 확인이 필요한 건</div></div>',
          '<table><thead><tr><th>직원명</th><th>지원금</th><th>회차</th><th>신청가능일</th><th>경과</th><th style="text-align:right">예상 수령액</th></tr></thead><tbody>',overdueHtml,'</tbody></table>',
          '<div class="notice">위 항목은 신청가능일이 경과한 건입니다. 일부 지원금은 소급 신청이 제한될 수 있으므로, 담당 컨설턴트와 신청 가능 여부 및 보완서류를 우선 점검하시기 바랍니다.</div>',
        '</div>'
      ].join(""):""
      ,

      // ── SEC: 향후 일정 (conditional) ──
      secU?[
        '<div class="page">',
          '<div class="sh"><div class="sn">'+nUpcoming+'</div><div class="st">향후 90일 신청 일정</div></div>',
          '<table><thead><tr><th>직원명</th><th>지원금</th><th>회차</th><th>신청가능일</th><th>D-Day</th><th style="text-align:right">예상 수령액</th></tr></thead><tbody>',upcomingHtml,'</tbody></table>',
          '<div class="notice">⚠️ 위 일정은 입사일 기준으로 자동 산출된 예상 일정입니다. 실제 신청가능일은 심사 상황에 따라 달라질 수 있으니, 신청 전 고용24(work24.go.kr)에서 반드시 최신 공고를 확인하시기 바랍니다.</div>',
        '</div>'
      ].join(""):""
      ,

      // ── SEC: 직원별 상세 ──
      '<div class="page">',
        '<div class="sh"><div class="sn">'+nEmp+'</div><div class="st">직원별 상세 현황</div></div>',
        '<table><thead><tr><th>직원명</th><th>지원금</th><th>진행 상태</th><th>입사일</th><th>수령완료</th><th>잔여 예상</th><th style="min-width:100px">수령률</th></tr></thead><tbody>',empHtml,'</tbody></table>',
        '<div class="notice" style="margin-top:26px;background:#F8FAFC;border-left-color:#94A3B8;color:#475569">본 보고서는 고용지원금 관리 현황 공유를 위한 참고 자료이며, 실제 신청 가능 여부와 지급 여부는 담당기관의 심사 결과에 따라 달라질 수 있습니다. 지원금 요건·금액·신청기간은 매년 공고에 따라 변경될 수 있으므로, 신청 전 반드시 고용24(work24.go.kr) 등 담당기관의 최신 공고를 확인하시기 바랍니다.</div>',
      '</div>',

      // ── FOOTER ──
      '<div class="rfooter">',
        '<div style="line-height:1.9">',
          (stName[0]?'<div style="color:#94A3B8;font-weight:600">'+stName[0]+(stTitle2[0]?' &middot; '+stTitle2[0]:'')+'</div>':""),
          (stFirm[0]?'<div>'+stFirm[0]+'</div>':""),
          (stPhone[0]?'<div>'+stPhone[0]+'</div>':""),
          (stEmail[0]?'<div>'+stEmail[0]+'</div>':""),
        '</div>',
        '<div style="text-align:right;line-height:1.9;flex-shrink:0">',
          '<div style="color:#64748B">고용지원금 매니저 Pro &middot; '+dateStr+' 생성</div>',
          '<div>본 보고서는 관리 현황 안내용이며, 지원금 신청 전 최신 공고를 반드시 확인하시기 바랍니다.</div>',
        '</div>',
      '</div>',

      '</body></html>'
    ];
    return parts.flat().join("");
  }

  function download(){
    var html=genHTML();
    var blob=new Blob([html],{type:"text/html;charset=utf-8"});
    var url=URL.createObjectURL(blob);
    var a=document.createElement("a");
    a.href=url;
    a.download=company.name+"_고용지원금_현황보고서_"+new Date().toISOString().split("T")[0]+".html";
    a.click();
    URL.revokeObjectURL(url);
    st1[1](false);
    if(props.onLog)props.onLog(company.id,"고객 보고서 출력","기타");
    toast("고객 보고서가 생성되었습니다.","success");
  }

  return(
    <React.Fragment>
      <button style={Object.assign({},btnSm,{background:"#2563EB",color:"#fff",border:"none",fontWeight:700,letterSpacing:"-0.3px"})} onClick={function(){st1[1](true);}}>📊 고객 보고서</button>
      <Modal open={st1[0]} onClose={function(){st1[1](false);}} title="📊 전문가 고객 보고서" width={540}>
        <div style={{display:"grid",gap:16}}>
          {/* 미리보기 배너 */}
          <div style={{padding:"20px 24px",background:"linear-gradient(145deg,#0F172A,#1E3A8A,#2563EB)",borderRadius:16,color:"#fff"}}>
            <div style={{fontSize:12,opacity:0.5,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>고용지원금 관리 현황보고서</div>
            <div style={{fontSize:22,fontWeight:900,letterSpacing:"-0.5px",marginBottom:12}}>{company.name}</div>
            {rd.overdue.length>0&&<div style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(220,38,38,0.92)",borderRadius:20,padding:"4px 13px",fontSize:12,fontWeight:700,marginBottom:14}}>🚨 지연 {rd.overdue.length}건 · 보고서에 별도 강조</div>}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:0}}>
              {[["대상자",rd.emps.length+"명"],["수령완료",fMan(rd.totalRcv)],["예상잔여",fMan(rd.totalExp-rd.totalRcv)]].map(function(arr,i){return(
                <div key={i} style={{paddingRight:i<2?20:0,borderRight:i<2?"1px solid rgba(255,255,255,0.2)":0,paddingLeft:i>0?20:0}}>
                  <div style={{fontSize:10,opacity:0.5,fontWeight:700,letterSpacing:"0.08em",marginBottom:6}}>{arr[0].toUpperCase()}</div>
                  <div style={{fontSize:20,fontWeight:900,letterSpacing:"-0.5px"}}>{arr[1]}</div>
                </div>
              );})}
            </div>
          </div>
          {/* 구성 */}
          <div style={{padding:"12px 16px",background:"#F8FAFC",borderRadius:10,fontSize:13}}>
            <div style={{fontWeight:700,color:"#1E293B",marginBottom:8}}>📋 보고서 구성</div>
            <div style={{display:"grid",gap:4}}>
              {[["표지","업체명·수령 현황·담당자 정보"],["요약 현황","핵심 지표·요약 서술문·진행률"],rd.overdue.length?["확인 필요 건","신청기한 경과 항목 (붉게 강조)"]:null,rd.upcoming.length?["향후 90일 일정","D-Day 하이라이트"]:null,["직원별 상세","수령률 시각화 + 면책 안내"]].filter(Boolean).map(function(arr,i){return(<div key={i} style={{display:"flex",gap:10,color:"#475569"}}><span style={{color:"#2563EB",fontWeight:700,flexShrink:0}}>{("0"+(i+1)).slice(-2)}</span><span><strong style={{color:"#1E293B"}}>{arr[0]}</strong> — {arr[1]}</span></div>);})}
            </div>
          </div>
          {/* 담당자 정보 입력 */}
          <div>
            <div style={{fontSize:14,fontWeight:700,color:"#1E293B",marginBottom:10}}>🪪 담당자 정보 (표지에 표시됩니다)</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div><Label>담당자 이름</Label><input style={inp} value={stName[0]} onChange={function(e){stName[1](e.target.value);}} placeholder="홍길동"/></div>
              <div><Label>직함</Label><input style={inp} value={stTitle2[0]} onChange={function(e){stTitle2[1](e.target.value);}} placeholder="공인노무사"/></div>
              <div style={{gridColumn:"1/-1"}}><Label>사무소 · 업체명</Label><input style={inp} value={stFirm[0]} onChange={function(e){stFirm[1](e.target.value);}} placeholder="홍길동 노무사 사무소"/></div>
              <div><Label>연락처</Label><input style={inp} value={stPhone[0]} onChange={function(e){stPhone[1](e.target.value);}} placeholder="010-0000-0000"/></div>
              <div><Label>이메일</Label><input style={inp} value={stEmail[0]} onChange={function(e){stEmail[1](e.target.value);}} placeholder="hong@example.com"/></div>
            </div>
          </div>
          <button style={Object.assign({},btnP,{width:"100%",padding:"15px",fontSize:16,background:"linear-gradient(135deg,#1E40AF,#2563EB)",boxShadow:"0 4px 20px rgba(37,99,235,0.35)"})} onClick={download}>
            📥 고객 보고서 다운로드
          </button>
          <p style={{fontSize:11,color:"#94A3B8",textAlign:"center",margin:"0 0 4px"}}>브라우저에서 파일을 열고 인쇄(Ctrl+P) → PDF로 저장하면 완성됩니다</p>
        </div>
      </Modal>
    </React.Fragment>
  );
}

// ── Dashboard 보조 컴포넌트 ───────────────────────────────
function DdayAlerts(props){
  var ddayLimit=(props.settings&&props.settings.ddayAlert)||7;
  var alerts=useMemo(function(){
    var list=[];
    props.employees.forEach(function(emp){
      if(emp.status==="resigned")return;
      var company=props.companies.find(function(c){return c.id===emp.companyId;});
      var program=props.programs[emp.programId];
      if(!emp.startDate||!program)return;
      (emp.rounds||[]).forEach(function(r,ri){
        if(r.isPaid)return;
        var eligDate=addMo(emp.startDate,r.month);
        var dday=getDday(eligDate);
        if(dday!==null&&dday<=ddayLimit){list.push({id:emp.id+"-"+ri,empName:emp.name,companyName:company?company.name:"",companyId:emp.companyId,dday:dday,roundLabel:r.label||""});}
      });
    });
    return list.sort(function(a,b){return a.dday-b.dday;});
  },[props.employees,props.companies,props.programs,ddayLimit]);
  if(alerts.length===0)return null;
  var overdueCount=alerts.filter(function(a){return a.dday<0;}).length;
  return(
    <Card style={{marginBottom:18,overflow:"hidden",border:"1px solid #E2E8F0",borderLeft:"3px solid #DC2626"}}>
      <div style={{padding:"14px 18px",borderBottom:"1px solid #F1F5F9",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <span style={{fontSize:18}}>🔔</span>
        <span style={{fontSize:17,fontWeight:700,color:"#0F172A"}}>오늘 바로 해야 할 일</span>
        {overdueCount>0&&<span style={{...dangerBadge()}}>기한 초과 {overdueCount}건</span>}
        <span style={{...neutralBadge(),marginLeft:overdueCount>0?0:"auto"}}>총 {alerts.length}건</span>
      </div>
      <div style={{padding:"6px 12px",maxHeight:200,overflow:"auto"}}>
        {alerts.map(function(a){
          var isOverdue=a.dday<0;
          return(
            <div key={a.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 10px",marginBottom:2,borderRadius:8,cursor:"pointer",background:isOverdue?"#FFF5F5":"transparent"}}
              onClick={function(){props.goCompany(a.companyId);}}>
              <div>
                <span style={{fontSize:14,fontWeight:700,color:isOverdue?"#DC2626":"#0F172A"}}>{a.empName}</span>
                <span style={{fontSize:13,color:"#94A3B8",marginLeft:6}}>{a.companyName}</span>
                {a.roundLabel&&<span style={{fontSize:12,color:"#CBD5E1",marginLeft:4}}>· {a.roundLabel}</span>}
              </div>
              <DdayBadge dday={a.dday}/>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function GlobalSearch(props){ var st1=useState(""); var results=useMemo(function(){if(!st1[0].trim())return [];var q=st1[0].toLowerCase();return props.employees.filter(function(e){return e.name.toLowerCase().includes(q)||(e.phone||"").includes(q);}).slice(0,10);},[props.employees,st1[0]]); return(<div style={{marginBottom:14}}><div style={{position:"relative"}}><input style={Object.assign({},inpKo,{paddingLeft:32,fontSize:13})} value={st1[0]} onChange={function(e){st1[1](e.target.value);}} placeholder="직원 검색..."/><span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:12}}>🔍</span></div>{results.length>0&&(<Card style={{marginTop:6,maxHeight:200,overflow:"auto",position:"relative",zIndex:10}}>{results.map(function(emp){var company=props.companies.find(function(c){return c.id===emp.companyId;});var st=STS.find(function(s){return s.key===emp.status;})||STS[0];return(<div key={emp.id} style={{padding:"8px 12px",borderBottom:"1px solid #F1F5F9",cursor:"pointer",fontSize:12}} onClick={function(){props.goCompany(emp.companyId);st1[1]("");}}><div style={{display:"flex",alignItems:"center",gap:4}}><span style={{fontWeight:600}}>{emp.name}</span><Badge color={st.color} bg={st.bg}>{st.label}</Badge></div><div style={{fontSize:11,color:"#64748B"}}>{company?company.name:""}</div></div>);})}</Card>)}</div>); }

function MonthlyReport(props){ var st1=useState(new Date().getFullYear()); var data=useMemo(function(){var arr=[];for(var m=1;m<=12;m++){var rcv=0;props.employees.forEach(function(emp){(emp.rounds||[]).forEach(function(r){if(r.isPaid&&r.paidDate){var pd=new Date(r.paidDate);if(pd.getFullYear()===st1[0]&&pd.getMonth()+1===m){rcv+=r.received||0;}}});});arr.push({month:m,received:rcv});}return arr;},[props.employees,st1[0]]); var total=data.reduce(function(s,d){return s+d.received;},0); var maxR=Math.max.apply(null,data.map(function(d){return d.received;}))||1; return(<Card style={{padding:16,marginBottom:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><h4 style={{margin:0,fontSize:14,fontWeight:700}}>📈 월별 수령</h4><div style={{display:"flex",alignItems:"center",gap:6}}><button onClick={function(){st1[1](st1[0]-1);}} style={btnSm}>◀</button><span style={{fontWeight:600,fontSize:12}}>{st1[0]}</span><button onClick={function(){st1[1](st1[0]+1);}} style={btnSm}>▶</button></div></div><div style={{display:"flex",gap:3,height:80,alignItems:"flex-end",marginBottom:8}}>{data.map(function(d){var h=d.received>0?Math.max(12,(d.received/maxR)*60):3;return(<div key={d.month} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center"}}><div style={{fontSize:8,color:"#64748B",marginBottom:1}}>{d.received>0?fManS(d.received):""}</div><div style={{width:"100%",height:h,background:d.received>0?"#2563EB":"#E2E8F0",borderRadius:2}}/><div style={{fontSize:9,color:"#64748B",marginTop:2}}>{d.month}</div></div>);})}</div><div style={{textAlign:"center",fontSize:13}}><span style={{color:"#64748B"}}>연간: </span><span style={{fontWeight:700,color:"#2563EB"}}>{fMan(total)}</span></div></Card>); }

function CompanyRanking(props){ var ranking=useMemo(function(){return props.companies.map(function(c){var emps=props.employees.filter(function(e){return e.companyId===c.id;});var total=emps.reduce(function(s,e){return s+(e.rounds||[]).reduce(function(ss,r){return ss+(r.isPaid?r.received||0:0);},0);},0);return{id:c.id,name:c.name,total:total,empCount:emps.filter(function(e){return e.status!=="resigned";}).length};}).sort(function(a,b){return b.total-a.total;}).slice(0,5);},[props.companies,props.employees]); if(ranking.length===0)return null; return(<Card style={{padding:16,marginBottom:16}}><h4 style={{margin:"0 0 12px",fontSize:14,fontWeight:700}}>🏆 업체별 수령 순위</h4>{ranking.map(function(r,i){var medal=i===0?"🥇":i===1?"🥈":i===2?"🥉":(i+1)+""; return(<div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",marginBottom:4,borderRadius:6,background:"#FAFBFC",cursor:"pointer",fontSize:12}} onClick={function(){props.goCompany(r.id);}}><div style={{display:"flex",alignItems:"center",gap:8}}><span>{medal}</span><div><div style={{fontWeight:600}}>{r.name}</div><div style={{fontSize:10,color:"#64748B"}}>{r.empCount}명</div></div></div><div style={{fontWeight:700,color:"#059669"}}>{fMan(r.total)}</div></div>);})}</Card>); }

function PendingPaymentsList(props){ var employees=props.employees,programs=props.programs; var pendingList=useMemo(function(){var list=[];employees.forEach(function(emp){if(emp.status==="resigned"||emp.status==="completed")return;var program=programs[emp.programId];if(!program)return;var paidCount=0,totalRounds=(emp.rounds||[]).length,remainingAmount=0,nextEligDate=null;(emp.rounds||[]).forEach(function(r){if(r.isPaid){paidCount++;}else{remainingAmount+=r.expectedAmount||0;var ed=emp.startDate?addMo(emp.startDate,r.month):null;if(ed&&(!nextEligDate||new Date(ed)<new Date(nextEligDate))){nextEligDate=ed;}}});if(paidCount<totalRounds&&totalRounds>0){list.push({id:emp.id,name:emp.name,companyId:emp.companyId,paidCount:paidCount,totalRounds:totalRounds,remainingAmount:remainingAmount,nextDday:nextEligDate?getDday(nextEligDate):null});}});return list.sort(function(a,b){if(a.nextDday===null)return 1;if(b.nextDday===null)return-1;return a.nextDday-b.nextDday;});},[employees,programs]); var totalRemaining=pendingList.reduce(function(s,p){return s+p.remainingAmount;},0); return(<Card style={{padding:16,marginBottom:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><h4 style={{margin:0,fontSize:14,fontWeight:700}}>💳 미지급 대상자</h4><Badge color="#2563EB" bg="#EFF6FF">{pendingList.length}명/{fMan(totalRemaining)}</Badge></div>{pendingList.length===0?(<p style={{color:"#94A3B8",fontSize:12,textAlign:"center",padding:16}}>없음</p>):(<div style={{maxHeight:180,overflow:"auto"}}>{pendingList.map(function(p){return(<div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",marginBottom:4,borderRadius:6,background:"#FAFBFC",border:"1px solid #F1F5F9",cursor:"pointer",fontSize:12}} onClick={function(){props.goCompany(p.companyId);}}><div><span style={{fontWeight:600}}>{p.name}</span><span style={{color:"#64748B",marginLeft:6}}>{p.paidCount}/{p.totalRounds}회차</span></div><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontWeight:700,color:"#2563EB"}}>{fMan(p.remainingAmount)}</span>{p.nextDday!==null&&<DdayBadge dday={p.nextDday}/>}</div></div>);})}</div>)}</Card>); }

function CalendarView(props){ var employees=props.employees,companies=props.companies,programs=props.programs; var calendarMemos=props.calendarMemos||{}; var onSaveMemo=props.onSaveMemo; var st1=useState(new Date()); var st2=useState(null); var st3=useState(""); var year=st1[0].getFullYear(),month=st1[0].getMonth(); var events=useMemo(function(){var list=[];employees.forEach(function(emp){if(emp.status==="resigned")return;var company=companies.find(function(c){return c.id===emp.companyId;});var program=programs[emp.programId];if(!emp.startDate||!program)return;(emp.rounds||[]).forEach(function(r){if(r.isPaid)return;var ed=addMo(emp.startDate,r.month);var d=new Date(ed);if(d.getFullYear()===year&&d.getMonth()===month){list.push({day:d.getDate(),empName:emp.name,companyId:emp.companyId,color:program.color});}});});return list;},[employees,companies,programs,year,month]); var firstDay=new Date(year,month,1).getDay(); var daysInMonth=new Date(year,month+1,0).getDate(); var weeks=[]; var day=1; for(var w=0;w<6;w++){var week=[];for(var d2=0;d2<7;d2++){if(w===0&&d2<firstDay){week.push(null);}else if(day>daysInMonth){week.push(null);}else{week.push(day);day++;}}weeks.push(week);if(day>daysInMonth)break;} var today=new Date(); function isToday(d){return d&&today.getFullYear()===year&&today.getMonth()===month&&today.getDate()===d;} function getMemoKey(d){return year+"-"+(month+1)+"-"+d;} function addMemoFn(){if(!st3[0].trim()||!st2[0])return;var key=getMemoKey(st2[0]);var existing=calendarMemos[key]||[];onSaveMemo(key,existing.concat([{id:uid(),text:st3[0].trim(),at:new Date().toISOString()}]));st3[1]("");} function delMemo(memoId){var key=getMemoKey(st2[0]);onSaveMemo(key,(calendarMemos[key]||[]).filter(function(m){return m.id!==memoId;}));}
  return(<Card style={{padding:20,marginBottom:20}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h4 style={{margin:0,fontSize:16,fontWeight:700}}>📅 신청 일정</h4><div style={{display:"flex",alignItems:"center",gap:8}}><button onClick={function(){st1[1](new Date(year,month-1,1));st2[1](null);}} style={btnSm}>◀</button><span style={{fontWeight:700,minWidth:100,textAlign:"center"}}>{year}년 {month+1}월</span><button onClick={function(){st1[1](new Date(year,month+1,1));st2[1](null);}} style={btnSm}>▶</button></div></div><div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:8}}>{["일","월","화","수","목","금","토"].map(function(dd,i){return <div key={i} style={{textAlign:"center",fontSize:12,fontWeight:600,color:i===0?"#DC2626":i===6?"#2563EB":"#64748B",padding:4}}>{dd}</div>;})}</div><div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>{weeks.map(function(week,wi){return week.map(function(dd,di){var dayEvents=dd?events.filter(function(e){return e.day===dd;}):[]; var dayKey=dd?getMemoKey(dd):null; var dayMemos=dayKey&&calendarMemos[dayKey]?calendarMemos[dayKey]:[]; var isSelected=st2[0]===dd; return(<div key={wi+"-"+di} onClick={dd?function(){st2[1](isSelected?null:dd);}:undefined} style={{minHeight:54,padding:3,background:dd?(isSelected?"#DBEAFE":"#FAFBFC"):"transparent",borderRadius:4,border:isSelected?"2px solid #2563EB":(isToday(dd)?"2px solid #059669":"1px solid #F1F5F9"),cursor:dd?"pointer":"default"}}>{dd&&(<React.Fragment><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:1}}><span style={{fontSize:11,fontWeight:isToday(dd)?700:500,color:di===0?"#DC2626":di===6?"#2563EB":"#334155"}}>{dd}</span>{dayMemos.length>0&&<span style={{fontSize:7}}>📝</span>}</div>{dayEvents.slice(0,2).map(function(e,i2){return <div key={i2} style={{fontSize:8,padding:"1px 3px",marginBottom:1,borderRadius:3,background:e.color+"20",color:e.color,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} onClick={function(ev){ev.stopPropagation();props.goCompany(e.companyId);}}>{e.empName}</div>;})} {dayEvents.length>2&&<div style={{fontSize:8,color:"#64748B"}}>+{dayEvents.length-2}</div>}</React.Fragment>)}</div>);}).flat()})}</div>{st2[0]&&(<div style={{marginTop:12,padding:12,background:"#F8FAFC",borderRadius:8,border:"1px solid #E2E8F0"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><span style={{fontSize:13,fontWeight:700}}>{month+1}월 {st2[0]}일</span><button onClick={function(){st2[1](null);}} style={{background:"none",border:"none",fontSize:14,cursor:"pointer",color:"#94A3B8"}}>×</button></div><div style={{display:"flex",gap:4,marginBottom:8}}><input style={Object.assign({},inpKo,{flex:1,fontSize:12,padding:"6px 10px"})} value={st3[0]} onChange={function(e){st3[1](e.target.value);}} placeholder="메모..." onKeyDown={function(e){if(e.key==="Enter")addMemoFn();}}/><button style={Object.assign({},btnP,{padding:"6px 12px",fontSize:11})} onClick={addMemoFn}>추가</button></div>{(calendarMemos[getMemoKey(st2[0])]||[]).map(function(memo){return(<div key={memo.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 8px",background:"#fff",borderRadius:4,marginBottom:3,border:"1px solid #E2E8F0",fontSize:11}}><span>{memo.text}</span><button onClick={function(){delMemo(memo.id);}} style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer",fontSize:10}}>×</button></div>);})}</div>)}</Card>); }

// ── 지원금별 파이프라인 (퍼널) ────────────────────────────
function ProgramPipeline(props){
  var employees=props.employees,programs=props.programs;
  var rows=useMemo(function(){
    var map={};
    employees.forEach(function(e){
      if(e.status==="resigned")return;
      var p=programs[e.programId]; if(!p)return;
      if(!map[e.programId])map[e.programId]={program:p,count:0,sc:{},received:0,expected:0};
      var m=map[e.programId]; m.count++;
      var s=STS.find(function(x){return x.key===e.status;})?e.status:"preparing";
      m.sc[s]=(m.sc[s]||0)+1;
      m.expected+=p.totalAmount||0;
      m.received+=(e.rounds||[]).reduce(function(ss,r){return ss+(r.isPaid?r.received||0:0);},0);
    });
    return Object.values(map).sort(function(a,b){return b.count-a.count;});
  },[employees,programs]);
  if(rows.length===0)return null;
  return(
    <Card style={{padding:20,marginTop:12,border:"1px solid #E2E8F0"}}>
      <h4 style={{margin:"0 0 16px",fontSize:19,fontWeight:700,color:"#0F172A"}}>지원금별 파이프라인</h4>
      {rows.map(function(r){
        var pct=r.expected>0?Math.round(r.received/r.expected*100):0;
        return(
          <div key={r.program.id} style={{marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,flexWrap:"wrap",gap:6}}>
              <div style={{display:"flex",alignItems:"center",gap:7,minWidth:0}}>
                <span style={{fontSize:16,fontWeight:700,color:"#334155"}}>{r.program.name}</span>
                <span style={{fontSize:14,color:"#94A3B8"}}>{r.count}명</span>
              </div>
              <div style={{fontSize:14,color:"#64748B"}}>
                <span style={{fontWeight:700,color:"#059669"}}>{fMan(r.received)}</span>
                <span style={{color:"#CBD5E1"}}> / {fMan(r.expected)}</span>
                <span style={{marginLeft:6,fontWeight:700,color:"#0F172A"}}>{pct}%</span>
              </div>
            </div>
            {/* 수령 진행률 — 수령(green) / 잔여(gray) */}
            <div style={{height:10,borderRadius:5,overflow:"hidden",background:"#F1F5F9"}}>
              <div style={{height:"100%",width:pct+"%",background:"#059669",borderRadius:5,transition:"width 0.5s ease"}}/>
            </div>
          </div>
        );
      })}
      <div style={{display:"flex",gap:14,flexWrap:"wrap",marginTop:14,paddingTop:12,borderTop:"1px solid #F1F5F9"}}>
        <div style={{display:"flex",alignItems:"center",gap:5,fontSize:13,color:"#64748B"}}><span style={{width:10,height:10,borderRadius:3,background:"#059669",display:"inline-block"}}/>수령 완료</div>
        <div style={{display:"flex",alignItems:"center",gap:5,fontSize:13,color:"#64748B"}}><span style={{width:10,height:10,borderRadius:3,background:"#E2E8F0",display:"inline-block"}}/>수령 예정</div>
      </div>
    </Card>
  );
}

// ── Dashboard: Empty State ────────────────────────────────
function EmptyState(props){
  return(<Card className="fade-in-up" style={{padding:"56px 32px",textAlign:"center",border:"2px dashed #E2E8F0",background:"linear-gradient(180deg,#FFFFFF,#F8FAFC)"}}>
    <div style={{fontSize:64,marginBottom:16}}>{props.icon||"📋"}</div>
    <h3 style={{margin:"0 0 8px",fontSize:24,fontWeight:800,color:"#1E293B"}}>{props.title}</h3>
    <p style={{margin:"0 auto 24px",fontSize:18,color:"#64748B",maxWidth:440,lineHeight:1.6}}>{props.desc}</p>
    {props.action&&<button className="hover-lift" style={Object.assign({},btnP,{padding:"15px 36px"})} onClick={props.action}>{props.actionLabel}</button>}
  </Card>);
}

// ── Dashboard ─────────────────────────────────────────────
// ── 화면 크기 감지 (모바일 ≤860px) ──────────────────────────
function useIsMobile(){
  var st=useState(function(){return typeof window!=="undefined"&&!!window.matchMedia&&window.matchMedia("(max-width:860px)").matches;});
  useEffect(function(){
    if(typeof window==="undefined"||!window.matchMedia)return;
    var mq=window.matchMedia("(max-width:860px)");
    function on(){st[1](mq.matches);}
    try{mq.addEventListener("change",on);}catch(e){mq.addListener(on);}
    return function(){try{mq.removeEventListener("change",on);}catch(e){mq.removeListener(on);}};
  },[]);
  return st[0];
}

// ── 대시보드 섹션 (데스크톱: 항상 펼침 / 모바일: 접기·펴기) ──
// bare=true 이면 헤더+자식만(자식이 자체 카드를 그릴 때), false 이면 흰 카드로 감쌈.
function DashSection(props){
  var isMobile=useIsMobile();
  var st=useState(props.openMobile!==false);
  var collapsible=isMobile;
  var open=collapsible?st[0]:true;
  var bare=props.bare;
  var header=(
    <button onClick={collapsible?function(){st[1](!st[0]);}:undefined}
      style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:bare?"2px 2px 12px":"15px 18px",background:"none",border:"none",cursor:collapsible?"pointer":"default",fontFamily:FF,textAlign:"left"}}>
      <span style={{display:"flex",alignItems:"center",gap:8,fontSize:bare?18:16,fontWeight:700,color:"#0F172A"}}>
        {props.icon&&<span style={{fontSize:bare?18:16}}>{props.icon}</span>}{props.title}
        {props.hint&&<span className="hide-mobile" style={{fontSize:13,color:"#94A3B8",fontWeight:500}}>{props.hint}</span>}
      </span>
      {collapsible&&<span style={{fontSize:15,color:"#94A3B8",transition:"transform .2s ease",transform:open?"rotate(180deg)":"none",display:"inline-block",lineHeight:1}}>⌄</span>}
    </button>
  );
  if(bare){
    return(<div style={{marginBottom:14}}>{header}{open&&<div className="dash-sec-body">{props.children}</div>}</div>);
  }
  return(
    <div className="card" style={{marginBottom:14,overflow:"hidden"}}>
      {header}
      {open&&<div className="dash-sec-body" style={{padding:"0 18px 18px"}}>{props.children}</div>}
    </div>
  );
}

function Dashboard(props){
  var st1=useState("all"),st2=useState(false); var selectedCompanyId=st1[0];
  // 보기 밀도 (컴팩트/기본/넓게) — localStorage 유지, 기본값 "normal"
  var stDensity=useState(function(){try{return localStorage.getItem("dash_density")||"normal";}catch(e){return "normal";}});
  function setDensity(v){stDensity[1](v);try{localStorage.setItem("dash_density",v);}catch(e){}}
  var DENS={compact:{zoom:0.9},normal:{zoom:1},wide:{zoom:1.1}};
  var densZoom=(DENS[stDensity[0]]||DENS.normal).zoom;
  var fE=useMemo(function(){return st1[0]==="all"?props.employees:props.employees.filter(function(e){return e.companyId===st1[0];});},[props.employees,st1[0]]);
  var stats=useMemo(function(){var tE=0,tR=0,dT=0,dD=0,sc={};STS.forEach(function(s){sc[s.key]=0;});fE.forEach(function(e){if(sc[e.status]!==undefined)sc[e.status]++;var p=props.programs[e.programId];if(p)tE+=p.totalAmount||0;(e.rounds||[]).forEach(function(r){if(r.isPaid)tR+=r.received||0;});(e.employeeDocs||[]).forEach(function(d){dT++;if(d.done)dD++;});});(st1[0]==="all"?props.companies:props.companies.filter(function(c){return c.id===st1[0];})).forEach(function(c){(c.companyDocs||[]).forEach(function(d){dT++;if(d.done)dD++;});});return{tE:tE,tR:tR,pct:dT>0?Math.round(dD/dT*100):0,sc:sc};},[props.companies,fE,props.programs,st1[0]]);
  // 추세/요약 메트릭 + 업무 브리핑(지연·임박·서류·위험금액)
  var metrics=useMemo(function(){
    var now=new Date(); var curY=now.getFullYear(), curM=now.getMonth();
    var spark=[]; var monthsKeys=[];
    for(var k=5;k>=0;k--){var d=new Date(curY,curM-k,1);monthsKeys.push({y:d.getFullYear(),m:d.getMonth()});spark.push(0);}
    var thisMonthExpected=0, overdueAmount=0, overdueCount=0, next7=0, next7Count=0, next30=0, next30Count=0;
    var overdueList=[], next7List=[];
    function cName(cid){var c=props.companies.find(function(x){return x.id===cid;});return c?c.name:"";}
    fE.forEach(function(e){
      var p=props.programs[e.programId];
      (e.rounds||[]).forEach(function(r){
        if(r.isPaid){ if(r.paidDate){var pd=new Date(r.paidDate);monthsKeys.forEach(function(mk,idx){if(pd.getFullYear()===mk.y&&pd.getMonth()===mk.m)spark[idx]+=r.received||0;});} return; }
        if(!e.startDate)return; var amt=r.expectedAmount||r.amount||0; var ed=addMo(e.startDate,r.month); var edd=new Date(ed); var dd=getDday(ed);
        if(edd.getFullYear()===curY&&edd.getMonth()===curM)thisMonthExpected+=amt;
        if(dd!==null&&dd<0){overdueAmount+=amt;overdueCount++;overdueList.push({empName:e.name,companyId:e.companyId,companyName:cName(e.companyId),programName:p?p.name:"",roundLabel:r.label,dd:dd,amount:amt});}
        else if(dd!==null&&dd<=7){next7+=amt;next7Count++;next7List.push({empName:e.name,companyId:e.companyId,companyName:cName(e.companyId),programName:p?p.name:"",roundLabel:r.label,dd:dd,amount:amt});}
        if(dd!==null&&dd>=0&&dd<=30){next30+=amt;next30Count++;}
      });
    });
    overdueList.sort(function(a,b){return a.dd-b.dd;});
    next7List.sort(function(a,b){return a.dd-b.dd;});
    var docMissingCount=0; var docCompSet={};
    fE.forEach(function(e){(e.employeeDocs||[]).forEach(function(d){if(!d.done){docMissingCount++;docCompSet[e.companyId]=1;}});});
    var compScope=st1[0]==="all"?props.companies:props.companies.filter(function(c){return c.id===st1[0];});
    compScope.forEach(function(c){(c.companyDocs||[]).forEach(function(d){if(!d.done){docMissingCount++;docCompSet[c.id]=1;}});});
    var lastIdx=spark.length-1; var thisR=spark[lastIdx]||0; var lastR=spark[lastIdx-1]||0;
    var trend=lastR>0?Math.round((thisR-lastR)/lastR*100):(thisR>0?100:null);
    return{spark:spark,thisMonthExpected:thisMonthExpected,overdueAmount:overdueAmount,overdueCount:overdueCount,next7:next7,next7Count:next7Count,next7List:next7List,next30:next30,next30Count:next30Count,trend:trend,thisMonthReceived:thisR,overdueList:overdueList,docMissingCount:docMissingCount,docMissingCompanies:Object.keys(docCompSet).length,riskAmount:overdueAmount+next7};
  },[fE,props.companies,props.programs,st1[0]]);

  // 수수료 요약 (업체별 commission 집계)
  var commSummary=useMemo(function(){
    var thisMonthFee=0,unbilled=0,unpaid=0,collected=0;
    var now=new Date(),cy=now.getFullYear(),cm=now.getMonth();
    (st1[0]==="all"?props.companies:props.companies.filter(function(c){return c.id===st1[0];})).forEach(function(c){
      var cc=c.commission||{}; var rate=cc.rate!=null?cc.rate:10; var ret=cc.retainer||0; var useS=cc.successFee!==false;
      var emps=props.employees.filter(function(e){return e.companyId===c.id&&e.status!=="resigned";});
      var rcv=0,monthExp=0;
      emps.forEach(function(e){(e.rounds||[]).forEach(function(r){
        if(r.isPaid){rcv+=r.received||0;return;}
        if(!e.startDate)return; var ed=new Date(addMo(e.startDate,r.month));
        if(ed.getFullYear()===cy&&ed.getMonth()===cm)monthExp+=r.expectedAmount||r.amount||0;
      });});
      var billable=Math.round(ret+(useS?rcv*rate/100:0));
      thisMonthFee+=Math.round(monthExp*rate/100);
      if(cc.paid)collected+=billable; else if(cc.billed)unpaid+=billable; else if(billable>0)unbilled+=billable;
    });
    return{thisMonthFee:thisMonthFee,unbilled:unbilled,unpaid:unpaid,collected:collected};
  },[props.companies,props.employees,st1[0]]);
  var activeCount=fE.filter(function(e){return e.status!=="resigned";}).length;
  var cards=[
    {l:"관리 업체",v:st1[0]==="all"?props.companies.length:1,u:"개",i:"🏢",c:"#0F172A",extra:"progress",prog:null},
    {l:"지원 대상자",v:activeCount,u:"명",i:"👤",c:"#0F172A"},
    {l:"서류 완료율",v:stats.pct,u:"%",i:"📋",c:"#0F172A",bar:"#2563EB",extra:"bar"},
    {l:"누적 수령액",v:fManS(stats.tR),u:"원",i:"✅",c:"#059669",extra:"spark"},
    {l:"수령 예정액",v:fManS(stats.tE),u:"원",i:"💰",c:"#1D4ED8"}
  ];
  var starredCompanies=props.companies.filter(function(c){return(c.tags||[]).includes("star");});
  function handleExcelCopy(){var data=makeExcelData(props.companies,props.employees,props.programs);navigator.clipboard.writeText(data).then(function(){st2[1](true);setTimeout(function(){st2[1](false);},2000);toast("엑셀용 데이터가 복사되었습니다.","success");});}

  return(<div className="fade-in" style={{zoom:densZoom}}>
    {/* 보기 밀도 조절 — 컴팩트 / 기본 / 넓게 */}
    {props.mode!=="list"&&(
      <div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:8,marginBottom:10}}>
        <span style={{fontSize:13,color:"#64748B",fontWeight:600}}>보기</span>
        <div style={{display:"inline-flex",background:"#F1F5F9",borderRadius:10,padding:3,gap:2}}>
          {[["compact","컴팩트"],["normal","기본"],["wide","넓게"]].map(function(o){var on=stDensity[0]===o[0];return(
            <button key={o[0]} onClick={function(){setDensity(o[0]);}} style={{border:"none",borderRadius:8,padding:"6px 14px",fontSize:13,fontWeight:on?700:600,color:on?"#1D4ED8":"#64748B",background:on?"#fff":"transparent",cursor:"pointer",fontFamily:FF,boxShadow:on?"0 1px 4px rgba(0,0,0,0.08)":"none"}}>{o[1]}</button>
          );})}
        </div>
      </div>
    )}
    {props.mode!=="stats"&&<GlobalSearch employees={props.employees} companies={props.companies} goCompany={props.goCompany}/>}

    {/* ── 핵심 KPI 브리핑 (4-Card Executive View) ── */}
    {props.mode!=="list"&&props.companies.length>0&&(function(){
      var now=new Date();
      var dstr=now.getFullYear()+"."+(now.getMonth()+1)+"."+now.getDate();
      var hasOverdue=metrics.overdueCount>0;
      // 순서: 신청가능 → 지연 → 서류미완료 → 수령액 (대표가 5초 안에 파악하는 순서)
      var brief=[
        {icon:"💰",label:"이번 달 신청 가능",val:fMan(metrics.thisMonthExpected),sub:"30일 내 "+metrics.next30Count+"건 · "+fMan(metrics.next30),bg:"#1D4ED8",btn:"일정 확인",btnKind:"ghost",on:function(){props.setView&&props.setView("kanban");}},
        {icon:"🚨",label:"지연 신청",val:metrics.overdueCount+"건",sub:hasOverdue?fMan(metrics.overdueAmount)+" 기한 초과":"기한 내 모두 정상 ✓",bg:"#DC2626",badge:hasOverdue?"지연":null,btn:hasOverdue?"지금 처리":null,btnKind:"cta",on:function(){if(metrics.overdueList[0])props.goCompany(metrics.overdueList[0].companyId);}},
        {icon:"📁",label:"서류 미완료",val:metrics.docMissingCount+"건",sub:metrics.docMissingCount>0?metrics.docMissingCompanies+"개 업체 보완 필요":"모든 서류 완료 ✓",bg:"#334155",btn:metrics.docMissingCount>0?"서류 확인":null,btnKind:"ghost",on:function(){if(props.setView)props.setView("company");}},
        {icon:"✅",label:"이번 달 수령",val:fManS(metrics.thisMonthReceived),unit:"원",sub:metrics.trend!=null?(metrics.trend>=0?"▲":"▼")+" "+Math.abs(metrics.trend)+"% 전월 대비":"전월 비교 없음",bg:"#059669",spark:true}
      ];
      return(
        <div style={{marginBottom:22}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
            <div style={{display:"flex",alignItems:"baseline",gap:10}}>
              <span style={{fontSize:24,fontWeight:800,color:"#0F172A",letterSpacing:"-0.5px"}}>이번 달 업무 현황</span>
              <span style={{fontSize:13,color:"#94A3B8",fontWeight:500}}>{dstr} 기준</span>
            </div>
          </div>
          <div className="brief-grid">
            {brief.map(function(b,i){
              var btnCta={marginTop:16,alignSelf:"flex-start",background:"#fff",color:b.bg,border:"none",borderRadius:8,padding:"9px 18px",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:FF};
              var btnGhost={marginTop:16,alignSelf:"flex-start",background:"rgba(255,255,255,0.15)",color:"#fff",border:"1px solid rgba(255,255,255,0.35)",borderRadius:8,padding:"8px 16px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:FF};
              return(
              <div key={i} className="hover-card brief-card" style={{background:b.bg,border:"none",borderRadius:16,padding:"24px 26px",display:"flex",flexDirection:"column",minHeight:168,boxShadow:"0 4px 16px rgba(15,23,42,0.14)"}}>
                <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:14}}>
                  <span className="brief-icon" style={{fontSize:18,flexShrink:0,width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.18)",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{b.icon}</span>
                  <span className="brief-label" style={{fontSize:14,fontWeight:600,color:"rgba(255,255,255,0.88)",flex:1}}>{b.label}</span>
                  {b.badge&&<span style={{fontSize:11,fontWeight:700,color:"#fff",background:"rgba(255,255,255,0.22)",padding:"3px 10px",borderRadius:999}}>{b.badge}</span>}
                </div>
                <div className="brief-num" style={{fontSize:50,fontWeight:800,color:"#fff",letterSpacing:"-1px",lineHeight:1.04}}>
                  {b.val}{b.unit&&<span className="brief-num-unit" style={{fontSize:22,opacity:0.80,marginLeft:4}}>{b.unit}</span>}
                </div>
                <div className="brief-sub" style={{fontSize:14,color:"rgba(255,255,255,0.78)",marginTop:8,fontWeight:500,flex:1,lineHeight:1.4}}>{b.sub}</div>
                {b.spark&&<div className="brief-spark" style={{marginTop:10}}><Sparkline data={metrics.spark} width={120} height={22} color="rgba(255,255,255,0.75)"/></div>}
                {b.btn&&<button onClick={b.on} className="brief-btn" style={b.btnKind==="cta"?btnCta:btnGhost}>{b.btn} →</button>}
              </div>
            );})}
          </div>
        </div>
      );
    })()}

    {/* ── 지연 신청 강력 경고 배너 (stats) ── */}
    {props.mode!=="list"&&metrics.overdueCount>0&&(
      <div style={{marginBottom:18,borderRadius:12,overflow:"hidden",background:"#fff",border:"1px solid #E2E8F0",borderLeft:"3px solid #DC2626"}}>
        <div style={{padding:"13px 18px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",borderBottom:"1px solid #F1F5F9"}}>
          <span style={{fontSize:16}}>🚨</span>
          <span style={{fontSize:16,fontWeight:700,color:"#0F172A"}}>즉시 확인 필요 — 신청 기한이 지난 건이 {metrics.overdueCount}건 있습니다</span>
          <span style={{...dangerBadge(),marginLeft:"auto"}}>예상 {fMan(metrics.overdueAmount)} 위험</span>
        </div>
        <div style={{padding:"4px 8px"}}>
          {metrics.overdueList.slice(0,4).map(function(o,i){return(
            <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 12px",borderRadius:8,borderBottom:i<Math.min(3,metrics.overdueList.length-1)?"1px solid #F8FAFC":"none"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontSize:15,fontWeight:700,color:"#0F172A"}}>{o.empName}</span>
                  <span style={{fontSize:13,color:"#94A3B8"}}>{o.companyName}</span>
                </div>
                <div style={{fontSize:13,color:"#64748B",marginTop:2}}>{o.programName} {o.roundLabel} · 신청 기한 <strong style={{color:"#DC2626"}}>{Math.abs(o.dd)}일 지연</strong></div>
              </div>
              <span style={{fontSize:15,fontWeight:700,color:"#0F172A",flexShrink:0}}>{fMan(o.amount)}</span>
              <button onClick={function(){props.goCompany(o.companyId);}} style={{flexShrink:0,background:"#DC2626",color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:FF}}>처리하기 →</button>
            </div>
          );})}
          {metrics.overdueList.length>4&&<div style={{textAlign:"center",padding:"8px 0",fontSize:13,color:"#94A3B8"}}>외 {metrics.overdueList.length-4}건 더 — 진행 보드에서 전체 확인</div>}
        </div>
      </div>
    )}

    {/* ── 무료체험 가치 지표 (stats, 체험 중) ── */}
    {props.mode!=="list"&&props.isTrial&&props.companies.length>0&&(function(){
      var emps=props.employees; var active=emps.filter(function(e){return e.status!=="resigned";});
      var sched=0; emps.forEach(function(e){(e.rounds||[]).forEach(function(r){if(!r.isPaid&&e.startDate)sched++;});});
      var items=[["관리 중인 예상 지원금",fMan(stats.tE)],["등록한 업체",props.companies.length+"개"],["등록한 대상자",active.length+"명"],["생성된 신청 일정",sched+"건"],["확인한 지연 건",metrics.overdueCount+"건"]];
      return(
        <div style={{marginBottom:18,borderRadius:12,overflow:"hidden",background:"#fff",border:"1px solid #E2E8F0",borderLeft:"3px solid #2563EB"}}>
          <div style={{padding:"15px 20px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",borderBottom:"1px solid #F1F5F9"}}>
            <span style={{...primaryBadge()}}>무료체험{props.trialDaysLeft!=null?" "+props.trialDaysLeft+"일 남음":""}</span>
            <span style={{fontSize:15,fontWeight:700,color:"#0F172A"}}>무료체험 동안 이만큼 관리하고 계세요</span>
            <button onClick={props.onOpenBilling||function(){}} style={{marginLeft:"auto",background:"#2563EB",color:"#fff",border:"none",borderRadius:8,padding:"8px 18px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:FF}}>지금 구독하기 →</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))"}}>
            {items.map(function(it,i){return(
              <div key={i} style={{padding:"14px 18px",borderRight:i<items.length-1?"1px solid #F1F5F9":"none"}}>
                <div style={{fontSize:12,color:"#94A3B8",fontWeight:600,marginBottom:5}}>{it[0]}</div>
                <div style={{fontSize:20,fontWeight:800,color:"#0F172A",letterSpacing:"-0.5px"}}>{it[1]}</div>
              </div>
            );})}
          </div>
          <div style={{padding:"11px 20px",fontSize:13,color:"#94A3B8",background:"#F8FAFC",borderTop:"1px solid #F1F5F9"}}>지금 구독하면 등록한 업체와 신청 일정을 계속 관리할 수 있습니다. 무료체험 종료 후에는 알림·보고서·수수료 정산 기능이 제한됩니다.</div>
        </div>
      );
    })()}

    {props.mode!=="list"&&<DdayAlerts employees={props.employees} companies={props.companies} programs={props.programs} goCompany={props.goCompany} settings={props.settings}/>}

    {props.mode!=="stats"&&starredCompanies.length>0&&(<Card style={{padding:"14px 18px",marginBottom:16}}><div style={{fontSize:18,fontWeight:700,marginBottom:8}}>⭐ 즐겨찾기</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{starredCompanies.map(function(c){return <button key={c.id} className="hover-lift" onClick={function(){props.goCompany(c.id);}} style={Object.assign({},btnSm,{background:"#fff",color:"#475569",border:"1px solid #E2E8F0",fontSize:17})}>{c.name}</button>;})}</div></Card>)}

    {props.mode!=="list"&&props.companies.length>0&&<div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}><select style={Object.assign({},inp,{width:"auto",minWidth:180,fontSize:19,fontWeight:600})} value={st1[0]} onChange={function(e){st1[1](e.target.value);}}><option value="all">📊 전체 업체</option>{props.companies.map(function(c){return <option key={c.id} value={c.id}>🏢 {c.name}</option>;})}</select><button onClick={handleExcelCopy} className="hover-lift" style={Object.assign({},btnSm,{background:"#fff",color:"#475569",border:"1px solid #E2E8F0"})}>📋 엑셀용 데이터 복사</button>{st2[0]&&<span style={{fontSize:17,color:"#059669"}}>✅ 복사됨</span>}</div>}

    {/* KPI 보조 지표 */}
    {props.mode!=="list"&&props.companies.length>0&&(
      <div style={{marginBottom:22}}>
        <div style={{fontSize:14,fontWeight:600,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.6px",marginBottom:10}}>보조 지표</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12}}>
          {cards.map(function(c,i){return(
          <Card key={i} className="kpi-card" style={{padding:"16px 18px",border:"1px solid #F1F5F9"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontSize:13,color:"#64748B",fontWeight:600}}>{c.l}</span>
              <span style={{fontSize:16,width:30,height:30,borderRadius:8,background:"#F8FAFC",display:"flex",alignItems:"center",justifyContent:"center"}}>{c.i}</span>
            </div>
            <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
              <div><span style={{fontSize:28,fontWeight:800,color:c.c}}>{c.v}</span><span style={{fontSize:14,color:"#94A3B8",marginLeft:3}}>{c.u}</span></div>
              {c.extra==="spark"&&<Sparkline data={metrics.spark} width={60} height={22} color="#059669"/>}
            </div>
            {c.extra==="bar"&&<div style={{height:5,background:"#F1F5F9",borderRadius:3,overflow:"hidden",marginTop:10}}><div style={{height:"100%",width:c.v+"%",background:c.bar||"#2563EB",borderRadius:3,transition:"width 0.5s ease"}}/></div>}
          </Card>);})}
        </div>
      </div>
    )}

    {/* 수수료 요약 (stats, 프로 플랜) — 모바일 기본 접힘 */}
    {props.mode!=="list"&&props.companies.length>0&&props.tier&&props.tier.feat.commission&&(
      <DashSection icon="🧾" title="수수료 현황" openMobile={false}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
          {[
            {l:"이번 달 예상 수수료",v:fMan(commSummary.thisMonthFee),c:"#1D4ED8",accent:null},
            {l:"미청구 수수료",v:fMan(commSummary.unbilled),c:commSummary.unbilled>0?"#0F172A":"#94A3B8",accent:null},
            {l:"미입금 수수료",v:fMan(commSummary.unpaid),c:commSummary.unpaid>0?"#DC2626":"#94A3B8",accent:commSummary.unpaid>0?"#DC2626":null},
            {l:"누적 수수료",v:fMan(commSummary.collected),c:"#059669",accent:null}
          ].map(function(c,i){return(
            <div key={i} className="kpi-card" style={{background:"#F8FAFC",borderRadius:14,padding:"15px 16px",border:"1px solid #E5EAF0",borderLeft:c.accent?("3px solid "+c.accent):"1px solid #E5EAF0"}}>
              <div style={{fontSize:13.5,color:"#64748B",fontWeight:600,marginBottom:6}}>{c.l}</div>
              <div style={{fontSize:22,fontWeight:800,color:c.c}}>{c.v}</div>
            </div>
          );})}
        </div>
      </DashSection>
    )}

    {/* 업체별 위험도 랭킹 (stats, 전체 보기) */}
    {props.mode!=="list"&&st1[0]==="all"&&props.companies.length>=2&&(function(){
      var rows=props.companies.map(function(c){
        var emps=props.employees.filter(function(e){return e.companyId===c.id&&e.status!=="resigned";});
        var overdue=0,next7=0,remaining=0,docMiss=0,nextDday=null;
        emps.forEach(function(e){
          (e.rounds||[]).forEach(function(r){
            if(r.isPaid)return; remaining+=r.expectedAmount||r.amount||0;
            if(e.startDate){var dd=getDday(addMo(e.startDate,r.month));if(dd!==null){if(dd<0)overdue++;else if(dd<=7)next7++;if(dd>=0&&(nextDday===null||dd<nextDday))nextDday=dd;}}
          });
          (e.employeeDocs||[]).forEach(function(d){if(!d.done)docMiss++;});
        });
        (c.companyDocs||[]).forEach(function(d){if(!d.done)docMiss++;});
        var level=emps.length===0?{t:"대기",c:"#94A3B8",bg:"#F1F5F9"}:overdue>0?{t:"지연",c:"#DC2626",bg:"#FEF2F2"}:next7>0?{t:"임박",c:"#2563EB",bg:"#EFF6FF"}:docMiss>0?{t:"서류 미비",c:"#475569",bg:"#E2E8F0"}:remaining>=10000000?{t:"고액 관리",c:"#2563EB",bg:"#DBEAFE"}:remaining>0?{t:"정상",c:"#059669",bg:"#ECFDF5"}:{t:"완료",c:"#059669",bg:"#ECFDF5"};
        return{c:c,empCount:emps.length,overdue:overdue,next7:next7,remaining:remaining,docMiss:docMiss,nextDday:nextDday,level:level,score:overdue*1e6+next7*1e4+docMiss*100+remaining/1e6};
      }).sort(function(a,b){return b.score-a.score;}).slice(0,6);
      return(
        <Card style={{padding:"20px 22px",marginBottom:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <h4 style={{margin:0,fontSize:20,fontWeight:700}}>🛡️ 업체별 위험도</h4>
            <span style={{fontSize:13,color:"#94A3B8"}}>지연·임박·서류·수령예정액 종합</span>
          </div>
          <div style={{display:"grid",gap:8}}>
            {rows.map(function(r){return(
              <div key={r.c.id} className="hover-card" onClick={function(){props.goCompany(r.c.id);}} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:12,border:"1px solid #E2E8F0",borderLeft:r.overdue>0?"3px solid #DC2626":"1px solid #E2E8F0",background:"#fff",cursor:"pointer",flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:140}}>
                  <div style={{fontSize:17,fontWeight:700,color:"#1E293B"}}>{r.c.name}</div>
                  <div style={{fontSize:13,color:"#94A3B8",marginTop:2}}>대상자 {r.empCount}명{r.nextDday!==null?" · 다음 신청 "+formatDday(r.nextDday):""}</div>
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                  {r.overdue>0&&<span style={dangerBadge()}>지연 {r.overdue}</span>}
                  {r.next7>0&&<span style={primaryBadge()}>임박 {r.next7}</span>}
                  {r.docMiss>0&&<span style={neutralBadge()}>서류 {r.docMiss}</span>}
                </div>
                <div style={{textAlign:"right",minWidth:96}}>
                  <div style={{fontSize:16,fontWeight:800,color:"#0F172A"}}>{fMan(r.remaining)}</div>
                  <div style={{fontSize:12,color:"#94A3B8"}}>수령 예정</div>
                </div>
                <span style={{fontSize:13,fontWeight:700,padding:"4px 12px",borderRadius:20,background:r.level.bg,color:r.level.c,flexShrink:0}}>{r.level.t}</span>
              </div>
            );})}
          </div>
        </Card>
      );
    })()}

    {/* 업체 목록 (list 모드) */}
    {props.mode!=="stats"&&(props.companies.length===0?(
      <EmptyState icon="🏢" title="아직 등록된 업체가 없습니다" desc="첫 번째 거래처를 등록하고 직원·지원금·서류를 한 곳에서 관리해보세요. 등록 즉시 D-Day 알림과 수령 현황이 자동 집계됩니다." actionLabel="+ 첫 업체 등록하기" action={props.onAddCompany}/>
    ):(<div style={{marginBottom:16}}>{props.companies.map(function(c){var emps=props.employees.filter(function(e){return e.companyId===c.id&&e.status!=="resigned";});var rcv=props.employees.filter(function(e){return e.companyId===c.id;}).reduce(function(s,e){return s+(e.rounds||[]).reduce(function(ss,r){return ss+(r.isPaid?r.received||0:0);},0);},0);var upcomingCount=0;emps.forEach(function(e){var p=props.programs[e.programId];if(!e.startDate||!p)return;(e.rounds||[]).forEach(function(r){if(r.isPaid)return;var d=getDday(addMo(e.startDate,r.month));if(d!==null&&d<=7)upcomingCount++;});});return(<Card key={c.id} className="hover-card" onClick={function(){props.goCompany(c.id);}} style={{padding:"18px 22px",marginBottom:10,cursor:"pointer",border:"1.5px solid #F1F5F9"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div style={{flex:1,minWidth:0}}><div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:6}}><span style={{fontSize:22,fontWeight:700,color:"#1E293B"}}>{c.name}</span>{(c.tags||[]).map(function(tid){var tag=TAGS.find(function(t){return t.id===tid;});if(!tag)return null;return <Badge key={tid} color={tag.color} bg={tag.bg}>{tag.label}</Badge>;})}{upcomingCount>0&&<Badge color="#DC2626" bg="#FEE2E2">🔔 {upcomingCount}건 임박</Badge>}</div><div style={{fontSize:18,color:"#64748B"}}>{c.bizNo&&c.bizNo+" · "}{c.ceoName&&c.ceoName+" · "}{emps.length}명 관리 중</div></div><div style={{textAlign:"right",flexShrink:0,marginLeft:10}}><div style={{fontSize:21,fontWeight:700,color:"#059669"}}>{fMan(rcv)}</div><div style={{fontSize:15,color:"#94A3B8"}}>수령완료</div></div></div></Card>);})}</div>))}

    {props.mode!=="stats"&&selectedCompanyId!=="all"&&(<div><PendingPaymentsList employees={props.employees} programs={props.programs} goCompany={props.goCompany} selectedCompanyId={selectedCompanyId}/></div>)}

    {props.mode!=="list"&&props.companies.length===0&&(
      <EmptyState icon="📊" title="대시보드가 곧 채워집니다" desc="업체와 직원을 등록하면 이곳에 이번 달 신청 가능 지원금, 월별 수령 추이, 신청 일정 캘린더가 자동으로 표시됩니다." actionLabel="+ 첫 업체 등록하기" action={props.onAddCompany}/>
    )}

    {props.mode!=="list"&&props.companies.length>0&&(
      <DashSection bare icon="📅" title="월별 수령 · 캘린더" openMobile={false}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}} className="grid-2-mobile"><div><MonthlyReport employees={props.employees}/><CompanyRanking companies={props.companies} employees={props.employees} goCompany={props.goCompany}/></div><div><CalendarView employees={props.employees} companies={props.companies} programs={props.programs} goCompany={props.goCompany} calendarMemos={props.calendarMemos} onSaveMemo={props.onSaveMemo}/></div></div>
      </DashSection>
    )}

    {props.mode!=="list"&&props.companies.length>0&&(
      <DashSection icon="📋" title="상태별 현황" openMobile={false}>
        {STS.map(function(s){var cnt=stats.sc[s.key]||0;var total=fE.length||1;var done=s.key==="completed"||s.key==="approved";var barCol=done?"#059669":s.key==="resigned"?"#CBD5E1":"#94A3B8";return(<div key={s.key} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:16,color:"#475569"}}><span style={{display:"inline-block",width:8,height:8,borderRadius:4,background:barCol,marginRight:7}}/>{s.label}</span><span style={{fontSize:16,fontWeight:700,color:"#0F172A"}}>{cnt}명</span></div><div style={{height:6,background:"#F1F5F9",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:(cnt/total*100)+"%",background:barCol,borderRadius:3,transition:"width 0.5s ease"}}/></div></div>);})}
      </DashSection>
    )}

    {props.mode!=="list"&&props.companies.length>0&&(
      <DashSection bare icon="📊" title="지원금별 파이프라인" openMobile={false}>
        <ProgramPipeline employees={fE} programs={props.programs}/>
      </DashSection>
    )}
  </div>); }

// ── EmpCard ───────────────────────────────────────────────
function EmpCard(props){
  var emp=props.emp,programs=props.programs,company=props.company;
  var uploadFn=props.uploadFn,getUrlFn=props.getUrlFn;
  var st1=useState(false); // expanded
  var stSM=useState(false); // status menu open
  var p=programs[emp.programId];
  var gp=p?GROUP_COLORS[p.group]||GROUP_COLORS["커스텀"]:GROUP_COLORS["커스텀"];
  var st=STS.find(function(s){return s.key===emp.status;})||STS[0];
  var paidRounds=(emp.rounds||[]).filter(function(r){return r.isPaid;}).length;
  var totalRounds=(emp.rounds||[]).length;
  var totalPaid=(emp.rounds||[]).reduce(function(s,r){return s+(r.isPaid?r.received||0:0);},0);
  var nextRound=null;
  (emp.rounds||[]).some(function(r){if(!r.isPaid){var ed=emp.startDate?addMo(emp.startDate,r.month):null;if(ed){var dd=getDday(ed);nextRound={round:r,dday:dd,eligDate:ed};return true;}}return false;});
  var ageD=calcAgeDetailed(emp.birthDate,emp.startDate);
  var certDocs=(emp.certDocs||[]);
  var certDone=certDocs.filter(function(d){return d.done;}).length;
  return(
    <Card style={{marginBottom:8,overflow:"hidden",border:"1px solid #E2E8F0",position:"relative"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",cursor:"pointer"}} onClick={function(){st1[1](!st1[0]);stSM[1](false);}}>
        <div style={{width:34,height:34,borderRadius:17,background:"#F1F5F9",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#475569",flexShrink:0,fontWeight:700}}>
          {emp.name.charAt(0)}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap",marginBottom:2}}>
            <span style={{fontSize:14,fontWeight:700,color:"#1E293B"}}>{emp.name}</span>
            {/* 클릭 가능한 상태 배지 */}
            <span onClick={function(e){e.stopPropagation();stSM[1](!stSM[0]);}}
              style={{fontSize:12,fontWeight:600,padding:"3px 10px",borderRadius:999,background:st.bg,color:st.color,whiteSpace:"nowrap",cursor:"pointer",border:"1px solid "+st.color+"33",userSelect:"none"}} title="클릭해서 상태 변경">
              {st.label} ▾
            </span>
            {p&&<span style={{...neutralBadge()}}>{p.name}</span>}
          </div>
          <div style={{fontSize:11,color:"#64748B",display:"flex",gap:8,flexWrap:"wrap"}}>
            {emp.startDate&&<span>입사 {fD(emp.startDate)}</span>}
            {emp.status==="resigned"&&emp.resignDate&&<span style={{color:"#94A3B8"}}>🚪 퇴사 {fD(emp.resignDate)}</span>}
            {ageD&&<span>만{ageD.years}세</span>}
            {paidRounds>0&&<span style={{color:"#059669"}}>✅{paidRounds}/{totalRounds}회차</span>}
            {totalPaid>0&&<span style={{color:"#059669"}}>{fMan(totalPaid)}</span>}
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
          {nextRound&&<DdayBadge dday={nextRound.dday}/>}
          <div style={{display:"flex",gap:4}}>
            <button style={Object.assign({},btnSm,{fontSize:10,padding:"3px 7px"})} onClick={function(e){e.stopPropagation();props.onEdit(emp);}}>편집</button>
            <button style={Object.assign({},btnSm,{fontSize:10,padding:"3px 7px",color:"#DC2626",border:"1px solid #FECACA"})} onClick={function(e){e.stopPropagation();if(window.confirm("'"+emp.name+"' 직원을 삭제하시겠습니까?\n삭제된 직원은 기본 목록에서 숨겨지며, 회차와 서류 관리 내역도 함께 보이지 않습니다."))props.onDelete(emp.id);}}>삭제</button>
          </div>
        </div>
      </div>
      {/* 빠른 상태 변경 드롭다운 */}
      {stSM[0]&&(
        <div onClick={function(e){e.stopPropagation();}} style={{position:"absolute",left:14,top:50,zIndex:50,background:"#fff",borderRadius:12,boxShadow:"0 8px 24px rgba(15,23,42,0.18)",border:"1px solid #E2E8F0",padding:6,width:190}}>
          <div style={{fontSize:11,color:"#94A3B8",padding:"3px 8px 5px"}}>진행 상태 변경</div>
          {STS.map(function(s){var on=emp.status===s.key;return(
            <div key={s.key} onClick={function(){props.onPatch(emp.id,{status:s.key});stSM[1](false);}}
              style={{display:"flex",alignItems:"center",gap:7,padding:"7px 9px",borderRadius:8,cursor:"pointer",fontSize:13,background:on?s.bg:"transparent",color:on?s.color:"#334155",fontWeight:on?700:400}}>
              <span>{s.icon}</span><span>{s.label}</span>{on&&<span style={{marginLeft:"auto",fontSize:12}}>✓</span>}
            </div>
          );})}
        </div>
      )}
      {st1[0]&&(
        <div style={{padding:"0 14px 14px"}}>
          {/* 회차 진행상황 */}
          {p&&(emp.rounds||[]).length>0&&(
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:600,marginBottom:6,color:"#475569"}}>📅 회차 현황</div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {(emp.rounds||[]).map(function(r,ri){
                  var ed=emp.startDate?addMo(emp.startDate,r.month):null;
                  var dd=ed?getDday(ed):null;
                  return(
                    <button key={ri} onClick={function(){props.onRoundClick(emp,ri);}}
                      style={{padding:"6px 10px",borderRadius:8,fontSize:11,cursor:"pointer",border:"1.5px solid "+(r.isPaid?"#6EE7B7":dd!==null&&dd<=7?"#FECACA":"#E2E8F0"),background:r.isPaid?"#D1FAE5":dd!==null&&dd<=7?"#FEF2F2":"#F8FAFC",color:r.isPaid?"#059669":dd!==null&&dd<=7?"#DC2626":"#475569",fontWeight:r.isPaid?700:500}}>
                      <div>{r.label}</div>
                      {ed&&<div style={{fontSize:9,opacity:0.7}}>{fD(ed)}</div>}
                      {r.isPaid?<div style={{fontSize:9,color:"#059669"}}>{fMan(r.received||0)}</div>:dd!==null?<div style={{fontSize:9}}>D-{dd}</div>:null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {/* 인증서류 */}
          {certDocs.length>0&&(
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:600,marginBottom:6,color:"#475569"}}>📋 인증서류 ({certDone}/{certDocs.length})</div>
              <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                {certDocs.map(function(d,di){return(
                  <div key={di} style={{padding:"3px 8px",borderRadius:4,fontSize:10,background:d.done?"#D1FAE5":"#F1F5F9",color:d.done?"#059669":"#64748B",border:"1px solid "+(d.done?"#6EE7B7":"#E2E8F0"),cursor:"pointer"}} onClick={function(){props.onCertToggle(emp,di);}}>
                    {d.done?"✅":"○"} {d.label}
                  </div>
                );})}
              </div>
            </div>
          )}
          {/* 직원 서류 */}
          <DocSection title="직원 서류" docs={emp.employeeDocs||[]} disabled={false}
            progName={p?p.name:""} quickDocs={EMP_QUICK_DOCS}
            uploadFn={uploadFn} getUrlFn={getUrlFn}
            onChange={function(ds){props.onPatch(emp.id,{employeeDocs:ds});}}
            onLog={function(txt,type){if(props.onLog&&company)props.onLog(company.id,emp.name+" "+txt,type);}}
          />
          {/* 급여/연락처 */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:8}}>
            <div><Label>연락처</Label><input style={inp} defaultValue={emp.phone||""} placeholder="010-" onBlur={function(e){props.onPatch(emp.id,{phone:e.target.value});}}/></div>
            <div><Label>이메일</Label><input style={inp} defaultValue={emp.email||""} placeholder="email" onBlur={function(e){props.onPatch(emp.id,{email:e.target.value});}}/></div>
            <div><Label>급여(원)</Label><input type="number" style={inp} min="0" defaultValue={emp.salary||""} placeholder="2200000" onBlur={function(e){props.onPatch(emp.id,{salary:clampMoney(e.target.value)});}}/></div>
          </div>
          {emp.salary&&emp.weeklyHours&&(function(){var wc=checkWage(emp.salary,emp.weeklyHours);return wc&&!wc.isAboveMin&&(<div style={{marginTop:6,padding:"6px 10px",borderRadius:6,background:"#FEE2E2",fontSize:11,color:"#DC2626"}}>⚠️ 최저임금 미달 — 최소 {wc.minMonthly.toLocaleString()}원 필요</div>);})()||null}
          {/* 메모 */}
          <div style={{marginTop:8}}>
            <Label>메모</Label>
            <textarea style={Object.assign({},inp,{height:60,resize:"none",fontSize:12})} defaultValue={emp.memo||""} placeholder="메모..." onBlur={function(e){props.onPatch(emp.id,{memo:e.target.value});}}/>
          </div>
        </div>
      )}
    </Card>
  );
}

// ── EmpModal (add/edit employee) ──────────────────────────
function EmpModal(props){
  var programs=props.programs,company=props.company;
  var init=props.emp||{};
  var CUR_YEAR=new Date().getFullYear();
  function defYear(pid){ return (programs[pid]||{}).year||CUR_YEAR; }
  var st={
    name:useState(init.name||""),
    programId:useState(init.programId||(programs["youth_jump"]&&programs["youth_jump"].enabled!==false?"youth_jump":Object.keys(programs).find(function(k){return programs[k].enabled!==false;})||Object.keys(programs)[0]||"")),
    programYear:useState(init.programYear||""),
    startDate:useState(init.startDate||""),
    birthDate:useState(init.birthDate||"2000-01-01"),
    gender:useState(init.gender||"male"),
    milSvc:useState(init.milSvc||0),
    status:useState(init.status||"preparing"),
    phone:useState(init.phone||""),
    email:useState(init.email||""),
    salary:useState(init.salary||""),
    weeklyHours:useState(init.weeklyHours||40),
    memo:useState(init.memo||""),
    bd:useState(init.birthDate||"2000-01-01"),
    gen:useState(init.gender||"male"),
    mil:useState(init.milSvc||0),
    ec:useState(init.eligConds||{}),
    xc:useState(init.exclConds||{}),
    hd:useState(init.startDate||""),
    replaceReason:useState(init.replaceReason||""),
    replaceHireDate:useState(init.replaceHireDate||""),
    replaceTargetName:useState(init.replaceTargetName||""),
    replaceStartDate:useState(init.replaceStartDate||""),
    replaceEndDate:useState(init.replaceEndDate||""),
    resignDate:useState(init.resignDate||"")
  };
  function save(){
    if(!st.name[0].trim()){toast("이름을 입력하세요","warn");return;}
    if(!st.programId[0]){toast("지원금을 선택하세요","warn");return;}
    if(!isValidEmail(st.email[0])){toast("이메일 형식을 확인하세요","warn");return;}
    var p=programs[st.programId[0]];
    var selYear=Number(st.programYear[0])||defYear(st.programId[0]);
    var info=getProgramInfo(company,st.programId[0],selYear);
    var quota=info?Number(info.quota||0):0;
    if(quota>0){
      var curCnt=(props.employees||[]).filter(function(e){
        return e.programId===st.programId[0]&&e.status!=="resigned"&&e.id!==init.id&&
               (Number(e.programYear)||defYear(e.programId))===selYear;
      }).length;
      if(curCnt+1>quota&&!window.confirm("지원한도를 초과할 수 있습니다. 운영기관 확인 후 저장하시겠습니까?"))return;
    }
    var rounds=init.rounds||(p?JSON.parse(JSON.stringify(p.rounds||[])).map(function(r){return Object.assign({},r,{isPaid:false,received:0});}):[]);
    var certDocs=init.certDocs||(p?(CERT_TYPES[st.programId[0]]||[]).map(function(ct){return{id:uid(),label:ct,done:false,files:[]};}):[]);
    var empDocs=init.employeeDocs||(p?(p.employeeDocs||[]).map(function(d){return{id:uid(),label:typeof d==="string"?d:d.label||"",done:false,files:[]};}):[]);
    props.onSave({
      id:init.id||ruuid(),
      companyId:company.id,
      name:st.name[0].trim(),
      programId:st.programId[0],
      programYear:selYear,
      startDate:st.startDate[0],
      birthDate:st.bd[0]||st.birthDate[0],
      gender:st.gen[0]||st.gender[0],
      milSvc:st.mil[0]||st.milSvc[0],
      status:st.status[0],
      phone:st.phone[0],
      email:st.email[0],
      salary:clampMoney(st.salary[0]),
      weeklyHours:Number(st.weeklyHours[0])||40,
      memo:st.memo[0],
      eligConds:st.ec[0],
      exclConds:st.xc[0],
      resignDate:st.status[0]==="resigned"?st.resignDate[0]:"",
      replaceReason:st.replaceReason[0],
      replaceHireDate:st.replaceHireDate[0],
      replaceTargetName:st.replaceTargetName[0],
      replaceStartDate:st.replaceStartDate[0],
      replaceEndDate:st.replaceEndDate[0],
      totalExpected:p?p.totalAmount||0:0,
      rounds:rounds,
      certDocs:certDocs,
      employeeDocs:empDocs
    });
  }
  var selectedP=programs[st.programId[0]];
  return(
    <Modal open={props.open} onClose={props.onClose} title={(init.id?"직원 편집":"직원 추가")+" — "+company.name} width={600}>
      <div style={{display:"grid",gap:14}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><Label>이름 *</Label><input style={inp} value={st.name[0]} onChange={function(e){st.name[1](e.target.value);}} placeholder="홍길동"/></div>
          <div><Label>재직 상태</Label>
            <select style={inp} value={st.status[0]} onChange={function(e){st.status[1](e.target.value);}}>
              {STS.map(function(s){return <option key={s.key} value={s.key}>{s.label}</option>;})}
            </select>
          </div>
        </div>
        {st.status[0]==="resigned"&&(
          <div style={{padding:"10px 14px",background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:8}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,alignItems:"end"}}>
              <div><Label>퇴사일</Label><input type="date" style={inp} value={st.resignDate[0]} onChange={function(e){st.resignDate[1](e.target.value);}}/></div>
              <div style={{fontSize:11,color:"#B45309",lineHeight:1.5,paddingBottom:6}}>⚠️ 퇴사일에 따라 지원금 지급 가능 회차가 달라질 수 있습니다.</div>
            </div>
          </div>
        )}
        {st.programId[0]==="youth_jump"&&(
          <>
            <JuminInput onParsed={function(parsed){st.bd[1](parsed.birthDate);st.gen[1](parsed.gender);st.birthDate[1](parsed.birthDate);st.gender[1](parsed.gender);}}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
              <div><Label>생년월일</Label><input type="date" style={inp} value={st.bd[0]||st.birthDate[0]} onChange={function(e){st.bd[1](e.target.value);st.birthDate[1](e.target.value);}}/></div>
              <div><Label>성별</Label>
                <div style={{display:"flex",gap:4}}>
                  {[["male","남"],["female","여"]].map(function(arr){var on=(st.gen[0]||st.gender[0])===arr[0];return(<button key={arr[0]} onClick={function(){st.gen[1](arr[0]);st.gender[1](arr[0]);}} style={Object.assign({},btnSm,{flex:1,background:on?"#DBEAFE":"#fff",color:on?"#2563EB":"#64748B",border:on?"2px solid #93C5FD":"1px solid #E2E8F0"})}>{arr[1]}</button>);})}
                </div>
              </div>
              {(st.gen[0]||st.gender[0])==="male"&&<div><Label>군복무(월)</Label><input type="number" style={inp} value={st.mil[0]||st.milSvc[0]||""} onChange={function(e){st.mil[1](Number(e.target.value));st.milSvc[1](Number(e.target.value));}} placeholder="18"/></div>}
            </div>
          </>
        )}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><Label>입사일 *</Label><input type="date" style={inp} value={st.startDate[0]} onChange={function(e){st.startDate[1](e.target.value);st.hd[1](e.target.value);}}/></div>
          <div><Label>연락처</Label><input style={inp} value={st.phone[0]} onChange={function(e){st.phone[1](fmtPhone(e.target.value));}} inputMode="numeric" placeholder="010-0000-0000"/></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><Label>이메일</Label><input type="email" style={inp} value={st.email[0]} onChange={function(e){st.email[1](e.target.value);}} placeholder="name@email.com"/></div>
          <div><Label>월급여(원)</Label><input type="number" style={inp} value={st.salary[0]} onChange={function(e){st.salary[1](e.target.value);}} placeholder="2200000"/></div>
        </div>
        {(function(){var wc=checkWage(clampMoney(st.salary[0]),st.weeklyHours[0]);if(!wc||!st.salary[0])return null;if(wc.isAboveMin)return null;return(
          <div style={{padding:"10px 14px",background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8}}>
            <div style={{fontSize:13,fontWeight:700,color:"#DC2626",marginBottom:4}}>⚠️ 최저임금 미달 가능성</div>
            <div style={{fontSize:12,color:"#475569",lineHeight:1.6}}>{st.programId[0]==="youth_jump"?"최저임금 미달 가능성이 있어 청년일자리도약장려금 진행이 어려울 수 있습니다. ":"최저임금 미달 가능성이 있습니다. "}월 환산 최저 {wc.minMonthly.toLocaleString()}원 이상이 필요합니다.</div>
            {props.onOpenWage&&<button style={Object.assign({},btnSm,{marginTop:6,fontSize:12,background:"#EFF6FF",color:"#1D4ED8",border:"1px solid #BFDBFE"})} onClick={function(){props.onClose&&props.onClose();props.onOpenWage();}}>🧮 급여 계산기로 확인하기</button>}
          </div>
        );})()}
        <div>
          <Label>지원금 *</Label>
          {(function(){
            var enabledProgs=Object.values(programs).filter(function(p){return p.enabled!==false;});
            if(enabledProgs.length===0){return(<div style={{marginTop:6,padding:"12px 14px",background:"#FEF3C7",border:"1px solid #FDE68A",borderRadius:8,fontSize:12,color:"#92400E"}}>⚠️ 활성화된 지원금이 없습니다. <strong>지원금 관리</strong> 메뉴에서 사용할 지원금을 켜주세요.</div>);}
            var GORD=["신규채용","재직자유지","육아","커스텀"];
            var GLBL={"신규채용":"신규 채용 지원","재직자유지":"재직자 유지·전환","육아":"육아·출산 관련","커스텀":"사용자 추가"};
            var grouped={};
            enabledProgs.forEach(function(p){var g=p.group||"커스텀";if(!grouped[g])grouped[g]=[];grouped[g].push(p);});
            return GORD.filter(function(g){return grouped[g]&&grouped[g].length>0;}).map(function(g){
              var gp=GROUP_COLORS[g]||GROUP_COLORS["커스텀"];
              return(
                <div key={g} style={{marginTop:10}}>
                  <div style={{fontSize:11,fontWeight:700,color:gp.dark,background:gp.light,borderRadius:5,padding:"3px 8px",display:"inline-flex",alignItems:"center",gap:4,marginBottom:6}}>{gp.icon} {GLBL[g]||g}</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {grouped[g].map(function(p){var on=st.programId[0]===p.id;return(
                      <button key={p.id} onClick={function(){st.programId[1](p.id);}}
                        style={{padding:"10px 12px",borderRadius:10,cursor:"pointer",textAlign:"left",border:"2px solid "+(on?gp.base:"#E2E8F0"),background:on?gp.badge:"#fff",color:on?gp.text:"#475569"}}>
                        <div style={{fontWeight:on?700:500,fontSize:14,lineHeight:1.35}}>{p.year&&<span style={{fontSize:11,fontWeight:700,color:on?gp.dark:"#94A3B8",marginRight:4}}>{p.year}</span>}{p.name}</div>
                        <div style={{fontSize:12,color:on?gp.dark:"#94A3B8",marginTop:2}}>{fProgramAmt(p)}</div>
                      </button>
                    );})}
                  </div>
                </div>
              );
            });
          })()}
        </div>
        {selectedP&&(function(){
          var defY=selectedP.year||CUR_YEAR;
          var years=[];for(var y=2020;y<=CUR_YEAR+1;y++)years.push(y);
          var selY=Number(st.programYear[0])||defY;
          var info=getProgramInfo(company,st.programId[0],selY);
          var quota=info?Number(info.quota||0):0;
          var curCnt=(props.employees||[]).filter(function(e){
            return e.programId===st.programId[0]&&e.status!=="resigned"&&e.id!==init.id&&
                   (Number(e.programYear)||defYear(e.programId))===selY;
          }).length;
          var willCnt=curCnt+1;
          var noInfo=!info||(quota===0&&!(info.agreementDate||info.applyDate));
          var overQ=quota>0&&willCnt>quota;
          var nearQ=!overQ&&quota>0&&willCnt>Math.floor(quota*0.8);
          var qBg=noInfo?"#F8FAFC":overQ?"#FEE2E2":nearQ?"#FEF3C7":"#D1FAE5";
          var qBorder=noInfo?"#E2E8F0":overQ?"#FECACA":nearQ?"#FDE68A":"#6EE7B7";
          var qColor=noInfo?"#94A3B8":overQ?"#DC2626":nearQ?"#D97706":"#059669";
          var applyD=info?info.applyDate||"":"";
          var inWin=null;
          if(applyD&&st.startDate[0]){var lo=addMo(applyD,-3),hi=addMo(applyD,3);inWin=st.startDate[0]>=lo&&st.startDate[0]<=hi;}
          return(<React.Fragment>
            <div><Label>지원 연도</Label>
              <select style={inp} value={selY} onChange={function(e){st.programYear[1](String(e.target.value));}}>
                {years.map(function(y){return <option key={y} value={y}>{y}년{y===defY?" (기본)":""}</option>;})}
              </select>
            </div>
            <div style={{padding:"12px 16px",background:qBg,border:"1px solid "+qBorder,borderRadius:10,fontSize:13,lineHeight:1.6}}>
              {noInfo?(
                <span style={{color:qColor}}>ℹ️ 지원한도 미입력 — 업체 정보 편집 &gt; 지원금별 진행 정보에서 입력하세요</span>
              ):(
                <React.Fragment>
                  <div style={{fontWeight:700,color:qColor,marginBottom:3}}>👥 {quota>0?"지원한도: "+quota+"명 (현재 "+curCnt+"명 → 추가시 "+willCnt+"명)":(info.agreementDate?"협약 체결됨":"협약 미체결")}</div>
                  {quota>0&&overQ&&<div style={{color:qColor,fontSize:12}}>⚠️ 한도 초과 — 운영기관 확인 필요</div>}
                  {info.agreementDate&&<div style={{color:"#047857",fontSize:12}}>✅ 협약 체결: {fD(info.agreementDate)}</div>}
                  {!info.agreementDate&&<div style={{color:"#B45309",fontSize:12}}>⚠️ 협약 미체결 — 신청 전 협약 필요</div>}
                  {applyD&&<div style={{color:"#475569",fontSize:12}}>📋 사전신청일: {fD(applyD)}</div>}
                  {applyD&&st.startDate[0]&&inWin!==null&&<div style={{color:inWin?"#059669":"#DC2626",fontSize:12,fontWeight:inWin?500:700}}>{inWin?"✅ 참여신청일 기준 전후 3개월 이내":"⚠️ 참여신청일 기준 전후 3개월 범위 벗어남 — 운영기관 확인"}</div>}
                </React.Fragment>
              )}
            </div>
            {selY!==defY&&<div style={{padding:"10px 14px",background:"#FEF9C3",border:"1px solid #FDE047",borderRadius:8,fontSize:13,color:"#713F12",lineHeight:1.6}}>⚠️ 선택한 연도의 지원금 기준은 현재 시스템에 입력된 기준과 다를 수 있습니다. 실제 진행 전 반드시 해당 연도 공문과 운영기관 안내를 확인하세요. 미확인으로 발생한 불이익에 대해서는 책임지지 않습니다.</div>}
          </React.Fragment>);
        })()}
        {selectedP&&st.programId[0]==="replace_worker"&&(
          <div style={{padding:"10px 14px",background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:8}}>
            <div style={{fontSize:12,fontWeight:700,color:"#065F46",marginBottom:8}}>📝 대체인력 기본 정보</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div><Label>대체 사유</Label>
                <select style={inp} value={st.replaceReason[0]} onChange={function(e){st.replaceReason[1](e.target.value);}}>
                  <option value="">선택...</option>
                  <option value="육아휴직">육아휴직</option>
                  <option value="출산전후휴가">출산전후휴가</option>
                  <option value="육아기 근로시간 단축">육아기 근로시간 단축</option>
                  <option value="기타">기타</option>
                </select>
              </div>
              <div><Label>대체인력 채용일</Label><input type="date" style={inp} value={st.replaceHireDate[0]} onChange={function(e){st.replaceHireDate[1](e.target.value);}}/></div>
              <div><Label>대체 대상 근로자명</Label><input style={inp} value={st.replaceTargetName[0]} onChange={function(e){st.replaceTargetName[1](e.target.value);}} placeholder="홍길동"/></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                <div><Label>대체 시작일</Label><input type="date" style={inp} value={st.replaceStartDate[0]} onChange={function(e){st.replaceStartDate[1](e.target.value);}}/></div>
                <div><Label>대체 종료일</Label><input type="date" style={inp} value={st.replaceEndDate[0]} onChange={function(e){st.replaceEndDate[1](e.target.value);}}/></div>
              </div>
            </div>
          </div>
        )}
        {selectedP&&(
          <div style={{padding:"10px 14px",background:"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:8}}>
            <div style={{fontSize:12,fontWeight:700,color:"#0284C7",marginBottom:6}}>📋 {selectedP.name} 사전 검토</div>
            <div style={{display:"grid",gap:3}}>{(PROGRAM_CHECKLISTS[st.programId[0]]||["신청 대상 사업장 여부 확인","대상 근로자 요건 확인","고용보험 가입 여부 확인","신청 기한 확인","중복 지원 제한 여부 확인","필수 서류 준비 여부 확인","운영기관 또는 공고문 기준 추가 확인 필요"]).map(function(item,i){return <div key={i} style={{fontSize:11,color:"#475569",padding:"2px 0",display:"flex",gap:5,alignItems:"flex-start"}}><span style={{color:"#0284C7",flexShrink:0}}>☐</span><span>{item}</span></div>;})}</div>
            <div style={{fontSize:10,color:"#94A3B8",marginTop:6}}>※ 지원금 세부 요건은 연도별 공고와 운영기관 기준에 따라 달라질 수 있습니다. 본 체크리스트는 사전 검토용입니다.</div>
          </div>
        )}
        {selectedP&&st.programId[0]==="youth_jump"&&(st.bd[0]||st.birthDate[0])&&(
          <EligChk bd={st.bd[0]||st.birthDate[0]} gen={st.gen[0]||st.gender[0]} mil={st.mil[0]||st.milSvc[0]} ec={st.ec[0]} xc={st.xc[0]}
            hd={st.startDate[0]} setBd={function(v){st.bd[1](v);}} setGen={function(v){st.gen[1](v);}} setMil={function(v){st.mil[1](v);}} setEc={st.ec[1]} setXc={st.xc[1]}/>
        )}
        <div><Label>메모</Label><textarea style={Object.assign({},inp,{height:60,resize:"none"})} value={st.memo[0]} onChange={function(e){st.memo[1](e.target.value);}}/></div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button style={btnS} onClick={props.onClose}>취소</button>
          <button style={Object.assign({},btnP,{padding:"10px 28px"})} onClick={save}>직원 저장</button>
        </div>
      </div>
    </Modal>
  );
}

// ── RoundModal (mark round paid) ─────────────────────────
function RoundModal(props){
  var emp=props.emp,ri=props.roundIndex,programs=props.programs;
  if(!emp||ri===null)return null;
  var round=(emp.rounds||[])[ri]||{};
  var p=programs[emp.programId];
  var ed=emp.startDate?addMo(emp.startDate,round.month):null;
  var st1=useState(round.received||round.expectedAmount||0);
  var st2=useState(round.paidDate||new Date().toISOString().split("T")[0]);
  var st3=useState(round.note||"");
  function save(){
    var rounds=(emp.rounds||[]).slice();
    rounds[ri]=Object.assign({},rounds[ri],{isPaid:true,received:clampMoney(st1[0]),paidDate:st2[0],note:st3[0]});
    props.onSave(rounds);
  }
  function unmark(){
    var rounds=(emp.rounds||[]).slice();
    rounds[ri]=Object.assign({},rounds[ri],{isPaid:false,received:0,paidDate:null});
    props.onSave(rounds);
  }
  return(
    <Modal open={props.open} onClose={props.onClose} title={"💳 "+emp.name+" · "+round.label} width={420}>
      <div style={{display:"grid",gap:14}}>
        <div style={{padding:12,background:"#F8FAFC",borderRadius:8,fontSize:12}}>
          <div>{p&&p.name}</div>
          {ed&&<div>신청 가능일: <strong>{fD(ed)}</strong></div>}
          <div>예상금액: <strong>{fMan(round.expectedAmount||0)}</strong></div>
        </div>
        <div><Label>실제 수령액(원)</Label><input type="number" style={inp} value={st1[0]} onChange={function(e){st1[1](e.target.value);}}/></div>
        <div><Label>수령일</Label><input type="date" style={inp} value={st2[0]} onChange={function(e){st2[1](e.target.value);}}/></div>
        <div><Label>메모</Label><input style={inp} value={st3[0]} onChange={function(e){st3[1](e.target.value);}} placeholder="입금 메모..."/></div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          {round.isPaid&&<button style={Object.assign({},btnSm,{color:"#DC2626",border:"1px solid #FECACA"})} onClick={unmark}>❌ 미수령으로</button>}
          <button style={btnS} onClick={props.onClose}>취소</button>
          <button style={Object.assign({},btnP,{padding:"10px 28px"})} onClick={save}>✅ 수령 확인</button>
        </div>
      </div>
    </Modal>
  );
}

// ── CompDet (company detail view) ─────────────────────────
function CompDet(props){
  var company=props.company,programs=props.programs,employees=props.employees;
  var uploadFn=props.uploadFn,getUrlFn=props.getUrlFn;
  var compEmps=employees.filter(function(e){return e.companyId===company.id;});
  var st1=useState(false); // add emp modal
  var st2=useState(null);  // edit emp
  var st3=useState(null);  // round modal emp
  var st4=useState(null);  // round modal index
  var st5=useState("all"); // status filter
  var st6=useState(false); // edit company modal
  var stTab=useState("overview"); // 개요/직원/서류/일지
  var stNote=useState("");  // 새 일지 입력
  var stNoteType=useState("전화"); // 일지 유형
  var stEditId=useState(null);  // 편집 중인 일지 id
  var stEditText=useState(""); // 편집 중인 내용
  var stViewMode=useState("card"); // card | table
  var stSelected=useState([]); // bulk-selected emp IDs

  var notes=company.notes||[];
  function addNote(){
    var txt=stNote[0].trim(); if(!txt)return;
    var author=(props.profile&&props.profile.display_name)||"";
    var next=[{id:uid(),text:txt,at:new Date().toISOString(),author:author,type:stNoteType[0]}].concat(notes);
    props.onPatchCompany(company.id,{notes:next});
    stNote[1]("");
    toast("업무 일지가 기록되었습니다.","success");
  }
  function delNote(nid){ props.onPatchCompany(company.id,{notes:notes.filter(function(n){return n.id!==nid;})}); }
  function startEdit(n){ stEditId[1](n.id); stEditText[1](n.text); }
  function saveEdit(nid){
    var txt=stEditText[0].trim(); if(!txt)return;
    props.onPatchCompany(company.id,{notes:notes.map(function(n){return n.id===nid?Object.assign({},n,{text:txt,editedAt:new Date().toISOString()}):n;})});
    stEditId[1](null);
  }
  function cancelEdit(){ stEditId[1](null); stEditText[1](""); }

  var filteredEmps=compEmps.filter(function(e){
    if(st5[0]==="all")return true;
    return e.status===st5[0];
  });
  var activeCount=compEmps.filter(function(e){return e.status!=="resigned";}).length;
  var totalPaid=compEmps.reduce(function(s,e){return s+(e.rounds||[]).reduce(function(ss,r){return ss+(r.isPaid?r.received||0:0);},0);},0);
  var totalExp=compEmps.reduce(function(s,e){return s+(e.totalExpected||0);},0);

  // 업체 서류 완료율
  var compDocs=company.companyDocs||[];
  var docPct=compDocs.length>0?Math.round(compDocs.filter(function(d){return d.done;}).length/compDocs.length*100):0;

  // 이 업체 향후 신청 예정 회차
  var upcoming=useMemo(function(){var list=[];compEmps.forEach(function(e){if(e.status==="resigned")return;var p=programs[e.programId];if(!e.startDate||!p)return;(e.rounds||[]).forEach(function(r){if(r.isPaid)return;var ed=addMo(e.startDate,r.month);var dd=getDday(ed);list.push({empName:e.name,roundLabel:r.label,eligDate:ed,dday:dd,amount:r.expectedAmount||r.amount||0});});});return list.sort(function(a,b){return(a.dday===null?9999:a.dday)-(b.dday===null?9999:b.dday);}).slice(0,8);},[compEmps,programs]);

  // 업체 위험도 지표
  var risk=useMemo(function(){
    var overdue=0,overdueAmt=0,next7=0,docMiss=0;
    compEmps.forEach(function(e){
      if(e.status==="resigned")return;
      (e.rounds||[]).forEach(function(r){
        if(r.isPaid)return; var amt=r.expectedAmount||r.amount||0;
        if(e.startDate){var dd=getDday(addMo(e.startDate,r.month));if(dd!==null){if(dd<0){overdue++;overdueAmt+=amt;}else if(dd<=7)next7++;}}
      });
      (e.employeeDocs||[]).forEach(function(d){if(!d.done)docMiss++;});
    });
    (compDocs||[]).forEach(function(d){if(!d.done)docMiss++;});
    return{overdue:overdue,overdueAmt:overdueAmt,next7:next7,docMiss:docMiss};
  },[compEmps,compDocs]);

  function stLabel(k){var s=STS.find(function(x){return x.key===k;});return s?s.label:k;}
  function handleSaveEmp(empData){
    if(st2[0]){
      var prev=st2[0];
      props.onPatchEmployee(empData.id,empData);
      if(prev.status!==empData.status&&props.onLog)props.onLog(company.id,empData.name+" 상태가 '"+stLabel(prev.status)+"' → '"+stLabel(empData.status)+"'(으)로 변경됨","상태변경");
      toast("직원 정보가 저장되었습니다.","success");
    } else {
      props.onSaveEmployee(empData);
      if(props.onLog)props.onLog(company.id,empData.name+" 대상자 등록","상태변경");
      toast("직원이 등록되었습니다.","success");
    }
    st1[1](false);
    st2[1](null);
  }
  function handleRoundSave(rounds){
    if(st3[0]){
      var before=st3[0].rounds||[];
      var newlyPaid=rounds.filter(function(r,i){return r.isPaid&&!(before[i]&&before[i].isPaid);});
      props.onPatchEmployee(st3[0].id,{rounds:rounds});
      if(newlyPaid.length>0&&props.onLog)props.onLog(company.id,st3[0].name+" "+newlyPaid.map(function(r){return r.label;}).join(",")+" 지급 확인("+fMan(newlyPaid.reduce(function(s,r){return s+(r.received||0);},0))+")","지급확인");
      toast("회차 지급 상태가 저장되었습니다.","success");
    }
    st3[1](null);st4[1](null);
  }
  function handleBulkUpload(rows){
    rows.forEach(function(row){
      var p=programs[row.programId]||Object.values(programs)[0];
      if(!p)return;
      var rounds=(p.rounds||[]).map(function(r){return Object.assign({},r,{isPaid:false,received:0});});
      props.onSaveEmployee({
        id:ruuid(),companyId:company.id,name:row.name,programId:row.programId||p.id,
        startDate:row.startDate,birthDate:row.birthDate,gender:row.gender||"male",
        status:"preparing",phone:row.phone,email:row.email,
        totalExpected:p.totalAmount||0,rounds:rounds,
        certDocs:(CERT_TYPES[p.id]||[]).map(function(ct){return{id:uid(),label:ct,done:false,files:[]};})
      });
    });
  }

  var TABS=[{key:"overview",icon:"📋",label:"개요"},{key:"employees",icon:"👤",label:"직원 ("+compEmps.length+")"},{key:"docs",icon:"📁",label:"업체 서류"},{key:"commission",icon:"🧾",label:"수수료 정산"},{key:"notes",icon:"📝",label:"업무 일지"+(notes.length>0?" ("+notes.length+")":"")}];

  // 수수료 정산 상태 (company.commission JSONB)
  var comm=company.commission||{};
  var commRate=comm.rate!=null?comm.rate:10;
  var commRetainer=comm.retainer||0;
  var commUseSuccess=comm.successFee!==false; // 성공보수 적용 여부
  var commSuccessFee=commUseSuccess?totalPaid*commRate/100:0;
  var commExpected=Math.round(commRetainer+(commUseSuccess?totalExp*commRate/100:0));
  var commBillable=Math.round(commRetainer+commSuccessFee);
  var commReceivable=comm.paid?0:(comm.billed?commBillable:0);
  function patchComm(patch){ props.onPatchCompany(company.id,{commission:Object.assign({},comm,patch)}); }

  function renderEmpList(){
    var allIds=filteredEmps.map(function(e){return e.id;});
    var selSet=new Set(stSelected[0]);
    var allChecked=allIds.length>0&&allIds.every(function(id){return selSet.has(id);});
    function toggleSelect(id){var cur=stSelected[0].slice();var i=cur.indexOf(id);if(i>=0)cur.splice(i,1);else cur.push(id);stSelected[1](cur);}
    function toggleAll(){if(allChecked)stSelected[1]([]);else stSelected[1](allIds);}
    function bulkStatus(s){var n=stSelected[0].length;stSelected[0].forEach(function(id){props.onPatchEmployee(id,{status:s});});if(n>0&&props.onLog)props.onLog(company.id,n+"명 상태를 '"+stLabel(s)+"'(으)로 일괄 변경","상태변경");stSelected[1]([]);toast(n+"명 상태가 변경되었습니다.","success");}
    function bulkCopy(){var rows=filteredEmps.filter(function(e){return selSet.has(e.id);});var text=rows.map(function(e){var p=programs[e.programId];var s=STS.find(function(s){return s.key===e.status;})||STS[0];return[e.name,(s?s.label:""),(p?p.name:""),e.startDate||""].join("\t");}).join("\n");navigator.clipboard.writeText(text);}
    function getNextDday(emp){if(!emp.startDate)return null;var ddays=(emp.rounds||[]).filter(function(r){return!r.isPaid;}).map(function(r){return getDday(addMo(emp.startDate,r.month));}).filter(function(d){return d!==null&&d>=0;});return ddays.length?Math.min.apply(null,ddays):null;}
    function getRcv(emp){return(emp.rounds||[]).reduce(function(s,r){return s+(r.isPaid?r.received||0:0);},0);}
    function getAge(emp){if(!emp.birthDate)return"-";var d=calcAgeDetailed(emp.birthDate,emp.startDate||new Date().toISOString().split("T")[0]);return d?d.years+"세":"-";}
    return(
      <div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
          <h3 style={{margin:0,fontSize:20,fontWeight:700}}>👤 직원 ({compEmps.length}명)</h3>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            <div style={{display:"flex",background:"#F1F5F9",borderRadius:8,padding:2}}>
              {[["card","🗃️ 카드"],["table","📋 표"]].map(function(arr){var on=stViewMode[0]===arr[0];return(
                <button key={arr[0]} onClick={function(){stViewMode[1](arr[0]);stSelected[1]([]);}}
                  style={{padding:"5px 12px",borderRadius:6,fontSize:13,border:"none",cursor:"pointer",background:on?"#fff":"transparent",color:on?"#2563EB":"#64748B",fontWeight:on?700:400,boxShadow:on?"0 1px 4px rgba(0,0,0,0.08)":"none",fontFamily:FF}}>
                  {arr[1]}
                </button>
              );})}
            </div>
            <BulkUpload programs={programs} onUpload={handleBulkUpload}/>
            <button style={btnP} className="hover-lift" onClick={function(){st1[1](true);}}>+ 직원 추가</button>
          </div>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
          {[{key:"all",label:"전체 ("+compEmps.length+")"}].concat(STS.map(function(s){var cnt=compEmps.filter(function(e){return e.status===s.key;}).length;return{key:s.key,label:s.icon+" "+s.label+(cnt>0?" ("+cnt+")":""),cnt:cnt};})).map(function(f){return(
            <button key={f.key} onClick={function(){st5[1](f.key);stSelected[1]([]);}}
              style={Object.assign({},btnSm,{fontSize:15,background:st5[0]===f.key?"#2563EB":"#fff",color:st5[0]===f.key?"#fff":"#475569",border:st5[0]===f.key?"none":"1px solid #E2E8F0"})}>
              {f.label}
            </button>
          );})}
        </div>
        {filteredEmps.length===0?(
          compEmps.length===0?
            <EmptyState icon="🧑‍💼" title="등록된 직원이 없습니다" desc="지원금 대상 직원을 등록하면 회차별 신청 일정과 수령 현황이 자동으로 관리됩니다. 엑셀로 여러 명을 한 번에 등록할 수도 있어요." actionLabel="+ 첫 직원 등록하기" action={function(){st1[1](true);}}/>
            :<Card style={{padding:36,textAlign:"center"}}><div style={{fontSize:40,marginBottom:8}}>🔍</div><p style={{color:"#94A3B8",fontSize:17,margin:0}}>해당 상태의 직원이 없습니다.</p></Card>
        ):stViewMode[0]==="table"?(
          <Card style={{padding:0,overflow:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:14}}>
              <thead>
                <tr style={{background:"#F8FAFC",borderBottom:"2px solid #E2E8F0"}}>
                  <th style={{padding:"10px 12px",textAlign:"center",width:36}}>
                    <input type="checkbox" checked={allChecked} onChange={toggleAll} style={{cursor:"pointer",width:15,height:15}}/>
                  </th>
                  {["이름","상태","지원금","입사일","나이","수령액","잔여예상","D-Day",""].map(function(h,i){return(
                    <th key={i} style={{padding:"10px 12px",textAlign:"left",fontSize:13,fontWeight:700,color:"#475569",whiteSpace:"nowrap"}}>{h}</th>
                  );})}
                </tr>
              </thead>
              <tbody>
                {filteredEmps.map(function(emp,idx){
                  var p=programs[emp.programId];
                  var s=STS.find(function(ss){return ss.key===emp.status;})||STS[0];
                  var rcv=getRcv(emp);
                  var rem=(emp.totalExpected||0)-rcv;
                  var dd=getNextDday(emp);
                  var isSel=selSet.has(emp.id);
                  return(
                    <tr key={emp.id} style={{borderBottom:"1px solid #F1F5F9",background:isSel?"#EFF6FF":idx%2===0?"#fff":"#FAFBFC",transition:"background 0.15s"}}>
                      <td style={{padding:"10px 12px",textAlign:"center"}}>
                        <input type="checkbox" checked={isSel} onChange={function(){toggleSelect(emp.id);}} style={{cursor:"pointer",width:15,height:15}}/>
                      </td>
                      <td style={{padding:"10px 12px",fontWeight:600,color:"#1E293B"}}>{emp.name}</td>
                      <td style={{padding:"10px 12px"}}>
                        <select value={emp.status} onChange={function(e){props.onPatchEmployee(emp.id,{status:e.target.value});}}
                          style={{padding:"4px 7px",borderRadius:6,border:"1px solid #E2E8F0",fontSize:12,background:s.bg,color:s.color,cursor:"pointer",fontFamily:FF,fontWeight:600}}>
                          {STS.map(function(ss){return <option key={ss.key} value={ss.key}>{ss.icon+" "+ss.label}</option>;})}
                        </select>
                      </td>
                      <td style={{padding:"10px 12px",color:"#475569"}}>{p?p.name:"-"}</td>
                      <td style={{padding:"10px 12px",color:"#64748B",fontSize:13}}>{emp.startDate?fD(emp.startDate):"-"}</td>
                      <td style={{padding:"10px 12px",color:"#64748B",fontSize:13}}>{getAge(emp)}</td>
                      <td style={{padding:"10px 12px",fontWeight:600,color:"#059669"}}>{fMan(rcv)}</td>
                      <td style={{padding:"10px 12px",color:"#2563EB"}}>{rem>0?fMan(rem):"—"}</td>
                      <td style={{padding:"10px 12px"}}>{dd!==null?<DdayBadge dday={dd}/>:<span style={{color:"#CBD5E1",fontSize:12}}>—</span>}</td>
                      <td style={{padding:"10px 8px",whiteSpace:"nowrap"}}>
                        <button onClick={function(){st2[1](emp);}} style={{background:"none",border:"none",color:"#64748B",cursor:"pointer",fontSize:15,padding:"2px 6px"}} title="편집">✏️</button>
                        <button onClick={function(){if(window.confirm("'"+emp.name+"' 직원을 삭제하시겠습니까?\n삭제된 직원은 기본 목록에서 숨겨지며, 회차와 서류 관리 내역도 함께 보이지 않습니다."))props.onDeleteEmployee(emp.id);}} style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer",fontSize:15,padding:"2px 6px"}} title="삭제">🗑️</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        ):(
          filteredEmps.map(function(emp){return(
            <EmpCard key={emp.id} emp={emp} programs={programs} company={company}
              uploadFn={uploadFn} getUrlFn={getUrlFn}
              onEdit={function(e){st2[1](e);}}
              onDelete={props.onDeleteEmployee}
              onPatch={function(id,patch){props.onPatchEmployee(id,patch);}}
              onLog={props.onLog}
              onRoundClick={function(e,ri){st3[1](e);st4[1](ri);}}
              onCertToggle={function(e,di){
                var docs=(e.certDocs||[]).slice();
                docs[di]=Object.assign({},docs[di],{done:!docs[di].done});
                props.onPatchEmployee(e.id,{certDocs:docs});
              }}
            />
          );})
        )}
        {stSelected[0].length>0&&(
          <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",display:"flex",alignItems:"center",gap:12,padding:"14px 22px",background:"#1E293B",borderRadius:16,boxShadow:"0 8px 32px rgba(0,0,0,0.28)",zIndex:500,color:"#fff",fontFamily:FF,whiteSpace:"nowrap"}}>
            <span style={{fontSize:15,fontWeight:700}}>{stSelected[0].length}명 선택됨</span>
            <div style={{width:1,height:22,background:"rgba(255,255,255,0.2)"}}/>
            <span style={{fontSize:13,opacity:0.7}}>상태 변경:</span>
            <select onChange={function(e){if(e.target.value){bulkStatus(e.target.value);}e.target.value="";}} defaultValue=""
              style={{padding:"5px 8px",borderRadius:8,border:"none",fontSize:13,background:"#334155",color:"#fff",cursor:"pointer",fontFamily:FF}}>
              <option value="" disabled>선택...</option>
              {STS.map(function(s){return <option key={s.key} value={s.key}>{s.icon+" "+s.label}</option>;})}
            </select>
            <button onClick={bulkCopy} style={{padding:"6px 14px",borderRadius:8,background:"#334155",border:"none",color:"#fff",cursor:"pointer",fontSize:13,fontFamily:FF}}>📋 복사</button>
            <button onClick={function(){stSelected[1]([]);}} style={{padding:"6px 10px",borderRadius:8,background:"transparent",border:"1px solid rgba(255,255,255,0.25)",color:"#94A3B8",cursor:"pointer",fontSize:13,fontFamily:FF}}>✕</button>
          </div>
        )}
      </div>
    );
  }

  return(
    <div className="fade-in">
      {/* 헤더 */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <h2 style={{margin:0,fontSize:28,fontWeight:800,color:"#1E293B"}}>{company.name}</h2>
            {(company.tags||[]).map(function(tid){var tag=TAGS.find(function(t){return t.id===tid;});if(!tag)return null;return <Badge key={tid} color={tag.color} bg={tag.bg}>{tag.label}</Badge>;})}
          </div>
          <div style={{fontSize:16,color:"#94A3B8",marginTop:4}}>{company.bizNo&&company.bizNo+" · "}{company.ceoName&&"대표 "+company.ceoName}</div>
          {(company.managerName||company.managerTitle||company.managerEmail)&&(
            <div style={{fontSize:14,color:"#64748B",marginTop:3,display:"flex",gap:8,flexWrap:"wrap"}}>
              {(company.managerName||company.managerTitle)&&<span>👤 담당자 {company.managerName||""}{company.managerTitle?" "+company.managerTitle:""}</span>}
              {company.managerEmail&&<span style={{color:"#2563EB"}}>✉️ {company.managerEmail}</span>}
            </div>
          )}
        </div>
        <AgencyReport company={company} employees={compEmps} programs={programs} profile={props.profile} onLog={props.onLog}/>
        <PDFReport company={company} employees={compEmps} programs={programs} profile={props.profile} onLog={props.onLog}/>
        <CommissionReport company={company} employees={compEmps} programs={programs} profile={props.profile} onLog={props.onLog}/>
        <button style={Object.assign({},btnSm,{fontSize:16})} className="hover-lift" onClick={function(){st6[1](true);}}>⚙️ 업체 정보 수정</button>
      </div>

      {/* 위험도 카드 (지연/임박/서류) */}
      {(risk.overdue>0||risk.next7>0||risk.docMiss>0)&&(
        <div style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",marginBottom:16,borderRadius:12,background:"#fff",border:"1px solid #E2E8F0",borderLeft:risk.overdue>0?"3px solid #DC2626":risk.next7>0?"3px solid #2563EB":"3px solid #CBD5E1"}}>
          <span style={{fontSize:22,flexShrink:0}}>{risk.overdue>0?"🚨":risk.next7>0?"⏰":"📁"}</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:16,fontWeight:800,color:risk.overdue>0?"#DC2626":"#0F172A"}}>
              {risk.overdue>0?"지연 신청 "+risk.overdue+"건 — 예상 "+fMan(risk.overdueAmt)+"이 걸려 있습니다":risk.next7>0?"신청 임박 "+risk.next7+"건 — 곧 신청 가능합니다":"미제출 서류 "+risk.docMiss+"건 — 보완이 필요합니다"}
            </div>
            <div style={{fontSize:14,color:"#64748B",marginTop:3}}>
              {[risk.overdue>0&&risk.next7>0?"7일 내 신청 "+risk.next7+"건":null,risk.docMiss>0?"미제출 서류 "+risk.docMiss+"건":null,"즉시 서류 확인 및 신청 여부를 점검하세요"].filter(Boolean).join(" · ")}
            </div>
          </div>
          <button onClick={function(){stTab[1](risk.docMiss>0&&risk.overdue===0&&risk.next7===0?"docs":"employees");}} style={{flexShrink:0,background:risk.overdue>0?"#DC2626":"#2563EB",color:"#fff",border:"none",borderRadius:9,padding:"9px 18px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:FF}}>확인하기 →</button>
        </div>
      )}

      {/* 요약 카드 */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:18}}>
        {[
          {l:"지원 대상자",v:activeCount+"명",c:"#0F172A",accent:null},
          {l:"누적 수령액",v:fMan(totalPaid),c:"#059669",accent:null},
          {l:"예상 잔여액",v:fMan(totalExp-totalPaid),c:"#1D4ED8",accent:null},
          {l:"예상 수수료 ("+commRate+"%)",v:fMan(commExpected),c:"#1D4ED8",accent:null},
          {l:"서류 완료율",v:docPct+"%",c:docPct===100?"#059669":"#0F172A",accent:null,sub:risk.docMiss>0?"미제출 "+risk.docMiss+"건":"모두 완료"},
          {l:"지연 신청 건",v:risk.overdue+"건",c:risk.overdue>0?"#DC2626":"#0F172A",accent:risk.overdue>0?"#DC2626":null,sub:risk.overdue>0?fMan(risk.overdueAmt)+" 위험":"지연 없음"}
        ].map(function(c,i){return(
          <Card key={i} className="kpi-card" style={{padding:"18px 20px",border:"1px solid #E2E8F0",borderLeft:c.accent?("3px solid "+c.accent):"1px solid #E2E8F0"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><span style={{fontSize:15,color:"#64748B",fontWeight:600}}>{c.l}</span></div>
            <div style={{fontSize:24,fontWeight:800,color:c.c}}>{c.v}</div>
            {c.sub&&<div style={{fontSize:12,color:"#94A3B8",marginTop:4,fontWeight:500}}>{c.sub}</div>}
          </Card>
        );})}
      </div>

      {/* 탭 바 */}
      <div style={{display:"flex",gap:4,borderBottom:"2px solid #E2E8F0",marginBottom:20,overflowX:"auto"}}>
        {TABS.map(function(t){var on=stTab[0]===t.key;return(
          <button key={t.key} onClick={function(){stTab[1](t.key);}} style={{padding:"12px 22px",fontSize:18,fontWeight:on?700:500,color:on?"#2563EB":"#64748B",background:"none",border:"none",borderBottom:on?"3px solid #2563EB":"3px solid transparent",marginBottom:-2,cursor:"pointer",fontFamily:FF,whiteSpace:"nowrap",flexShrink:0}}>
            {t.icon} {t.label}
          </button>
        );})}
      </div>

      {/* 탭 콘텐츠 */}
      {stTab[0]==="overview"&&(
        <div className="fade-in">
          {/* 스마트 액션 카드: 즉각 조치 필요한 항목만 */}
          {(function(){
            var actions=[];
            compEmps.forEach(function(e){
              if(e.status==="resigned")return;
              var prog=programs[e.programId]; if(!e.startDate||!prog)return;
              (e.rounds||[]).forEach(function(r,ri){
                if(r.isPaid)return;
                var dd=getDday(addMo(e.startDate,r.month));
                if(dd!==null&&dd<=0)actions.push({level:"danger",icon:"🚨",emp:e.name,text:r.label+" 신청 기한 초과! 즉시 처리하세요",dd:dd,empId:e.id});
                else if(dd!==null&&dd<=3)actions.push({level:"warn",icon:"⚠️",emp:e.name,text:r.label+" "+formatDday(dd)+" — 곧 신청 가능",dd:dd,empId:e.id});
              });
            });
            if(actions.length===0)return null;
            actions.sort(function(a,b){return a.dd-b.dd;});
            return(
              <div style={{marginBottom:16,display:"grid",gap:8}}>
                {actions.slice(0,3).map(function(a,i){return(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",borderRadius:10,background:"#fff",border:"1px solid #E2E8F0",borderLeft:a.level==="danger"?"3px solid #DC2626":"3px solid #CBD5E1"}}>
                    <span style={{fontSize:18,flexShrink:0}}>{a.icon}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <span style={{fontSize:15,fontWeight:700,color:"#1E293B"}}>{a.emp}</span>
                      <span style={{fontSize:14,color:"#64748B",marginLeft:8}}>{a.text}</span>
                    </div>
                    <DdayBadge dday={a.dd}/>
                  </div>
                );})}
              </div>
            );
          })()}
          <Card style={{padding:22,marginBottom:16}}>
            <h3 style={{margin:"0 0 14px",fontSize:20,fontWeight:700}}>🔔 향후 신청 예정</h3>
            {upcoming.length===0?(
              <div style={{textAlign:"center",padding:"28px 0"}}><div style={{fontSize:36,marginBottom:8}}>🗓️</div><p style={{color:"#94A3B8",fontSize:16,margin:0}}>예정된 신청 건이 없습니다. 직원을 등록하면 회차 일정이 표시됩니다.</p></div>
            ):upcoming.map(function(u,i){return(
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",borderRadius:10,background:i%2===0?"#F8FAFC":"#fff",marginBottom:4}}>
                <div><span style={{fontSize:17,fontWeight:600,color:"#1E293B"}}>{u.empName}</span><span style={{fontSize:15,color:"#94A3B8",marginLeft:8}}>{u.roundLabel} · {fD(u.eligDate)}</span></div>
                <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:17,fontWeight:700,color:"#2563EB"}}>{fMan(u.amount)}</span><DdayBadge dday={u.dday}/></div>
              </div>
            );})}
          </Card>
          {(function(){
            var seen={};var rows=[];
            compEmps.forEach(function(e){if(e.status==="resigned")return;var p=programs[e.programId];if(!p||seen[p.id])return;seen[p.id]=true;rows.push(p);});
            if(rows.length===0)return null;
            return(
              <Card style={{padding:22,marginBottom:16}}>
                <h3 style={{margin:"0 0 12px",fontSize:20,fontWeight:700}}>🏛️ 관할·운영기관</h3>
                <div style={{fontSize:13,color:"#94A3B8",marginBottom:10}}>이 업체가 진행 중인 지원금의 관할기관입니다.</div>
                <div style={{display:"grid",gap:8}}>
                  {rows.map(function(p){var gp=GROUP_COLORS[p.group]||GROUP_COLORS["커스텀"];return(
                    <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"11px 14px",borderRadius:10,background:gp.badge,border:"1px solid "+gp.light,flexWrap:"wrap"}}>
                      <span style={{fontSize:15,fontWeight:700,color:gp.dark}}>{gp.icon} {p.name}</span>
                      <span style={{fontSize:14,color:"#2563EB",fontWeight:600}}>📍 {p.applyUrl||"공고문 확인"}</span>
                    </div>
                  );})}
                </div>
              </Card>
            );
          })()}
          <Card style={{padding:22,marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <h3 style={{margin:0,fontSize:20,fontWeight:700}}>📁 업체 서류 진행률</h3>
              <span style={docPct===100?successBadge():neutralBadge()}>{docPct}%</span>
            </div>
            <div style={{height:10,background:"#F1F5F9",borderRadius:5,overflow:"hidden",marginBottom:8}}><div style={{height:"100%",width:docPct+"%",background:docPct===100?"#059669":"#2563EB",borderRadius:5,transition:"width 0.5s ease"}}/></div>
            <button style={Object.assign({},btnSm,{fontSize:15})} onClick={function(){stTab[1]("docs");}}>서류 관리하기 →</button>
          </Card>
          {/* 업무 일지 미리보기 */}
          <Card style={{padding:22}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <h3 style={{margin:0,fontSize:20,fontWeight:700}}>📝 업무 일지</h3>
              <button style={Object.assign({},btnSm,{fontSize:14})} onClick={function(){stTab[1]("notes");}}>전체 보기 →</button>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
              <select value={stNoteType[0]} onChange={function(e){stNoteType[1](e.target.value);}} style={{fontSize:14,padding:"9px 10px",borderRadius:10,border:"1.5px solid #E2E8F0",background:"#fff",color:"#475569",cursor:"pointer",fontFamily:FF,outline:"none"}}>
                {NOTE_TYPES.map(function(t){return <option key={t.id} value={t.id}>{t.icon} {t.id}</option>;})}
              </select>
              <input style={Object.assign({},inpKo,{flex:1,minWidth:140,fontSize:14,padding:"9px 12px"})} value={stNote[0]} onChange={function(e){stNote[1](e.target.value);}} placeholder="통화·제출·특이사항 기록…" onKeyDown={function(e){if(e.key==="Enter")addNote();}}/>
              <button style={Object.assign({},btnP,{padding:"9px 18px",fontSize:14})} onClick={addNote}>업무 기록</button>
            </div>
            {notes.length===0?(
              <div style={{textAlign:"center",padding:"20px 0"}}><div style={{fontSize:28,marginBottom:6}}>🗒️</div><p style={{color:"#94A3B8",fontSize:15,margin:0}}>첫 일지를 남겨보세요.</p></div>
            ):notes.slice(0,3).map(function(n){return(
              <div key={n.id} style={{padding:"10px 12px",borderRadius:8,background:"#F8FAFC",border:"1px solid #F1F5F9",marginBottom:6}}>
                <div style={{fontSize:12,color:"#94A3B8",marginBottom:3,display:"flex",alignItems:"center",gap:6}}>{n.type&&<span style={{fontWeight:700,color:n.auto?"#64748B":"#2563EB"}}>{noteTypeMeta(n.type).icon} {n.type}{n.auto?"·자동":""}</span>}<span>{fDateTime(n.at)}{n.author&&" · "+n.author}</span></div>
                <div style={{fontSize:15,color:"#1E293B",lineHeight:1.5}}>{n.text}</div>
              </div>
            );})}
            {notes.length>3&&<div style={{textAlign:"center",marginTop:8}}><button style={Object.assign({},btnSm,{fontSize:13})} onClick={function(){stTab[1]("notes");}}>일지 {notes.length-3}개 더 보기</button></div>}
          </Card>
        </div>
      )}

      {stTab[0]==="employees"&&<div className="fade-in">{renderEmpList()}</div>}

      {stTab[0]==="docs"&&(
        <div className="fade-in">
          <DocSection title="업체 서류" docs={company.companyDocs||[]} disabled={false}
            quickDocs={COMPANY_QUICK_DOCS} defaultDocs={COMPANY_DOC_DEFAULTS} payday={company.payday} contactName={company.managerName}
            uploadFn={uploadFn} getUrlFn={getUrlFn}
            onChange={function(ds){props.onPatchCompany(company.id,{companyDocs:ds});}}
            onLog={function(txt,type){props.onLog(company.id,txt,type);}}
          />
        </div>
      )}

      {stTab[0]==="commission"&&(
        <div className="fade-in">
          {!(props.tier&&props.tier.feat.commission)?(
            <Card style={{padding:"44px 32px",textAlign:"center",border:"1px solid #E2E8F0",background:"#F8FAFC"}}>
              <div style={{fontSize:46,marginBottom:14}}>🔒</div>
              <h3 style={{margin:"0 0 8px",fontSize:22,fontWeight:800,color:"#1D4ED8"}}>수수료 정산은 프로 플랜 전용입니다</h3>
              <p style={{margin:"0 0 22px",fontSize:15,color:"#475569",lineHeight:1.7}}>업체별 수수료율·착수금·청구/입금 상태·미수금을 한 곳에서 관리하고,<br/>정산서를 자동 생성해 고객에게 바로 보낼 수 있습니다.</p>
              <button style={Object.assign({},btnP,{padding:"14px 32px",fontSize:16})} onClick={props.onOpenBilling||function(){}}>프로 플랜으로 업그레이드 →</button>
            </Card>
          ):(
            <div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:18}}>
                {[
                  {l:"수령 완료액",v:fMan(totalPaid),c:"#2563EB",i:"✅"},
                  {l:"예상 총 수수료",v:fMan(commExpected),c:"#0D9488",i:"💰",sub:"착수금+전체 "+commRate+"%"},
                  {l:"청구 가능액",v:fMan(commBillable),c:"#059669",i:"🧾",sub:"수령액 기준 "+commRate+"%"},
                  {l:"미수금",v:fMan(commReceivable),c:commReceivable>0?"#DC2626":"#94A3B8",i:commReceivable>0?"⏳":"👍",sub:comm.paid?"입금 완료":comm.billed?"청구 후 미입금":"미청구"}
                ].map(function(c,i){return(
                  <Card key={i} className="kpi-card" style={{padding:"16px 18px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><span style={{fontSize:14,color:"#64748B",fontWeight:600}}>{c.l}</span><span style={{fontSize:18}}>{c.i}</span></div>
                    <div style={{fontSize:23,fontWeight:800,color:c.c}}>{c.v}</div>
                    {c.sub&&<div style={{fontSize:12,color:"#94A3B8",marginTop:3}}>{c.sub}</div>}
                  </Card>
                );})}
              </div>

              <Card style={{padding:22,marginBottom:16}}>
                <h3 style={{margin:"0 0 16px",fontSize:19,fontWeight:700}}>⚙️ 정산 설정</h3>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
                  <div><Label>수수료율 (%)</Label><input type="number" style={inp} value={commRate} min="0" max="100" step="0.5" onChange={function(e){patchComm({rate:clampRate(e.target.value)});}}/></div>
                  <div><Label>착수금 (원)</Label><input type="number" style={inp} value={commRetainer} min="0" onChange={function(e){patchComm({retainer:clampMoney(e.target.value)});}}/></div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:16}}>
                  {[
                    {k:"successFee",label:"성공보수 적용",on:comm.successFee!==false},
                    {k:"billed",label:"청구 완료",on:!!comm.billed,type:"수수료청구"},
                    {k:"paid",label:"입금 완료",on:!!comm.paid,type:"수수료입금"},
                    {k:"taxInvoice",label:"세금계산서 발행",on:!!comm.taxInvoice}
                  ].map(function(t){return(
                    <button key={t.k} onClick={function(){var nv=!t.on;patchComm((function(){var o={};o[t.k]=nv;return o;})());if(t.type&&nv&&props.onLog)props.onLog(company.id,(t.k==="billed"?"수수료 청구 완료 ("+fMan(commBillable)+")":"수수료 입금 완료 ("+fMan(commBillable)+")"),t.type);toast(t.label+(nv?" 처리됨":" 해제됨"),nv?"success":"info");}}
                      style={{padding:"12px 14px",borderRadius:10,border:"1.5px solid "+(t.on?"#6EE7B7":"#E2E8F0"),background:t.on?"#ECFDF5":"#fff",color:t.on?"#047857":"#64748B",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:FF,textAlign:"left"}}>
                      {t.on?"✅ ":"⬜ "}{t.label}
                    </button>
                  );})}
                </div>
                <div><Label>수수료 메모</Label><textarea style={Object.assign({},inpKo,{height:60,resize:"none",fontSize:14})} value={comm.memo||""} onChange={function(e){patchComm({memo:e.target.value});}} placeholder="계약 조건·청구 일정·특이사항 등"/></div>
              </Card>

              <Card style={{padding:22,marginBottom:16}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <h3 style={{margin:0,fontSize:19,fontWeight:700}}>👤 직원별 수수료 ({commRate}%)</h3>
                  <CommissionReport company={company} employees={compEmps} programs={programs} profile={props.profile} onLog={props.onLog}/>
                </div>
                {(function(){var paidEmps=compEmps.filter(function(e){return(e.rounds||[]).some(function(r){return r.isPaid;});});if(paidEmps.length===0)return <p style={{color:"#94A3B8",fontSize:15,textAlign:"center",padding:"16px 0",margin:0}}>아직 수령 완료된 직원이 없습니다. 회차 지급이 확정되면 수수료가 자동 집계됩니다.</p>;return(
                  <div style={{display:"grid",gap:6}}>{paidEmps.map(function(e){var rcv=(e.rounds||[]).reduce(function(s,r){return s+(r.isPaid?r.received||0:0);},0);var f=Math.round(rcv*commRate/100);var pr=programs[e.programId];return(
                    <div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 14px",borderRadius:9,background:"#F8FAFC",border:"1px solid #F1F5F9"}}>
                      <div><span style={{fontSize:16,fontWeight:700,color:"#1E293B"}}>{e.name}</span><span style={{fontSize:13,color:"#94A3B8",marginLeft:8}}>{pr?pr.name:""}</span></div>
                      <div style={{textAlign:"right"}}><div style={{fontSize:13,color:"#64748B"}}>수령 {fMan(rcv)}</div><div style={{fontSize:16,fontWeight:800,color:"#059669"}}>수수료 {fMan(f)}</div></div>
                    </div>
                  );})}</div>
                );})()}
              </Card>
            </div>
          )}
        </div>
      )}

      {stTab[0]==="notes"&&(
        <div className="fade-in">
          <Card style={{padding:22}}>
            <h3 style={{margin:"0 0 16px",fontSize:20,fontWeight:700}}>📝 업무 일지</h3>
            {/* 새 일지 입력 */}
            <div style={{marginBottom:10,display:"flex",gap:6,flexWrap:"wrap"}}>
              {NOTE_TYPES.map(function(t){var on=stNoteType[0]===t.id;return(
                <button key={t.id} onClick={function(){stNoteType[1](t.id);}} style={{padding:"6px 12px",borderRadius:8,fontSize:13,fontWeight:on?700:500,cursor:"pointer",fontFamily:FF,border:on?"none":"1px solid #E2E8F0",background:on?"#2563EB":"#fff",color:on?"#fff":"#475569"}}>{t.icon} {t.id}</button>
              );})}
            </div>
            <div style={{display:"flex",gap:8,marginBottom:20}}>
              <textarea style={Object.assign({},inpKo,{flex:1,height:68,resize:"none",fontSize:15})}
                value={stNote[0]} onChange={function(e){stNote[1](e.target.value);}}
                placeholder="진행 상황·통화 내용·제출 기록·특이사항 등을 남겨보세요 (Ctrl+Enter 로 기록)"
                onKeyDown={function(e){if(e.key==="Enter"&&(e.metaKey||e.ctrlKey))addNote();}}/>
              <button style={Object.assign({},btnP,{padding:"0 20px",alignSelf:"stretch",fontSize:15})} onClick={addNote}>업무 기록</button>
            </div>
            {/* 일지 목록 */}
            {notes.length===0?(
              <div style={{textAlign:"center",padding:"36px 0"}}>
                <div style={{fontSize:36,marginBottom:10}}>🗒️</div>
                <p style={{color:"#94A3B8",fontSize:16,margin:0}}>아직 기록이 없습니다. 첫 일지를 남겨보세요.</p>
              </div>
            ):(
              <div style={{position:"relative",paddingLeft:22}}>
                <div style={{position:"absolute",left:7,top:6,bottom:6,width:2,background:"#E2E8F0"}}/>
                {notes.map(function(n){
                  var isEditing=stEditId[0]===n.id;
                  return(
                    <div key={n.id} style={{marginBottom:14,position:"relative"}}>
                      <div style={{position:"absolute",left:-19,top:14,width:10,height:10,borderRadius:5,background:n.auto?"#94A3B8":"#2563EB",border:"2px solid #fff",boxShadow:"0 0 0 2px "+(n.auto?"#E2E8F0":"#DBEAFE")}}/>
                      <div style={{background:"#F8FAFC",borderRadius:10,border:"1px solid #E2E8F0",padding:"12px 14px",marginLeft:4}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:8}}>
                          <div style={{fontSize:13,color:"#94A3B8",display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                            {n.type&&<span style={{fontWeight:700,fontSize:12,padding:"1px 8px",borderRadius:6,background:n.auto?"#F1F5F9":"#DBEAFE",color:n.auto?"#64748B":"#1D4ED8"}}>{noteTypeMeta(n.type).icon} {n.type}{n.auto?" · 자동":""}</span>}
                            <span>{fDateTime(n.at)}{n.author&&" · "+n.author}</span>
                            {n.editedAt&&<span style={{color:"#CBD5E1",fontSize:12}}>(수정됨)</span>}
                          </div>
                          {!isEditing&&(
                            <div style={{display:"flex",gap:4,flexShrink:0}}>
                              <button onClick={function(){startEdit(n);}}
                                style={{background:"none",border:"none",color:"#94A3B8",cursor:"pointer",fontSize:14,padding:"1px 5px",borderRadius:4,lineHeight:1}} title="편집">✏️</button>
                              <button onClick={function(){if(window.confirm("삭제하겠습니까?"))delNote(n.id);}}
                                style={{background:"none",border:"none",color:"#CBD5E1",cursor:"pointer",fontSize:14,padding:"1px 5px",borderRadius:4,lineHeight:1}} title="삭제">🗑️</button>
                            </div>
                          )}
                        </div>
                        {isEditing?(
                          <div>
                            <textarea style={Object.assign({},inp,{height:72,resize:"none",fontSize:15,marginBottom:8,borderColor:"#93C5FD"})}
                              value={stEditText[0]} onChange={function(e){stEditText[1](e.target.value);}}
                              autoFocus
                              onKeyDown={function(e){if(e.key==="Enter"&&(e.metaKey||e.ctrlKey))saveEdit(n.id);if(e.key==="Escape")cancelEdit();}}/>
                            <div style={{display:"flex",gap:6}}>
                              <button style={Object.assign({},btnP,{padding:"7px 18px",fontSize:14})} onClick={function(){saveEdit(n.id);}}>저장</button>
                              <button style={Object.assign({},btnS,{padding:"7px 14px",fontSize:14})} onClick={cancelEdit}>취소</button>
                            </div>
                          </div>
                        ):(
                          <div style={{fontSize:16,color:"#1E293B",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{n.text}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Modals */}
      {(st1[0]||st2[0])&&(
        <EmpModal open={true} onClose={function(){st1[1](false);st2[1](null);}}
          emp={st2[0]} company={company} programs={programs} employees={compEmps} onSave={handleSaveEmp} onOpenWage={props.onOpenWage}/>
      )}
      <RoundModal open={!!st3[0]&&st4[0]!==null} onClose={function(){st3[1](null);st4[1](null);}}
        emp={st3[0]} roundIndex={st4[0]} programs={programs} onSave={handleRoundSave}/>
      {st6[0]&&<CompanyEditModal open={true} onClose={function(){st6[1](false);}} company={company} programs={programs}
        onSave={function(data){props.onPatchCompany(company.id,data);st6[1](false);toast("업체 정보가 저장되었습니다.","success");}}
        onDelete={props.onDeleteCompany?function(id){props.onDeleteCompany(id);st6[1](false);if(props.goBack)props.goBack();}:null}/>}
    </div>
  );
}

// ── getProgramInfo 헬퍼 ──────────────────────────────────
function getProgramInfo(company,programId,year){
  var infos=(company&&company.programInfos)||[];
  var match=infos.find(function(i){return i.programId===programId&&Number(i.year)===Number(year);});
  if(match)return match;
  if(programId==="youth_jump"){
    return{programId:programId,year:year,
           quota:Number((company&&company.youthQuota)||0),
           applyDate:(company&&company.youthApplyDate)||"",
           agreementDate:(company&&company.agreementDate)||"",
           payday:(company&&company.payday)||""};
  }
  return null;
}

// ── CompanyEditModal ──────────────────────────────────────
function CompanyEditModal(props){
  var c=props.company||{};
  var stAdv=useState(false);
  var stBizTypeCustom=useState(INDUSTRY_OPTIONS.indexOf(c.bizType||"")>=0?false:(c.bizType?true:false));
  var st={
    name:useState(c.name||""),
    bizNo:useState(c.bizNo||""),
    ceoName:useState(c.ceoName||""),
    addr:useState(c.addr||""),
    phone:useState(c.phone||""),
    email:useState(c.email||""),
    managerName:useState(c.managerName||""),
    managerTitle:useState(c.managerTitle||""),
    managerEmail:useState(c.managerEmail||""),
    payday:useState(c.payday||""),
    empCount:useState(c.empCount||""),
    bizType:useState(c.bizType||""),
    corpType:useState(c.corpType||"개인"),
    juPosition:useState(c.juPosition||""),
    sector:useState(c.sector||""),
    region:useState(c.region||"비수도권"),
    insuranceDate:useState(c.insuranceDate||""),
    youthQuota:useState(c.youthQuota||""),
    youthApplyDate:useState(c.youthApplyDate||""),
    agreementDate:useState(c.agreementDate||""),
    bizStatus:useState(c.bizStatus||"정상"),
    customStatus:useState(c.customStatus||""),
    statusMemo:useState(c.statusMemo||""),
    memo:useState(c.memo||""),
    tags:useState(c.tags||[]),
    programInfos:useState(c.programInfos||[])
  };
  var needsStatusMemo=["보류","중단","진행불가"].indexOf(st.bizStatus[0])>=0;
  var progs=props.programs||DEFAULT_PROGRAMS;
  function addProgramInfo(){
    var pid=Object.keys(progs)[0]||"youth_jump";
    var p=progs[pid]||{};
    st.programInfos[1](st.programInfos[0].concat([{id:uid(),programId:pid,programName:p.name||pid,year:p.year||new Date().getFullYear(),quota:"",applyDate:"",agreementDate:"",agencyName:"",memo:""}]));
  }
  function updateProgramInfo(idx,patch){
    var arr=st.programInfos[0].slice();arr[idx]=Object.assign({},arr[idx],patch);st.programInfos[1](arr);
  }
  function removeProgramInfo(idx){
    st.programInfos[1](st.programInfos[0].filter(function(_,i){return i!==idx;}));
  }
  function save(){
    if(!st.name[0].trim()){toast("업체명을 입력하세요","warn");return;}
    if(!isValidEmail(st.email[0])){toast("이메일 형식을 확인하세요","warn");return;}
    if(!isValidEmail(st.managerEmail[0])){toast("담당자 이메일 형식을 확인하세요","warn");return;}
    var data={};
    Object.keys(st).forEach(function(k){data[k]=st[k][0];});
    data.name=data.name.trim();
    props.onSave(data);
  }
  function toggleTag(tid){
    var cur=st.tags[0].slice();
    var i=cur.indexOf(tid);
    if(i>=0)cur.splice(i,1);else cur.push(tid);
    st.tags[1](cur);
  }
  return(
    <Modal open={props.open} onClose={props.onClose} title="🏢 업체 정보" width={560}>
      <div style={{display:"grid",gap:12}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><Label>업체명 *</Label><input style={inp} value={st.name[0]} onChange={function(e){st.name[1](e.target.value);}}/></div>
          <div><Label>사업자등록번호</Label><input style={inp} value={st.bizNo[0]} onChange={function(e){st.bizNo[1](fmtBizNo(e.target.value));}} placeholder="000-00-00000" inputMode="numeric"/></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><Label>대표자</Label><input style={inp} value={st.ceoName[0]} onChange={function(e){st.ceoName[1](e.target.value);}}/></div>
          <div><Label>법인구분</Label>
            <select style={inp} value={st.corpType[0]} onChange={function(e){st.corpType[1](e.target.value);}}>
              {["개인","법인"].map(function(t){return <option key={t}>{t}</option>;})}
            </select>
          </div>
        </div>
        {st.corpType[0]==="법인"&&<div><Label>주식회사 표기 위치</Label>
          <div style={{display:"flex",gap:4}}>
            {[["앞","(주)ABC"],["뒤","ABC(주)"],["","없음"]].map(function(arr){var on=st.juPosition[0]===arr[0];return(
              <button key={arr[0]} onClick={function(){st.juPosition[1](arr[0]);}} style={Object.assign({},btnSm,{flex:1,fontSize:11,background:on?"#DBEAFE":"#fff",color:on?"#2563EB":"#64748B",border:on?"2px solid #93C5FD":"1px solid #E2E8F0"})}>{arr[1]}</button>
            );})}
          </div>
        </div>}
        <div>
          <Label>주소</Label>
          <input style={inp} value={st.addr[0]} onChange={function(e){st.addr[1](e.target.value);}} placeholder="협약서·서류 원본 우편 발송에 사용됩니다"/>
          <div style={{fontSize:11,color:"#94A3B8",marginTop:4}}>📮 협약서 체결·서류 원본 보관·우편 발송에 필요하므로 정확히 입력해 주세요.</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><Label>전화</Label><input style={inp} value={st.phone[0]} onChange={function(e){st.phone[1](fmtPhone(e.target.value));}} inputMode="numeric" placeholder="02-000-0000"/></div>
          <div><Label>대표 이메일</Label><input type="email" style={inp} value={st.email[0]} onChange={function(e){st.email[1](e.target.value);}} placeholder="name@company.com"/></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          <div><Label>담당자명</Label><input style={inp} value={st.managerName[0]} onChange={function(e){st.managerName[1](e.target.value);}} placeholder="실무 담당자"/></div>
          <div><Label>담당자 직함</Label><input style={inp} value={st.managerTitle[0]} onChange={function(e){st.managerTitle[1](e.target.value);}} placeholder="과장·팀장 등"/></div>
          <div><Label>담당자 이메일</Label><input type="email" style={inp} value={st.managerEmail[0]} onChange={function(e){st.managerEmail[1](e.target.value);}} placeholder="manager@company.com"/></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          <div><Label>상시근로자 수</Label><input type="number" style={inp} value={st.empCount[0]} onChange={function(e){st.empCount[1](e.target.value);}}/></div>
          <div>
            <Label>업종</Label>
            <select style={inp} value={stBizTypeCustom[0]?"기타/직접입력":(st.bizType[0]||"")} onChange={function(e){var v=e.target.value;if(v==="기타/직접입력"){stBizTypeCustom[1](true);st.bizType[1]("");}else{stBizTypeCustom[1](false);st.bizType[1](v);}}}>
              <option value="">선택...</option>
              {INDUSTRY_OPTIONS.map(function(o){return <option key={o} value={o}>{o}</option>;})}
            </select>
            {stBizTypeCustom[0]&&<input style={Object.assign({},inp,{marginTop:4,fontSize:12})} value={st.bizType[0]} onChange={function(e){st.bizType[1](e.target.value);}} placeholder="업종 직접 입력"/>}
          </div>
          <div><Label>지역</Label>
            <select style={inp} value={st.region[0]} onChange={function(e){st.region[1](e.target.value);}}>
              <option value="수도권">수도권 (서울·경기·인천)</option>
              <option value="비수도권">비수도권</option>
            </select>
          </div>
        </div>
        <div>
          <button type="button" onClick={function(){stAdv[1](!stAdv[0]);}} style={{background:"none",border:"none",color:"#64748B",fontSize:12,cursor:"pointer",padding:"6px 0",display:"flex",alignItems:"center",gap:4}}>
            <span style={{display:"inline-block",transition:"transform 0.15s",transform:stAdv[0]?"rotate(90deg)":"none"}}>▶</span> 고급 정보 (고용보험 성립일 · 분야/유형)
          </button>
          {stAdv[0]&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:6,padding:10,background:"#F8FAFC",borderRadius:8,border:"1px solid #E2E8F0"}}>
              <div><Label>고용보험 성립일</Label><input type="date" style={inp} value={st.insuranceDate[0]} onChange={function(e){st.insuranceDate[1](e.target.value);}}/></div>
              <div><Label>분야/유형</Label><input style={inp} value={st.sector[0]} onChange={function(e){st.sector[1](e.target.value);}}/></div>
            </div>
          )}
        </div>
        {/* 청년일자리도약장려금 진행 정보 */}
        <div style={{padding:"12px 14px",background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:10}}>
          <div style={{fontSize:13,fontWeight:700,color:"#1D4ED8",marginBottom:10}}>⭐ 청년일자리도약장려금 진행 정보</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><Label>기업 지원한도 인원수</Label><input type="number" min="0" style={inp} value={st.youthQuota[0]} onChange={function(e){st.youthQuota[1](e.target.value);}} placeholder="예: 5"/></div>
            <div><Label>급여일 (매월)</Label><input type="number" min="1" max="31" style={inp} value={st.payday[0]} onChange={function(e){st.payday[1](e.target.value);}} placeholder="예: 25"/></div>
            <div><Label>참여신청일</Label><input type="date" style={inp} value={st.youthApplyDate[0]} onChange={function(e){st.youthApplyDate[1](e.target.value);}}/></div>
            <div><Label>협약일</Label><input type="date" style={inp} value={st.agreementDate[0]} onChange={function(e){st.agreementDate[1](e.target.value);}}/></div>
          </div>
          {!st.agreementDate[0]&&<div style={{fontSize:11,color:"#B45309",marginTop:8,padding:"6px 10px",background:"#FFFBEB",borderRadius:6,border:"1px solid #FDE68A"}}>⚠️ 협약 체결 전에는 실제 신청 진행이 제한될 수 있습니다.</div>}
        </div>
        {/* 지원금별 진행 정보 (programInfos) */}
        <div style={{padding:"14px 16px",background:"#F0F9FF",borderRadius:12,border:"1px solid #BAE6FD"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:13,fontWeight:700,color:"#0284C7"}}>📋 지원금별 진행 정보 (범용)</div>
            <button style={Object.assign({},btnSm,{fontSize:13,background:"#0284C7",color:"#fff",border:"none",padding:"5px 12px"})} onClick={addProgramInfo}>+ 추가</button>
          </div>
          {st.programInfos[0].length===0&&(
            <div style={{fontSize:12,color:"#64748B",padding:"6px 0",textAlign:"center"}}>추가 버튼을 눌러 지원금별 협약·한도 정보를 등록하세요 (청년도약 이외 지원금도 지원)</div>
          )}
          {st.programInfos[0].map(function(info,idx){
            return(
              <div key={info.id||idx} style={{background:"#fff",borderRadius:10,border:"1px solid #BAE6FD",padding:"12px 14px",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,gap:8}}>
                  <select value={info.programId} onChange={function(e){var pid=e.target.value;var pp=progs[pid]||{};updateProgramInfo(idx,{programId:pid,programName:pp.name||pid,year:pp.year||new Date().getFullYear()});}}
                    style={Object.assign({},inp,{fontSize:13,padding:"8px 12px",flex:1})}>
                    {Object.values(progs).map(function(pp){return <option key={pp.id} value={pp.id}>{pp.name}</option>;})}
                  </select>
                  <button onClick={function(){removeProgramInfo(idx);}} style={{background:"none",border:"none",color:"#94A3B8",cursor:"pointer",fontSize:18,padding:"4px 6px",flexShrink:0}} title="삭제">🗑️</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div><Label>연도</Label><input type="number" style={Object.assign({},inp,{fontSize:13,padding:"8px 12px"})} value={info.year||""} onChange={function(e){updateProgramInfo(idx,{year:Number(e.target.value)||0});}} placeholder="2026"/></div>
                  <div><Label>지원한도 (인원)</Label><input type="number" style={Object.assign({},inp,{fontSize:13,padding:"8px 12px"})} value={info.quota||""} onChange={function(e){updateProgramInfo(idx,{quota:e.target.value});}} placeholder="3"/></div>
                  <div><Label>사전신청일</Label><input type="date" style={Object.assign({},inp,{fontSize:13,padding:"8px 12px"})} value={info.applyDate||""} onChange={function(e){updateProgramInfo(idx,{applyDate:e.target.value});}}/></div>
                  <div><Label>협약 체결일</Label><input type="date" style={Object.assign({},inp,{fontSize:13,padding:"8px 12px"})} value={info.agreementDate||""} onChange={function(e){updateProgramInfo(idx,{agreementDate:e.target.value});}}/></div>
                  <div><Label>운영기관명</Label><input style={Object.assign({},inp,{fontSize:13,padding:"8px 12px"})} value={info.agencyName||""} onChange={function(e){updateProgramInfo(idx,{agencyName:e.target.value});}} placeholder="고용센터명"/></div>
                  <div><Label>메모</Label><input style={Object.assign({},inp,{fontSize:13,padding:"8px 12px"})} value={info.memo||""} onChange={function(e){updateProgramInfo(idx,{memo:e.target.value});}} placeholder="진행 메모"/></div>
                </div>
              </div>
            );
          })}
          <div style={{fontSize:11,color:"#0369A1",marginTop:st.programInfos[0].length>0?8:0,lineHeight:1.5}}>💡 직원 등록 시 이 정보로 한도·협약 상태가 자동 표시됩니다. 청년도약은 위 개별 항목도 fallback으로 참조됩니다.</div>
        </div>
        {/* 업체 진행 상태 */}
        <div>
          <Label>업체 진행 상태</Label>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {["정상","보류","중단","확인 필요","진행 불가","기타"].map(function(s){var on=st.bizStatus[0]===s;var danger=["보류","중단","진행 불가"].indexOf(s)>=0;return(
              <button key={s} onClick={function(){st.bizStatus[1](s);}} style={Object.assign({},btnSm,{fontSize:13,background:on?(danger?"#FEE2E2":s==="확인 필요"?"#FEF3C7":"#DBEAFE"):"#fff",color:on?(danger?"#DC2626":s==="확인 필요"?"#B45309":"#2563EB"):"#64748B",border:on?"2px solid "+(danger?"#FECACA":s==="확인 필요"?"#FDE68A":"#93C5FD"):"1px solid #E2E8F0"})}>{s}</button>
            );})}
          </div>
          {st.bizStatus[0]==="기타"&&<input style={Object.assign({},inp,{marginTop:6})} value={st.customStatus[0]} onChange={function(e){st.customStatus[1](e.target.value);}} placeholder="상태 직접 입력"/>}
          {needsStatusMemo&&<textarea style={Object.assign({},inp,{height:50,resize:"none",marginTop:6})} value={st.statusMemo[0]} onChange={function(e){st.statusMemo[1](e.target.value);}} placeholder="보류·중단·진행불가 사유를 입력하세요"/>}
        </div>
        <div>
          <Label>태그</Label>
          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:4}}>
            {TAGS.map(function(tag){var on=(st.tags[0]||[]).includes(tag.id);return(
              <button key={tag.id} onClick={function(){toggleTag(tag.id);}}
                style={{padding:"4px 10px",borderRadius:6,fontSize:11,cursor:"pointer",background:on?tag.bg:"#fff",color:on?tag.color:"#64748B",border:on?"1.5px solid "+tag.color:"1px solid #E2E8F0",fontWeight:on?600:400}}>
                {tag.label}
              </button>
            );})}
          </div>
        </div>
        <div><Label>메모</Label><textarea style={Object.assign({},inp,{height:60,resize:"none"})} value={st.memo[0]} onChange={function(e){st.memo[1](e.target.value);}}/></div>
        <div style={{display:"flex",gap:8,justifyContent:"space-between",alignItems:"center",flexWrap:"wrap"}}>
          <div>
            {props.onDelete&&props.company&&props.company.id&&(
              <button style={Object.assign({},btnS,{color:"#DC2626",border:"1px solid #FECACA"})} onClick={function(){if(window.confirm("'"+(props.company.name||"")+"' 업체를 삭제하시겠습니까?\n해당 업체의 직원·서류·정산 내역이 기본 목록에서 함께 보이지 않게 됩니다."))props.onDelete(props.company.id);}}>🗑️ 업체 삭제</button>
            )}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button style={btnS} onClick={props.onClose}>취소</button>
            <button style={Object.assign({},btnP,{padding:"10px 28px"})} onClick={save}>업체 저장</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── ProgramsList ──────────────────────────────────────────
function ProgramsList(props){
  var programs=props.programs,onUpdate=props.onUpdate;
  var st1=useState(false); // modal open
  var st2=useState(null);  // edit target (null=신규 커스텀)
  var st={
    name:useState(""),
    group:useState("커스텀"),
    year:useState(2026),
    totalAmount:useState(""),
    desc:useState(""),
    note:useState(""),
    applyUrl:useState(""),
    rounds:useState([])  // [{month,label,amount}]
  };
  function openNew(){st2[1](null);st.name[1]("");st.group[1]("커스텀");st.year[1](2026);st.totalAmount[1]("");st.desc[1]("");st.note[1]("");st.applyUrl[1]("");st.rounds[1]([{month:6,label:"1회차",amount:0}]);st1[1](true);}
  function openEdit(p){st2[1](p);st.name[1](p.name||"");st.group[1](p.group||"커스텀");st.year[1](p.year||2026);st.totalAmount[1](p.totalAmount||"");st.desc[1](p.desc||"");st.note[1](p.note||"");st.applyUrl[1](p.applyUrl||"");st.rounds[1]((p.rounds||[]).map(function(r){return{month:r.month,label:r.label||"",amount:r.expectedAmount||r.amount||0};}));st1[1](true);}
  function setRound(i,field,val){var rs=st.rounds[0].slice();rs[i]=Object.assign({},rs[i],{[field]:val});st.rounds[1](rs);}
  function addRound(){st.rounds[1](st.rounds[0].concat([{month:12,label:(st.rounds[0].length+1)+"회차",amount:0}]));}
  function delRound(i){st.rounds[1](st.rounds[0].filter(function(_,idx){return idx!==i;}));}
  function autoTotal(){var sum=st.rounds[0].reduce(function(s,r){return s+(Number(r.amount)||0);},0);st.totalAmount[1](sum);}
  function save(){
    if(!st.name[0].trim()){toast("지원금명을 입력하세요","warn");return;}
    var existing=st2[0]||{};
    var rounds=st.rounds[0].map(function(r,i){var amt=Number(r.amount)||0;return Object.assign({},existing.rounds&&existing.rounds[i]?existing.rounds[i]:{},{month:Number(r.month)||0,label:r.label||((i+1)+"회차"),expectedAmount:amt,amount:amt});});
    var total=Number(st.totalAmount[0])||rounds.reduce(function(s,r){return s+r.amount;},0);
    var newP=Object.assign({},existing,{
      id:existing.id||("custom_"+uid()),
      name:st.name[0].trim(),
      group:existing.group||"커스텀",
      year:Number(st.year[0])||2026,
      totalAmount:total,
      desc:st.desc[0],
      note:st.note[0],
      applyUrl:st.applyUrl[0],
      color:existing.color||GROUP_COLORS[existing.group||"커스텀"].base,
      rounds:rounds,
      companyDocs:existing.companyDocs||[],
      employeeDocs:existing.employeeDocs||[]
    });
    var updated=Object.assign({},programs);
    updated[newP.id]=newP;
    onUpdate(updated);
    st1[1](false);st2[1](null);
  }
  function deleteCustom(pid){
    if(!window.confirm("이 지원금을 목록에서 삭제할까요?"))return;
    var updated=Object.assign({},programs);
    delete updated[pid];
    onUpdate(updated);
  }
  function resetBuiltins(){
    if(!window.confirm("기본 지원금을 처음 상태로 되돌립니다. (직접 추가한 커스텀은 유지) 진행할까요?"))return;
    var updated=Object.assign({},programs);
    Object.keys(DEFAULT_PROGRAMS).forEach(function(id){updated[id]=DEFAULT_PROGRAMS[id];});
    onUpdate(updated);
  }
  function toggleEnabled(pid){
    var updated=Object.assign({},programs);
    var p=updated[pid];
    updated[pid]=Object.assign({},p,{enabled:p.enabled===false?true:false});
    onUpdate(updated);
  }
  var enabledCount=Object.values(programs).filter(function(p){return p.enabled!==false;}).length;
  return(
    <div className="fade-in">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:8}}>
        <div style={{minWidth:0}}>
          <h2 style={{margin:"0 0 4px",fontSize:FS_PAGE_TITLE,fontWeight:800}}>⚙️ 지원금 관리</h2>
          <p style={{margin:0,fontSize:FS_BODY,color:"#64748B",lineHeight:1.6}}>활성화된 지원금 <strong style={{color:"#2563EB"}}>{enabledCount}개</strong>만 직원 추가 화면에 표시됩니다. ON/OFF로 노출을 제어하세요.</p>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button style={btnS} onClick={resetBuiltins}>↺ 기본값 복원</button>
          <button style={btnP} className="hover-lift" onClick={openNew}>+ 커스텀 지원금 추가</button>
        </div>
      </div>
      <div style={{padding:"10px 14px",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:8,marginBottom:14,fontSize:12,color:"#92400E"}}>
        ⭐ <strong>청년일자리도약장려금</strong>이 기본 추천 지원금입니다. 2026년에도 예산이 유지되며 청년 채용 기업의 신청 실적이 가장 높습니다.
      </div>
      <Notice>금액·회차·신청처는 매년 공고에 따라 바뀝니다. 카드의 <b>편집</b>으로 직접 수정하면 내 계정에 저장됩니다. 기본 지원금도 모두 수정 가능합니다.</Notice>
      {["신규채용","재직자유지","육아","커스텀"].map(function(grp){
        var items=Object.values(programs).filter(function(p){return p.group===grp;});
        if(!items.length)return null;
        var gp=GROUP_COLORS[grp]||GROUP_COLORS["커스텀"];
        return(
          <div key={grp} style={{marginBottom:22}}>
            <div style={{fontSize:FS_CARD_TITLE,fontWeight:700,color:gp.dark,marginBottom:10,padding:"6px 12px",borderRadius:8,background:gp.badge,display:"inline-block"}}>{gp.icon} {grp} <span style={{fontWeight:400,opacity:0.7}}>({items.length}개)</span></div>
            <div style={{display:"grid",gap:10}}>
              {items.map(function(p){
                var isCustom=!DEFAULT_PROGRAMS[p.id];
                var isEnabled=p.enabled!==false;
                var isYouth=p.id==="youth_jump";
                return(
                  <Card key={p.id} className="hover-card" style={{padding:"16px 18px",border:"1.5px solid "+(isEnabled?gp.light:"#E2E8F0"),opacity:isEnabled?1:0.65}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
                      <div style={{flex:1,minWidth:180}}>
                        <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:6,flexWrap:"wrap"}}>
                          <span style={{fontSize:FS_CARD_TITLE,fontWeight:700,wordBreak:"keep-all"}}>{p.name}</span>
                          {p.year&&<Badge color="#475569" bg="#F1F5F9">{p.year}년</Badge>}
                          {isYouth&&<Badge color="#D97706" bg="#FEF3C7">⭐ 추천</Badge>}
                          {isCustom&&<Badge color={gp.text} bg={gp.badge}>커스텀</Badge>}
                          <Badge color={gp.dark} bg={gp.light}>{fMan(p.totalAmount||0)}</Badge>
                          {!isEnabled&&<Badge color="#94A3B8" bg="#F1F5F9">비활성</Badge>}
                        </div>
                        {p.desc&&<div style={{fontSize:FS_BODY,color:"#64748B",marginBottom:8,lineHeight:1.5}}>{p.desc}</div>}
                        <div style={{display:"flex",gap:12,fontSize:FS_BODY,color:"#475569",flexWrap:"wrap"}}>
                          <span>🔢 {(p.rounds||[]).length}회차</span>
                          <span>📅 {(p.rounds||[]).map(function(r){return r.month+"개월";}).join(", ")}</span>
                          {p.applyUrl&&<span style={{color:"#2563EB"}}>📍 {p.applyUrl}</span>}
                        </div>
                      </div>
                      <div style={{display:"flex",gap:6,flexShrink:0,alignItems:"center"}}>
                        <button onClick={function(){toggleEnabled(p.id);}} style={{padding:"6px 14px",borderRadius:20,fontSize:FS_BADGE,fontWeight:700,cursor:"pointer",border:"none",background:isEnabled?"#D1FAE5":"#F1F5F9",color:isEnabled?"#059669":"#64748B",minWidth:46}}>
                          {isEnabled?"ON":"OFF"}
                        </button>
                        <button style={btnSm} onClick={function(){openEdit(p);}}>편집</button>
                        {isCustom&&<button style={Object.assign({},btnSm,{color:"#DC2626",border:"1px solid #FECACA"})} onClick={function(){deleteCustom(p.id);}}>삭제</button>}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
      <Modal open={st1[0]} onClose={function(){st1[1](false);st2[1](null);}} title={(st2[0]?"지원금 편집":"커스텀 지원금 추가")} width={560}>
        <div style={{display:"grid",gap:16}}>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:12}}>
            <div><Label>지원금명 *</Label><input style={inp} value={st.name[0]} onChange={function(e){st.name[1](e.target.value);}}/></div>
            <div><Label>적용연도</Label><input type="number" min="2020" max="2030" style={inp} value={st.year[0]} onChange={function(e){st.year[1](e.target.value);}} placeholder="2026"/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><Label>총 지원금액(원)</Label><input type="number" style={inp} value={st.totalAmount[0]} onChange={function(e){st.totalAmount[1](e.target.value);}} placeholder="7200000"/></div>
            <div><Label>신청처/URL</Label><input style={inp} value={st.applyUrl[0]} onChange={function(e){st.applyUrl[1](e.target.value);}} placeholder="고용24(work24.go.kr)"/></div>
          </div>
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <Label>회차별 지급 (입사 후 개월 · 금액)</Label>
              <button style={Object.assign({},btnSm,{fontSize:14})} onClick={autoTotal} title="회차 금액 합계를 총액에 반영">∑ 합계→총액</button>
            </div>
            <div style={{display:"grid",gap:8}}>
              {st.rounds[0].map(function(r,i){return(
                <div key={i} style={{display:"grid",gridTemplateColumns:"90px 1fr 130px 40px",gap:8,alignItems:"center"}}>
                  <input type="number" style={Object.assign({},inp,{fontSize:16,padding:"9px 10px"})} value={r.month} onChange={function(e){setRound(i,"month",e.target.value);}} placeholder="개월"/>
                  <input style={Object.assign({},inp,{fontSize:16,padding:"9px 10px"})} value={r.label} onChange={function(e){setRound(i,"label",e.target.value);}} placeholder={"라벨 (예: "+(i+1)+"차)"}/>
                  <input type="number" style={Object.assign({},inp,{fontSize:16,padding:"9px 10px"})} value={r.amount} onChange={function(e){setRound(i,"amount",e.target.value);}} placeholder="금액"/>
                  <button style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer",fontSize:18}} onClick={function(){delRound(i);}} title="회차 삭제">🗑️</button>
                </div>
              );})}
            </div>
            <button style={Object.assign({},btnSm,{fontSize:15,marginTop:8})} onClick={addRound}>+ 회차 추가</button>
          </div>
          <div><Label>한줄 설명</Label><input style={inp} value={st.desc[0]} onChange={function(e){st.desc[1](e.target.value);}} placeholder="목록 카드에 표시되는 짧은 설명"/></div>
          <div><Label>상세 안내 / 비고</Label><textarea style={Object.assign({},inp,{height:90,resize:"vertical",fontSize:17,lineHeight:1.6})} value={st.note[0]} onChange={function(e){st.note[1](e.target.value);}} placeholder="자격요건·예산·주의사항 등 (진단·상세에 표시)"/></div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button style={btnS} onClick={function(){st1[1](false);st2[1](null);}}>취소</button>
            <button style={Object.assign({},btnP,{padding:"12px 32px"})} onClick={save}>저장</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Main SubsidyApp export ────────────────────────────────
// ── 사이드바 네비 아이템 ──────────────────────────────────
// ── 재사용: 스파크라인 ────────────────────────────────────
function Sparkline(props){
  var data=props.data||[]; var w=props.width||72; var h=props.height||26; var color=props.color||"#2563EB";
  if(data.length<2||data.every(function(v){return v===0;})){return <svg width={w} height={h}><line x1="0" y1={h-2} x2={w} y2={h-2} stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round"/></svg>;}
  var max=Math.max.apply(null,data)||1; var min=Math.min.apply(null,data);
  var range=max-min||1; var step=w/(data.length-1);
  var pts=data.map(function(v,i){var x=i*step; var y=h-2-((v-min)/range)*(h-6); return x.toFixed(1)+","+y.toFixed(1);});
  var lastX=(data.length-1)*step; var lastV=data[data.length-1]; var lastY=h-2-((lastV-min)/range)*(h-6);
  var areaPts="0,"+(h)+" "+pts.join(" ")+" "+lastX.toFixed(1)+","+h;
  var gid="spg"+Math.round(Math.random()*1e6);
  return(<svg width={w} height={h} style={{display:"block"}}>
    <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.22"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
    <polygon points={areaPts} fill={"url(#"+gid+")"}/>
    <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
    <circle cx={lastX.toFixed(1)} cy={lastY.toFixed(1)} r="2.6" fill={color}/>
  </svg>);
}

// ── 재사용: 트렌드 화살표 ─────────────────────────────────
function TrendChip(props){
  var pct=props.pct; if(pct===null||pct===undefined||!isFinite(pct))return null;
  var up=pct>0, flat=pct===0;
  var arrow=flat?"→":(up?"▲":"▼");
  // 진한 배경 카드 위에서는 흰색 반투명 칩으로 표시
  if(props.onDark){
    return <span style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:14,fontWeight:700,color:"#fff",background:"rgba(255,255,255,0.20)",padding:"2px 8px",borderRadius:20}}>{arrow} {Math.abs(pct)}%</span>;
  }
  var color=flat?"#94A3B8":(up?"#059669":"#DC2626"); var bg=flat?"#F1F5F9":(up?"#ECFDF5":"#FEF2F2");
  return <span style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:14,fontWeight:700,color:color,background:bg,padding:"2px 8px",borderRadius:20}}>{arrow} {Math.abs(pct)}%</span>;
}

// ── 재사용: 알림 인박스 (벨) ──────────────────────────────
var PRIO_META=[{key:0,label:"긴급",color:"#DC2626",bg:"#FEF2F2"},{key:1,label:"주의",color:"#475569",bg:"#F1F5F9"},{key:2,label:"일반",color:"#2563EB",bg:"#EFF6FF"}];
function NotifBell(props){
  var ddayLimit=(props.settings&&props.settings.ddayAlert)||7;
  var st=useState(false); var open=st[0],setOpen=st[1];
  var feat=props.tier?props.tier.feat:{commission:true};
  var stDismiss=useState(function(){try{return JSON.parse(localStorage.getItem("subsidy_dismissed_alerts")||"[]");}catch(e){return [];}});
  function dismiss(id){ var nx=stDismiss[0].concat([id]); stDismiss[1](nx); try{localStorage.setItem("subsidy_dismissed_alerts",JSON.stringify(nx));}catch(e){} toast("알림을 처리 완료했습니다.","success"); }

  var alerts=useMemo(function(){
    var list=[];
    (props.companies||[]).forEach(function(c){
      var emps=(props.employees||[]).filter(function(e){return e.companyId===c.id&&e.status!=="resigned";});
      emps.forEach(function(emp){
        var program=(props.programs||{})[emp.programId];
        if(emp.startDate&&program){
          (emp.rounds||[]).forEach(function(r,ri){
            if(r.isPaid)return;
            var dd=getDday(addMo(emp.startDate,r.month)); if(dd===null)return;
            var amt=r.expectedAmount||r.amount||0;
            if(dd<0)list.push({id:emp.id+"-"+ri+"-od",type:"신청 기한 지연",prio:0,companyId:c.id,companyName:c.name,empName:emp.name,progName:program.name,text:r.label+" 신청 기한 "+Math.abs(dd)+"일 경과",amount:amt,dd:dd});
            else if(dd<=ddayLimit)list.push({id:emp.id+"-"+ri+"-due",type:"신청 가능일 도래",prio:1,companyId:c.id,companyName:c.name,empName:emp.name,progName:program.name,text:r.label+" "+formatDday(dd)+" · 곧 신청 가능",amount:amt,dd:dd});
          });
        }
        if(emp.salary){var w=checkWage(emp.salary,emp.weeklyHours||40);if(w&&!w.isAboveMin)list.push({id:emp.id+"-mw",type:"최저임금 미달",prio:1,companyId:c.id,companyName:c.name,empName:emp.name,progName:program?program.name:"",text:"환산 시급 "+w.hourlyWage.toLocaleString()+"원 — 최저임금 미달",amount:0,dd:null});else if(w&&!w.isAboveFloor)list.push({id:emp.id+"-fl",type:"월보수 기준 미달",prio:1,companyId:c.id,companyName:c.name,empName:emp.name,progName:program?program.name:"",text:"월보수 124만원 미만 — 지원금 제외 위험",amount:0,dd:null});}
      });
      var docMiss=0; emps.forEach(function(e){(e.employeeDocs||[]).forEach(function(d){if(!docIsDone(d))docMiss++;});}); (c.companyDocs||[]).forEach(function(d){if(!docIsDone(d))docMiss++;});
      if(docMiss>0)list.push({id:c.id+"-docs-"+docMiss,type:"서류 미제출",prio:2,companyId:c.id,companyName:c.name,empName:"",progName:"",text:"미제출 서류 "+docMiss+"건 — 요청 필요",amount:0,dd:null});
      if(feat.commission){
        var cc=c.commission||{}; var rate=cc.rate!=null?cc.rate:10; var ret=cc.retainer||0;
        var rcv=0; emps.forEach(function(e){(e.rounds||[]).forEach(function(r){if(r.isPaid)rcv+=r.received||0;});});
        var billable=Math.round(ret+rcv*rate/100);
        if(billable>0&&!cc.billed)list.push({id:c.id+"-ub-"+billable,type:"수수료 미청구",prio:2,companyId:c.id,companyName:c.name,empName:"",progName:"",text:"청구 가능 수수료 "+fMan(billable)+" 미청구",amount:billable,dd:null});
        else if(cc.billed&&!cc.paid)list.push({id:c.id+"-up-"+billable,type:"수수료 미입금",prio:1,companyId:c.id,companyName:c.name,empName:"",progName:"",text:"청구한 수수료 "+fMan(billable)+" 미입금",amount:billable,dd:null});
      }
    });
    return list.filter(function(a){return stDismiss[0].indexOf(a.id)<0;}).sort(function(a,b){return a.prio-b.prio||((a.dd===null?999:a.dd)-(b.dd===null?999:b.dd));});
  },[props.employees,props.companies,props.programs,ddayLimit,stDismiss[0],feat.commission]);

  var urgent=alerts.filter(function(a){return a.prio===0;}).length;
  function go(a){props.goCompany(a.companyId);setOpen(false);}

  return(<div style={{position:"relative"}}>
    <button onClick={function(){setOpen(!open);}} title="알림센터" style={{position:"relative",background:open?"#EFF6FF":"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:10,width:48,height:48,fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
      🔔
      {alerts.length>0&&<span style={{position:"absolute",top:-6,right:-6,minWidth:22,height:22,padding:"0 5px",borderRadius:11,background:urgent>0?"#DC2626":"#475569",color:"#fff",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 6px rgba(0,0,0,0.2)"}}>{alerts.length>99?"99+":alerts.length}</span>}
    </button>
    {open&&<div onClick={function(){setOpen(false);}} style={{position:"fixed",inset:0,zIndex:300}}/>}
    {open&&(
      <div className="slide-in" style={{position:"absolute",right:0,top:58,width:400,maxWidth:"92vw",background:"#fff",borderRadius:14,boxShadow:"0 16px 48px rgba(15,23,42,0.20)",border:"1px solid #E2E8F0",zIndex:301,overflow:"hidden"}}>
        <div style={{padding:"14px 18px",borderBottom:"1px solid #F1F5F9",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:17,fontWeight:800,color:"#1E293B"}}>🔔 알림센터</span>
          <span style={urgent>0?dangerBadge():neutralBadge()}>{alerts.length}건</span>
        </div>
        <div style={{maxHeight:440,overflow:"auto"}}>
          {alerts.length===0?(
            <div style={{padding:"40px 20px",textAlign:"center"}}>
              <div style={{fontSize:38,marginBottom:8}}>✅</div>
              <div style={{fontSize:15,color:"#64748B"}}>처리할 알림이 없습니다.</div>
            </div>
          ):PRIO_META.map(function(pm){
            var group=alerts.filter(function(a){return a.prio===pm.key;});
            if(group.length===0)return null;
            return(<div key={pm.key}>
              <div style={{padding:"8px 18px",background:"#FAFBFC",borderBottom:"1px solid #F1F5F9",display:"flex",alignItems:"center",gap:6}}>
                <span style={{width:8,height:8,borderRadius:4,background:pm.color,display:"inline-block"}}/>
                <span style={{fontSize:13,fontWeight:700,color:pm.color}}>{pm.label}</span>
                <span style={{fontSize:12,color:"#94A3B8"}}>{group.length}건</span>
              </div>
              {group.map(function(a){return(
                <div key={a.id} style={{padding:"11px 18px",borderBottom:"1px solid #F8FAFC"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                    <span style={{fontSize:11,fontWeight:700,padding:"1px 7px",borderRadius:5,background:pm.bg,color:pm.color}}>{a.type}</span>
                    {a.dd!==null&&<DdayBadge dday={a.dd}/>}
                    {a.amount>0&&<span style={{fontSize:13,fontWeight:700,color:"#2563EB",marginLeft:"auto"}}>{fMan(a.amount)}</span>}
                  </div>
                  <div style={{fontSize:14,fontWeight:600,color:"#1E293B"}}>{a.empName?a.empName+" · ":""}<span style={{color:"#64748B",fontWeight:400}}>{a.companyName}</span></div>
                  <div style={{fontSize:13,color:"#64748B",marginTop:1}}>{a.progName?a.progName+" · ":""}{a.text}</div>
                  <div style={{display:"flex",gap:6,marginTop:8}}>
                    <button onClick={function(){go(a);}} style={{flex:1,background:"#EFF6FF",border:"1px solid #BFDBFE",color:"#1D4ED8",borderRadius:7,padding:"6px 0",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:FF}}>바로가기</button>
                    <button onClick={function(){dismiss(a.id);}} style={{flex:1,background:"#F1F5F9",border:"1px solid #E2E8F0",color:"#64748B",borderRadius:7,padding:"6px 0",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:FF}}>처리 완료</button>
                  </div>
                </div>
              );})}
            </div>);
          })}
        </div>
      </div>
    )}
  </div>);
}

// 샘플 데이터: startOff(입사 N개월 전)·ds(일 단위 보정)로 표현 → loadSampleData에서
// 실행 시점 기준 실제 날짜로 변환. 항상 "지연 3건·신청 임박 5건"이 살아있는 데모가 됨.
var SAMPLE_DATA = [
  {
    company:{isSample:true,name:"한라식품 주식회사",bizNo:"617-81-23456",ceoName:"박성준",addr:"경남 김해시 주촌면 골든루트로 80",region:"비수도권",corpType:"법인",bizType:"식품 제조업",empCount:18,phone:"055-321-7700",email:"hr@hanlafood.co.kr",commission:{rate:10,billed:true,paid:false,taxInvoice:false,successFee:true},
      notes:[{id:"sn1",text:"청년채용 사전신청 완료. 이서연 2차(6개월) 신청기한 경과 — 즉시 보완서류 확인 필요.",at:"2026-05-20T09:10:00.000Z",author:"담당 컨설턴트"}],companyDocs:[]},
    employees:[
      {isSample:true,name:"박준혁",birthDate:"1999-03-15",gender:"male",programId:"youth_jump",status:"inprogress",totalExpected:7200000,startOff:9,ds:4,
        rounds:[{month:6,amount:3600000,label:"1차(6개월)",isPaid:true,paidOff:3,received:3600000},{month:9,amount:1800000,label:"2차(9개월)"},{month:12,amount:1800000,label:"3차(12개월)"}],
        employeeDocs:[{label:"근로계약서",done:true,files:[]},{label:"임금대장(6개월)",done:true,files:[]},{label:"급여이체확인서류",done:true,files:[]},{label:"개인정보동의서(근로자)",done:false,files:[]},{label:"최종학력확인서(졸업증명서)",done:true,files:[]}]},
      {isSample:true,name:"이서연",birthDate:"1996-08-22",gender:"female",programId:"regular_convert",status:"inprogress",totalExpected:7200000,startOff:7,ds:-8,
        rounds:[{month:3,amount:1800000,label:"1차(3개월)",isPaid:true,paidOff:4,received:1800000},{month:6,amount:1800000,label:"2차(6개월)"},{month:9,amount:1800000,label:"3차(9개월)"},{month:12,amount:1800000,label:"4차(12개월)"}],
        employeeDocs:[{label:"전환 전 근로계약서",done:true,files:[]},{label:"전환 후 근로계약서",done:true,files:[]},{label:"월별임금대장",done:false,files:[]}]},
      {isSample:true,name:"김도현",birthDate:"2001-01-09",gender:"male",programId:"youth_jump",status:"submitted",totalExpected:7200000,startOff:2,ds:0,
        rounds:[{month:6,amount:3600000,label:"1차(6개월)"},{month:9,amount:1800000,label:"2차(9개월)"},{month:12,amount:1800000,label:"3차(12개월)"}],
        employeeDocs:[{label:"근로계약서",done:true,files:[]},{label:"임금대장(6개월)",done:false,files:[]},{label:"급여이체확인서류",done:false,files:[]},{label:"개인정보동의서(근로자)",done:false,files:[]}]},
      {isSample:true,name:"한지민",birthDate:"1990-06-30",gender:"female",programId:"emp_promo",status:"reviewing",totalExpected:7200000,startOff:6,ds:6,
        rounds:[{month:6,amount:3600000,label:"1회차(6개월)"},{month:12,amount:3600000,label:"2회차(12개월)"}],
        employeeDocs:[{label:"근로계약서",done:true,files:[]},{label:"월별급여대장",done:false,files:[]},{label:"급여이체증빙",done:false,files:[]},{label:"취업지원프로그램 이수증",done:true,files:[]}]}
    ]
  },
  {
    company:{isSample:true,name:"서울테크솔루션",bizNo:"129-86-45012",ceoName:"정재훈",addr:"서울 강남구 테헤란로 415, 12층",region:"수도권",corpType:"법인",bizType:"소프트웨어 개발",empCount:11,phone:"02-557-2200",email:"people@seoultech.io",
      notes:[{id:"sn2",text:"정우성 2차(9개월) 신청 임박. 임금대장·이체확인서 수령 완료, 신청서만 제출하면 됨.",at:"2026-06-01T01:30:00.000Z",author:"담당 컨설턴트"}],companyDocs:[]},
    employees:[
      {isSample:true,name:"정우성",birthDate:"1998-11-02",gender:"male",programId:"youth_jump",status:"inprogress",totalExpected:7200000,startOff:9,ds:1,
        rounds:[{month:6,amount:3600000,label:"1차(6개월)",isPaid:true,paidOff:3,received:3600000},{month:9,amount:1800000,label:"2차(9개월)"},{month:12,amount:1800000,label:"3차(12개월)"}],
        employeeDocs:[{label:"근로계약서",done:true,files:[]},{label:"임금대장(6개월)",done:true,files:[]},{label:"급여이체확인서류",done:true,files:[]},{label:"개인정보동의서(근로자)",done:false,files:[]}]},
      {isSample:true,name:"강민재",birthDate:"2000-05-19",gender:"male",programId:"work_exp",status:"completed",totalExpected:1400000,startOff:6,ds:0,
        rounds:[{month:1,amount:200000,label:"1개월",isPaid:true,paidOff:5,received:200000},{month:2,amount:200000,label:"2개월",isPaid:true,paidOff:4,received:200000},{month:3,amount:200000,label:"3개월",isPaid:true,paidOff:3,received:200000},{month:4,amount:200000,label:"4개월",isPaid:true,paidOff:2,received:200000}],
        employeeDocs:[{label:"참여신청서",done:true,files:[]},{label:"출근부",done:true,files:[]},{label:"수당지급확인서",done:true,files:[]}]},
      {isSample:true,name:"오세훈",birthDate:"2002-02-14",gender:"male",programId:"work_exp",status:"inprogress",totalExpected:1400000,startOff:3,ds:2,
        rounds:[{month:1,amount:200000,label:"1개월",isPaid:true,paidOff:2,received:200000},{month:2,amount:200000,label:"2개월",isPaid:true,paidOff:1,received:200000},{month:3,amount:200000,label:"3개월"},{month:4,amount:200000,label:"4개월"}],
        employeeDocs:[{label:"참여신청서",done:true,files:[]},{label:"출근부",done:true,files:[]},{label:"수당지급확인서",done:false,files:[]}]},
      {isSample:true,name:"신예은",birthDate:"1997-07-08",gender:"female",programId:"regular_convert",status:"approved",totalExpected:7200000,startOff:4,ds:3,
        rounds:[{month:3,amount:1800000,label:"1차(3개월)",isPaid:true,paidOff:1,received:1800000},{month:6,amount:1800000,label:"2차(6개월)"},{month:9,amount:1800000,label:"3차(9개월)"},{month:12,amount:1800000,label:"4차(12개월)"}],
        employeeDocs:[{label:"전환 전 근로계약서",done:true,files:[]},{label:"전환 후 근로계약서",done:true,files:[]},{label:"월별임금대장",done:false,files:[]}]}
    ]
  },
  {
    company:{isSample:true,name:"더좋은푸드",bizNo:"105-23-67891",ceoName:"오세라",addr:"서울 마포구 양화로 45, 2층",region:"수도권",corpType:"법인",bizType:"외식업(프랜차이즈)",empCount:7,phone:"02-336-1180",email:"admin@thebetterfood.kr",commission:{rate:12,billed:true,paid:true,taxInvoice:true,successFee:true,memo:"성공보수 12% 계약 · 세금계산서 발행 완료"},
      notes:[],companyDocs:[]},
    employees:[
      {isSample:true,name:"오하린",birthDate:"1989-09-25",gender:"female",programId:"saeil_women",status:"completed",totalExpected:4000000,startOff:18,ds:0,
        rounds:[{month:1,amount:800000,label:"인턴1개월",isPaid:true,paidOff:16,received:800000},{month:2,amount:800000,label:"인턴2개월",isPaid:true,paidOff:15,received:800000},{month:3,amount:800000,label:"인턴3개월",isPaid:true,paidOff:14,received:800000},{month:9,amount:800000,label:"고용유지1차",isPaid:true,paidOff:8,received:800000},{month:15,amount:800000,label:"고용유지2차",isPaid:true,paidOff:2,received:800000}],
        employeeDocs:[{label:"구직등록확인서",done:true,files:[]},{label:"근로계약서",done:true,files:[]},{label:"임금대장",done:true,files:[]},{label:"급여이체확인서류",done:true,files:[]}]},
      {isSample:true,name:"윤지우",birthDate:"1962-04-03",gender:"male",programId:"senior_intern",status:"inprogress",totalExpected:5500000,startOff:12,ds:0,
        rounds:[{month:3,amount:1200000,label:"1단계(3개월)",isPaid:true,paidOff:9,received:1200000},{month:9,amount:1500000,label:"2단계(6개월)",isPaid:true,paidOff:3,received:1500000},{month:18,amount:900000,label:"3단계(18개월)"},{month:24,amount:900000,label:"3단계(24개월)"},{month:36,amount:1000000,label:"3단계(36개월)"}],
        employeeDocs:[{label:"근로계약서",done:true,files:[]},{label:"사전교육 이수증",done:true,files:[]},{label:"월별급여대장",done:true,files:[]}]},
      {isSample:true,name:"서민아",birthDate:"1991-12-11",gender:"female",programId:"saeil_women",status:"preparing",totalExpected:4000000,startOff:0,ds:0,
        rounds:[{month:1,amount:800000,label:"인턴1개월"},{month:2,amount:800000,label:"인턴2개월"},{month:3,amount:800000,label:"인턴3개월"},{month:9,amount:800000,label:"고용유지1차"},{month:15,amount:800000,label:"고용유지2차"}],
        employeeDocs:[{label:"구직등록확인서",done:false,files:[]},{label:"근로계약서",done:true,files:[]},{label:"임금대장",done:false,files:[]}]}
    ]
  },
  {
    company:{isSample:true,name:"미래정밀",bizNo:"301-81-90122",ceoName:"한도경",addr:"충북 청주시 흥덕구 오송읍 정밀로 22",region:"비수도권",corpType:"법인",bizType:"기계·정밀 제조업",empCount:24,phone:"043-905-3300",email:"hr@miraeprecision.com",commission:{rate:10,retainer:300000,billed:false,paid:false,successFee:true},
      notes:[{id:"sn3",text:"강태양 고령자 계속고용 2분기 신청기한 경과. 재고용 취업규칙 사본 추가 확인 필요.",at:"2026-05-12T07:00:00.000Z",author:"담당 컨설턴트"}],companyDocs:[]},
    employees:[
      {isSample:true,name:"강태양",birthDate:"1958-04-12",gender:"male",programId:"senior_continue",status:"inprogress",totalExpected:7200000,startOff:7,ds:-12,
        rounds:[{month:3,amount:900000,label:"1분기",isPaid:true,paidOff:4,received:900000},{month:6,amount:900000,label:"2분기"},{month:9,amount:900000,label:"3분기"},{month:12,amount:900000,label:"4분기"}],
        employeeDocs:[{label:"지급신청서",done:true,files:[]},{label:"취업규칙(정년 명문화)",done:true,files:[]},{label:"재고용 근로계약서",done:false,files:[]},{label:"월별임금대장",done:false,files:[]}]},
      {isSample:true,name:"문수빈",birthDate:"1994-03-27",gender:"female",programId:"emp_retention",status:"inprogress",totalExpected:6000000,startOff:3,ds:5,
        rounds:[{month:1,amount:1500000,label:"1개월",isPaid:true,paidOff:2,received:1500000},{month:2,amount:1500000,label:"2개월",isPaid:true,paidOff:1,received:1500000},{month:3,amount:1500000,label:"3개월"},{month:4,amount:1500000,label:"4개월"}],
        employeeDocs:[{label:"고용유지조치계획서",done:true,files:[]},{label:"월별임금대장",done:true,files:[]},{label:"고용유지조치 동의서",done:false,files:[]}]},
      {isSample:true,name:"임재현",birthDate:"1960-10-05",gender:"male",programId:"senior_continue",status:"approved",totalExpected:7200000,startOff:4,ds:2,
        rounds:[{month:3,amount:900000,label:"1분기",isPaid:true,paidOff:1,received:900000},{month:6,amount:900000,label:"2분기"},{month:9,amount:900000,label:"3분기"},{month:12,amount:900000,label:"4분기"}],
        employeeDocs:[{label:"지급신청서",done:true,files:[]},{label:"취업규칙(정년 명문화)",done:true,files:[]},{label:"재고용 근로계약서",done:false,files:[]}]},
      {isSample:true,name:"박나래",birthDate:"1993-05-16",gender:"female",programId:"emp_retention",status:"submitted",totalExpected:6000000,startOff:2,ds:-5,
        rounds:[{month:1,amount:1500000,label:"1개월"},{month:2,amount:1500000,label:"2개월"},{month:3,amount:1500000,label:"3개월"},{month:4,amount:1500000,label:"4개월"}],
        employeeDocs:[{label:"고용유지조치계획서",done:true,files:[]},{label:"월별임금대장",done:false,files:[]},{label:"고용유지조치 동의서",done:false,files:[]}]}
    ]
  },
  {
    company:{isSample:true,name:"해든디자인",bizNo:"214-09-55178",ceoName:"서지안",addr:"서울 성동구 성수이로 66, 4층",region:"수도권",corpType:"개인",bizType:"인테리어·공간 디자인",empCount:6,phone:"02-462-7090",email:"studio@haedeun.kr",
      notes:[],companyDocs:[]},
    employees:[
      {isSample:true,name:"최유진",birthDate:"2000-08-21",gender:"female",programId:"youth_jump",status:"submitted",totalExpected:7200000,startOff:4,ds:0,
        rounds:[{month:6,amount:3600000,label:"1차(6개월)"},{month:9,amount:1800000,label:"2차(9개월)"},{month:12,amount:1800000,label:"3차(12개월)"}],
        employeeDocs:[{label:"근로계약서",done:true,files:[]},{label:"임금대장(6개월)",done:false,files:[]},{label:"개인정보동의서(근로자)",done:false,files:[]}]},
      {isSample:true,name:"정해성",birthDate:"1991-02-28",gender:"male",programId:"parental_leave",status:"approved",totalExpected:3600000,startOff:5,ds:0,
        rounds:[{month:3,amount:900000,label:"1차(3개월)",isPaid:true,paidOff:2,received:900000},{month:6,amount:900000,label:"2차(6개월)"},{month:9,amount:900000,label:"3차(9개월)"},{month:12,amount:900000,label:"4차(12개월)"}],
        employeeDocs:[{label:"육아휴직 신청서",done:true,files:[]},{label:"가족관계증명서",done:true,files:[]},{label:"휴직 발령 증빙",done:false,files:[]}]},
      {isSample:true,name:"김보람",birthDate:"2001-11-30",gender:"female",programId:"youth_jump",status:"preparing",totalExpected:7200000,startOff:1,ds:0,
        rounds:[{month:6,amount:3600000,label:"1차(6개월)"},{month:9,amount:1800000,label:"2차(9개월)"},{month:12,amount:1800000,label:"3차(12개월)"}],
        employeeDocs:[{label:"근로계약서",done:false,files:[]},{label:"임금대장(6개월)",done:false,files:[]}]}
    ]
  }
];

var SIDEBAR_NAV = [
  {key:"dashboard", icon:"📊", label:"대시보드"},
  {key:"company",   icon:"🏢", label:"업체 관리"},
  {key:"kanban",    icon:"🗂️", label:"진행 보드"},
  {key:"wage",      icon:"🧮", label:"급여 계산기"},
  {key:"simulator", icon:"📈", label:"수령액 시뮬레이터"},
  {key:"diagnosis", icon:"🎯", label:"채용 진단"},
  {key:"programs",  icon:"⚙️", label:"지원금 관리"},
];

// ── Cmd+K 글로벌 검색 팔레트 ─────────────────────────────
function CmdKSearch(props){
  var open=props.open; var onClose=props.onClose;
  var companies=props.companies||[]; var employees=props.employees||[];
  var programs=props.programs||{}; var goCompany=props.goCompany;
  var setView=props.setView;

  var stQ=useState(""); var q=stQ[0]; var setQ=stQ[1];
  var stSel=useState(0); var sel=stSel[0]; var setSel=stSel[1];
  var inputRef=useRef();

  useEffect(function(){
    if(open){ setQ(""); setSel(0); setTimeout(function(){ inputRef.current&&inputRef.current.focus(); },30); }
  },[open]);

  var results=useMemo(function(){
    var list=[];
    var qn=q.trim().toLowerCase();
    if(!qn) return list;
    companies.forEach(function(c){
      if((c.name||"").toLowerCase().indexOf(qn)>=0||
         (c.bizNo||"").replace(/-/g,"").indexOf(qn.replace(/-/g,""))>=0){
        list.push({type:"company",id:c.id,title:c.name,sub:c.bizNo||"",icon:"🏢"});
      }
    });
    employees.forEach(function(e){
      if((e.name||"").toLowerCase().indexOf(qn)>=0||
         (e.phone||"").replace(/-/g,"").indexOf(qn.replace(/-/g,""))>=0){
        var c=companies.find(function(x){return x.id===e.companyId;});
        list.push({type:"employee",id:e.companyId,empId:e.id,title:e.name,sub:c?c.name:"",icon:"👤"});
      }
    });
    Object.values(programs).forEach(function(p){
      if((p.name||"").toLowerCase().indexOf(qn)>=0){
        list.push({type:"program",id:"programs",title:p.name,sub:p.group||"",icon:"📋"});
      }
    });
    return list.slice(0,12);
  },[q,companies,employees,programs]);

  useEffect(function(){ setSel(0); },[results]);

  function activate(r){
    if(!r) return;
    if(r.type==="company"||r.type==="employee"){ goCompany(r.id); }
    else if(r.type==="program"){ setView("programs"); }
    onClose();
  }

  function onKey(e){
    if(e.key==="ArrowDown"){ e.preventDefault(); setSel(function(s){return Math.min(s+1,results.length-1);}); }
    else if(e.key==="ArrowUp"){ e.preventDefault(); setSel(function(s){return Math.max(s-1,0);}); }
    else if(e.key==="Enter"){ e.preventDefault(); activate(results[sel]); }
    else if(e.key==="Escape"){ onClose(); }
  }

  if(!open) return null;

  var TYPE_LABEL={company:"업체",employee:"직원",program:"지원금"};

  return(
    <div style={{position:"fixed",inset:0,zIndex:2000,background:"rgba(15,23,42,0.55)",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"80px 16px 16px"}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:18,width:"100%",maxWidth:560,boxShadow:"0 20px 60px rgba(15,23,42,0.3)",overflow:"hidden"}} onClick={function(e){e.stopPropagation();}}>
        {/* 검색 입력 */}
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"16px 20px",borderBottom:"1px solid #F1F5F9"}}>
          <span style={{fontSize:20,color:"#94A3B8",flexShrink:0}}>🔍</span>
          <input ref={inputRef} value={q} onChange={function(e){setQ(e.target.value);}} onKeyDown={onKey}
            placeholder="업체명, 직원명, 지원금명으로 검색…"
            style={{flex:1,border:"none",outline:"none",fontSize:17,fontFamily:FF,color:"#1E293B",background:"transparent"}}/>
          <kbd style={{fontSize:13,color:"#94A3B8",background:"#F1F5F9",border:"1px solid #E2E8F0",borderRadius:5,padding:"2px 7px",flexShrink:0}}>ESC</kbd>
        </div>
        {/* 결과 목록 */}
        <div style={{maxHeight:360,overflowY:"auto",padding:q?"8px 0":"0"}}>
          {q&&results.length===0&&(
            <div style={{padding:"28px 20px",textAlign:"center",fontSize:16,color:"#94A3B8"}}>검색 결과가 없습니다</div>
          )}
          {!q&&(
            <div style={{padding:"24px 20px",textAlign:"center",fontSize:16,color:"#94A3B8",lineHeight:1.8}}>
              <div style={{fontSize:28,marginBottom:8}}>⌘</div>
              업체명, 직원명, 지원금명을 입력하세요<br/>
              <span style={{fontSize:14}}>↑↓ 선택 · Enter 이동 · ESC 닫기</span>
            </div>
          )}
          {results.map(function(r,i){
            var active=i===sel;
            return(
              <div key={r.type+"-"+(r.empId||r.id)+"-"+i}
                style={{display:"flex",alignItems:"center",gap:12,padding:"11px 20px",cursor:"pointer",background:active?"#EFF6FF":"transparent",transition:"background 0.1s"}}
                onMouseEnter={function(){setSel(i);}}
                onClick={function(){activate(r);}}>
                <span style={{fontSize:22,flexShrink:0}}>{r.icon}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:16,fontWeight:600,color:active?"#2563EB":"#1E293B",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.title}</div>
                  {r.sub&&<div style={{fontSize:14,color:"#94A3B8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.sub}</div>}
                </div>
                <span style={{fontSize:13,color:active?"#2563EB":"#CBD5E1",background:active?"#DBEAFE":"#F8FAFC",border:"1px solid "+(active?"#BFDBFE":"#E2E8F0"),borderRadius:5,padding:"2px 8px",flexShrink:0,fontWeight:500}}>{TYPE_LABEL[r.type]}</span>
                {active&&<span style={{fontSize:14,color:"#93C5FD",flexShrink:0}}>↵</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Kanban Board: 진행 상태별 파이프라인 보드 ────────────
function KanbanBoard(props){
  var employees=props.employees||[]; var companies=props.companies||[];
  var programs=props.programs||{}; var onPatch=props.onPatchEmployee||function(){};
  var goCompany=props.goCompany||function(){};

  var stFilter=useState("all");
  var stDrag=useState(null);   // 드래그 중인 직원 id
  var stOver=useState(null);   // 드래그 오버 중인 컬럼 key
  var stMenu=useState(null);   // 이동 메뉴 열린 직원 id

  // 메뉴 바깥 클릭 시 닫기
  useEffect(function(){
    function close(){ stMenu[1](null); }
    if(stMenu[0]){ document.addEventListener("click",close); return function(){ document.removeEventListener("click",close); }; }
  },[stMenu[0]]);

  function normStatus(s){ return STS.find(function(x){return x.key===s;})?s:"preparing"; }
  function empRemaining(e){ return (e.rounds||[]).reduce(function(s,r){return s+(r.isPaid?0:(r.expectedAmount||r.amount||0));},0); }
  function empNextDday(e){ var dd=null; (e.rounds||[]).some(function(r){ if(!r.isPaid&&e.startDate){ dd=getDday(addMo(e.startDate,r.month)); return true; } return false; }); return dd; }

  var visEmps=useMemo(function(){
    return stFilter[0]==="all"?employees:employees.filter(function(e){return e.companyId===stFilter[0];});
  },[employees,stFilter[0]]);

  function colEmps(key){ return visEmps.filter(function(e){return normStatus(e.status)===key;}); }
  function move(empId,newStatus){
    var e=employees.find(function(x){return x.id===empId;});
    if(e&&normStatus(e.status)===newStatus){ stMenu[1](null); return; }
    onPatch(empId,{status:newStatus});
    var sl=(STS.find(function(s){return s.key===newStatus;})||{}).label||newStatus;
    if(e&&props.onLog)props.onLog(e.companyId,e.name+" 상태 → '"+sl+"'","상태변경");
    stMenu[1](null);
    toast("'"+sl+"'(으)로 상태가 변경되었습니다.","success");
  }

  // 파이프라인 요약
  var activeEmps=visEmps.filter(function(e){return e.status!=="resigned";});
  var pipelineValue=activeEmps.reduce(function(s,e){return s+empRemaining(e);},0);
  var completedCount=colEmps("completed").length;
  var convRate=activeEmps.length>0?Math.round(completedCount/activeEmps.length*100):0;
  var overdueCount=0,overdueAmt=0,next7Count=0;
  activeEmps.forEach(function(e){(e.rounds||[]).forEach(function(r){if(r.isPaid)return;if(e.startDate){var dd=getDday(addMo(e.startDate,r.month));if(dd!==null){if(dd<0){overdueCount++;overdueAmt+=r.expectedAmount||r.amount||0;}else if(dd<=7)next7Count++;}}});});

  function card(e){
    var p=programs[e.programId];
    var gp=p?GROUP_COLORS[p.group]||GROUP_COLORS["커스텀"]:GROUP_COLORS["커스텀"];
    var company=companies.find(function(c){return c.id===e.companyId;});
    var paid=(e.rounds||[]).filter(function(r){return r.isPaid;}).length;
    var total=(e.rounds||[]).length;
    var menuOpen=stMenu[0]===e.id;
    var dragging=stDrag[0]===e.id;
    var nextRound=null;
    (e.rounds||[]).some(function(r){if(!r.isPaid&&e.startDate){nextRound={label:r.label,amount:r.expectedAmount||r.amount||0,dd:getDday(addMo(e.startDate,r.month))};return true;}return false;});
    var remaining=empRemaining(e);
    var docs=e.employeeDocs||[]; var docDone=docs.filter(function(d){return d.done;}).length; var docTotal=docs.length;
    var ndd=nextRound?nextRound.dd:null;
    // D-day는 작은 배지로만 — 지연만 red, 나머지는 중립/파랑
    var ddBadge=ndd===null?null:ndd<0?{kind:"danger",t:"D+"+Math.abs(ndd)+" 지연"}:ndd<=7?{kind:"primary",t:ndd===0?"D-Day":"D-"+ndd}:{kind:"neutral",t:"D-"+ndd};
    return(
      <div key={e.id} draggable
        onDragStart={function(ev){stDrag[1](e.id);ev.dataTransfer.effectAllowed="move";ev.dataTransfer.setData("text/plain",e.id);}}
        onDragEnd={function(){stDrag[1](null);stOver[1](null);}}
        style={{background:"#fff",borderRadius:12,border:"1px solid #E2E8F0",borderLeft:ndd!==null&&ndd<0?"3px solid #DC2626":"1px solid #E2E8F0",padding:"12px 14px",marginBottom:10,cursor:"grab",boxShadow:dragging?"0 12px 28px rgba(37,99,235,0.22)":"0 1px 2px rgba(15,23,42,0.04)",opacity:dragging?0.45:1,position:"relative",transition:"box-shadow 0.15s,opacity 0.15s,transform 0.1s",transform:dragging?"scale(1.03)":"scale(1)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:32,height:32,borderRadius:16,background:"#F1F5F9",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#475569",fontWeight:700,flexShrink:0}}>{(e.name||"?").charAt(0)}</div>
          <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={function(){goCompany(e.companyId);}} title="업체 상세 보기">
            <div style={{fontSize:16,fontWeight:700,color:"#0F172A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.name}</div>
            <div style={{fontSize:13,color:"#94A3B8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{company?company.name:""}</div>
          </div>
          <button onClick={function(ev){ev.stopPropagation();stMenu[1](menuOpen?null:e.id);}} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:"#CBD5E1",padding:"0 2px",flexShrink:0,lineHeight:1}} title="상태 이동">⋮</button>
        </div>
        <div style={{marginTop:8}}>
          {p&&<span style={{...neutralBadge()}}>{p.name}</span>}
        </div>
        {nextRound&&(
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginTop:8,padding:"7px 10px",borderRadius:9,background:"#F8FAFC",border:"1px solid #F1F5F9"}}>
            <span style={{fontSize:14,fontWeight:700,color:"#0F172A"}}>{nextRound.label} {fMan(nextRound.amount)}</span>
            {ddBadge&&<span style={ddBadge.kind==="danger"?dangerBadge():ddBadge.kind==="primary"?primaryBadge():neutralBadge()}>{ddBadge.t}</span>}
          </div>
        )}
        <div style={{display:"flex",alignItems:"center",gap:10,marginTop:7,fontSize:13,color:"#64748B",fontWeight:500}}>
          <span>잔여 <strong style={{color:"#0F172A"}}>{fMan(remaining)}</strong></span>
          {docTotal>0&&<span>서류 <strong style={{color:docDone===docTotal?"#059669":"#64748B"}}>{docDone}/{docTotal}</strong></span>}
          {total>0&&<span style={{marginLeft:"auto",color:paid>0?"#059669":"#94A3B8"}}>{paid}/{total}회차</span>}
        </div>
        {menuOpen&&(
          <div style={{position:"absolute",right:8,top:38,zIndex:30,background:"#fff",borderRadius:10,boxShadow:"0 10px 28px rgba(15,23,42,0.20)",border:"1px solid #E2E8F0",padding:6,width:168}} onClick={function(ev){ev.stopPropagation();}}>
            <div style={{fontSize:12,color:"#94A3B8",padding:"4px 8px"}}>상태 이동</div>
            {STS.map(function(s){ var on=normStatus(e.status)===s.key; return(
              <div key={s.key} onClick={function(){move(e.id,s.key);}} style={{display:"flex",alignItems:"center",gap:7,padding:"7px 8px",borderRadius:7,cursor:"pointer",fontSize:14,background:on?s.bg:"transparent",color:on?s.color:"#475569",fontWeight:on?700:500}}>
                <span>{s.icon}</span><span>{s.label}</span>{on&&<span style={{marginLeft:"auto",fontSize:12}}>✓</span>}
              </div>
            );})}
          </div>
        )}
      </div>
    );
  }

  return(
    <div className="fade-in">
      {/* 파이프라인 요약 + 필터 */}
      <div style={{display:"flex",gap:12,marginBottom:18,flexWrap:"wrap",alignItems:"stretch"}}>
        <Card className="kpi-card" style={{padding:"16px 20px",flex:"1 1 200px",border:"1px solid #E2E8F0",borderLeft:"3px solid #2563EB"}}>
          <div style={{fontSize:14,color:"#64748B",fontWeight:600,marginBottom:4}}>파이프라인 잔여 가치</div>
          <div style={{fontSize:28,fontWeight:800,letterSpacing:"-0.5px",color:"#1D4ED8"}}>{fMan(pipelineValue)}</div>
          <div style={{fontSize:13,color:"#94A3B8",marginTop:4}}>진행 중 미수령 예정액 합계</div>
        </Card>
        <Card className="kpi-card" style={{padding:"16px 20px",flex:"1 1 140px",border:"1px solid #E2E8F0"}}>
          <div style={{fontSize:14,color:"#64748B",fontWeight:600,marginBottom:4}}>진행 중 대상자</div>
          <div style={{fontSize:28,fontWeight:800,color:"#0F172A"}}>{activeEmps.length}<span style={{fontSize:15,color:"#94A3B8",marginLeft:3}}>명</span></div>
        </Card>
        <Card className="kpi-card" style={{padding:"16px 20px",flex:"1 1 140px",border:"1px solid #E2E8F0"}}>
          <div style={{fontSize:14,color:"#64748B",fontWeight:600,marginBottom:4}}>완료 전환율</div>
          <div style={{fontSize:28,fontWeight:800,color:"#059669"}}>{convRate}<span style={{fontSize:15,color:"#94A3B8",marginLeft:3}}>%</span></div>
          <div style={{height:6,background:"#F1F5F9",borderRadius:3,overflow:"hidden",marginTop:8}}><div style={{height:"100%",width:convRate+"%",background:"#059669",borderRadius:3,transition:"width 0.5s ease"}}/></div>
        </Card>
        <Card className="kpi-card" style={{padding:"16px 20px",flex:"1 1 150px",border:"1px solid #E2E8F0",borderLeft:overdueCount>0?"3px solid #DC2626":"1px solid #E2E8F0"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:14,color:"#64748B",fontWeight:600}}>지연 신청</span>{overdueCount>0&&<span style={{...dangerBadge()}}>지연</span>}</div>
          <div style={{fontSize:28,fontWeight:800,color:overdueCount>0?"#DC2626":"#0F172A"}}>{overdueCount}<span style={{fontSize:15,color:"#94A3B8",marginLeft:3}}>건</span></div>
          <div style={{fontSize:13,color:"#94A3B8",marginTop:4}}>{overdueCount>0?fMan(overdueAmt)+" 위험":"지연 없음"}{next7Count>0?" · 임박 "+next7Count:""}</div>
        </Card>
        {companies.length>0&&(
          <select style={Object.assign({},inp,{width:"auto",minWidth:170,fontSize:18,fontWeight:600,alignSelf:"center"})} value={stFilter[0]} onChange={function(e){stFilter[1](e.target.value);}}>
            <option value="all">🗂️ 전체 업체</option>
            {companies.map(function(c){return <option key={c.id} value={c.id}>🏢 {c.name}</option>;})}
          </select>
        )}
      </div>

      {activeEmps.length===0&&colEmps("resigned").length===0?(
        <EmptyState icon="🗂️" title="보드에 표시할 직원이 없습니다" desc="직원을 등록하면 준비중 → 서류접수 → 심사중 → 승인 → 지급중 → 완료 단계로 카드가 표시됩니다. 카드를 드래그해 진행 상태를 옮길 수 있어요." />
      ):(
        <div style={{position:"relative"}}>
          <div style={{fontSize:13,color:"#94A3B8",fontWeight:500,marginBottom:8,textAlign:"right"}}>← 좌우로 스크롤해 전체 진행 단계를 확인하세요 →</div>
          <div className="kanban-scroll" style={{display:"flex",gap:12,overflowX:"auto",paddingBottom:14,alignItems:"flex-start"}}>
          {STS.map(function(col){
            var es=colEmps(col.key);
            var colExp=es.reduce(function(s,e){return s+empRemaining(e);},0);
            var isOver=stOver[0]===col.key;
            return(
              <div key={col.key}
                onDragOver={function(ev){ev.preventDefault();if(stOver[0]!==col.key)stOver[1](col.key);}}
                onDragLeave={function(ev){ if(!ev.currentTarget.contains(ev.relatedTarget))stOver[1](null); }}
                onDrop={function(ev){ev.preventDefault();if(stDrag[0])move(stDrag[0],col.key);stDrag[1](null);stOver[1](null);}}
                style={{width:290,flexShrink:0,background:isOver?"#EFF6FF":"#F8FAFC",borderRadius:14,border:isOver?"2px dashed #2563EB":"1px solid #E8EEF4",padding:"12px",minHeight:160,transition:"background 0.18s,border-color 0.18s,transform 0.15s",transform:isOver?"scale(1.01)":"scale(1)",boxShadow:isOver?"0 4px 18px rgba(37,99,235,0.10)":"none"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,padding:"2px 4px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,minWidth:0}}>
                    <span style={{width:8,height:8,borderRadius:4,background:col.color,display:"inline-block",flexShrink:0}}/>
                    <span style={{fontSize:15,fontWeight:700,color:"#334155",whiteSpace:"nowrap"}}>{col.label}</span>
                  </div>
                  <span style={{fontSize:13,fontWeight:700,color:"#64748B",background:"#F1F5F9",borderRadius:10,padding:"2px 10px",flexShrink:0,minWidth:26,textAlign:"center"}}>{es.length}</span>
                </div>
                {colExp>0&&<div style={{fontSize:13,color:"#94A3B8",padding:"2px 4px 10px",fontWeight:500}}>잔여 {fMan(colExp)}</div>}
                {es.length===0?(
                  <div style={{textAlign:"center",padding:"28px 0",fontSize:14,color:isOver?"#2563EB":"#CBD5E1",fontWeight:isOver?700:400,borderRadius:10,border:isOver?"2px dashed #2563EB":"2px dashed transparent",transition:"all 0.15s"}}>{isOver?"⬇ 여기에 놓기":"비어 있음"}</div>
                ):es.map(card)}
              </div>
            );
          })}
          </div>
          <div style={{position:"absolute",top:30,right:0,bottom:14,width:42,background:"linear-gradient(90deg,rgba(241,245,249,0),#F1F5F9 75%)",pointerEvents:"none"}}/>
        </div>
      )}
      <Notice>카드를 드래그하거나 ⋮ 버튼으로 진행 상태를 변경하세요. 변경 즉시 모든 화면·팀원에게 실시간 반영됩니다.</Notice>
    </div>
  );
}

function ProductTour(props){
  var STEPS=[
    {title:"👋 환영합니다!",desc:"고용지원금 Pro는 정부 고용지원금 신청·관리를 위한 전문 플랫폼입니다. 1분 안에 핵심 기능을 안내해드릴게요.",target:null},
    {title:"🗂️ 메뉴 탐색",desc:"왼쪽 사이드바에서 모든 기능에 접근하세요. 대시보드, 업체 관리, 진행 보드, 급여 계산기까지 한 곳에 있습니다.",target:"[data-tour='sidebar']",side:"right"},
    {title:"🏢 업체 등록",desc:"'+ 업체 추가' 버튼으로 관리할 업체를 먼저 등록하세요. 업체마다 직원과 지원금이 독립적으로 관리됩니다.",target:"[data-tour='add-company']",side:"bottom"},
    {title:"🗂️ 진행 보드",desc:"지원금 진행 단계를 칸반 보드로 한눈에 확인하세요. 카드를 드래그해서 준비중→서류접수→심사중→완료로 이동할 수 있어요.",target:"[data-tour='nav-kanban']",side:"right"},
    {title:"🎯 채용 진단",desc:"채용 조건(나이·고용형태·지역 등)을 입력하면 신청 가능한 지원금을 자동으로 진단해줍니다. 처음이라면 여기서 시작하세요!",target:"[data-tour='nav-diagnosis']",side:"right"},
    {title:"🧮 급여 계산기",desc:"직원 실수령액·사업주 부담금·최저임금 판정을 한 번에 계산합니다. 보수 설정 전 꼭 확인하세요.",target:"[data-tour='nav-wage']",side:"right"},
    {title:"🚀 이제 시작해볼까요?",desc:"업체 관리 메뉴에서 첫 업체를 등록하고 직원을 추가해보세요. 사이드바 하단 '투어' 버튼으로 언제든 다시 안내받을 수 있어요.",target:null},
  ];

  var stStep=useState(0); var step=stStep[0]; var setStep=stStep[1];
  var stRect=useState(null); var rect=stRect[0];

  useEffect(function(){
    if(!props.open) return;
    var s=STEPS[step];
    if(!s.target){stRect[1](null);return;}
    function measure(){
      var el=document.querySelector(s.target);
      if(el){var r=el.getBoundingClientRect();stRect[1]({top:r.top,left:r.left,right:r.right,bottom:r.bottom,width:r.width,height:r.height});}
      else stRect[1](null);
    }
    measure();
    window.addEventListener("resize",measure);
    return function(){window.removeEventListener("resize",measure);};
  },[step,props.open]);

  useEffect(function(){if(props.open)setStep(0);},[props.open]);

  if(!props.open) return null;

  var PAD=14; var TW=360;
  var vw=window.innerWidth; var vh=window.innerHeight;
  var cur=STEPS[step];
  var isLast=step===STEPS.length-1;

  function next(){if(isLast)props.onClose();else setStep(function(s){return s+1;});}
  function prev(){setStep(function(s){return s-1;});}

  // 1단계(index 0)·마지막 단계는 무조건 중앙 모달 — anchor/rect 계산을 절대 타지 않는다
  var centered=!cur.target;
  var tStyle={position:"fixed",width:TW,background:"#fff",borderRadius:20,padding:"28px 30px",boxShadow:"0 24px 64px rgba(15,23,42,0.35), 0 0 0 1px rgba(0,0,0,0.06)",zIndex:4010,fontFamily:FF,boxSizing:"border-box"};
  if(centered||!rect){
    // 화면 정중앙 고정 모달 (transform 기반 중앙 정렬 — fade-in(불투명도만) 사용해 translate 덮어쓰기 방지)
    Object.assign(tStyle,{top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:"min(360px, calc(100vw - 40px))",maxWidth:"calc(100vw - 40px)",maxHeight:"calc(100dvh - 80px)",overflowY:"auto",padding:"clamp(22px,5vw,28px)"});
  } else {
    var side=cur.side||"right"; var gap=18;
    if(side==="right"){
      var tl=rect.right+gap; if(tl+TW>vw-10)tl=rect.left-TW-gap;
      tStyle.left=Math.max(10,tl)+"px"; tStyle.top=Math.max(10,Math.min(rect.top-8,vh-340))+"px";
    } else {
      var tl2=Math.min(rect.left,vw-TW-10); if(tl2<10)tl2=10;
      var tt2=rect.bottom+gap; if(tt2+300>vh)tt2=rect.top-300-gap;
      tStyle.left=tl2+"px"; tStyle.top=Math.max(10,tt2)+"px";
    }
  }

  return createPortal(
    <div style={{position:"fixed",inset:0,zIndex:4000}} onClick={function(e){e.stopPropagation();}}>
      {(centered||!rect)&&<div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.72)",zIndex:4000}}/>}
      {!centered&&rect&&<div style={{position:"fixed",top:rect.top-PAD,left:rect.left-PAD,width:rect.width+PAD*2,height:rect.height+PAD*2,borderRadius:16,boxShadow:"0 0 0 9999px rgba(15,23,42,0.68)",border:"2px solid rgba(99,102,241,0.7)",zIndex:4005,pointerEvents:"none",transition:"all 0.25s ease"}}/>}
      <div style={tStyle} className={(centered||!rect)?"fade-in":"fade-in-up"}>
        <div style={{display:"flex",gap:5,marginBottom:22,alignItems:"center"}}>
          {STEPS.map(function(_,i){return(
            <div key={i} style={{height:6,width:i===step?20:6,borderRadius:3,background:i===step?"#2563EB":i<step?"#93C5FD":"#E2E8F0",transition:"all 0.3s ease"}}/>
          );})}
          <span style={{marginLeft:"auto",fontSize:13,color:"#94A3B8",fontWeight:500}}>{step+1} / {STEPS.length}</span>
        </div>
        <h3 style={{margin:"0 0 12px",fontSize:22,fontWeight:800,color:"#0F172A",lineHeight:1.3}}>{cur.title}</h3>
        <p style={{margin:"0 0 28px",fontSize:15,color:"#475569",lineHeight:1.75}}>{cur.desc}</p>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <button onClick={props.onClose} style={{background:"none",border:"none",color:"#94A3B8",cursor:"pointer",fontSize:14,fontFamily:FF,padding:0}}>건너뛰기</button>
          <div style={{display:"flex",gap:10}}>
            {step>0&&<button onClick={prev} style={{background:"#F1F5F9",border:"none",color:"#475569",cursor:"pointer",fontSize:15,fontWeight:600,borderRadius:10,padding:"10px 20px",fontFamily:FF}}>← 이전</button>}
            <button onClick={next} style={{background:"linear-gradient(135deg,#1D4ED8,#2563EB)",color:"#fff",border:"none",borderRadius:10,padding:"10px 26px",fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:FF,boxShadow:"0 4px 14px rgba(37,99,235,0.4)"}}>
              {isLast?"🚀 시작하기":"다음 →"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function SubsidyApp(props){
  var companies=props.companies||[];
  var employees=props.employees||[];
  var rawProgs=props.programs;
  var programs=useMemo(function(){var raw=rawProgs||DEFAULT_PROGRAMS;var out={};Object.keys(raw).forEach(function(k){var p=raw[k];out[k]=p.enabled!==undefined?p:Object.assign({},p,{enabled:!!PROGRAM_ENABLED_DEFAULTS[k]});});return out;},[rawProgs]);
  var calendarMemos=props.calendarMemos||{};
  var profile=props.profile||{};
  var orgName=props.orgName||"";
  var uploadFn=props.uploadFn;
  var getUrlFn=props.getUrlFn;
  var onSaveCompany=props.onSaveCompany||function(){};
  var onPatchCompany=props.onPatchCompany||function(){};
  var onDeleteCompany=props.onDeleteCompany||function(){};
  var onSaveEmployee=props.onSaveEmployee||function(){};
  var onPatchEmployee=props.onPatchEmployee||function(){};
  var onDeleteEmployee=props.onDeleteEmployee||function(){};
  var onSavePrograms=props.onSavePrograms||function(){};
  var onSaveMemo=props.onSaveMemo||function(){};
  var onSignOut=props.onSignOut||function(){};
  var onUpdateProfile=props.onUpdateProfile||function(){};

  var stView=useState("dashboard");
  var stCmdK=useState(false);
  var stCompany=useState(null);
  var stAddComp=useState(false);
  var stProfileOpen=useState(false);
  var stMobileNav=useState(false);
  var stTour=useState(function(){try{return !localStorage.getItem("subsidy_tour_done");}catch(e){return false;}});
  function startTour(){stTour[1](true);}
  function endTour(){try{localStorage.setItem("subsidy_tour_done","1");}catch(e){}stTour[1](false);}

  function loadSampleData(){
    // startOff(개월)·ds(일) → 실행 시점 기준 실제 날짜로 변환 (데모 긴박감 항상 유지)
    function rel(monthsAgo,dayShift){var d=new Date();d.setMonth(d.getMonth()-(monthsAgo||0));if(dayShift)d.setDate(d.getDate()+dayShift);return d.toISOString().split("T")[0];}
    SAMPLE_DATA.forEach(function(item){
      var cId=ruuid();
      var comp=Object.assign({},item.company,{id:cId,createdAt:new Date().toISOString()});
      onSaveCompany(comp);
      item.employees.forEach(function(emp){
        var startDate=rel(emp.startOff,emp.ds);
        var rounds=(emp.rounds||[]).map(function(r){
          var nr=Object.assign({},r,{id:uid()});
          if(r.isPaid){nr.paidDate=rel(r.paidOff,0);nr.received=r.received||r.amount;}
          delete nr.paidOff;
          return nr;
        });
        var empDocs=(emp.employeeDocs||[]).map(function(d){return Object.assign({},d,{id:uid()});});
        var clean=Object.assign({},emp); delete clean.startOff; delete clean.ds;
        onSaveEmployee(Object.assign(clean,{id:ruuid(),companyId:cId,startDate:startDate,rounds:rounds,employeeDocs:empDocs}));
      });
    });
  }

  function deleteSampleData(){
    var sampleEmps=employees.filter(function(e){return e.isSample;});
    var sampleComps=companies.filter(function(c){return c.isSample;});
    if(sampleComps.length===0&&sampleEmps.length===0){toast("삭제할 샘플 데이터가 없습니다.","info");return;}
    if(!window.confirm("샘플 데이터(고객사 "+sampleComps.length+"개·대상자 "+sampleEmps.length+"명)만 삭제합니다.\n직접 등록하신 실제 고객 데이터는 삭제되지 않습니다.\n\n진행할까요?"))return;
    // isSample=true 인 데이터만 삭제 — 실제 고객 데이터는 절대 건드리지 않음
    sampleEmps.forEach(function(e){onDeleteEmployee(e.id);});
    sampleComps.forEach(function(c){onDeleteCompany(c.id);});
    toast("샘플 데이터가 삭제되었습니다.","success");
  }

  var hasSample=companies.some(function(c){return c.isSample;});

  function goCompany(id){stCompany[1](id);stView[1]("company");}
  function goBack(){stView[1]("dashboard");stCompany[1](null);}
  // 업무 일지 자동 기록 (companyId, 내용, 유형)
  function logToCompany(companyId,text,type){
    var c=companies.find(function(x){return x.id===companyId;}); if(!c)return;
    var entry={id:uid(),text:text,at:new Date().toISOString(),author:(profile.display_name||""),type:type||"기타",auto:true};
    onPatchCompany(companyId,{notes:[entry].concat(c.notes||[])});
  }
  var isTrial=props.subStatus==="trialing";
  var tier=planTier(props.plan,isTrial);

  useEffect(function(){
    function handler(e){
      if((e.metaKey||e.ctrlKey)&&e.key==="k"){
        e.preventDefault();
        stCmdK[1](function(o){return !o;});
      }
      if(e.key==="Escape"){ stMobileNav[1](false); }
    }
    window.addEventListener("keydown",handler);
    return function(){ window.removeEventListener("keydown",handler); };
  },[]);

  // 모바일 메뉴 열림 시 body 스크롤 잠금
  useEffect(function(){
    if(typeof document==="undefined")return;
    if(stMobileNav[0])document.body.classList.add("no-scroll");
    else document.body.classList.remove("no-scroll");
    return function(){document.body.classList.remove("no-scroll");};
  },[stMobileNav[0]]);

  var selectedCompany=stCompany[0]?companies.find(function(c){return c.id===stCompany[0];})||null:null;
  var stPN=useState(profile.display_name||"");
  var stPT=useState(profile.title||"");
  var stDDA=useState((profile.settings&&profile.settings.ddayAlert)||7);
  function saveProfile(){onUpdateProfile({display_name:stPN[0],title:stPT[0],settings:Object.assign({},profile.settings||{},{ddayAlert:stDDA[0]})});stProfileOpen[1](false);}

  // 현재 활성 탭
  var activeKey=stView[0]==="company"?"company":stView[0];

  // 사이드바 스타일
  var SB={
    wrap:{width:270,minHeight:"100vh",background:"#1E293B",display:"flex",flexDirection:"column",position:"fixed",left:0,top:0,bottom:0,zIndex:200,fontFamily:FF},
    brand:{padding:"28px 24px 22px",borderBottom:"1px solid rgba(255,255,255,0.08)"},
    brandTitle:{fontSize:25,fontWeight:800,color:"#fff",letterSpacing:"-0.3px"},
    brandSub:{fontSize:18,color:"#64748B",marginTop:4},
    nav:{flex:1,padding:"10px 0",overflowY:"auto"},
    item:function(active){return{display:"flex",alignItems:"center",gap:11,padding:"11px 15px",margin:"2px 12px",borderRadius:10,fontSize:19,fontWeight:active?700:500,color:active?"#fff":"#94A3B8",background:active?"rgba(59,130,246,0.14)":"transparent",boxShadow:active?"inset 3px 0 0 #60A5FA":"none",cursor:"pointer",transition:"all 0.15s",userSelect:"none",boxSizing:"border-box"};},
    icon:{fontSize:22,width:28,textAlign:"center",flexShrink:0},
    bottom:{padding:"20px 24px",borderTop:"1px solid rgba(255,255,255,0.08)"},
    user:{display:"flex",alignItems:"center",gap:12,marginBottom:16},
    avatar:{width:46,height:46,borderRadius:23,background:"#334155",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,color:"#fff",fontWeight:700,flexShrink:0},
    userName:{fontSize:21,fontWeight:600,color:"#E2E8F0",lineHeight:1.3},
    userRole:{fontSize:18,color:"#64748B"},
    actions:{display:"flex",gap:8},
    actionBtn:function(c){return{flex:1,padding:"10px 0",fontSize:18,fontWeight:500,borderRadius:8,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.05)",color:c||"#94A3B8",cursor:"pointer",textAlign:"center"};},
  };

  function NavItem(p){
    return(
      <div data-tour={p.tourId} className="sb-item" style={SB.item(p.active)} onClick={p.onClick}
        onMouseEnter={function(e){if(!p.active)e.currentTarget.style.background="rgba(255,255,255,0.08)";}}
        onMouseLeave={function(e){if(!p.active)e.currentTarget.style.background="transparent";}}>
        <span style={SB.icon} className="sb-icon">{p.icon}</span>
        <span>{p.label}</span>
        {p.active&&<span style={{marginLeft:"auto",width:6,height:6,borderRadius:3,background:"#60A5FA",flexShrink:0,boxShadow:"0 0 8px #60A5FA"}}/>}
      </div>
    );
  }

  var trialDays=props.trialDaysLeft;

  return(
    <div style={{minHeight:"100vh",background:"#F1F5F9",fontFamily:FF,display:"flex"}}>

      {/* 모바일 백드롭 */}
      <div className={"app-backdrop"+(stMobileNav[0]?"":" hidden")} onClick={function(){stMobileNav[1](false);}}/>

      {/* ── 사이드바 ── */}
      <div className={"app-sidebar"+(stMobileNav[0]?" open":"")} style={SB.wrap} data-tour="sidebar">
        {/* 브랜드 */}
        <div style={SB.brand} className="sb-brand">
          <div style={SB.brandTitle} className="sb-brand-title">🏛 고용지원금 Pro</div>
          <div className="sb-brand-sub" style={{fontSize:13,color:"#64748B",marginTop:6,lineHeight:1.45,fontWeight:500}}>컨설턴트를 위한 고용지원금 운영관리 시스템</div>
          {orgName&&<div className="sb-org" style={{fontSize:14,color:"#93C5FD",marginTop:8,fontWeight:600}}>{orgName}</div>}
          {trialDays!==null&&trialDays!==undefined&&(
            <div className="sb-trial" style={{marginTop:10,display:"inline-flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:20,background:"rgba(59,130,246,0.15)",border:"1px solid rgba(59,130,246,0.3)"}}>
              <span style={{fontSize:16}}>⏳</span>
              <span style={{fontSize:17,color:"#93C5FD",fontWeight:600}}>무료체험 {trialDays}일 남음</span>
            </div>
          )}
        </div>

        {/* 네비 */}
        <div style={SB.nav}>
          {SIDEBAR_NAV.map(function(n){
            return(
              <NavItem key={n.key} icon={n.icon} label={n.label} active={activeKey===n.key}
                tourId={"nav-"+n.key}
                onClick={function(){stView[1](n.key);stCompany[1](null);stMobileNav[1](false);}}
              />
            );
          })}

          {/* 온보딩 체크리스트 */}
          {(function(){
            var hasCompany=companies.length>0;
            var hasEmployee=employees.length>0;
            var hasNote=companies.some(function(c){return(c.notes||[]).length>0;});
            var hasDoc=employees.some(function(e){return(e.employeeDocs||[]).some(function(d){return d.done;});});
            var steps=[
              {done:hasCompany,label:"업체 첫 등록",action:function(){stAddComp[1](true);stMobileNav[1](false);}},
              {done:hasEmployee,label:"직원 등록",action:function(){if(hasCompany){stView[1]("company");stMobileNav[1](false);}}},
              {done:hasDoc,label:"서류 1건 완료",action:null},
              {done:hasNote,label:"업무 일지 기록",action:null},
            ];
            var doneCount=steps.filter(function(s){return s.done;}).length;
            if(doneCount===steps.length)return null; // 모두 완료 시 숨김
            return(
              <div className="sb-onboard" style={{margin:"14px 16px 0",padding:"12px 14px",background:"rgba(255,255,255,0.06)",borderRadius:12,border:"1px solid rgba(255,255,255,0.10)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <span style={{fontSize:13,fontWeight:700,color:"#E2E8F0"}}>🚀 시작하기</span>
                  <span style={{fontSize:12,color:"#64748B"}}>{doneCount}/{steps.length}</span>
                </div>
                <div style={{height:4,background:"rgba(255,255,255,0.1)",borderRadius:2,overflow:"hidden",marginBottom:10}}>
                  <div style={{height:"100%",width:(doneCount/steps.length*100)+"%",background:"#2563EB",borderRadius:2,transition:"width 0.4s ease"}}/>
                </div>
                {steps.map(function(s,i){return(
                  <div key={i} onClick={s.done||!s.action?undefined:s.action}
                    style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",cursor:(s.done||!s.action)?"default":"pointer"}}>
                    <span style={{fontSize:14,flexShrink:0}}>{s.done?"✅":"⬜"}</span>
                    <span style={{fontSize:13,color:s.done?"#94A3B8":"#CBD5E1",textDecoration:s.done?"line-through":"none"}}>{s.label}</span>
                  </div>
                );})}
              </div>
            );
          })()}
        </div>

        {/* 하단: 유저 정보 + 버튼 */}
        <div style={SB.bottom} className="sb-bottom">
          <div style={SB.user} className="sb-user" onClick={function(){stProfileOpen[1](true);}} title="프로필 설정">
            <div style={SB.avatar} className="sb-avatar">{(profile.display_name||"?").charAt(0)}</div>
            <div style={{minWidth:0}}>
              <div style={SB.userName} className="sb-username">{profile.display_name||"사용자"}</div>
              <div style={SB.userRole} className="sb-userrole">{profile.title||"담당자"}</div>
            </div>
          </div>
          <div className="sb-trialrow" style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,padding:"8px 12px",borderRadius:8,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)"}}>
            <span style={{fontSize:13,color:"#CBD5E1",fontWeight:600}}>{isTrial?"무료체험 · 프로 전체 이용":tier.label}</span>
            {!isTrial&&tier.key!=="pro"&&tier.key!=="team"&&<button onClick={props.onOpenBilling||function(){}} style={{fontSize:12,fontWeight:700,color:"#BFDBFE",background:"rgba(37,99,235,0.25)",border:"none",borderRadius:6,padding:"3px 9px",cursor:"pointer",fontFamily:FF}}>업그레이드 →</button>}
          </div>
          <button className="sb-tourbtn" style={{width:"100%",marginBottom:8,padding:"9px",fontSize:14,fontWeight:500,borderRadius:8,border:"1px solid rgba(255,255,255,0.12)",background:"rgba(255,255,255,0.06)",color:"#86EFAC",cursor:"pointer",fontFamily:FF,textAlign:"center"}} onClick={startTour}>📖 사용법 안내 (투어)</button>
          <div style={SB.actions} className="sb-actions">
            <button style={SB.actionBtn()} className="sb-actionbtn" onClick={function(){stProfileOpen[1](true);}}>설정</button>
            <button style={SB.actionBtn("#93C5FD")} className="sb-actionbtn" onClick={props.onOpenBilling||function(){}} title="구독 관리">구독</button>
            <button style={SB.actionBtn("#FCA5A5")} className="sb-actionbtn" onClick={onSignOut}>로그아웃</button>
          </div>
        </div>
      </div>

      {/* ── 콘텐츠 영역 ── */}
      <div className="app-content" style={{marginLeft:270,flex:1,minHeight:"100vh",display:"flex",flexDirection:"column"}}>
        {/* 상단 헤더바 */}
        <div className="app-header" style={{background:"#fff",borderBottom:"1px solid #E2E8F0",padding:"0 40px",height:76,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
            <button className="app-hamburger" onClick={function(){stMobileNav[1](true);}} title="메뉴" style={{display:"none",alignItems:"center",justifyContent:"center",width:44,height:44,borderRadius:10,border:"1px solid #E2E8F0",background:"#F8FAFC",fontSize:22,cursor:"pointer",flexShrink:0}}>☰</button>
            {stView[0]==="company"&&selectedCompany?(
              <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
                <button onClick={goBack} style={{background:"none",border:"none",color:"#64748B",cursor:"pointer",fontSize:21,padding:0,whiteSpace:"nowrap"}}>← 목록</button>
                <span style={{color:"#CBD5E1",fontSize:21}}>/</span>
                <span style={{fontSize:24,fontWeight:700,color:"#1E293B",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selectedCompany.name}</span>
              </div>
            ):(
              <span className="app-title" style={{fontSize:26,fontWeight:700,color:"#1E293B",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                {(SIDEBAR_NAV.find(function(n){return n.key===activeKey;})||{label:"대시보드"}).icon}&nbsp;
                {(SIDEBAR_NAV.find(function(n){return n.key===activeKey;})||{label:"대시보드"}).label}
              </span>
            )}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
            <button onClick={function(){stCmdK[1](true);}} title="통합 검색 (Ctrl+K)"
              style={{display:"flex",alignItems:"center",gap:7,padding:"9px 16px",borderRadius:10,border:"1.5px solid #E2E8F0",background:"#F8FAFC",color:"#64748B",fontSize:15,cursor:"pointer",fontFamily:FF,whiteSpace:"nowrap"}}>
              <span>🔍</span>
              <span className="hide-mobile">검색</span>
              <kbd style={{fontSize:12,background:"#E2E8F0",border:"1px solid #CBD5E1",borderRadius:4,padding:"1px 5px",color:"#94A3B8",fontFamily:"monospace"}} className="hide-mobile">⌘K</kbd>
            </button>
            <NotifBell employees={employees} companies={companies} programs={programs} goCompany={goCompany} settings={profile.settings||{}} tier={tier}/>
            {(stView[0]==="dashboard"||stView[0]==="company")&&!selectedCompany&&(
              <button style={btnP} className="hover-lift add-co-btn" data-tour="add-company" onClick={function(){stAddComp[1](true);}}>+<span className="hide-mobile"> 업체 추가</span></button>
            )}
          </div>
        </div>

        {/* 샘플 데이터 배너 */}
        {hasSample&&(
          <div style={{background:"#F8FAFC",borderBottom:"1px solid #E2E8F0",padding:"11px 48px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <span style={{...neutralBadge(),flexShrink:0}}>샘플</span>
            <div style={{flex:1,minWidth:200}}>
              <span style={{fontSize:14,color:"#475569"}}>샘플 데이터로 고객 보고서, 서류 요청, 수수료 정산 흐름까지 확인해보세요. 실제 고객사 정보가 아닌 가상 데이터(5개 고객사·18명)이며, 언제든 삭제할 수 있습니다.</span>
            </div>
            <button onClick={deleteSampleData} style={{background:"#fff",color:"#DC2626",border:"1px solid #FECACA",borderRadius:8,padding:"8px 16px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:FF,flexShrink:0,whiteSpace:"nowrap"}}>샘플 데이터 삭제</button>
          </div>
        )}

        {/* 페이지 콘텐츠 */}
        <div className="app-page" style={{flex:1,padding:"32px 48px",width:"100%",maxWidth:1440,margin:"0 auto",boxSizing:"border-box"}}>

          <div key={stView[0]+(stCompany[0]||"")} className="page-enter">

          {companies.length===0&&(
            <div style={{background:"#F8FAFC",border:"2px dashed #BFDBFE",borderRadius:20,padding:"44px 32px",marginBottom:32,textAlign:"center"}}>
              <div style={{fontSize:52,marginBottom:16}}>✨</div>
              <h3 style={{margin:"0 0 10px",fontSize:24,fontWeight:800,color:"#0F172A"}}>처음이신가요?</h3>
              <p style={{margin:"0 0 8px",fontSize:16,color:"#475569",lineHeight:1.8}}>실제 컨설팅 현장과 똑같은 <strong>5개 고객사·18명 대상자</strong> 데이터로 먼저 둘러보세요.<br/>지연 신청 건, 신청 임박 알림, 수령 현황, 고객 보고서까지 한 번에 확인할 수 있어요.</p>
              <p style={{margin:"0 0 28px",fontSize:14,color:"#94A3B8"}}>둘러본 뒤 "샘플 데이터 삭제" 버튼 한 번이면 깔끔하게 초기화됩니다.</p>
              <button onClick={loadSampleData} style={{background:"#2563EB",color:"#fff",border:"none",borderRadius:12,padding:"15px 38px",fontSize:17,fontWeight:700,cursor:"pointer",fontFamily:FF,boxShadow:"0 2px 8px rgba(37,99,235,0.20)",display:"inline-flex",alignItems:"center",gap:8}}>
                <span>샘플 데이터로 둘러보기</span>
              </button>
            </div>
          )}

          {stView[0]==="dashboard"&&(
            <Dashboard
              companies={companies} employees={employees} programs={programs}
              calendarMemos={calendarMemos} onSaveMemo={onSaveMemo}
              goCompany={goCompany} settings={profile.settings||{}}
              onAddCompany={function(){stAddComp[1](true);}}
              setView={function(v){stView[1](v);stCompany[1](null);}}
              tier={tier} isTrial={isTrial} trialDaysLeft={trialDays} onOpenBilling={props.onOpenBilling}
              mode="stats"
            />
          )}

          {stView[0]==="company"&&!selectedCompany&&(
            <Dashboard
              companies={companies} employees={employees} programs={programs}
              calendarMemos={calendarMemos} onSaveMemo={onSaveMemo}
              goCompany={goCompany} settings={profile.settings||{}}
              onAddCompany={function(){stAddComp[1](true);}}
              setView={function(v){stView[1](v);stCompany[1](null);}}
              mode="list"
            />
          )}

          {stView[0]==="company"&&selectedCompany&&(
            <CompDet
              company={selectedCompany} programs={programs} employees={employees}
              uploadFn={uploadFn} getUrlFn={getUrlFn} profile={profile} tier={tier}
              goBack={goBack}
              onSaveEmployee={onSaveEmployee}
              onPatchEmployee={onPatchEmployee}
              onDeleteEmployee={onDeleteEmployee}
              onPatchCompany={onPatchCompany}
              onDeleteCompany={onDeleteCompany}
              onLog={logToCompany}
              onOpenBilling={props.onOpenBilling}
              onOpenWage={function(){stView[1]("wage");stCompany[1](null);}}
            />
          )}

          {stView[0]==="kanban"&&(
            <KanbanBoard
              employees={employees} companies={companies} programs={programs}
              onPatchEmployee={onPatchEmployee} goCompany={goCompany} onLog={logToCompany}
            />
          )}

          {stView[0]==="wage"&&(
            <div style={{maxWidth:980}}>
              <p style={{margin:"0 0 16px",color:"#64748B",fontSize:FS_BODY,lineHeight:1.6}}>최저임금·월보수 하한선을 자동 판정합니다. 지원금 요건을 가르는 핵심 기준이니 보수 설정 전 꼭 확인하세요.</p>
              <WageCalc/>
            </div>
          )}

          {stView[0]==="simulator"&&(
            <div style={{maxWidth:980}}>
              <p style={{margin:"0 0 16px",color:"#64748B",fontSize:FS_BODY,lineHeight:1.6}}>채용 인원과 입사일만 넣으면 월별 현금흐름까지 자동 계산됩니다. 결과는 고객 상담 문구로 바로 복사할 수 있어요.</p>
              <Simulator programs={programs}/>
            </div>
          )}

          {stView[0]==="diagnosis"&&(
            <div style={{maxWidth:900}}>
              <p style={{margin:"0 0 16px",color:"#64748B",fontSize:FS_BODY,lineHeight:1.6}}><strong style={{color:"#1E293B"}}>채용 전 30초 진단</strong> — 채용 후 알면 늦는 고용지원금을 미리 확인하세요.</p>
              <HiringDiagnosis programs={programs}/>
            </div>
          )}

          {stView[0]==="programs"&&(
            <ProgramsList programs={programs} onUpdate={onSavePrograms}/>
          )}

          </div>
        </div>
      </div>

      {/* Add Company Modal */}
      {stAddComp[0]&&(
        <CompanyEditModal open={true} onClose={function(){stAddComp[1](false);}} company={null} programs={programs}
          onSave={function(data){
            var prog=Object.values(DEFAULT_PROGRAMS)[0];
            var defaultDocs=COMPANY_DEFAULT_DOCS.reduce(function(acc,cat){return acc.concat(cat.docs.map(function(d){return{id:uid(),label:d,done:false,files:[]};}));},[]);
            var newComp=Object.assign({id:ruuid(),createdAt:new Date().toISOString(),companyDocs:defaultDocs},data);
            onSaveCompany(newComp);
            stAddComp[1](false);
            goCompany(newComp.id);
            toast("업체가 등록되었습니다.","success");
          }}
        />
      )}

      {/* Cmd+K 검색 팔레트 */}
      <CmdKSearch
        open={stCmdK[0]}
        onClose={function(){stCmdK[1](false);}}
        companies={companies}
        employees={employees}
        programs={programs}
        goCompany={goCompany}
        setView={function(v){stView[1](v);stCompany[1](null);}}
      />

      {/* Profile Modal */}
      <Modal open={stProfileOpen[0]} onClose={function(){stProfileOpen[1](false);}} title="👤 프로필 설정" width={420}>
        <div style={{display:"grid",gap:16}}>
          <div><Label>이름/담당자명</Label><input style={inp} value={stPN[0]} onChange={function(e){stPN[1](e.target.value);}} placeholder="홍길동"/></div>
          <div><Label>직함</Label><input style={inp} value={stPT[0]} onChange={function(e){stPT[1](e.target.value);}} placeholder="공인노무사 / 팀장 ..."/></div>
          <div><Label>D-Day 알림 기준 (일)</Label><input type="number" style={inp} value={stDDA[0]} onChange={function(e){stDDA[1](Number(e.target.value));}} min={1} max={30}/></div>
          <div style={{padding:"13px 15px",background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:10}}>
            <div style={{fontSize:13,fontWeight:700,color:"#334155",marginBottom:8,display:"flex",alignItems:"center",gap:6}}><span>🔒</span>데이터 보호 안내</div>
            <ul style={{margin:0,paddingLeft:18,fontSize:12.5,color:"#475569",lineHeight:1.7}}>
              <li>고객사·직원 정보는 계정(조직)별로 분리되어 저장됩니다.</li>
              <li>민감정보 보호를 위해 주민등록번호 전체는 저장하지 않으며, 생년월일·성별만 보관합니다.</li>
              <li>서류 파일은 비공개 저장소에 보관되어 권한 있는 사용자만 임시 링크로 열람합니다.</li>
            </ul>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button style={btnS} onClick={function(){stProfileOpen[1](false);}}>취소</button>
            <button style={Object.assign({},btnP,{padding:"11px 32px"})} onClick={saveProfile}>저장</button>
          </div>
        </div>
      </Modal>
      <ProductTour open={stTour[0]} onClose={endTour}/>
      <ToastHost/>
    </div>
  );
}
