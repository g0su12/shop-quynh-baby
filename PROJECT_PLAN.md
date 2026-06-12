# Quynh Baby Shop Website - Project Plan

## 1. Mục tiêu sản phẩm

Xây dựng một website dạng catalog/showroom cho cửa hàng quần áo trẻ em bán offline tại gia.
Website không xử lý thanh toán, giỏ hàng, tài khoản khách hàng hoặc vận chuyển như e-commerce.

Mục tiêu chính:

- Khách xem được các mẫu quần áo đang có.
- Khách biết sản phẩm còn size/màu nào.
- Khách bấm liên hệ qua Zalo/Facebook/điện thoại để hỏi mua.
- Admin có thể tự đăng, sửa, ẩn/hiện sản phẩm.
- Tính năng ghép ảnh thử đồ sẽ làm sau theo hướng kiểm soát chi phí.

## 2. Nguyên tắc triển khai

- Ưu tiên chi phí thấp.
- Ưu tiên vận hành đơn giản cho cửa hàng nhỏ, khoảng 100 khách quen.
- Không over-engineer như một sàn e-commerce.
- Admin phải dễ dùng, thao tác nhanh trên điện thoại/laptop.
- Dữ liệu ảnh trẻ em phải được xử lý cẩn thận, không lưu lâu nếu không cần.
- Tính năng AI phải có quota/budget cap, không cho public spam request.

## 3. Phạm vi MVP

### Public website

- [x] Trang danh sách sản phẩm đọc từ D1, fallback mock khi API local chưa chạy.
- [ ] Trang chi tiết sản phẩm.
- [x] Bộ lọc theo:
  - [x] Bé trai / bé gái / unisex.
  - [x] Danh mục: áo, quần, váy, bộ đồ, phụ kiện.
  - [ ] Size.
  - [x] Độ tuổi.
  - [ ] Tình trạng còn hàng.
- [x] Tìm kiếm theo tên sản phẩm, size, danh mục.
- [ ] Hiển thị ảnh chính và ảnh phụ.
- [x] Không hiển thị giá ở public.
- [x] Hiển thị size/màu còn hàng từ product variants.
- [x] Thêm icon/category tile sinh động bằng Phosphor duotone.
- [x] Nút liên hệ nhanh:
  - [x] Zalo.
  - [x] Facebook Messenger.
  - [x] Số điện thoại.
- [x] Share link đẹp qua Facebook/Zalo bằng Open Graph metadata ban đầu.
- [x] Giao diện responsive public bản đầu tiên.

### Admin

- [x] Scaffold admin route `/admin` bản UI đầu tiên.
- [x] Đăng nhập admin single-admin, không có signup.
- [x] Xem danh sách sản phẩm trong admin từ D1.
- [x] Tạo sản phẩm mới.
- [x] Sửa thông tin sản phẩm.
- [x] Ẩn/hiện sản phẩm.
- [ ] Xóa sản phẩm hoặc đánh dấu archived.
- [x] Upload nhiều ảnh cho một sản phẩm lên R2.
- [x] Chọn và xóa ảnh đại diện.
- [x] Quản lý size/màu/tình trạng còn hàng.
- [x] Đánh dấu sản phẩm nổi bật.
- [x] Xem danh sách yêu cầu thử đồ bằng mock data.

### Chưa làm trong MVP

- [ ] Giỏ hàng.
- [ ] Thanh toán online.
- [ ] Tài khoản khách hàng.
- [ ] Voucher/khuyến mãi phức tạp.
- [ ] Quản lý vận chuyển.
- [ ] AI ghép ảnh tự động public không giới hạn.

## 4. Mô hình dữ liệu dự kiến

### products

- `id`
- `name`
- `slug`
- `description`
- `category`
- `gender`
- `age_group`
- `weight_range`
- `is_visible`
- `is_featured`
- `stock_status`
- `created_at`
- `updated_at`

### product_images

- `id`
- `product_id`
- `object_key`
- `public_url`
- `alt_text`
- `sort_order`
- `is_primary`
- `created_at`

### product_variants

- `id`
- `product_id`
- `size_label`
- `color_label`
- `stock_status`
- `sort_order`
- `created_at`
- `updated_at`

Ghi chú:

- `stock_status` có thể là `in_stock`, `low_stock`, `out_of_stock`.
- Không lưu số lượng tồn kho chính xác trong MVP.

### try_on_requests

Dùng cho phase AI, chưa cần implement ngay.

- `id`
- `product_id`
- `customer_name`
- `customer_phone`
- `customer_contact_channel`
- `input_image_key`
- `result_image_key`
- `status`
- `admin_note`
- `created_at`
- `processed_at`
- `expires_at`

Ghi chú:

- `status` có thể là `pending`, `approved`, `processing`, `completed`, `rejected`, `failed`.
- Ảnh trẻ em nên có `expires_at` để tự xóa sau một khoảng thời gian ngắn.

## 5. Hướng hạ tầng đã chốt

### MVP stack - Cloudflare-first

Phù hợp với mục tiêu chi phí thấp, traffic nhỏ và catalog website cache-heavy.

- Frontend: Cloudflare Pages.
- Frontend framework: React + Vite.
- Backend API: Cloudflare Pages Functions hoặc Workers.
- Database: Cloudflare D1.
- Storage ảnh: Cloudflare R2.
- Captcha/chống spam: Cloudflare Turnstile.
- Auth admin: password/session server-side trong Pages Functions, hoặc Cloudflare Access nếu muốn khóa admin đơn giản hơn.
- Không có flow đăng ký tài khoản vì cửa hàng chỉ có một người quản lý.

Ưu điểm:

- Rất rẻ khi traffic nhỏ.
- Hạ tầng gọn trong Cloudflare.
- Phù hợp cache-heavy catalog website.
- Không cần Supabase ở MVP.

Nhược điểm:

- Tốn công tự làm nhiều phần hơn.
- Auth/admin/database workflow không tiện bằng Supabase.
- Cần cấu hình D1/R2/Pages kỹ hơn ở giai đoạn đầu.

### Ghi chú về Supabase

Supabase tạm thời không dùng trong MVP.
Chỉ cân nhắc lại nếu cần phát triển admin/auth nhanh hơn hoặc Cloudflare-first gây quá nhiều chi phí triển khai.

## 6. Checklist việc bạn cần làm

### Cloudflare

- [ ] Tạo tài khoản Cloudflare.
- [ ] Mua domain hoặc transfer domain về Cloudflare nếu đã có domain.
- [ ] Tạo project Cloudflare Pages.
- [ ] Kết nối Cloudflare Pages với GitHub repository.
- [ ] Cấu hình custom domain cho website.
- [ ] Bật HTTPS mặc định.
- [ ] Tạo D1 database cho catalog, ví dụ `quynh-baby-shop`.
- [ ] Tạo R2 bucket cho ảnh sản phẩm, ví dụ `product-images`.
- [ ] Tạo R2 bucket riêng cho ảnh thử đồ nếu bật phase AI, ví dụ `try-on-images`.
- [ ] Tạo Turnstile site key nếu sau này dùng form upload/AI.
- [ ] Tạo `ADMIN_PASSWORD_HASH` bằng `npm run admin:hash -- "mật khẩu mạnh"`.
- [ ] Tạo `ADMIN_SESSION_SECRET` là một chuỗi random dài và lưu trong Cloudflare Pages env vars.
- [ ] Gửi cho dev các thông tin cần thiết:
  - [ ] Cloudflare account email.
  - [ ] Domain muốn dùng.
  - [ ] D1 database name và database id.
  - [ ] R2 bucket name.
  - [ ] Xác nhận đã set `ADMIN_PASSWORD_HASH` và `ADMIN_SESSION_SECRET`.
  - [ ] Turnstile site key nếu đã tạo.
  - [ ] Turnstile secret key nếu đã tạo, gửi qua kênh bảo mật, không commit vào repo.

### GitHub

- [ ] Tạo GitHub repository nếu chưa có remote.
- [ ] Cấp quyền cho Cloudflare Pages đọc repository.
- [ ] Thống nhất branch deploy production, ví dụ `main`.

### Thông tin cửa hàng

- [ ] Tên cửa hàng hiển thị trên website. -> "Quynh Baby Shop".
- [ ] Số điện thoại liên hệ. -> 0857036878
- [ ] Link Zalo hoặc Zalo OA nếu có. -> sử dụng zalo badge nếu có, thư viện gì đó để tạo nút bấm liên hệ qua Zalo.
   - Nếu chưa có OA, có thể chỉ cần link zalo.me/0857036878.
- [ ] Link Facebook page/Messenger.-> https://www.facebook.com/nguyen.nhu.quynh.506701
- [ ] Địa chỉ/khu vực bán hàng nếu muốn hiển thị. -> https://maps.app.goo.gl/RebED1MNfFsy4BsG9
- [ ] Logo nếu có.
- [ ] Màu sắc/gu giao diện mong muốn. -> tone màu nhẹ nhàng, tươi sáng, phù hợp với trẻ em.
- [ ] 10-20 ảnh sản phẩm mẫu để dựng UI thật hơn. -> có thể lấy tạm ảnh mẫu từ các nguồn khác để phát triển trước.

## 7. Environment variables dự kiến

Các biến môi trường có thể cần:

- `VITE_SITE_URL`
- `VITE_SHOP_NAME`
- `VITE_SHOP_PHONE`
- `VITE_SHOP_ZALO_URL`
- `VITE_SHOP_FACEBOOK_URL`
- `VITE_SHOP_MAPS_URL`
- `VITE_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `ADMIN_SESSION_SECRET`
- `ADMIN_PASSWORD_HASH`

Ghi chú:

- Biến bắt đầu bằng `VITE_` có thể xuất hiện ở frontend.
- Secret key không được commit vào Git.
- Secret cho admin/session/Turnstile chỉ dùng server-side trong Pages Functions hoặc Workers.

## 8. AI ghép ảnh thử đồ - phase sau MVP

### Cách làm đề xuất

Không cho khách public generate tự động ngay từ đầu.

Flow an toàn hơn:

- [ ] Khách chọn sản phẩm.
- [ ] Khách upload ảnh bé.
- [ ] Khách nhập tên/số điện thoại/Zalo.
- [ ] Request vào admin ở trạng thái `pending`.
- [ ] Admin kiểm tra request.
- [ ] Admin bấm approve/generate nếu khách có ý định mua thật.
- [ ] Hệ thống tạo ảnh thử đồ.
- [ ] Kết quả gửi lại cho khách hoặc hiện bằng link riêng có thời hạn.

### Rule kiểm soát chi phí

- [ ] Không gọi AI trực tiếp từ frontend.
- [ ] Luôn gọi AI qua backend.
- [ ] Có giới hạn lượt theo ngày.
- [ ] Có giới hạn ngân sách theo tháng.
- [ ] Có trạng thái tắt AI ngay trong config.
- [ ] Chỉ bật AI cho sản phẩm còn hàng.
- [ ] Resize/compress ảnh trước khi gửi sang AI provider.
- [ ] Lưu log chi phí/lượt request.
- [ ] Không lưu ảnh trẻ em quá lâu.

### Câu hỏi cần review trước khi làm AI

- [ ] Dùng AI provider nào? Bạn nghĩ sao về việc sử dụng chính OpenAI, codex hay dùng gemini?
- [ ] Mỗi tháng chấp nhận tối đa bao nhiêu tiền cho AI? Khoảng 20-30 USD/tháng có vẻ hợp lý để bắt đầu.
- [ ] Có yêu cầu ảnh kết quả phải rất thật không, hay preview tương đối là đủ? rất thật nhé, để khách có thể hình dung rõ hơn.
- [ ] Ảnh khách upload sẽ tự xóa sau bao lâu? xoá ngay sau khi approve ảnh thử đồ, hoặc sau 24h nếu chưa được approve.
- [ ] Khách có cần nhập số điện thoại trước khi gửi request không? Có, để tránh spam và có cách liên hệ lại.

## 9. Thiết kế UI cần thống nhất

- [x] Tên brand hiển thị: `Quynh Baby Shop`.
- [x] Tone màu chính: nhẹ nhàng, tươi sáng, phù hợp trẻ em.
- [x] Phong cách: nhẹ nhàng, gia đình, trẻ em, nhưng vẫn gọn và dễ xem sản phẩm.
- [x] Có hiển thị giá công khai hay chỉ để "Liên hệ"? Không hiển thị giá, chỉ để "Liên hệ" hoặc "Thử cho bé".
- [x] Có hiển thị số lượng tồn kho không, hay chỉ hiển thị "Còn size"? Không hiển thị số lượng, chỉ hiển thị còn size/màu.
- [x] Có phân loại theo độ tuổi như `0-6m`, `6-12m`, `1-2y`, `3-5y` không? Phân loại theo tuổi và cân nặng.
- [x] Có cần song ngữ Việt/Anh không? Không cần, ưu tiên tiếng Việt đơn giản.

## 10. Thứ tự thực hiện đề xuất

- [ ] Review lại plan này.
- [x] Chốt stack MVP: Cloudflare Pages + Pages Functions/Workers + D1 + R2 + Turnstile.
- [x] Chốt tên shop, thông tin liên hệ, màu sắc, style UI ban đầu.
- [x] Khởi tạo frontend project.
- [x] Dựng layout public catalog bản mock.
- [x] Dựng D1 schema ban đầu.
- [x] Dựng admin shell route `/admin` bản mock.
- [x] Dựng admin auth.
- [x] Dựng admin CRUD sản phẩm với D1, chưa gồm xóa vĩnh viễn.
- [x] Dựng upload ảnh sản phẩm với R2 private + Pages Functions.
- [ ] Dựng product detail page.
- [x] Dựng filter/search bản mock.
- [x] Tối ưu mobile public bản đầu tiên.
- [x] Cấu hình SEO/Open Graph ban đầu.
- [ ] Deploy thử lên Cloudflare Pages.
- [ ] Nhập 10-20 sản phẩm mẫu.
- [ ] Review với mẹ bạn.
- [ ] Chỉnh UI/UX theo feedback thực tế.
- [ ] Lên kế hoạch phase AI.

## 11. Open questions

- [ ] Website tên chính thức là gì? Tạm dùng `Quynh Baby Shop`; domain có thể thử `shopquynhbaby.*` hoặc `quynhbabyshop.*`.
- [ ] Có domain chưa? Chưa có, tôi cần 1 domain giá rẻ không cần quá gọn, giá khoảng 5-10 USD/năm là được.
- [x] Muốn dùng Cloudflare Pages + Supabase trước, hay Cloudflare-first từ đầu? Cloudflare từ đầu nhé.
- [x] Có muốn công khai giá không? Không, hãy để liên hệ hoặc thử cho bé.
- [x] Có cần quản lý số lượng tồn kho chính xác không? Không cần, chỉ cần hiển thị còn size/màu nào.
- [x] Admin dùng chủ yếu bằng điện thoại hay laptop? Chủ yếu bằng điện thoại, nhưng cũng muốn có giao diện laptop nếu cần.
- [x] Sản phẩm có nhiều biến thể màu/size phức tạp không? Không quá phức tạp, chủ yếu là size thôi.
- [x] Mẹ bạn có quen thao tác với form upload ảnh không? -> Tự động hóa phần try-on; mẹ là admin approve, tải ảnh về và liên lạc lại qua Zalo/Facebook.
- [x] Có muốn nhập sản phẩm hàng loạt bằng Excel/CSV sau này không? Không cần giai đoạn đầu, làm thủ công trong admin.
- [x] Có muốn hiển thị sản phẩm nổi bật trên trang chủ không? Có, hiển thị 3-4 sản phẩm nổi bật.
- [x] Có muốn phân loại sản phẩm theo độ tuổi không? Có, ví dụ 0-6 tháng, 6-12 tháng, 1-2 tuổi, 3-5 tuổi.
- [x] Có muốn hiển thị sản phẩm theo giới tính không? Có, bé trai, bé gái và unisex.
- [x] Có muốn hiển thị sản phẩm theo danh mục không? Có, áo, quần, váy, bộ đồ, phụ kiện.
- [x] Có muốn hiển thị sản phẩm theo tình trạng còn hàng không? Có, hiển thị còn hàng hoặc hết hàng.
