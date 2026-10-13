# DVM Nightveil 0.8.3

Created by **Dương Văn Minh**. **Design by DVM in VietNam.**

Bản Advanced Preview cho Windows 11: Build Lab 20 hướng chơi, tối đa 4 nhánh, mô phỏng theo giả định, thư viện SQLite có phiên bản, ảnh hưởng patch, tra cứu, luyện tập và tham khảo overlay tĩnh. Nightveil dùng hồ sơ riêng `%APPDATA%\dvm-nightveil`; nếu tìm thấy hồ sơ Nightveil cũ hợp lệ thì sao chép dữ liệu sang một lần, giữ nguyên bản cũ.

**Chưa phải bản Riot phê duyệt.** Overlay thử nghiệm đọc ba lõi đang hiển thị trên màn hình của chính người chơi, tướng/trang bị từ Game Client, và đưa ra tham khảo. Tier OP.GG chỉ hiện khi nguồn cùng patch trả về; nếu không, tier quy tắc DVM ghi “Ước tính” hoặc “?”. Không công bố win rate lõi. Không đọc được lõi đối thủ bị ẩn trong Tab/API và không giả lập dữ liệu đó. Simulator chưa bao phủ mọi kỹ năng/nội tại/lõi; kết quả ghi APPROXIMATE. Installer preview chưa ký số; auto-update ký số chưa hoạt động.

## Dùng thử

Xem [hướng dẫn tiếng Việt](docs/USER-GUIDE-VI.md), [phạm vi đã làm và còn thiếu](docs/IMPLEMENTATION-STATUS.md), [báo cáo kiểm thử](docs/TEST-REPORT.md) và [hiệu năng](docs/PERFORMANCE-REPORT.md).

Ctrl+K tra cứu; F8 quét lại ba lõi đang hiện; Ctrl+Shift+O ẩn/hiện overlay; Ctrl+Shift+Space đổi chế độ; Ctrl+Shift+I click-through. Mặc định tự quét có giới hạn khi tới lượt lõi và đọc lại sau khi nhấp xoay thẻ. Trong Thiết lập có trạng thái, nút quét và các tùy chọn bật/tắt. Evelynn chỉ là ví dụ ở nút “Xem thử”; build mới yêu cầu chọn tướng hoặc tự nhận tướng trong trận.

## Phát triển

Node 24+, npm, Windows 11 x64. `npm ci`, `node node_modules/electron/install.js --no`, `npm test`, `npm run typecheck`, `npm run build`, `npm start`. Typecheck hiện chỉ hợp đồng TypeScript mới, không toàn bộ JS/CJS. `npm run test:desktop` dùng profile riêng và mock client/network; chạy ngoài trận.

Đóng gói: `npm run release:prepare` rồi `npm run package -- --config release-config.json --publish never`. Chỉ gọi signed khi có certificate thật và signature verifier PASS. Xem docs/RELEASING.md.

## Nguồn và riêng tư

[Data provenance](docs/DATA-PROVENANCE.md), [Riot compliance](docs/RIOT-COMPLIANCE.md), [Privacy](PRIVACY.md), [third-party licenses](THIRD-PARTY-NOTICES.txt). Data: [arammayhem.com](https://arammayhem.com/data/) (CC BY 4.0). Mã DVM theo LICENSE-DVM.txt; tài sản game thuộc chủ sở hữu.

DVM Mayhem Companion is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
