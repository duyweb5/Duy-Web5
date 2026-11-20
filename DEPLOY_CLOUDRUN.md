# Tự động Deploy lên Google Cloud Run từ GitHub (Continuous Deployment)

Dự án **Meet Boston** đã được cấu hình sẵn `Dockerfile` (Node 22 Slim + Nginx 1.27 Alpine), `nginx.conf` (tự động đọc `$PORT`, hỗ trợ `/admin`, không cache `index.html`), và `.dockerignore` tối ưu cho **Google Cloud Run Continuous Deployment**.

Sau khi thiết lập 1 lần duy nhất bên dưới, **mỗi lần bạn đồng bộ (push) code từ AI Studio lên GitHub, Cloud Run sẽ tự động build lại và cập nhật lên `https://meetboston.duyvo.win/` trong khoảng 1–2 phút** — không cần bấm Publish / Republish thủ công nữa.

---

## Bước 1: Đồng bộ code mới nhất lên GitHub
1. Từ AI Studio, đồng bộ (push) toàn bộ mã nguồn mới nhất lên repository GitHub của bạn (nhánh `main`).
2. Kiểm tra trên GitHub đảm bảo có đủ 3 file quan trọng ở thư mục gốc:
   - `Dockerfile`
   - `nginx.conf`
   - `firebase-applet-config.json` (đã hợp nhất vào project `gen-lang-client-0440115237`)

---

## Bước 2: Bật Continuous Deployment trên Google Cloud Run (Chỉ làm 1 lần)
1. Mở **Google Cloud Console** → vào **Cloud Run** → bấm vào **Service** đang chạy web `meetboston.duyvo.win`.
2. Trên thanh công cụ phía trên, bấm **"Set up continuous deployment"** (hoặc **"Edit continuous deployment"** nếu đã từng bật).
3. Ở mục **Repository Provider**:
   - Chọn **GitHub** → bấm **Authenticate** (nếu chưa liên kết) → chọn đúng **Repository** của bạn.
   - Bấm **Next**.
4. Ở mục **Build Configuration**:
   - **Branch:** `^main$` (hoặc `^master$` nếu nhánh chính của bạn là `master`).
   - **Build Type:** Chọn **Dockerfile**.
   - **Source location:** `/Dockerfile` (mặc định).
5. Bấm **Save**.

Ngay lập tức, Cloud Build sẽ chạy bản build đầu tiên và triển khai lên Cloud Run. Từ lần sau trở đi, **cứ push code lên GitHub là Cloud Run tự động build & deploy**.

---

## Bước 3: Kiểm tra 1 lần duy nhất cho Domain `meetboston.duyvo.win`

Vì dự án đã hợp nhất cả **Firestore**, **Auth**, **Storage** và **Google Drive OAuth** vào cùng Google Cloud Project **`gen-lang-client-0440115237`**, hãy kiểm tra nhanh 2 mục sau trong [Firebase Console (`gen-lang-client-0440115237`)](https://console.firebase.google.com/project/gen-lang-client-0440115237):

1. **Cho phép đăng nhập Google trên tên miền riêng (Bắt buộc):**
   - Vào **Authentication → Settings → Authorized domains** → bấm **Add domain** → thêm `meetboston.duyvo.win`.
   - Nếu dùng Google Drive Picker trên tên miền riêng: mở **Google Cloud Console → APIs & Services → Credentials** (project `gen-lang-client-0440115237`) → mở OAuth Client ID hiện tại → thêm `https://meetboston.duyvo.win` vào **Authorized JavaScript origins**.
2. **Bật Firebase Storage (Tuỳ chọn — để ảnh tối ưu lưu trên CDN tốc độ cao):**
   - Vào **Storage → Get Started** (chọn chế độ Production) để kích hoạt bucket `gen-lang-client-0440115237.firebasestorage.app`.
   - *(Nếu chưa bật ngay, hệ thống Media CMS vẫn hoạt động bình thường nhờ cơ chế tự động nén WebP dự phòng < 300KB).*
3. **Khởi tạo dữ liệu mẫu lần đầu:**
   - Truy cập `https://meetboston.duyvo.win/#admin`, đăng nhập bằng `duyweb5@gmail.com` → bấm **"Khởi tạo dữ liệu mẫu"** 1 lần (nếu cơ sở dữ liệu trên project mới đang trống).

---

## Cách kiểm tra tiến độ mỗi khi Push Code
- Vào **Google Cloud Console → Cloud Build → History** (hoặc tab **Revisions** trong Cloud Run Service) để xem log build trực tiếp.
- Khi có dấu tích xanh, tải lại `https://meetboston.duyvo.win` (Nginx đã cấu hình `no-cache` cho `index.html`, nên bản mới sẽ hiển thị ngay).
