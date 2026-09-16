import { NextResponse } from 'next/server';

const NOMINATIM_REVERSE_URL =
  'https://nominatim.openstreetmap.org/reverse';

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

export async function GET(req: Request) {
  const requestUrl = new URL(req.url);

  const latValue =
    requestUrl.searchParams.get('lat');
  const lonValue =
    requestUrl.searchParams.get('lon');

  if (!latValue || !lonValue) {
    return NextResponse.json(
      {
        error: 'Coordinates are required.',
      },
      { status: 400 }
    );
  }

  const lat = Number(latValue);
  const lon = Number(lonValue);

  if (!isValidCoordinate(lat, lon)) {
    return NextResponse.json(
      {
        error: 'Invalid coordinates.',
      },
      { status: 400 }
    );
  }

  try {
    const params = new URLSearchParams({
      format: 'jsonv2',
      lat: String(lat),
      lon: String(lon),
      addressdetails: '1',
      zoom: '18',
    });

    const response = await fetch(
      `${NOMINATIM_REVERSE_URL}?${params.toString()}`,
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
            'Reverse geocoding failed.',
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
            'Reverse geocoding returned invalid JSON.',
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
            : 'Reverse geocoding failed.',
      },
      { status: 500 }
    );
  }
}
