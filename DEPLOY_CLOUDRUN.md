# Tự động Deploy Meet Boston lên Google Cloud Run (`https://meetboston.duyvo.win`)

Dự án **Meet Boston** chạy kiến trúc **Full-stack Node.js 22 (Express + Vite + Firebase Admin SDK + Google Gemini AI)** trong 1 container duy nhất tối ưu cho **Google Cloud Run Continuous Deployment**, hỗ trợ đầy đủ:
- Trang công khai (`/`, `/videos`, `/videos/:slug`) và CMS quản trị (`/admin`).
- API quét kênh YouTube, dịch song ngữ & tối ưu SEO bằng **Google Gemini AI**.
- Tự động bắt video mới tức thì qua **YouTube WebSub (`/api/webhooks/youtube`)** + quét đối soát hàng ngày qua **Google Cloud Scheduler (`/api/cron/sync-youtube`)**.

---

## Bước 1: Đồng bộ code mới nhất lên GitHub
1. Từ AI Studio, đồng bộ (push) toàn bộ mã nguồn mới nhất lên repository GitHub của bạn (nhánh `main`).
2. Đảm bảo Cloud Run Service gắn với `meetboston.duyvo.win` đã bật **Continuous Deployment** từ repository này (Build Type: `Dockerfile`, Source location: `/Dockerfile`).

---

## Bước 2: Chạy 1 lệnh tự động cấu hình IAM + Env + Cloud Scheduler trên Google Cloud Shell
Mở [Google Cloud Shell](https://shell.cloud.google.com/?project=gen-lang-client-0440115237), clone/pull repo của bạn (hoặc dán trực tiếp nội dung script) và chạy:

```bash
bash scripts/setup-meetboston-cloudrun.sh
```

Script tự động thực hiện trọn gói:
1. Tự nhận diện Cloud Run Service & Region trong dự án `gen-lang-client-0440115237`.
2. Cấp đúng quyền tối thiểu **`roles/datastore.user`** cho Cloud Run Service Account (không cần file key JSON).
3. Sinh tự động `CRON_SECRET`, `WEBSUB_SECRET` và gắn `PUBLIC_APP_URL=https://meetboston.duyvo.win` lên Cloud Run.
4. Kiểm tra / tạo Domain Mapping cho `meetboston.duyvo.win`.
5. Tạo hoặc cập nhật lịch **Cloud Scheduler** chạy 06:00 sáng mỗi ngày (`America/New_York`).
6. Kiểm tra trực tiếp `https://meetboston.duyvo.win/api/health`.

*(Mẹo: Nếu muốn gắn luôn khóa Gemini AI trong cùng lượt chạy, thêm `GEMINI_API_KEY="AIza..." bash scripts/setup-meetboston-cloudrun.sh`).*

---

## Bước 3: Kiểm tra 1 lần duy nhất cho Domain `meetboston.duyvo.win`
1. **Firebase Auth (`gen-lang-client-0440115237`):** Vào **Authentication → Settings → Authorized domains** → đảm bảo có `meetboston.duyvo.win`.
2. **Google Drive OAuth (nếu dùng tải ảnh từ Drive):** Vào **Google Cloud Console → APIs & Services → Credentials** → thêm `https://meetboston.duyvo.win` vào **Authorized JavaScript origins**.
3. **Kích hoạt YouTube WebSub:** Mở `https://meetboston.duyvo.win/admin` → **Thư viện Video & AI** → **Tự động hóa & Lịch quét** → bấm **Kích hoạt / Gia hạn WebSub** cho kênh **Lang Thang Boston**.

---

## Chuyển sang tên miền mới trong tương lai (VD: `langthangbostone.com`) — Không cần sửa code
Toàn bộ SEO động (`/sitemap.xml`, `/robots.txt`, Canonical, OpenGraph, JSON-LD) và YouTube WebSub đều đọc tên miền động. Khi đổi sang tên miền mới, chỉ cần chạy đúng 1 lệnh trên Cloud Shell:

```bash
DOMAIN="langthangbostone.com" bash scripts/setup-meetboston-cloudrun.sh
```

Sau đó thêm `langthangbostone.com` vào **Firebase Auth → Authorized domains** và bấm **Gia hạn WebSub** trong `/admin`.

