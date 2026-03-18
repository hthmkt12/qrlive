# QRLive Manual QA Test Plan

## Scope

- Product: QRLive - Dynamic QR Code Link Shortener
- Env: Production - https://qrlive.vercel.app
- Goal: Manual browser QA theo luong nguoi dung thuc te, uu tien P0/P1 flows truoc
- Focus order: Auth -> Redirect -> Create/Edit -> Analytics -> Bulk ops

## Test Setup

- Browser chinh: Chrome desktop ban moi nhat
- Browser phu: Edge desktop hoac Firefox
- Mobile: Chrome Android hoac Safari iPhone de scan QR that
- Account:
  - 1 email moi chua dang ky
  - 1 email da dang ky va dang nhap duoc
- Cong cu ho tro:
  - 1 webhook receiver public HTTPS de nhan POST test
  - VPN hoac tester o JP/VN/US de test geo routing
  - 1 app scan QR tren dien thoai
  - 1 CSV editor
- Prefix du lieu test: `QA-YYYYMMDD-*`

## Source Review Notes

- Form auth dung message tieng Viet:
  - `Email không hợp lệ`
  - `Mật khẩu tối thiểu 8 ký tự`
  - `Email hoặc mật khẩu không đúng`
  - `Email này đã được đăng ký`
- Form tao/sua link dung message tieng Viet:
  - `Tên không được để trống`
  - `URL mặc định không hợp lệ`
  - `Short code chỉ chứa chữ, số, - hoặc _, dài 3-20 ký tự`
  - `Mật khẩu tối thiểu 4 ký tự`
  - `Webhook URL phải bắt đầu bằng https://`
  - `Webhook URL phải dùng HTTPS với domain public, không dùng localhost, IP, hoặc domain nội bộ`
  - `Secret tối thiểu 16 ký tự`
- Redirect logic canh bao:
  - Link inactive hoac khong ton tai -> `404` JSON `Link not found or inactive`
  - Link het han -> `410` HTML page
  - Link co mat khau -> GET hien form, POST sai mat khau -> `401` voi `Mật khẩu không đúng. Vui lòng thử lại.`
  - Click trung cung IP trong 60 giay khong tang analytics va khong ban webhook
- QR customization co khoang trong testability:
  - `QRPreview` chi xuat hien trong Stats panel
  - `CreateLinkDialog` va `EditLinkDialog` co `qrConfigRef` nhung khong render UI QR customization
  - `StatsPanel` dang render `QRPreview` ma khong truyen `qr_config`
  - Can test exploratory de xac nhan tinh nang QR config/persistence tren production co dang hoat dong dung nhu mong doi hay khong

## Run Order

1. P0 Auth
2. P0 Redirect + password + expiration
3. P0 Create/Edit/Toggle/Delete
4. P1 Analytics
5. P1 QR display/download/customization
6. P2 Bulk import/export

## Shared Test Data

- Default URL: `https://example.com/?src=qrlive`
- Geo target JP: `https://example.com/jp`
- Geo target VN: `https://example.com/vn`
- Bypass URL: `https://translate.google.com/translate?u=https://example.com/jp`
- Valid custom code: `QAOK01`
- Invalid custom code: `ab`, `bad code`, `qa!123`
- Password test: `1234test`
- Short secret: `123456789012345`
- Valid secret: `1234567890abcdef`

### Sample CSV for bulk import

```csv
name,default_url,custom_short_code,expires_at,geo_country_code,geo_target_url,geo_bypass_url
QA Bulk 1,https://example.com,QA_BULK_1,,JP,https://example.com/jp,
QA Bulk 1,https://example.com,QA_BULK_1,,VN,https://example.com/vn,https://translate.google.com/translate?u=https://example.com/vn
QA Bulk 2,https://example.org,QA_BULK_2,,,
```

## Checklist

### Auth

#### AUTH-01 - Dang ky voi email/password khong hop le
- Priority: P0
- Steps:
  1. Mo `/auth`
  2. Chuyen sang mode `Đăng ký`
  3. Nhap email sai format
  4. Nhap password duoi 8 ky tu
  5. Bam `Đăng ký`
- Expected:
  - Hien `Email không hợp lệ`
  - Hien `Mật khẩu tối thiểu 8 ký tự`
  - Khong redirect vao dashboard
- Result: [ ] Pass [ ] Fail

#### AUTH-02 - Dang ky thanh cong
- Priority: P0
- Steps:
  1. O mode `Đăng ký`, nhap email moi chua ton tai
  2. Nhap password hop le >= 8 ky tu
  3. Bam `Đăng ký`
- Expected:
  - Redirect vao `/`
  - Header hien email vua dang ky
  - Khong hien thong bao loi
- Result: [ ] Pass [ ] Fail

#### AUTH-03 - Dang ky trung email
- Priority: P0
- Steps:
  1. Dang xuat neu dang login
  2. Mo lai `/auth`, chon `Đăng ký`
  3. Nhap email da ton tai
  4. Nhap password hop le
  5. Bam `Đăng ký`
- Expected:
  - Hien message `Email này đã được đăng ký`
  - Khong vao dashboard
- Result: [ ] Pass [ ] Fail

#### AUTH-04 - Dang nhap sai thong tin
- Priority: P0
- Steps:
  1. O mode `Đăng nhập`, nhap email hop le
  2. Nhap sai mat khau
  3. Bam `Đăng nhập`
- Expected:
  - Hien message `Email hoặc mật khẩu không đúng`
  - Khong redirect
- Result: [ ] Pass [ ] Fail

#### AUTH-05 - Dang nhap thanh cong
- Priority: P0
- Steps:
  1. Nhap email da dang ky
  2. Nhap dung password
  3. Bam `Đăng nhập`
- Expected:
  - Redirect vao dashboard
  - Hien metrics va action toolbar
  - Neu account chua co link thi hien empty state `Chưa có QR code nào`
- Result: [ ] Pass [ ] Fail

#### AUTH-06 - Session persistence va logout
- Priority: P0
- Steps:
  1. Dang nhap thanh cong
  2. Refresh tab
  3. Mo them 1 tab moi vao `/`
  4. Bam icon `Đăng xuất`
  5. Dung nut Back cua browser
- Expected:
  - Sau refresh va tab moi, van o dashboard
  - Sau logout, quay ve auth flow hoac mat session
  - Bam Back khong vao duoc dashboard da bao ve
- Result: [ ] Pass [ ] Fail

### Redirect, Password, Expiration

#### REDIR-01 - Link inactive tra ve 404
- Priority: P0
- Preconditions: Co 1 link da tao, da toggle sang inactive
- Steps:
  1. Copy link redirect `/r/{shortCode}` hoac URL redirect hien tren card
  2. Mo URL trong tab moi
- Expected:
  - Response hien loi `Link not found or inactive`
  - Khong redirect ra URL dich
- Result: [ ] Pass [ ] Fail

#### REDIR-02 - Redirect thuong thanh cong va tang analytics
- Priority: P0
- Preconditions: Co 1 link active, khong password, khong expired
- Steps:
  1. Mo Stats cua link de ghi lai `Tổng clicks`
  2. Mo URL redirect trong tab moi
  3. Cho redirect xong
  4. Quay lai Stats sau 5-10 giay va refresh neu can
- Expected:
  - Redirect `302` den `default_url`
  - `Tổng clicks` tang them 1
  - `Hôm nay` tang them 1
- Result: [ ] Pass [ ] Fail

#### REDIR-03 - Duplicate click trong 60 giay khong bi dem 2 lan
- Priority: P0
- Preconditions: Vua chay xong `REDIR-02`
- Steps:
  1. Tu cung browser, cung mang, mo lai redirect URL trong vong 60 giay
  2. Quay lai Stats
- Expected:
  - Redirect van thanh cong
  - Analytics khong tang them 1 lan nua
  - Neu dang test webhook, webhook cung khong gui them
- Result: [ ] Pass [ ] Fail

#### REDIR-04 - Geo route va bypass route
- Priority: P0
- Preconditions: Link co it nhat 1 geo route JP va 1 bypass URL
- Steps:
  1. Bat VPN sang dung quoc gia route da tao, hoac nho tester o region do truy cap
  2. Mo redirect URL
  3. Lap lai voi region khac khong match route
- Expected:
  - Region match -> redirect sang `bypass_url` neu co, neu khong thi sang `target_url`
  - Region khong match -> redirect sang `default_url`
  - Country breakdown trong analytics phan anh quoc gia vua test
- Result: [ ] Pass [ ] Fail

#### REDIR-05 - Link co mat khau: GET form + sai mat khau
- Priority: P0
- Preconditions: Co 1 link active co `linkPassword`
- Steps:
  1. Mo redirect URL bang GET
  2. Xac nhan form password hien ra
  3. Nhap sai mat khau
  4. Submit
- Expected:
  - GET dau tien hien page `Link được bảo vệ`
  - POST sai mat khau hien lai form
  - Co thong bao `Mật khẩu không đúng. Vui lòng thử lại.`
  - Khong redirect
- Result: [ ] Pass [ ] Fail

#### REDIR-06 - Link co mat khau: dung mat khau
- Priority: P0
- Preconditions: Dung link cua `REDIR-05`
- Steps:
  1. Mo redirect URL
  2. Nhap dung mat khau
  3. Submit
- Expected:
  - Redirect thanh cong sang URL dich
  - Analytics tang 1 lan hop le
- Result: [ ] Pass [ ] Fail

#### REDIR-07 - Link het han tra ve 410
- Priority: P0
- Preconditions: Tao 1 link co `expires_at` la ngay hom qua
- Steps:
  1. Mo redirect URL cua link da het han
- Expected:
  - Hien HTML page thong bao `Link này đã hết hạn`
  - Khong redirect ra URL dich
- Result: [ ] Pass [ ] Fail

### Create Link

#### CREATE-01 - Tao link toi thieu thanh cong
- Priority: P0
- Steps:
  1. Bam `Tạo QR mới`
  2. Nhap `Tên link`
  3. Nhap `URL mặc định` hop le
  4. De trong cac field tuy chon
  5. Bam `Tạo link & QR Code`
- Expected:
  - Button chuyen `Đang tạo...`
  - Toast `Đã tạo link thành công!`
  - Dialog dong
  - Card moi hien trong dashboard
- Result: [ ] Pass [ ] Fail

#### CREATE-02 - Validation bat buoc cua create form
- Priority: P0
- Steps:
  1. Mo dialog tao link
  2. De trong `Tên link`
  3. Nhap `URL mặc định` sai format
  4. Bam submit
- Expected:
  - Hien `Tên không được để trống`
  - Hien `URL mặc định không hợp lệ`
  - Khong tao link
- Result: [ ] Pass [ ] Fail

#### CREATE-03 - Custom short code valid, invalid, duplicate
- Priority: P0
- Steps:
  1. Tao link voi short code hop le `QAOK01`
  2. Tao link thu hai voi short code `ab`
  3. Tao link thu ba voi short code `bad code`
  4. Tao link thu tu dung lai `QAOK01`
- Expected:
  - Case 1 tao thanh cong
  - Case 2/3 hien `Short code chỉ chứa chữ, số, - hoặc _, dài 3-20 ký tự`
  - Case 4 hien toast `Short code này đã được dùng, vui lòng chọn cái khác`
- Result: [ ] Pass [ ] Fail

#### CREATE-04 - Password, webhook URL, webhook secret validation
- Priority: P0
- Steps:
  1. Mo dialog tao link
  2. Nhap password ngan hon 4 ky tu
  3. Nhap webhook URL bang `http://...`
  4. Nhap webhook URL la `https://localhost/...`
  5. Nhap webhook secret ngan hon 16 ky tu
- Expected:
  - Password hien `Mật khẩu tối thiểu 4 ký tự`
  - Webhook URL hien `Webhook URL phải bắt đầu bằng https://` hoac message domain public
  - Webhook localhost/IP/noi bo bi block
  - Secret hien `Secret tối thiểu 16 ký tự`
- Result: [ ] Pass [ ] Fail

#### CREATE-05 - Tao link voi geo routes, password, webhook hop le
- Priority: P0
- Steps:
  1. Tao 1 link moi
  2. Dien default URL
  3. Them 2 geo routes, trong do 1 route co bypass URL
  4. Dat password hop le
  5. Dat webhook URL public HTTPS
  6. Dat webhook secret >= 16 ky tu
  7. Submit
- Expected:
  - Tao thanh cong
  - Card hien badge quoc gia da tao
  - Link co icon khoa
  - Vao edit dialog thay webhook URL da duoc fill
  - Neu link da co secret, edit dialog hien trang thai `Nhập secret mới nếu muốn thay đổi` va nut `Xóa secret hiện tại`
- Result: [ ] Pass [ ] Fail

#### CREATE-06 - Webhook click chi gui cho click hop le
- Priority: P1
- Preconditions: Co link active voi webhook URL public va secret hop le; mo webhook receiver song song
- Steps:
  1. Mo redirect URL bang browser that
  2. Kiem tra request den webhook receiver
  3. Click lai trong vong 60 giay
- Expected:
  - Webhook nhan 1 POST cho click hop le
  - Header co `X-QRLive-Event`, `X-QRLive-Version`
  - Neu co secret, co `X-QRLive-Timestamp` va `X-QRLive-Signature-256`
  - Click trung trong 60 giay khong sinh them 1 webhook moi
- Result: [ ] Pass [ ] Fail

### QR Code

#### QR-01 - Hien thi QR preview va copy link
- Priority: P1
- Preconditions: Co 1 link, mo Stats panel
- Steps:
  1. Bam `Thống kê` tren card
  2. Kiem tra khung QR
  3. Bam `Copy link`
- Expected:
  - QR preview hien dung short code/link redirect
  - Toast `Đã copy link!`
  - Paste ra ngoai dung URL redirect cua link
- Result: [ ] Pass [ ] Fail

#### QR-02 - Download PNG va SVG
- Priority: P1
- Preconditions: Dang o Stats panel
- Steps:
  1. Bam `PNG`
  2. Bam `SVG`
  3. Mo 2 file vua tai
  4. Scan file PNG bang dien thoai neu can
- Expected:
  - Download thanh cong 2 file
  - File mo duoc, QR doc duoc
  - Scan file van redirect dung
- Result: [ ] Pass [ ] Fail

#### QR-03 - Exploratory test cho QR customization/persistence
- Priority: P1
- Preconditions: Dang o Stats panel
- Steps:
  1. Thu tim UI doi mau, doi vien, them logo trong production
  2. Neu co UI, thay doi config QR
  3. Refresh trang
  4. Mo lai Stats
  5. Mo Edit dialog xem co giu config hay khong
- Expected:
  - Ghi ro co hay khong co UI customization tren production
  - Neu co UI, xac nhan thay doi co tac dong vao preview
  - Kiem tra config co persist sau refresh/reopen hay khong
- Result: [ ] Pass [ ] Fail

### Edit, Toggle, Delete

#### EDIT-01 - Sua ten link va default URL
- Priority: P0
- Preconditions: Co 1 link da tao
- Steps:
  1. Bam `Chỉnh sửa`
  2. Doi `Tên link`
  3. Doi `URL mặc định`
  4. Bam `Lưu thay đổi`
- Expected:
  - Toast `Đã cập nhật thành công!`
  - Card dashboard cap nhat ngay hoac sau refetch
  - Redirect URL cua short code khong doi, chi dich den URL moi
- Result: [ ] Pass [ ] Fail

#### EDIT-02 - Doi mat khau va xoa mat khau
- Priority: P0
- Preconditions: Co 1 link dang co mat khau
- Steps:
  1. Mo edit dialog
  2. Nhap mat khau moi, luu
  3. Test redirect voi mat khau moi
  4. Mo edit lai, bam `Xóa mật khẩu hiện tại`
  5. Luu
  6. Test redirect lai
- Expected:
  - Sau buoc 2, mat khau cu khong con dung
  - Sau buoc 4-5, link mo truc tiep khong hien form password nua
  - Icon khoa tren card bien mat sau khi xoa password
- Result: [ ] Pass [ ] Fail

#### EDIT-03 - Doi webhook secret va xoa webhook secret
- Priority: P1
- Preconditions: Co 1 link dang co webhook URL va secret
- Steps:
  1. Mo edit dialog
  2. Nhap secret moi, luu
  3. Trigger 1 click hop le va xem webhook header
  4. Mo edit lai, bam `Xóa secret hiện tại`
  5. Luu
  6. Trigger them 1 click hop le
- Expected:
  - Sau khi doi secret, webhook van gui signature
  - Sau khi xoa secret, webhook van gui POST neu webhook URL con ton tai, nhung khong con header signature
- Result: [ ] Pass [ ] Fail

#### EDIT-04 - Sua geo routes
- Priority: P0
- Preconditions: Co link co it nhat 1 geo route
- Steps:
  1. Mo edit dialog
  2. Them 1 route moi
  3. Sua 1 route cu
  4. Xoa 1 route
  5. Luu
- Expected:
  - Dashboard badge quoc gia cap nhat dung
  - Redirect theo region follow rule moi
  - Route bi xoa khong con tac dung
- Result: [ ] Pass [ ] Fail

#### TOGGLE-01 - Toggle active/inactive thanh cong
- Priority: P0
- Preconditions: Co 1 link active
- Steps:
  1. Bam icon toggle tren card
  2. Quan sat card va state moi
  3. Mo redirect URL
  4. Toggle lai sang active
- Expected:
  - Card doi state ngay lap tuc
  - Inactive -> card mo hon, redirect 404
  - Active lai -> redirect hoat dong binh thuong
- Result: [ ] Pass [ ] Fail

#### TOGGLE-02 - Optimistic update rollback khi loi mang
- Priority: P1
- Preconditions: Co 1 link active; co the tat mang bang DevTools
- Steps:
  1. Mo DevTools, chuyen network offline
  2. Bam toggle
  3. Bat lai network
  4. Refresh trang
- Expected:
  - UI co the doi tam thoi
  - Sau rollback/refetch, state tro lai dung theo server
  - Khong de dashboard mac ket o state sai
- Result: [ ] Pass [ ] Fail

#### DELETE-01 - Huy xoa link
- Priority: P0
- Preconditions: Co 1 link
- Steps:
  1. Bam icon xoa
  2. Kiem tra modal canh bao
  3. Bam `Hủy`
- Expected:
  - Modal hien message mat du lieu click vinh vien
  - Bam `Hủy` khong xoa link
- Result: [ ] Pass [ ] Fail

#### DELETE-02 - Xac nhan xoa link
- Priority: P0
- Preconditions: Co 1 link co the xoa
- Steps:
  1. Bam icon xoa
  2. Bam `Xóa`
- Expected:
  - Toast `Đã xóa link`
  - Card bien mat khoi dashboard
  - Redirect URL cu tra 404
- Result: [ ] Pass [ ] Fail

### Analytics

#### ANALYTICS-01 - Mo Stats panel va kiem tra metric cards
- Priority: P1
- Preconditions: Co link da co click data
- Steps:
  1. Bam `Thống kê`
  2. Kiem tra 3 metric cards
  3. Bam `Quay lại`
- Expected:
  - Hien `Tổng clicks`, `Hôm nay`, `Quốc gia`
  - Co bieu do va QR preview
  - Bam `Quay lại` tro ve dashboard
- Result: [ ] Pass [ ] Fail

#### ANALYTICS-02 - Date range 7d, 30d, 90d, tuy chon
- Priority: P1
- Preconditions: Co du lieu analytics nhieu ngay neu co the
- Steps:
  1. Vao Stats
  2. Chuyen qua `7 ngày`, `30 ngày`, `90 ngày`
  3. Chon `Tuỳ chọn`
  4. Dat `Ngày bắt đầu` va `Ngày kết thúc`
- Expected:
  - Du lieu bieu do va metric thay doi theo range
  - Range > 30 ngay hien title theo tuan
  - Custom range khong cho end < start hoac start > end
- Result: [ ] Pass [ ] Fail

#### ANALYTICS-03 - Country filter va referer breakdown
- Priority: P1
- Preconditions: Link co click tu it nhat 2 quoc gia va co referer khac nhau
- Steps:
  1. Mo select `Mọi nguồn truy cập`
  2. Chon 1 quoc gia cu the
  3. Xem lai chart/breakdown
  4. Chuyen sang quoc gia khac
- Expected:
  - Breakdown thay doi theo country da chon
  - Label filter hien dung ten/quoc ky
  - Khong crash khi 1 quoc gia khong co referer data
- Result: [ ] Pass [ ] Fail

#### ANALYTICS-04 - Export CSV
- Priority: P1
- Preconditions: Dang o Stats panel
- Steps:
  1. Bam `Xuất dữ liệu`
  2. Chon `Tải xuống CSV`
  3. Mo file vua tai
- Expected:
  - File duoc tai ve
  - Ten file dang `analytics-{shortCode}-{date}.csv`
  - CSV co thong tin tong quan, country breakdown, referer breakdown
- Result: [ ] Pass [ ] Fail

#### ANALYTICS-05 - Print PDF
- Priority: P1
- Preconditions: Dang o Stats panel
- Steps:
  1. Bam `Xuất dữ liệu`
  2. Chon `In PDF`
- Expected:
  - Browser mo print dialog
  - Nguoi test co the save thanh PDF
- Result: [ ] Pass [ ] Fail

### Bulk Operations

#### BULK-01 - Import CSV hop le
- Priority: P2
- Preconditions: Dang login; chuan bi file CSV mau
- Steps:
  1. Bam `Nhập CSV`
  2. Upload file hop le
  3. Kiem tra preview table
  4. Bam `Nhập {n} link`
- Expected:
  - Preview hien so dong, so dong hop le, loi neu co
  - Import xong hien summary thanh cong/thất bại
  - Dashboard hien cac link moi
- Result: [ ] Pass [ ] Fail

#### BULK-02 - Import CSV qua 1 MB
- Priority: P2
- Steps:
  1. Mo `Nhập CSV`
  2. Upload file > 1 MB
- Expected:
  - Toast loi `File CSV quá lớn`
  - Co description `Vui lòng chọn file nhỏ hơn hoặc bằng 1 MB.`
  - Khong vao phase preview/import
- Result: [ ] Pass [ ] Fail

#### BULK-03 - Import CSV qua 500 dong
- Priority: P2
- Steps:
  1. Upload file CSV > 500 data rows
- Expected:
  - Toast `CSV có quá nhiều dòng`
  - Co description `Tối đa 500 dòng dữ liệu để tránh treo trình duyệt.`
  - Khong import
- Result: [ ] Pass [ ] Fail

#### BULK-04 - Import CSV co dong loi
- Priority: P2
- Steps:
  1. Upload file co dong thieu `name`
  2. Them dong co `default_url` sai format
  3. Them dong co `geo_target_url` sai format
- Expected:
  - Preview hien danh sach loi theo `Dòng {n}`
  - Message dung schema:
    - `Tên không được để trống`
    - `URL không hợp lệ`
    - `Geo URL không hợp lệ`
  - Nut import chi import phan link hop le
- Result: [ ] Pass [ ] Fail

#### BULK-05 - Export tat ca links ra CSV
- Priority: P2
- Preconditions: Dashboard dang co link
- Steps:
  1. Bam `Xuất CSV`
  2. Mo file da tai
- Expected:
  - File ten dang `qrlive-links-{date}.csv`
  - CSV co header `name,default_url,custom_short_code,expires_at,geo_country_code,geo_target_url,geo_bypass_url`
  - Link co geo routes se xuat nhieu dong, link khong geo route se xuat 1 dong rong cac cot geo
- Result: [ ] Pass [ ] Fail

## Exit Criteria

- Tat ca P0 pass
- Khong con bug blocker o Auth, Redirect, Create/Edit, Password, Expiration
- P1 co the con issue nho ve UI/analytics export neu da ghi ro scope va impact
- P2 co the defer neu khong anh huong release hien tai, nhung phai co bug ticket

## Bug Logging Template

- ID:
- Feature:
- Severity: Blocker / High / Medium / Low
- Browser + device:
- Preconditions:
- Steps to reproduce:
- Actual result:
- Expected result:
- Screenshot/video:

## Unresolved Questions

- QR customization/persistence co ve chua co UI flow day du trong production path hien tai. Can xac nhan voi product/dev xem feature nay dang ship mot phan hay da duoc ky vong hoat dong day du.
- Geo routing manual QA can VPN hoac tester o region that. Neu khong co, can chot phuong an test thay the truoc khi bat dau cycle.
