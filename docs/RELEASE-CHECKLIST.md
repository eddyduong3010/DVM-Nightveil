# Release 0.8 preview checklist

- [x] Baseline 183 tests/build trước sửa.
- [x] 61 advanced tests (tổng 244) ở lần kiểm gần nhất.
- [x] Typecheck hợp đồng TypeScript; CJS/JSX chưa được strict typecheck toàn bộ.
- [x] Production renderer build.
- [x] Electron smoke 14 screens, nhiều cỡ cửa sổ, profile riêng, API/helper mock.
- [x] Nguồn thật Data Dragon / ARAMMayhem kiểm tra thành công; không đồng nghĩa game test.
- [x] Benchmark engine và desktop có số trước/sau.
- [x] Final packaged EXE smoke PASS (profile riêng, legacy migration4rows, build/simulation/static overlay/policy).
- [ ] Installer wizard / uninstall / upgrade clean Windows VM.
- [ ] Authenticode + timestamp (không có chứng thư).
- [ ] Signed auto-update/rollback end to end.
- [ ] Workflow upload (token thiếu workflow scope).
- [ ] Real multi-monitor DPI/game crash/fullscreen tests.
- [ ] Riot review/redistribution clearance.

Chỉ phát hành private prerelease, không stable/latest. Không đổi repository visibility. Không chứa token/signing keys. Source ZIP bao gồm workflow chuẩn bị nhưng chưa upload. Signed updater tiếp tục disabled do thiếu certificate/public feed.
