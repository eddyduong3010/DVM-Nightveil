# Riot compliance — không phải giấy phê duyệt

Đã đọc ngày 14/10/2026:
1. https://support-developer.riotgames.com/hc/en-us/articles/22698698001939-League-of-Legends
2. https://support.riotgames.com/en-us/riot/events/third-party-applications
3. https://developer.riotgames.com/docs/lol

Riot hạn chế công cụ kết luận thay người chơi trong trận, dữ liệu bị che giấu và tự thao tác; trang LoL cấm hiển thị win rate của Augments/Arena items. Bản 0.8.3 có kế hoạch trước trận, mô phỏng ngoại tuyến, xem lại hậu trận và tham khảo động trong trận ở mức thử nghiệm. Không tự xác nhận Riot đã chấp thuận sản phẩm.

Từ bản 0.8.3, `core/feature-policy.cjs` đánh dấu OCR và tham khảo trận là LOCAL_EXPERIMENTAL, không phải phê duyệt của Riot. Ứng dụng chỉ OCR ba thẻ lõi đang hiển thị trên màn hình người chơi, không đọc bộ nhớ hay dữ liệu ẩn. Tier OP.GG được cache theo patch; thiếu nguồn thì ghi ước tính hoặc không rõ. Đề xuất trận có thể thay đổi theo trang bị/lõi, vì vậy bản thử nghiệm này **không được coi là đã tuân thủ hoặc được Riot chấp thuận**. Cần Riot review trước khi coi là bản phân phối chính thức. Không hiển thị win rate lõi.

No injection, no kernel driver, no memory reading, no Vanguard bypass, no buying/clicking/mouse automation. Overlay hiển thị lõi người chơi đã nhìn thấy, tier có nguồn hoặc nhãn ước tính, trang bị và phân tích điều kiện. Lõi đối thủ chưa có nguồn thì không bịa; hậu trận dùng reader đã có khi được cung cấp.

Còn cần đăng ký/review Riot cho phạm vi phân phối, làm rõ quyền tài sản/dữ liệu và ghi nhận chấp thuận bằng văn bản trước stable. Lõi đối thủ không thấy trong Tab/API không được suy đoán; lịch sử chỉ ghi nhận những gì có nguồn quan sát hoặc dữ liệu hậu trận hợp lệ.
