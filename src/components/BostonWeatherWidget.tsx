import { useEffect, useState } from 'react';
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Compass,
  Droplets,
  Sun,
  Wind,
} from 'lucide-react';
import { Language } from '../data/bostonData';

type WeatherIconKind =
  | 'sun'
  | 'partly-cloudy'
  | 'cloudy'
  | 'fog'
  | 'rain'
  | 'snow'
  | 'storm';

interface ForecastDay {
  date: string;
  maxC: number;
  minC: number;
  maxF: number;
  minF: number;
  precipProb: number;
  icon: WeatherIconKind;
  labelVi: string;
  labelEn: string;
}

interface WeatherData {
  location: string;
  localTime: string;
  tempC: number;
  tempF: number;
  feelsLikeC: number;
  feelsLikeF: number;
  humidity: number;
  windKmh: number;
  windMph: number;
  icon: WeatherIconKind;
  conditionVi: string;
  conditionEn: string;
  tipVi: string;
  tipEn: string;
  forecast: ForecastDay[];
}

function WeatherGlyph({
  kind,
  className = 'h-6 w-6',
}: {
  kind: WeatherIconKind;
  className?: string;
}) {
  switch (kind) {
    case 'sun':
      return <Sun className={className} aria-hidden="true" />;
    case 'partly-cloudy':
      return <CloudSun className={className} aria-hidden="true" />;
    case 'cloudy':
      return <Cloud className={className} aria-hidden="true" />;
    case 'fog':
      return <CloudFog className={className} aria-hidden="true" />;
    case 'rain':
      return <CloudRain className={className} aria-hidden="true" />;
    case 'snow':
      return <CloudSnow className={className} aria-hidden="true" />;
    case 'storm':
      return <CloudLightning className={className} aria-hidden="true" />;
  }
}

function formatDayLabel(dateStr: string, lang: Language, idx: number): string {
  if (idx === 0) return lang === 'vi' ? 'Hôm nay' : 'Today';
  try {
    const dt = new Date(`${dateStr}T12:00:00`);
    return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'numeric',
    }).format(dt);
  } catch {
    return dateStr;
  }
}

export function BostonWeatherWidget({ lang }: { lang: Language }) {
  const isVi = lang === 'vi';
  const [unit, setUnit] = useState<'C' | 'F'>(() => (lang === 'vi' ? 'C' : 'F'));
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnit(lang === 'vi' ? 'C' : 'F');
  }, [lang]);

  useEffect(() => {
    let active = true;
    fetch('/api/boston/weather')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: WeatherData | null) => {
        if (active && data && typeof data.tempC === 'number') {
          setWeather(data);
        }
      })
      .catch(() => {
        // Silent fallback: hide widget if upstream weather API unreachable
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading || !weather) return null;

  const mainTemp = unit === 'C' ? weather.tempC : weather.tempF;
  const feelsLike = unit === 'C' ? weather.feelsLikeC : weather.feelsLikeF;
  const windDisplay =
    unit === 'C' ? `${weather.windKmh} km/h` : `${weather.windMph} mph`;

  return (
    <div className="mb-14 overflow-hidden rounded-2xl border border-[#0A2239]/15 bg-[#0A2239] text-white">
      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-12 lg:items-center lg:p-8">
        {/* Current Boston Conditions */}
        <div className="lg:col-span-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#FF8A9B]">
                {isVi ? 'Thời tiết Boston hiện tại' : 'Live Boston Weather'}
              </p>
              {weather.localTime && (
                <p className="mt-0.5 text-xs text-white/70">
                  {weather.location} · {weather.localTime} (ET)
                </p>
              )}
            </div>

            <div
              role="group"
              aria-label="Temperature unit"
              className="inline-flex rounded-lg border border-white/20 bg-white/10 p-0.5 text-xs font-semibold"
            >
              <button
                type="button"
                onClick={() => setUnit('C')}
                className={`rounded-md px-2.5 py-1 transition-colors ${
                  unit === 'C' ? 'bg-white text-[#0A2239]' : 'text-white/80 hover:text-white'
                }`}
              >
                °C
              </button>
              <button
                type="button"
                onClick={() => setUnit('F')}
                className={`rounded-md px-2.5 py-1 transition-colors ${
                  unit === 'F' ? 'bg-white text-[#0A2239]' : 'text-white/80 hover:text-white'
                }`}
              >
                °F
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <div className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#FF8A9B]">
              <WeatherGlyph kind={weather.icon} className="h-8 w-8" />
            </div>
            <div>
              <div className="flex items-baseline gap-2.5">
                <span className="font-display text-4xl font-extrabold tracking-tight tabular-nums">
                  {mainTemp}°{unit}
                </span>
                <span className="text-sm font-semibold text-white/90">
                  {isVi ? weather.conditionVi : weather.conditionEn}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-white/75 tabular-nums">
                <span>
                  {isVi ? 'Cảm giác' : 'Feels like'} {feelsLike}°{unit}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Droplets className="h-3.5 w-3.5 text-[#FF8A9B]" aria-hidden="true" />
                  {weather.humidity}%
                </span>
                <span className="inline-flex items-center gap-1">
                  <Wind className="h-3.5 w-3.5 text-[#FF8A9B]" aria-hidden="true" />
                  {windDisplay}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Smart Boston Packing & Seasonal Tip */}
        <div className="border-y border-white/15 py-4 lg:col-span-4 lg:border-x lg:border-y-0 lg:px-6 lg:py-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#FF8A9B]">
            <Compass className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {isVi ? 'Gợi ý trang phục & lịch trình hôm nay' : 'Today’s Packing & Walking Tip'}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-white/85">
            {isVi ? weather.tipVi : weather.tipEn}
          </p>
        </div>

        {/* 3-Day Forecast */}
        <div className="grid grid-cols-3 gap-2.5 lg:col-span-4">
          {weather.forecast.slice(0, 3).map((day, idx) => (
            <div
              key={day.date}
              className="rounded-xl border border-white/10 bg-white/5 p-3 text-center"
            >
              <p className="text-[11px] font-semibold text-white/75">
                {formatDayLabel(day.date, lang, idx)}
              </p>
              <div className="my-2 flex justify-center text-[#FF8A9B]">
                <WeatherGlyph kind={day.icon} className="h-5 w-5" />
              </div>
              <p className="font-mono text-xs font-bold text-white tabular-nums">
                {unit === 'C' ? `${day.maxC}°` : `${day.maxF}°`}{' '}
                <span className="font-normal text-white/60">
                  / {unit === 'C' ? `${day.minC}°` : `${day.minF}°`}
                </span>
              </p>
              <p className="mt-1 font-mono text-[10px] text-white/65 tabular-nums">
                {isVi ? 'Mưa' : 'Rain'} {day.precipProb}%
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
