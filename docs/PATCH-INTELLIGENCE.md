# Patch intelligence

core/intelligence.cjs diff champion/item/augment: add/remove/stats/from/into/gold/maps/rarity/description/english/modes. Description/english chỉ là TEXT_CHANGED, không buff/nerf. Removal là breaking; structural changes cần review.

AdvancedService.catalogChanged dùng worker diff, tìm dependency trong build đã lưu và snapshot build của mô phỏng. saved_simulations.invalidated=1 nếu phụ thuộc thay đổi; UI thư viện cho mở lại tính mới. Báo cáo giữ source patch và cache patch riêng. Snapshot rollback dùng CatalogStore và giữ last good.

SQLite schema 3: backup trước migration, transaction, foreign keys cho build_versions; không ghi đè DB schema mới hơn. Schema 1 legacy builds/metadata giữ nguyên.

Giới hạn: chưa diff đầy đủ ability/mechanic effect DAG, localized text mọi ngôn ngữ hoặc combo dependency transitively. Không có dữ liệu mới thì empty state, không dựng changelog giả. Notification hiện qua báo cáo/UI, chưa có bộ chọn mọi loại toast.
