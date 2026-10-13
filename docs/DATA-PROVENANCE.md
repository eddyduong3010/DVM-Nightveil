# Data provenance

Nguồn tham chiếu được kiểm tra ngày 14/10/2026:
- Riot Data Dragon: https://developer.riotgames.com/docs/lol#data-dragon — dữ liệu tĩnh và tài sản theo điều khoản Riot; không coi là API đầy đủ công thức kỹ năng.
- ARAMMayhem index: https://arammayhem.com/data/v1/index.json — CC BY 4.0, attribution **Data: arammayhem.com**, https://arammayhem.com/data/. Dataset nêu giới hạn mẫu; không xuất win rates, tiers hay win-rate ranks.
- CommunityDragon: tên/icon lõi từ pipeline cũ; quyền tài sản Riot và trạng thái cơ chế phải kiểm tra riêng.
- DVM: editorial rules và giả định người dùng, không thống kê.
- OP.GG: không gọi tự động trong chế độ advanced; quyền sử dụng/redistribution chưa giải quyết.

SourceAdapters: HTTPS host allowlist, validator schema/license/release/patch, ETag qua JsonCache, timeout 25s, body cap, atomic write, backoff 30s→1h, sync 6h. Nguồn lỗi không làm nguồn còn lại thất bại. Giao diện hiển thị cache ngay, kiểm tra nền; không publish catalog giữa trận. Local-only chặn cập nhật và icon remote trên UI mới. Yêu cầu đang bay trước khi bật local-only chưa có cancellation toàn cục; đây là giới hạn cần khắc phục.

Giữ riêng source patch 26.20 và Data Dragon 16.20.1; không dùng phép thay 16→26 trong adapter mới. Combo khác mã patch có UNVERIFIED_MAPPING; không dùng để xác nhận cơ chế. Pipeline community cũ được giữ cho nghiên cứu/test nhưng không gọi trong runtime advanced.

Confidence v1: reliability25 + recency15 + matchingPatch20 + completeness15 + verifiedMechanic15 + agreement10; nhân (1−uncertainty), có conflict nhân 0.5. Không nguồn =0, khác patch <=25. Không dùng sample size để giả lập confidence interval hoặc win rate. Registry công bố phạm vi/giấy phép/trạng thái/last-success; không gọi CURRENT đồng nghĩa mọi claim đã xác minh.
