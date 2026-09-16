import { NextResponse } from 'next/server';

const OSRM_URL =
  'https://router.project-osrm.org/route/v1/driving';

const USER_AGENT =
  'Tholan/1.0 (health emergency platform)';

export async function GET(req: Request) {
  const requestUrl = new URL(req.url);

  const from = requestUrl.searchParams.get('from');
  const to = requestUrl.searchParams.get('to');

  if (!from || !to) {
    return NextResponse.json(
      {
        error: 'from and to are required.',
      },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `${OSRM_URL}/${encodeURIComponent(
        from
      )};${encodeURIComponent(
        to
      )}?overview=full&geometries=geojson`,
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
          error: 'Routing service failed.',
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
            'Routing service returned invalid JSON.',
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
            : 'Routing service failed.',
      },
      { status: 500 }
    );
  }
}
