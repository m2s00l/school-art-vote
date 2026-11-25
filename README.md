# 미술 작품 투표 v4 — Supabase 연동 버전

이 프로젝트는 **기존 v3 UI를 바탕으로 제작한 서버 연결용 코드**입니다. 학생 로그인의 학번+이름 방식은 신원 보증이 되지 않습니다. 실제 학생에게 공개하기 전에 반드시 2계정/2기기 시험 및 권한 점검을 완료하세요.

## 0. 지금까지 완료한 것
- Supabase `students`, `categories`, `artworks`, `votes`, `settings` 테이블
- `artworks` Private Storage bucket
- 테스트 학생 `30901,테스트1`, `30902,테스트2`
- Edge Function `art-api` (현재는 테스트 코드)

## 1. SQL Editor에서 보안/투표 처리 SQL 실행

`supabase/migrations/20261125_v4.sql` 파일 내용을 **한 번** SQL Editor > New snippet에 붙여 넣고 Run.

기존 테이블을 없애지 않습니다. 추가로 `app_sessions`, `vote_submissions`, `admin_login_attempts`를 만들고, 투표를 원자적으로 제출하는 `submit_art_ballot` 함수를 등록합니다. 기존 RLS 정책과 접근 권한 차단은 그대로 유지합니다.

## 2. Edge Function 코드 교체

Supabase Dashboard > Edge Functions > `art-api` > Code > `index.ts`에서 이전 테스트 코드를 **전부 삭제하고** `supabase/functions/art-api/index.ts` 전체를 붙여 넣어 `Deploy updates`.

**중요: `art-api` > Settings에서 `Verify JWT`를 OFF로 설정해야 합니다.** 이 버전은 Edge Function에서 자체 서버 세션 토큰을 검증하며 Supabase Auth JWT를 사용하지 않습니다. OFF가 아니면 GitHub Pages 요청이 함수에 도달하기 전에 401로 거부됩니다.

`art-api`의 Secrets (혹은 Edge Functions > Secrets)에 아래 비밀 환경변수를 추가합니다.

- 이름: `ART_ADMIN_PASSWORD`
- 값: 추측하기 어려운 **12자 이상의 관리자 전용 비밀번호** (예시 비밀번호를 그대로 쓰지 마세요)

Supabase가 Edge Functions에 기본 제공하는 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`는 서버 코드에서만 사용합니다. 이를 GitHub, 프론트엔드 환경변수, 웹 브라우저에 입력하거나 공개하지 마세요.

**이 서버 코드는 허용 웹사이트를 `https://m2s00l.github.io` 및 로컬 개발 서버로 제한합니다.** 다른 계정이나 도메인에서 배포하면 `originAllow`를 수정해야 합니다. CORS는 본인 인증 수단이 아니며 관리자 비밀번호와 서버 세션 검증이 별도로 필요합니다.

## 3. GitHub Pages에 프로젝트 업로드

1. 이 ZIP을 풀고 `art-gallery-vote` 폴더 **안의 파일과 폴더만** GitHub 저장소 `m2s00l/school-art-vote` 루트에 업로드합니다.
2. `.github/workflows/deploy.yml` 파일도 최신 내용으로 교체합니다. 같은 이름 파일은 덮어쓰며 오래된 파일이 있다면 직접 정리합니다.
3. GitHub 저장소 > Settings > Secrets and variables > Actions > **Variables** > **New repository variable** 생성:
   - Name: `VITE_SUPABASE_URL`
   - Value: Supabase > Project Settings > API에서 찾은 **Project URL** (`https://...supabase.co`)
4. Actions > Deploy to GitHub Pages를 재실행합니다.
5. `https://m2s00l.github.io/school-art-vote/`에서 테스트합니다.

`VITE_SUPABASE_URL`은 공개 가능한 프로젝트 주소입니다. 관리자 비밀번호와 service_role key는 여기에 절대 넣지 않습니다.

## 4. 기능 테스트 (실제 배포 전 필수)

1. 관리자 화면에서 서버 비밀번호 로그인.
2. `30901 / 테스트1`로 **기기 A** 로그인 -> 'K캐릭터' 등에 작품 1장 등록.
3. 관리자 > 운영 단계에서 `투표 진행` 선택.
4. `30902 / 테스트2`로 **다른 브라우저/기기 B** 로그인 -> 등록된 작품 표시 확인.
5. 체크박스로 작품 1장 선택 -> 최종 제출 확인.
6. 같은 학생으로 새로고침 또는 재접속 -> 제출 완료 표시 및 중복 제출 차단 확인.
7. 관리자가 `결과 공개`로 변경 -> 전체 득표수 확인.
8. 기기 A에서 본인 작품 변경/삭제가 등록 기간 외에 차단되는지 테스트.
9. 학생 계정이 관리자 화면을 무단 이용하지 못하는지 확인.

## 운영 시 주의 사항

- 학생 로그인은 **학번+이름만 대조**하므로 같은 정보를 아는 타인이 계정을 사칭할 수 있습니다. 이 취약점은 서버 검증으로 해소되지 않습니다. 공정성이 중요하면 개인 인증코드 방식을 도입하세요.
- 관리자 비밀번호는 `ART_ADMIN_PASSWORD` 서버 비밀로만 설정합니다.
- 작품은 섹션별 학생 1개, 등록할 섹션은 선택 가능하며 5개 모두 등록할 필요가 없습니다.
- 다른 기기 간 동기화는 페이지를 새로 고침해야 반영됩니다. 실시간 자동 동기화 기능은 포함되지 않았습니다.
- 제출은 전체 1~15표, 섹션별 최대 3표, 본인 작품 투표 불가, 중복 제출 불가로 처리됩니다.
- 최종 제출 후 수정은 불가능합니다. 등록 기간 중 이미지 교체나 작품 변경은 가능합니다.
- 관리자는 현재 **CSV로 명단을 추가·수정**할 수 있으며 개별 학생 삭제 UI는 포함되지 않았습니다.
- Storage의 비공개 이미지 URL은 **1시간 유효**합니다. 오래 열린 화면에서 이미지가 만료되면 새로고침합니다.
- 무료 리소스와 서비스 제공 조건은 시점에 따라 달라질 수 있습니다.
- 기존 v3 브라우저 로컬 데이터는 서버에 자동 이관되지 않습니다. 테스트 작품을 v4에서 다시 올리세요.
- GitHub Pages는 공개 정적 사이트입니다. 자격 증명과 실제 학생 명단을 저장소에 커밋하지 마세요.

## 로컬 확인

```bash
npm install
cp .env.example .env.local
# .env.local의 VITE_SUPABASE_URL 수정
npm run dev
```

## 디렉터리

- `src/App.tsx` — 학생/관리자 프론트엔드
- `src/lib/api.ts` — Edge Function API 연결
- `src/lib/demo.ts` — 섹션 이름/이미지 압축/CSV 유틸
- `supabase/migrations/20261125_v4.sql` — DB 추가 테이블/투표 트랜잭션
- `supabase/functions/art-api/index.ts` — 로그인·업로드·투표·관리자 API
- `.github/workflows/deploy.yml` — GitHub Pages 자동 배포
