# Mechanics graph

core/synergy-graph.cjs giữ các quy tắc cũ; core/build-lab.cjs tạo graph cho editor mới. Nodes hiện dùng Champion, ChampionAbility, Augment; edges HAS_ABILITY, SUPPORTS_BUILD, SYNERGIZES_WITH. Edges có source dvm và nhãn EDITORIAL. Không gọi dữ liệu khả năng của tướng là công thức damage đã kiểm chứng.

Patch không nằm trong mechanics.patches hoặc build khác patch: tắt bonus synergy. AUG rule không có, thiếu ability trait hoặc thiếu điều kiện: trả missing để UI giải thích. Hai chuỗi mô tả giống nhau không tạo cạnh tự động.

Recipe graph bảo toàn thành phần trùng (ví dụ hai Gậy Quá Khổ), giá và nâng cấp; có chặn vòng lặp. Nhóm item độc quyền dựa quy tắc curated, không bao phủ toàn bộ game. Discovery cộng đồng dùng metadata CC BY 4.0, match theo tên Anh, giữ null nếu không ghép được; không biến nhận định cộng đồng thành verified.

Còn thiếu: evidence-level edges cho mọi mechanic/item passive, proc graph đầy đủ, graph canvas tương tác. UI hiện là danh sách cạnh có thể mở chi tiết.
