export type WeatherIconKind =
  | 'sun'
  | 'partly-cloudy'
  | 'cloudy'
  | 'fog'
  | 'rain'
  | 'snow'
  | 'storm';

export interface BostonForecastDay {
  date: string;
  maxC: number;
  minC: number;
  maxF: number;
  minF: number;
  precipProb: number;
  weatherCode: number;
  icon: WeatherIconKind;
  labelVi: string;
  labelEn: string;
}

export interface BostonWeatherPayload {
  location: string;
  timezone: string;
  localTime: string;
  tempC: number;
  tempF: number;
  feelsLikeC: number;
  feelsLikeF: number;
  humidity: number;
  windKmh: number;
  windMph: number;
  weatherCode: number;
  icon: WeatherIconKind;
  conditionVi: string;
  conditionEn: string;
  tipVi: string;
  tipEn: string;
  forecast: BostonForecastDay[];
  updatedAt: string;
}

const WEATHER_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
let cachedWeather: { fetchedAt: number; payload: BostonWeatherPayload } | null = null;

function cToF(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}

function describeWmoCode(code: number): {
  icon: WeatherIconKind;
  vi: string;
  en: string;
} {
  if (code === 0) return { icon: 'sun', vi: 'Trời quang đãng', en: 'Clear Sky' };
  if (code === 1 || code === 2) {
    return { icon: 'partly-cloudy', vi: 'Nắng nhẹ, ít mây', en: 'Partly Cloudy' };
  }
  if (code === 3) return { icon: 'cloudy', vi: 'Nhiều mây', en: 'Overcast' };
  if (code === 45 || code === 48) {
    return { icon: 'fog', vi: 'Sương mù ven cảng', en: 'Harbor Fog' };
  }
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return { icon: 'rain', vi: 'Có mưa rải rác', en: 'Rain Showers' };
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return { icon: 'snow', vi: 'Có tuyết rơi', en: 'Snowfall' };
  }
  if (code >= 95) {
    return { icon: 'storm', vi: 'Mưa dông', en: 'Thunderstorm' };
  }
  return { icon: 'partly-cloudy', vi: 'Thời tiết ôn hoà', en: 'Mild Conditions' };
}

function buildBostonPackingTip(tempC: number, icon: WeatherIconKind, windKmh: number): {
  tipVi: string;
  tipEn: string;
} {
  if (icon === 'snow' || tempC <= 2) {
    return {
      tipVi:
        'Trời lạnh kiểu New England: nên mang áo khoác phao giữ nhiệt, khăn choàng, găng tay và giày chống trượt khi đi bộ Freedom Trail.',
      tipEn:
        'Crisp New England chill: pack an insulated coat, scarf, gloves, and slip-resistant walking shoes for the Freedom Trail.',
    };
  }
  if (icon === 'rain' || icon === 'storm') {
    return {
      tipVi:
        'Boston có mưa & gió cảng: ưu tiên áo khoác chống nước (tốt hơn ô khi gió lớn) và lịch trình trong nhà như MFA, Bảo tàng Gardner hoặc Quincy Market.',
      tipEn:
        'Rain and harbor breezes ahead: bring a waterproof shell (better than umbrellas in wind) and pair with indoor gems like the MFA or Quincy Market.',
    };
  }
  if (tempC <= 12) {
    return {
      tipVi:
        'Se lạnh rất đẹp để dạo phố Beacon Hill và Back Bay: mặc nhiều lớp (áo len nhẹ + áo khoác gió) để dễ điều chỉnh giữa nắng và gió sông Charles.',
      tipEn:
        'Ideal brisk weather for Beacon Hill and Back Bay: dress in breathable layers plus a windbreaker for Charles River breezes.',
    };
  }
  if (tempC <= 23) {
    return {
      tipVi:
        windKmh >= 24
          ? 'Thời tiết dễ chịu nhưng gió ven cảng khá mát: mang thêm áo khoác mỏng nếu đi phà cảng Boston hoặc dạo Seaport buổi tối.'
          : 'Thời tiết tuyệt vời để khám phá ngoài trời: giày đi bộ êm, kính râm và lịch trình kết hợp Boston Common, Public Garden và du thuyền cảng.',
      tipEn:
        windKmh >= 24
          ? 'Comfortable temperatures with a lively harbor breeze: bring a light jacket for evening walks in Seaport or harbor ferries.'
          : 'Prime walking weather across Boston: wear comfortable sneakers and enjoy Boston Common, Public Garden, and waterfront strolls.',
    };
  }
  return {
    tipVi:
      'Trời nắng ấm mùa hè: mang mũ, kem chống nắng, bình nước cá nhân và tận hưởng gió mát ven sông Charles hoặc khu Seaport.',
    tipEn:
      'Warm Boston sunshine: pack sunglasses, sunscreen, and a refillable bottle, and cool off along the Charles River Esplanade or Seaport.',
  };
}

function getBostonLocalTime(): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(new Date());
  } catch {
    return '';
  }
}

export async function getLiveBostonWeather(): Promise<BostonWeatherPayload> {
  const now = Date.now();
  if (cachedWeather && now - cachedWeather.fetchedAt < WEATHER_CACHE_TTL_MS) {
    return {
      ...cachedWeather.payload,
      localTime: getBostonLocalTime(),
    };
  }

  const endpoint =
    'https://api.open-meteo.com/v1/forecast?latitude=42.3601&longitude=-71.0589' +
    '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
    '&timezone=America%2FNew_York&forecast_days=4';

  const res = await fetch(endpoint, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(7000),
  });

  if (!res.ok) {
    throw new Error(`Open-Meteo HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    current?: {
      temperature_2m?: number;
      relative_humidity_2m?: number;
      apparent_temperature?: number;
      weather_code?: number;
      wind_speed_10m?: number;
    };
    daily?: {
      time?: string[];
      weather_code?: number[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      precipitation_probability_max?: number[];
    };
  };

  const cur = data.current || {};
  const tempC = Math.round(Number(cur.temperature_2m ?? 14));
  const feelsLikeC = Math.round(Number(cur.apparent_temperature ?? tempC));
  const humidity = Math.round(Number(cur.relative_humidity_2m ?? 60));
  const windKmh = Math.round(Number(cur.wind_speed_10m ?? 14));
  const weatherCode = Number(cur.weather_code ?? 2);
  const desc = describeWmoCode(weatherCode);
  const tips = buildBostonPackingTip(tempC, desc.icon, windKmh);

  const times = data.daily?.time || [];
  const codes = data.daily?.weather_code || [];
  const maxs = data.daily?.temperature_2m_max || [];
  const mins = data.daily?.temperature_2m_min || [];
  const precips = data.daily?.precipitation_probability_max || [];

  const forecast: BostonForecastDay[] = times.slice(0, 3).map((dateStr, idx) => {
    const dCode = Number(codes[idx] ?? weatherCode);
    const dDesc = describeWmoCode(dCode);
    const maxC = Math.round(Number(maxs[idx] ?? tempC + 3));
    const minC = Math.round(Number(mins[idx] ?? tempC - 4));
    return {
      date: dateStr,
      maxC,
      minC,
      maxF: cToF(maxC),
      minF: cToF(minC),
      precipProb: Math.round(Number(precips[idx] ?? 10)),
      weatherCode: dCode,
      icon: dDesc.icon,
      labelVi: dDesc.vi,
      labelEn: dDesc.en,
    };
  });

  const payload: BostonWeatherPayload = {
    location: 'Boston, MA',
    timezone: 'America/New_York',
    localTime: getBostonLocalTime(),
    tempC,
    tempF: cToF(tempC),
    feelsLikeC,
    feelsLikeF: cToF(feelsLikeC),
    humidity,
    windKmh,
    windMph: Math.round(windKmh * 0.621371),
    weatherCode,
    icon: desc.icon,
    conditionVi: desc.vi,
    conditionEn: desc.en,
    tipVi: tips.tipVi,
    tipEn: tips.tipEn,
    forecast,
    updatedAt: new Date().toISOString(),
  };

  cachedWeather = { fetchedAt: now, payload };
  return payload;
}
