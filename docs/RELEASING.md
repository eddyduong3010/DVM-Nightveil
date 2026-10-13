# Phát hành lâu dài

## Trạng thái hiện tại

Repository `eddyduong3010/DVM-Nightveil` công khai. Bản thử nghiệm vẫn dùng cài thủ công vì chưa có bộ cài ký số; `data/release.json` giữ `updatesEnabled:false`. Không nhúng personal access token vào ứng dụng.

## Các bước chủ dự án cần hoàn tất

1. Có chứng thư ký mã phù hợp hoặc dịch vụ ký tin cậy. Workflow mẫu dùng chứng thư PFX được nhà cung cấp cho phép dùng trong CI: lưu base64 vào secret `CSC_LINK`, mật khẩu vào `CSC_KEY_PASSWORD`. Với khóa phần cứng/cloud không xuất được, đổi sang signing hook/dịch vụ tương ứng; không cố xuất khóa.
2. Đặt variable `WINDOWS_PUBLISHER` đúng subject publisher của chứng thư. Tạo environment `release` với required reviewers; bảo vệ nhánh main và tag phát hành. Không nhập secret qua issue/chat hoặc commit.
3. Có kênh GitHub Releases công khai đọc được không cần token, sau khi giải quyết quyền dữ liệu và đăng ký Riot. Khi repo thích hợp công khai, đặt `PUBLIC_UPDATE_FEED=true`. Workflow kiểm tra visibility trước khi bật feed. Repo private vẫn có thể build signed nhưng updater bị tắt.
4. Quyền GitHub OAuth cần `workflow` để push `.github/workflows`, ngoài quyền ghi repository. Nếu bị từ chối, chủ tài khoản chạy `gh auth refresh -h github.com -s workflow`, hoàn thành đăng nhập trình duyệt rồi tại thư mục source hiện tại chạy `git add .github/workflows`, `git commit -m "Enable Windows release workflows"`, `git push origin HEAD:main`. Bản sao đầy đủ cũng được giữ ở branch local release-with-workflows; không force-push branch đó lên main. Không cần gửi token cho trợ lý.
5. Tag phải khớp version. Chạy workflow Signed Windows release với tag đã push. Workflow luôn tạo draft; chỉ công bố stable sau kiểm thử installer/update trên máy sạch và phê duyệt phát hành.

## Bản build có kiểm chứng

Workflow dùng checkout/setup-node ghim commit, `npm ci`, audit production, unit tests, build NSIS; bắt buộc ký số, kiểm tra Authenticode và timestamp của EXE/installer. Tệp updater `latest.yml` cùng blockmap được upload khi feed bật. electron-updater kiểm tra SHA512 tải xuống và publisher Authenticode; không tắt verifyUpdateCodeSignature. TLS bảo vệ metadata; bản này chưa triển khai chữ ký riêng cho manifest.

Không đánh dấu ký số thành công chỉ vì log builder có chữ “signing”. Phải có `Get-AuthenticodeSignature` trả Valid và timestamp. Không có khóa ký thì pipeline signed phải fail, không phát hành bộ cài unsigned vào stable.

## Kiểm thử bắt buộc trước public stable

- Máy Windows sạch: cài, gỡ, nâng cấp từ bản trước; cấu hình/lịch sử không mất.
- Hai phiên bản đã ký cùng publisher: check/download/install/relaunch; giả mạo chữ ký, digest sai, metadata lỗi và mạng bị ngắt phải không cài.
- Bắt đầu trận giữa lúc tải/chờ cài: không restart game hoặc app giữa trận.
- Recovery sau crash thật, sleep, DPI khác nhau, nhiều màn hình; ghi kết quả và ảnh.
- Kiểm tra quyền nguồn dữ liệu, bộ notice/license, registration Riot, kênh riêng tư/công khai.

Các bài test mock không thay thế các bước này. Xem RELEASE-STATUS.md để biết bằng chứng đã có.
