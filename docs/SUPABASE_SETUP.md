# WHITE HORIZON — Supabase 설정 (STEP 7)

2026-09-23 사용자가 아래 SQL과 환경변수 설정을 완료했고, 서버용 Secret key와 실제 DB 연결을 확인했다. 이 문서는 새 환경/배포를 설정할 때 참고한다. 현재는 Next.js API를 통한 온라인 저장과 랭킹 조회가 연결되어 있다. Node.js 22 이상을 사용한다.

## 1. 프로젝트 만들기

[Supabase Dashboard](https://supabase.com/dashboard)에서 **New project**를 선택한다. 조직, 프로젝트 이름(예: `white-horizon`), DB 비밀번호, 리전을 정하고 생성이 완료될 때까지 기다린다. DB 비밀번호는 아래 API 키와 다른 값이다.

## 2. URL과 서버 키 찾기

2026-09-23 공식 문서 기준:

- 프로젝트의 **Connect** 창에서 Project URL을 복사한다.
- **Settings → API Keys**에서 키를 확인한다. 기존 `service_role` 키는 이 화면의 legacy 키 영역에 있다.
- 새 프로젝트는 **Publishable and secret API keys** 영역에서 서버용 **Secret key** (`sb_secret_...`)를 생성/복사하는 것이 권장된다. 이는 DB의 `service_role` 권한으로 동작한다. 기존 JWT `service_role` 키도 아직 사용할 수 있다.

출처: [API 키 및 현재 Dashboard 경로](https://supabase.com/docs/guides/getting-started/api-keys), [새 API 키 설정](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys).

## 3. 환경변수 저장

프로젝트 루트에 `.env.local`을 만들고 다음 두 값을 입력한다. 기존 파일이 있다면 나머지 값은 유지한다.

```dotenv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_KEY
```

요청한 환경변수 이름 `SUPABASE_SERVICE_ROLE_KEY`를 유지한다. 값에는 권장되는 `sb_secret_...` 키 또는 기존 `service_role` 키를 넣을 수 있다. `anon`/publishable 키와 DB 비밀번호를 넣지 않는다.

이 키에는 **`NEXT_PUBLIC_`를 붙이지 않는다.** 서버 전용 키는 브라우저 코드·Git·채팅에 공유하지 않고 `.env.local`에만 둔다. 이 저장소는 `.env*`를 Git에서 제외하고 있다. 배포 환경에도 같은 이름으로 서버 환경변수를 설정한다. 변경 후 개발 서버를 재시작해야 한다. [서버 키 사용 기준](https://supabase.com/docs/guides/getting-started/api-keys)

## 4. 테이블·뷰·RLS 생성

프로젝트 **SQL Editor → New query**에서 [`supabase/001_game_records.sql`](../supabase/001_game_records.sql) 전체를 붙여넣고 실행한다. 새 프로젝트의 PostgreSQL 15 이상을 기준으로 한다.

하나의 SQL로 다음이 만들어진다.

- `game_records`: 모든 수동 저장 기록, 고유한 `run_id`, 음수 방지 제약, 조회 인덱스.
- `leaderboard`: 플레이어별 최고 기록 한 개. SCORE → STAGE → DISTANCE 내림차순, 생성 시각 오름차순. 완전히 같은 기록은 `id`로 순서를 고정한다.
- 테이블 RLS 활성화, 브라우저용 `anon`/`authenticated` 접근 권한 제거, 서버 역할에 조회·삽입 권한 부여.
- 뷰의 `security_invoker = true`: 테이블 RLS가 뷰에서도 적용되도록 한다. 일반 뷰는 소유자 권한으로 동작할 수 있어 이 옵션과 접근 권한 제한을 함께 사용한다. [Supabase RLS 문서](https://supabase.com/docs/guides/database/postgres/row-level-security)

Table Editor에서 `game_records`와 `leaderboard`를 확인한다. 테이블의 RLS는 켜져 있어야 하며, `anon` INSERT 정책은 만들지 않는다. SQL은 사용자가 직접 실행했다. 새 환경에서 처음 연결했을 때는 기록이 0개인 것이 정상이다.

## 5. 연결 확인

환경변수 설정 후 개발 서버를 재시작하고 메인 메뉴의 랭킹 보드를 연다. 등록 기록이 없으면 빈 목록 안내가 표시된다. 게임오버 때 **내 기록 저장하기**를 누르면 기록이 저장되며 랭킹 보드에서 본인의 최고 점수와 순위를 확인할 수 있다. 키 자체를 메시지에 붙이지 않는다.

Next.js 서버가 POST `/api/records`, GET `/api/rankings`를 처리한다. `SUPABASE_SERVICE_ROLE_KEY`에 publishable 키를 넣으면 서버에서 거절한다. 기록을 저장하지 않고 랭킹을 여는 동작은 DB에 기록을 만들지 않는다.
