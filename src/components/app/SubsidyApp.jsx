import React, { useState, useEffect, useMemo, useRef } from "react";
import { TeamSettings } from "../TeamSettings";

// ── 상수 ──────────────────────────────────────────────────
var MIN_WAGE_2026 = 10320;
var MIN_WAGE_MONTH_2026 = 2156880;
var BOSU_FLOOR_2026 = 1240000;
var GROUP_COLORS = {
  "신규채용":{base:"#2563EB",light:"#DBEAFE",text:"#1D4ED8",dark:"#1E40AF",badge:"#EFF6FF",icon:"🆕"},
  "재직자유지":{base:"#7C3AED",light:"#EDE9FE",text:"#6D28D9",dark:"#5B21B6",badge:"#F5F3FF",icon:"🔄"},
  "육아":{base:"#059669",light:"#D1FAE5",text:"#047857",dark:"#065F46",badge:"#ECFDF5",icon:"🤱"},
  "커스텀":{base:"#6B7280",light:"#F1F5F9",text:"#4B5563",dark:"#374151",badge:"#F8FAFC",icon:"⚙️"}
};
function gc(group,key){ var g=GROUP_COLORS[group]||GROUP_COLORS["커스텀"]; return g[key]||g.base; }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).substr(2,6); }
function fD(ds){ if(!ds) return ""; var d=new Date(ds); return d.getFullYear()+"."+(d.getMonth()+1)+"."+d.getDate(); }
function fDFull(ds){ if(!ds) return ""; var d=new Date(ds); return d.getFullYear()+"년 "+(d.getMonth()+1)+"월 "+d.getDate()+"일"; }
function fMan(n){ var v=Math.abs(n||0); return v>=10000?Math.round(n/10000)+"만원":((n||0).toLocaleString())+"원"; }
function fManS(n){ var v=Math.abs(n||0); return v>=10000?Math.round(n/10000)+"만":String(n||0); }
function addMo(ds,m){ if(!ds) return ""; var d=new Date(ds); d.setMonth(d.getMonth()+m); return d.toISOString().split("T")[0]; }
function getDday(ds){ if(!ds) return null; var today=new Date(); today.setHours(0,0,0,0); var target=new Date(ds); target.setHours(0,0,0,0); return Math.ceil((target-today)/(1000*60*60*24)); }
function formatDday(d){ if(d===null) return ""; if(d===0) return "D-Day"; if(d<0) return "D+"+Math.abs(d); return "D-"+d; }
function isFuture(ds){ if(!ds) return true; return new Date(ds)>new Date(); }
function calcAgeDetailed(b,r){ if(!b) return null; var bd=new Date(b); var rd=r?new Date(r):new Date(); var years=rd.getFullYear()-bd.getFullYear(); var months=rd.getMonth()-bd.getMonth(); if(rd.getDate()<bd.getDate()) months--; if(months<0){years--;months+=12;} return {years:years,months:months,totalMonths:years*12+months}; }
function cAge(b,r){ var d=calcAgeDetailed(b,r); return d?d.years:null; }
function calcMilitaryLimit(milMonths){ var base=34*12; var ext=base+(milMonths||0); var capped=Math.min(ext,39*12); return{maxTotalMonths:capped,maxYears:Math.floor(capped/12),maxRemainMonths:capped%12,isBorderline:milMonths>0&&capped>34*12}; }
function fDateTime(ds){ if(!ds) return ""; var d=new Date(ds); var y=d.getFullYear(); var mo=d.getMonth()+1; var day=d.getDate(); var h=d.getHours(); var mi=d.getMinutes(); var ampm=h>=12?"오후":"오전"; var h12=h%12; if(h12===0)h12=12; return y+"."+mo+"."+day+" "+ampm+" "+h12+":"+(mi<10?"0"+mi:mi); }
function parseJumin(jumin){ if(!jumin||jumin.length<7) return null; var clean=jumin.replace(/[^0-9]/g,""); if(clean.length<7) return null; var yy=parseInt(clean.substring(0,2)); var mm=parseInt(clean.substring(2,4)); var dd=parseInt(clean.substring(4,6)); var gc2=parseInt(clean.substring(6,7)); var century=1900; var gender="male"; if(gc2===1||gc2===2){century=1900;}else if(gc2===3||gc2===4){century=2000;}else if(gc2===9||gc2===0){century=1800;} if(gc2%2===0){gender="female";} var year=century+yy; var bd=year+"-"+(mm<10?"0"+mm:mm)+"-"+(dd<10?"0"+dd:dd); return{birthDate:bd,gender:gender,year:year}; }
function checkWage(monthlyPay,weeklyHours){ if(!monthlyPay||monthlyPay<=0) return null; var wh=weeklyHours||40; var mh=wh>=40?209:Math.round((wh+(wh>=15?wh/40*8:0))*4.345); var hourlyWage=Math.round(monthlyPay/mh); var minMonthly=Math.round(MIN_WAGE_2026*mh); return{hourlyWage:hourlyWage,monthlyHours:mh,minMonthly:minMonthly,minHourly:MIN_WAGE_2026,isAboveMin:hourlyWage>=MIN_WAGE_2026,isAboveFloor:monthlyPay>=BOSU_FLOOR_2026,gap:hourlyWage-MIN_WAGE_2026}; }
function makeExcelData(companies,employees,programs){ var rows=[["업체명","사업자번호","대표자","직원명","지원금","상태","입사일","총예정","수령완료"]]; employees.forEach(function(emp){ var c=companies.find(function(x){return x.id===emp.companyId;}); var p=programs[emp.programId]; var st=STS.find(function(s){return s.key===emp.status;}); var rcv=(emp.rounds||[]).reduce(function(s,r){return s+(r.isPaid?r.received||0:0);},0); rows.push([c?c.name:"",c?c.bizNo||"":"",c?c.ceoName||"":"",emp.name,p?p.name:"",st?st.label:"",emp.startDate||"",emp.totalExpected||0,rcv]); }); return rows.map(function(r){return r.join("\t");}).join("\n"); }
function makeExcelTemplate(){ return "이름\t주민번호앞7자리\t입사일\t연락처\t이메일\t지원금ID\n예시직원\t9501011\t2026-01-15\t010-1234-5678\thong@email.com\tyouth_jump"; }
function parseExcelData(text,programs){ var lines=text.trim().split("\n"); if(lines.length<2) return []; var results=[]; for(var i=1;i<lines.length;i++){ var cols=lines[i].split("\t"); if(cols.length<3) continue; var name=(cols[0]||"").trim(); var parsed=parseJumin((cols[1]||"").trim()); if(!name) continue; var pid=(cols[5]||"youth_jump").trim(); results.push({name:name,birthDate:parsed?parsed.birthDate:"2000-01-01",gender:parsed?parsed.gender:"male",startDate:(cols[2]||"").trim(),phone:(cols[3]||"").trim(),email:(cols[4]||"").trim(),programId:programs[pid]?pid:"youth_jump"}); } return results; }

// ── 지원금 데이터 ───────────────────────────────────────────
var DEFAULT_PROGRAMS = {
  youth_jump:{id:"youth_jump",name:"청년일자리도약장려금",year:2026,group:"신규채용",color:"#1D4ED8",totalAmount:7200000,rounds:[{month:6,amount:3600000,label:"1차(6개월)"},{month:9,amount:1800000,label:"2차(9개월)"},{month:12,amount:1800000,label:"3차(12개월)"}],companyDocs:["사업자등록증","사업참여신청서","사업주확인서","협약서","기업통장사본","4대보험가입자명부","개인정보동의서(사업주)","고용보험취득확인서"],employeeDocs:["근로계약서","임금대장(6개월)","급여이체확인서류","개인정보동의서(근로자)","최종학력확인서(졸업증명서)","사실증명확인서"],hasEligibility:true,isCustom:false,isBuiltIn:true,note:"수도권: 기업 720만(취업애로요건 필수). 비수도권: 기업 720만+청년 근속인센티브 480~720만. 사전신청 후 채용(예외: 입사일 기준 3개월 내). 6개월 유지 후 1차 지급.",applyUrl:"고용24(work24.go.kr)",match:{cats:["청년"],ageMin:15,ageMax:34,milExtend:true,gender:"any",empTypes:["정규직"],preApply:true,companyMax:null,regionSensitive:true,bosuFloor:true}},
  work_exp:{id:"work_exp",name:"미래내일 일경험",year:2026,group:"신규채용",color:"#3B82F6",totalAmount:1400000,rounds:[{month:1,amount:200000,label:"1개월"},{month:2,amount:200000,label:"2개월"},{month:3,amount:200000,label:"3개월"},{month:4,amount:200000,label:"4개월"}],companyDocs:["사업자등록증","사업참여신청서","운영계획서","협약서","개인정보동의서"],employeeDocs:["참여신청서","동의서및서약서","출근부","수당지급확인서"],isCustom:false,isBuiltIn:true,note:"인턴형 기준 기업 월20만+멘토수당 별도. 청년 주35만 수당. 기업 고용보험 10인↑(예외 벤처/이노/메인). 청년 미취업·사업자등록 불가.",applyUrl:"고용24 / 1811-8447",match:{cats:["청년"],ageMin:15,ageMax:34,milExtend:true,gender:"any",empTypes:["인턴"],preApply:true,companyMax:null,regionSensitive:false,bosuFloor:false}},
  saeil_women:{id:"saeil_women",name:"새일여성인턴제",year:2026,group:"신규채용",color:"#0EA5E9",totalAmount:4000000,rounds:[{month:1,amount:800000,label:"인턴1개월"},{month:2,amount:800000,label:"인턴2개월"},{month:3,amount:800000,label:"인턴3개월"},{month:9,amount:800000,label:"고용유지1차"},{month:15,amount:800000,label:"고용유지2차"}],companyDocs:["사업자등록증","사업참여신청서","인턴약정서","협약서","기업통장사본"],employeeDocs:["구직등록확인서","근로계약서","임금대장","급여이체확인서류"],isCustom:false,isBuiltIn:true,note:"기업 최대 400만. 새일센터 연계·인턴약정 먼저. 고용보험 5인↑~1000인미만. 가족채용 영구배제.",applyUrl:"여성새로일하기센터(saeil.mogef.go.kr)",match:{cats:["여성"],ageMin:null,ageMax:null,gender:"female",empTypes:["인턴","정규직"],preApply:true,companyMax:1000,regionSensitive:false,bosuFloor:false,special:["경력단절"]}},
  emp_promo:{id:"emp_promo",name:"고용촉진장려금",year:2026,group:"신규채용",color:"#0284C7",totalAmount:7200000,rounds:[{month:6,amount:3600000,label:"1회차(6개월)"},{month:12,amount:3600000,label:"2회차(12개월)"}],companyDocs:["사업자등록증","고용촉진장려금 지급신청서","근로계약서","고용보험확인서"],employeeDocs:["근로계약서","월별급여대장","급여이체증빙","취업지원프로그램 이수증"],isCustom:false,isBuiltIn:true,note:"우선지원/중견 연 720만. 취업지원프로그램 이수자·중증장애인·여성가장 정규직. 보수 124만↑. 12개월 내 첫 신청.",applyUrl:"고용24(work24.go.kr)",match:{cats:["취약계층"],ageMin:null,ageMax:null,gender:"any",empTypes:["정규직"],preApply:false,companyMax:null,regionSensitive:false,bosuFloor:true,special:["프로그램이수"]}},
  senior_intern:{id:"senior_intern",name:"시니어 인턴십",year:2026,group:"신규채용",color:"#2563EB",totalAmount:5500000,rounds:[{month:3,amount:1200000,label:"1단계(3개월)"},{month:9,amount:1500000,label:"2단계(6개월)"},{month:18,amount:900000,label:"3단계(18개월)"},{month:24,amount:900000,label:"3단계(24개월)"},{month:36,amount:1000000,label:"3단계(36개월)"}],companyDocs:["사업자등록증","사업참여신청서","협약서","4대보험가입자명부"],employeeDocs:["근로계약서","사전교육 이수증","월별급여대장"],isCustom:false,isBuiltIn:true,note:"일반형 최대 550만. 만60세↑. 한국노인인력개발원 사전승인 필수. 요양보호사·경비·청소 등 단순노무 제외.",applyUrl:"한국노인인력개발원 / seniorro.or.kr",match:{cats:["고령자"],ageMin:60,ageMax:null,gender:"any",empTypes:["정규직","인턴"],preApply:true,companyMax:null,regionSensitive:false,bosuFloor:false}},
  disabled_emp:{id:"disabled_emp",name:"장애인 고용장려금",year:2026,group:"신규채용",color:"#1E3A5F",totalAmount:5400000,rounds:[{month:1,amount:450000,label:"월(예시·중증여)"}],companyDocs:["고용장려금 지급신청서","장애인 근로자 명부","근로계약서"],employeeDocs:["장애인증명서","근로계약서","월별임금대장"],isCustom:false,isBuiltIn:true,note:"경증 남35/여50, 중증 남70/여90만 매월. 고용보험 가입+최저임금↑ 필수.",applyUrl:"한국장애인고용공단 e-신고(esingo.or.kr)",match:{cats:["장애인"],ageMin:null,ageMax:null,gender:"any",empTypes:["정규직","계약직"],preApply:false,companyMax:null,regionSensitive:false,bosuFloor:false,special:["장애"]}},
  regular_convert:{id:"regular_convert",name:"정규직 전환 지원금",year:2026,group:"재직자유지",color:"#7C3AED",totalAmount:7200000,rounds:[{month:3,amount:1800000,label:"1차(3개월)"},{month:6,amount:1800000,label:"2차(6개월)"},{month:9,amount:1800000,label:"3차(9개월)"},{month:12,amount:1800000,label:"4차(12개월)"}],companyDocs:["사업참여신청서","정규직전환 근로계약서","사업자등록증","취업규칙"],employeeDocs:["전환 전 근로계약서","전환 후 근로계약서","월별임금대장"],isCustom:false,isBuiltIn:true,note:"기본 월40만+임금인상보전 월20만=연720. 5~30인미만. 2026 예산 한정·상반기 사전승인 필수. 6개월↑ 기간제→정규직. 먼저 전환하면 0원.",applyUrl:"고용24(work24.go.kr)",match:{cats:["재직"],ageMin:null,ageMax:null,gender:"any",empTypes:["계약직"],preApply:true,companyMax:30,regionSensitive:false,bosuFloor:true,special:["정규직전환"]}},
  senior_continue:{id:"senior_continue",name:"고령자 계속고용 장려금",year:2026,group:"재직자유지",color:"#9333EA",totalAmount:7200000,rounds:[{month:3,amount:900000,label:"1분기"},{month:6,amount:900000,label:"2분기"},{month:9,amount:900000,label:"3분기"},{month:12,amount:900000,label:"4분기"}],companyDocs:["지급신청서","취업규칙(정년 명문화)","재고용 근로계약서"],employeeDocs:["근로계약서","월별임금대장"],isCustom:false,isBuiltIn:true,note:"수도권 분기90만 2년 최대720. 비수도권 분기120만 3년 최대1440(2026). 정년연장/폐지/재고용 취업규칙 필수. 100인미만.",applyUrl:"고용24(work24.go.kr)",match:{cats:["고령자","재직"],ageMin:55,ageMax:null,gender:"any",empTypes:["정규직"],preApply:false,companyMax:100,regionSensitive:true,bosuFloor:false,special:["정년도달"]}},
  worklife45:{id:"worklife45",name:"워라밸+4.5 프로젝트",year:2026,group:"재직자유지",color:"#A855F7",totalAmount:7200000,rounds:[{month:3,amount:1800000,label:"1분기"},{month:6,amount:1800000,label:"2분기"},{month:9,amount:1800000,label:"3분기"},{month:12,amount:1800000,label:"4분기"}],companyDocs:["노사합의서","사업참여신청서(재단)","근태관리 증빙","취업규칙"],employeeDocs:["변경 근로계약서"],isCustom:false,isBuiltIn:true,note:"기존직원 부분단축 연240/전면단축 연720. 신규채용 보너스 별도. 20인↑. 노사발전재단(nosa.or.kr) 사전신청.",applyUrl:"노사발전재단(nosa.or.kr)",match:{cats:["재직"],ageMin:null,ageMax:null,gender:"any",empTypes:["정규직"],preApply:true,companyMin:20,companyMax:null,regionSensitive:false,bosuFloor:false,special:["주4.5일제"]}},
  parental_leave:{id:"parental_leave",name:"육아휴직 지원금(사업주)",year:2026,group:"육아",color:"#059669",totalAmount:3600000,rounds:[{month:3,amount:900000,label:"1차(3개월)"},{month:6,amount:900000,label:"2차(6개월)"},{month:9,amount:900000,label:"3차(9개월)"},{month:12,amount:900000,label:"4차(12개월)"}],companyDocs:["육아휴직 확인서","사업자등록증","근로계약서"],employeeDocs:["육아휴직 신청서","가족관계증명서","휴직 발령 증빙"],isCustom:false,isBuiltIn:true,note:"사업주 월30만(남성 +10만). 생후12개월내 특례 첫3개월 월100만. 우선지원대상+30일↑ 허용.",applyUrl:"고용24(work24.go.kr)",match:{cats:["육아"],ageMin:null,ageMax:null,gender:"any",empTypes:["정규직"],preApply:false,companyMax:null,regionSensitive:false,bosuFloor:true,special:["육아휴직"]}},
  parental_reduce:{id:"parental_reduce",name:"육아기 근로시간 단축(사업주)",year:2026,group:"육아",color:"#10B981",totalAmount:3600000,rounds:[{month:3,amount:900000,label:"1차(3개월)"},{month:6,amount:900000,label:"2차(6개월)"},{month:9,amount:900000,label:"3차(9개월)"},{month:12,amount:900000,label:"4차(12개월)"}],companyDocs:["근로시간 단축 확인서","사업자등록증","변경 근로계약서"],employeeDocs:["단축 신청서","가족관계증명서","변경 근로계약서"],isCustom:false,isBuiltIn:true,note:"사업주 월30만(남성 +10만). 근로자 단축급여 월최대250만. 만12세↓ 자녀, 최대3년.",applyUrl:"고용24(work24.go.kr)",match:{cats:["육아"],ageMin:null,ageMax:null,gender:"any",empTypes:["정규직"],preApply:false,companyMax:null,regionSensitive:false,bosuFloor:true,special:["근로시간단축"]}},
  replace_worker:{id:"replace_worker",name:"대체인력 지원금",year:2026,group:"육아",color:"#047857",totalAmount:21000000,rounds:[{month:1,amount:1400000,label:"월(예시·30인미만)"}],companyDocs:["대체인력 채용 증빙","육아휴직 확인서","사업자등록증"],employeeDocs:["대체인력 근로계약서","월별임금대장","급여이체증빙"],isCustom:false,isBuiltIn:true,note:"육아휴직 대체 30인미만 월최대140(최대15개월=2100). 100% 즉시 선지급. 채용전3개월~후1년 감원 시 전액환수.",applyUrl:"고용24 + 인재채움뱅크",match:{cats:["육아"],ageMin:null,ageMax:null,gender:"any",empTypes:["계약직","정규직"],preApply:false,companyMax:null,regionSensitive:false,bosuFloor:true,special:["대체인력"]}},
  work_share:{id:"work_share",name:"동료 업무분담 지원금",year:2026,group:"육아",color:"#34D399",totalAmount:600000,rounds:[{month:1,amount:600000,label:"월(예시)"}],companyDocs:["업무분담수당 지급 증빙","육아휴직 확인서"],employeeDocs:["임금명세서(업무분담수당 명시)"],isCustom:false,isBuiltIn:true,note:"육아휴직 분담 30인미만 월최대60(2026 3배인상). 대체인력과 중복불가.",applyUrl:"고용24(work24.go.kr)",match:{cats:["육아"],ageMin:null,ageMax:null,gender:"any",empTypes:["정규직"],preApply:false,companyMax:null,regionSensitive:false,bosuFloor:false,special:["업무분담"]}}
};

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
  {key:"preparing",label:"준비중",color:"#F59E0B",bg:"#FEF3C7",icon:"⏳"},
  {key:"submitted",label:"서류접수",color:"#3B82F6",bg:"#DBEAFE",icon:"📨"},
  {key:"reviewing",label:"심사중",color:"#8B5CF6",bg:"#EDE9FE",icon:"🔍"},
  {key:"approved",label:"승인",color:"#10B981",bg:"#D1FAE5",icon:"✅"},
  {key:"inprogress",label:"지급중",color:"#0EA5E9",bg:"#E0F2FE",icon:"💸"},
  {key:"completed",label:"최종지급완료",color:"#059669",bg:"#A7F3D0",icon:"🎉"},
  {key:"resigned",label:"퇴사",color:"#94A3B8",bg:"#F1F5F9",icon:"🚪"}
];
var TAGS = [
  {id:"vip",label:"VIP",color:"#EAB308",bg:"#FEF9C3"},
  {id:"new",label:"신규",color:"#3B82F6",bg:"#DBEAFE"},
  {id:"caution",label:"주의",color:"#EF4444",bg:"#FEE2E2"},
  {id:"priority",label:"우선",color:"#8B5CF6",bg:"#EDE9FE"},
  {id:"hold",label:"보류",color:"#D97706",bg:"#FEF3C7"},
  {id:"stop",label:"중단",color:"#6B7280",bg:"#E5E7EB"},
  {id:"star",label:"⭐즐겨찾기",color:"#F97316",bg:"#FFEDD5"}
];
var CERT_TYPES = [
  {id:"venture",label:"벤처기업 인증",color:"#8B5CF6"},
  {id:"innobiz",label:"이노비즈 인증",color:"#059669"},
  {id:"mainbiz",label:"메인비즈 인증",color:"#2563EB"},
  {id:"research",label:"기업부설연구소",color:"#DC2626"},
  {id:"family",label:"가족친화기업",color:"#EC4899"},
  {id:"youth",label:"청년친화기업",color:"#0EA5E9"},
  {id:"other",label:"기타",color:"#6B7280"}
];
var COMMON_EXTRA_DOCS = ["신분증 사본","근로자 통장사본","연차사용 증빙","재직증명서","사직서","육아휴직서","주민등록등본","원천징수영수증","4대보험 가입확인서","운영기관 자체 서식"];

// ── 스타일 상수 ──────────────────────────────────────────
var FF = "'Noto Sans KR',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
var inp = {width:"100%",padding:"11px 15px",borderRadius:10,border:"1.5px solid #E2E8F0",fontSize:15,outline:"none",boxSizing:"border-box",fontFamily:FF,color:"#1E293B",background:"#fff",transition:"border-color 0.15s"};
var inpKo = Object.assign({},inp,{lang:"ko"});
var btnP = {background:"linear-gradient(135deg,#1D4ED8,#2563EB)",color:"#fff",border:"none",borderRadius:10,padding:"11px 22px",fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:FF,boxShadow:"0 2px 8px rgba(37,99,235,0.25)"};
var btnS = {background:"#fff",color:"#475569",border:"1.5px solid #E2E8F0",borderRadius:10,padding:"11px 22px",fontSize:15,fontWeight:500,cursor:"pointer",fontFamily:FF};
var btnSm = {background:"#F8FAFC",color:"#64748B",border:"1px solid #E2E8F0",borderRadius:8,padding:"7px 14px",fontSize:13,cursor:"pointer",fontFamily:FF};

// ── 기본 UI 컴포넌트 ─────────────────────────────────────
function Modal(props){ if(!props.open) return null; return(<div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={props.onClose}><div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:props.width||600,maxHeight:"90vh",overflow:"auto"}} onClick={function(e){e.stopPropagation();}}><div style={{padding:"18px 24px",borderBottom:"1px solid #F1F5F9",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:"#fff",zIndex:1}}><h3 style={{margin:0,fontSize:17,fontWeight:700}}>{props.title}</h3><button onClick={props.onClose} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"#94A3B8"}}>✕</button></div><div style={{padding:24}}>{props.children}</div></div></div>); }
function Label(props){ return <label style={{fontSize:13,fontWeight:600,color:props.color||"#475569",marginBottom:4,display:"block"}}>{props.children}</label>; }
function Card(props){ return <div onClick={props.onClick} style={Object.assign({background:"#fff",borderRadius:14,border:"1px solid #F1F5F9",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"},props.style||{})}>{props.children}</div>; }
function Badge(props){ return <span style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,background:props.bg||"#EFF6FF",color:props.color||"#2563EB",whiteSpace:"nowrap",display:"inline-block"}}>{props.children}</span>; }
function DdayBadge(props){ var d=props.dday; if(d===null) return null; var bg="#F1F5F9",color="#64748B"; if(d<=0){bg="#FEE2E2";color="#DC2626";}else if(d<=3){bg="#FEF3C7";color="#D97706";}else if(d<=7){bg="#DBEAFE";color="#2563EB";} return <span style={{fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:4,background:bg,color:color}}>{formatDday(d)}</span>; }
function Notice(props){ return <div style={{padding:"8px 12px",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:8,fontSize:11,color:"#92400E",lineHeight:1.5,marginBottom:8}}>{props.children}</div>; }

// ── FileAt: 클라우드 파일 업로드 지원 ───────────────────
function FileAt(props){
  var ref=useRef(); var camRef=useRef(); var disabled=props.disabled;
  var uploadFn=props.uploadFn; var getUrlFn=props.getUrlFn;
  var stUp=useState(false); var uploading=stUp[0],setUploading=stUp[1];

  async function handleFile(file, nameOverride){
    if(disabled||uploading) return;
    if(uploadFn){
      setUploading(true);
      try{
        var f2 = nameOverride ? new File([file],nameOverride,{type:file.type}) : file;
        var obj = await uploadFn(f2);
        props.onAdd(obj);
      }catch(e){ alert("파일 업로드 실패: "+(e.message||"오류")); }
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
      catch(e){ alert("파일 열기 실패"); }
    }else if(f.dataUrl){ window.open(f.dataUrl,"_blank"); }
  }

  return(
    <div>
      <input ref={ref} type="file" accept="image/*,.pdf,.doc,.docx" style={{display:"none"}} onChange={function(e){ if(disabled) return; var f=e.target.files&&e.target.files[0]; if(!f) return; handleFile(f,null); e.target.value=""; }}/>
      <input ref={camRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={function(e){ if(disabled) return; var f=e.target.files&&e.target.files[0]; if(!f) return; handleFile(f,"사진_"+fD(new Date())+".jpg"); e.target.value=""; }}/>
      <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
        {(props.files||[]).map(function(f){
          var isImg=f.type&&f.type.startsWith("image/");
          var canView=isImg||f.storagePath||f.dataUrl;
          return(<div key={f.id} style={{display:"inline-flex",alignItems:"center",gap:3,background:disabled?"#F1F5F9":"#EFF6FF",border:disabled?"1px solid #E2E8F0":"1px solid #BFDBFE",borderRadius:6,padding:"2px 7px",fontSize:11,opacity:disabled?0.6:1,cursor:canView?"pointer":"default"}} onClick={canView?function(){viewFile(f);}:undefined} title={f.name}>
            <span style={{color:disabled?"#94A3B8":"#1D4ED8",maxWidth:70,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{isImg?"🖼️":"📎"}{f.name}</span>
            {!disabled&&<button onClick={function(e){e.stopPropagation();props.onRemove(f.id);}} style={{background:"none",border:"none",color:"#94A3B8",cursor:"pointer",fontSize:12,padding:0}}>×</button>}
          </div>);
        })}
        {uploading&&<span style={{fontSize:11,color:"#94A3B8"}}>업로드 중...</span>}
        {!disabled&&!uploading&&(<React.Fragment>
          <button onClick={function(){camRef.current&&camRef.current.click();}} style={{background:"#FEF3C7",border:"1px solid #FDE68A",borderRadius:6,padding:"2px 7px",fontSize:11,color:"#D97706",cursor:"pointer"}} title="카메라">📷</button>
          <button onClick={function(){ref.current&&ref.current.click();}} style={{background:"#F8FAFC",border:"1px dashed #CBD5E1",borderRadius:6,padding:"2px 7px",fontSize:11,color:"#64748B",cursor:"pointer"}} title="파일">📁</button>
        </React.Fragment>)}
      </div>
    </div>
  );
}

function ChkItem(props){
  var item=props.item; var isDisabled=props.disabled;
  return(
    <div style={{padding:"8px 12px",borderRadius:10,background:isDisabled?"#F1F5F9":(item.done?"#F0FDF4":"#FFFBEB"),border:isDisabled?"1px solid #E2E8F0":(item.done?"1px solid #BBF7D0":"1px solid #FDE68A"),opacity:isDisabled?0.6:1}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:4,marginBottom:3}}>
        <label style={{display:"flex",alignItems:"center",gap:8,cursor:isDisabled?"not-allowed":"pointer",flex:1}}>
          <input type="checkbox" checked={item.done} onChange={isDisabled?undefined:props.onToggle} disabled={isDisabled} style={{width:16,height:16,accentColor:"#10B981"}}/>
          <span style={{fontSize:13,color:isDisabled?"#94A3B8":(item.done?"#16A34A":"#92400E"),textDecoration:item.done?"line-through":"none"}}>{item.label}{item.isCustom&&<span style={{fontSize:9,color:"#94A3B8",marginLeft:3}}>(추가)</span>}</span>
        </label>
        {!isDisabled&&props.onDelete&&<button onClick={props.onDelete} style={{background:"none",border:"none",color:"#CBD5E1",cursor:"pointer",fontSize:13}} title="삭제">🗑️</button>}
      </div>
      {!isDisabled&&<div style={{marginLeft:24}}><FileAt files={item.files||[]} onAdd={props.onFA} onRemove={props.onFR} uploadFn={props.uploadFn} getUrlFn={props.getUrlFn}/></div>}
    </div>
  );
}

function DocSection(props){
  var docs=props.docs||[]; var disabled=props.disabled;
  var uploadFn=props.uploadFn; var getUrlFn=props.getUrlFn;
  var st1=useState(false); var showAdd=st1[0],setShowAdd=st1[1];
  var st2=useState(""); var newName=st2[0],setNewName=st2[1];
  var done=docs.filter(function(d){return d.done;}).length;
  function addDoc(name){ if(!name||!name.trim()) return; props.onChange(docs.concat([{id:uid(),label:name.trim(),done:false,files:[],isCustom:true}])); setNewName(""); setShowAdd(false); }
  function delDoc(idx){ props.onChange(docs.filter(function(_,i){return i!==idx;})); }
  return(
    <Card style={{padding:"12px 16px",marginBottom:props.mb||12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <h4 style={{margin:0,fontSize:13,fontWeight:700}}>{props.icon} {props.title}</h4>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <Badge color={done===docs.length&&docs.length>0?"#059669":"#D97706"} bg={done===docs.length&&docs.length>0?"#D1FAE5":"#FEF3C7"}>{done}/{docs.length}</Badge>
          {!disabled&&<button style={Object.assign({},btnSm,{padding:"4px 10px",fontSize:11})} onClick={function(){setShowAdd(!showAdd);}}>+ 서류</button>}
        </div>
      </div>
      {showAdd&&!disabled&&(
        <div style={{marginBottom:8,padding:10,background:"#F8FAFC",borderRadius:8}}>
          <div style={{display:"flex",gap:4,marginBottom:6}}>
            <input style={Object.assign({},inpKo,{flex:1,fontSize:12,padding:"6px 10px"})} value={newName} onChange={function(e){setNewName(e.target.value);}} placeholder="추가할 서류명" onKeyDown={function(e){if(e.key==="Enter")addDoc(newName);}}/>
            <button style={Object.assign({},btnP,{padding:"6px 12px",fontSize:11})} onClick={function(){addDoc(newName);}}>추가</button>
          </div>
          <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>{COMMON_EXTRA_DOCS.map(function(d){return <button key={d} onClick={function(){addDoc(d);}} style={{fontSize:10,padding:"3px 8px",borderRadius:6,border:"1px solid #E2E8F0",background:"#fff",color:"#475569",cursor:"pointer"}}>+{d}</button>;})}</div>
        </div>
      )}
      {docs.length===0?<p style={{margin:0,fontSize:12,color:"#94A3B8"}}>서류 없음</p>:(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:3}}>
          {docs.map(function(d,i){return <ChkItem key={d.id||i} item={d} disabled={disabled}
            uploadFn={uploadFn} getUrlFn={getUrlFn}
            onToggle={function(){var ds=docs.slice();ds[i]=Object.assign({},ds[i],{done:!ds[i].done});props.onChange(ds);if(props.onLog)props.onLog("서류"+(ds[i].done?"✓":"○")+d.label);}}
            onDelete={function(){delDoc(i);}}
            onFA={function(f){var ds=docs.slice();ds[i]=Object.assign({},ds[i],{files:(ds[i].files||[]).concat([f])});props.onChange(ds);}}
            onFR={function(fid){var ds=docs.slice();ds[i]=Object.assign({},ds[i],{files:(ds[i].files||[]).filter(function(f){return f.id!==fid;})});props.onChange(ds);}}/>;
          })}
        </div>
      )}
    </Card>
  );
}

// ── 진단·계산기 컴포넌트 ─────────────────────────────────
var DIAG_CATS=[{id:"청년",label:"청년 (만 15~34세)",icon:"🧑"},{id:"여성",label:"경력단절 여성",icon:"👩"},{id:"고령자",label:"만 60세 이상",icon:"👴"},{id:"장애인",label:"장애인",icon:"♿"},{id:"취약계층",label:"취업취약계층(프로그램 이수)",icon:"🪪"},{id:"일반",label:"해당 없음/일반",icon:"👤"}];

function diagnoseHiring(a,programs){ var results=[]; Object.keys(programs).forEach(function(key){ var p=programs[key]; var m=p.match||{}; var score=0; var reasons=[]; var blockers=[]; if(m.deprecated){results.push({program:p,status:"exclude",score:0,reasons:["2026년 신규 종료"],blockers:[]});return;} var catHit=(m.cats||[]).some(function(c){return(a.cats||[]).indexOf(c)>=0;}); if(catHit){score+=40;reasons.push("대상 유형 일치");} if(m.special&&m.special.length){var spHit=m.special.some(function(s){return(a.specials||[]).indexOf(s)>=0;});if(spHit){score+=35;reasons.push("상황 조건 일치");}} if(m.ageMin!=null||m.ageMax!=null){var maxAge=m.ageMax; if(m.milExtend&&a.gender==="male"&&a.milMonths>0){maxAge=calcMilitaryLimit(a.milMonths).maxYears;} if(a.age!=null){var ageOk=true; if(m.ageMin!=null&&a.age<m.ageMin)ageOk=false; if(maxAge!=null&&a.age>maxAge)ageOk=false; if(ageOk){score+=15;reasons.push("나이 요건 충족");}else{blockers.push("나이 요건 미충족");}}} if(m.gender&&m.gender!=="any"&&a.gender&&a.gender!==m.gender){blockers.push(m.gender==="female"?"여성 대상 제도":"성별 요건");} if(m.empTypes&&a.empType){if(m.empTypes.indexOf(a.empType)<0)blockers.push("채용형태("+m.empTypes.join("/")+") 요건");else score+=8;} if(m.companyMax!=null&&a.companySize!=null&&a.companySize>=m.companyMax){blockers.push(m.companyMax+"인 미만 대상");} if(m.companyMin!=null&&a.companySize!=null&&a.companySize<m.companyMin){blockers.push(m.companyMin+"인 이상 대상");} if(m.preApply&&a.preApply===false){if(p.id==="youth_jump"){reasons.push("사전신청 원칙(입사 3개월 내 예외)");}else{blockers.push("사전신청 필수");}} if(m.bosuFloor&&a.aboveFloor===false){blockers.push("월보수 124만↑ 필요");} if(a.noLayoff===false){blockers.push("최근 감원 이력—신청 제한");} if(p.id==="youth_jump"&&a.region==="수도권"&&a.youthEligible===false){blockers.push("수도권은 취업애로요건 필수");} if(p.id==="youth_jump"&&a.region==="비수도권"&&catHit){score+=12;reasons.push("비수도권: 기업+청년 합산 가능");} var status; if(blockers.length>0&&!catHit&&score<30)status="exclude"; else if(blockers.length>0)status="maybe"; else if(score>=55)status="recommend"; else if(score>=22)status="maybe"; else status="exclude"; results.push({program:p,status:status,score:score,reasons:reasons,blockers:blockers});}); results.sort(function(x,y){var o={recommend:0,maybe:1,exclude:2}; if(o[x.status]!==o[y.status])return o[x.status]-o[y.status]; return y.score-x.score;}); return results; }

function DiagRow(props){ var r=props.r; var p=r.program; var st1=useState(false); var gp=GROUP_COLORS[p.group]||GROUP_COLORS["커스텀"]; return(<div style={{borderRadius:10,border:"1.5px solid "+gp.light,marginBottom:6,overflow:"hidden",background:gp.badge}}><div style={{padding:"10px 12px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}} onClick={function(){st1[1](!st1[0]);}}><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{width:8,height:8,borderRadius:4,background:gp.base,display:"inline-block"}}></span><Badge color={gp.dark} bg={gp.light}>{gp.icon} {p.group}</Badge><span style={{fontSize:13,fontWeight:700,color:gp.dark}}>{p.name}</span><Badge color={gp.dark} bg="rgba(255,255,255,0.7)">{fMan(p.totalAmount)}</Badge></div><span style={{fontSize:11,color:"#94A3B8"}}>{st1[0]?"▾":"▸"}</span></div>{st1[0]&&(<div style={{padding:"0 12px 12px",borderTop:"1px solid #F8FAFC"}}>{r.reasons.length>0&&<div style={{marginTop:8,fontSize:11,color:"#059669"}}>👍 {r.reasons.join(" · ")}</div>}{r.blockers.length>0&&<div style={{marginTop:6,fontSize:11,color:"#DC2626"}}>⚠️ {r.blockers.join(" · ")}</div>}<div style={{marginTop:8,fontSize:11,color:"#475569",lineHeight:1.5}}>{p.note}</div><div style={{marginTop:6,fontSize:11,color:"#2563EB"}}>📍 {p.applyUrl}</div></div>)}</div>); }

function HiringDiagnosis(props){ var programs=props.programs; var st1=useState("new"),st2=useState([]),st3=useState(""),st4=useState(""),st5=useState(0),st6=useState("수도권"),st7=useState(""),st8=useState("정규직"),st9=useState(true),st10=useState(true),st11=useState(true),st12=useState(true),st13=useState([]),st14=useState(null); function toggle(arr,setArr,v){if(arr.indexOf(v)>=0)setArr(arr.filter(function(x){return x!==v;}));else setArr(arr.concat([v]));} var situation=st1[0]; var SPECIAL_OPTIONS=situation==="retain"?[{id:"정규직전환",label:"비정규직→정규직 전환"},{id:"정년도달",label:"정년 도달 직원"},{id:"유연근무",label:"유연근무 도입"},{id:"주4.5일제",label:"주 4.5일제 도입(20인↑)"}]:situation==="childcare"?[{id:"육아휴직",label:"직원 육아휴직"},{id:"근로시간단축",label:"육아기 근로시간 단축"},{id:"대체인력",label:"빈자리 대체 채용"},{id:"업무분담",label:"동료 업무분담"}]:[]; function runDiagnose(){var cats=st2[0].slice();if(situation==="childcare"&&cats.indexOf("육아")<0)cats.push("육아");if(situation==="retain"&&cats.indexOf("재직")<0)cats.push("재직");var specials=st13[0].slice();if(st2[0].indexOf("여성")>=0)specials.push("경력단절");if(st2[0].indexOf("취약계층")>=0)specials.push("프로그램이수");if(st2[0].indexOf("장애인")>=0)specials.push("장애");var answers={situation:situation,cats:cats,specials:specials,age:st3[0]!==""?Number(st3[0]):null,gender:st4[0]||null,milMonths:Number(st5[0])||0,region:st6[0],companySize:st7[0]!==""?Number(st7[0]):null,empType:st8[0],preApply:st9[0],noLayoff:st10[0],aboveFloor:st11[0],youthEligible:st12[0]};st14[1](diagnoseHiring(answers,programs));} var result=st14[0]; var recommend=result?result.filter(function(r){return r.status==="recommend";}):[];var maybe=result?result.filter(function(r){return r.status==="maybe";}):[];
  function SegBtn(cur,setCur,val,label){var on=cur===val;return <button onClick={function(){setCur(val);}} style={Object.assign({},btnSm,{background:on?"#DBEAFE":"#fff",color:on?"#2563EB":"#64748B",border:on?"2px solid #93C5FD":"1px solid #E2E8F0",fontSize:12})}>{label}</button>;}
  return(<div><div style={{marginBottom:16}}><h3 style={{margin:"0 0 4px",fontSize:18,fontWeight:800}}>🎯 채용 예정 진단</h3><p style={{margin:0,fontSize:12,color:"#64748B"}}>채용 조건을 체크하면 가능성 높은 고용지원금을 안내해드려요. (가능성 안내이며, 실제 신청 전 공고 확인 필요)</p></div>
  <Card style={{padding:18,marginBottom:16}}>
    <div style={{marginBottom:14}}><Label>1. 상황</Label><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>{[["new","신규채용","🆕 신규 채용"],["retain","재직자유지","🔄 재직자 처우개선"],["childcare","육아","🤱 출산·육아"]].map(function(arr){var gp=GROUP_COLORS[arr[1]]||GROUP_COLORS["커스텀"];var on=st1[0]===arr[0];return(<button key={arr[0]} onClick={function(){st1[1](arr[0]);}} style={{padding:"14px 10px",borderRadius:12,cursor:"pointer",textAlign:"center",background:on?gp.base:gp.badge,color:on?"#fff":gp.dark,border:"2px solid "+(on?gp.base:gp.light),fontWeight:on?700:500,fontSize:13}}><div style={{fontSize:22,marginBottom:4}}>{arr[2].split(" ")[0]}</div><div>{arr[2].split(" ").slice(1).join(" ")}</div></button>);})}</div></div>
    {situation==="new"&&(<div style={{marginBottom:14}}><Label>2. 채용 대상자 (복수 선택)</Label><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:6}}>{DIAG_CATS.map(function(c){var on=st2[0].indexOf(c.id)>=0;return <button key={c.id} onClick={function(){toggle(st2[0],st2[1],c.id);}} style={{padding:"8px 10px",borderRadius:8,cursor:"pointer",fontSize:12,textAlign:"left",background:on?"#EFF6FF":"#fff",border:on?"2px solid #93C5FD":"1px solid #E2E8F0",color:on?"#2563EB":"#475569",fontWeight:on?600:400}}>{c.icon} {c.label}</button>;})}</div></div>)}
    {SPECIAL_OPTIONS.length>0&&(<div style={{marginBottom:14}}><Label>2. 구체적 상황 (복수 선택)</Label><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:6}}>{SPECIAL_OPTIONS.map(function(c){var on=st13[0].indexOf(c.id)>=0;return <button key={c.id} onClick={function(){toggle(st13[0],st13[1],c.id);}} style={{padding:"8px 10px",borderRadius:8,cursor:"pointer",fontSize:12,textAlign:"left",background:on?"#EFF6FF":"#fff",border:on?"2px solid #93C5FD":"1px solid #E2E8F0",color:on?"#2563EB":"#475569",fontWeight:on?600:400}}>{c.label}</button>;})}</div></div>)}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:14}}>
      <div><Label>나이(만)</Label><input type="number" style={inp} value={st3[0]} onChange={function(e){st3[1](e.target.value);}} placeholder="29"/></div>
      <div><Label>성별</Label><div style={{display:"flex",gap:4}}>{SegBtn(st4[0],st4[1],"male","남")}{SegBtn(st4[0],st4[1],"female","여")}</div></div>
      {st4[0]==="male"&&<div><Label>군복무(월)</Label><input type="number" style={inp} value={st5[0]} onChange={function(e){st5[1](e.target.value);}} placeholder="18"/></div>}
      <div><Label>회사 규모(고용보험)</Label><input type="number" style={inp} value={st7[0]} onChange={function(e){st7[1](e.target.value);}} placeholder="피보험자 수"/></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:14}}>
      <div><Label>지역</Label><div style={{display:"flex",gap:4}}>{SegBtn(st6[0],st6[1],"수도권","수도권")}{SegBtn(st6[0],st6[1],"비수도권","비수도권")}</div></div>
      <div><Label>채용형태</Label><div style={{display:"flex",gap:3,flexWrap:"wrap"}}>{["정규직","계약직","인턴","대체인력"].map(function(t){return SegBtn(st8[0],st8[1],t,t);})}</div></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:8,marginBottom:14}}>
      {[["채용 전(사전신청 가능)",st9],["최근 감원 이력 없음",st10],["월보수 124만원 이상",st11]].map(function(arr,i){var st=arr[1];return(<label key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:8,background:st[0]?"#F0FDF4":"#FEF2F2",border:st[0]?"1px solid #BBF7D0":"1px solid #FECACA",cursor:"pointer",fontSize:12}}><input type="checkbox" checked={st[0]} onChange={function(){st[1](!st[0]);}} style={{width:15,height:15,accentColor:"#10B981"}}/><span style={{color:st[0]?"#16A34A":"#DC2626"}}>{arr[0]}</span></label>);})}
      {st2[0].indexOf("청년")>=0&&st6[0]==="수도권"&&(<label style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:8,background:st12[0]?"#F0FDF4":"#FEF2F2",border:st12[0]?"1px solid #BBF7D0":"1px solid #FECACA",cursor:"pointer",fontSize:12}}><input type="checkbox" checked={st12[0]} onChange={function(){st12[1](!st12[0]);}} style={{width:15,height:15,accentColor:"#10B981"}}/><span style={{color:st12[0]?"#16A34A":"#DC2626"}}>취업애로요건 해당(청년·수도권)</span></label>)}
    </div>
    <button style={Object.assign({},btnP,{width:"100%",padding:14,fontSize:15})} onClick={runDiagnose}>🎯 진단하기</button>
  </Card>
  {result&&(<div>{recommend.length>0&&(<Card style={{padding:18,marginBottom:14,border:"2px solid #6EE7B7"}}><h4 style={{margin:"0 0 10px",fontSize:15,fontWeight:700,color:"#059669"}}>✅ 가능성 높음 ({recommend.length})</h4>{recommend.map(function(r){return <DiagRow key={r.program.id} r={r}/>;})}</Card>)}{maybe.length>0&&(<Card style={{padding:18,marginBottom:14,border:"1px solid #FDE68A"}}><h4 style={{margin:"0 0 10px",fontSize:15,fontWeight:700,color:"#D97706"}}>⚠️ 조건 확인 필요 ({maybe.length})</h4>{maybe.map(function(r){return <DiagRow key={r.program.id} r={r}/>;})}</Card>)}{recommend.length===0&&maybe.length===0&&(<Card style={{padding:24,textAlign:"center"}}><p style={{color:"#94A3B8",fontSize:13}}>입력 조건에 뚜렷하게 맞는 지원금이 없어요.</p></Card>)}<Notice>진단 결과는 가능성 안내이며 확정이 아닙니다. 실제 신청 전 최신 공고를 확인하세요.</Notice></div>)}</div>);
}

function WageCalc(){ var st1=useState(""),st2=useState(40); var result=useMemo(function(){return checkWage(Number(st1[0]),Number(st2[0]));}, [st1[0],st2[0]]); return(<Card style={{padding:20,marginBottom:20}}><h4 style={{margin:"0 0 6px",fontSize:16,fontWeight:700}}>🧮 급여 계산기 (최저임금 판정)</h4><p style={{margin:"0 0 14px",fontSize:11,color:"#64748B"}}>2026년 최저임금 시급 {MIN_WAGE_2026.toLocaleString()}원 · 월 환산 {MIN_WAGE_MONTH_2026.toLocaleString()}원(209시간)</p><div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:12,marginBottom:14}}><div><Label>월 급여 (세전, 원)</Label><input type="number" style={inp} value={st1[0]} onChange={function(e){st1[1](e.target.value);}} placeholder="2200000"/></div><div><Label>주 소정근로시간</Label><input type="number" style={inp} value={st2[0]} onChange={function(e){st2[1](e.target.value);}} placeholder="40"/></div></div>{result&&(<div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}><div style={{padding:12,background:"#F8FAFC",borderRadius:10,textAlign:"center"}}><div style={{fontSize:11,color:"#64748B"}}>환산 시급</div><div style={{fontSize:20,fontWeight:800,color:result.isAboveMin?"#059669":"#DC2626"}}>{result.hourlyWage.toLocaleString()}원</div></div><div style={{padding:12,background:"#F8FAFC",borderRadius:10,textAlign:"center"}}><div style={{fontSize:11,color:"#64748B"}}>최저임금 대비</div><div style={{fontSize:20,fontWeight:800,color:result.gap>=0?"#059669":"#DC2626"}}>{result.gap>=0?"+":""}{result.gap.toLocaleString()}원</div></div></div><div style={{display:"grid",gap:6}}><div style={{padding:"10px 14px",borderRadius:8,fontSize:13,fontWeight:600,background:result.isAboveMin?"#D1FAE5":"#FEE2E2",color:result.isAboveMin?"#059669":"#DC2626"}}>{result.isAboveMin?"✅ 최저임금 충족":"❌ 최저임금 미달 — 월 "+result.minMonthly.toLocaleString()+"원 이상 필요"}</div><div style={{padding:"10px 14px",borderRadius:8,fontSize:13,fontWeight:600,background:result.isAboveFloor?"#DBEAFE":"#FEF3C7",color:result.isAboveFloor?"#2563EB":"#D97706"}}>{result.isAboveFloor?"✅ 월보수 하한선 124만원 이상 충족":"⚠️ 월보수 124만원 미만 — 다수 지원금 원천 제외"}</div></div></div>)}</Card>); }

function Simulator(props){ var programs=props.programs; var st1=useState("youth_jump"),st2=useState(1),st3=useState(""); var selectedProgram=programs[st1[0]]; var results=useMemo(function(){if(!selectedProgram||!st2[0])return{monthly:[],total:0}; var count=parseInt(st2[0])||0; var startDate=st3[0]||new Date().toISOString().split("T")[0]; var monthly=[]; var totalAmount=0; for(var i=0;i<count;i++){(selectedProgram.rounds||[]).forEach(function(r){var eligDate=addMo(startDate,r.month);var ym=eligDate.substring(0,7);var existing=monthly.find(function(m){return m.month===ym;});if(existing){existing.amount+=r.amount;existing.count++;}else{monthly.push({month:ym,amount:r.amount,count:1});}totalAmount+=r.amount;});} return{monthly:monthly.sort(function(a,b){return a.month.localeCompare(b.month);}),total:totalAmount,perPerson:selectedProgram.totalAmount||0};}, [selectedProgram,st2[0],st3[0]]);
  return(<Card style={{padding:20,marginBottom:20}}><h4 style={{margin:"0 0 16px",fontSize:16,fontWeight:700}}>📊 예상 수령액 시뮬레이터</h4><div style={{marginBottom:14}}><Label>지원금 선택</Label>{["신규채용","재직자유지","육아"].map(function(grp){var gp=GROUP_COLORS[grp]||GROUP_COLORS["커스텀"];var items=Object.values(programs).filter(function(p){return p.group===grp;});if(!items.length)return null;return(<div key={grp} style={{marginBottom:10,padding:"10px 12px",borderRadius:10,background:gp.badge,border:"1.5px solid "+gp.light}}><div style={{fontSize:12,fontWeight:700,color:gp.dark,marginBottom:8}}>{gp.icon} {grp}</div><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{items.map(function(p){var on=st1[0]===p.id;return(<button key={p.id} onClick={function(){st1[1](p.id);}} style={{padding:"5px 10px",borderRadius:8,fontSize:11,cursor:"pointer",fontWeight:on?700:400,background:on?gp.base:"#fff",color:on?"#fff":gp.text,border:on?"none":"1.5px solid "+gp.light}}>{p.name}</button>);})}</div></div>);})}</div>
  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}><div><Label>채용 예정 인원</Label><input type="number" style={inp} value={st2[0]} onChange={function(e){st2[1](e.target.value);}} min="1" placeholder="1"/></div><div><Label>예상 입사일</Label><input type="date" style={inp} value={st3[0]} onChange={function(e){st3[1](e.target.value);}}/></div></div>
  {results.total>0&&(<React.Fragment>{(function(){var sg=GROUP_COLORS[(programs[st1[0]]||{}).group]||GROUP_COLORS["커스텀"];return(<div style={{padding:16,background:"linear-gradient(135deg,"+sg.dark+","+sg.base+")",borderRadius:12,color:"#fff",marginBottom:16,textAlign:"center"}}><div style={{fontSize:13,opacity:0.8,marginBottom:4}}>예상 총 수령액(최대치)</div><div style={{fontSize:32,fontWeight:800}}>{fMan(results.total)}</div><div style={{fontSize:12,opacity:0.7,marginTop:4}}>1인당 {fMan(results.perPerson)} × {st2[0]}명</div></div>);})()}<div style={{fontSize:13,fontWeight:600,marginBottom:8}}>📅 월별 예상</div><div style={{maxHeight:200,overflow:"auto"}}>{results.monthly.map(function(m,i){var d=new Date(m.month+"-01");return(<div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:i%2===0?"#FAFBFC":"#fff",borderRadius:6,marginBottom:2}}><span style={{fontSize:13,color:"#475569"}}>{d.getFullYear()}년 {d.getMonth()+1}월</span><div style={{textAlign:"right"}}><span style={{fontSize:15,fontWeight:700,color:"#2563EB"}}>{fMan(m.amount)}</span><span style={{fontSize:11,color:"#94A3B8",marginLeft:6}}>({m.count}건)</span></div></div>);})}</div></React.Fragment>)}</Card>); }

// ── 보조 컴포넌트 ─────────────────────────────────────────
function JuminInput(props){ var st1=useState(""); function handleChange(e){ var val=e.target.value.replace(/[^0-9]/g,"").substring(0,7); st1[1](val); if(val.length>=7){var parsed=parseJumin(val);if(parsed){props.onParsed(parsed);}}} return(<div><Label color="#1D4ED8">주민번호 앞 7자리 (자동입력)</Label><input style={Object.assign({},inp,{borderColor:"#93C5FD",background:"#fff"})} value={st1[0]} onChange={handleChange} placeholder="9501011" maxLength={7}/>{st1[0].length===7&&(<div style={{fontSize:11,color:"#059669",marginTop:4}}>✅ 생년월일/성별 자동 입력됨</div>)}<div style={{fontSize:10,color:"#94A3B8",marginTop:3}}>* 앞 7자리만 입력. 고용이력 조회는 운영기관 전산에서 별도로 하세요.</div></div>); }

function EligChk(props){ var bd=props.bd,gen=props.gen,mil=props.mil,ec=props.ec,xc=props.xc,hd=props.hd; var ageD=calcAgeDetailed(bd,hd); var age=ageD?ageD.years:null; var ageMonths=ageD?ageD.totalMonths:0; var milLimit=gen==="male"?calcMilitaryLimit(mil):{maxTotalMonths:34*12,maxYears:34,maxRemainMonths:0}; var aOk=ageD!==null&&ageMonths>=15*12&&ageMonths<=milLimit.maxTotalMonths; var anyE=Object.values(ec).some(function(v){return v;}); var failedX=EXCL.filter(function(x){return xc[x.id]===false;}); var allXok=EXCL.every(function(x){return xc[x.id]===true;}); var ok=aOk&&anyE&&allXok; var has=bd&&bd!=="2000-01-01"; var maxLabel=milLimit.maxRemainMonths>0?"만"+milLimit.maxYears+"세"+milLimit.maxRemainMonths+"개월":"만"+milLimit.maxYears+"세"; var nearBorder=ageD&&gen==="male"&&mil>0&&ageMonths>34*12&&ageMonths<=milLimit.maxTotalMonths;
  return(<div style={{border:"2px solid #BFDBFE",borderRadius:10,padding:12,background:"#F0F7FF"}}><div style={{fontSize:14,fontWeight:700,color:"#1D4ED8",marginBottom:8}}>🔍 청년도약 자격요건</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}><div><Label color="#1D4ED8">생년월일</Label><input type="date" style={Object.assign({},inp,{borderColor:"#93C5FD",background:"#fff",fontSize:12,padding:"8px 10px"})} value={bd||"2000-01-01"} onChange={function(e){props.setBd(e.target.value);}}/></div><div><Label color="#1D4ED8">성별</Label><div style={{display:"flex",gap:3}}>{[["male","남"],["female","여"]].map(function(arr){return <button key={arr[0]} onClick={function(){props.setGen(arr[0]);}} style={Object.assign({},btnSm,{flex:1,background:gen===arr[0]?"#DBEAFE":"#fff",color:gen===arr[0]?"#2563EB":"#64748B",border:gen===arr[0]?"2px solid #93C5FD":"1px solid #E2E8F0",fontSize:11})}>{arr[1]}</button>;})}</div></div>{gen==="male"&&<div><Label color="#1D4ED8">군복무(월)</Label><input type="number" style={Object.assign({},inp,{borderColor:"#93C5FD",background:"#fff",fontSize:12,padding:"8px 10px"})} value={mil||""} onChange={function(e){props.setMil(Number(e.target.value));}} placeholder="18"/></div>}</div>{age!==null&&<div style={{padding:"4px 8px",borderRadius:4,marginBottom:6,background:aOk?"#D1FAE5":"#FEE2E2",fontSize:12,fontWeight:600}}>{aOk?<span style={{color:"#059669"}}>✅ 만{age}세 (상한: {maxLabel})</span>:<span style={{color:"#DC2626"}}>❌ 만{age}세 미충족</span>}</div>}{nearBorder&&<div style={{padding:"4px 8px",borderRadius:4,marginBottom:6,background:"#FEF3C7",fontSize:11,color:"#92400E"}}>⚠️ 경계선 — 관할기관 확인 필요</div>}<div style={{marginBottom:8}}><div style={{fontSize:12,fontWeight:600,marginBottom:4,color:"#1D4ED8"}}>📋 취업애로요건 (1개↑)</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:3}}>{ELIG.map(function(e){var isChecked=!!ec[e.id];return(<label key={e.id} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 6px",borderRadius:4,cursor:"pointer",background:isChecked?"#D1FAE5":"#fff",border:isChecked?"1px solid #6EE7B7":"1px solid #E2E8F0",fontSize:11}} title={e.desc}><input type="checkbox" checked={isChecked} onChange={function(){props.setEc(function(p){var n=Object.assign({},p);n[e.id]=!p[e.id];return n;});}} style={{accentColor:"#10B981",width:12,height:12}}/><span style={{color:isChecked?"#059669":"#475569"}}>{e.label}</span></label>);})}</div></div><div style={{marginBottom:8}}><div style={{fontSize:12,fontWeight:600,marginBottom:4,color:"#DC2626"}}>🚫 제외요건 확인</div><div style={{display:"grid",gap:3}}>{EXCL.map(function(x){var isChecked=!!xc[x.id];return(<label key={x.id} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 6px",borderRadius:4,cursor:"pointer",background:isChecked?"#D1FAE5":"#FEF2F2",border:isChecked?"1px solid #6EE7B7":"1px solid #FECACA",fontSize:11}} title={x.desc}><input type="checkbox" checked={isChecked} onChange={function(){props.setXc(function(p){var n=Object.assign({},p);n[x.id]=!p[x.id];return n;});}} style={{accentColor:"#10B981",width:12,height:12}}/><span style={{color:isChecked?"#059669":"#DC2626"}}>{x.label}</span></label>);})}</div></div>{has&&failedX.length>0&&<div style={{padding:"6px 8px",marginBottom:6,borderRadius:4,background:"#FEF3C7",fontSize:11,color:"#92400E"}}>⚠️ 미충족 제외요건 {failedX.length}개 — 진행 전 확인 필요</div>}<div style={{padding:"8px",borderRadius:6,textAlign:"center",background:ok?"#D1FAE5":has?"#FEF3C7":"#F1F5F9",fontSize:13,fontWeight:700}}>{ok?<span style={{color:"#059669"}}>✅ 대상자 예상</span>:has?<span style={{color:"#D97706"}}>⚠️ 일부 요건 확인 필요</span>:<span style={{color:"#64748B"}}>정보입력</span>}</div></div>);
}

function BulkUpload(props){ var programs=props.programs,onUpload=props.onUpload; var st1=useState(false),st2=useState(""),st3=useState([]),st4=useState(""); function parseData(){if(!st2[0].trim()){st4[1]("데이터를 붙여넣어 주세요");return;}var parsed=parseExcelData(st2[0],programs);if(parsed.length===0){st4[1]("유효한 데이터가 없습니다.");return;}st3[1](parsed);st4[1]("");} function doUpload(){if(st3[0].length===0)return;onUpload(st3[0]);st1[1](false);st2[1]("");st3[1]([]);} function copyTemplate(){navigator.clipboard.writeText(makeExcelTemplate());alert("양식이 복사되었습니다.");} return(<React.Fragment><button style={Object.assign({},btnSm,{background:"#D1FAE5",color:"#059669",border:"1px solid #6EE7B7"})} onClick={function(){st1[1](true);st2[1]("");st3[1]([]);st4[1]("");}}>📥 일괄등록</button><Modal open={st1[0]} onClose={function(){st1[1](false);}} title="📥 직원 일괄 등록" width={600}><div style={{display:"grid",gap:16}}><div style={{padding:14,background:"#EFF6FF",borderRadius:10,border:"1px solid #BFDBFE"}}><div style={{fontSize:14,fontWeight:700,color:"#2563EB",marginBottom:8}}>Step 1. 양식 복사</div><button style={btnSm} onClick={copyTemplate}>📋 양식 복사</button></div><div style={{padding:14,background:"#F0FDF4",borderRadius:10,border:"1px solid #BBF7D0"}}><div style={{fontSize:14,fontWeight:700,color:"#059669",marginBottom:8}}>Step 2. 데이터 붙여넣기</div><textarea style={Object.assign({},inp,{height:110,resize:"none",fontFamily:"monospace",fontSize:11})} value={st2[0]} onChange={function(e){st2[1](e.target.value);st3[1]([]);}} placeholder={"이름\t주민번호앞7자리\t입사일\t연락처\t이메일\t지원금ID"}/>{st4[0]&&<p style={{fontSize:12,color:"#DC2626",marginTop:4}}>{st4[0]}</p>}<button style={Object.assign({},btnP,{marginTop:8})} onClick={parseData}>데이터 확인</button></div>{st3[0].length>0&&(<div style={{padding:14,background:"#FEF3C7",borderRadius:10,border:"1px solid #FDE68A"}}><div style={{fontSize:14,fontWeight:700,color:"#D97706",marginBottom:8}}>Step 3. 확인 및 등록 ({st3[0].length}명)</div><div style={{maxHeight:150,overflow:"auto",marginBottom:8}}>{st3[0].map(function(row,i){return(<div key={i} style={{fontSize:11,padding:"4px 0",borderBottom:"1px solid #FEF3C7"}}>{row.name} · {row.birthDate} · {row.startDate} · {row.phone}</div>);})}</div><button style={Object.assign({},btnP,{width:"100%"})} onClick={doUpload}>✅ {st3[0].length}명 등록하기</button></div>)}</div></Modal></React.Fragment>); }

function PDFReport(props){ var company=props.company,employees=props.employees,programs=props.programs,profile=props.profile; var st1=useState(false); var rd=useMemo(function(){ var emps=employees.filter(function(e){return e.companyId===company.id&&e.status!=="resigned";}); var totalReceived=emps.reduce(function(s,e){return s+(e.rounds||[]).reduce(function(ss,r){return ss+(r.isPaid?r.received||0:0);},0);},0); var totalExpected=emps.reduce(function(s,e){return s+(e.totalExpected||0);},0); var upcoming=[]; emps.forEach(function(e){var p=programs[e.programId];if(!e.startDate||!p)return;(e.rounds||[]).forEach(function(r){if(r.isPaid)return;var ed=addMo(e.startDate,r.month);var dd=getDday(ed);if(dd!==null&&dd>=0&&dd<=90)upcoming.push({empName:e.name,roundLabel:r.label,eligDate:ed,dday:dd,amount:r.expectedAmount});});}); upcoming.sort(function(a,b){return a.dday-b.dday;}); return{empCount:emps.length,totalExpected:totalExpected,totalReceived:totalReceived,remaining:totalExpected-totalReceived,upcomingRounds:upcoming.slice(0,10),employees:emps}; },[company,employees,programs]);
  function generatePDF(){ var cl=company.corpType==="법인"?(company.juPosition==="앞"?"(주)"+company.name:company.name+"(주)"):company.name; var today=new Date(); var rd2=today.getFullYear()+"년 "+(today.getMonth()+1)+"월 "+today.getDate()+"일"; var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+cl+' 고용지원금 현황</title><style>body{font-family:-apple-system,sans-serif;padding:40px;max-width:800px;margin:0 auto;color:#1E293B}h1{font-size:24px;border-bottom:3px solid #2563EB;padding-bottom:10px;margin-bottom:20px}h2{font-size:16px;color:#2563EB;margin-top:30px;border-left:4px solid #2563EB;padding-left:10px}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:15px;margin-bottom:30px}.sc{background:#F8FAFC;border-radius:8px;padding:15px;text-align:center}.sc .l{font-size:12px;color:#64748B}.sc .v{font-size:24px;font-weight:700;color:#2563EB}table{width:100%;border-collapse:collapse}th,td{border:1px solid #E2E8F0;padding:8px 12px;text-align:left;font-size:13px}th{background:#F8FAFC}@media print{body{padding:20px}}</style></head><body>'; html+='<h1>📋 '+cl+' 고용지원금 현황</h1><p style="color:#64748B;font-size:13px">작성일: '+rd2+' | 작성자: '+(profile.display_name||"")+" "+(profile.title||"")+'</p>'; html+='<div class="summary"><div class="sc"><div class="l">대상자</div><div class="v">'+rd.empCount+'명</div></div><div class="sc"><div class="l">수령완료</div><div class="v">'+fMan(rd.totalReceived)+'</div></div><div class="sc"><div class="l">수령예정</div><div class="v">'+fMan(rd.remaining)+'</div></div></div>'; if(rd.upcomingRounds.length>0){html+='<h2>🔔 향후 90일 내 신청 예정</h2><table><tr><th>직원</th><th>회차</th><th>신청가능일</th><th>D-Day</th><th>예상금액</th></tr>';rd.upcomingRounds.forEach(function(r){html+='<tr><td>'+r.empName+'</td><td>'+r.roundLabel+'</td><td>'+fD(r.eligDate)+'</td><td>D-'+r.dday+'</td><td>'+fMan(r.amount)+'</td></tr>';});html+='</table>';} html+='<h2>👤 직원별 현황</h2><table><tr><th>이름</th><th>지원금</th><th>상태</th><th>입사일</th><th>수령액</th></tr>';rd.employees.forEach(function(e){var p2=programs[e.programId];var s2=STS.find(function(s){return s.key===e.status;});var rcv=(e.rounds||[]).reduce(function(s,r){return s+(r.isPaid?r.received||0:0);},0);html+='<tr><td>'+e.name+'</td><td>'+(p2?p2.name:"")+'</td><td>'+(s2?s2.label:"")+'</td><td>'+(e.startDate||"-")+'</td><td>'+fMan(rcv)+'</td></tr>';});html+='</table>'; html+='<div style="margin-top:40px;padding-top:20px;border-top:1px solid #E2E8F0;text-align:center;font-size:12px;color:#64748B">고용지원금 매니저 Pro에서 자동 생성 · 신청 전 최신 공고 확인 필요</div></body></html>'; var blob=new Blob([html],{type:"text/html;charset=utf-8"});var url=URL.createObjectURL(blob);var a=document.createElement("a");a.href=url;a.download=cl+"_고용지원금_"+today.toISOString().split("T")[0]+".html";a.click();URL.revokeObjectURL(url);st1[1](false); }
  return(<React.Fragment><button style={Object.assign({},btnSm,{background:"#DC2626",color:"#fff",border:"none"})} onClick={function(){st1[1](true);}}>📄 보고서</button><Modal open={st1[0]} onClose={function(){st1[1](false);}} title="📄 보고서 생성" width={480}><div style={{textAlign:"center",padding:"20px 0"}}><div style={{fontSize:48,marginBottom:16}}>📄</div><h3 style={{margin:"0 0 8px",fontSize:18,fontWeight:700}}>{company.name}</h3><p style={{color:"#64748B",fontSize:13,marginBottom:24}}>대상자 {rd.empCount}명 | 수령완료 {fMan(rd.totalReceived)}</p><button style={Object.assign({},btnP,{padding:"14px 40px",fontSize:15})} onClick={generatePDF}>📥 HTML 보고서 다운로드</button><p style={{fontSize:11,color:"#94A3B8",marginTop:12}}>브라우저에서 열어 인쇄(Ctrl+P)하면 PDF로 저장됩니다</p></div></Modal></React.Fragment>); }

// ── Dashboard 보조 컴포넌트 ───────────────────────────────
function DdayAlerts(props){ var ddayLimit=(props.settings&&props.settings.ddayAlert)||7; var alerts=useMemo(function(){var list=[];props.employees.forEach(function(emp){if(emp.status==="resigned")return;var company=props.companies.find(function(c){return c.id===emp.companyId;});var program=props.programs[emp.programId];if(!emp.startDate||!program)return;(emp.rounds||[]).forEach(function(r,ri){if(r.isPaid)return;var eligDate=addMo(emp.startDate,r.month);var dday=getDday(eligDate);if(dday!==null&&dday<=ddayLimit){list.push({id:emp.id+"-"+ri,empName:emp.name,companyName:company?company.name:"",companyId:emp.companyId,dday:dday});}});});return list.sort(function(a,b){return a.dday-b.dday;});},[props.employees,props.companies,props.programs,ddayLimit]); if(alerts.length===0)return null; return(<Card style={{marginBottom:16,overflow:"hidden"}}><div style={{background:"linear-gradient(135deg,#DC2626,#EF4444)",padding:"12px 16px",color:"#fff"}}><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:16}}>🔔</span><span style={{fontSize:14,fontWeight:700}}>신청 임박</span><Badge color="#fff" bg="rgba(255,255,255,0.25)">{alerts.length}건</Badge></div></div><div style={{padding:"10px 14px",maxHeight:150,overflow:"auto"}}>{alerts.map(function(a){return(<div key={a.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 10px",marginBottom:4,borderRadius:6,background:a.dday<=0?"#FEE2E2":a.dday<=3?"#FEF3C7":"#F8FAFC",cursor:"pointer",fontSize:12}} onClick={function(){props.goCompany(a.companyId);}}><div><span style={{fontWeight:600}}>{a.empName}</span><span style={{color:"#64748B",marginLeft:6}}>{a.companyName}</span></div><DdayBadge dday={a.dday}/></div>);})}</div></Card>); }

function GlobalSearch(props){ var st1=useState(""); var results=useMemo(function(){if(!st1[0].trim())return [];var q=st1[0].toLowerCase();return props.employees.filter(function(e){return e.name.toLowerCase().includes(q)||(e.phone||"").includes(q);}).slice(0,10);},[props.employees,st1[0]]); return(<div style={{marginBottom:14}}><div style={{position:"relative"}}><input style={Object.assign({},inpKo,{paddingLeft:32,fontSize:13})} value={st1[0]} onChange={function(e){st1[1](e.target.value);}} placeholder="직원 검색..."/><span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:12}}>🔍</span></div>{results.length>0&&(<Card style={{marginTop:6,maxHeight:200,overflow:"auto",position:"relative",zIndex:10}}>{results.map(function(emp){var company=props.companies.find(function(c){return c.id===emp.companyId;});var st=STS.find(function(s){return s.key===emp.status;})||STS[0];return(<div key={emp.id} style={{padding:"8px 12px",borderBottom:"1px solid #F1F5F9",cursor:"pointer",fontSize:12}} onClick={function(){props.goCompany(emp.companyId);st1[1]("");}}><div style={{display:"flex",alignItems:"center",gap:4}}><span style={{fontWeight:600}}>{emp.name}</span><Badge color={st.color} bg={st.bg}>{st.label}</Badge></div><div style={{fontSize:11,color:"#64748B"}}>{company?company.name:""}</div></div>);})}</Card>)}</div>); }

function MonthlyReport(props){ var st1=useState(new Date().getFullYear()); var data=useMemo(function(){var arr=[];for(var m=1;m<=12;m++){var rcv=0;props.employees.forEach(function(emp){(emp.rounds||[]).forEach(function(r){if(r.isPaid&&r.paidDate){var pd=new Date(r.paidDate);if(pd.getFullYear()===st1[0]&&pd.getMonth()+1===m){rcv+=r.received||0;}}});});arr.push({month:m,received:rcv});}return arr;},[props.employees,st1[0]]); var total=data.reduce(function(s,d){return s+d.received;},0); var maxR=Math.max.apply(null,data.map(function(d){return d.received;}))||1; return(<Card style={{padding:16,marginBottom:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><h4 style={{margin:0,fontSize:14,fontWeight:700}}>📈 월별 수령</h4><div style={{display:"flex",alignItems:"center",gap:6}}><button onClick={function(){st1[1](st1[0]-1);}} style={btnSm}>◀</button><span style={{fontWeight:600,fontSize:12}}>{st1[0]}</span><button onClick={function(){st1[1](st1[0]+1);}} style={btnSm}>▶</button></div></div><div style={{display:"flex",gap:3,height:80,alignItems:"flex-end",marginBottom:8}}>{data.map(function(d){var h=d.received>0?Math.max(12,(d.received/maxR)*60):3;return(<div key={d.month} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center"}}><div style={{fontSize:8,color:"#64748B",marginBottom:1}}>{d.received>0?fManS(d.received):""}</div><div style={{width:"100%",height:h,background:d.received>0?"#2563EB":"#E2E8F0",borderRadius:2}}/><div style={{fontSize:9,color:"#64748B",marginTop:2}}>{d.month}</div></div>);})}</div><div style={{textAlign:"center",fontSize:13}}><span style={{color:"#64748B"}}>연간: </span><span style={{fontWeight:700,color:"#2563EB"}}>{fMan(total)}</span></div></Card>); }

function CompanyRanking(props){ var ranking=useMemo(function(){return props.companies.map(function(c){var emps=props.employees.filter(function(e){return e.companyId===c.id;});var total=emps.reduce(function(s,e){return s+(e.rounds||[]).reduce(function(ss,r){return ss+(r.isPaid?r.received||0:0);},0);},0);return{id:c.id,name:c.name,total:total,empCount:emps.filter(function(e){return e.status!=="resigned";}).length};}).sort(function(a,b){return b.total-a.total;}).slice(0,5);},[props.companies,props.employees]); if(ranking.length===0)return null; return(<Card style={{padding:16,marginBottom:16}}><h4 style={{margin:"0 0 12px",fontSize:14,fontWeight:700}}>🏆 업체별 수령 순위</h4>{ranking.map(function(r,i){var medal=i===0?"🥇":i===1?"🥈":i===2?"🥉":(i+1)+""; return(<div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",marginBottom:4,borderRadius:6,background:i<3?"#FFFBEB":"#FAFBFC",cursor:"pointer",fontSize:12}} onClick={function(){props.goCompany(r.id);}}><div style={{display:"flex",alignItems:"center",gap:8}}><span>{medal}</span><div><div style={{fontWeight:600}}>{r.name}</div><div style={{fontSize:10,color:"#64748B"}}>{r.empCount}명</div></div></div><div style={{fontWeight:700,color:"#059669"}}>{fMan(r.total)}</div></div>);})}</Card>); }

function PendingPaymentsList(props){ var employees=props.employees,programs=props.programs; var pendingList=useMemo(function(){var list=[];employees.forEach(function(emp){if(emp.status==="resigned"||emp.status==="completed")return;var program=programs[emp.programId];if(!program)return;var paidCount=0,totalRounds=(emp.rounds||[]).length,remainingAmount=0,nextEligDate=null;(emp.rounds||[]).forEach(function(r){if(r.isPaid){paidCount++;}else{remainingAmount+=r.expectedAmount||0;var ed=emp.startDate?addMo(emp.startDate,r.month):null;if(ed&&(!nextEligDate||new Date(ed)<new Date(nextEligDate))){nextEligDate=ed;}}});if(paidCount<totalRounds&&totalRounds>0){list.push({id:emp.id,name:emp.name,companyId:emp.companyId,paidCount:paidCount,totalRounds:totalRounds,remainingAmount:remainingAmount,nextDday:nextEligDate?getDday(nextEligDate):null});}});return list.sort(function(a,b){if(a.nextDday===null)return 1;if(b.nextDday===null)return-1;return a.nextDday-b.nextDday;});},[employees,programs]); var totalRemaining=pendingList.reduce(function(s,p){return s+p.remainingAmount;},0); return(<Card style={{padding:16,marginBottom:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><h4 style={{margin:0,fontSize:14,fontWeight:700}}>💳 미지급 대상자</h4><Badge color="#0EA5E9" bg="#E0F2FE">{pendingList.length}명/{fMan(totalRemaining)}</Badge></div>{pendingList.length===0?(<p style={{color:"#94A3B8",fontSize:12,textAlign:"center",padding:16}}>없음</p>):(<div style={{maxHeight:180,overflow:"auto"}}>{pendingList.map(function(p){return(<div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",marginBottom:4,borderRadius:6,background:"#FAFBFC",border:"1px solid #F1F5F9",cursor:"pointer",fontSize:12}} onClick={function(){props.goCompany(p.companyId);}}><div><span style={{fontWeight:600}}>{p.name}</span><span style={{color:"#64748B",marginLeft:6}}>{p.paidCount}/{p.totalRounds}회차</span></div><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontWeight:700,color:"#0EA5E9"}}>{fMan(p.remainingAmount)}</span>{p.nextDday!==null&&<DdayBadge dday={p.nextDday}/>}</div></div>);})}</div>)}</Card>); }

function CalendarView(props){ var employees=props.employees,companies=props.companies,programs=props.programs; var calendarMemos=props.calendarMemos||{}; var onSaveMemo=props.onSaveMemo; var st1=useState(new Date()); var st2=useState(null); var st3=useState(""); var year=st1[0].getFullYear(),month=st1[0].getMonth(); var events=useMemo(function(){var list=[];employees.forEach(function(emp){if(emp.status==="resigned")return;var company=companies.find(function(c){return c.id===emp.companyId;});var program=programs[emp.programId];if(!emp.startDate||!program)return;(emp.rounds||[]).forEach(function(r){if(r.isPaid)return;var ed=addMo(emp.startDate,r.month);var d=new Date(ed);if(d.getFullYear()===year&&d.getMonth()===month){list.push({day:d.getDate(),empName:emp.name,companyId:emp.companyId,color:program.color});}});});return list;},[employees,companies,programs,year,month]); var firstDay=new Date(year,month,1).getDay(); var daysInMonth=new Date(year,month+1,0).getDate(); var weeks=[]; var day=1; for(var w=0;w<6;w++){var week=[];for(var d2=0;d2<7;d2++){if(w===0&&d2<firstDay){week.push(null);}else if(day>daysInMonth){week.push(null);}else{week.push(day);day++;}}weeks.push(week);if(day>daysInMonth)break;} var today=new Date(); function isToday(d){return d&&today.getFullYear()===year&&today.getMonth()===month&&today.getDate()===d;} function getMemoKey(d){return year+"-"+(month+1)+"-"+d;} function addMemoFn(){if(!st3[0].trim()||!st2[0])return;var key=getMemoKey(st2[0]);var existing=calendarMemos[key]||[];onSaveMemo(key,existing.concat([{id:uid(),text:st3[0].trim(),at:new Date().toISOString()}]));st3[1]("");} function delMemo(memoId){var key=getMemoKey(st2[0]);onSaveMemo(key,(calendarMemos[key]||[]).filter(function(m){return m.id!==memoId;}));}
  return(<Card style={{padding:20,marginBottom:20}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h4 style={{margin:0,fontSize:16,fontWeight:700}}>📅 신청 일정</h4><div style={{display:"flex",alignItems:"center",gap:8}}><button onClick={function(){st1[1](new Date(year,month-1,1));st2[1](null);}} style={btnSm}>◀</button><span style={{fontWeight:700,minWidth:100,textAlign:"center"}}>{year}년 {month+1}월</span><button onClick={function(){st1[1](new Date(year,month+1,1));st2[1](null);}} style={btnSm}>▶</button></div></div><div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:8}}>{["일","월","화","수","목","금","토"].map(function(dd,i){return <div key={i} style={{textAlign:"center",fontSize:12,fontWeight:600,color:i===0?"#EF4444":i===6?"#3B82F6":"#64748B",padding:4}}>{dd}</div>;})}</div><div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>{weeks.map(function(week,wi){return week.map(function(dd,di){var dayEvents=dd?events.filter(function(e){return e.day===dd;}):[]; var dayKey=dd?getMemoKey(dd):null; var dayMemos=dayKey&&calendarMemos[dayKey]?calendarMemos[dayKey]:[]; var isSelected=st2[0]===dd; return(<div key={wi+"-"+di} onClick={dd?function(){st2[1](isSelected?null:dd);}:undefined} style={{minHeight:54,padding:3,background:dd?(isSelected?"#DBEAFE":"#FAFBFC"):"transparent",borderRadius:4,border:isSelected?"2px solid #2563EB":(isToday(dd)?"2px solid #10B981":"1px solid #F1F5F9"),cursor:dd?"pointer":"default"}}>{dd&&(<React.Fragment><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:1}}><span style={{fontSize:11,fontWeight:isToday(dd)?700:500,color:di===0?"#EF4444":di===6?"#3B82F6":"#334155"}}>{dd}</span>{dayMemos.length>0&&<span style={{fontSize:7}}>📝</span>}</div>{dayEvents.slice(0,2).map(function(e,i2){return <div key={i2} style={{fontSize:8,padding:"1px 3px",marginBottom:1,borderRadius:3,background:e.color+"20",color:e.color,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} onClick={function(ev){ev.stopPropagation();props.goCompany(e.companyId);}}>{e.empName}</div>;})} {dayEvents.length>2&&<div style={{fontSize:8,color:"#64748B"}}>+{dayEvents.length-2}</div>}</React.Fragment>)}</div>);}).flat()})}</div>{st2[0]&&(<div style={{marginTop:12,padding:12,background:"#F8FAFC",borderRadius:8,border:"1px solid #E2E8F0"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><span style={{fontSize:13,fontWeight:700}}>{month+1}월 {st2[0]}일</span><button onClick={function(){st2[1](null);}} style={{background:"none",border:"none",fontSize:14,cursor:"pointer",color:"#94A3B8"}}>×</button></div><div style={{display:"flex",gap:4,marginBottom:8}}><input style={Object.assign({},inpKo,{flex:1,fontSize:12,padding:"6px 10px"})} value={st3[0]} onChange={function(e){st3[1](e.target.value);}} placeholder="메모..." onKeyDown={function(e){if(e.key==="Enter")addMemoFn();}}/><button style={Object.assign({},btnP,{padding:"6px 12px",fontSize:11})} onClick={addMemoFn}>추가</button></div>{(calendarMemos[getMemoKey(st2[0])]||[]).map(function(memo){return(<div key={memo.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 8px",background:"#fff",borderRadius:4,marginBottom:3,border:"1px solid #E2E8F0",fontSize:11}}><span>{memo.text}</span><button onClick={function(){delMemo(memo.id);}} style={{background:"none",border:"none",color:"#EF4444",cursor:"pointer",fontSize:10}}>×</button></div>);})}</div>)}</Card>); }

// ── Dashboard ─────────────────────────────────────────────
function Dashboard(props){ var st1=useState("all"),st2=useState(false); var selectedCompanyId=st1[0]; var fE=useMemo(function(){return st1[0]==="all"?props.employees:props.employees.filter(function(e){return e.companyId===st1[0];});},[props.employees,st1[0]]); var stats=useMemo(function(){var tE=0,tR=0,dT=0,dD=0,sc={};STS.forEach(function(s){sc[s.key]=0;});fE.forEach(function(e){if(sc[e.status]!==undefined)sc[e.status]++;var p=props.programs[e.programId];if(p)tE+=p.totalAmount||0;(e.rounds||[]).forEach(function(r){if(r.isPaid)tR+=r.received||0;});(e.employeeDocs||[]).forEach(function(d){dT++;if(d.done)dD++;});});(st1[0]==="all"?props.companies:props.companies.filter(function(c){return c.id===st1[0];})).forEach(function(c){(c.companyDocs||[]).forEach(function(d){dT++;if(d.done)dD++;});});return{tE:tE,tR:tR,pct:dT>0?Math.round(dD/dT*100):0,sc:sc};},[props.companies,fE,props.programs,st1[0]]); var cards=[{l:"업체",v:st1[0]==="all"?props.companies.length:1,u:"개",i:"🏢",c:"#3B82F6"},{l:"대상자",v:fE.filter(function(e){return e.status!=="resigned";}).length,u:"명",i:"👤",c:"#8B5CF6"},{l:"서류",v:stats.pct,u:"%",i:"📋",c:"#10B981"},{l:"수령완료",v:fManS(stats.tR),u:"원",i:"✅",c:"#059669"},{l:"예정",v:fManS(stats.tE),u:"원",i:"💰",c:"#2563EB"}]; var starredCompanies=props.companies.filter(function(c){return(c.tags||[]).includes("star");});
  function handleExcelCopy(){var data=makeExcelData(props.companies,props.employees,props.programs);navigator.clipboard.writeText(data).then(function(){st2[1](true);setTimeout(function(){st2[1](false);},2000);});}
  return(<div><GlobalSearch employees={props.employees} companies={props.companies} goCompany={props.goCompany}/><DdayAlerts employees={props.employees} companies={props.companies} programs={props.programs} goCompany={props.goCompany} settings={props.settings}/>{starredCompanies.length>0&&(<Card style={{padding:"10px 14px",marginBottom:14}}><div style={{fontSize:12,fontWeight:600,marginBottom:6}}>⭐ 즐겨찾기</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{starredCompanies.map(function(c){return <button key={c.id} onClick={function(){props.goCompany(c.id);}} style={Object.assign({},btnSm,{background:"#FFEDD5",color:"#C2410C",border:"1px solid #FDBA74",fontSize:11})}>{c.name}</button>;})}</div></Card>)}<div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}><select style={Object.assign({},inp,{width:"auto",minWidth:160,fontSize:13,fontWeight:600})} value={st1[0]} onChange={function(e){st1[1](e.target.value);}}><option value="all">📊 전체 업체</option>{props.companies.map(function(c){return <option key={c.id} value={c.id}>🏢 {c.name}</option>;})}</select><button onClick={handleExcelCopy} style={Object.assign({},btnSm,{background:"#D1FAE5",color:"#059669",border:"1px solid #6EE7B7"})}>📋 엑셀복사</button>{st2[0]&&<span style={{fontSize:11,color:"#059669"}}>✅ 복사됨</span>}</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:10,marginBottom:16}}>{cards.map(function(c,i){return(<Card key={i} style={{padding:"14px 16px"}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:11,color:"#64748B"}}>{c.l}</span><span style={{fontSize:14}}>{c.i}</span></div><div><span style={{fontSize:22,fontWeight:800,color:c.c}}>{c.v}</span><span style={{fontSize:11,color:"#94A3B8",marginLeft:3}}>{c.u}</span></div></Card>);})}</div>
  {/* 업체 목록 */}
  {props.companies.length===0?(<Card style={{padding:32,textAlign:"center"}}><div style={{fontSize:40,marginBottom:8}}>🏢</div><p style={{color:"#94A3B8",fontSize:13,margin:0}}>등록된 업체가 없습니다. 위 버튼으로 첫 업체를 추가하세요.</p></Card>):(<div style={{marginBottom:16}}>{props.companies.map(function(c){var emps=props.employees.filter(function(e){return e.companyId===c.id&&e.status!=="resigned";});var rcv=props.employees.filter(function(e){return e.companyId===c.id;}).reduce(function(s,e){return s+(e.rounds||[]).reduce(function(ss,r){return ss+(r.isPaid?r.received||0:0);},0);},0);var gp=GROUP_COLORS["신규채용"];var upcomingCount=0;emps.forEach(function(e){var p=props.programs[e.programId];if(!e.startDate||!p)return;(e.rounds||[]).forEach(function(r){if(r.isPaid)return;var d=getDday(addMo(e.startDate,r.month));if(d!==null&&d<=7)upcomingCount++;});});return(<Card key={c.id} onClick={function(){props.goCompany(c.id);}} style={{padding:"14px 16px",marginBottom:8,cursor:"pointer",border:"1.5px solid #F1F5F9",transition:"all 0.15s"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:4}}><span style={{fontSize:15,fontWeight:700,color:"#1E293B"}}>{c.name}</span>{(c.tags||[]).map(function(tid){var tag=TAGS.find(function(t){return t.id===tid;});if(!tag)return null;return <Badge key={tid} color={tag.color} bg={tag.bg}>{tag.label}</Badge>;})}{upcomingCount>0&&<Badge color="#DC2626" bg="#FEE2E2">🔔 {upcomingCount}건 임박</Badge>}</div><div style={{fontSize:12,color:"#64748B"}}>{c.bizNo&&c.bizNo+" · "}{c.ceoName&&c.ceoName+" · "}{emps.length}명 관리 중</div></div><div style={{textAlign:"right",flexShrink:0,marginLeft:8}}><div style={{fontSize:14,fontWeight:700,color:"#059669"}}>{fMan(rcv)}</div><div style={{fontSize:10,color:"#94A3B8"}}>수령완료</div></div></div></Card>);})}</div>)}
  {selectedCompanyId!=="all"&&(<div><PendingPaymentsList employees={props.employees} programs={props.programs} goCompany={props.goCompany} selectedCompanyId={selectedCompanyId}/></div>)}
  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}><div><MonthlyReport employees={props.employees}/><CompanyRanking companies={props.companies} employees={props.employees} goCompany={props.goCompany}/></div><div><CalendarView employees={props.employees} companies={props.companies} programs={props.programs} goCompany={props.goCompany} calendarMemos={props.calendarMemos} onSaveMemo={props.onSaveMemo}/></div></div>
  <Card style={{padding:16,marginTop:8}}><h4 style={{margin:"0 0 12px",fontSize:13,fontWeight:700}}>📊 상태별 현황</h4>{STS.map(function(s){var cnt=stats.sc[s.key]||0;var total=fE.length||1;return(<div key={s.key} style={{marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{fontSize:12,color:"#475569"}}>{s.icon} {s.label}</span><span style={{fontSize:12,fontWeight:700,color:s.color}}>{cnt}명</span></div><div style={{height:5,background:"#F1F5F9",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:(cnt/total*100)+"%",background:s.color,borderRadius:2}}/></div></div>);})}</Card></div>); }

// ── EmpCard ───────────────────────────────────────────────
function EmpCard(props){
  var emp=props.emp,programs=props.programs,company=props.company;
  var uploadFn=props.uploadFn,getUrlFn=props.getUrlFn;
  var st1=useState(false); // expanded
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
    <Card style={{marginBottom:8,overflow:"hidden",border:"1.5px solid #F1F5F9"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",cursor:"pointer"}} onClick={function(){st1[1](!st1[0]);}}>
        <div style={{width:36,height:36,borderRadius:18,background:"linear-gradient(135deg,"+gp.dark+","+gp.base+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#fff",flexShrink:0,fontWeight:700}}>
          {emp.name.charAt(0)}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap",marginBottom:2}}>
            <span style={{fontSize:14,fontWeight:700,color:"#1E293B"}}>{emp.name}</span>
            <Badge color={st.color} bg={st.bg}>{st.label}</Badge>
            {p&&<Badge color={gp.text} bg={gp.badge}>{p.name}</Badge>}
          </div>
          <div style={{fontSize:11,color:"#64748B",display:"flex",gap:8,flexWrap:"wrap"}}>
            {emp.startDate&&<span>입사 {fD(emp.startDate)}</span>}
            {ageD&&<span>만{ageD.years}세</span>}
            {paidRounds>0&&<span style={{color:"#059669"}}>✅{paidRounds}/{totalRounds}회차</span>}
            {totalPaid>0&&<span style={{color:"#059669"}}>{fMan(totalPaid)}</span>}
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
          {nextRound&&<DdayBadge dday={nextRound.dday}/>}
          <div style={{display:"flex",gap:4}}>
            <button style={Object.assign({},btnSm,{fontSize:10,padding:"3px 7px"})} onClick={function(e){e.stopPropagation();props.onEdit(emp);}}>편집</button>
            <button style={Object.assign({},btnSm,{fontSize:10,padding:"3px 7px",color:"#DC2626",border:"1px solid #FECACA"})} onClick={function(e){e.stopPropagation();if(window.confirm(emp.name+" 삭제?"))props.onDelete(emp.id);}}>삭제</button>
          </div>
        </div>
      </div>
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
            uploadFn={uploadFn} getUrlFn={getUrlFn}
            onChange={function(ds){props.onPatch(emp.id,{employeeDocs:ds});}}
            onLog={function(txt){props.onLog(emp.name+": "+txt);}}
          />
          {/* 급여/연락처 */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:8}}>
            <div><Label>연락처</Label><input style={inp} defaultValue={emp.phone||""} placeholder="010-" onBlur={function(e){props.onPatch(emp.id,{phone:e.target.value});}}/></div>
            <div><Label>이메일</Label><input style={inp} defaultValue={emp.email||""} placeholder="email" onBlur={function(e){props.onPatch(emp.id,{email:e.target.value});}}/></div>
            <div><Label>급여(원)</Label><input type="number" style={inp} defaultValue={emp.salary||""} placeholder="2200000" onBlur={function(e){props.onPatch(emp.id,{salary:Number(e.target.value)});}}/></div>
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
  var st={
    name:useState(init.name||""),
    programId:useState(init.programId||Object.keys(programs)[0]||""),
    startDate:useState(init.startDate||""),
    birthDate:useState(init.birthDate||""),
    gender:useState(init.gender||"male"),
    milSvc:useState(init.milSvc||0),
    status:useState(init.status||"active"),
    phone:useState(init.phone||""),
    email:useState(init.email||""),
    salary:useState(init.salary||""),
    weeklyHours:useState(init.weeklyHours||40),
    memo:useState(init.memo||""),
    bd:useState(init.birthDate||""),
    gen:useState(init.gender||"male"),
    mil:useState(init.milSvc||0),
    ec:useState(init.eligConds||{}),
    xc:useState(init.exclConds||{}),
    hd:useState(init.startDate||"")
  };
  function save(){
    if(!st.name[0].trim()){alert("이름을 입력하세요");return;}
    if(!st.programId[0]){alert("지원금을 선택하세요");return;}
    var p=programs[st.programId[0]];
    var rounds=init.rounds||(p?JSON.parse(JSON.stringify(p.rounds||[])).map(function(r){return Object.assign({},r,{isPaid:false,received:0});}):[]);
    var certDocs=init.certDocs||(p?(CERT_TYPES[st.programId[0]]||[]).map(function(ct){return{id:uid(),label:ct,done:false,files:[]};}):[]);
    var empDocs=init.employeeDocs||(p?(p.employeeDocs||[]).map(function(d){return Object.assign({},d,{id:uid(),done:false,files:[]});}):[]);
    props.onSave({
      id:init.id||uid(),
      companyId:company.id,
      name:st.name[0].trim(),
      programId:st.programId[0],
      startDate:st.startDate[0],
      birthDate:st.bd[0]||st.birthDate[0],
      gender:st.gen[0]||st.gender[0],
      milSvc:st.mil[0]||st.milSvc[0],
      status:st.status[0],
      phone:st.phone[0],
      email:st.email[0],
      salary:Number(st.salary[0])||0,
      weeklyHours:Number(st.weeklyHours[0])||40,
      memo:st.memo[0],
      eligConds:st.ec[0],
      exclConds:st.xc[0],
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
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><Label>입사일 *</Label><input type="date" style={inp} value={st.startDate[0]} onChange={function(e){st.startDate[1](e.target.value);st.hd[1](e.target.value);}}/></div>
          <div><Label>연락처</Label><input style={inp} value={st.phone[0]} onChange={function(e){st.phone[1](e.target.value);}} placeholder="010-"/></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><Label>이메일</Label><input style={inp} value={st.email[0]} onChange={function(e){st.email[1](e.target.value);}}/></div>
          <div><Label>월급여(원)</Label><input type="number" style={inp} value={st.salary[0]} onChange={function(e){st.salary[1](e.target.value);}} placeholder="2200000"/></div>
        </div>
        <div>
          <Label>지원금 *</Label>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:4}}>
            {Object.values(programs).map(function(p){var on=st.programId[0]===p.id;var gp=GROUP_COLORS[p.group]||GROUP_COLORS["커스텀"];return(
              <button key={p.id} onClick={function(){st.programId[1](p.id);}}
                style={{padding:"8px 10px",borderRadius:8,fontSize:11,cursor:"pointer",textAlign:"left",border:"2px solid "+(on?gp.base:"#E2E8F0"),background:on?gp.badge:"#fff",color:on?gp.text:"#475569"}}>
                <div style={{fontWeight:on?700:500}}>{gp.icon} {p.name}</div>
                <div style={{fontSize:10,color:on?gp.dark:"#94A3B8"}}>{fMan(p.totalAmount||0)}</div>
              </button>
            );})}
          </div>
        </div>
        {selectedP&&(st.bd[0]||st.birthDate[0])&&(
          <EligChk bd={st.bd[0]||st.birthDate[0]} gen={st.gen[0]||st.gender[0]} mil={st.mil[0]||st.milSvc[0]} ec={st.ec[0]} xc={st.xc[0]}
            hd={st.startDate[0]} setBd={function(v){st.bd[1](v);}} setGen={function(v){st.gen[1](v);}} setMil={function(v){st.mil[1](v);}} setEc={st.ec[1]} setXc={st.xc[1]}/>
        )}
        <div><Label>메모</Label><textarea style={Object.assign({},inp,{height:60,resize:"none"})} value={st.memo[0]} onChange={function(e){st.memo[1](e.target.value);}}/></div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button style={btnS} onClick={props.onClose}>취소</button>
          <button style={Object.assign({},btnP,{padding:"10px 28px"})} onClick={save}>저장</button>
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
    rounds[ri]=Object.assign({},rounds[ri],{isPaid:true,received:Number(st1[0]),paidDate:st2[0],note:st3[0]});
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
  var st5=useState("active"); // status filter
  var st6=useState(false); // edit company modal

  var filteredEmps=compEmps.filter(function(e){
    if(st5[0]==="all")return true;
    return e.status===st5[0];
  });
  var activeCount=compEmps.filter(function(e){return e.status!=="resigned";}).length;
  var totalPaid=compEmps.reduce(function(s,e){return s+(e.rounds||[]).reduce(function(ss,r){return ss+(r.isPaid?r.received||0:0);},0);},0);
  var totalExp=compEmps.reduce(function(s,e){return s+(e.totalExpected||0);},0);

  function handleSaveEmp(empData){
    props.onSaveEmployee(empData);
    st1[1](false);
    st2[1](null);
  }
  function handleRoundSave(rounds){
    if(st3[0])props.onPatchEmployee(st3[0].id,{rounds:rounds});
    st3[1](null);st4[1](null);
  }
  function handleBulkUpload(rows){
    rows.forEach(function(row){
      var p=programs[row.programId]||Object.values(programs)[0];
      if(!p)return;
      var rounds=(p.rounds||[]).map(function(r){return Object.assign({},r,{isPaid:false,received:0});});
      props.onSaveEmployee({
        id:uid(),companyId:company.id,name:row.name,programId:row.programId||p.id,
        startDate:row.startDate,birthDate:row.birthDate,gender:row.gender||"male",
        status:"active",phone:row.phone,email:row.email,
        totalExpected:p.totalAmount||0,rounds:rounds,
        certDocs:(CERT_TYPES[p.id]||[]).map(function(ct){return{id:uid(),label:ct,done:false,files:[]};})
      });
    });
  }
  return(
    <div>
      {/* 헤더 */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        <button onClick={props.goBack} style={Object.assign({},btnSm,{fontWeight:700})}>← 목록</button>
        <h2 style={{margin:0,fontSize:18,fontWeight:800,flex:1}}>{company.name}</h2>
        <PDFReport company={company} employees={compEmps} programs={programs} profile={props.profile}/>
        <button style={Object.assign({},btnSm)} onClick={function(){st6[1](true);}}>⚙️ 편집</button>
      </div>

      {/* 요약 카드 */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
        {[{l:"대상자",v:activeCount+"명",c:"#2563EB"},{l:"수령완료",v:fMan(totalPaid),c:"#059669"},{l:"예상잔여",v:fMan(totalExp-totalPaid),c:"#8B5CF6"}].map(function(c,i){return(
          <Card key={i} style={{padding:"12px 14px",textAlign:"center"}}>
            <div style={{fontSize:10,color:"#64748B",marginBottom:2}}>{c.l}</div>
            <div style={{fontSize:16,fontWeight:700,color:c.c}}>{c.v}</div>
          </Card>
        );})}
      </div>

      {/* 업체 서류 */}
      <DocSection title="업체 서류" docs={company.companyDocs||[]} disabled={false}
        uploadFn={uploadFn} getUrlFn={getUrlFn}
        onChange={function(ds){props.onPatchCompany(company.id,{companyDocs:ds});}}
        onLog={function(txt){props.onLog(company.name+": "+txt);}}
      />

      {/* 직원 섹션 */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,marginTop:16,flexWrap:"wrap",gap:6}}>
        <h3 style={{margin:0,fontSize:15,fontWeight:700}}>👤 직원 ({compEmps.length}명)</h3>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <BulkUpload programs={programs} onUpload={handleBulkUpload}/>
          <button style={btnP} onClick={function(){st1[1](true);}}>+ 직원 추가</button>
        </div>
      </div>

      {/* 상태 필터 */}
      <div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}>
        {[{key:"all",label:"전체 ("+compEmps.length+")"}].concat(STS.map(function(s){var cnt=compEmps.filter(function(e){return e.status===s.key;}).length;return{key:s.key,label:s.icon+" "+s.label+(cnt>0?" ("+cnt+")":""),cnt:cnt};})).map(function(f){return(
          <button key={f.key} onClick={function(){st5[1](f.key);}}
            style={Object.assign({},btnSm,{fontSize:11,background:st5[0]===f.key?"#2563EB":"#fff",color:st5[0]===f.key?"#fff":"#475569",border:st5[0]===f.key?"none":"1px solid #E2E8F0"})}>
            {f.label}
          </button>
        );})}
      </div>

      {filteredEmps.length===0?(
        <Card style={{padding:32,textAlign:"center"}}>
          <p style={{color:"#94A3B8",fontSize:13,margin:0}}>해당 상태의 직원이 없습니다.</p>
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
        );}))
      }

      {/* Modals */}
      {(st1[0]||st2[0])&&(
        <EmpModal open={true} onClose={function(){st1[1](false);st2[1](null);}}
          emp={st2[0]} company={company} programs={programs} onSave={handleSaveEmp}/>
      )}
      <RoundModal open={!!st3[0]&&st4[0]!==null} onClose={function(){st3[1](null);st4[1](null);}}
        emp={st3[0]} roundIndex={st4[0]} programs={programs} onSave={handleRoundSave}/>
      {st6[0]&&<CompanyEditModal open={true} onClose={function(){st6[1](false);}} company={company} onSave={function(data){props.onPatchCompany(company.id,data);st6[1](false);}}/>}
    </div>
  );
}

// ── CompanyEditModal ──────────────────────────────────────
function CompanyEditModal(props){
  var c=props.company||{};
  var st={
    name:useState(c.name||""),
    bizNo:useState(c.bizNo||""),
    ceoName:useState(c.ceoName||""),
    addr:useState(c.addr||""),
    phone:useState(c.phone||""),
    email:useState(c.email||""),
    empCount:useState(c.empCount||""),
    bizType:useState(c.bizType||""),
    corpType:useState(c.corpType||"개인"),
    juPosition:useState(c.juPosition||""),
    sector:useState(c.sector||""),
    region:useState(c.region||"비수도권"),
    insuranceDate:useState(c.insuranceDate||""),
    memo:useState(c.memo||""),
    tags:useState(c.tags||[])
  };
  function save(){
    if(!st.name[0].trim()){alert("업체명을 입력하세요");return;}
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
          <div><Label>사업자등록번호</Label><input style={inp} value={st.bizNo[0]} onChange={function(e){st.bizNo[1](e.target.value);}} placeholder="000-00-00000"/></div>
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
        <div><Label>주소</Label><input style={inp} value={st.addr[0]} onChange={function(e){st.addr[1](e.target.value);}}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><Label>전화</Label><input style={inp} value={st.phone[0]} onChange={function(e){st.phone[1](e.target.value);}}/></div>
          <div><Label>이메일</Label><input style={inp} value={st.email[0]} onChange={function(e){st.email[1](e.target.value);}}/></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          <div><Label>상시근로자 수</Label><input type="number" style={inp} value={st.empCount[0]} onChange={function(e){st.empCount[1](e.target.value);}}/></div>
          <div><Label>업종</Label><input style={inp} value={st.bizType[0]} onChange={function(e){st.bizType[1](e.target.value);}}/></div>
          <div><Label>지역</Label>
            <select style={inp} value={st.region[0]} onChange={function(e){st.region[1](e.target.value);}}>
              {["수도권","비수도권"].map(function(r){return <option key={r}>{r}</option>;})}
            </select>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><Label>고용보험 성립일</Label><input type="date" style={inp} value={st.insuranceDate[0]} onChange={function(e){st.insuranceDate[1](e.target.value);}}/></div>
          <div><Label>분야/유형</Label><input style={inp} value={st.sector[0]} onChange={function(e){st.sector[1](e.target.value);}}/></div>
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
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button style={btnS} onClick={props.onClose}>취소</button>
          <button style={Object.assign({},btnP,{padding:"10px 28px"})} onClick={save}>저장</button>
        </div>
      </div>
    </Modal>
  );
}

// ── ProgramsList ──────────────────────────────────────────
function ProgramsList(props){
  var programs=props.programs,onUpdate=props.onUpdate;
  var st1=useState(false); // add modal
  var st2=useState(null);  // edit target
  var st={
    name:useState(""),
    group:useState("커스텀"),
    totalAmount:useState(""),
    months:useState(""),
    desc:useState("")
  };
  function resetSt(){Object.values(st).forEach(function(s){s[1](s[0] instanceof Array?[]:""||"");});st.name[1]("");st.group[1]("커스텀");st.totalAmount[1]("");st.months[1]("");st.desc[1]("");}
  function openEdit(p){st2[1](p);st.name[1](p.name);st.group[1](p.group||"커스텀");st.totalAmount[1](p.totalAmount||"");st.months[1]((p.rounds||[]).map(function(r){return r.month;}).join(","));st.desc[1](p.desc||"");}
  function saveCustom(){
    if(!st.name[0].trim())return;
    var monthArr=(st.months[0]||"6,12").split(",").map(function(m){return parseInt(m.trim());}).filter(Boolean);
    var total=Number(st.totalAmount[0])||0;
    var perRound=monthArr.length>0?Math.round(total/monthArr.length):0;
    var newP={
      id:st2[0]?st2[0].id:"custom_"+uid(),
      name:st.name[0].trim(),group:"커스텀",
      totalAmount:total,desc:st.desc[0],
      color:GROUP_COLORS["커스텀"].base,
      rounds:monthArr.map(function(m,i){return{month:m,label:(i+1)+"회차",expectedAmount:perRound,amount:perRound};}),
      companyDocs:[],employeeDocs:[]
    };
    var updated=Object.assign({},programs);
    updated[newP.id]=newP;
    onUpdate(updated);
    st1[1](false);st2[1](null);
  }
  function deleteCustom(pid){
    if(!window.confirm("삭제?"))return;
    var updated=Object.assign({},programs);
    delete updated[pid];
    onUpdate(updated);
  }
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <h2 style={{margin:0,fontSize:18,fontWeight:800}}>⚙️ 지원금 관리</h2>
        <button style={btnP} onClick={function(){resetSt();st1[1](true);st2[1](null);}}>+ 커스텀 추가</button>
      </div>
      {["신규채용","재직자유지","육아","커스텀"].map(function(grp){
        var items=Object.values(programs).filter(function(p){return p.group===grp;});
        if(!items.length)return null;
        var gp=GROUP_COLORS[grp]||GROUP_COLORS["커스텀"];
        return(
          <div key={grp} style={{marginBottom:18}}>
            <div style={{fontSize:13,fontWeight:700,color:gp.dark,marginBottom:8}}>{gp.icon} {grp} ({items.length}개)</div>
            <div style={{display:"grid",gap:8}}>
              {items.map(function(p){
                var isCustom=!DEFAULT_PROGRAMS[p.id];
                return(
                  <Card key={p.id} style={{padding:"14px 16px",border:"1.5px solid "+gp.light}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                          <span style={{fontSize:14,fontWeight:700}}>{p.name}</span>
                          {isCustom&&<Badge color={gp.text} bg={gp.badge}>커스텀</Badge>}
                        </div>
                        <div style={{fontSize:12,color:"#64748B",marginBottom:4}}>{p.desc||""}</div>
                        <div style={{display:"flex",gap:8,fontSize:11,color:"#475569",flexWrap:"wrap"}}>
                          <span>총액 {fMan(p.totalAmount||0)}</span>
                          <span>{(p.rounds||[]).length}회차</span>
                          <span>{(p.rounds||[]).map(function(r){return r.month+"개월";}).join(", ")}</span>
                        </div>
                      </div>
                      {isCustom&&(
                        <div style={{display:"flex",gap:4,flexShrink:0}}>
                          <button style={btnSm} onClick={function(){openEdit(p);st1[1](true);}}>편집</button>
                          <button style={Object.assign({},btnSm,{color:"#DC2626",border:"1px solid #FECACA"})} onClick={function(){deleteCustom(p.id);}}>삭제</button>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
      <Modal open={st1[0]} onClose={function(){st1[1](false);st2[1](null);}} title={(st2[0]?"커스텀 편집":"커스텀 지원금 추가")} width={440}>
        <div style={{display:"grid",gap:12}}>
          <div><Label>지원금명 *</Label><input style={inp} value={st.name[0]} onChange={function(e){st.name[1](e.target.value);}}/></div>
          <div><Label>총 지원금액(원)</Label><input type="number" style={inp} value={st.totalAmount[0]} onChange={function(e){st.totalAmount[1](e.target.value);}} placeholder="3000000"/></div>
          <div><Label>신청 회차 (입사 후 개월, 쉼표로 구분)</Label><input style={inp} value={st.months[0]} onChange={function(e){st.months[1](e.target.value);}} placeholder="6,12"/></div>
          <div><Label>설명</Label><textarea style={Object.assign({},inp,{height:60,resize:"none"})} value={st.desc[0]} onChange={function(e){st.desc[1](e.target.value);}}/></div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button style={btnS} onClick={function(){st1[1](false);st2[1](null);}}>취소</button>
            <button style={Object.assign({},btnP,{padding:"10px 28px"})} onClick={saveCustom}>저장</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Main SubsidyApp export ────────────────────────────────
// ── 사이드바 네비 아이템 ──────────────────────────────────
var SIDEBAR_NAV = [
  {key:"dashboard", icon:"📊", label:"대시보드"},
  {key:"company",   icon:"🏢", label:"업체 관리"},
  {key:"wage",      icon:"🧮", label:"급여 계산기"},
  {key:"simulator", icon:"📈", label:"수령액 시뮬"},
  {key:"diagnosis", icon:"🎯", label:"채용 진단"},
  {key:"programs",  icon:"⚙️", label:"지원금 관리"},
];

export default function SubsidyApp(props){
  var companies=props.companies||[];
  var employees=props.employees||[];
  var programs=props.programs||DEFAULT_PROGRAMS;
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
  var stCompany=useState(null);
  var stAddComp=useState(false);
  var stProfileOpen=useState(false);
  var stMobileNav=useState(false);

  function goCompany(id){stCompany[1](id);stView[1]("company");}
  function goBack(){stView[1]("dashboard");stCompany[1](null);}
  function addLog(){}

  var selectedCompany=stCompany[0]?companies.find(function(c){return c.id===stCompany[0];})||null:null;
  var stPN=useState(profile.display_name||"");
  var stPT=useState(profile.title||"");
  var stDDA=useState((profile.settings&&profile.settings.ddayAlert)||7);
  function saveProfile(){onUpdateProfile({display_name:stPN[0],title:stPT[0],settings:Object.assign({},profile.settings||{},{ddayAlert:stDDA[0]})});stProfileOpen[1](false);}

  // 현재 활성 탭
  var activeKey=stView[0]==="company"?"company":stView[0];

  // 사이드바 스타일
  var SB={
    wrap:{width:240,minHeight:"100vh",background:"#1E293B",display:"flex",flexDirection:"column",position:"fixed",left:0,top:0,bottom:0,zIndex:200,fontFamily:FF},
    brand:{padding:"24px 20px 20px",borderBottom:"1px solid rgba(255,255,255,0.08)"},
    brandTitle:{fontSize:17,fontWeight:800,color:"#fff",letterSpacing:"-0.3px"},
    brandSub:{fontSize:12,color:"#64748B",marginTop:3},
    nav:{flex:1,padding:"12px 0",overflowY:"auto"},
    item:function(active){return{display:"flex",alignItems:"center",gap:10,padding:"11px 20px",fontSize:14,fontWeight:active?600:400,color:active?"#fff":"#94A3B8",background:active?"rgba(37,99,235,0.3)":"transparent",borderLeft:active?"3px solid #3B82F6":"3px solid transparent",cursor:"pointer",transition:"all 0.15s",userSelect:"none"};},
    icon:{fontSize:16,width:22,textAlign:"center"},
    bottom:{padding:"16px 20px",borderTop:"1px solid rgba(255,255,255,0.08)"},
    user:{display:"flex",alignItems:"center",gap:10,marginBottom:14},
    avatar:{width:36,height:36,borderRadius:18,background:"linear-gradient(135deg,#3B82F6,#1D4ED8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,color:"#fff",fontWeight:700,flexShrink:0},
    userName:{fontSize:14,fontWeight:600,color:"#E2E8F0",lineHeight:1.3},
    userRole:{fontSize:12,color:"#64748B"},
    actions:{display:"flex",gap:6},
    actionBtn:function(c){return{flex:1,padding:"7px 0",fontSize:12,fontWeight:500,borderRadius:7,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.05)",color:c||"#94A3B8",cursor:"pointer",textAlign:"center"};},
  };

  function NavItem(p){
    return(
      <div style={SB.item(p.active)} onClick={p.onClick}
        onMouseEnter={function(e){if(!p.active)e.currentTarget.style.background="rgba(255,255,255,0.05)";}}
        onMouseLeave={function(e){if(!p.active)e.currentTarget.style.background="transparent";}}>
        <span style={SB.icon}>{p.icon}</span>
        <span>{p.label}</span>
      </div>
    );
  }

  var trialDays=props.trialDaysLeft;

  return(
    <div style={{minHeight:"100vh",background:"#F1F5F9",fontFamily:FF,display:"flex"}}>

      {/* ── 사이드바 ── */}
      <div style={SB.wrap}>
        {/* 브랜드 */}
        <div style={SB.brand}>
          <div style={SB.brandTitle}>🏛 고용지원금 Pro</div>
          {orgName&&<div style={SB.brandSub}>{orgName}</div>}
          {trialDays!==null&&trialDays!==undefined&&(
            <div style={{marginTop:8,display:"inline-flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:20,background:"rgba(251,191,36,0.15)",border:"1px solid rgba(251,191,36,0.3)"}}>
              <span style={{fontSize:10}}>⏳</span>
              <span style={{fontSize:11,color:"#FCD34D",fontWeight:600}}>무료체험 {trialDays}일 남음</span>
            </div>
          )}
        </div>

        {/* 네비 */}
        <div style={SB.nav}>
          {SIDEBAR_NAV.map(function(n){
            return(
              <NavItem key={n.key} icon={n.icon} label={n.label} active={activeKey===n.key}
                onClick={function(){stView[1](n.key);stCompany[1](null);}}
              />
            );
          })}
        </div>

        {/* 하단: 유저 정보 + 버튼 */}
        <div style={SB.bottom}>
          <div style={SB.user} onClick={function(){stProfileOpen[1](true);}} title="프로필 설정">
            <div style={SB.avatar}>{(profile.display_name||"?").charAt(0)}</div>
            <div style={{minWidth:0}}>
              <div style={SB.userName}>{profile.display_name||"사용자"}</div>
              <div style={SB.userRole}>{profile.title||"담당자"}</div>
            </div>
          </div>
          <div style={SB.actions}>
            <button style={SB.actionBtn()} onClick={function(){stProfileOpen[1](true);}}>설정</button>
            <button style={SB.actionBtn("#FCA5A5")} onClick={onSignOut}>로그아웃</button>
          </div>
        </div>
      </div>

      {/* ── 콘텐츠 영역 ── */}
      <div style={{marginLeft:240,flex:1,minHeight:"100vh",display:"flex",flexDirection:"column"}}>
        {/* 상단 헤더바 */}
        <div style={{background:"#fff",borderBottom:"1px solid #E2E8F0",padding:"0 32px",height:60,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
          <div>
            {stView[0]==="company"&&selectedCompany?(
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <button onClick={goBack} style={{background:"none",border:"none",color:"#64748B",cursor:"pointer",fontSize:14,padding:0}}>← 업체 목록</button>
                <span style={{color:"#CBD5E1"}}>/</span>
                <span style={{fontSize:16,fontWeight:700,color:"#1E293B"}}>{selectedCompany.name}</span>
              </div>
            ):(
              <span style={{fontSize:17,fontWeight:700,color:"#1E293B"}}>
                {(SIDEBAR_NAV.find(function(n){return n.key===activeKey;})||{label:"대시보드"}).icon}&nbsp;
                {(SIDEBAR_NAV.find(function(n){return n.key===activeKey;})||{label:"대시보드"}).label}
              </span>
            )}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {(stView[0]==="dashboard"||stView[0]==="company")&&!selectedCompany&&(
              <button style={btnP} onClick={function(){stAddComp[1](true);}}>+ 업체 추가</button>
            )}
          </div>
        </div>

        {/* 페이지 콘텐츠 */}
        <div style={{flex:1,padding:"28px 32px",maxWidth:1100,width:"100%"}}>

          {(stView[0]==="dashboard"||stView[0]==="company")&&!selectedCompany&&(
            <Dashboard
              companies={companies} employees={employees} programs={programs}
              calendarMemos={calendarMemos} onSaveMemo={onSaveMemo}
              goCompany={goCompany} settings={profile.settings||{}}
            />
          )}

          {stView[0]==="company"&&selectedCompany&&(
            <CompDet
              company={selectedCompany} programs={programs} employees={employees}
              uploadFn={uploadFn} getUrlFn={getUrlFn} profile={profile}
              goBack={goBack}
              onSaveEmployee={onSaveEmployee}
              onPatchEmployee={onPatchEmployee}
              onDeleteEmployee={onDeleteEmployee}
              onPatchCompany={onPatchCompany}
              onLog={addLog}
            />
          )}

          {stView[0]==="wage"&&(
            <div style={{maxWidth:700}}>
              <p style={{margin:"0 0 20px",color:"#64748B",fontSize:15}}>2026년 최저임금 기준으로 급여 적정성을 판단합니다.</p>
              <WageCalc/>
            </div>
          )}

          {stView[0]==="simulator"&&(
            <div style={{maxWidth:800}}>
              <p style={{margin:"0 0 20px",color:"#64748B",fontSize:15}}>채용 인원과 입사일을 입력하면 월별 수령 예상액을 계산합니다.</p>
              <Simulator programs={programs}/>
            </div>
          )}

          {stView[0]==="diagnosis"&&(
            <div style={{maxWidth:800}}>
              <p style={{margin:"0 0 20px",color:"#64748B",fontSize:15}}>채용 조건을 입력하면 신청 가능한 지원금을 진단합니다.</p>
              <HiringDiagnosis programs={programs}/>
            </div>
          )}

          {stView[0]==="programs"&&(
            <ProgramsList programs={programs} onUpdate={onSavePrograms}/>
          )}
        </div>
      </div>

      {/* Add Company Modal */}
      {stAddComp[0]&&(
        <CompanyEditModal open={true} onClose={function(){stAddComp[1](false);}} company={null}
          onSave={function(data){
            var prog=Object.values(DEFAULT_PROGRAMS)[0];
            var newComp=Object.assign({id:uid(),createdAt:new Date().toISOString(),companyDocs:(prog?prog.companyDocs||[]:[]).map(function(d){return Object.assign({},d,{id:uid(),done:false,files:[]});})},data);
            onSaveCompany(newComp);
            stAddComp[1](false);
            goCompany(newComp.id);
          }}
        />
      )}

      {/* Profile Modal */}
      <Modal open={stProfileOpen[0]} onClose={function(){stProfileOpen[1](false);}} title="👤 프로필 설정" width={420}>
        <div style={{display:"grid",gap:16}}>
          <div><Label>이름/담당자명</Label><input style={inp} value={stPN[0]} onChange={function(e){stPN[1](e.target.value);}} placeholder="홍길동"/></div>
          <div><Label>직함</Label><input style={inp} value={stPT[0]} onChange={function(e){stPT[1](e.target.value);}} placeholder="공인노무사 / 팀장 ..."/></div>
          <div><Label>D-Day 알림 기준 (일)</Label><input type="number" style={inp} value={stDDA[0]} onChange={function(e){stDDA[1](Number(e.target.value));}} min={1} max={30}/></div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button style={btnS} onClick={function(){stProfileOpen[1](false);}}>취소</button>
            <button style={Object.assign({},btnP,{padding:"11px 32px"})} onClick={saveProfile}>저장</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
