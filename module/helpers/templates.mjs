/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @returns {Promise}
 */
export const preloadHandlebarsTemplates = async function () {
  const templatePaths = [
    // Actor partials
    "systems/rogue-trader/templates/actor/character-sheet.hbs",
    "systems/rogue-trader/templates/actor/npc-sheet.hbs",

    // Item partials
    "systems/rogue-trader/templates/item/trait-sheet.hbs",
    "systems/rogue-trader/templates/item/weapon-sheet.hbs",
    "systems/rogue-trader/templates/item/power-sheet.hbs",
    "systems/rogue-trader/templates/item/gear-sheet.hbs",

    // Dialog partials
    "systems/rogue-trader/templates/dialog/roll-dialog.hbs"
  ];

  return loadTemplates(templatePaths);
};
