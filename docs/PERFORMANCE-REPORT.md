# Performance report — 0.8 preview

Windows 11, Intel i7-9700K, Electron 44.7.0, màn hình 2560×1440 scale100%. Nguồn số đo: docs/evidence-0.8.0. Mỗi trạng thái desktop lấy 8 mẫu, 1 mẫu/giây. Một lần chạy trước và một lần chạy sau, không có khoảng tin cậy.

Startup: 808ms (0.7 baseline commit e2705fb) → 401ms (0.8). Cold/warm disk cache có thể khác; không cam kết thời gian trên máy khác.

|Trạng thái mock|CPU trước %|CPU sau %|Peak working set trước MiB|Sau MiB|IPC bytes trước → sau|
|---|---:|---:|---:|---:|---:|
|idle|0.197|0.656|690.8|684.6|368934 → 7060|
|select|0.238|0.831|695.1|724.0|195010 → 164|
|live|0.230|1.238|704.7|735.5|100508 → 102|
|disconnect|0.199|1.084|703.6|738.5|139 → 0|

Main window visible, overlay hidden, native helper/API là fixture. Phạm vi đã thay đổi: 0.7 đọc live mock; 0.8 không gọi live. Source adapter mới có kiểm tra nền; vì vậy đây không phải so sánh cùng tính năng tuyệt đối. CPU/RAM không cải thiện đồng loạt, chưa kết luận đạt tối ưu toàn bộ. Bài thử không đo FPS trong game, GPU load, latency của overlay khi combat hoặc RAM tổng hệ thống.

Engine (150 mẫu, worker roundtrip, không gồm debounce/render):
- Rebuild search index mỗi yêu cầu: P95 13.510ms.
- Cached indexed worker search: P95 1.619ms.
- 4 nhánh mô phỏng giả định: P95 0.570ms.

Search debounce100ms; simulation debounce200ms. Không dùng số engine để khẳng định latency người dùng <100/<200ms. Cold worker startup chưa được bao gồm trong P95 warmed sample. Lazy worker giảm chi phí mở dashboard khi chưa phân tích; tính toán không chạy trên UI thread. Chưa có benchmark chính thức sync delta/rerender count/overlay visibility transitions.
