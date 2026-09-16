import { NextResponse } from 'next/server';

const NOMINATIM_SEARCH_URL =
  'https://nominatim.openstreetmap.org/search';

const USER_AGENT =
  'Tholan/1.0 (health emergency platform)';

function isValidCoordinate(
  lat: number,
  lon: number
): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

function buildNearbyViewbox(
  lat: number,
  lon: number
): string {
  // Roughly 10 km in latitude.
  const latDelta = 0.09;

  // Adjust longitude width for latitude.
  const cosLat = Math.cos(
    (lat * Math.PI) / 180
  );

  const lonDelta =
    0.09 / Math.max(Math.abs(cosLat), 0.2);

  const left = lon - lonDelta;
  const right = lon + lonDelta;
  const bottom = Math.max(
    -90,
    lat - latDelta
  );
  const top = Math.min(
    90,
    lat + latDelta
  );

  return `${left},${top},${right},${bottom}`;
}

export async function GET(req: Request) {
  const requestUrl = new URL(req.url);

  const q = requestUrl.searchParams.get('q')?.trim() ?? '';
  const latValue =
    requestUrl.searchParams.get('lat');
  const lonValue =
    requestUrl.searchParams.get('lon');

  if (!q) {
    return NextResponse.json(
      {
        error:
          'A hospital search query is required.',
      },
      { status: 400 }
    );
  }

  try {
    const params = new URLSearchParams();

    params.set('format', 'jsonv2');
    params.set('limit', '10');
    params.set('addressdetails', '1');
    params.set('namedetails', '1');
    params.set('countrycodes', 'in');
    params.set('q', q);

    if (latValue && lonValue) {
      const lat = Number(latValue);
      const lon = Number(lonValue);

      if (!isValidCoordinate(lat, lon)) {
        return NextResponse.json(
          {
            error:
              'Invalid hospital search coordinates.',
          },
          { status: 400 }
        );
      }

      params.set(
        'viewbox',
        buildNearbyViewbox(lat, lon)
      );

      params.set('bounded', '1');
    }

    const response = await fetch(
      `${NOMINATIM_SEARCH_URL}?${params.toString()}`,
      {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },

        cache: 'no-store',
      }
    );

    const text = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            'Nominatim hospital search failed.',
          details: text,
        },
        { status: 502 }
      );
    }

    let data: unknown;

    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          error:
            'Nominatim returned invalid JSON.',
        },
        { status: 502 }
      );
    }

    if (!Array.isArray(data)) {
      return NextResponse.json(
        {
          error:
            'Nominatim returned an unexpected result.',
        },
        { status: 502 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Hospital search failed.',
      },
      { status: 500 }
    );
  }
}
