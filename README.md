# DVM Nightveil 0.8.1

Created by **Dương Văn Minh**. **Design by DVM in VietNam.**

Bản Advanced Preview cho Windows 11: Build Lab 20 hướng chơi, tối đa 4 nhánh, mô phỏng theo giả định, thư viện SQLite có phiên bản, ảnh hưởng patch, tra cứu, luyện tập và tham khảo overlay tĩnh. Giữ cùng profile 0.7, backup trước migration schema3.

**Chưa phải Pro Edition hoàn tất hoặc bản Riot phê duyệt.** Ứng dụng tự đọc tướng và trang bị qua Game Client ở chế độ chỉ quan sát; build ghim trên overlay vẫn là tham khảo tĩnh. Simulator chưa bao phủ mọi kỹ năng/nội tại/lõi; kết quả ghi APPROXIMATE. Không công bố win rate lõi. Quét lõi trực tiếp, tier trên thẻ và lời khuyên quyết định trong trận vẫn tắt. Installer preview chưa ký số; auto-update ký số chưa hoạt động.

## Dùng thử

Xem [hướng dẫn tiếng Việt](docs/USER-GUIDE-VI.md), [phạm vi đã làm và còn thiếu](docs/IMPLEMENTATION-STATUS.md), [báo cáo kiểm thử](docs/TEST-REPORT.md) và [hiệu năng](docs/PERFORMANCE-REPORT.md).

Ctrl+K tra cứu; Ctrl+Shift+O ẩn/hiện overlay; Ctrl+Shift+Space đổi chế độ; Ctrl+Shift+I click-through. Ghim build trước trận. F8 không quét trong bản này.

## Phát triển

Node 24+, npm, Windows 11 x64. `npm ci`, `node node_modules/electron/install.js --no`, `npm test`, `npm run typecheck`, `npm run build`, `npm start`. Typecheck hiện chỉ hợp đồng TypeScript mới, không toàn bộ JS/CJS. `npm run test:desktop` dùng profile riêng và mock client/network; chạy ngoài trận.

Đóng gói: `npm run release:prepare` rồi `npm run package -- --config release-config.json --publish never`. Chỉ gọi signed khi có certificate thật và signature verifier PASS. Xem docs/RELEASING.md.

## Nguồn và riêng tư

[Data provenance](docs/DATA-PROVENANCE.md), [Riot compliance](docs/RIOT-COMPLIANCE.md), [Privacy](PRIVACY.md), [third-party licenses](THIRD-PARTY-NOTICES.txt). Data: [arammayhem.com](https://arammayhem.com/data/) (CC BY 4.0). Mã DVM theo LICENSE-DVM.txt; tài sản game thuộc chủ sở hữu.

DVM Mayhem Companion is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
