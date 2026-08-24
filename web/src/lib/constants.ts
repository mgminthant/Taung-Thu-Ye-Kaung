/** Optional display-name mappings for known categories and crops.

These are used by the dashboard charts to show prettier labels for values
that were in the original CSV. Any new free-form values fall through to
the raw string (see the `?? value` pattern in chart components).
*/

export const CATEGORY_LABELS: Record<string, string> = {
  cultivation: "Cultivation",
  disease: "Disease",
  fertilizer: "Fertilizer",
  general: "General",
  pest: "Pest",
  prevention: "Prevention",
  water_management: "Water Management",
};

export const CROP_LABELS: Record<string, string> = {
  bean: "Bean",
  cabbage: "Cabbage",
  chili: "Chili",
  eggplant: "Eggplant",
  general: "General",
  maize: "Maize",
  onion: "Onion",
  rice: "Rice",
  tomato: "Tomato",
};
