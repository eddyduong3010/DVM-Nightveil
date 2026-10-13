# Hướng dẫn DVM Mayhem Companion 0.8

1. Đóng app cũ, chạy installer thử nghiệm. Chữ ký số chưa có; không ghi đè profile theo cách thủ công. Bộ cài dùng cùng profile cũ, migration tạo backup trước.
2. Chọn màn hình/chế độ Không viền trong Thiết lập. Dùng Ctrl+Shift+O khi muốn ẩn overlay.
3. Mở Build & combo. Chọn tướng, hướng chơi; tìm lõi/món và thêm từ thẻ chi tiết. Khóa món đang giữ hoặc cấm món không muốn. Các lý do là editorial, không phải tier chính thức.
4. Thêm tối đa 4 nhánh. Mở Mô phỏng, nhập dummy, hit rate/uptime và hiệu ứng bạn có nguồn. App KHÔNG tự tính nội tại/kỹ năng/lõi chưa được mô hình hóa. Kết quả luôn lý thuyết.
5. So sánh xem khác biệt item/lõi và damage/EHP. Lưu build, ghi chú/tags, mô phỏng; mở lại tại Build của bạn. Workspace tự lưu sau 700ms ngừng chỉnh.
6. Trong trận, overlay hiện món tiếp theo, ba lõi đọc được và tier có ghi nguồn. F8 quét lại ba thẻ đang hiện; tự quét và đọc lại sau khi xoay có thể bật/tắt ở Thiết lập. Không dùng F9 vì đó là phím của game. Lõi đối thủ không hiện trong Tab/API thì app không thể biết chắc.
7. Ctrl+K tra cứu. Nguồn & bằng chứng hiển thị giấy phép, patch, lần kiểm tra; có thể tắt mạng tại Thiết lập → Chỉ dùng cache.
8. Cộng đồng: đồng bộ metadata có giấy phép, xem link gốc và thử combo ngoài trận. Nhãn cộng đồng chưa chắc được xác minh. Luyện tập tạo 3 thẻ, ghi lý do và lưu buổi học.
9. Xuất báo cáo HTML từ build, ảnh màn hình kết quả PNG, thư viện JSON. JSON import hiện chỉ nhập build; backup SQLite dùng cho phục hồi toàn bộ.

Nếu app báo thiếu cơ chế/khác patch, đừng hiểu số 0 là hiệu ứng không tồn tại. Nó có nghĩa chưa có mô hình xác minh hoặc chưa nhập giả định. Bản 0.8 còn các phần chưa hoàn thiện được liệt kê tại IMPLEMENTATION-STATUS.md.
