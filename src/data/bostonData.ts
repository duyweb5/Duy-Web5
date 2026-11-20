export type Language = 'vi' | 'en';

export type ExperienceCategory = 'history' | 'dining' | 'arts' | 'outdoors';

export type SavedItemType = 'experience' | 'event' | 'hotel' | 'neighborhood' | 'video';

export interface SavedItineraryItem {
  id: string;
  type: SavedItemType;
  day: 1 | 2 | 3;
  title: { vi: string; en: string };
  subtitle: { vi: string; en: string };
  district: string;
  image: string;
}

export interface ExperienceItem {
  id: string;
  category: ExperienceCategory;
  featured?: boolean;
  title: { vi: string; en: string };
  summary: { vi: string; en: string };
  description: { vi: string; en: string };
  insiderTip: { vi: string; en: string };
  district: string;
  duration: { vi: string; en: string };
  hours: string;
  price: { vi: string; en: string };
  address: string;
  transit: string;
  image: string;
}

export interface NeighborhoodItem {
  id: string;
  name: string;
  tagline: { vi: string; en: string };
  description: { vi: string; en: string };
  transit: string;
  vibe: { vi: string; en: string };
  walkScore: number;
  image: string;
  topPicks: {
    name: string;
    category: { vi: string; en: string };
    note: { vi: string; en: string };
  }[];
}

export interface EventItem {
  id: string;
  dayNum: string;
  monthLabel: { vi: string; en: string };
  fullDate: { vi: string; en: string };
  timeframe: 'week' | 'month' | 'holiday';
  category: 'arts' | 'sports' | 'festival' | 'exhibition';
  title: { vi: string; en: string };
  venue: string;
  district: string;
  time: string;
  price: { vi: string; en: string };
  description: { vi: string; en: string };
  image: string;
}

export interface HotelItem {
  id: string;
  name: string;
  district: string;
  neighborhoodKey: 'back-bay' | 'seaport' | 'beacon-hill';
  style: { vi: string; en: string };
  rateUsd: number;
  rating: string;
  summary: { vi: string; en: string };
  description: { vi: string; en: string };
  address: string;
  amenities: { vi: string[]; en: string[] };
  image: string;
}

export const IMAGES = {
  heroSkyline: '/src/assets/images/hero_boston_skyline_1795161959745.jpg',
  beaconHill: '/src/assets/images/boston_beacon_hill_1795161959872.jpg',
  seaport: '/src/assets/images/boston_seaport_waterfront_1795161959708.jpg',
  northEndDining: '/src/assets/images/boston_north_end_dining_1795161960438.jpg',
  freedomTrail: '/src/assets/images/boston_freedom_trail_culture_1795161960112.jpg',
  luxuryHotel: '/src/assets/images/boston_luxury_hotel_1795161960073.jpg',
} as const;

export const EXPERIENCES: ExperienceItem[] = [
  {
    id: 'exp-freedom-trail',
    category: 'history',
    featured: true,
    title: {
      vi: 'Con đường Tự do — The Freedom Trail',
      en: 'The Freedom Trail',
    },
    summary: {
      vi: 'Tuyến đi bộ gạch đỏ dài 4 km kết nối 16 di tích cách mạng Hoa Kỳ từ Boston Common đến Charlestown.',
      en: 'A 2.5-mile red-brick walking path linking 16 landmark Revolutionary sites from Boston Common to Charlestown.',
    },
    description: {
      vi: 'Lần theo đường gạch đỏ lát trên vỉa hè qua trung tâm Boston, bạn sẽ đi qua Tòa nhà Bang cổ (Old State House), Nhà thờ Old North, Chợ Faneuil Hall và chiến hạm lịch sử USS Constitution. Sự tương phản giữa kiến trúc gạch đỏ thế kỷ 18 và các tòa tháp kính hiện đại tạo nên bản sắc độc nhất của Boston.',
      en: 'Follow the signature red-brick line painted and inlaid across downtown sidewalks past the Old State House, Old North Church, Faneuil Hall, and the USS Constitution. The contrast of 18th-century colonial brick against glass skyscrapers defines Boston.',
    },
    insiderTip: {
      vi: 'Bắt đầu lúc 9:00 sáng tại Trung tâm Du khách Boston Common để nhận bản đồ in và tránh đông đúc tại Chợ Quincy vào giờ trưa.',
      en: 'Start at 9:00 AM at the Boston Common Visitor Center to pick up a printed walking map and beat midday crowds at Quincy Market.',
    },
    district: 'Downtown & North End',
    duration: { vi: '2,5 – 3 giờ', en: '2.5 – 3 hours' },
    hours: '09:00 – 17:00',
    price: { vi: 'Miễn phí tự đi bộ · Tour $17', en: 'Self-guided Free · Guided $17' },
    address: '139 Tremont St, Boston, MA 02111',
    transit: 'MBTA Green / Red Line · Park Street',
    image: IMAGES.freedomTrail,
  },
  {
    id: 'exp-north-end-culinary',
    category: 'dining',
    title: {
      vi: 'Hành trình Ẩm thực North End & Hải sản New England',
      en: 'North End Trattorias & New England Raw Bars',
    },
    summary: {
      vi: 'Thưởng thức bánh mì tôm hùm bơ nóng, hàu tươi vịnh Cape Cod và mì Ý thủ công trên phố Hanover.',
      en: 'Savor warm butter-poached lobster rolls, chilled Cape Cod oysters, and handmade pasta along Hanover Street.',
    },
    description: {
      vi: 'Khu phố lâu đời nhất Boston là thiên đường của hơn 80 nhà hàng Ý gia truyền và các quầy hải sản trứ danh như Neptune Oyster. Kết thúc buổi tối bằng một tách espresso và bánh cannoli giòn rụm tại những tiệm bánh mở cửa từ thập niên 1930.',
      en: 'Boston’s oldest residential neighborhood houses over 80 family-run Italian trattorias and celebrated raw bars like Neptune Oyster. Finish the evening with espresso and crisp ricotta cannoli from heritage bakeries.',
    },
    insiderTip: {
      vi: 'Nhiều nhà hàng cổ điển ở North End không nhận đặt bàn trước; hãy ghé quầy lúc 11:30 hoặc sau 16:30 để có chỗ ngồi gần cửa sổ.',
      en: 'Several classic North End spots are walk-in only; arrive around 11:30 AM or 4:30 PM to snag a prime marble counter seat.',
    },
    district: 'North End',
    duration: { vi: '2 giờ', en: '2 hours' },
    hours: '11:30 – 22:30',
    price: { vi: '$35 – $75 / khách', en: '$35 – $75 / guest' },
    address: 'Hanover St & Salem St, Boston, MA 02113',
    transit: 'MBTA Green / Orange Line · Haymarket',
    image: IMAGES.northEndDining,
  },
  {
    id: 'exp-seaport-ica',
    category: 'arts',
    title: {
      vi: 'Bến cảng Seaport & Viện Nghệ thuật Đương đại (ICA)',
      en: 'Seaport Harborwalk & ICA Boston',
    },
    summary: {
      vi: 'Kiến trúc gỗ kính vươn ra mặt vịnh, không gian triển lãm đương đại và đường dạo ven biển lúc hoàng hôn.',
      en: 'Cantilevered glass-and-timber galleries overlooking Boston Harbor, paired with twilight boardwalk dining.',
    },
    description: {
      vi: 'Khu Seaport đại diện cho Boston thế kỷ 21: năng động, hướng biển và giàu tính sáng tạo. Tâm điểm là Viện Nghệ thuật Đương đại (ICA) với phòng trưng bày hướng thẳng ra vịnh Boston, nối liền với tuyến đi bộ Harborwalk và các không gian ẩm thực ven nước.',
      en: 'The Seaport District showcases 21st-century Boston: coastal, architectural, and energetic. Anchored by the Institute of Contemporary Art (ICA), the waterfront connects gallery hopping with harbor ferries and open-air pavilions.',
    },
    insiderTip: {
      vi: 'Vào tối thứ Năm hàng tuần (17:00 – 21:00), ICA mở cửa miễn phí vé vào cổng kèm các buổi trò chuyện nghệ thuật bên vịnh.',
      en: 'Every Thursday evening from 5:00 to 9:00 PM, ICA offers complimentary admission alongside waterfront talks.',
    },
    district: 'Seaport District',
    duration: { vi: '2 – 3 giờ', en: '2 – 3 hours' },
    hours: '10:00 – 17:00 (Thứ 5 đến 21:00)',
    price: { vi: '$20 · Thứ 5 tối miễn phí', en: '$20 · Free Thu Nights' },
    address: '25 Harbor Shore Dr, Boston, MA 02210',
    transit: 'MBTA Silver Line · Courthouse',
    image: IMAGES.seaport,
  },
  {
    id: 'exp-beacon-hill-walk',
    category: 'outdoors',
    title: {
      vi: 'Dạo bước phố đá cuội Beacon Hill & Public Garden',
      en: 'Beacon Hill Cobblestones & Public Garden',
    },
    summary: {
      vi: 'Ngắm đèn khí đốt cổ trên phố Acorn, mua sách cũ trên phố Charles và ngắm thiên nga tại công viên thực vật lâu đời nhất nước Mỹ.',
      en: 'Wander gas-lit Acorn Street, browse Charles Street antiques, and relax beside America’s first botanical garden.',
    },
    description: {
      vi: 'Chỉ cách trung tâm tài chính vài phút đi bộ, Beacon Hill lưu giữ vẻ đẹp yên bình với những dãy nhà gạch đỏ thế kỷ 19, hàng rào sắt rèn và đèn khí đốt thắp sáng mỗi chiều. Ngay chân đồi là Boston Public Garden rợp bóng cây liễu.',
      en: 'Steps from downtown, Beacon Hill preserves quiet 19th-century charm with Federal-style rowhouses, ironwork balconies, and brass gas lamps. Right below lies the willow-shaded lagoon of Boston Public Garden.',
    },
    insiderTip: {
      vi: 'Thời điểm chụp ảnh đẹp nhất trên phố Acorn là 15:30 – 16:45 khi nắng xiên chạm vào dãy gạch đỏ và đèn khí đốt bắt đầu lên ánh vàng.',
      en: 'Visit Acorn Street between 3:30 and 4:45 PM when low afternoon sunlight warms the brick facades and gas lamps glow.',
    },
    district: 'Beacon Hill',
    duration: { vi: '1,5 giờ', en: '1.5 hours' },
    hours: 'Mở cửa cả ngày',
    price: { vi: 'Miễn phí', en: 'Free' },
    address: 'Acorn St & Charles St, Boston, MA 02108',
    transit: 'MBTA Red Line · Charles/MGH',
    image: IMAGES.beaconHill,
  },
  {
    id: 'exp-charles-river-sail',
    category: 'outdoors',
    title: {
      vi: 'Du thuyền hoàng hôn trên sông Charles & Esplanade',
      en: 'Charles River Golden Hour & Esplanade',
    },
    summary: {
      vi: 'Chiêm ngưỡng đường chân trời Back Bay và Cambridge từ mặt sông lộng gió hoặc đạp xe dọc công viên Esplanade.',
      en: 'Take in Back Bay and Cambridge skylines from the water or cycle along the leafy Charles River Esplanade.',
    },
    description: {
      vi: 'Dải công viên Esplanade dài 5 km uốn lượn dọc bờ sông Charles là nơi người dân Boston chạy bộ, chèo thuyền buồm và lắng nghe hòa nhạc ngoài trời tại Hatch Shell. Hoàng hôn phản chiếu lên những dãy nhà nâu Back Bay tạo nên khung cảnh biểu tượng của thành phố.',
      en: 'The 3-mile Esplanade riverfront park is Boston’s living room for sailing, cycling, and open-air concerts at the Hatch Shell, offering sweeping views of Back Bay brownstones and Cambridge bridges.',
    },
    insiderTip: {
      vi: 'Cầu bộ hành Arthur Fiedler nối từ Beacon Street ra thẳng bến thuyền Community Boating — địa điểm ngắm hoàng hôn rộng nhất sông Charles.',
      en: 'Cross the Arthur Fiedler Footbridge from Beacon Street directly to Community Boating docks for uninterrupted sunset views.',
    },
    district: 'Back Bay & Esplanade',
    duration: { vi: '1,5 – 2 giờ', en: '1.5 – 2 hours' },
    hours: '06:00 – 22:00',
    price: { vi: 'Miễn phí · Thuyền từ $28', en: 'Park Free · Cruises from $28' },
    address: 'Storrow Dr & David G. Mugar Way, Boston',
    transit: 'MBTA Green Line · Arlington',
    image: IMAGES.heroSkyline,
  },
];

export const NEIGHBORHOODS: NeighborhoodItem[] = [
  {
    id: 'nb-back-bay',
    name: 'Back Bay',
    tagline: {
      vi: 'Đại lộ Victorian, thời trang phố Newbury và kiến trúc quảng trường Copley',
      en: 'Victorian brownstones, Newbury Street boutiques, and Copley Square architecture',
    },
    description: {
      vi: 'Nổi tiếng với những hàng nhà gạch nâu thế kỷ 19 thẳng tắp dọc đại lộ Commonwealth, Back Bay hội tụ Thư viện Công cộng Boston, Nhà thờ Trinity và thiên đường mua sắm Newbury Street.',
      en: 'Celebrated for symmetrical 19th-century brownstones along Commonwealth Avenue Mall, Back Bay unites the Boston Public Library, Trinity Church, and eight blocks of Newbury Street shopping.',
    },
    transit: 'MBTA Green Line · Copley / Arlington',
    vibe: { vi: 'Thanh lịch · Kiến trúc · Mua sắm', en: 'Refined · Architecture · Shopping' },
    walkScore: 98,
    image: IMAGES.luxuryHotel,
    topPicks: [
      {
        name: 'Boston Public Library Courtyard',
        category: { vi: 'Kiến trúc', en: 'Architecture' },
        note: { vi: 'Phòng đọc Bates Hall và sân trong phong cách Phục Hưng Ý', en: 'Bates Hall reading room and Italianate courtyard' },
      },
      {
        name: 'Newbury Street',
        category: { vi: 'Mua sắm & Cà phê', en: 'Shopping & Cafés' },
        note: { vi: '8 khu phố cửa hàng thiết kế và quán cà phê ngoài trời', en: 'Eight blocks of independent boutiques and patio cafés' },
      },
      {
        name: 'View Boston (Prudential Tower)',
        category: { vi: 'Toàn cảnh 360°', en: '360° Observation' },
        note: { vi: 'Đài quan sát tầng 52 nhìn trọn sông Charles và vịnh Boston', en: '52nd-floor observation deck overlooking river and harbor' },
      },
    ],
  },
  {
    id: 'nb-beacon-hill',
    name: 'Beacon Hill',
    tagline: {
      vi: 'Phố đá cuội thắp đèn khí đốt và di sản lịch sử giữa lòng đô thị',
      en: 'Gas-lit cobblestone lanes and timeless Federal-era heritage',
    },
    description: {
      vi: 'Khu phố lịch sử yên tĩnh bậc nhất Boston với Tòa nhà Quốc hội bang Massachusetts mái vòm vàng, con phố Acorn nhỏ nhắn và hàng chục cửa hàng đồ cổ dọc Charles Street.',
      en: 'Boston’s most photographed historic hillside, crowned by the gold-domed Massachusetts State House, narrow Acorn Street, and independent shops along Charles Street.',
    },
    transit: 'MBTA Red Line · Charles/MGH',
    vibe: { vi: 'Cổ điển · Yên bình · Nhiếp ảnh', en: 'Historic · Intimate · Photogenic' },
    walkScore: 99,
    image: IMAGES.beaconHill,
    topPicks: [
      {
        name: 'Acorn Street',
        category: { vi: 'Di sản', en: 'Landmark' },
        note: { vi: 'Con hẻm lát đá cuội cổ kính thế kỷ 19 còn nguyên vẹn', en: 'Preserved 19th-century cobblestone lane with gas lamps' },
      },
      {
        name: 'Charles Street',
        category: { vi: 'Đời sống bản địa', en: 'Local Life' },
        note: { vi: 'Tiệm hoa, hiệu sách Beacon Hill Books và tiệm bánh ngọt', en: 'Florists, Beacon Hill Books, and neighborhood bakeries' },
      },
      {
        name: 'Museum of African American History',
        category: { vi: 'Bảo tàng', en: 'Museum' },
        note: { vi: 'Nhà hội họp Châu Phi lịch sử năm 1806 trên đường Di sản Đen', en: 'Historic 1806 African Meeting House along the Black Heritage Trail' },
      },
    ],
  },
  {
    id: 'nb-seaport',
    name: 'Seaport District',
    tagline: {
      vi: 'Bến cảng hiện đại, nghệ thuật đương đại và ẩm thực ven vịnh',
      en: 'Contemporary harborwalk, bold architecture, and waterfront dining',
    },
    description: {
      vi: 'Khu đô thị ven biển phát triển nhanh nhất Boston, kết hợp các tòa nhà kính hiện đại, triển lãm ngoài trời, bến phà ra đảo và không gian ẩm thực sôi động về đêm.',
      en: 'Boston’s newest waterfront neighborhood blending modern glass pavilions, public art installations, harbor ferries, and vibrant evening dining along the water.',
    },
    transit: 'MBTA Silver Line · Courthouse / World Trade Center',
    vibe: { vi: 'Hiện đại · Ven biển · Sáng tạo', en: 'Modern · Waterfront · Creative' },
    walkScore: 92,
    image: IMAGES.seaport,
    topPicks: [
      {
        name: 'ICA Boston',
        category: { vi: 'Nghệ thuật', en: 'Art' },
        note: { vi: 'Viện nghệ thuật đương đại với ban công nhìn ra cảng Boston', en: 'Contemporary museum cantilevered directly above the harbor' },
      },
      {
        name: 'Harborwalk Promenade',
        category: { vi: 'Dạo bộ', en: 'Promenade' },
        note: { vi: 'Đường gỗ ven vịnh lý tưởng để ngắm ánh đèn đường chân trời', en: 'Illuminated timber boardwalk facing the downtown skyline' },
      },
      {
        name: 'Snowport & Seaport Common',
        category: { vi: 'Không gian công cộng', en: 'Public Space' },
        note: { vi: 'Chợ thủ công theo mùa và sự kiện ngoài trời quanh năm', en: 'Seasonal makers markets and year-round open-air gatherings' },
      },
    ],
  },
  {
    id: 'nb-north-end',
    name: 'North End',
    tagline: {
      vi: 'Tiểu nước Ý giàu hương vị với 400 năm lịch sử bên bờ cảng',
      en: 'Boston’s Little Italy with four centuries of waterfront history',
    },
    description: {
      vi: 'Những con phố nhỏ uốn lượn mang dấu ấn kiến trúc châu Âu, nơi nhà của Paul Revere nằm kề bên các tiệm bánh ngọt, quán mì Ý thơm lừng và công viên xanh Rose Kennedy Greenway.',
      en: 'Winding European-scale streets where Paul Revere’s 1680 home sits minutes from family-owned trattorias, espresso bars, and the Rose Kennedy Greenway.',
    },
    transit: 'MBTA Green / Orange Line · Haymarket / North Station',
    vibe: { vi: 'Ẩm thực · Sôi nổi · Truyền thống', en: 'Culinary · Lively · Heritage' },
    walkScore: 99,
    image: IMAGES.northEndDining,
    topPicks: [
      {
        name: 'Hanover & Salem Street',
        category: { vi: 'Ẩm thực', en: 'Dining' },
        note: { vi: 'Tập trung nhà hàng hải sản, salumeria và tiệm bánh Ý cổ truyền', en: 'Dense cluster of raw bars, salumerias, and pastry shops' },
      },
      {
        name: 'Old North Church',
        category: { vi: 'Lịch sử', en: 'History' },
        note: { vi: 'Ngọn tháp đèn lồng nổi tiếng năm 1775 của cách mạng Mỹ', en: 'Iconic 1775 lantern steeple of American independence' },
      },
      {
        name: 'Christopher Columbus Waterfront Park',
        category: { vi: 'Công viên', en: 'Park' },
        note: { vi: 'Giàn hoa hồng ven vịnh với tầm nhìn thẳng ra cầu cảng Long Wharf', en: 'Harborfront trellis overlooking Long Wharf ferries' },
      },
    ],
  },
  {
    id: 'nb-downtown',
    name: 'Downtown & Waterfront',
    tagline: {
      vi: 'Giao điểm giữa lịch sử thuộc địa và nhịp sống trung tâm tài chính',
      en: 'Where colonial history meets the harbor and financial skyline',
    },
    description: {
      vi: 'Trái tim kết nối mọi tuyến tàu điện ngầm của Boston: từ công viên lâu đời nhất Hoa Kỳ Boston Common, khu chợ lịch sử Faneuil Hall đến Thủy cung New England bên cầu cảng.',
      en: 'The civic core connecting every transit line, spanning America’s oldest public park, Faneuil Hall Marketplace, the Rose Kennedy Greenway, and the New England Aquarium.',
    },
    transit: 'MBTA Red / Green / Orange / Blue Lines',
    vibe: { vi: 'Nhộn nhịp · Lịch sử · Trung tâm', en: 'Energetic · Historic · Central' },
    walkScore: 100,
    image: IMAGES.freedomTrail,
    topPicks: [
      {
        name: 'Old State House',
        category: { vi: 'Di tích', en: 'Historic Site' },
        note: { vi: 'Công trình gạch đỏ năm 1713 nổi bật giữa các tòa cao ốc kính', en: '1713 brick civic landmark framed by modern skyscrapers' },
      },
      {
        name: 'Faneuil Hall & Quincy Market',
        category: { vi: 'Chợ & Ẩm thực', en: 'Market' },
        note: { vi: 'Súp nghêu New England và các nghệ sĩ biểu diễn đường phố', en: 'New England clam chowder halls and street performers' },
      },
      {
        name: 'Rose Kennedy Greenway',
        category: { vi: 'Công viên tuyến tính', en: 'Linear Park' },
        note: { vi: 'Vườn nghệ thuật công cộng, vòng quay gỗ và xe ẩm thực địa phương', en: 'Public art gardens, carousel, and local food trucks' },
      },
    ],
  },
  {
    id: 'nb-cambridge',
    name: 'Cambridge & Riverfront',
    tagline: {
      vi: 'Quảng trường Harvard, không gian tri thức MIT và bờ sông lộng gió',
      en: 'Harvard Square, MIT innovation corridors, and breezy river views',
    },
    description: {
      vi: 'Chỉ cách trung tâm Boston một cây cầu bắc qua sông Charles, Cambridge hòa quyện khuôn viên đại học cổ kính, hiệu sách độc lập, bảo tàng miễn phí và các phòng trà nhạc acoustic.',
      en: 'Just across the Charles River bridges, Cambridge blends centuries-old university quads, independent bookshops, free art museums, and lively live-music clubs.',
    },
    transit: 'MBTA Red Line · Harvard / Kendall-MIT',
    vibe: { vi: 'Học thuật · Sách · Ven sông', en: 'Academic · Literary · Riverfront' },
    walkScore: 95,
    image: IMAGES.heroSkyline,
    topPicks: [
      {
        name: 'Harvard Yard & Harvard Art Museums',
        category: { vi: 'Văn hóa', en: 'Culture' },
        note: { vi: 'Khuôn viên đại học lâu đời nhất nước Mỹ và bảo tàng mở cửa miễn phí', en: 'America’s oldest university quad and free admission museum' },
      },
      {
        name: 'Brattle Book & Harvard Book Store',
        category: { vi: 'Hiệu sách', en: 'Bookshops' },
        note: { vi: 'Các hiệu sách độc lập giàu truyền thống với tọa đàm tác giả hàng tuần', en: 'Storied independent bookshops hosting weekly author talks' },
      },
      {
        name: 'Memorial Drive Riverwalk',
        category: { vi: 'Ngắm cảnh', en: 'Scenic View' },
        note: { vi: 'Góc nhìn toàn cảnh đường chân trời Back Bay đẹp nhất thành phố', en: 'Unrivaled panoramic views of the Back Bay skyline' },
      },
    ],
  },
];

export const EVENTS: EventItem[] = [
  {
    id: 'evt-snowport',
    dayNum: '22',
    monthLabel: { vi: 'THG 11', en: 'NOV' },
    fullDate: { vi: '22 Tháng 11, 2026', en: 'November 22, 2026' },
    timeframe: 'week',
    category: 'festival',
    title: {
      vi: 'Lễ hội Mùa đông Snowport & Chợ Thủ công Seaport',
      en: 'Snowport Winter Market at Boston Seaport',
    },
    venue: '100 Seaport Blvd · Harbor Way',
    district: 'Seaport District',
    time: '11:00 – 20:00',
    price: { vi: 'Miễn phí vào cổng', en: 'Free Admission' },
    description: {
      vi: 'Hơn 120 gian hàng thủ công mỹ nghệ bản địa, ẩm thực mùa đông New England, sân chơi curling ngoài trời và vườn cây thông thắp sáng bên bờ vịnh Boston.',
      en: 'Over 120 local makers chalets, New England winter treats, iceless curling lanes, and an illuminated evergreen tree market by Boston Harbor.',
    },
    image: IMAGES.seaport,
  },
  {
    id: 'evt-celtics-td',
    dayNum: '25',
    monthLabel: { vi: 'THG 11', en: 'NOV' },
    fullDate: { vi: '25 Tháng 11, 2026', en: 'November 25, 2026' },
    timeframe: 'week',
    category: 'sports',
    title: {
      vi: 'Bóng rổ NBA: Boston Celtics gặp New York Knicks',
      en: 'Boston Celtics vs. New York Knicks at TD Garden',
    },
    venue: 'TD Garden · 100 Legends Way',
    district: 'West End / North Station',
    time: '19:30 – 22:00',
    price: { vi: 'Từ $89', en: 'From $89' },
    description: {
      vi: 'Hòa mình vào bầu không khí thể thao cuồng nhiệt bậc nhất nước Mỹ trên sàn gỗ parquet huyền thoại của nhà vô địch Boston Celtics ngay trên ga North Station.',
      en: 'Experience Boston’s electric sports culture on the legendary parquet floor at TD Garden, steps away from North End pre-game dining.',
    },
    image: IMAGES.heroSkyline,
  },
  {
    id: 'evt-bso-symphony',
    dayNum: '28',
    monthLabel: { vi: 'THG 11', en: 'NOV' },
    fullDate: { vi: '28 Tháng 11, 2026', en: 'November 28, 2026' },
    timeframe: 'month',
    category: 'arts',
    title: {
      vi: 'Đêm Giao hưởng Cuối thu cùng Dàn nhạc Boston Symphony',
      en: 'Boston Symphony Orchestra Autumn Masterworks',
    },
    venue: 'Symphony Hall · 301 Massachusetts Ave',
    district: 'Back Bay',
    time: '20:00 – 22:15',
    price: { vi: 'Từ $45', en: 'From $45' },
    description: {
      vi: 'Thưởng thức âm học tinh túy tại một trong ba khán phòng giao hưởng tốt nhất thế giới với tác phẩm của Dvořák và Rachmaninoff.',
      en: 'Hear Dvořák and Rachmaninoff performed inside one of the world’s top three acoustically ranked concert halls.',
    },
    image: IMAGES.luxuryHotel,
  },
  {
    id: 'evt-common-lighting',
    dayNum: '03',
    monthLabel: { vi: 'THG 12', en: 'DEC' },
    fullDate: { vi: '03 Tháng 12, 2026', en: 'December 3, 2026' },
    timeframe: 'holiday',
    category: 'festival',
    title: {
      vi: 'Lễ Thắp sáng Cây thông Giáng sinh Boston Common lần thứ 85',
      en: '85th Annual Boston Common Tree Lighting',
    },
    venue: 'Boston Common · Visitor Center Lawn',
    district: 'Downtown & Beacon Hill',
    time: '18:00 – 20:00',
    price: { vi: 'Miễn phí', en: 'Free' },
    description: {
      vi: 'Truyền thống lịch sử từ năm 1941 với cây thông do tỉnh Nova Scotia trao tặng, đi kèm hòa nhạc trực tiếp, sân trượt băng Frog Pond và pháo hoa tầm thấp.',
      en: 'A beloved civic tradition since 1941 celebrating the Nova Scotia gift tree, complete with live music, Frog Pond skating, and lights across the park.',
    },
    image: IMAGES.beaconHill,
  },
  {
    id: 'evt-ica-exhibition',
    dayNum: '06',
    monthLabel: { vi: 'THG 12', en: 'DEC' },
    fullDate: { vi: '06 Tháng 12, 2026', en: 'December 6, 2026' },
    timeframe: 'month',
    category: 'exhibition',
    title: {
      vi: 'Triển lãm Kiến trúc Hàng hải & Ánh sáng Đương đại',
      en: 'Coastal Light & Architecture Exhibition at ICA',
    },
    venue: 'Institute of Contemporary Art · 25 Harbor Shore Dr',
    district: 'Seaport District',
    time: '10:00 – 17:00',
    price: { vi: '$20 · Dưới 18 tuổi miễn phí', en: '$20 · Under 18 Free' },
    description: {
      vi: 'Khám phá hơn 40 tác phẩm sắp đặt ánh sáng và mô hình kiến trúc đô thị ven biển của các nghệ sĩ Bắc Mỹ và châu Âu.',
      en: 'Explore over 40 luminous installations and architectural works examining coastal cities and waterfront heritage.',
    },
    image: IMAGES.seaport,
  },
  {
    id: 'evt-tea-party',
    dayNum: '16',
    monthLabel: { vi: 'THG 12', en: 'DEC' },
    fullDate: { vi: '16 Tháng 12, 2026', en: 'December 16, 2026' },
    timeframe: 'holiday',
    category: 'arts',
    title: {
      vi: 'Tái hiện Sự kiện Tiệc Trà Boston (Boston Tea Party 253 năm)',
      en: '253rd Boston Tea Party Annual Reenactment',
    },
    venue: 'Old South Meeting House → Griffin’s Wharf',
    district: 'Downtown & Waterfront',
    time: '18:30 – 20:30',
    price: { vi: 'Xem diễu hành miễn phí', en: 'Procession Viewing Free' },
    description: {
      vi: 'Hơn 100 diễn viên lịch sử tái hiện cuộc tranh luận tại Old South Meeting House và đoàn rước đuốc ra cầu cảng Griffin’s Wharf.',
      en: 'Over 100 historical actors recreate the 1773 debate at Old South Meeting House followed by a lantern-lit procession to Griffin’s Wharf.',
    },
    image: IMAGES.freedomTrail,
  },
];

export const HOTELS: HotelItem[] = [
  {
    id: 'htl-newbury',
    name: 'The Newbury Boston',
    district: 'Back Bay',
    neighborhoodKey: 'back-bay',
    style: { vi: 'Di sản Sang trọng', en: 'Heritage Luxury' },
    rateUsd: 465,
    rating: '4.9',
    summary: {
      vi: 'Tầm nhìn trực diện công viên Public Garden, nội thất cửa vòm cổ điển và nhà hàng rooftop Contessa.',
      en: 'Direct views over Boston Public Garden, arched architectural suites, and rooftop dining at Contessa.',
    },
    description: {
      vi: 'Tọa lạc tại giao lộ vàng giữa phố Newbury và công viên Public Garden từ năm 1927, The Newbury kết hợp vẻ thanh lịch cổ điển của Boston với tiện nghi đương đại và phòng có lò sưởi gỗ.',
      en: 'Standing at the corner of Newbury and Arlington Streets since 1927, The Newbury pairs residential Back Bay elegance with wood-burning fireplace suites and rooftop panoramic dining.',
    },
    address: '1 Newbury St, Boston, MA 02116',
    amenities: {
      vi: ['Nhìn ra Public Garden', 'Nhà hàng Rooftop Contessa', 'Dịch vụ Concierge 24/7'],
      en: ['Public Garden Views', 'Contessa Rooftop', '24/7 Concierge'],
    },
    image: IMAGES.luxuryHotel,
  },
  {
    id: 'htl-envoy',
    name: 'The Envoy Hotel, Autograph Collection',
    district: 'Seaport District',
    neighborhoodKey: 'seaport',
    style: { vi: 'Boutique Ven cảng', en: 'Waterfront Boutique' },
    rateUsd: 340,
    rating: '4.8',
    summary: {
      vi: 'Thiết kế kính hiện đại bên bến cảng với Lookout Rooftop ngắm toàn cảnh trung tâm Boston.',
      en: 'Modern glass-fronted waterfront rooms crowned by Lookout Rooftop facing the downtown skyline.',
    },
    description: {
      vi: 'Nằm ngay tuyến đi bộ Harborwalk và chỉ vài bước chân tới Viện Nghệ thuật ICA, The Envoy mang tinh thần sáng tạo của Seaport với cửa sổ kính kịch trần và không gian lounge ven nước.',
      en: 'Positioned right along the Harborwalk minutes from the ICA, The Envoy reflects Seaport’s contemporary energy with floor-to-ceiling harbor views and an iconic rooftop terrace.',
    },
    address: '70 Sleeper St, Boston, MA 02210',
    amenities: {
      vi: ['Lookout Rooftop Bar', 'Sát tuyến Harborwalk', 'Xe đạp miễn phí'],
      en: ['Lookout Rooftop', 'Harborwalk Access', 'Complimentary Bikes'],
    },
    image: IMAGES.seaport,
  },
  {
    id: 'htl-liberty',
    name: 'The Liberty, a Luxury Collection Hotel',
    district: 'Beacon Hill',
    neighborhoodKey: 'beacon-hill',
    style: { vi: 'Kiến trúc Lịch sử', en: 'Historic Architectural' },
    rateUsd: 395,
    rating: '4.7',
    summary: {
      vi: 'Kiệt tác bảo tồn kiến trúc năm 1851 ngay chân đồi Beacon Hill và sát bờ sông Charles.',
      en: 'An 1851 architectural landmark reborn at the foot of Beacon Hill alongside the Charles River.',
    },
    description: {
      vi: 'Từng là công trình đá granite nổi tiếng của kiến trúc sư Gridley J. F. Bryant, The Liberty sở hữu sảnh vòm cao 27 mét ấn tượng, sân vườn riêng và vị trí chỉ cách Charles Street 3 phút đi bộ.',
      en: 'Housed in a restored 1851 granite landmark with a dramatic 90-foot central rotunda, The Liberty sits steps from Charles Street boutiques and the Charles River Esplanade.',
    },
    address: '215 Charles St, Boston, MA 02114',
    amenities: {
      vi: ['Sảnh vòm di sản 1851', 'Sát sông Charles', 'Nhà hàng CLINK.'],
      en: ['1851 Granite Rotunda', 'Charles River Access', 'CLINK. Dining'],
    },
    image: IMAGES.beaconHill,
  },
  {
    id: 'htl-harbor',
    name: 'Boston Harbor Hotel at Rowes Wharf',
    district: 'Waterfront & Downtown',
    neighborhoodKey: 'seaport',
    style: { vi: 'Biểu tượng Bờ vịnh', en: 'Harborfront Icon' },
    rateUsd: 490,
    rating: '4.9',
    summary: {
      vi: 'Cổng vòm Rowes Wharf biểu tượng với taxi nước đưa đón thẳng từ sân bay quốc tế Logan.',
      en: 'Signature Rowes Wharf archway featuring direct water taxi arrivals from Logan Airport.',
    },
    description: {
      vi: 'Khách sạn 5 sao bên mặt vịnh Boston với tầm nhìn kép hướng biển và trung tâm thành phố, kết nối trực tiếp tuyến Freedom Trail và khu ẩm thực North End.',
      en: 'Five-star harborfront hospitality framing Boston’s famous Rowes Wharf arch, with direct water taxi access and effortless walking proximity to the Freedom Trail and North End.',
    },
    address: '70 Rowes Wharf, Boston, MA 02110',
    amenities: {
      vi: ['Taxi nước từ sân bay', 'Hồ bơi trong nhà', 'Tầm nhìn Vịnh Boston'],
      en: ['Airport Water Taxi', 'Indoor Lap Pool', 'Boston Harbor Views'],
    },
    image: IMAGES.freedomTrail,
  },
];

export const COPY = {
  vi: {
    nav: {
      explore: 'Khám phá',
      neighborhoods: 'Khu phố',
      events: 'Sự kiện',
      stay: 'Lưu trú',
      videos: 'Video',
      meetings: 'Hội nghị',
      myTrip: 'Lịch trình của tôi',
      menuOpen: 'Mở menu điều hướng',
      menuClose: 'Đóng menu điều hướng',
    },
    hero: {
      kicker: 'Cổng thông tin du lịch chính thức · Greater Boston',
      headline: 'Boston — Thành phố không bao giờ cũ.',
      subhead:
        'Từ con đường gạch đỏ Freedom Trail hơn 250 năm tuổi đến bến cảng Seaport đương đại, ẩm thực North End và 23 khu phố giàu bản sắc đang chờ bạn khám phá.',
      searchPlaceholder: 'Tìm điểm tham quan, khu phố, sự kiện hoặc khách sạn...',
      searchAll: 'Tất cả',
      searchExplore: 'Điểm đến',
      searchEvents: 'Sự kiện',
      searchStay: 'Khách sạn',
      searchBtn: 'Tìm kiếm',
      noResults: 'Không tìm thấy kết quả phù hợp. Thử từ khóa "Seaport", "Beacon Hill" hoặc "Celtics".',
      stats: [
        { value: '23', label: 'Khu phố đặc trưng tại Greater Boston' },
        { value: '16', label: 'Di tích lịch sử dọc Freedom Trail' },
        { value: '180+', label: 'Sự kiện nghệ thuật & thể thao tháng này' },
        { value: '15 phút', label: 'Từ sân bay Logan tới trung tâm thành phố' },
      ],
    },
    explore: {
      kicker: '01. Trải nghiệm chọn lọc',
      title: 'Những điều tạo nên sức hút của Boston',
      subtitle:
        'Lọc theo sở thích để chọn điểm dừng chân và lưu thẳng vào lịch trình cá nhân của bạn.',
      filters: {
        all: 'Tất cả',
        history: 'Lịch sử',
        dining: 'Ẩm thực',
        arts: 'Nghệ thuật',
        outdoors: 'Ngoài trời',
      },
      save: 'Lưu lịch trình',
      saved: 'Đã lưu',
      viewDetails: 'Xem chi tiết',
    },
    neighborhoods: {
      kicker: '02. Bản đồ Khu phố',
      title: 'Khám phá 6 khu phố biểu tượng',
      subtitle:
        'Boston là thành phố của những khu phố đi bộ. Mỗi trạm tàu T mở ra một nhịp sống, kiến trúc và hương vị hoàn toàn khác biệt.',
      walkability: 'Chỉ số đi bộ',
      transitLabel: 'Kết nối tàu điện ngầm',
      topPicksTitle: '3 điểm dừng không thể bỏ qua',
      addNeighborhoodBtn: 'Lưu khu phố vào lịch trình',
      savedNeighborhoodBtn: 'Đã lưu trong lịch trình',
    },
    events: {
      kicker: '03. Lịch sự kiện Boston',
      title: 'Đang diễn ra & Sắp tới',
      subtitle:
        'Từ chợ mùa đông bên vịnh Seaport, hòa nhạc Symphony Hall đến trận cầu rực lửa tại TD Garden.',
      timeframes: {
        all: 'Tất cả thời điểm',
        week: 'Tuần này',
        month: 'Tháng tới',
        holiday: 'Mùa lễ hội',
      },
      categories: {
        all: 'Mọi thể loại',
        arts: 'Nghệ thuật',
        sports: 'Thể thao',
        festival: 'Lễ hội',
        exhibition: 'Triển lãm',
      },
      empty: 'Không có sự kiện nào khớp bộ lọc hiện tại. Hãy chọn lại khung thời gian khác.',
      resetFilters: 'Đặt lại bộ lọc',
      details: 'Chi tiết',
      saveEvent: 'Lưu',
      savedEvent: 'Đã lưu',
    },
    stay: {
      kicker: '04. Lưu trú & Lập kế hoạch',
      title: 'Khách sạn được tuyển chọn',
      subtitle:
        'Những không gian nghỉ dưỡng mang dấu ấn kiến trúc Boston, thuận tiện di chuyển bằng đường bộ và tàu điện.',
      allDistricts: 'Tất cả khu vực',
      perNight: '/ đêm',
      saveHotel: 'Lưu',
      savedHotel: 'Đã lưu',
      guideKicker: 'Cẩm nang chính thức Meet Boston',
      guideTitle: 'Nhận Cẩm nang Du lịch Boston 2026 miễn phí',
      guideDesc:
        'Bản đồ tàu điện ngầm MBTA, gợi ý hành trình 48 giờ, danh sách nhà hàng địa phương và ưu đãi vé bảo tàng gửi thẳng qua email.',
      emailPlaceholder: 'Nhập địa chỉ email của bạn',
      emailBtn: 'Gửi cẩm nang miễn phí',
      emailInvalid: 'Vui lòng nhập địa chỉ email hợp lệ.',
      emailSuccess: 'Đã gửi Cẩm nang Boston 2026 đến email của bạn. Chúc bạn một hành trình trọn vẹn!',
      meetingsKicker: 'Dành cho Doanh nghiệp & Tổ chức',
      meetingsTitle: 'Tổ chức Hội nghị & Sự kiện tại Boston',
      meetingsDesc:
        'Đội ngũ Meet Boston hỗ trợ miễn phí khảo sát địa điểm tại BCEC, Hynes Convention Center, đặt khối phòng khách sạn và trải nghiệm đoàn khách quốc tế.',
      meetingsBtn: 'Gửi yêu cầu khảo sát (RFP)',
    },
    videos: {
      kicker: '05. Thư viện Video Boston',
      title: 'Khám phá Boston qua góc nhìn thực tế',
      subtitle:
        'Tuyển tập video được phân nhóm theo chủ đề, tối ưu song ngữ Anh/Việt và điểm nhấn nổi bật giúp bạn cảm nhận trọn vẹn nhịp sống Boston trước chuyến đi.',
      allTopics: 'Tất cả chủ đề',
      searchPlaceholder: 'Tìm video theo từ khóa VI/EN...',
      playlistQueue: 'Danh sách phát hiện tại',
      prevVideo: 'Video trước',
      nextVideo: 'Tiếp theo',
      watchOnYoutube: 'Mở YouTube',
      keyTakeaways: 'Điểm nổi bật trong video',
      openFullLibrary: 'Mở thư viện đầy đủ',
      browseAllHeading: 'Khám phá thêm video cùng chủ đề',
      emptySearch: 'Không tìm thấy video phù hợp với từ khóa của bạn.',
    },
    drawer: {
      title: 'Lịch trình Boston của tôi',
      subtitle: 'Sắp xếp các điểm đến, sự kiện và khách sạn bạn đã lưu theo từng ngày.',
      emptyTitle: 'Lịch trình của bạn đang trống',
      emptyDesc:
        'Nhấn nút "Lưu" ở bất kỳ điểm tham quan, khu phố, sự kiện hay khách sạn nào — hoặc nạp nhanh hành trình gợi ý 48 giờ bên dưới.',
      loadStarter: 'Nạp gợi ý 48 giờ tại Boston',
      dayPrefix: 'Ngày',
      moveDay: 'Chuyển sang',
      remove: 'Xóa',
      copyBtn: 'Sao chép lịch trình',
      copiedBtn: 'Đã sao chép vào bộ nhớ tạm',
      clearAll: 'Xóa tất cả',
      itemsCount: 'mục đã lưu',
    },
    modal: {
      close: 'Đóng',
      address: 'Địa chỉ',
      hours: 'Giờ mở cửa',
      price: 'Chi phí tham khảo',
      transit: 'Di chuyển công cộng',
      insiderTip: 'Mẹo từ người bản địa',
      addToTrip: 'Thêm vào lịch trình của tôi',
      removeFromTrip: 'Bỏ khỏi lịch trình',
    },
    meetingsModal: {
      title: 'Gửi yêu cầu tổ chức Hội nghị (RFP)',
      subtitle: 'Chuyên viên Meet Boston sẽ phản hồi phương án địa điểm và phòng khách sạn trong vòng 24 giờ làm việc.',
      orgLabel: 'Tên tổ chức / Doanh nghiệp',
      orgPlaceholder: 'Ví dụ: Công ty Cổ phần Công nghệ Minh Anh',
      emailLabel: 'Email liên hệ',
      emailPlaceholder: 'name@company.com',
      guestsLabel: 'Quy mô khách dự kiến',
      monthLabel: 'Thời gian dự kiến',
      notesLabel: 'Yêu cầu bổ sung (phòng họp, triển lãm, tiệc tối)',
      notesPlaceholder: 'Chia sẻ nhu cầu không gian hoặc khu vực mong muốn (Seaport, Back Bay)...',
      submit: 'Gửi yêu cầu tư vấn',
      cancel: 'Hủy',
      error: 'Vui lòng điền tên tổ chức và địa chỉ email hợp lệ.',
      successTitle: 'Đã tiếp nhận yêu cầu RFP của bạn',
      successDesc: 'Cảm ơn bạn đã liên hệ Meet Boston. Đội ngũ Hội nghị & Sự kiện sẽ gửi hồ sơ địa điểm phù hợp tới email đã đăng ký.',
      done: 'Hoàn tất',
    },
    footer: {
      about:
        'Tổ chức Tiếp thị Điểm đến chính thức của Greater Boston — chào đón du khách, nhà tổ chức hội nghị và những tâm hồn yêu văn hóa từ khắp thế giới.',
      visitorCenterTitle: 'Trung tâm Thông tin Du khách',
      visitorCenterAddress: 'Boston Common · 139 Tremont St, Boston, MA 02111',
      visitorCenterHours: 'Mở cửa hàng ngày · 08:30 – 17:00',
      columns: [
        {
          heading: 'Khám phá Boston',
          links: [
            { label: 'Điểm tham quan nổi bật', href: '#explore' },
            { label: '6 Khu phố biểu tượng', href: '#neighborhoods' },
            { label: 'Lịch sự kiện tháng này', href: '#events' },
            { label: 'Khách sạn chọn lọc', href: '#stay' },
            { label: 'Thư viện Video Boston', href: '/videos' },
          ],
        },
        {
          heading: 'Lập kế hoạch',
          links: [
            { label: 'Nhận Cẩm nang Du lịch', href: '#visitor-guide' },
            { label: 'Hội nghị & Sự kiện (MICE)', href: '#meetings' },
            { label: 'Di chuyển bằng tàu MBTA', href: '#neighborhoods' },
            { label: 'Lịch trình cá nhân', href: '#top' },
          ],
        },
      ],
      newsletterTitle: 'Bản tin cuối tuần tại Boston',
      newsletterPlaceholder: 'Email nhận bản tin...',
      newsletterBtn: 'Đăng ký',
      newsletterOk: 'Đăng ký thành công!',
      copyright: '© 2026 Meet Boston · Greater Boston Visitor Portal. Mọi quyền được bảo lưu.',
    },
  },
  en: {
    nav: {
      explore: 'Things to Do',
      neighborhoods: 'Neighborhoods',
      events: 'Events',
      stay: 'Places to Stay',
      videos: 'Videos',
      meetings: 'Meetings',
      myTrip: 'My Itinerary',
      menuOpen: 'Open navigation menu',
      menuClose: 'Close navigation menu',
    },
    hero: {
      kicker: 'Official Destination Guide · Greater Boston',
      headline: 'Boston Never Gets Old.',
      subhead:
        'From the 250-year-old red bricks of the Freedom Trail to Seaport’s contemporary waterfront, North End trattorias, and 23 distinct neighborhoods.',
      searchPlaceholder: 'Search attractions, neighborhoods, events, or hotels...',
      searchAll: 'All',
      searchExplore: 'Experiences',
      searchEvents: 'Events',
      searchStay: 'Hotels',
      searchBtn: 'Search',
      noResults: 'No matching places found. Try "Seaport", "Beacon Hill", or "Celtics".',
      stats: [
        { value: '23', label: 'Distinct Greater Boston neighborhoods' },
        { value: '16', label: 'Historic landmarks on the Freedom Trail' },
        { value: '180+', label: 'Cultural & sporting events this month' },
        { value: '15 min', label: 'From Logan Airport to downtown' },
      ],
    },
    explore: {
      kicker: '01. Curated Experiences',
      title: 'Essential Boston Things to Do',
      subtitle:
        'Filter by interest to uncover local landmarks and save stops directly to your custom trip planner.',
      filters: {
        all: 'All',
        history: 'History',
        dining: 'Dining',
        arts: 'Arts',
        outdoors: 'Outdoors',
      },
      save: 'Save to Trip',
      saved: 'Saved',
      viewDetails: 'View Details',
    },
    neighborhoods: {
      kicker: '02. Neighborhood Explorer',
      title: 'Discover Six Iconic Neighborhoods',
      subtitle:
        'Boston is built for walking. Every T stop opens into its own architectural era, culinary rhythm, and neighborhood character.',
      walkability: 'Walk Score',
      transitLabel: 'Public Transit Access',
      topPicksTitle: 'Three Essential Local Stops',
      addNeighborhoodBtn: 'Save Neighborhood to Trip',
      savedNeighborhoodBtn: 'Saved in Your Trip',
    },
    events: {
      kicker: '03. Boston Events Calendar',
      title: 'Happening Now & Upcoming',
      subtitle:
        'From Seaport winter markets and Symphony Hall performances to Celtics nights at TD Garden.',
      timeframes: {
        all: 'All Dates',
        week: 'This Week',
        month: 'Next 30 Days',
        holiday: 'Holiday Season',
      },
      categories: {
        all: 'All Categories',
        arts: 'Arts & Music',
        sports: 'Sports',
        festival: 'Festivals',
        exhibition: 'Exhibitions',
      },
      empty: 'No events match your current filters. Try switching the date range or category.',
      resetFilters: 'Reset Filters',
      details: 'Details',
      saveEvent: 'Save',
      savedEvent: 'Saved',
    },
    stay: {
      kicker: '04. Stay & Plan',
      title: 'Curated Boston Hotels',
      subtitle:
        'Architectural landmarks and harborfront boutiques placed right beside Boston’s most walkable districts.',
      allDistricts: 'All Districts',
      perNight: '/ night',
      saveHotel: 'Save',
      savedHotel: 'Saved',
      guideKicker: 'Official Meet Boston Guide',
      guideTitle: 'Get the Free 2026 Boston Visitor Guide',
      guideDesc:
        'Receive MBTA transit maps, a curated 48-hour weekend itinerary, neighborhood dining picks, and museum savings straight to your inbox.',
      emailPlaceholder: 'Enter your email address',
      emailBtn: 'Send Free Guide',
      emailInvalid: 'Please enter a valid email address.',
      emailSuccess: 'Your 2026 Boston Visitor Guide is on its way. Enjoy exploring Greater Boston!',
      meetingsKicker: 'Meetings & Conventions',
      meetingsTitle: 'Host Your Next Event in Boston',
      meetingsDesc:
        'Our destination specialists provide complimentary venue sourcing across BCEC, Hynes Convention Center, hotel room blocks, and group experiences.',
      meetingsBtn: 'Submit Meeting RFP',
    },
    videos: {
      kicker: '05. Boston Video Library',
      title: 'Experience Boston Through Local Eyes',
      subtitle:
        'Curated topic playlists with bilingual EN/VI summaries and key takeaways so you can explore Boston’s landmarks, food, and neighborhoods before you arrive.',
      allTopics: 'All Topics',
      searchPlaceholder: 'Search videos in EN or VI...',
      playlistQueue: 'Active Playlist Queue',
      prevVideo: 'Previous',
      nextVideo: 'Next',
      watchOnYoutube: 'Watch on YouTube',
      keyTakeaways: 'Key Highlights',
      openFullLibrary: 'Full Video Library',
      browseAllHeading: 'Browse More Videos',
      emptySearch: 'No videos match your search query.',
    },
    drawer: {
      title: 'My Boston Itinerary',
      subtitle: 'Organize your saved attractions, events, and hotels day by day.',
      emptyTitle: 'Your itinerary is currently empty',
      emptyDesc:
        'Click "Save" on any attraction, neighborhood, event, or hotel — or load our curated 48-hour weekend starter below.',
      loadStarter: 'Load 48-Hour Boston Starter',
      dayPrefix: 'Day',
      moveDay: 'Move to',
      remove: 'Remove',
      copyBtn: 'Copy Itinerary',
      copiedBtn: 'Copied to Clipboard',
      clearAll: 'Clear All',
      itemsCount: 'saved items',
    },
    modal: {
      close: 'Close',
      address: 'Address',
      hours: 'Hours',
      price: 'Typical Cost',
      transit: 'Transit Access',
      insiderTip: 'Local Insider Tip',
      addToTrip: 'Save to My Itinerary',
      removeFromTrip: 'Remove from Itinerary',
    },
    meetingsModal: {
      title: 'Submit a Meeting or Convention RFP',
      subtitle: 'A Meet Boston destination specialist will respond with tailored venues and hotel blocks within one business day.',
      orgLabel: 'Organization / Company',
      orgPlaceholder: 'e.g., Atlantic Life Sciences Summit',
      emailLabel: 'Work Email',
      emailPlaceholder: 'planner@organization.com',
      guestsLabel: 'Estimated Attendance',
      monthLabel: 'Target Timeframe',
      notesLabel: 'Space & Program Requirements',
      notesPlaceholder: 'Share preferred districts (Seaport, Back Bay) or ballroom needs...',
      submit: 'Submit RFP Inquiry',
      cancel: 'Cancel',
      error: 'Please enter your organization name and a valid email address.',
      successTitle: 'Your RFP Inquiry Has Been Received',
      successDesc: 'Thank you for contacting Meet Boston. Our Meetings & Conventions team will send tailored venue availability to your inbox.',
      done: 'Done',
    },
    footer: {
      about:
        'The official destination marketing organization for Greater Boston — welcoming leisure travelers, meeting planners, and cultural explorers from around the world.',
      visitorCenterTitle: 'Visitor Information Center',
      visitorCenterAddress: 'Boston Common · 139 Tremont St, Boston, MA 02111',
      visitorCenterHours: 'Open Daily · 8:30 AM – 5:00 PM',
      columns: [
        {
          heading: 'Explore Boston',
          links: [
            { label: 'Essential Things to Do', href: '#explore' },
            { label: 'Six Iconic Neighborhoods', href: '#neighborhoods' },
            { label: 'Upcoming Events Calendar', href: '#events' },
            { label: 'Curated Hotels', href: '#stay' },
            { label: 'Boston Video Library', href: '/videos' },
          ],
        },
        {
          heading: 'Plan Your Visit',
          links: [
            { label: 'Free Visitor Guide', href: '#visitor-guide' },
            { label: 'Meetings & Conventions', href: '#meetings' },
            { label: 'Getting Around (MBTA)', href: '#neighborhoods' },
            { label: 'My Saved Itinerary', href: '#top' },
          ],
        },
      ],
      newsletterTitle: 'Boston Weekend Dispatch',
      newsletterPlaceholder: 'Your email address...',
      newsletterBtn: 'Subscribe',
      newsletterOk: 'Subscribed!',
      copyright: '© 2026 Meet Boston · Greater Boston Visitor Portal. All rights reserved.',
    },
  },
} as const;
