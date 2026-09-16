'use client';

import { useEffect, useState } from 'react';
import {
  Phone,
  MessageSquare,
  Siren,
  MapPin,
  AlertTriangle,
  Navigation,
  ShieldAlert,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { AppShell } from '../../components/AppShell';
import { PageHeader } from '../../components/PageHeader';
import { useAuth } from '../../lib/auth-context';
import { createSupabaseBrowser } from '../../lib/supabase-browser';
import type {
  Condition,
  Medication,
  Hospital,
  EmergencyContact,
} from '../../lib/types';
import { t } from '../../lib/i18n';
import { toast } from 'sonner';

const LeafletMap = dynamic(
  () =>
    import('../../components/LeafletMap').then(
      (m) => m.LeafletMap
    ),
  { ssr: false }
);

const severities = [
  'Low',
  'Moderate',
  'High',
  'Critical',
] as const;

type Severity = (typeof severities)[number];

type FirstAidGuide = Record<string, string[]>;

const aids: Record<'en' | 'ta', FirstAidGuide> = {
  en: {
    'Dizziness / low BP': [
      'Sit or lie down somewhere safe and avoid standing suddenly.',
      'If awake and able to swallow, consider normal fluids while arranging medical assessment.',
      'Seek urgent care for fainting, chest pain, severe breathlessness, confusion, weakness on one side, or ongoing symptoms.',
    ],

    'Heat stroke': [
      'Move to a cool place and remove excess clothing.',
      'Cool the person promptly with cool wet cloths/fanning or other available cooling measures.',
      'Heat stroke is an emergency: call for urgent medical help, especially with confusion, collapse, or seizures.',
    ],

    'Snake bite': [
      'Keep the person calm and still; immobilize the affected limb if possible.',
      'Seek urgent medical care immediately and avoid cutting, sucking, or applying a tourniquet to the bite.',
      'Do not delay transport while trying home remedies.',
    ],
  },

  ta: {
    'மயக்கம் / குறைந்த இரத்த அழுத்தம்': [
      'பாதுகாப்பான இடத்தில் உட்காருங்கள் அல்லது படுத்துக்கொள்ளுங்கள்; திடீரென எழுந்திருக்க வேண்டாம்.',
      'விழிப்புடன் விழுங்க முடிந்தால், மருத்துவ உதவி ஏற்பாடு செய்யும் போது சாதாரண திரவங்களை பரிசீலிக்கலாம்.',
      'மயக்கம், மார்பு வலி, கடுமையான மூச்சுத்திணறல், குழப்பம் அல்லது நீடிக்கும் அறிகுறிகள் இருந்தால் அவசர உதவி பெறுங்கள்.',
    ],

    'வெப்ப அதிர்ச்சி': [
      'குளிர்ந்த இடத்துக்கு மாற்றி, அதிகமான ஆடைகளை அகற்றுங்கள்.',
      'குளிர்ந்த ஈரத் துணி/விசிறி போன்றவற்றால் உடலை விரைவாக குளிர்விக்கவும்.',
      'குழப்பம், சரிவு அல்லது fits இருந்தால் உடனடி மருத்துவ உதவி தேவை.',
    ],

    'பாம்பு கடி': [
      'அமைதியாக வைத்துக் கொண்டு, பாதிக்கப்பட்ட உறுப்பை முடிந்தால் அசையாமல் வைத்திருங்கள்.',
      'உடனடி மருத்துவமனை உதவியை நாடுங்கள்; காயத்தை வெட்டவோ, உறிஞ்சவோ, tourniquet போடவோ வேண்டாம்.',
      'வீட்டு வைத்தியத்திற்காக போக்குவரத்தை தாமதிக்க வேண்டாம்.',
    ],
  },
};

type HospitalResult = {
  display_name?: string;
  lat?: string | number;
  lon?: string | number;
  importance?: number;
  type?: string;
  category?: string;
  address?: Record<string, string>;
};

type SelectedHospital = {
  name: string;
  lat: number;
  lon: number;
  phone?: string;
  distanceKm?: number;
};

const toRadians = (value: number) =>
  (value * Math.PI) / 180;

const distanceKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) => {
  const earthRadiusKm = 6371;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return (
    2 *
    earthRadiusKm *
    Math.asin(Math.sqrt(a))
  );
};

function validHospitalResult(
  item: HospitalResult
): item is Required<
  Pick<HospitalResult, 'lat' | 'lon'>
> &
  HospitalResult {
  const lat = Number(item.lat);
  const lon = Number(item.lon);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

export default function EmergencyPage() {
  const { user, profile, lang } = useAuth();

  const [severity, setSeverity] =
    useState<Severity>('High');

  const [count, setCount] = useState(10);
  const [running, setRunning] = useState(false);
  const [executed, setExecuted] =
    useState(false);

  const [coords, setCoords] =
    useState<[number, number] | null>(null);

  const [hospital, setHospital] =
    useState<SelectedHospital>();

  const [route, setRoute] = useState<
    [number, number][]
  >([]);

  const [records, setRecords] = useState<{
    conditions: Condition[];
    medications: Medication[];
    primary?: Hospital;
    contact?: EmergencyContact;
  }>({
    conditions: [],
    medications: [],
  });

  const [lookupLoading, setLookupLoading] =
    useState(false);

  const [generic, setGeneric] =
    useState(false);

  const [placeName, setPlaceName] =
    useState('');

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    setGeneric(
      params.get('generic') === '1'
    );
  }, []);

  useEffect(() => {
    if (
      !user ||
      !profile?.onboarding_complete
    ) {
      return;
    }

    const supabase =
      createSupabaseBrowser();

    Promise.all([
      supabase
        .from('conditions')
        .select('*')
        .order('created_at', {
          ascending: false,
        }),

      supabase
        .from('medications')
        .select('*')
        .order('created_at', {
          ascending: false,
        }),

      supabase
        .from('hospitals')
        .select('*')
        .eq('is_primary', true)
        .limit(1),

      supabase
        .from('emergency_contacts')
        .select('*')
        .order('created_at', {
          ascending: true,
        })
        .limit(1),
    ]).then(([conditions, medications, hospitals, contacts]) => {
      const error =
        conditions.error ||
        medications.error ||
        hospitals.error ||
        contacts.error;

      if (error) {
        toast.error(
          'Emergency profile data could not be loaded.'
        );
        return;
      }

      setRecords({
        conditions:
          (conditions.data || []) as Condition[],

        medications:
          (medications.data || []) as Medication[],

        primary:
          (hospitals.data || [])[0] as
            | Hospital
            | undefined,

        contact:
          (contacts.data || [])[0] as
            | EmergencyContact
            | undefined,
      });
    });
  }, [user, profile]);

  useEffect(() => {
    if (generic) {
      setSeverity('High');
      setCount(10);
      setRunning(true);
    }
  }, [generic]);

  useEffect(() => {
    if (!running) return;

    const timer = window.setInterval(() => {
      setCount((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setRunning(false);
          setExecuted(true);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [running]);

  useEffect(() => {
    if (!executed) return;

    if (!navigator.geolocation) {
      toast.error(
        'This browser does not expose geolocation.'
      );
      return;
    }

    let cancelled = false;

    setLookupLoading(true);
    setHospital(undefined);
    setRoute([]);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (cancelled) return;

        const latitude =
          position.coords.latitude;

        const longitude =
          position.coords.longitude;

        const currentCoords: [
          number,
          number
        ] = [latitude, longitude];

        setCoords(currentCoords);

        try {
          const useNearest =
            generic ||
            severity === 'High' ||
            severity === 'Critical';

          let results: HospitalResult[] = [];

          /*
           * Reverse geocode the user's current position.
           * This is for human-readable location display.
           */
          const reverseResponse = await fetch(
            `/api/location/reverse?lat=${latitude}&lon=${longitude}`,
            {
              cache: 'no-store',
            }
          );

          if (reverseResponse.ok) {
            const reverseJson =
              await reverseResponse.json();

            if (!cancelled) {
              setPlaceName(
                reverseJson?.display_name ||
                  reverseJson?.name ||
                  'Current device location'
              );
            }
          }

          if (useNearest) {
            /*
             * Respect Nominatim's public-service
             * request-rate policy by spacing external
             * calls.
             */
            await new Promise((resolve) =>
              setTimeout(resolve, 1100)
            );

            const searchUrl =
              `/api/nominatim?q=${encodeURIComponent(
                '[hospital]'
              )}&lat=${latitude}&lon=${longitude}`;

            const hospitalResponse =
              await fetch(searchUrl, {
                cache: 'no-store',
              });

            const hospitalJson =
              await hospitalResponse
                .json()
                .catch(() => null);

            if (!hospitalResponse.ok) {
              throw new Error(
                hospitalJson?.details ||
                  hospitalJson?.error ||
                  'Nearby hospital search failed.'
              );
            }

            results = Array.isArray(hospitalJson)
              ? (hospitalJson as HospitalResult[])
              : [];
          } else if (records.primary) {
            /*
             * Search for the user's stored primary
             * hospital using its real stored name.
             */
            await new Promise((resolve) =>
              setTimeout(resolve, 1100)
            );

            const primaryQuery =
              `${records.primary.name}, India`;

            const primaryResponse =
              await fetch(
                `/api/nominatim?q=${encodeURIComponent(
                  primaryQuery
                )}&lat=${latitude}&lon=${longitude}`,
                {
                  cache: 'no-store',
                }
              );

            const primaryJson =
              await primaryResponse
                .json()
                .catch(() => null);

            if (!primaryResponse.ok) {
              throw new Error(
                primaryJson?.details ||
                  primaryJson?.error ||
                  'Preferred hospital lookup failed.'
              );
            }

            results = Array.isArray(primaryJson)
              ? (primaryJson as HospitalResult[])
              : [];

            /*
             * If the name search finds nothing, retry
             * without coordinate bounding. This still
             * searches the real stored hospital name,
             * rather than inventing a fallback hospital.
             */
            if (!results.length) {
              await new Promise((resolve) =>
                setTimeout(resolve, 1100)
              );

              const fallbackResponse =
                await fetch(
                  `/api/nominatim?q=${encodeURIComponent(
                    primaryQuery
                  )}`,
                  {
                    cache: 'no-store',
                  }
                );

              const fallbackJson =
                await fallbackResponse
                  .json()
                  .catch(() => null);

              if (!fallbackResponse.ok) {
                throw new Error(
                  fallbackJson?.details ||
                    fallbackJson?.error ||
                    'Preferred hospital lookup failed.'
                );
              }

              results = Array.isArray(
                fallbackJson
              )
                ? (fallbackJson as HospitalResult[])
                : [];
            }
          }

          if (!results.length) {
            throw new Error(
              useNearest
                ? 'No nearby hospital was found in OpenStreetMap for this location.'
                : 'The preferred hospital could not be found in OpenStreetMap.'
            );
          }

          const usableResults =
            results.filter(validHospitalResult);

          if (!usableResults.length) {
            throw new Error(
              'Hospital results did not contain usable coordinates.'
            );
          }

          /*
           * Always select the geographically closest
           * valid result from the returned candidates.
           */
          const ranked = usableResults
            .map((item) => ({
              ...item,
              distanceKm: distanceKm(
                latitude,
                longitude,
                Number(item.lat),
                Number(item.lon)
              ),
            }))
            .sort(
              (a, b) =>
                a.distanceKm -
                b.distanceKm
            );

          const selected = ranked[0];

          if (cancelled) return;

          const selectedHospital: SelectedHospital =
            {
              name:
                selected.display_name
                  ?.split(',')
                  .slice(0, 2)
                  .join(',')
                  .trim() ||
                records.primary?.name ||
                'Hospital',

              lat: Number(selected.lat),
              lon: Number(selected.lon),

              /*
               * The stored primary hospital phone
               * remains the only real hospital phone
               * available for calling.
               *
               * Nominatim does not become a source of
               * phone numbers here.
               */
              phone:
                !useNearest
                  ? records.primary
                      ?.phone_number
                  : undefined,

              distanceKm:
                selected.distanceKm,
            };

          setHospital(selectedHospital);

          /*
           * Wait before the OSRM request as well.
           */
          await new Promise((resolve) =>
            setTimeout(resolve, 1100)
          );

          if (cancelled) return;

          const routeResponse =
            await fetch(
              `/api/osrm?from=${longitude},${latitude}&to=${selectedHospital.lon},${selectedHospital.lat}`,
              {
                cache: 'no-store',
              }
            );

          const routeJson =
            await routeResponse
              .json()
              .catch(() => null);

          if (!routeResponse.ok) {
            throw new Error(
              routeJson?.error ||
                'Routing service failed.'
            );
          }

          const coordinates =
            routeJson?.routes?.[0]?.geometry
              ?.coordinates;

          const line: [number, number][] =
            Array.isArray(coordinates)
              ? coordinates
                  .filter(
                    (point: unknown) =>
                      Array.isArray(point) &&
                      point.length >= 2 &&
                      Number.isFinite(
                        Number(point[0])
                      ) &&
                      Number.isFinite(
                        Number(point[1])
                      )
                  )
                  .map(
                    (
                      point: [
                        number,
                        number
                      ]
                    ) =>
                      [
                        Number(point[1]),
                        Number(point[0]),
                      ] as [
                        number,
                        number
                      ]
                  )
              : [];

          if (!cancelled) {
            setRoute(line);

            if (!line.length) {
              toast.info(
                'Hospital found, but route geometry is unavailable right now.'
              );
            }
          }
        } catch (error) {
          if (!cancelled) {
            toast.error(
              error instanceof Error
                ? error.message
                : 'Could not build the emergency route.'
            );
          }
        } finally {
          if (!cancelled) {
            setLookupLoading(false);
          }
        }
      },

      () => {
        if (cancelled) return;

        setLookupLoading(false);

        toast.error(
          'Location permission was not granted. You can still use the phone actions below.'
        );
      },

      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );

    return () => {
      cancelled = true;
    };
  }, [
    executed,
    generic,
    severity,
    records.primary,
  ]);

  const cancel = () => {
    setRunning(false);
    setCount(10);

    if (generic) {
      toast.info(
        'Generic emergency countdown cancelled.'
      );
    }
  };

  const start = () => {
    setCount(10);
    setExecuted(false);
    setRunning(true);
    setCoords(null);
    setHospital(undefined);
    setRoute([]);
    setPlaceName('');
  };

  const currentAid: FirstAidGuide = generic
    ? {}
    : lang === 'ta'
      ? aids.ta
      : aids.en;

  const smsText =
    `Tholan emergency alert: ${
      profile?.name || 'I'
    } may need help. Severity: ${severity}. Please check on me.`;

  return (
    <AppShell>
      <PageHeader
        title="🚨 Emergency"
        subtitle="Fast, explicit actions with a visible countdown. Hospital notification is permanently simulated and never transmitted."
      />

      <div
        className="app-surface rounded-3xl p-5 md:p-7"
        style={{
          borderColor:
            'color-mix(in srgb,var(--danger) 38%,var(--border))',
        }}
      >
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div>
            <div
              className="text-sm font-black uppercase tracking-wider"
              style={{
                color: 'var(--danger)',
              }}
            >
              Emergency protocol
            </div>

            <h2 className="text-2xl font-black mt-1">
              Select current severity
            </h2>
          </div>

          <div className="flex gap-2 flex-wrap">
            {severities.map((level) => (
              <button
                key={level}
                disabled={running || generic}
                onClick={() =>
                  setSeverity(level)
                }
                className="rounded-full px-4 py-2 border font-black"
                style={{
                  borderColor:
                    severity === level
                      ? 'var(--danger)'
                      : 'var(--border)',

                  background:
                    severity === level
                      ? 'color-mix(in srgb,var(--danger) 12%,var(--surface))'
                      : 'var(--surface)',

                  color:
                    severity === level
                      ? 'var(--danger)'
                      : 'var(--text)',
                }}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {running && (
          <div className="mt-7 text-center">
            <div
              className="text-7xl font-black"
              style={{
                color: 'var(--danger)',
              }}
            >
              {count}
            </div>

            <div className="font-bold">
              Confirming in seconds unless cancelled
            </div>

            <button
              onClick={cancel}
              className="mt-5 rounded-xl border px-6 py-3 font-black"
              style={{
                borderColor: 'var(--border)',
              }}
            >
              Cancel emergency flow
            </button>
          </div>
        )}

        {!running && !executed && (
          <div
            className="mt-6 rounded-2xl p-5"
            style={{
              background:
                'color-mix(in srgb,var(--danger) 8%,var(--surface))',
            }}
          >
            <div className="flex items-start gap-3">
              <ShieldAlert
                style={{
                  color: 'var(--danger)',
                }}
              />

              <div>
                <div className="font-bold">
                  10-second visible confirmation
                </div>

                <p
                  className="text-sm mt-1"
                  style={{
                    color: 'var(--muted)',
                  }}
                >
                  No emergency escalation starts
                  until the countdown reaches zero.
                </p>
              </div>
            </div>

            <button
              onClick={start}
              className="mt-5 w-full md:w-auto rounded-xl px-8 py-4 text-white font-black text-lg"
              style={{
                background: 'var(--danger)',
              }}
            >
              <Siren
                className="inline mr-2"
                size={21}
              />

              Start emergency protocol
            </button>
          </div>
        )}

        {executed && (
          <>
            <div className="mt-7 grid lg:grid-cols-[1.05fr_.95fr] gap-6">
              <section
                className="rounded-2xl overflow-hidden border min-h-[390px]"
                style={{
                  borderColor: 'var(--border)',
                }}
              >
                {coords ? (
                  <LeafletMap
                    user={coords}
                    hospital={hospital}
                    route={route}
                  />
                ) : (
                  <div className="h-full min-h-[390px] flex items-center justify-center">
                    <div className="text-center p-6">
                      <MapPin
                        className="mx-auto"
                        style={{
                          color: 'var(--danger)',
                        }}
                      />

                      <div className="font-black mt-2">
                        {lookupLoading
                          ? 'Finding a real hospital and route…'
                          : 'Location unavailable'}
                      </div>

                      <div
                        className="text-sm mt-1"
                        style={{
                          color: 'var(--muted)',
                        }}
                      >
                        Allow location access to
                        populate the map.
                      </div>
                    </div>
                  </div>
                )}
              </section>

              <section className="space-y-4">
                <div
                  className="rounded-2xl p-4 border"
                  style={{
                    borderColor: 'var(--border)',
                  }}
                >
                  <div className="font-black">
                    {hospital?.name ||
                      'Hospital search pending'}
                  </div>

                  {hospital?.distanceKm !==
                    undefined && (
                    <div
                      className="text-xs mt-2"
                      style={{
                        color: 'var(--muted)',
                      }}
                    >
                      Approx.{' '}
                      {hospital.distanceKm.toFixed(
                        1
                      )}{' '}
                      km away
                    </div>
                  )}

                  <div
                    className="text-sm mt-2"
                    style={{
                      color: 'var(--muted)',
                    }}
                  >
                    {generic
                      ? 'Generic protocol: nearest hospital search'
                      : severity === 'High' ||
                          severity === 'Critical'
                        ? 'High/Critical: nearest hospital lookup'
                        : 'Low/Moderate: stored primary hospital lookup'}
                  </div>
                </div>

                <div className="grid gap-3">
                  <a
                    href="tel:108"
                    className="rounded-xl px-4 py-3 text-white font-black text-center"
                    style={{
                      background: 'var(--danger)',
                    }}
                  >
                    <Phone
                      className="inline mr-2"
                      size={18}
                    />
                    {t(lang, 'callAmbulance')} · 108
                  </a>

                  {records.primary && (
                    <a
                      href={`tel:${records.primary.phone_number}`}
                      className="rounded-xl px-4 py-3 border font-black text-center"
                      style={{
                        borderColor:
                          'var(--border)',
                      }}
                    >
                      <Phone
                        className="inline mr-2"
                        size={18}
                      />
                      {t(
                        lang,
                        'callHospital'
                      )}
                    </a>
                  )}

                  {records.contact && (
                    <a
                      href={`tel:${records.contact.phone_number}`}
                      className="rounded-xl px-4 py-3 border font-black text-center"
                      style={{
                        borderColor:
                          'var(--border)',
                      }}
                    >
                      <Phone
                        className="inline mr-2"
                        size={18}
                      />
                      {t(
                        lang,
                        'callContact'
                      )}{' '}
                      · {records.contact.name}
                    </a>
                  )}

                  {records.contact && (
                    <a
                      href={`sms:${records.contact.phone_number}?body=${encodeURIComponent(
                        smsText
                      )}`}
                      className="rounded-xl px-4 py-3 border font-black text-center"
                      style={{
                        borderColor:
                          'var(--success)',
                      }}
                    >
                      <MessageSquare
                        className="inline mr-2"
                        size={18}
                      />
                      SMS emergency contact
                    </a>
                  )}
                </div>

                <div
                  className="rounded-2xl p-4"
                  style={{
                    background:
                      'color-mix(in srgb,var(--warning) 11%,var(--surface))',
                  }}
                >
                  <div
                    className="font-black"
                    style={{
                      color: 'var(--warning)',
                    }}
                  >
                    📩 SIMULATED — NOT SENT
                  </div>

                  <p className="text-sm mt-2">
                    Exactly what a hospital message
                    would contain (display only):
                  </p>

                  <pre className="mt-3 text-xs whitespace-pre-wrap font-sans">
                    Name: {profile?.name || 'Not recorded'}
                    {'\n'}
                    Age: {profile?.age ?? 'Not recorded'}
                    {'\n'}
                    Severity: {severity}
                    {'\n'}
                    Conditions:{' '}
                    {records.conditions
                      .map((item) => item.name)
                      .join(', ') ||
                      'None recorded'}
                    {'\n'}
                    Medications:{' '}
                    {records.medications
                      .map(
                        (item) =>
                          `${item.name}${
                            item.dosage
                              ? ` (${item.dosage})`
                              : ''
                          }`
                      )
                      .join(', ') ||
                      'None recorded'}
                  </pre>
                </div>
              </section>
            </div>

            {generic && (
              <div
                className="mt-6 rounded-2xl p-5"
                style={{
                  background:
                    'color-mix(in srgb,var(--warning) 11%,var(--surface))',
                }}
              >
                <div className="font-black">
                  Location handoff · SIMULATED — NOT
                  SENT
                </div>

                <p className="text-sm mt-2">
                  No hospital message has been
                  transmitted. Nominatim identified
                  this emergency location as:{' '}
                  <span className="font-bold">
                    {placeName ||
                      'Current device location'}
                  </span>
                  . Nearby hospital search is
                  informational only.
                </p>

                <a
                  href="/signup-essentials"
                  className="inline-block mt-4 font-bold"
                  style={{
                    color: 'var(--brand)',
                  }}
                >
                  Complete your profile for faster
                  help next time →
                </a>
              </div>
            )}

            {!generic && (
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle
                    size={18}
                    style={{
                      color: 'var(--warning)',
                    }}
                  />

                  <h2 className="text-xl font-black">
                    {lang === 'ta'
                      ? 'முதலுதவி வழிகாட்டல்'
                      : 'First-aid guidance'}
                  </h2>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  {(
                    Object.entries(
                      currentAid
                    ) as [
                      string,
                      string[]
                    ][]
                  ).map(
                    ([title, items]) => (
                      <div
                        key={title}
                        className="app-surface rounded-2xl p-5"
                      >
                        <h3 className="font-black">
                          {title}
                        </h3>

                        <ol className="mt-3 space-y-2 text-sm list-decimal pl-5">
                          {items.map(
                            (item) => (
                              <li
                                key={item}
                              >
                                {item}
                              </li>
                            )
                          )}
                        </ol>

                        <div
                          className="text-[11px] mt-4 font-semibold"
                          style={{
                            color:
                              'var(--warning)',
                          }}
                        >
                          {t(
                            lang,
                            'guidance'
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </>
        )}

        <div
          className="mt-5 text-xs flex items-center gap-2"
          style={{
            color: 'var(--muted)',
          }}
        >
          <Navigation size={14} />
          Native dialing/SMS opens the device's own
          apps. Tholan does not place calls or send SMS
          automatically.
        </div>
      </div>
    </AppShell>
  );
}
