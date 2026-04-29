/** GeoAPI 城市搜索 — 单条 */
export type QWeatherLocation = {
  name: string;
  id: string;
  lat: string;
  lon: string;
  adm2: string;
  adm1: string;
  country: string;
};

export type QWeatherGeoResponse = {
  code: string;
  location?: QWeatherLocation[];
};

export type QWeatherWeatherDaily = {
  date: string;
  sunrise?: string;
  sunset?: string;
  tempMax?: string;
  tempMin?: string;
  humidity?: string;
  precip?: string;
  pressure?: string;
};

export type QWeatherWeatherHourly = {
  time: string;
  temp?: string;
  icon?: string;
  text?: string;
  precip?: string;
};

export type QWeatherHistoricalResponse = {
  code: string;
  weatherDaily?: QWeatherWeatherDaily;
  weatherHourly?: QWeatherWeatherHourly[];
};

export type DayPayload = {
  dateYmd: string;
  dateDisplay: string;
  tempMax: string | null;
  tempMin: string | null;
  precip: string | null;
  condition: string;
};

export type WeatherHistoryRow = {
  date: string;
  tempMax: string | null;
  tempMin: string | null;
  condition: string;
  comment: string;
  commentSource: "deepseek" | "fallback";
  dayError?: string;
};

export type WeatherHistoryResponseBody = {
  cityQuery: string;
  resolved: {
    name: string;
    id: string;
    adm1: string;
    country: string;
  };
  days: WeatherHistoryRow[];
};
