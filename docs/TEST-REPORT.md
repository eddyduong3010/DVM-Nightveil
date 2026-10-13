# Verification report — 0.8 preview

Ngày 14/10/2026. Không đồng nhất fixture với API/game thật.

|Kiểm tra|Kết quả|Phạm vi|
|---|---|---|
|Baseline trước sửa|PASS 183/183|0.7 source|
|Unit/integration hiện tại|PASS 244/244|61 bài mới: simulation, confidence, schema/license, SQLite, patch invalidation, policy, checksum, HTML escaping|
|Typecheck|PASS|src/scenario-contract.ts; phần CJS/JSX chưa strict typecheck|
|Vite production build|PASS|Renderer 14 screens|
|Electron UI|PASS|14 screens; 860×620,1280×800,1920×1080,1280×900 zoom150%; không overflow ngang; no renderer errors|
|Live assistance negative|PASS|IPC scan từ chối; benchmark client InProgress không gọi live API|
|Nguồn HTTP thật|PASS|Data Dragon16.20.1, ARAMMayhem26.20; schema/license/release; 201 augment source rows,666 combo source rows. Catalog cache có223 lõi, phạm vi khác|
|Dependency runtime audit|PASS 0 advisory|Snapshot npm audit --omit=dev; không chứng minh không có vulnerability|
|Dependency toàn bộ|8 moderate|Dev build toolchain, vẫn còn; chưa force downgrade builder|
|Packaged EXE|PASS|0.8.0 EXE thật; legacy4rows → SQLite, backup, saved build, simulation worker, static overlay, scan rejection|
|Installer clean VM|SKIPPED|Chưa có VM/hành trình install/uninstall/upgrade|
|Authenticode|NOT SIGNED|Đã kiểm tra bộ cài thật; chưa có chứng thư. Signed update end-to-end SKIPPED.|
|Real game / 2 monitors DPI|SKIPPED|Không có phiên test phù hợp; zoom không phải DPI thật|

Legacy runtime/OCR tests vẫn chạy bằng policy fixture trong VM, chỉ kiểm quy trình nghiên cứu được giữ lại. Production không có override policy. Tests mới dùng profile tạm, không xóa/ghi dữ liệu thật.

TypeScript chỉ là hợp đồng mới, không được hiểu cả repo đã được typecheck. Các màn hình được mở và capture không có nghĩa toàn bộ luồng nâng cao trong master prompt đã được triển khai; xem IMPLEMENTATION-STATUS.md.
