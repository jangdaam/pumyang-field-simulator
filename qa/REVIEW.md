# 플레이 및 화면 검토 — 2026-09-08

## 1인칭 / 탑승 쿼터뷰 추가 검증

- V 버튼과 실제 F 키를 사용해 탑뷰 → 1인칭 도보 → 장비 쿼터뷰 → 하차 후 1인칭 전환 확인.
- 실제 마우스 드래그로 yaw 약 -0.98 rad 변화 확인. 이후 W 입력 시 x/z 이동이 바라보는 방향과 일치했고, 카메라는 y=2.25를 유지했다. 자기 캐릭터와 발밑 링은 1인칭에서 숨긴다.
- 상하 방향키로 시선 한계 +1.1 / -1.2 rad 확인. 장비 탑승 중 같은 위 키가 붐을 조작하며 저장된 1인칭 시선은 변경하지 않음.
- 지도에서 보행 캐릭터가 표시되고 지도 종료 후 같은 yaw/pitch의 1인칭으로 복원됨을 확인.
- 1440 × 900과 1280 × 720에서 쿼터뷰의 차체·붐과 계기판이 분리되어 보이는 것을 확인.
- 가까운 지면에서 보이던 그림자 패턴을 완화하기 위해 그림자 해상도와 bias를 조정했다. 새 캡처: `06-first-person.jpg`, `07-quarter-view.jpg`.
- WebMCP `navigate_field`의 `view` 동작과 시선 방향키를 검증했다. 시점/탑승 도구는 다음 렌더 프레임을 기다린 뒤 카메라 상태를 반환한다.

## 반복 검토와 수정

1. 첫 화면: 카메라가 멀어 장비 조작을 시작하는 지점의 강조가 약했고, 제목이 배경 수목에 묻혔다. 카메라 기본 폭을 74에서 65로 조정하고, 제목 배경과 조작 안내 글자를 보강했다.
2. 보행/주행: 굴착부 물리 경계가 난간보다 안쪽에 있었다. 난간 외곽 74 × 54 m를 충돌 경계로 통일하고, 긴 프레임에서 얇은 벽을 통과하지 않는 단위 검사를 추가했다.
3. 장비 야드: 빈 바닥 비중이 높았다. 서비스 차량, 자재 적치대, 콘크리트 링, 이동 조명탑을 추가하고 충돌체 및 감독자 동선을 조정했다.
4. 그랩 화면: 사일로 상부 두 표면이 겹쳐 깜박이는 현상을 발견했다. 캡 높이를 분리했다. `03-grab.jpg`는 이 문제를 발견한 중간 검토 화면이며, 최종 `05-site-map.jpg`는 수정 후 화면이다.
5. 지도/도움말: 지도에서는 주행 입력과 계기판을 숨기고, 도움말을 Esc로 닫을 때 다시 일시정지로 들어가지 않도록 수정했다. 장비에서 내리면 커터는 정지한다.

## 실제 브라우저 플레이 확인

- 1440 × 900에서 최초 진입, 가까운 크레인 탑승, 1280 × 720에서 계기판 가독성과 배치 확인.
- 크레인: 전진, 선회, 붐 각도 증가/감소, 와이어 하강. 굴착부로 전진 시 중심 z=17.401에서 정지하여 3.4 m 차체 충돌 반경 유지.
- 하차 후 차체를 돌아 서측 통로로 이동, 북서쪽 그랩에 도달해 탑승. 그랩 개방 1.0, 닫기 약 0.1, 와이어 권상·하강, 후진·조향 확인.
- 북측 통로를 횡단하여 동측 트렌치 커터까지 도보 이동. 탑승 후 회전, 와이어 하강, 선회, 가이드 각도 하한 75도 확인.
- Space 입력으로 커터 회전 종료. 일시정지 전후 작업자 좌표가 동일함을 확인.
- F, M, H, Escape의 실제 DOM 키 이벤트로 탑승, 지도, 도움말, 도움말 종료를 확인. 소리 버튼 상태 전환 확인.
- 역할별 작업자 위치가 시간에 따라 변화하며 운반·감독·신호·점검 행동이 구분됨을 확인.
- 전체 지도 열기/복귀, 장비 위치 안내와 거리 표시 확인.
- 브라우저 상태 샘플에서 대략 60 FPS, 350–430 draw calls, 2만–2.5만 triangles. 특정 시험 환경 관찰이며 모든 기기의 성능 보장은 아님.

## 자동 검사 및 브라우저 도구 계약

- TypeScript 검사, 작성 소스 lint, 프로덕션 빌드 통과.
- 이동 단위 검사 4개 통과: 대각선 속도 정규화, 얇은 벽 관통 방지, 벽을 따라 미끄러짐, 난간 경계와 원형 차체 충돌.
- WebMCP 도구 4개의 이름·스키마·readOnlyHint 확인. 상태 읽기, 장비 위치 안내, 실제 탑승·하차, 시간 제한 키 입력으로 UI와 같은 상태 전이 확인.
- 추가 필드, 잘못된 목적지, 허용하지 않은 키/시간이 의도적으로 거절됨을 확인. 일시정지 상태의 이동과 지도 상태의 탑승도 거절됨.

## 현재 범위

PC 키보드/마우스용이다. 터치 조이스틱, HMD VR, 하중/유압/토질 정밀 모델, 실제 굴착·양중 과업은 포함하지 않는다. 브로슈어 기반 교육용 장면이며 실제 현장 도면을 복제한 모델은 아니다.

## 2026-09-09: logo, motion, traffic and rendering revision

- Extracted 34 original filled paths from the brochure cover (PDF page 1, lower-left company lockup). The symbol and outlined Korean/English lettering are preserved in `public/pumyang-logo.svg`; no reconstructed font or generated artwork. Header now uses the same extracted symbol.
- Labels moved out of React's 90 ms snapshot loop into persistent DOM elements positioned every animation frame with fractional translate3d coordinates. HUD updates are separately limited to 8 Hz.
- Corrected the sign of carrying/clipboard arm rotation (local forward is negative Z). The signaller's flag is attached to the right hand, with the arm extending outward. Truck screenshot 09 clearly shows both carriers holding the box in front with both hands.
- Walk/run are exactly 1.3 × their former rates: 6.24 and 11.05 m/s. Real input test: 1 second walking moved 6.2419 m; 2 seconds running moved 22.0403 m (frame/timer variation).
- First-person boarding uses a perspective rear-follow camera with damped heading, close adjustable distance and vehicle-specific height. Reviewed screenshots, lowered the camera target to expose more of the chassis above the cockpit. V preserves top view; exiting and closing the map restore the appropriate walking or mounted view.
- Added a boardable truck at the old prop's position and removed its obsolete static collider. W/S accelerates forward/reverse; A/D uses speed-dependent steering, reverses when backing up and cannot pivot at rest. Space stops immediately. Driving tests confirmed forward steering, reversed steering, braking and yielding to workers. Truck controls omit boom/wire/slew.
- 24 workers, plus 2 forklifts and 2 compact excavators. Vehicles yield to workers, reverse their route after a sustained blockage, and workers steer clear. All four were observed moving after sustained runtime in the production build.
- Merged rigid parts within each moving joint and instanced people by role/body part. Reused cable vectors; stopped updating inactive machine geometry; limited shadow redraw and audio scheduling. Retained the 4096 shadow map for clean first-person ground shadows.

### Validation

- TypeScript, authored-source lint and 6 collision/driving tests pass. Tests cover thin-wall tunneling, sliding, excavation clearance, reverse steering, stationary car behavior, braking and frame-rate-independent acceleration.
- Production build succeeds and was run using Wrangler locally on port 8787. No gameplay dependency on a logged-in account. Build still emits the existing large Three.js chunk warning.
- Same machine, 1440 × 900 viewport, same initial camera/location: old public version 370 draw calls / 22,696 triangles; new production build 77 calls / 27,676 triangles. About 79% fewer draw calls despite doubled worker count and four extra vehicles. Both runs were near the display's 60 FPS cap; this is a draw-call comparison, not a claim of a 79% frame-rate gain.
- New production build's last 600 frames: median 16.7 ms, p95 17.1 ms, zero frames above 50 ms. This local sample does not guarantee identical results on other hardware. Raw state: `baseline-v2.json`, `production-build-check.json`, `revision-3-playtest.json`.
- Screenshots 08–12 record the revised TPS, truck, full scene and walking views. Browser viewport override did not change the actual 1440 × 900 viewport, so no 1280 × 720 verification is claimed.
- Development hot reload briefly produced a duplicate-React error while introducing Image. Reload recovered; production build and fresh production page executed correctly. Historical browser logs are retained across navigation and must be filtered by the production page's origin.
