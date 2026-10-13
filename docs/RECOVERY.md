# Phục hồi và migration

Cấu hình có `settingsSchema: 1`. Bản cũ được sao thành `settings.json.pre-migration`; mỗi lần lưu có `settings.json.last-good`. JSON hỏng được giữ dưới tên `.corrupt-<timestamp>`, ưu tiên đọc last-good; không có bản tốt thì dùng mặc định. Schema mới hơn bị từ chối để tránh ghi đè bởi app cũ.

Sau ba lần phát hiện phiên trước thoát bất thường liên tiếp, app mở với OCR tự động và overlay tạm tắt. Mở Thiết lập để bật lại sau khi chẩn đoán. Đây là phục hồi chức năng, không tự cài một EXE cũ chưa kiểm tra. Mốc phiên khỏe đặt sau 60 giây; crash native có thể chỉ được nhận ra nhờ marker ở lần mở tiếp theo.

HistoryStore kiểm tra SQLite, giữ DB hỏng riêng và phục hồi bản sao tốt. Mỗi lần cài update từ ứng dụng sẽ đợi lưu cấu hình và sao lưu lịch sử; thất bại sao lưu chặn cài. Rollback danh mục cùng patch ở Thiết lập chỉ thực hiện ngoài trận.

Rollback chương trình: thoát app, sao lưu toàn bộ profile, tải bộ cài phiên bản trước đã xác minh chữ ký/checksum và cài thủ công. Nếu schema không tương thích, khôi phục profile đã sao lưu cùng phiên bản; không sửa số schema bằng tay. NSIS downgrade và phục hồi trên máy thật chưa được chứng minh ở bản thử nghiệm này.

Sự cố kênh stable: gỡ bản lỗi khỏi kênh cập nhật và phát hành bản sửa có version cao hơn. Updater đặt `allowDowngrade=false`; không dùng feed để ép cài bản thấp hơn. Khôi phục danh mục không rollback chương trình.
