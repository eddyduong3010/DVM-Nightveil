# Simulation engine v1

Files: core/simulation.cjs, core/build-lab.cjs (stats), desktop/analysis-worker.cjs, src/scenario-contract.ts.

Đây là mô hình giả định, chưa được xác minh toàn bộ với engine League. Chỉ số cơ bản lấy catalog; mô hình tăng trưởng dùng (0.7025 + 0.0175 × level) × (level − 1). Không khẳng định mọi tướng tăng trưởng đúng công thức này. Đặc biệt không đoán hệ số Q/W/E/R hoặc nội tại từ tên.

Phép tính hiện có:
- Kháng R >= 0: hệ số 100/(100+R); R < 0: 2−100/(100−R).
- Giảm % kháng, giảm thẳng, xuyên %, xuyên thẳng; xuyên không làm kháng dương thành âm.
- Đánh thường: floor(duration × attackRate × uptime), kỳ vọng crit = AD × [1 + crit × (multiplier−1)]. Không mô phỏng ngẫu nhiên crit.
- Hiệu ứng do người dùng nhập: base + AP ratio × AP + AD ratio × AD + targetHP ratio × HP; count, điều kiện, stack cap, unique key, cooldown/ICD. Cửa sổ thời gian [0,duration).
- Haste giảm cooldown được khai báo, không giảm ICD. DOT nhập bằng số tick rõ ràng.
- Physical/magic chịu kháng, khuếch đại và giảm sát thương; true damage bỏ qua các hệ số chung trong mô hình này. Ngoại lệ cơ chế game chưa hỗ trợ.
- Trừ khiên, healing/shield totals; EHP vật lý/phép theo selfHP và khiên được mô hình hóa.

Đầu vào phải hữu hạn, duration 0.1–600s, effects <=64, nhánh <=4. Không đếm trùng unique được khai báo. Có sensitivity 0/50/100/150/200/300 kháng. Tính trong worker; debounce UI 200ms. Mọi kết quả lưu kèm giả định và version công thức.

Giới hạn: chưa có registry xác minh đầy đủ ability ranks/rotation/range, proc chains, nội tại item, tăng trưởng đặc biệt và tương tác lõi. Nhập thủ công không nâng trạng thái thành VERIFIED. Không dùng mô hình này để kết luận build tối ưu trong trận. Mục tiêu nhiều người là mô hình tổng hợp, chưa mô phỏng phân phối từng đòn đánh theo từng người. EHP là chỉ số tĩnh, không phải thời gian sống.
