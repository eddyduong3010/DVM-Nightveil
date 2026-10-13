# 0.8.1 — Read-only match view — 2026-10-14

- Read locally available Game Client champion and item data while a match is active; show it in the main window and overlay without changing pinned build choices.
- Keep live augment scanning, enemy augment inference, and adaptive in-match recommendations disabled; no invented augment tiers or hidden-match data.
- Add regression tests for the read-only projection and keep preview updates disabled until a signed release is available.

# 0.8.0 — Advanced Preview — 2026-10-14

- Added offline Build Lab, 20 archetypes, four branches, explicit assumption simulator in a worker.
- Added source/evidence registry, licensed community metadata, patch diff and saved simulation invalidation.
- Added SQLite schema3 library/version/profile/workspace/practice/patch/simulation records; migration backup.
- Added 14-screen UI, command search, static reference overlay, widget order/opacity/layout IO, reports.
- Disabled live OCR/adaptive guidance; no production switch to enable unapproved features.
- Added 61 advanced tests, native UI checks and measured benchmarks. TS typecheck covers the new scenario contract only.
- Known limits: incomplete verified formulas, partial English, profile JSON import builds-only, advanced widget editor/training curriculum pending. Unsigned private preview; no stable release.

# Changelog

## 0.7.0 — 2026-10-13 — thử nghiệm riêng tư

- Giới hạn dữ liệu trong lúc đọc; từ chối HTTP redirect ngoài nguồn ban đầu; giới hạn giải nén model OCR ở công cụ build.
- Kiểm tra sender/main-frame/URL cho IPC, giới hạn lệnh của overlay, từ chối yêu cầu quyền trình duyệt.
- Controller cập nhật ứng dụng: backoff, không tự cài khi thoát, chặn khi trong trận, sao lưu trước cài. Chỉ bật khi có bản ký số và kênh công khai; chưa có end-to-end signed update.
- Migration cấu hình có phiên bản, bản sao trước migration, khôi phục bản tốt khi JSON hỏng; từ chối schema tương lai.
- Nhật ký lỗi tối giản trên máy, không telemetry; chế độ phục hồi sau ba phiên thoát bất thường liên tiếp.
- Workflow Windows CI và phát hành ký số, checksum, thông tin dependency, README và chính sách quyền riêng tư.
- About ghi Dương Văn Minh, Design by DVM in VietNam, phiên bản và disclaimer Riot.

## 0.6.0 — 2026-10-13

- State machine, polling thích ứng, reconnect, cache theo patch, cập nhật UI theo phần thay đổi.
- 150 kiểm thử logic/mô phỏng; benchmark trước/sau được lưu cùng bản 0.6.0.

Phiên bản dùng SemVer: patch sửa lỗi tương thích; minor thêm tính năng; major thay đổi không tương thích. Tag Git phải khớp `v` + package version. Bản thử nghiệm chưa ký không được đưa vào kênh cập nhật stable.
