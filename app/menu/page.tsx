import { getServerConfig, toClientConfig } from '@/lib/config';
import { parseTable } from '@/lib/order-core';
import MenuApp from '@/components/MenuApp';

// The ordering app. Table QR codes point here: /menu?table=T12
export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tableRaw = Array.isArray(sp.table) ? sp.table[0] : sp.table;
  const config = getServerConfig();
  const parsed = parseTable(tableRaw ?? '', config.tableCount);

  return (
    <MenuApp
      config={toClientConfig(config)}
      initialTable={tableRaw ?? ''}
      tableState={parsed.ok ? 'ok' : parsed.state}
      tableLabel={parsed.ok ? parsed.table : null}
    />
  );
}