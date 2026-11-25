# 미술 작품 투표 (화면 확인용 v2)

React + TypeScript + Vite 데모 프로젝트입니다.

## 변경 내용
- 첫 화면 학번·이름 로그인 (비밀번호/별명 입력 없음)
- 작품 등록, 투표하기, 투표 결과 탭 유지
- 5개 섹션을 `src/lib/demo.ts`의 `categories`에서 단일 관리
- 업로드 때 지정한 `categoryId`가 투표하기와 투표 결과에 그대로 반영됨
- 섹션별 최대 3표, 총 15표 최종 제출
- 초기 화면은 빈 작품 목록이며 관리자 화면에서 `작품 등록` -> `투표 진행` -> `결과 공개` 단계를 변경하여 시험할 수 있음

## 실행
```sh
npm install
npm run dev
```

## GitHub Pages 배포
저장소 이름은 `school-art-vote`를 기준으로 하며 `vite.config.ts`의 base가 `/school-art-vote/`로 설정되어 있습니다.
`.github/workflows/deploy.yml`이 자동으로 빌드/배포합니다. GitHub 저장소 Settings > Pages의 Source는 GitHub Actions로 설정하세요.

## 주의
**Supabase를 연결하지 않은 프론트엔드 데모입니다.** 데이터는 기기별 브라우저 localStorage에만 저장됩니다. 학번과 이름은 실제 본인 인증이 아니며 관리자 화면에도 인증이 없습니다. 실제 학생 개인정보나 공식 투표에 사용하지 마세요. 다른 기기의 업로드/투표 내역은 공유되지 않습니다. 테스트 데이터는 브라우저 저장 공간에 한해 유지됩니다.
