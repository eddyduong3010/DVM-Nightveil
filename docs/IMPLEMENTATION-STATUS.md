# Advanced implementation status — 0.8 preview

Ngày 14/10/2026. Baseline e2705fb / 0.7.0: 183 unit tests + Vite build PASS. Phát triển trực tiếp trong repository hiện có; không đổi sang Rust. Trạng thái dưới đây là bằng chứng thực tế, không đánh dấu toàn bộ master prompt COMPLETE.

| Mốc | Code/UI đã làm | Xác minh | Phần còn thiếu / giới hạn |
|---|---|---|---|
|1 Audit & policy|feature-policy, main guards, 14-screen navigation, dependency matrix|Policy read; baseline; live read/scan negative test|Chưa có Riot approval|
|2 Knowledge|evidence.cjs, source-adapters, SQLite schema3, editorial graph|Confidence/schema/license/migration tests; live source read|Chưa có verified mechanic registry phủ toàn bộ game|
|3 Build Lab|build-lab.cjs,20 archetypes,4 branches,lock/ban items,explanations,recipe graph|Constraints/recipe/patch tests; Electron UI|Chưa có exact solver/lock augment/rarity discovery đầy đủ|
|4 Simulator|simulation.cjs,analysis worker,effect form,breakdown/sensitivity,save results|Deterministic finite/cooldown/unique/pen tests; worker UI|APPROXIMATE, chưa đủ ability/passive/augment formulas; rank/rotation đầy đủ chưa hỗ trợ|
|5 Patch|diff, affected saved builds/sims, invalidation, rollback UI|Integration mutation item invalidates saved sim|Chưa transitively diff all mechanic/ability/combo; notification granularity chưa đủ|
|6 Personal|SQLite library/version/workspace/profile/preferences/practice/sims; import/export|Save/versions/cascade/workspace/invalid import tests|JSON import builds-only; full profile restore dùng SQLite; English chỉ navigation|
|7 Learning|Licensed community discovery, local submissions, 3-card practice, postmatch-to-lab, HTML/PNG|Seeded practice, links, source validation; screen tests|Difficulty labels chưa giáo trình; no mastery/streak/backend; review chronology phụ thuộc nguồn|
|8 UX|14screens, CtrlK, VI normalization, focus trap, textscale/contrast, static overlay, widget reorder/opacity/layout IO, quan sát tướng/trang bị từ Game Client|Screenshots4sizes, geometry presets; 246 unit tests sau bổ sung chế độ chỉ đọc|Chưa freeform widget resize/grid hay real multi-monitor test; kết nối trận thật và live OCR chưa kiểm chứng|
|9 Reliability/release|Lazy analysis worker, cache/ETag/backoff, diagnostics, tests, NSIS config,docs|244 tests gần nhất, typecheck TS contract/build, benchmark|Signed installer/updater/workflow remote còn blocked; installer VM chưa test|

Files chính: core/{simulation,evidence,build-lab,intelligence,feature-policy,report}.cjs; desktop/{advanced-service,advanced-storage,analysis-client,analysis-worker,source-adapters}.cjs; src/{AdvancedApp,OverlaySettings,GameOverlay,main}.jsx; src/scenario-contract.ts; tests advanced*.cjs.

Không thay dữ liệu thiếu bằng tỉ lệ thắng hay công thức bịa. Phần ký số/workflow bị chặn bởi chứng thư và scope; phần cơ chế chính xác cần bộ dữ liệu/validation game. Các phần còn thiếu kỹ thuật trong bảng là backlog công khai, chưa được gọi COMPLETE.

Final artifact check: NSIS build PASS; actual packaged EXE smoke PASS (244 unit/integration tests in package preflight). Authenticode installer: NotSigned. Source/UI checks recorded under docs/evidence-0.8.0. Workflow still local-only due missing workflow scope.
