# 4대보험 명부 고용혜택 1분 진단기

4대보험 가입자 명부(PDF·엑셀·CSV)를 업로드하면 **고용지원금 1차 검토 후보**, **통합고용세액공제 예상액**, **최대 예상 총 혜택**을 한 번에 보여주는 독립 웹앱입니다.

> 고용지원금 Pro 내부의 "4대보험 명부 자동진단" 기능을 별도 URL/배포로 분리한 독립 서비스입니다. 계산·판정 로직은 원본 최신 버전과 동일합니다.

## 핵심 특징

- 파일 선택 → 추출 내용 확인 → 명부 정리 → 1차 진단 결과(직원별/지원금별/세액공제/총 혜택/추가자료)
- PDF(텍스트) · 엑셀 · CSV 지원, "전체 파일에서 선택" 폴백, 이미지 파일 거부
- 4대보험(연금/건강/산재/고용) 가입 상태 표시·수동 수정, 2개 이상 미가입 시 특수관계자·임원 확인 안내
- 통합고용세액공제 예상(수도권/지방), 과대계산 검증, 최대 예상 총 혜택 요약
- 상담용 요약 복사(주민등록번호 미포함)

## 개인정보 보호

- 파일·명부 내용은 **브라우저 메모리에서만** 처리합니다. 서버/Supabase/스토리지 업로드 없음.
- localStorage/sessionStorage에 파일 내용·주민등록번호 저장 없음.
- 주민등록번호는 화면에 마스킹(예: `900101-1******`)되며, 결과 복사·로그에 원문이 포함되지 않습니다.
- 외부 AI API로 명부 내용을 전송하지 않습니다.

## 로컬 실행

```bash
npm install
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드 (dist/)
npm run preview  # 빌드 결과 미리보기
```

요구: Node 18+ (권장 20+).

## 구조

```
src/
  config/service.js          # 서비스명/브랜딩 (이름 변경은 여기만)
  domain/payrollDiagnosis.js # 분석·판정·계산 로직 (UI 비의존, 재이식 용이)
  features/RosterDiagnosis.jsx # 분석 화면(컴포넌트) + Modal/Toast 셸
  App.jsx                    # 진입(접속 즉시 분석기 오픈)
  main.jsx, index.css
```

분석 로직은 `src/domain/payrollDiagnosis.js` 한 파일에 모듈화되어 있어, 다른 SaaS에 다시 붙일 때 이 파일 + `RosterDiagnosis.jsx`만 가져오면 됩니다.

## 배포 (Vercel)

- Framework Preset: **Vite**
- Build Command: `npm run build`
- Output Directory: `dist`
- 환경변수: 없음 (1차 버전)

## 운영 원칙 (자동 커밋·배포)

`CLAUDE.md`의 운영 원칙을 따릅니다: 수정 요청 시 코드 수정 → `npm run build` → 커밋 → `main` push → Vercel 자동배포 확인까지 한 번에 진행하며, 매번 커밋/배포 여부를 되묻지 않습니다.
