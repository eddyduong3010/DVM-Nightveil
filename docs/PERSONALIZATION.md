# Personal intelligence

SQLite history.sqlite trong profile hiện có, worker nền. Không bắt buộc tài khoản; không upload profile. Các bảng thực tế: saved_builds, build_versions (FK cascade), personal_profile, practice_history, community_drafts, patch_reports, saved_simulations, migration_history. Workspace dùng metadata hiện có, không thêm bảng trùng.

Save/duplicate/rename/notes/tags/favorite/archive/delete/search. Save tạo phiên bản; mở phiên bản cũ thành nhánh mới. Workspace 1–4 nhánh được lưu debounce 700ms. Simulation lưu input/result/formula/patch; patch diff vô hiệu kết quả liên quan. Build patch cũ được đánh dấu cần xem lại.

JSON export hiện chứa build/profile/practice/submissions; import hiện **chỉ nhập builds**, tối đa 100, validate tất cả trước ghi, tạo ID mới, backup trước nhập. Không dùng nó thay bản sao lưu SQLite đầy đủ. Migration backup phục hồi dữ liệu tốt; xóa build cascade phiên bản, không xóa backup. Clear personalization giữ tùy chọn privacy/layout, xóa preferences/favorites/practice, giữ saved builds.

Preference học từ archetype được lưu, cap100, chỉ đổi thứ tự library. Language hiện đổi navigation; toàn bộ nội dung tiếng Anh chưa hoàn tất. Những giới hạn này được giữ trong status matrix thay vì gọi full profile import hoàn thành.
