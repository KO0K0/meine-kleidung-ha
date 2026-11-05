import { BadRequestException } from '@nestjs/common';

export type StockStatus = 'available' | 'laundry';
export interface StockBin {
  location: string;
  status: StockStatus;
  quantity: number;
}
export interface InventoryData {
  locations: { id: string; name: string }[];
  stock: Record<string, StockBin[]>;
  preferences?: InventoryPreferences;
}
export interface InventoryPreferences {
  hiddenColors: string[];
  customColors: string[];
  routes: { source: string; destination: string }[];
}
export interface InventoryAction {
  revision: number;
  type:
    | 'transfer'
    | 'stock'
    | 'redistribute'
    | 'location'
    | 'restore'
    | 'preferences';
  preferences?: Partial<InventoryPreferences>;
  entries?: {
    garmentId: number;
    location: string;
    status: StockStatus;
    quantity: number;
  }[];
  destination?: string;
  status?: StockStatus;
  garmentId?: number;
  bins?: StockBin[];
  locationId?: string;
  name?: string;
  restore?: { garmentId: number; bins: StockBin[] }[];
}

export function initialInventory(): InventoryData {
  return {
    locations: [
      { id: 'unassigned', name: 'Noch zuordnen' },
      { id: 'home-a', name: 'Wohnung A' },
      { id: 'home-b', name: 'Wohnung B' },
      { id: 'luggage', name: 'Im Gepäck' },
    ],
    stock: {},
  };
}

export function stockFor(data: InventoryData, id: number): StockBin[] {
  return (
    data.stock[id] ?? [
      { location: 'unassigned', status: 'available', quantity: 1 },
    ]
  );
}

function invalid(message: string): never {
  throw new BadRequestException(message);
}

function validBin(data: InventoryData, bin: StockBin): void {
  if (!bin || !data.locations.some((place) => place.id === bin.location))
    invalid('Unbekannter Ort.');
  if (!['available', 'laundry'].includes(bin.status))
    invalid('Ungültiger Wäschestatus.');
  if (
    !Number.isSafeInteger(bin.quantity) ||
    bin.quantity < 1 ||
    bin.quantity > 10000
  )
    invalid('Bitte eine ganze Menge zwischen 1 und 10000 angeben.');
}

function mergeBins(bins: StockBin[]): StockBin[] {
  const result: StockBin[] = [];
  for (const bin of bins) {
    const existing = result.find(
      (entry) => entry.location === bin.location && entry.status === bin.status,
    );
    if (existing) existing.quantity += bin.quantity;
    else result.push({ ...bin });
  }
  if (result.reduce((sum, bin) => sum + bin.quantity, 0) > 10000)
    invalid('Höchstens 10000 Exemplare pro Artikel.');
  return result.filter((bin) => bin.quantity > 0);
}

function requireGarment(
  id: number | undefined,
  garmentIds: Set<number>,
): number {
  if (!Number.isSafeInteger(id) || !garmentIds.has(id!))
    invalid('Artikel nicht vorhanden oder nicht zugänglich.');
  return id!;
}

function updateLocation(
  data: InventoryData,
  action: InventoryAction,
  newLocationId: string,
): void {
  const name = typeof action.name === 'string' ? action.name.trim() : '';
  if (!name || name.length > 60)
    invalid('Der Ortsname muss 1 bis 60 Zeichen haben.');
  if (
    data.locations.some(
      (place) =>
        place.id !== action.locationId &&
        place.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    )
  )
    invalid('Dieser Ortsname existiert bereits.');
  if (action.locationId) {
    const place = data.locations.find(
      (entry) => entry.id === action.locationId,
    );
    if (!place) invalid('Unbekannter Ort.');
    place.name = name;
    return;
  }
  if (data.locations.length >= 30) invalid('Höchstens 30 Orte möglich.');
  data.locations.push({ id: newLocationId, name });
}

function replaceStock(
  data: InventoryData,
  action: InventoryAction,
  garmentIds: Set<number>,
): void {
  const id = requireGarment(action.garmentId, garmentIds);
  if (!Array.isArray(action.bins) || action.bins.length > 60)
    invalid('Ungültige Mengenverteilung.');
  action.bins.forEach((bin) => validBin(data, bin));
  const bins = mergeBins(action.bins);
  if (action.type === 'redistribute') {
    const total = (entries: StockBin[]) =>
      entries.reduce((sum, bin) => sum + bin.quantity, 0);
    if (total(bins) !== total(stockFor(data, id)))
      invalid('Beim Verteilen muss die Gesamtzahl gleich bleiben.');
  }
  data.stock[id] = bins;
}

function moveQuantity(
  data: InventoryData,
  id: number,
  entry: StockBin,
  action: InventoryAction,
): void {
  validBin(data, entry);
  const bins = structuredClone(stockFor(data, id));
  const source = bins.find(
    (bin) => bin.location === entry.location && bin.status === entry.status,
  );
  if (!source || source.quantity < entry.quantity)
    invalid(
      'Die ausgewählte Menge ist nicht mehr verfügbar. Bitte aktualisieren.',
    );
  const target: StockBin = {
    location: action.destination ?? entry.location,
    status: action.status ?? entry.status,
    quantity: entry.quantity,
  };
  validBin(data, target);
  source.quantity -= entry.quantity;
  data.stock[id] = mergeBins([...bins, target]);
}

function transferStock(
  data: InventoryData,
  action: InventoryAction,
  garmentIds: Set<number>,
): void {
  if (
    !Array.isArray(action.entries) ||
    !action.entries.length ||
    action.entries.length > 500
  )
    invalid('Bitte 1 bis 500 Bestände auswählen.');
  if (!action.destination && !action.status) invalid('Ziel oder Status fehlt.');
  const keys = new Set<string>();
  for (const entry of action.entries) {
    if (!entry) invalid('Ungültige Auswahl.');
    const id = requireGarment(entry.garmentId, garmentIds);
    const key = `${id}/${entry.location}/${entry.status}`;
    if (keys.has(key)) invalid('Ein Bestand wurde doppelt ausgewählt.');
    keys.add(key);
    moveQuantity(data, id, entry, action);
  }
}

// Work on a copy so an invalid later entry cannot partially change a batch.
export function applyInventoryAction(
  current: InventoryData,
  action: InventoryAction,
  garmentIds: Set<number>,
  newLocationId: string,
): InventoryData {
  const data = structuredClone(current);
  switch (action.type) {
    case 'preferences': {
      const prefs = action.preferences;
      if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs))
        invalid('Ungültige Einstellungen.');
      const next = {
        hiddenColors: [],
        customColors: [],
        routes: [],
        ...data.preferences,
      } as InventoryPreferences;
      for (const key of ['hiddenColors', 'customColors'] as const) {
        if (prefs[key] === undefined) continue;
        const values = prefs[key];
        if (
          !Array.isArray(values) ||
          values.length > 100 ||
          values.some(
            (value) =>
              typeof value !== 'string' || !value.trim() || value.length > 60,
          )
        )
          invalid('Höchstens 100 Farben mit jeweils 1 bis 60 Zeichen.');
        next[key] = [...new Set(values.map((value) => value.trim()))];
      }
      if (prefs.routes !== undefined) {
        if (
          !Array.isArray(prefs.routes) ||
          prefs.routes.length > 20 ||
          prefs.routes.some(
            (route) =>
              !route ||
              route.source === route.destination ||
              !data.locations.some((p) => p.id === route.source) ||
              !data.locations.some((p) => p.id === route.destination),
          )
        )
          invalid(
            'Bitte unterschiedliche vorhandene Orte wählen (höchstens 20 Richtungen).',
          );
        next.routes = prefs.routes.map(({ source, destination }) => ({
          source,
          destination,
        }));
      }
      data.preferences = next;
      break;
    }
    case 'location':
      updateLocation(data, action, newLocationId);
      break;
    case 'stock':
    case 'redistribute':
      replaceStock(data, action, garmentIds);
      break;
    case 'transfer':
      transferStock(data, action, garmentIds);
      break;
    case 'restore':
      if (
        !Array.isArray(action.restore) ||
        !action.restore.length ||
        action.restore.length > 500
      )
        invalid('Ungültige Auswahl zum Rückgängigmachen.');
      for (const entry of action.restore) {
        if (!entry) invalid('Ungültiger Bestand.');
        replaceStock(
          data,
          { ...entry, type: 'redistribute', revision: action.revision },
          garmentIds,
        );
      }
      break;
    default:
      invalid('Unbekannte Aktion.');
  }
  return data;
}
