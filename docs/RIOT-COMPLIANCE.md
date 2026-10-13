# Riot compliance — không phải giấy phê duyệt

Đã đọc ngày 14/10/2026:
1. https://support-developer.riotgames.com/hc/en-us/articles/22698698001939-League-of-Legends
2. https://support.riotgames.com/en-us/riot/events/third-party-applications
3. https://developer.riotgames.com/docs/lol

Riot hạn chế công cụ kết luận thay người chơi trong trận, dữ liệu bị che giấu và tự thao tác; trang LoL cấm hiển thị win rate của Augments/Arena items. Phạm vi sản phẩm hiện: pregame planning, offline simulation, postgame review, static reference. Không tự xác nhận Riot đã chấp thuận sản phẩm.

core/feature-policy.cjs khóa LIVE_ADVICE/LIVE_OCR ở DISABLED_UNTIL_APPROVED, không có tùy chọn UI bật lại. Main guards command/hotkeys/scan scheduling/card click/tab inspection; không readLive trong runtime advanced. IPC overlay không gọi AdvancedService. Bản test legacy chỉ thay policy trong VM fixture, không có đường override production.

No injection, no kernel driver, no memory reading, no Vanguard bypass, no buying/clicking/mouse automation. Overlay mới chỉ bản tham khảo được ghim ngoài trận, không thay theo enemy/items/live snapshot. Lõi đối thủ chưa có nguồn thì không bịa; hậu trận dùng reader đã có khi được cung cấp.

Còn cần đăng ký/review Riot cho phạm vi phân phối, làm rõ quyền tài sản/dữ liệu và ghi nhận chấp thuận bằng văn bản trước stable. OCR live và adaptive live không được bật trong release này.
