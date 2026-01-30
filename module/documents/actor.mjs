import { getHitLocation } from "../helpers/dice.mjs";

/**
 * Extend the base Actor document for Rogue Trader
 * @extends {Actor}
 */
export class RogueTraderActor extends Actor {
  /** @override */
  prepareData() {
    super.prepareData();
  }

  /** @override */
  prepareBaseData() {
    // Data modifications in this step occur before processing embedded documents or derived data
  }

  /** @override */
  prepareDerivedData() {
    const actorData = this;
    const systemData = actorData.system;
    const flags = actorData.flags.rogueTrader || {};

    // Prepare data based on actor type
    this._prepareCharacterData(actorData);
    this._prepareNpcData(actorData);
  }

  /**
   * Prepare Character type specific data
   */
  _prepareCharacterData(actorData) {
    if (actorData.type !== "character") return;

    const systemData = actorData.system;

    // Calculate characteristic bonuses and apply trait modifiers
    this._calculateCharacteristics(systemData);
  }

  /**
   * Prepare NPC type specific data
   */
  _prepareNpcData(actorData) {
    if (actorData.type !== "npc") return;

    const systemData = actorData.system;

    // Calculate characteristic bonuses and apply trait modifiers
    this._calculateCharacteristics(systemData);
  }

  /**
   * Calculate characteristic totals and bonuses, including trait modifiers
   */
  _calculateCharacteristics(systemData) {
    // Initialize modifier tracking
    const modifiers = {
      ws: 0, bs: 0, s: 0, t: 0, ag: 0, int: 0, per: 0, wp: 0, fel: 0,
      initiative: 0,
      wounds: 0
    };

    // Gather modifiers from traits
    for (const item of this.items) {
      if (item.type === "trait" && item.system.modifiers) {
        for (const mod of item.system.modifiers) {
          if (mod.stat && modifiers.hasOwnProperty(mod.stat)) {
            modifiers[mod.stat] += Number(mod.value) || 0;
          }
        }
      }
    }

    // Apply modifiers to characteristics and calculate bonuses
    for (const [key, char] of Object.entries(systemData.characteristics)) {
      // Store base value and calculate total
      char.base = char.value;
      char.modifier = modifiers[key] || 0;
      char.total = char.value + char.modifier;
      // Bonus is tens digit of total (e.g., 43 -> 4)
      char.bonus = Math.floor(char.total / 10);
    }

    // Apply initiative bonus from traits
    systemData.initiativeBonus = modifiers.initiative || 0;

    // Apply wounds modifier from traits
    if (modifiers.wounds && systemData.wounds) {
      systemData.wounds.modifier = modifiers.wounds;
      systemData.wounds.effectiveMax = systemData.wounds.max + modifiers.wounds;
    } else if (systemData.wounds) {
      systemData.wounds.modifier = 0;
      systemData.wounds.effectiveMax = systemData.wounds.max;
    }
  }

  /**
   * Roll a characteristic test
   * @param {string} charKey - The characteristic key (ws, bs, s, t, ag, int, per, wp, fel)
   * @param {object} options - Options for the roll
   * @param {number} options.modifier - Modifier to apply to the roll
   * @param {boolean} options.isAttack - Whether this is an attack roll (shows hit location)
   * @param {string} options.weaponName - Name of the weapon (for attack rolls)
   */
  async rollCharacteristic(charKey, options = {}) {
    const char = this.system.characteristics[charKey];
    if (!char) return;

    const label = game.i18n.localize(CONFIG.ROGUE_TRADER.characteristics[charKey]);
    const target = char.total + (options.modifier || 0);

    // Create the roll
    const roll = await new Roll("1d100").evaluate();

    // Determine success/failure and degrees
    const isSuccess = roll.total <= target;
    const degrees = Math.floor(Math.abs(target - roll.total) / 10);

    // Get hit location if this is an attack
    let hitLocationHtml = "";
    let hitLocation = null;
    if (options.isAttack && isSuccess) {
      hitLocation = getHitLocation(roll.total);
      hitLocationHtml = `
        <div class="hit-location">
          <span class="location-label">Hit Location:</span>
          <span class="location-value">${hitLocation.label}</span>
          <span class="location-roll">(reversed: ${hitLocation.reversed})</span>
        </div>
      `;
    }

    // Build chat message
    const resultClass = isSuccess ? "success" : "failure";
    const resultText = isSuccess ? "Success" : "Failure";
    let titleText;
    if (options.powerName) {
      titleText = options.isAttack ? `${options.powerName} (Attack)` : options.powerName;
    } else if (options.weaponName) {
      titleText = `${options.weaponName} Attack`;
    } else {
      titleText = `${label} Test`;
    }

    const messageContent = `
      <div class="rogue-trader roll-result ${options.isAttack ? 'attack-roll' : ''}">
        <h3>${titleText}</h3>
        <div class="roll-details">
          <span class="target">Target: ${target}</span>
          ${options.modifier ? `<span class="modifier">(Base ${char.total} + Modifier ${options.modifier >= 0 ? "+" : ""}${options.modifier})</span>` : ""}
        </div>
        <div class="roll-outcome ${resultClass}">
          <span class="result">${resultText}</span>
          <span class="degrees">${degrees} Degree${degrees !== 1 ? "s" : ""}</span>
        </div>
        ${hitLocationHtml}
      </div>
    `;

    // Send to chat
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: messageContent,
      rollMode: game.settings.get("core", "rollMode")
    });

    return { roll, isSuccess, degrees, hitLocation };
  }

  /**
   * Roll a skill test
   * @param {string} skillKey - The skill key
   * @param {object} options - Options for the roll
   * @param {number} options.modifier - Additional modifier to apply
   * @param {boolean} options.isSpecialization - Whether this is a specialization skill
   * @param {number} options.specIndex - Index of the specialization entry
   */
  async rollSkill(skillKey, options = {}) {
    const skillConfig = options.isSpecialization
      ? CONFIG.ROGUE_TRADER.specializations[skillKey]
      : CONFIG.ROGUE_TRADER.skills[skillKey];

    if (!skillConfig) return;

    // Get the skill data
    let skillData;
    let skillName;
    if (options.isSpecialization) {
      const entries = this.system.specializations?.[skillKey] || [];
      skillData = entries[options.specIndex];
      if (!skillData) return;
      skillName = `${game.i18n.localize(skillConfig.label)} (${skillData.name})`;
    } else {
      skillData = this.system.skills?.[skillKey];
      if (!skillData) return;
      skillName = game.i18n.localize(skillConfig.label);
    }

    // Get the characteristic
    const charKey = skillConfig.char;
    const char = this.system.characteristics[charKey];
    if (!char) return;

    // Calculate target number
    const isAdvanced = skillConfig.type === "advanced";
    const isTrained = skillData.trained;

    // Advanced skills can't be used untrained
    if (isAdvanced && !isTrained) {
      ui.notifications.warn(`${skillName} is an advanced skill and requires training.`);
      return;
    }

    // Base value: full characteristic if trained, half if untrained (basic only)
    let baseValue = isTrained ? char.total : Math.floor(char.total / 2);

    // Apply training bonuses
    let trainingBonus = 0;
    if (skillData.plus10) trainingBonus += 10;
    if (skillData.plus20) trainingBonus += 20;

    // Apply miscellaneous modifier from skill
    const skillMod = Number(skillData.modifier) || 0;

    // Apply additional modifier from options (dialog)
    const extraMod = options.modifier || 0;

    const target = baseValue + trainingBonus + skillMod + extraMod;

    // Create the roll
    const roll = await new Roll("1d100").evaluate();

    // Determine success/failure and degrees
    const isSuccess = roll.total <= target;
    const degrees = Math.floor(Math.abs(target - roll.total) / 10);

    // Build breakdown string
    let breakdown = [];
    if (isTrained) {
      breakdown.push(`${char.total} (${game.i18n.localize(CONFIG.ROGUE_TRADER.characteristics[charKey])})`);
    } else {
      breakdown.push(`${Math.floor(char.total / 2)} (Half ${game.i18n.localize(CONFIG.ROGUE_TRADER.characteristics[charKey])})`);
    }
    if (trainingBonus > 0) breakdown.push(`+${trainingBonus} (Training)`);
    if (skillMod !== 0) breakdown.push(`${skillMod >= 0 ? "+" : ""}${skillMod} (Skill Mod)`);
    if (extraMod !== 0) breakdown.push(`${extraMod >= 0 ? "+" : ""}${extraMod} (Modifier)`);

    // Build chat message
    const resultClass = isSuccess ? "success" : "failure";
    const resultText = isSuccess ? "Success" : "Failure";

    const messageContent = `
      <div class="rogue-trader roll-result skill-roll">
        <h3>${skillName} Test</h3>
        <div class="roll-details">
          <span class="target">Target: ${target}</span>
          <span class="breakdown">(${breakdown.join(" ")})</span>
        </div>
        <div class="roll-outcome ${resultClass}">
          <span class="result">${resultText}</span>
          <span class="degrees">${degrees} Degree${degrees !== 1 ? "s" : ""}</span>
        </div>
      </div>
    `;

    // Send to chat
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: messageContent,
      rollMode: game.settings.get("core", "rollMode")
    });

    return { roll, isSuccess, degrees };
  }

  /**
   * Roll initiative manually from the character sheet
   * (Named differently to avoid conflict with Foundry's built-in rollInitiative for Combat Tracker)
   */
  async rollInitiativeManual() {
    const agBonus = this.system.characteristics.ag.bonus;
    const initBonus = this.system.initiativeBonus || 0;
    const formula = `1d10 + ${agBonus} + ${initBonus}`;

    const roll = await new Roll(formula).evaluate();

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `<h3>Initiative</h3><p>1d10 + Ag Bonus (${agBonus}) + Initiative Bonus (${initBonus})</p>`,
      rollMode: game.settings.get("core", "rollMode")
    });

    return roll;
  }
}
