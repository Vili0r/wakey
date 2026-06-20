/**
 * Shared catalogue for the "Find an item" challenge.
 *
 * Lives outside the challenge component so the alarm-creation UI (the item
 * picker modal) and the runtime challenge agree on the exact same set.
 *
 * `cocoLabel` must match YOLO26N's `CocoLabelYolo` enum keys — UPPERCASE with
 * underscores (e.g. CHAIR, POTTED_PLANT, CELL_PHONE), NOT the lowercase COCO
 * strings. Detection compares against these exactly.
 */

export type FindItemGridItem = {
  id: string;
  name: string;
  emoji: string;
  cocoLabel: string;
  cocoAliases?: string[];
};

export const FIND_ITEM_GRID: FindItemGridItem[] = [
  { id: 'keyboard', name: 'Keyboard', emoji: '⌨️', cocoLabel: 'KEYBOARD' },
  { id: 'book', name: 'Book', emoji: '📖', cocoLabel: 'BOOK' },
  { id: 'laptop', name: 'Laptop', emoji: '💻', cocoLabel: 'LAPTOP', cocoAliases: ['TV'] },
  { id: 'toilet', name: 'Toilet', emoji: '🚽', cocoLabel: 'TOILET' },
  { id: 'dog', name: 'Dog', emoji: '🐕', cocoLabel: 'DOG' },
  { id: 'cat', name: 'Cat', emoji: '🐈', cocoLabel: 'CAT' },
  { id: 'backpack', name: 'Backpack', emoji: '🎒', cocoLabel: 'BACKPACK', cocoAliases: ['HANDBAG', 'SUITCASE'] },
  { id: 'bottle', name: 'Bottle', emoji: '🍼', cocoLabel: 'BOTTLE' },
  { id: 'refrigerator', name: 'Fridge', emoji: '🧊', cocoLabel: 'REFRIGERATOR' },
  { id: 'cup', name: 'Cup', emoji: '☕', cocoLabel: 'CUP', cocoAliases: ['BOWL', 'WINE_GLASS'] },
  { id: 'plant', name: 'Plant', emoji: '🪴', cocoLabel: 'POTTED_PLANT', cocoAliases: ['VASE'] },
  { id: 'phone', name: 'Phone', emoji: '📱', cocoLabel: 'CELL_PHONE' },
  { id: 'remote', name: 'Remote', emoji: '📺', cocoLabel: 'REMOTE' },
  { id: 'clock', name: 'Clock', emoji: '⏰', cocoLabel: 'CLOCK' },
  { id: 'chair', name: 'Chair', emoji: '🪑', cocoLabel: 'CHAIR', cocoAliases: ['COUCH', 'BENCH', 'DINING_TABLE'] },
];

export const ALL_FIND_ITEM_IDS = FIND_ITEM_GRID.map((i) => i.id);

/** Normalise a stored id list to valid, in-catalogue ids; falls back to all. */
export function resolveFindItemIds(ids?: string[] | null): string[] {
  const valid = (ids ?? []).filter((id) => ALL_FIND_ITEM_IDS.includes(id));
  return valid.length > 0 ? valid : ALL_FIND_ITEM_IDS;
}
