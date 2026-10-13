# Nguồn dữ liệu, API và quyền phân phối

Rà soát ngày 13/10/2026; đây là hồ sơ kỹ thuật về nguồn, không phải xác nhận pháp lý hoặc phê duyệt của nhà cung cấp.

| Nguồn | Sử dụng | Kết luận và việc còn thiếu |
|---|---|---|
| Riot Data Dragon | Tên/icon/tướng/trang bị | Tài liệu cho phép third-party developers sử dụng static data; vẫn chịu developer policies và sở hữu Riot. |
| League Live Client Data | GET loopback trong trận | Có tài liệu chính thức; không đồng nghĩa mọi cách dùng đều được phê duyệt. |
| League Client API (LCU) | Trạng thái trận, hậu trận | Tài liệu Riot coi là API không được hỗ trợ chính thức; không hứa ổn định/quyền blanket. Cần đăng ký ứng dụng và nêu đúng các endpoint/use case. |
| CommunityDragon | Danh mục lõi, icon, mô tả | Dự án cộng đồng phân phối dữ liệu game; không chuyển quyền sở hữu tài nguyên Riot. Cần kiểm tra lại điều kiện trước public release. |
| arammayhem.com | Combo theo tướng, tỷ lệ chọn | Trang data công bố CC BY 4.0, cần attribution/link license và ghi việc ghép ID/lọc patch; không suy tier từ pick rate. |
| OP.GG | Tier glyph và build HTML theo tướng | Help Center nói nhìn chung không cấm crawling có attribution; Terms lại có điều khoản hạn chế scraping/redistribution. Chưa có bằng chứng cho phép phân phối lại cụ thể cho DVM. Public release cần làm rõ bằng văn bản; không dùng attribution như giấy phép. |
| Tesseract/tessdata | OCR tại máy | Giữ Apache-2.0 notices và provenance model; không tải model mới không kiểm tra vào runtime. |

Riot yêu cầu đăng ký sản phẩm phục vụ người chơi, kể cả không dùng API documented. Không hiện win rate lõi/Arena item, không cung cấp thông tin trận trước đó người chơi chưa biết, không ép quyết định. Ứng dụng chỉ đưa lựa chọn có lý do; không tự chọn, không suy lõi đối thủ ẩn. Chưa có bằng chứng DVM được Riot đăng ký/acknowledged/approved.

Nguồn chính thức đã đối chiếu:

- https://developer.riotgames.com/docs/lol — registration, game integrity, unapproved use cases, Data Dragon, LCU và Live Client Data.
- https://developer.riotgames.com/policies/general
- https://arammayhem.com/data/
- https://help.op.gg/hc/en-us/articles/31091405109401-Can-I-use-OP-GG-data
- https://op.gg/lol/policies/agreement
- https://github.com/tesseract-ocr/tessdata

About hiển thị disclaimer Riot. Bản quyền DVM chỉ áp dụng phần sáng tạo của DVM, không chiếm quyền dữ liệu/icon/tướng hoặc thư viện bên thứ ba. Chưa phát hành công khai stable khi những điều kiện chưa được giải quyết.
