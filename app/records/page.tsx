'use client';

import { useEffect, useState } from 'react';
import {
  FileUp,
  Pill,
  Save,
  AlertTriangle,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { PageHeader } from '../../components/PageHeader';
import { useAuth } from '../../lib/auth-context';
import { createSupabaseBrowser } from '../../lib/supabase-browser';
import type { ExtractedMedication, Medication } from '../../lib/types';
import { toast } from 'sonner';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

export default function RecordsPage() {
  const { user } = useAuth();

  const [meds, setMeds] = useState<Medication[]>([]);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState('');
  const [extracted, setExtracted] = useState<ExtractedMedication[]>([]);
  const [side, setSide] = useState<
    Record<string, { reported: string; action: string }>
  >({});

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]);

  const load = async () => {
    if (!user) return;

    const s = createSupabaseBrowser();

    const { data, error } = await s
      .from('medications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error(error.message);
    } else {
      setMeds((data || []) as Medication[]);
    }
  };

  const fileToImage = async (file: File) => {
    const downscale = async (source: string) =>
      new Promise<string>((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
          const max = 1600;
          const scale = Math.min(
            1,
            max / Math.max(img.width, img.height)
          );

          const canvas = document.createElement('canvas');

          canvas.width = Math.max(
            1,
            Math.round(img.width * scale)
          );

          canvas.height = Math.max(
            1,
            Math.round(img.height * scale)
          );

          const ctx = canvas.getContext('2d');

          if (!ctx) {
            return reject(
              new Error('Could not prepare image.')
            );
          }

          ctx.drawImage(
            img,
            0,
            0,
            canvas.width,
            canvas.height
          );

          resolve(
            canvas.toDataURL('image/jpeg', 0.82)
          );
        };

        img.onerror = () =>
          reject(new Error('Could not read image.'));

        img.src = source;
      });

    if (file.type.startsWith('image/')) {
      const raw = await new Promise<string>(
        (resolve, reject) => {
          const r = new FileReader();

          r.onload = () => resolve(String(r.result));

          r.onerror = () =>
            reject(new Error('Could not read image.'));

          r.readAsDataURL(file);
        }
      );

      return downscale(raw);
    }

    if (file.type === 'application/pdf') {
      const bytes = new Uint8Array(
        await file.arrayBuffer()
      );

      // Corrected: disableWorker is not part of the installed
      // pdfjs-dist DocumentInitParameters type.
      const pdf = await pdfjsLib.getDocument(bytes).promise;

      const page = await pdf.getPage(1);

      const viewport = page.getViewport({
        scale: 1.7,
      });

      const canvas = document.createElement('canvas');

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error(
          'Could not create a PDF rendering context.'
        );
      }

      await page.render({
        canvasContext: context,
        viewport,
      }).promise;

      return downscale(
        canvas.toDataURL('image/png')
      );
    }

    throw new Error(
      'Upload a JPG/PNG/WebP image or PDF.'
    );
  };

  const upload = async (file: File) => {
    if (!user) return;

    setBusy(true);
    setFileName(file.name);

    try {
      const s = createSupabaseBrowser();

      const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        '_'
      )}`;

      const { error: up } = await s.storage
        .from('medical-records')
        .upload(path, file, {
          contentType: file.type || undefined,
          upsert: false,
        });

      if (up) throw up;

      const image = await fileToImage(file);

      const r = await fetch('/api/groq-extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image }),
      });

      const json = await r.json();

      if (!r.ok) {
        throw new Error(
          json.error || 'Extraction failed.'
        );
      }

      setExtracted(
        Array.isArray(json.medications)
          ? json.medications
          : []
      );

      if (!json.medications?.length) {
        toast.info(
          'No medication was clearly visible in this document. Nothing was suggested.'
        );
      } else {
        toast.success(
          'Document scanned. Review before approval.'
        );
      }
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : 'Could not process document.'
      );
    } finally {
      setBusy(false);
    }
  };

  const approve = async (
    item: ExtractedMedication
  ) => {
    if (!user || !item.name) return;

    const s = createSupabaseBrowser();

    const { error } = await s
      .from('medications')
      .insert({
        user_id: user.id,
        name: item.name,
        dosage: item.dosage || null,
        prescribed_for: item.prescribed_for || null,
        added_from: 'record-scan',
      });

    if (error) {
      toast.error(error.message);
    } else {
      setExtracted((x) =>
        x.filter((i) => i !== item)
      );

      await load();

      toast.success(
        'Medication approved and recorded.'
      );
    }
  };

  const saveSide = async (m: Medication) => {
    const v = side[m.id];

    if (!v) return;

    const s = createSupabaseBrowser();

    const { error } = await s
      .from('medications')
      .update({
        side_effects_reported:
          v.reported || null,
        side_effect_action:
          v.action || null,
      })
      .eq('id', m.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Follow-up saved.');
      await load();
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="📄 Records & medications"
        subtitle="Upload a real prescription/report, review what is explicitly visible, then approve only the extracted medication data."
      />

      <div className="grid lg:grid-cols-[.95fr_1.05fr] gap-6">
        <section
          className="app-surface rounded-3xl p-6"
          style={{
            borderColor:
              'color-mix(in srgb,var(--indigo) 35%, var(--border))',
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="h-11 w-11 rounded-xl flex items-center justify-center"
              style={{
                background:
                  'color-mix(in srgb,var(--indigo) 12%,var(--surface))',
                color: 'var(--indigo)',
              }}
            >
              <FileUp />
            </div>

            <div>
              <h2 className="text-xl font-black">
                Add from a record
              </h2>

              <p
                className="text-sm mt-1"
                style={{ color: 'var(--muted)' }}
              >
                JPG, PNG, WebP or PDF. Stored privately in
                Supabase Storage.
              </p>
            </div>
          </div>

          <input
            id="record"
            className="hidden"
            type="file"
            accept="image/*,.pdf,application/pdf"
            onChange={(e) => {
              const f = e.target.files?.[0];

              if (f) upload(f);
            }}
          />

          <label
            htmlFor="record"
            className="mt-6 block rounded-2xl border-2 border-dashed p-7 text-center cursor-pointer"
            style={{
              borderColor: 'var(--border)',
            }}
          >
            <FileText
              className="mx-auto"
              size={28}
            />

            <div className="font-black mt-3">
              {busy
                ? 'Processing document…'
                : fileName ||
                  'Choose a prescription or report'}
            </div>

            <div
              className="text-sm mt-1"
              style={{
                color: 'var(--muted)',
              }}
            >
              Nothing is written to medications until you
              approve it.
            </div>
          </label>

          <div
            className="mt-5 rounded-2xl p-4"
            style={{
              background: 'var(--surface-strong)',
            }}
          >
            <div className="font-bold flex gap-2">
              <AlertTriangle
                size={18}
                style={{
                  color: 'var(--warning)',
                }}
              />
              Safety rule
            </div>

            <div
              className="text-sm mt-2"
              style={{
                color: 'var(--muted)',
              }}
            >
              Tholan can only record medication information
              that is visible in the uploaded document. It
              never generates a new medication or dosage.
            </div>
          </div>
        </section>

        <section className="app-surface rounded-3xl p-6">
          <h2 className="text-xl font-black">
            Review & approve
          </h2>

          {extracted.length === 0 ? (
            <div
              className="mt-6 rounded-2xl border p-6 text-center"
              style={{
                borderColor: 'var(--border)',
              }}
            >
              <CheckCircle2
                className="mx-auto"
                size={28}
                style={{
                  color: 'var(--success)',
                }}
              />

              <p className="font-bold mt-3">
                No pending extraction
              </p>

              <p
                className="text-sm mt-1"
                style={{
                  color: 'var(--muted)',
                }}
              >
                Upload a real document to see the fields
                found by the vision model.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {extracted.map((m, i) => (
                <div
                  key={i}
                  className="rounded-2xl border p-4"
                  style={{
                    borderColor: 'var(--warning)',
                  }}
                >
                  <div className="grid md:grid-cols-3 gap-4">
                    <FieldView
                      label="Medication name"
                      value={m.name}
                    />

                    <FieldView
                      label="Dosage visible"
                      value={
                        m.dosage || 'Not visible'
                      }
                    />

                    <FieldView
                      label="Associated condition"
                      value={
                        m.prescribed_for ||
                        'Not visible'
                      }
                    />
                  </div>

                  {m.source_excerpt && (
                    <div
                      className="text-xs mt-3"
                      style={{
                        color: 'var(--muted)',
                      }}
                    >
                      Document text: {m.source_excerpt}
                    </div>
                  )}

                  <button
                    onClick={() => approve(m)}
                    className="mt-4 inline-flex gap-2 items-center rounded-xl px-4 py-2.5 text-white font-black"
                    style={{
                      background: 'var(--success)',
                    }}
                  >
                    <Save size={17} />
                    Approve & record
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="mt-7">
        <h2 className="text-2xl font-black">
          💊 Stored medications
        </h2>

        <p
          className="mt-1"
          style={{
            color: 'var(--muted)',
          }}
        >
          These are the medications you have explicitly
          approved from real records.
        </p>

        <div className="mt-5 grid md:grid-cols-2 gap-5">
          {meds.length === 0 ? (
            <div className="app-surface rounded-2xl p-6">
              <p className="font-bold">
                No medications recorded yet.
              </p>

              <p
                className="text-sm mt-1"
                style={{
                  color: 'var(--muted)',
                }}
              >
                Upload a prescription/report above to
                begin.
              </p>
            </div>
          ) : (
            meds.map((m) => (
              <div
                key={m.id}
                className="app-surface rounded-2xl p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-black text-lg">
                      {m.name}
                    </div>

                    <div
                      className="text-sm mt-1"
                      style={{
                        color: 'var(--muted)',
                      }}
                    >
                      {m.dosage ||
                        'Dosage not recorded'}{' '}
                      · source: {m.added_from || 'record'}
                    </div>

                    {m.prescribed_for && (
                      <div className="text-sm mt-1">
                        For: {m.prescribed_for}
                      </div>
                    )}
                  </div>

                  <Pill
                    style={{
                      color: 'var(--indigo)',
                    }}
                  />
                </div>

                <div
                  className="mt-5 border-t pt-4"
                  style={{
                    borderColor: 'var(--border)',
                  }}
                >
                  <div className="text-sm font-black">
                    Did this cause any side effects? What did
                    you do about it?
                  </div>

                  <textarea
                    value={
                      side[m.id]?.reported ??
                      m.side_effects_reported ??
                      ''
                    }
                    onChange={(e) =>
                      setSide((v) => ({
                        ...v,
                        [m.id]: {
                          reported: e.target.value,
                          action:
                            v[m.id]?.action ??
                            m.side_effect_action ??
                            '',
                        },
                      }))
                    }
                    placeholder="Describe what you noticed…"
                    rows={2}
                    className="w-full mt-2 rounded-xl border px-3 py-2"
                    style={{
                      borderColor: 'var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                    }}
                  />

                  <textarea
                    value={
                      side[m.id]?.action ??
                      m.side_effect_action ??
                      ''
                    }
                    onChange={(e) =>
                      setSide((v) => ({
                        ...v,
                        [m.id]: {
                          reported:
                            v[m.id]?.reported ??
                            m.side_effects_reported ??
                            '',
                          action: e.target.value,
                        },
                      }))
                    }
                    placeholder="What did you do about it?"
                    rows={2}
                    className="w-full mt-2 rounded-xl border px-3 py-2"
                    style={{
                      borderColor: 'var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                    }}
                  />

                  <button
                    onClick={() => saveSide(m)}
                    className="mt-2 rounded-xl px-4 py-2 border font-bold"
                    style={{
                      borderColor: 'var(--border)',
                    }}
                  >
                    Save follow-up
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </AppShell>
  );
}

function FieldView({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div
        className="text-xs font-bold uppercase tracking-wide"
        style={{
          color: 'var(--muted)',
        }}
      >
        {label}
      </div>

      <div className="mt-1 font-semibold">
        {value}
      </div>
    </div>
  );
}
