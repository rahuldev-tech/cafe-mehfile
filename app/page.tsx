import { redirect } from 'next/navigation';

// Entry point. The table QR codes point here: /?table=T12
// (see app/menu/page.tsx for the app itself).
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const table = Array.isArray(sp.table) ? sp.table[0] : sp.table;
  const qs = new URLSearchParams();
  if (table) qs.set('table', table);
  const q = qs.toString();
  redirect(`/menu${q ? `?${q}` : ''}`);
}