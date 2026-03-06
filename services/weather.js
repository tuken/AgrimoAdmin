const { callUpstreamGraphQL } = require('./gql');

const WEATHER_CODES_QUERY_V2 = `
query wc {
  weathers {
    code
    japanese
  }
}
`;

const WEATHER_CODES_QUERY_V1 = `
query wc {
  weatherCodes {
    code
    japanese
  }
}
`;

const FORECAST_7D_QUERY_V2 = `
query forecast7d($latitude: Float!, $longitude: Float!, $days: Int!) {
  forecasts(latitude: $latitude, longitude: $longitude, days: $days) {
    time
    temperatureMax
    temperatureMin
    precipitationSum
    weather {
      code
      japanese
    }
  }
}
`;

const FORECAST_7D_QUERY_V1 = `
query forecast7d($latitude: Float!, $longitude: Float!, $days: Int!) {
  forecasts(latitude: $latitude, longitude: $longitude, days: $days) {
    time
    weatherCode
    temperatureMax
    temperatureMin
    precipitationSum
  }
}
`;

// In-memory cache
const cache = {
  codes: null,
  codesFetchedAt: 0,
};

const CODES_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function codeToEmoji(code) {
  const c = Number(code);
  if (Number.isNaN(c)) return '❔';
  if (c === 0) return '☀️';
  if (c >= 1 && c <= 3) return '⛅️';
  if (c === 45 || c === 48) return '🌫';
  if (c >= 51 && c <= 57) return '🌦';
  if (c >= 61 && c <= 67) return '🌧';
  if (c >= 71 && c <= 77) return '❄️';
  if (c >= 80 && c <= 82) return '🌧';
  if (c >= 95 && c <= 99) return '⛈';
  return '🌥';
}

function toJstDateLabel(isoDate) {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return { md: '', dowJa: '' };
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const m = jst.getUTCMonth() + 1;
  const day = jst.getUTCDate();
  const dow = jst.getUTCDay();
  const dows = ['日', '月', '火', '水', '木', '金', '土'];
  return { md: `${m}/${day}`, dowJa: dows[dow] };
}

async function getWeatherCodes({ endpoint, headers }) {
  const now = Date.now();
  if (cache.codes && (now - cache.codesFetchedAt) < CODES_TTL_MS) return cache.codes;

  let result = await callUpstreamGraphQL({ endpoint, query: WEATHER_CODES_QUERY_V2, variables: {}, headers });

  let list = result?.json?.data?.weathers;
  if (!Array.isArray(list)) {
    if (result?.json?.errors?.length) {
      console.error('[weather] weathers errors:', result.json.errors);
    }
    result = await callUpstreamGraphQL({ endpoint, query: WEATHER_CODES_QUERY_V1, variables: {}, headers });
    if (result?.json?.errors?.length) {
      console.error('[weather] weatherCodes errors:', result.json.errors);
    }
    list = result?.json?.data?.weatherCodes;
  }

  if (!Array.isArray(list)) return null;

  const map = {};
  list.forEach((x) => { map[String(x.code)] = x.japanese; });

  cache.codes = map;
  cache.codesFetchedAt = now;
  return map;
}

async function fetchForecastRows({ endpoint, latitude, longitude, headers, days = 7 }) {
  const variables = { latitude: Number(latitude), longitude: Number(longitude), days: Number(days) };

  // New schema first: weather is now a nested object.
  let result = await callUpstreamGraphQL({
    endpoint,
    query: FORECAST_7D_QUERY_V2,
    variables,
    headers,
  });

  const rowsV2 = result?.json?.data?.forecasts;
  if (Array.isArray(rowsV2)) {
    return { rows: rowsV2, version: 'v2', result };
  }

  if (result?.json?.errors?.length) {
    console.error('[weather] forecasts(v2) errors:', result.json.errors);
  }

  // Fallback for older upstream schema.
  result = await callUpstreamGraphQL({
    endpoint,
    query: FORECAST_7D_QUERY_V1,
    variables,
    headers,
  });

  const rowsV1 = result?.json?.data?.forecasts;
  if (Array.isArray(rowsV1)) {
    return { rows: rowsV1, version: 'v1', result };
  }

  if (result?.json?.errors?.length) {
    console.error('[weather] forecasts(v1) errors:', result.json.errors);
  }

  return { rows: [], version: 'unknown', result };
}

async function getWeeklyForecast({ endpoint, latitude, longitude, headers, days = 7 }) {
  const codesMap = await getWeatherCodes({ endpoint, headers }).catch((e) => {
    console.error('[weather] getWeatherCodes failed:', e);
    return null;
  });

  const { rows, result } = await fetchForecastRows({ endpoint, latitude, longitude, headers, days });

  const daily = Array.isArray(rows) ? rows : [];
  const daysOut = daily.slice(0, 7).map((r, idx) => {
    const weatherObj = (r && typeof r.weather === 'object' && r.weather) ? r.weather : null;
    const code = weatherObj?.code ?? r.weatherCode ?? r.weathercode ?? r.code;
    const label = toJstDateLabel(r.time ?? r.date);
    const desc = weatherObj?.japanese || codesMap?.[String(code)] || '';

    return {
      index: idx,
      isToday: idx === 0,
      date: r.time ?? r.date,
      md: label.md,
      dowJa: label.dowJa,
      weathercode: code,
      descriptionJa: desc,
      icon: codeToEmoji(code),
      tmax: (r.temperatureMax == null) ? null : Math.round(Number(r.temperatureMax)),
      tmin: (r.temperatureMin == null) ? null : Math.round(Number(r.temperatureMin)),
      precipitationSum: r.precipitationSum ?? null,
    };
  });

  return {
    ok: daysOut.length > 0,
    days: daysOut,
    raw: result?.json || null,
    rawText: result?.text || '',
  };
}

module.exports = {
  getWeatherCodes,
  getWeeklyForecast,
};
