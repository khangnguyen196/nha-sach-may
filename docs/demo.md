# Kịch bản demo (5–7 phút)

Web thật: https://nha-sach-may.vercel.app. Đường dẫn dưới đây là phần sau tên miền. Đường dẫn đối chiếu với
`src/i18n/routing.ts` (URL tiếng Việt / tiếng Anh), `src/app/admin/` (trang quản trị) và chữ trên nút trong `messages/vi.json`.

Chuẩn bị 2 cửa sổ trình duyệt: cửa sổ thường đăng nhập **tài khoản khách demo**, cửa sổ ẩn danh đăng nhập **tài khoản admin**
(không ghi email / mật khẩu vào tài liệu này). Mở sẵn cả hai trước khi bắt đầu, giao diện sáng.

## Các bước

| # | Đường dẫn | Thao tác | Điều cần nói (1–2 câu) | Thời gian |
|---|---|---|---|---|
| 1 | `/` | Cuộn qua hàng thẻ Ưu đãi (Đang giảm giá, Miễn phí giao hàng, Bán chạy, Sách ngoại văn), dải đồng hồ, các kệ Nổi bật / Bán chạy / Mới về / kệ theo danh mục. | Nhà sách chỉ bán sách, song ngữ Việt / Anh, dữ liệu sách thật (Google Books). Giao diện tối giản: ảnh bìa là nguồn màu chính, không banner, không chữ chạy. | 40 giây |
| 2 | `/tim-kiem?q=nguyen+nhat+anh` | Bấm ô "Tìm sách, tác giả…" ở đầu trang (hoặc Ctrl K), gõ `nguyen nhat anh` **không dấu**, **chờ danh sách kết quả hiện ra** rồi mới nhấn Enter (dòng "Xem tất cả kết quả" chỉ có khi đã có kết quả). | Tìm kiếm gõ không dấu vẫn ra sách có dấu, khớp từng từ không cần đúng thứ tự; bộ lọc và trang nằm trên URL nên gửi link là xem lại được. | 30 giây |
| 3 | `/sach/sapiens` → `/en/books/sapiens` | Mở trang sách Sapiens; chỉ vào phần mô tả, giá, nút "Thêm vào giỏ". Bấm nút ngôn ngữ nhỏ ở đầu trang (nút vuông chỉ ghi "EN", không có chữ "Xem bằng tiếng Anh" trên nút; điện thoại: menu "⋯" Tùy chọn khác → "Xem bằng tiếng Anh") → trang tiếng Anh, rồi đổi lại tiếng Việt. | Cùng một cuốn sách có URL riêng cho từng ngôn ngữ, mô tả hai thứ tiếng; giá vẫn tính bằng VND. | 40 giây |
| 4 | `/gio-hang` | Ở trang tiếng Việt của Sapiens bấm "Thêm vào giỏ", mở giỏ (icon giỏ ở đầu trang), tăng số lượng lên 2. | Giỏ cập nhật ngay khi bấm (chờ server ở phía sau, lỗi thì tự quay lại). Tạm tính, phí ship và mốc miễn phí giao hàng 300.000₫ do database tính, trình duyệt không tự tính tiền. | 40 giây |
| 5 | `/thanh-toan` → `/thanh-toan/thanh-cong/<mã đơn>` | Bấm "Thanh toán". Chọn địa chỉ có sẵn, chọn "Thanh toán khi nhận hàng (COD)", bấm "Đặt hàng". | Đơn đặt qua một hàm trong database: kiểm tồn kho, tính giá, trừ kho trong một lần; bấm hai lần cũng chỉ ra một đơn. | 50 giây |
| 6 | `/tai-khoan/don-hang` → `/tai-khoan/don-hang/<mã đơn>` | Mở "Đơn hàng" trong tài khoản, mở đơn vừa đặt (trạng thái chờ xác nhận); giới thiệu thêm đơn đã giao có sẵn từ trước trong danh sách. | Khách xem lịch sử đơn, tự hủy được khi đơn còn chờ xác nhận; đơn của người khác không xem được. | 30 giây |
| 7 | `/` (bong bóng góc dưới) | Bấm "Hỏi Mây gợi ý sách", xác nhận "Tôi từ 18 tuổi trở lên, bắt đầu hỏi Mây", bấm gợi ý "Sách nhẹ nhàng đọc cuối tuần". | Mây là trợ lý AI gợi ý sách, chỉ gợi ý sách đang có trong cửa hàng, chỉ tiếng Việt (trang `/en` không có bong bóng), có giới hạn lượt hỏi. | 50 giây |
| 8 | `/cho-sach-cu` → `/cho-sach-cu/<id tin>` | Mở chợ sách cũ, mở một tin đang bán (ảnh thật, tình trạng sách, giá). | Thành viên đăng bán sách cũ của mình, admin duyệt rồi mới hiện; tiền trả người bán chỉ là sổ mô phỏng, web không lưu tài khoản ngân hàng. | 30 giây |
| 9 | `/admin/don-hang` → `/admin/don-hang/<mã đơn>` | Sang cửa sổ admin, mở "Đơn hàng", mở đơn vừa đặt, bấm "Xác nhận đơn". Quay lại cửa sổ khách, tải lại `/tai-khoan/don-hang/<mã đơn>`: trạng thái "Đã xác nhận". | Trang quản trị chỉ vào được với quyền admin, kiểm ở server; luồng trạng thái (chờ → xác nhận → đang giao → đã giao) chặn ở database, không nhảy bước được. | 50 giây |
| 10 | trang đang mở (VD `/`) | Bấm nút icon mặt trăng ở đầu trang (nút chỉ có hình, tên cho trình đọc màn hình là "Chuyển sang giao diện tối"; điện thoại: menu "⋯" → "Chuyển sang giao diện tối"). | Sáng là mặc định, tối là tùy chọn; cả hai dùng chung một bộ màu định nghĩa ở một chỗ, đủ tương phản để dễ đọc. | 20 giây |

Tổng khoảng 6 phút. Thiếu thời gian thì bỏ bước 8 hoặc 10.

Ghi chú:
- Bước 4–5 dùng Sapiens (đang còn hàng). **Không** dùng Atomic Habits (id 244, đang hết hàng) cho giỏ / đặt hàng, trừ khi đã
  nạp tồn trong admin trước. Kiểm tồn của sách định dùng trong `/admin/sach` hôm trước.
- Trang thanh toán không có bong bóng Mây (cố ý), nên bước 7 làm ở trang chủ.
- Khách chưa đăng nhập vào `/thanh-toan` sẽ được chuyển sang `/dang-nhap`: đăng nhập tài khoản khách demo từ trước.
- Đơn vừa đặt ở bước 5 sau buổi demo: hủy trong admin (hoàn kho tự động) hoặc giữ làm đơn mẫu.

## Việc chủ dự án làm trước demo

- [ ] Mã MCKKKKKKK (giảm 50%, tối đa 5.000.000₫, mã thử): tắt "Hiện trong gợi ý ở trang thanh toán" hoặc tắt hẳn mã trong
      `/admin/voucher`.
- [ ] Mã TEST10: **giữ** trong gợi ý theo quyết định đã chốt (chủ dự án có thể quyết lại; nếu tắt thì làm như MCKKKKKKK).
- [ ] Đánh dấu vài sách tiếng Việt "Nổi bật" trong `/admin/sach` (kệ Nổi bật đang 8 / 8 sách tiếng Anh; At Home ở kệ này
      có bìa mờ: thay bìa hoặc bỏ đánh dấu).
- [ ] Đăng 2–3 tin sách cũ thật (`/tai-khoan/sach-toi-ban/dang-tin`) rồi duyệt ở `/admin/sach-cu` (hiện 0 tin đang bán,
      bước 8 sẽ trống).
- [ ] Thay bìa mờ theo bảng ở `docs/plans/chuan-bi-demo.md` (63 sách bìa rộng 128–180px), ưu tiên sách xuất hiện trong
      kịch bản và trên trang chủ.
- [ ] Danh mục "Marketing - Bán hàng" đang 0 cuốn: ẩn trong `/admin/danh-muc` hoặc để nguyên (trang danh mục rỗng có
      thiết kế riêng).
- [ ] Tài khoản khách demo: có địa chỉ mặc định và ít nhất 1 đơn đã giao (để bước 6 có lịch sử).
- [ ] Thử Mây hôm trước (hỏi 1–2 câu), xem còn lượt và trả lời bình thường.
- [ ] Thử cả kịch bản trên điện thoại (menu "⋯", bong bóng Mây, giỏ).
- [ ] Chạy file SQL viết lại mô tả 7 sách (`supabase/data/chuan-bi-demo/vong-1-sach-viet-lai.sql`) để trang Sapiens /
      Atomic Habits… có mô tả mới hai thứ tiếng. Thứ tự: data-check trên CI xanh → file lên main → kiểm trước bằng MCP
      chỉ đọc (`vong-1-kiem.sql`) → chủ dự án chạy file ghi trong SQL Editor → kiểm sau (`vong-1-kiem.sql`) → thêm dòng
      `supabase/data/chuan-bi-demo/vong-1-sach-viet-lai.sql <ngày chạy>` vào `supabase/data/da-chay-production.txt`.

## Khi có sự cố

| Sự cố | Cách xử lý ngay |
|---|---|
| Mây báo hết lượt / quá tải / lỗi | Nói "trợ lý AI dùng gói miễn phí nên có giới hạn lượt", bỏ qua bước 7, chuyển sang bước 8. Không bấm gửi lại nhiều lần (sau lỗi quá tải có thời gian chờ). |
| Mất mạng / trang tải chậm | Form giữ nguyên chữ đã gõ và báo lỗi mạng; bật lại mạng (hoặc 4G điện thoại) rồi bấm lại. Chuẩn bị sẵn ảnh chụp các trang chính để nói tiếp nếu mạng hỏng hẳn. |
| Sách hết hàng khi thêm giỏ / đặt hàng | Web báo rõ "hết hàng" kèm số còn lại: dùng điều này làm ví dụ kiểm tồn kho, rồi đổi sang sách khác còn hàng (VD Sapiens). |
| Đặt hàng báo giỏ đã thay đổi | Giá / tồn kho đổi trong lúc mở trang: tải lại trang thanh toán rồi đặt lại. |
| Phiên đăng nhập hết hạn | Bấm "Đăng nhập lại" trong khung lỗi, đăng nhập rồi quay lại đúng trang. |
