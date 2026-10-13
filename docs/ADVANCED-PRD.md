# DVM Mayhem Companion 0.8 — Advanced Preview

Created by Dương Văn Minh. Design by DVM in VietNam.

Mục tiêu: nghiên cứu build trước trận, mô phỏng có giả định, tham khảo tĩnh và xem lại hậu trận. 14 màn hình dùng cùng catalog, SQLite và analysis worker. Giữ Electron/React/CJS; chỉ bổ sung TypeScript cho hợp đồng tình huống/so sánh, không chuyển stack.

Luồng chính: chọn tướng → chọn archetype → thêm lõi/món → đọc điều kiện và cảnh báo → tạo tối đa 4 nhánh → nhập dummy/hiệu ứng → so sánh → lưu build/mô phỏng → ghim tham khảo tĩnh trước trận.

V0.8 là preview có phạm vi kiểm chứng, KHÔNG phải toàn bộ Pro Edition đã COMPLETE. Phần không đủ mô hình có nhãn APPROXIMATE/Unsupported. Các yêu cầu còn thiếu ở IMPLEMENTATION-STATUS.md. Không có tỉ lệ thắng lõi. Không có backend cộng đồng, telemetry hoặc tài khoản bắt buộc.

Phụ thuộc: source adapters + cache → catalog → evidence/build-lab → analysis worker → UI. SQLite worker lưu library/versions/profile/workspace/practice/submissions/patch reports/simulations. Live snapshot không được đưa vào Build Lab.
