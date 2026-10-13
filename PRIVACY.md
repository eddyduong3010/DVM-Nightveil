# Bổ sung áp dụng cho 0.8 Advanced Preview

Bản này không quét OCR live, không đọc Live Client Data để tạo gợi ý trong trận, không tự ghi hình. Các mô tả OCR trong tài liệu 0.7 phía dưới là lịch sử và không có hiệu lực với runtime advanced.

Dữ liệu mới tại máy: build đã lưu, phiên bản, ghi chú, tags, hồ sơ ngôn ngữ/sở thích, workspace, buổi luyện tập, link cộng đồng, báo cáo patch và mô phỏng/giả định. Không có telemetry hoặc cloud sync. Nguồn dữ liệu/avatar/icon có thể thấy IP khi tải; Chỉ dùng cache tắt yêu cầu mới. Yêu cầu đang bay có thể hoàn thành sau khi bật chế độ này.

Xuất JSON/HTML/PNG chỉ qua thao tác người dùng. PNG là ảnh cửa sổ app hiện tại, có thể chứa ghi chú của bạn. Import JSON hiện nhập builds-only; backup SQLite để phục hồi đầy đủ. Xóa build/cá nhân hóa không xóa bản sao lưu. Không xuất token LCU hay signing credentials.

---

# Chính sách quyền riêng tư — DVM Nightveil

Ngày cập nhật: 13/10/2026. Chủ ứng dụng: Dương Văn Minh. Design by DVM in VietNam.

Ứng dụng xử lý dữ liệu trên máy Windows của bạn. Phiên bản này không có tài khoản ứng dụng, quảng cáo, analytics hoặc dịch vụ nhận báo cáo lỗi. Không tự gửi ảnh game, mật khẩu League, lịch sử build hay nhật ký hỗ trợ đến DVM.

## Dữ liệu sử dụng

- API League cục bộ: tướng, trạng thái trận, trang bị, thông tin người chơi và lịch sử hậu trận mà client trả về. Thông tin nhận diện dùng để ghép dữ liệu; lịch sử build dùng định danh băm hoặc ID người tham gia, không phải dữ liệu vô danh tuyệt đối.
- Lockfile League chứa mật khẩu API cục bộ: chỉ giữ trong bộ nhớ tiến trình chính, chỉ gửi đến 127.0.0.1. Không yêu cầu mật khẩu tài khoản Riot.
- Chụp cửa sổ game để OCR trên máy. Nút Kiểm tra Tab lưu ảnh và OCR JSON trong `diagnostics`; ảnh có thể chứa tên người chơi/chat. Không tự tải lên.
- Quan sát các phím tắt, nút chuột và vị trí cửa sổ cần thiết cho overlay. Không lưu nhật ký gõ phím hoặc điều khiển game.
- Cấu hình màn hình/overlay, danh mục, cache và lịch sử được lưu trong `%APPDATA%\mayhem-companion` theo quyền người dùng Windows. Không mã hóa riêng; người có quyền truy cập tài khoản/máy có thể đọc.

## Kết nối mạng

Data Dragon, CommunityDragon, arammayhem.com, OP.GG và máy chủ ảnh nhận yêu cầu HTTPS, nên có thể thấy IP, thời điểm truy cập, đường dẫn/tướng được tra cứu theo chính sách riêng của họ. Không gửi tên người chơi cho nguồn tham khảo này. Bản có updater công khai sẽ kết nối GitHub/CDN để kiểm tra và tải bộ cài; không nhúng token GitHub. Người dùng quyết định thời điểm cài, ngoài trận.

## Lưu giữ và xóa

Lịch sử SQLite giữ tối đa năm bản sao hằng ngày và năm bản thủ công; JSON cũ có thể còn sau migration. Xóa lịch sử trong giao diện chỉ xóa lịch sử đang dùng và đánh dấu để tránh nhập lại, không xóa các bản sao. Nhật ký crash lưu tối đa hai tệp khoảng 256 KiB mỗi tệp; chỉ gồm thời điểm, phiên bản, loại sự kiện và mã thoát/lý do đã lọc. Không lưu nội dung lỗi thô, stack, tên người chơi hoặc token.

Để xóa toàn bộ dữ liệu cục bộ: thoát app, sao lưu những gì cần giữ, mở đúng thư mục `%APPDATA%\mayhem-companion`, kiểm tra đường dẫn rồi xóa thư mục đó bằng File Explorer. Gỡ ứng dụng giữ dữ liệu để tránh mất lịch sử. Windows/ổ đĩa hoặc công cụ sao lưu khác vẫn có thể giữ bản sao; không hứa xóa an toàn vật lý.

Chỉ gửi cho người hỗ trợ tệp bạn đã kiểm tra. Không đăng ảnh Tab, thư mục profile, lockfile hoặc token lên issue công khai. Liên hệ chủ repository qua kênh riêng của repository; hiện chưa có hộp thư hỗ trợ công khai chuyên dụng.
