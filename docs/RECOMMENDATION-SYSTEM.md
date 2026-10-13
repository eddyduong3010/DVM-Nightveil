# Adaptive Build Lab

20 archetype trong core/build-lab.cjs. Giữ sự khác biệt giữa phù hợp chỉ số, sở thích và độ tin cậy bằng chứng. Điểm hiện là editorial compatibility: +10 cho tag phù hợp, +7 tương tác lõi có điều kiện phù hợp, +100 món khóa. Không phải DPS tối ưu, win rate hoặc sức mạnh thống kê.

Khóa/cấm mâu thuẫn bị từ chối; món không mua được/map 12 không phù hợp hoặc điều kiện tướng không phù hợp bị loại. Recipe có cost/combine cost/components/upgrades. Mỗi lựa chọn có lý do, tradeoff, source, patch, confidence và các lựa chọn bên cạnh.

Bốn nhánh độc lập, thêm/bỏ lõi/item, đổi hướng tính lại. So sánh item/lõi thêm bỏ và kết quả cùng dummy. Preference Engine chỉ sắp xếp thư viện theo archetype thường lưu; không đổi số liệu cơ chế. Tắt cá nhân hóa giữ thứ tự lưu gần nhất.

Giới hạn: archetype Ability Haste chưa có structured stat đủ; mô hình nội tại còn thiếu; chưa có solver tối ưu constrained full build hoặc gợi ý chuỗi mua hàng theo team live. Không tuyên bố mọi item được xếp là tốt nhất.
