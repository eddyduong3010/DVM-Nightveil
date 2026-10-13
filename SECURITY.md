# Security

Không công khai mật khẩu/token, lockfile League, ảnh game hoặc toàn bộ profile trong issue. Dùng kênh riêng với chủ repository để báo đường dẫn, phiên bản và cách tái hiện đã loại thông tin cá nhân. Chưa có SLA hoặc bug bounty.

Ranh giới: Electron main có quyền của người dùng Windows; renderer sandbox, không Node, chỉ IPC có kiểm tra; dữ liệu mạng là dữ liệu không tin cậy. TLS ngoại lệ chỉ áp dụng API loopback game. Không elevation, injection, driver hay gửi phím/chuột cho game.

Bản công khai phải có Authenticode + timestamp, publisher chính xác, workflow dùng secret store và release environment có reviewer. Không đặt khóa ký, token hoặc chứng thư riêng trong repository/binary. SHA256 chỉ giúp đối chiếu tệp, không thay thế chữ ký.

Audit không phải chứng nhận an toàn. Bản 0.6.0 có hai phát hiện về đọc response không giới hạn sớm và redirect; bản 0.7.0 có bản sửa và kiểm thử. Phụ thuộc build còn advisory moderate đã ghi trong RELEASE-STATUS; không che advisory bằng cách bỏ audit.
