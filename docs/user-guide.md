# Hướng dẫn sử dụng QRLive

**URL**: https://qrlive.vercel.app

---

## Đăng ký & Đăng nhập

1. Truy cập trang chủ → nhấn **Đăng ký** (Sign Up).
2. Nhập email và mật khẩu (tối thiểu 8 ký tự).
3. Kiểm tra email xác nhận nếu được yêu cầu.
4. Đăng nhập bằng email + mật khẩu đã tạo.

> **Tip**: Sau khi đăng nhập, phiên làm việc được lưu tự động — bạn không cần đăng nhập lại mỗi lần mở trang.

---

## Dashboard (Bảng điều khiển)

Sau khi đăng nhập, bạn sẽ thấy:

- **Tổng link** — số QR link đang có.
- **Tổng click** — tổng lượt click tất cả link.
- **Danh sách link** — mỗi link hiển thị tên, short code, URL đích, số click, và mã QR.
- Nút **Tạo QR mới** — mở dialog tạo link.

**Góc trên phải**:
- Nút **Đổi giao diện** (sáng/tối).
- Nút **Đăng xuất**.

---

## Tạo link mới

1. Nhấn nút **Tạo QR mới** trên dashboard.
2. Điền thông tin:

| Trường | Bắt buộc | Mô tả |
|---|---|---|
| **Tên link** | ✅ | Tên gợi nhớ, ví dụ: "Netflix US" |
| **URL mặc định** | ✅ | URL đích mà người quét QR sẽ được chuyển đến |
| **Short code** | ❌ | Mã ngắn tùy chỉnh (3-20 ký tự, A-Z, 0-9, _, -). Để trống = tự sinh |
| **Ngày hết hạn** | ❌ | Link sẽ tự ngừng hoạt động sau ngày này |
| **Mật khẩu bảo vệ** | ❌ | Người dùng phải nhập mật khẩu trước khi được chuyển hướng |
| **Webhook nhận click** | ❌ | URL nhận thông báo POST mỗi khi có click |
| **Geo-routes** | ❌ | Chuyển hướng theo quốc gia — xem mục bên dưới |

3. Nhấn **Tạo link & QR Code** → link xuất hiện trên dashboard kèm mã QR.

---

## Chỉnh sửa link

1. Trên thẻ link, nhấn biểu tượng **chỉnh sửa** (bút chì).
2. Dialog **Chỉnh sửa link** mở ra với các trường:
   - Tên link, URL mặc định, ngày hết hạn, mật khẩu, webhook, geo-routes.
3. Thay đổi thông tin → nhấn **Lưu thay đổi**.

**Về mật khẩu khi chỉnh sửa**:
- Nếu link đã có mật khẩu: để trống = giữ nguyên mật khẩu cũ.
- Nhập mật khẩu mới = thay thế mật khẩu cũ.
- Nhấn **Xóa mật khẩu hiện tại** = bỏ bảo vệ.

---

## Mã QR — Tùy chỉnh & Tải xuống

Mỗi link có phần **xem trước QR** với các tùy chọn:

### Bảng màu (presets)
Nhấn chấm tròn để chọn nhanh: **Mặc định**, **Trắng**, **Tím**, **Cam**, **Xanh lá**.

### Màu thủ công
Dùng color picker **QR** (màu nét) và **Nền** (màu nền) để chọn bất kỳ màu nào.

### Mức sửa lỗi (Error Level)
Dropdown chọn **L**, **M**, **Q**, hoặc **H** — mức cao hơn cho phép QR bị che nhiều hơn mà vẫn quét được (H = chịu ~30% che phủ, phù hợp khi có logo).

### Kiểu viền
4 kiểu: **Glow** (mặc định), **Không** (trong suốt), **Đậm**, **Đổ bóng**.

### Logo
Nhấn nút **Logo** → nhập URL ảnh → logo hiển thị ở giữa mã QR. Nhấn **Xóa** để gỡ.

### Tải QR
- **PNG** — ảnh 512×512px.
- **SVG** — vector, in ấn chất lượng cao.

> **Tip**: Cấu hình QR (màu, viền, error level, logo) được lưu tự động cùng link — lần sau mở lại vẫn giữ nguyên.

---

## Geo-routing (Chuyển hướng theo quốc gia)

Cho phép chuyển người quét QR đến URL khác nhau tùy quốc gia.

### Cách thiết lập

1. Trong dialog Tạo/Chỉnh sửa link, kéo xuống phần **Geo-routes**.
2. Nhấn **Thêm** để thêm dòng mới.
3. Chọn **mã quốc gia** (ví dụ: CN, JP, US).
4. Nhập **URL đích** riêng cho quốc gia đó.
5. *(Tùy chọn)* Nhập **Bypass URL** — dùng khi URL đích bị chặn bởi tường lửa (ví dụ: Great Firewall tại Trung Quốc). Bypass URL thường trỏ đến proxy server trung gian.

### Thứ tự chuyển hướng

```
Người quét → quốc gia khớp geo-route?
  → Có: bypass_url (nếu có) → target_url
  → Không: URL mặc định
```

> **Lưu ý**: Biểu tượng ↺ trên thẻ link cho biết geo-route đó có bypass URL.

---

## Phân tích (Analytics)

Nhấn vào thẻ link trên dashboard để mở bảng phân tích.

### Biểu đồ click
- Hiển thị lượt click theo thời gian.
- Chọn khoảng thời gian: **7 ngày**, **30 ngày**, **90 ngày**, hoặc **tùy chỉnh**.

### Lọc theo quốc gia
- Dropdown **Nguồn theo quốc gia** — chọn mã quốc gia để xem referer breakdown riêng.

### Xuất dữ liệu
- **Xuất CSV** — tải bảng chi tiết click dưới dạng CSV.
- **Xuất PDF** — sử dụng hộp thoại in của trình duyệt để lưu file PDF.

---

## Click Webhook

Mỗi link có thể gửi thông báo HTTP POST mỗi khi có click.

### Cách bật
1. Trong dialog Tạo/Chỉnh sửa link.
2. Nhập URL vào trường **Webhook nhận click**, ví dụ: `https://example.com/webhooks/qrlive`.
3. Nhấn **Lưu thay đổi** (hoặc **Tạo link & QR Code** khi tạo mới).

> **Yêu cầu**: Webhook URL phải dùng `https://` với domain public. Localhost, IP, và domain nội bộ (.local, .internal) không được chấp nhận.

### Dữ liệu gửi đi
Mỗi click gửi JSON payload `click.created` gồm:
- `link`: id, name, short_code
- `destination`: default_url, redirect_url, geo_routed (boolean)
- `click`: country_code, referer
- `occurred_at`: thời gian click (ISO 8601)

> **Lưu ý**: Payload **không chứa** IP hay user-agent. Webhook chỉ gửi khi click thực sự được ghi nhận (không gửi cho bot hoặc click trùng lặp trong 60 giây).

---

## Bật / Tắt / Xóa link

### Tạm dừng link
- Nhấn biểu tượng **toggle** (công tắc) trên thẻ link.
- Link tắt → người quét QR sẽ không được chuyển hướng.
- Nhấn lại để bật lại.

### Xóa link
1. Nhấn biểu tượng **thùng rác** → hộp thoại xác nhận hiện ra: *"Xóa QR link này?"*.
2. Nhấn **Xóa** để xác nhận. Hành động này **không thể hoàn tác**.

---

## Nhập / Xuất hàng loạt

### Xuất CSV
- Trên dashboard, nhấn nút **Xuất CSV** (biểu tượng download) để tải toàn bộ link ra file CSV.

### Nhập CSV
1. Nhấn nút **Nhập CSV** → dialog **Nhập link từ CSV** mở ra.
2. Kéo thả file CSV hoặc chọn file.
3. Xem trước bảng dữ liệu → nhấn **Nhập** để tạo link hàng loạt.

**Giới hạn**: File tối đa 1 MB và 500 dòng.

---

## Xử lý sự cố thường gặp

| Vấn đề | Giải pháp |
|---|---|
| Không đăng nhập được | Kiểm tra email/mật khẩu. Thử đăng ký lại nếu chưa có tài khoản. |
| Link redirect không hoạt động | Kiểm tra link có đang **bật** (active) không. Kiểm tra ngày hết hạn. |
| QR quét không mở được | Kiểm tra URL đích có hợp lệ không. Thử mở link trên trình duyệt. |
| Geo-routing không đúng quốc gia | Geo detection dựa trên IP — VPN có thể gây sai quốc gia. |
| Webhook không nhận được | Đảm bảo URL webhook trả về HTTP 2xx. Click bot/trùng lặp không gửi webhook. |
