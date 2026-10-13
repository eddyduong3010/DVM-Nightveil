# Bằng chứng phát hành 0.7.0

Ngày 13/10/2026, Windows 11 build 26300, x64. Phát hành thử nghiệm riêng tư, chưa phải public stable.

| Hạng mục | Trạng thái / bằng chứng |
|---|---|
| Logic và mô phỏng | 183/183 test đạt qua `npm test`, gồm 33 test mới về giới hạn response, cấu hình, crash marker, update/retry/gating. |
| Giao diện Electron | Smoke test đạt: onboarding, settings, overlay, lịch sử, recommendation, About DVM và IPC từ chối lệnh history/settings ngoài quyền overlay. |
| About | Screenshot `about-release.png`: tên Dương Văn Minh, Design by DVM in VietNam, version 0.7.0, trạng thái updater chưa bật. |
| EXE đóng gói | Smoke test EXE đạt trong profile riêng: 4 bản ghi cũ, migration SQLite, backup worker, cập nhật dữ liệu thật patch 16.20 / 223 lõi, minh họa Evelynn, overlay chung build và About. |
| Installer NSIS | Build Windows x64; không khẳng định đã kiểm thử wizard cài/gỡ/nâng cấp trên Windows sạch. |
| Dependencies runtime | `npm audit --omit=dev`: 0 advisory tại thời điểm đo. Không bảo đảm không có lỗ hổng chưa công bố. |
| Dependencies toàn bộ | 8 cảnh báo moderate trong toolchain build, xuất phát sprintf-js → roarr → global-agent → @electron/get của app-builder-lib. `npm audit fix` không giải quyết ở bộ phiên bản hiện tại; chưa ép override khác major. |
| Auto application update | Đã code và kiểm thử mock; mặc định tắt vì thiếu chứng thư ký số. Chưa kiểm thử download/verify/install giữa hai bản đã ký thật. |
| Ký số | Bộ cài thử nghiệm NotSigned. Không có certificate CurrentUser code-sign hoặc GitHub signing secrets. Pipeline ký số yêu cầu credentials và xác minh Valid + timestamp; chưa chạy thành công signed release. |
| Data update | Giữ kiểm tra khi mở app, validation/schema/patch/cache/fallback; test ETag/304, dữ liệu sai và rollback đạt. Không chứng minh mọi upstream luôn sẵn sàng. |
| Migration/recovery | JSON cũ/JSON hỏng/schema tương lai, backup, SQLite recovery và crash marker được mô phỏng; OS/game crash thật chưa tái hiện. |
| Crash diagnostics | Nhật ký cục bộ lọc trường, không telemetry; test loại bỏ token/tên/stack đạt. Không phải crash-dump collector đầy đủ. |
| Windows đa màn hình | Có test hình học/DPI; máy hiện một màn hình, chưa xác minh nhiều màn hình vật lý. |

Audit nguồn 0.6.0 có hai phát hiện: response buffering trước giới hạn (medium) và redirect vượt danh sách nguồn (low), với điều kiện attacker kiểm soát phản hồi upstream. 0.7.0 thay bằng bounded streaming, redirect:error, giới hạn giải nén; unit tests xác nhận. Bản audit đầy đủ được giữ trong Codex Security ở máy chủ dự án. Coverage static một phần, không tuyên bố đã đọc hết vendor/binary.

GitHub workflow được chuẩn bị với SHA action cố định, quyền tối thiểu, secrets tách riêng và signed release draft. Source đã push lên main. GitHub từ chối file workflow vì OAuth token thiếu scope workflow; hai YAML còn sẵn trong .github/workflows trên máy và source ZIP. GitHub Actions chưa chạy; YAML parse trên máy không chứng minh Actions đã chạy.

Các phần cần chủ dự án: chứng thư ký hợp lệ; quyền workflow nếu GitHub từ chối; kênh public sau khi giải quyết quyền dữ liệu/đăng ký Riot; kiểm thử installer và signed update trên máy sạch. Xem RELEASING.md.
