/**
 * Show a dialog for rolling a characteristic test with modifier input
 * @param {Actor} actor - The actor making the roll
 * @param {string} charKey - The characteristic key (ws, bs, s, t, ag, int, per, wp, fel)
 * @param {object} options - Additional options
 * @param {string} options.weaponName - Name of the weapon if this is a weapon attack
 * @param {string} options.attackType - The attack type (melee/ranged) for filtering combat actions
 * @returns {Promise<object>} The roll result
 */
export async function rollCharacteristicDialog(actor, charKey, options = {}) {
  const char = actor.system.characteristics[charKey];
  if (!char) return null;

  const charLabel = game.i18n.localize(CONFIG.ROGUE_TRADER.characteristics[charKey]);
  const isAttack = !!options.weaponName;
  const title = isAttack
    ? `${options.weaponName} Attack (${charLabel})`
    : `${charLabel} Test`;

  // Prepare difficulties with localized labels
  const difficulties = {};
  for (const [key, diff] of Object.entries(CONFIG.ROGUE_TRADER.testDifficulty)) {
    difficulties[key] = {
      modifier: diff.modifier,
      label: game.i18n.localize(diff.label)
    };
  }

  // Prepare combat actions filtered by attack type
  const combatActions = {};
  const attackType = options.attackType || (charKey === "ws" ? "melee" : "ranged");
  for (const [key, action] of Object.entries(CONFIG.ROGUE_TRADER.combatActions)) {
    // Include if it matches attack type or is "both"
    if (action.type === "both" || action.type === attackType) {
      combatActions[key] = {
        modifier: action.modifier,
        label: game.i18n.localize(action.label)
      };
    }
  }

  // Build dialog content
  const content = await renderTemplate(
    "systems/rogue-trader/templates/dialog/roll-dialog.hbs",
    {
      characteristic: charLabel,
      baseValue: char.total,
      modifier: char.modifier || 0,
      hasModifier: char.modifier !== 0,
      isAttack: isAttack,
      difficulties: difficulties,
      combatActions: combatActions
    }
  );

  return new Promise((resolve) => {
    new Dialog({
      title: title,
      content: content,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice"></i>',
          label: "Roll",
          callback: async (html) => {
            // Get modifier from difficulty/combat action + extra modifier
            let situationalMod = 0;
            if (isAttack) {
              situationalMod = parseInt(html.find('[name="combatAction"]').val()) || 0;
            } else {
              situationalMod = parseInt(html.find('[name="difficulty"]').val()) || 0;
            }
            const extraMod = parseInt(html.find('[name="modifier"]').val()) || 0;
            const modifier = situationalMod + extraMod;

            const result = await actor.rollCharacteristic(charKey, {
              modifier,
              isAttack: isAttack,
              weaponName: options.weaponName
            });
            resolve(result);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel",
          callback: () => resolve(null)
        }
      },
      default: "roll",
      render: (html) => {
        // Update target number display when any modifier changes
        const baseValue = char.total;
        const modifierInput = html.find('[name="modifier"]');
        const actionSelect = html.find('[name="combatAction"], [name="difficulty"]');
        const targetDisplay = html.find(".target-number");

        const updateTarget = () => {
          const situationalMod = parseInt(actionSelect.val()) || 0;
          const extraMod = parseInt(modifierInput.val()) || 0;
          const target = baseValue + situationalMod + extraMod;
          targetDisplay.text(target);
        };

        modifierInput.on("input", updateTarget);
        actionSelect.on("change", updateTarget);

        // Focus the modifier input
        modifierInput.focus().select();
      },
      close: () => resolve(null)
    }).render(true);
  });
}

/**
 * Calculate degrees of success or failure
 * @param {number} roll - The roll result
 * @param {number} target - The target number
 * @returns {object} Object with isSuccess and degrees
 */
export function calculateDegrees(roll, target) {
  const isSuccess = roll <= target;
  const difference = Math.abs(target - roll);
  const degrees = Math.floor(difference / 10);

  return { isSuccess, degrees };
}

/**
 * Determine hit location by reversing the d100 roll digits
 * @param {number} roll - The d100 roll result (1-100)
 * @returns {object} Object with location key and label
 */
export function getHitLocation(roll) {
  // Reverse the digits of the roll to get hit location
  // e.g., 34 -> 43, 05 -> 50, 91 -> 19, 100 -> 001 -> 1
  let reversed;
  if (roll === 100) {
    reversed = 1; // 100 reversed is 001 = 1
  } else {
    const tens = Math.floor(roll / 10);
    const ones = roll % 10;
    reversed = (ones * 10) + tens;
    if (reversed === 0) reversed = 100; // 00 reversed is still 00, treat as 100
  }

  // Find the hit location based on reversed value
  const locations = CONFIG.ROGUE_TRADER.hitLocations;
  for (const [key, loc] of Object.entries(locations)) {
    if (reversed >= loc.range[0] && reversed <= loc.range[1]) {
      return {
        key: key,
        label: game.i18n.localize(loc.label),
        reversed: reversed
      };
    }
  }

  // Fallback to body
  return {
    key: "body",
    label: game.i18n.localize(locations.body.label),
    reversed: reversed
  };
}
