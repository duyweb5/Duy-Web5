export type AdminRoleKey = 'superAdmin' | 'admin' | 'editor' | 'member';

export type GuideModuleTabId =
  | 'overview'
  | 'site'
  | 'experiences'
  | 'neighborhoods'
  | 'events'
  | 'hotels'
  | 'videos'
  | 'media'
  | 'languages'
  | 'leads'
  | 'admins';

export interface RoleDefinition {
  key: AdminRoleKey;
  label: string;
  shortTitle: string;
  audience: string;
  summary: string;
  canDo: string[];
  cannotDo: string[];
  accentClass: string;
}

export interface RoleMatrixRow {
  capability: string;
  superAdmin: string;
  admin: string;
  editor: string;
  member: string;
}

export interface GuideTopic {
  id: string;
  tabId?: GuideModuleTabId;
  category: 'roles' | 'module' | 'workflow';
  title: string;
  subtitle: string;
  roles: AdminRoleKey[];
  purpose: string;
  steps: string[];
  tips: string[];
}

export interface OnboardingStep {
  id: string;
  title: string;
  detail: string;
  tabId: GuideModuleTabId;
}

export const ONBOARDING_CHECKLIST: OnboardingStep[] = [
  {
    id: 'ob-seed',
    title: 'Khởi tạo dữ liệu mẫu ban đầu',
    detail:
      'Tại tab Tổng quan, bấm "Khởi tạo dữ liệu mẫu" nếu Firestore đang trống để nạp cấu hình trang chủ và danh mục mặc định.',
    tabId: 'overview',
  },
  {
    id: 'ob-site',
    title: 'Kiểm tra Banner Hero, 4 Chỉ số & Footer',
    detail:
      'Vào Trang chủ & Footer để rà soát tiêu đề song ngữ VI/EN, ảnh bìa và thông tin Trung tâm Du khách.',
    tabId: 'site',
  },
  {
    id: 'ob-content',
    title: 'Thử thêm hoặc chỉnh sửa 1 Trải nghiệm / Sự kiện',
    detail:
      'Thử tạo 1 bản nháp (tắt xuất bản), kiểm tra định dạng song ngữ rồi bật hiển thị để xem đồng bộ tức thì.',
    tabId: 'experiences',
  },
  {
    id: 'ob-leads',
    title: 'Kiểm tra Hộp thư Khách hàng & RFP',
    detail:
      'Làm quen với 2 ngăn Cẩm nang/Bản tin và Yêu cầu Hội nghị MICE cùng cách đổi trạng thái xử lý.',
    tabId: 'leads',
  },
  {
    id: 'ob-admins',
    title: 'Thêm Gmail nhân sự vào danh sách Quản trị (Super Admin)',
    detail:
      'Mở tab Quản trị viên, nhập Gmail và chọn vai trò Admin hoặc Editor để cấp quyền cho cộng tác viên.',
    tabId: 'admins',
  },
];

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    key: 'superAdmin',
    label: 'Super Admin',
    shortTitle: 'Chủ sở hữu hệ thống',
    audience: 'Tài khoản gốc (duyweb5@gmail.com)',
    summary:
      'Toàn quyền cao nhất trên toàn bộ hệ thống CMS, cơ sở dữ liệu Firestore và danh sách phân quyền nhân sự.',
    canDo: [
      'Thêm mới hoặc thu hồi quyền tài khoản Admin và Editor trong tab Quản trị viên',
      'Khởi tạo dữ liệu mẫu ban đầu và chỉnh sửa toàn bộ cấu hình Trang chủ, Hero, Footer',
      'Toàn quyền thêm, sửa, xuất bản, ẩn và xóa ở mọi module nội dung & hộp thư Khách hàng/RFP',
    ],
    cannotDo: [
      'Không thể tự xóa tài khoản Super Admin gốc khỏi hệ thống để tránh mất quyền truy cập',
    ],
    accentClass: 'text-[#C8102E]',
  },
  {
    key: 'admin',
    label: 'Admin',
    shortTitle: 'Quản trị viên vận hành',
    audience: 'Quản lý nội dung & vận hành được Super Admin cấp quyền',
    summary:
      'Quản lý trọn vẹn nội dung trang web, lịch sự kiện, danh bạ khách sạn và trực tiếp xử lý yêu cầu từ khách hàng.',
    canDo: [
      'Chỉnh sửa cấu hình Trang chủ, Hero, 4 chỉ số nổi bật, Footer và bật/tắt từng phần hiển thị',
      'Thêm, sửa, xóa, sắp xếp và xuất bản/ẩn Trải nghiệm, Khu phố, Sự kiện, Khách sạn',
      'Xem, cập nhật trạng thái xử lý và quản lý Hộp thư Khách hàng & Yêu cầu Hội nghị (RFP)',
    ],
    cannotDo: [
      'Không thấy tab Quản trị viên và không thể thêm hay thu hồi quyền tài khoản quản trị khác',
    ],
    accentClass: 'text-[#0A2239]',
  },
  {
    key: 'editor',
    label: 'Editor',
    shortTitle: 'Biên tập viên nội dung',
    audience: 'Nhân sự biên tập bài viết song ngữ Việt – Anh',
    summary:
      'Tập trung sản xuất, cập nhật nội dung song ngữ, hình ảnh, giờ mở cửa và chuẩn bị bản nháp trước khi xuất bản.',
    canDo: [
      'Biên tập bài viết song ngữ (Việt / Anh) cho Trải nghiệm, Khu phố, Sự kiện và Khách sạn',
      'Lưu ở trạng thái Bản nháp (ẩn ngoài trang chủ) để kiểm tra kỹ trước khi bật Xuất bản',
      'Cập nhật thông tin giá vé, lịch trình, địa chỉ, tàu điện MBTA và hình ảnh minh họa',
    ],
    cannotDo: [
      'Không có quyền quản lý danh sách tài khoản Quản trị viên',
      'Khuyến nghị không tự ý tắt các khối trang chủ hoặc xóa hồ sơ RFP khi chưa trao đổi với Admin',
    ],
    accentClass: 'text-[#0066B2]',
  },
  {
    key: 'member',
    label: 'Thành viên / Khách',
    shortTitle: 'Người dùng trang công khai',
    audience: 'Du khách & đối tác truy cập meetboston.duyvo.win',
    summary:
      'Khám phá nội dung đã xuất bản bằng tiếng Việt/Anh, lưu lịch trình cá nhân và gửi yêu cầu tư vấn mà không cần tài khoản.',
    canDo: [
      'Xem toàn bộ Trải nghiệm, Khu phố, Sự kiện, Khách sạn đang ở trạng thái Đã xuất bản',
      'Tìm kiếm nhanh, lọc theo danh mục, chuyển đổi ngôn ngữ VI/EN và lưu Lịch trình cá nhân',
      'Đăng ký nhận Cẩm nang Du lịch, Bản tin Footer và gửi Yêu cầu báo giá Hội nghị (RFP)',
    ],
    cannotDo: [
      'Không thể vào bảng điều khiển CMS (/admin hoặc /#admin) khi chưa được Super Admin duyệt UID',
      'Không thể đọc bản nháp hoặc dữ liệu email/RFP của người khác (bị khóa chặt ở Firestore Rules)',
    ],
    accentClass: 'text-[#526071]',
  },
];

export const ROLE_MATRIX_ROWS: RoleMatrixRow[] = [
  {
    capability: 'Xem trang chủ & nội dung đã xuất bản',
    superAdmin: 'Có',
    admin: 'Có',
    editor: 'Có',
    member: 'Có',
  },
  {
    capability: 'Lưu Lịch trình cá nhân & gửi form RFP/Cẩm nang',
    superAdmin: 'Có',
    admin: 'Có',
    editor: 'Có',
    member: 'Có',
  },
  {
    capability: 'Đăng nhập CMS (/admin hoặc /#admin)',
    superAdmin: 'Có',
    admin: 'Có',
    editor: 'Có',
    member: 'Bị chặn',
  },
  {
    capability: 'Thêm / sửa nội dung (Trải nghiệm, Khu phố, Sự kiện, KS)',
    superAdmin: 'Toàn quyền',
    admin: 'Toàn quyền',
    editor: 'Biên tập',
    member: 'Không',
  },
  {
    capability: 'Bật/tắt Ẩn – Hiện (Bản nháp / Đã xuất bản)',
    superAdmin: 'Toàn quyền',
    admin: 'Toàn quyền',
    editor: 'Có (theo quy trình)',
    member: 'Không',
  },
  {
    capability: 'Sửa Hero, Stats, Footer & Bật/tắt khối trang chủ',
    superAdmin: 'Toàn quyền',
    admin: 'Toàn quyền',
    editor: 'Chỉ xem / hạn chế',
    member: 'Không',
  },
  {
    capability: 'Xem & xử lý Hộp thư Khách hàng / RFP (PII)',
    superAdmin: 'Toàn quyền',
    admin: 'Toàn quyền',
    editor: 'Theo phân công',
    member: 'Không',
  },
  {
    capability: 'Thư viện Media (Tải ảnh, nén WebP, nhập Google Drive)',
    superAdmin: 'Toàn quyền + Xóa',
    admin: 'Toàn quyền + Xóa',
    editor: 'Tải lên & Sửa SEO',
    member: 'Không',
  },
  {
    capability: 'Quản lý 2 Ngôn ngữ VI/EN (Cấu hình, Nhãn UI, Kiểm tra song ngữ)',
    superAdmin: 'Toàn quyền',
    admin: 'Toàn quyền',
    editor: 'Sửa dịch & Rà soát',
    member: 'Không',
  },
  {
    capability: 'Thêm / thu hồi tài khoản Admin & Editor',
    superAdmin: 'Duy nhất',
    admin: 'Không',
    editor: 'Không',
    member: 'Không',
  },
];

export const GUIDE_TOPICS: GuideTopic[] = [
  {
    id: 'topic-overview',
    tabId: 'overview',
    category: 'module',
    title: 'Tổng quan & Bật/tắt nhanh khu vực trang chủ',
    subtitle: 'Kiểm soát toàn cảnh số liệu và khởi tạo dữ liệu lần đầu',
    roles: ['superAdmin', 'admin', 'editor'],
    purpose:
      'Cung cấp bức tranh tổng thể về số lượng bản ghi đang lưu trên Firestore (Trải nghiệm, Khu phố, Sự kiện, Khách sạn, Khách đăng ký, RFP) và cho phép ẩn/hiện nhanh từng phân khu của trang chủ.',
    steps: [
      'Ở lần đăng nhập đầu tiên khi cơ sở dữ liệu còn trống, bấm nút đỏ "Khởi tạo dữ liệu mẫu" ở đầu trang để nạp toàn bộ dữ liệu mặc định lên Firestore.',
      'Theo dõi 6 ô thống kê phía trên để biết tổng số mục hiện có và số yêu cầu khách hàng mới.',
      'Tại khối "Hiển thị các phần trên trang chủ", bấm nút "Đang bật / Đang ẩn" tương ứng để ẩn hoặc mở lại ngay lập tức từng phần (Khám phá, Khu phố, Sự kiện, Khách sạn, Hội nghị & MICE).',
    ],
    tips: [
      'Mọi thao tác bật/tắt khu vực sẽ lưu thẳng vào Firestore (siteConfig/main) và cập nhật thời gian thực cho toàn bộ khách đang xem web.',
      'Chỉ bấm "Khởi tạo dữ liệu mẫu" khi muốn nạp mới lúc đầu — tránh nạp đè sau khi đã chỉnh sửa nội dung riêng.',
    ],
  },
  {
    id: 'topic-site',
    tabId: 'site',
    category: 'module',
    title: 'Trang chủ, Banner Hero, Chỉ số & Footer',
    subtitle: 'Thay đổi tiêu đề lớn, ảnh bìa, 4 con số ấn tượng và thông tin liên hệ',
    roles: ['superAdmin', 'admin'],
    purpose:
      'Cho phép tùy biến toàn bộ nhận diện đầu trang (Hero) và chân trang (Footer) bằng cả Tiếng Việt và Tiếng Anh mà không cần sửa mã nguồn.',
    steps: [
      'Mở tab "Trang chủ & Footer" ở thanh menu bên trái.',
      'Cập nhật Dòng giới thiệu nhỏ (Kicker), Tiêu đề chính (Headline) và Phụ đề (Subhead) cho cả 2 cột Tiếng Việt và Tiếng Anh.',
      'Thay ảnh nền Hero bằng cách chọn 1 ảnh có sẵn trong bộ sưu tập hoặc dán trực tiếp đường dẫn URL ảnh chất lượng cao (khuyến nghị tỷ lệ ngang 16:9).',
      'Chỉnh sửa 4 chỉ số nổi bật (ví dụ: 23 Khu phố, 16 Điểm Freedom Trail...) cùng Địa chỉ, Giờ mở cửa Trung tâm Du khách và Đoạn giới thiệu Footer.',
      'Bấm nút "Lưu cấu hình trang chủ" ở góc dưới để áp dụng ngay.',
    ],
    tips: [
      'Tiêu đề Hero tiếng Việt nên giữ ngắn gọn (dưới 10–12 từ) để hiển thị đẹp trên cả màn hình máy tính lẫn điện thoại.',
      'Nếu dùng URL ảnh bên ngoài, hãy đảm bảo link bắt đầu bằng https:// và tải nhanh.',
    ],
  },
  {
    id: 'topic-experiences',
    tabId: 'experiences',
    category: 'module',
    title: 'Quản lý Trải nghiệm (Experiences)',
    subtitle: 'Thêm, sửa, phân loại điểm đến và mẹo du lịch bản địa',
    roles: ['superAdmin', 'admin', 'editor'],
    purpose:
      'Quản lý các hoạt động "Khám phá Boston" hiển thị ở phần đầu trang công khai, hỗ trợ lọc theo 4 nhóm: Lịch sử, Ẩm thực, Nghệ thuật và Ngoài trời.',
    steps: [
      'Mở tab "Trải nghiệm" → bấm "+ Thêm trải nghiệm" (hoặc biểu tượng Cây bút ở hàng cần sửa).',
      'Chọn Danh mục, nhập Thứ tự hiển thị (số nhỏ hiện trước), đánh dấu "Nổi bật" nếu muốn làm nổi bật mục này.',
      'Điền đủ nội dung song ngữ Việt – Anh: Tiêu đề, Tóm tắt ngắn (hiện trên thẻ), Mô tả chi tiết (hiện trong hộp thoại xem chi tiết) và Mẹo bản địa (Insider Tip).',
      'Cập nhật Quận/Khu vực, Thời lượng, Giờ mở cửa, Giá vé, Địa chỉ, Tuyến tàu điện MBTA và Ảnh đại diện → bấm "Lưu".',
      'Để tạm ẩn một bài chưa hoàn thiện mà không cần xóa, bấm biểu tượng Con mắt ngay trên bảng để chuyển giữa "Đã xuất bản" và "Bản nháp".',
    ],
    tips: [
      'Dùng ô tìm kiếm phía trên bảng để lọc nhanh theo tên trải nghiệm hoặc quận khi số lượng bài nhiều.',
      'Luôn kiểm tra cả 2 bản Tiếng Việt và Tiếng Anh vì khách quốc tế có thể chuyển ngôn ngữ VI/EN ngay trên trang chủ.',
    ],
  },
  {
    id: 'topic-neighborhoods',
    tabId: 'neighborhoods',
    category: 'module',
    title: 'Quản lý Khu phố (Neighborhoods)',
    subtitle: 'Cập nhật đặc trưng từng quận, điểm Walk Score và 3–5 điểm dừng gợi ý',
    roles: ['superAdmin', 'admin', 'editor'],
    purpose:
      'Quản lý mục "Khám phá theo khu phố" với bản đồ lựa chọn tương tác (Beacon Hill, Back Bay, North End, Seaport...) kèm danh sách địa điểm gợi ý của từng khu.',
    steps: [
      'Mở tab "Khu phố" → bấm "+ Thêm khu phố" hoặc bấm Sửa một khu phố hiện có.',
      'Nhập Tên khu phố, Điểm đi bộ (Walk Score từ 0 đến 100), Tuyến tàu điện MBTA, Khẩu hiệu (Tagline), Không khí (Vibe) và Mô tả chi tiết song ngữ.',
      'Tại mục "Điểm dừng nổi bật (Top Picks)", nhập từ 1 đến 5 địa điểm tiêu biểu (Tên quán/địa danh, Loại hình VI/EN, Ghi chú VI/EN).',
      'Chọn ảnh đại diện đặc trưng của khu phố, đặt Thứ tự hiển thị và bấm "Lưu".',
    ],
    tips: [
      'Nên giữ mỗi khu phố có đúng 3 điểm dừng nổi bật (Top Picks) để bố cục lưới hiển thị cân đối nhất trên trang công khai.',
      'Walk Score phải là số từ 0 đến 100 theo quy định kiểm tra dữ liệu của hệ thống.',
    ],
  },
  {
    id: 'topic-events',
    tabId: 'events',
    category: 'module',
    title: 'Quản lý Lịch Sự kiện (Events)',
    subtitle: 'Cập nhật lễ hội, triển lãm, thể thao theo tuần và theo mùa',
    roles: ['superAdmin', 'admin', 'editor'],
    purpose:
      'Quản lý lịch sự kiện thành phố Boston, giúp du khách lọc theo khung thời gian (Tuần này, Tháng này, Mùa lễ hội) và lưu sự kiện vào lịch trình cá nhân.',
    steps: [
      'Mở tab "Sự kiện" → bấm "+ Thêm sự kiện" hoặc chọn sự kiện cần cập nhật.',
      'Nhập Ngày hiển thị nổi bật (ví dụ: "18"), Nhãn tháng VI/EN (ví dụ: "Thg 11" / "Nov") và Ngày đầy đủ VI/EN.',
      'Chọn Khung thời gian (Tuần này / Tháng này / Mùa lễ hội) và Phân loại (Nghệ thuật / Thể thao / Lễ hội / Triển lãm).',
      'Điền Tiêu đề, Địa điểm tổ chức (Venue), Khu vực, Khung giờ, Giá vé, Mô tả chi tiết và Ảnh sự kiện → bấm "Lưu".',
    ],
    tips: [
      'Khi một sự kiện đã kết thúc, chỉ cần bấm biểu tượng Con mắt để chuyển sang "Bản nháp" nhằm lưu lại lịch sử thay vì xóa hẳn.',
      'Đặt Thứ tự hiển thị theo trình tự ngày diễn ra sớm nhất trước để du khách dễ theo dõi.',
    ],
  },
  {
    id: 'topic-hotels',
    tabId: 'hotels',
    category: 'module',
    title: 'Quản lý Danh bạ Khách sạn (Hotels)',
    subtitle: 'Cập nhật khách sạn đối tác, giá tham khảo và tiện ích nổi bật',
    roles: ['superAdmin', 'admin', 'editor'],
    purpose:
      'Quản lý danh sách lưu trú cao cấp theo khu vực (Back Bay, Seaport, Beacon Hill), hỗ trợ khách so sánh phong cách, mức giá đêm và lưu vào lịch trình.',
    steps: [
      'Mở tab "Khách sạn" → bấm "+ Thêm khách sạn" hoặc chỉnh sửa mục hiện có.',
      'Nhập Tên khách sạn, chọn Nhóm khu vực (Back Bay / Seaport / Beacon Hill) để bộ lọc trên trang công khai hoạt động chính xác.',
      'Nhập Giá tham khảo (USD/đêm), Điểm đánh giá (ví dụ: 4.9), Phong cách, Địa chỉ và Mô tả song ngữ.',
      'Tại ô Tiện ích (Tiếng Việt & Tiếng Anh), nhập mỗi tiện ích trên 1 dòng (tối đa 10 dòng, ví dụ: Hồ bơi nước ấm, Spa cao cấp, Gần ga Copley).',
      'Chọn ảnh phòng/khách sạn và bấm "Lưu".',
    ],
    tips: [
      'Giá phòng phải là số nguyên dương (từ 10 đến 25.000 USD) để đảm bảo hiển thị định dạng tiền tệ chuẩn.',
      'Sắp xếp các khách sạn đối tác chiến lược ở Thứ tự 1–4 để xuất hiện ngay hàng đầu.',
    ],
  },
  {
    id: 'topic-media',
    tabId: 'media',
    category: 'module',
    title: 'Thư viện Media, Upload Máy tính / Google Drive & Nén WebP chuẩn SEO',
    subtitle: 'Tối ưu dung lượng ảnh, cắt khung 16:9 / 4:3, đặt tên chuẩn SEO và xóa an toàn',
    roles: ['superAdmin', 'admin', 'editor'],
    purpose:
      'Quản lý tập trung mọi hình ảnh tải lên cho Trang chủ Hero, Trải nghiệm, Khu phố, Sự kiện và Khách sạn — tự động thu nhỏ, chuyển sang định dạng WebP siêu nhẹ và gợi ý tên file chuẩn SEO.',
    steps: [
      'Mở tab "Thư viện Media" hoặc bấm nút "Tải ảnh / Tối ưu WebP" / "Google Drive / Thư viện" ngay trong khung sửa ảnh của bất kỳ mục nào.',
      'Chọn nguồn ảnh: kéo-thả / chọn tệp / dán ảnh (Ctrl+V) từ Máy tính, hoặc chọn tab "Google Drive" → kết nối Google Drive (chỉ đọc) để nhập ảnh trực tiếp.',
      'Tại màn hình Tối ưu ảnh: chọn kích thước (Hero 1920px, Card 1200px, Nhỏ 640px), cắt khung tỷ lệ (16:9, 4:3, 1:1 hoặc Tự do), định dạng WebP và kéo thanh chất lượng để xem ngay dung lượng trước/sau.',
      'Kiểm tra Tên file chuẩn SEO tự động gợi ý (có thể bấm "Gợi ý lại tên SEO" hoặc sửa tay) và điền Alt Text song ngữ Việt – Anh → bấm "Lưu & Dùng ảnh này".',
      'Khi muốn xóa ảnh thừa (chỉ Super Admin & Admin): bấm biểu tượng Thùng rác — hệ thống sẽ tự quét và cảnh báo đích danh nếu ảnh đang được dùng ở bài viết hoặc Banner Hero nào.',
    ],
    tips: [
      'Ưu tiên giữ định dạng WebP ở chất lượng 80–84% giúp giảm 70–95% dung lượng so với ảnh gốc mà mắt thường không thấy giảm nét.',
      'Ảnh nhập từ Google Drive được tải bản sạch về nén WebP và lưu độc lập trên kho Media của web, nên không bao giờ bị lỗi chết link hoặc chặn quyền xem từ Drive.',
    ],
  },
  {
    id: 'topic-languages',
    tabId: 'languages',
    category: 'module',
    title: 'Quản lý 2 Ngôn ngữ (Tiếng Việt & English)',
    subtitle: 'Cấu hình ngôn ngữ mặc định, sửa trực tiếp mọi nhãn giao diện và kiểm tra thiếu dịch',
    roles: ['superAdmin', 'admin', 'editor'],
    purpose:
      'Quản lý tập trung toàn bộ hệ thống song ngữ VI / EN của trang web công khai lẫn giao diện quản trị: chọn ngôn ngữ mặc định, bật/tắt ngôn ngữ, tùy biến nhãn giao diện cố định và kiểm tra độ hoàn thiện dịch thuật trên mọi module.',
    steps: [
      'Mở tab "Ngôn ngữ (VI / EN)" ở thanh menu bên trái (hoặc bấm nút VI | EN ở góc trên bên phải để đổi ngôn ngữ giao diện CMS).',
      'Tab con "Cấu hình ngôn ngữ": bật/tắt Tiếng Việt hoặc English, chọn ngôn ngữ mặc định cho khách mới, bật tùy chọn tự nhận diện ngôn ngữ trình duyệt và đổi nhãn nút chuyển đổi trên Hero.',
      'Tab con "Nhãn giao diện": tìm kiếm và chỉnh sửa trực tiếp các nhãn cố định (Menu, Nút bấm, Bộ lọc, Form RFP, Bản tin, Footer) song song 2 cột VI / EN — hỗ trợ Lưu từng dòng, Lưu hàng loạt, Xuất/Nhập JSON sao lưu và Khôi phục mặc định.',
      'Tab con "Kiểm tra song ngữ": xem tiến độ hoàn thiện VI/EN theo từng module (Hero, Trải nghiệm, Khu phố, Sự kiện, Khách sạn, Alt ảnh Media), lọc các mục thiếu dịch hoặc trùng lặp VI/EN rồi bấm "Mở sửa" để nhảy thẳng vào cửa sổ biên tập.',
    ],
    tips: [
      'Hệ thống luôn giữ ít nhất 1 ngôn ngữ được bật để tránh trang công khai rơi vào trạng thái trống ngôn ngữ.',
      'Sử dụng nút "Xuất JSON" trước khi gửi bảng từ vựng cho biên dịch viên, sau đó "Nhập JSON" để cập nhật hàng loạt chỉ trong 1 lần bấm.',
    ],
  },
  {
    id: 'topic-videos',
    tabId: 'videos',
    category: 'module',
    title: 'Thư viện Video YouTube, Tự động quét Hybrid & Gemini AI Song ngữ SEO',
    subtitle: 'Bắt video mới tức thì (WebSub), lịch Cloud Scheduler hàng ngày, dịch ngữ cảnh Anh/Việt & SEO VideoObject',
    roles: ['superAdmin', 'admin', 'editor'],
    purpose:
      'Nhập toàn bộ danh sách phát (Playlist) và video từ kênh YouTube, tự động phát hiện video mới tức thì qua YouTube WebSub + quét dự phòng hàng ngày qua Cloud Scheduler, dùng Google Gemini AI chuẩn hóa song ngữ VI/EN chuyên sâu và quản lý khối CTA dưới trình phát.',
    steps: [
      'Vào tab "Thư viện Video & AI" → tab con "Đồng bộ Kênh YouTube & CTA", dán link kênh YouTube (hoặc bấm chọn nhanh kênh mẫu Lang Thang Boston) và bấm "Quét dữ liệu kênh".',
      'Chọn các chủ đề (Playlist) muốn nạp, giữ tùy chọn tự động dịch tên chủ đề bằng Gemini AI, rồi bấm "Đồng bộ vào Thư viện (Không ghi đè)".',
      'Mở tab con "Tự động hóa & Lịch quét" để bật Quét lịch hàng ngày, kích hoạt YouTube WebSub (nhận video mới trong 1–5 phút), bật Chế độ A (Tự gọi Gemini AI & Tự xuất bản), bấm "Chạy quét & gia hạn ngay" để kiểm thử và theo dõi Nhật ký chạy trực tiếp.',
      'Sang tab con "Từ điển Thuật ngữ AI" để khai báo hoặc nạp bộ thuật ngữ chuẩn (Freedom Trail, Quincy Market, Lobster Roll...) giúp AI dịch đồng nhất 100%.',
      'Quay lại "Danh sách Video", bấm "AI Tối ưu hàng loạt" hoặc mở từng video → bấm "AI Đề xuất Song ngữ & SEO (Xem trước)" để duyệt bản dịch 2 cột VI/EN, bật "Khóa chỉnh tay" để bảo vệ nội dung trong mọi lượt quét tự động sau này.',
    ],
    tips: [
      'Cơ chế đồng bộ tăng trưởng chỉ thêm video mới và không bao giờ ghi đè các video đã chỉnh tay hoặc đã tối ưu AI; nếu Gemini AI tạm hết hạn mức, video mới vẫn được lưu an toàn ở trạng thái chờ AI.',
      'Trang công khai tự động tạo liên kết sâu /videos/{slug} và bơm Schema.org VideoObject JSON-LD chuẩn SEO cho từng video.',
    ],
  },
  {
    id: 'topic-leads',
    tabId: 'leads',
    category: 'module',
    title: 'Hộp thư Khách hàng & Yêu cầu Hội nghị (Leads & RFP)',
    subtitle: 'Theo dõi đăng ký Cẩm nang, Bản tin và yêu cầu báo giá MICE',
    roles: ['superAdmin', 'admin'],
    purpose:
      'Tập trung toàn bộ thông tin khách hàng gửi từ trang công khai về một nơi bảo mật (chỉ tài khoản quản trị mới đọc được), chia làm 2 ngăn: Đăng ký Cẩm nang/Bản tin và Yêu cầu Hội nghị (RFP).',
    steps: [
      'Mở tab "Khách hàng & RFP" → chuyển đổi giữa 2 tab con: "Cẩm nang & Bản tin" và "Yêu cầu Hội nghị (RFP)".',
      'Với mỗi hồ sơ mới (trạng thái "Mới"), liên hệ phản hồi khách qua email hiển thị trong bảng.',
      'Đổi trạng thái ở cột Trạng thái để cả nhóm biết tiến độ: "Mới" → "Đang khảo sát / Đã liên hệ" → "Đã phản hồi" → "Lưu trữ".',
      'Chỉ bấm nút Thùng rác (Xóa) đối với các tin rác (spam) hoặc hồ sơ trùng lặp.',
    ],
    tips: [
      'Dữ liệu email và ghi chú RFP là thông tin cá nhân (PII), đã được khóa ở tầng máy chủ Firestore — khách công khai không thể đọc được.',
      'Kiểm tra tab này hàng ngày để không bỏ lỡ yêu cầu đặt đoàn hội nghị (MICE) quy mô lớn.',
    ],
  },
  {
    id: 'topic-admins',
    tabId: 'admins',
    category: 'module',
    title: 'Quản lý Tài khoản Quản trị & Cấp quyền bằng Gmail',
    subtitle: 'Thêm nhanh Admin/Editor chỉ bằng địa chỉ Gmail (Super Admin)',
    roles: ['superAdmin'],
    purpose:
      'Cho phép duy nhất Super Admin (duyweb5@gmail.com) cấp quyền trước cho cộng tác viên chỉ bằng địa chỉ Gmail (không cần hỏi mã UID trước) hoặc thu hồi quyền ngay lập tức.',
    steps: [
      'Super Admin mở tab "Quản trị viên" ở thanh menu bên trái.',
      'Nhập Email Google của cộng tác viên (VD: nhanvien@gmail.com), Tên hiển thị và chọn vai trò (Quản trị viên Admin hoặc Biên tập viên Editor). Ô Firebase UID có thể để trống.',
      'Bấm "Thêm quản trị viên" → hệ thống tự động lưu quyền theo Gmail đã xác thực trên Firestore.',
      'Gửi link https://meetboston.duyvo.win/#admin (hoặc /admin) cho cộng tác viên → họ đăng nhập Google bằng đúng Gmail đó là vào làm việc ngay. Khi cần thu hồi quyền, bấm biểu tượng Thùng rác bên cạnh tài khoản.',
    ],
    tips: [
      'Người dùng bắt buộc đăng nhập bằng đúng tài khoản Google đã xác thực email (email_verified = true) mới vượt qua lớp bảo mật Firestore Rules.',
      'Nếu đăng nhập Google trên tên miền riêng gặp lỗi "unauthorized-domain", vào Firebase Console → Authentication → Settings → Authorized domains và thêm meetboston.duyvo.win.',
      'Admin phụ và Editor sẽ không thấy tab Quản trị viên và không thể tự ý thêm hoặc xóa tài khoản khác.',
    ],
  },
  {
    id: 'topic-workflow',
    category: 'workflow',
    title: 'Checklist xuất bản chuẩn & Xử lý sự cố nhanh',
    subtitle: '4 bước kiểm tra trước khi đăng bài và cách xử lý lỗi phổ biến',
    roles: ['superAdmin', 'admin', 'editor', 'member'],
    purpose:
      'Đảm bảo chất lượng nội dung song ngữ đồng bộ, hình ảnh sắc nét và khắc phục nhanh các tình huống thường gặp khi vận hành thực tế.',
    steps: [
      'Checklist 1 – Song ngữ: Kiểm tra đã điền đủ cả 2 cột Tiếng Việt và Tiếng Anh, không để sót lỗi chính tả.',
      'Checklist 2 – Hình ảnh: Đảm bảo ảnh hiển thị rõ nét, không bị vỡ link (có thể chọn nhanh từ bộ ảnh chuẩn Boston có sẵn).',
      'Checklist 3 – Xuất bản có kiểm soát: Khi đang soạn dở, tắt chế độ "Đã xuất bản" (để ở Bản nháp); khi hoàn tất mới bật hiển thị.',
      'Checklist 4 – Kiểm tra thực tế: Bấm nút "Xem trang web" ở góc trên bên phải để kiểm tra hiển thị trực tiếp ngoài trang công khai (cả bản VI và EN).',
    ],
    tips: [
      'Đã cập nhật code mới nhưng trang web tên miền riêng vẫn hiện bản cũ? Hãy kiểm tra Cloud Run đã deploy revision mới chưa và xóa cache Cloudflare (Purge Everything) rồi bấm Ctrl + Shift + R.',
      'Gặp lỗi không lưu được? Kiểm tra lại độ dài ký tự (không vượt giới hạn), định dạng email/URL, hoặc đăng xuất rồi đăng nhập lại Google để làm mới phiên xác thực.',
    ],
  },
];
