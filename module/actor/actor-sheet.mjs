import { rollCharacteristicDialog } from "../helpers/dice.mjs";

/**
 * Extend the basic ActorSheet for Rogue Trader characters
 * @extends {ActorSheet}
 */
export class RogueTraderActorSheet extends ActorSheet {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["rogue-trader", "sheet", "actor", "character"],
      template: "systems/rogue-trader/templates/actor/character-sheet.hbs",
      width: 650,
      height: 700,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "characteristics"
        }
      ],
      dragDrop: [{ dragSelector: ".item-list .item", dropSelector: null }]
    });
  }

  /** @override */
  get template() {
    return `systems/rogue-trader/templates/actor/character-sheet.hbs`;
  }

  /* -------------------------------------------- */

  /** @override */
  async getData() {
    // Retrieve the data structure from the base sheet
    const context = super.getData();

    // Use a safe clone of the actor data for further operations
    const actorData = this.document.toObject(false);

    // Add the actor's data to context.data for easier access
    context.system = actorData.system;
    context.flags = actorData.flags;

    // Add config data
    context.config = CONFIG.ROGUE_TRADER;

    // Prepare character data and items
    if (actorData.type === "character") {
      this._prepareItems(context);
      this._prepareCharacterData(context);
    }

    // Add roll data for TinyMCE editors
    context.rollData = context.actor.getRollData();

    return context;
  }

  /**
   * Organize and classify Items for Character sheets
   * @param {Object} context The actor data to prepare
   */
  _prepareItems(context) {
    // Initialize containers
    const traits = [];
    const weapons = [];
    const powers = [];

    // Iterate through items, allocating to containers
    for (let i of context.items) {
      i.img = i.img || Item.DEFAULT_ICON;
      if (i.type === "trait") {
        // Add modifier summary for display
        const item = this.actor.items.get(i._id);
        i.modifierSummary = item?.getModifierSummary() || "";
        traits.push(i);
      } else if (i.type === "weapon") {
        weapons.push(i);
      } else if (i.type === "power") {
        // Add display labels for power
        const charKey = i.system.characteristic || "wp";
        i.charLabel = game.i18n.localize(CONFIG.ROGUE_TRADER.characteristics[charKey]);
        i.rollTypeLabel = game.i18n.localize(CONFIG.ROGUE_TRADER.powerRollTypes[i.system.rollType] || "ROGUE_TRADER.PowerRollTypeSkill");
        powers.push(i);
      }
    }

    // Assign to context
    context.traits = traits;
    context.weapons = weapons;
    context.powers = powers;
  }

  /**
   * Prepare Character specific data
   * @param {Object} context The actor data to prepare
   */
  _prepareCharacterData(context) {
    // Format characteristics for display
    const characteristics = {};
    for (const [key, char] of Object.entries(context.system.characteristics)) {
      characteristics[key] = {
        ...char,
        label: game.i18n.localize(CONFIG.ROGUE_TRADER.characteristics[key])
      };
    }
    context.characteristics = characteristics;

    // Prepare skills for display
    this._prepareSkills(context);
  }

  /**
   * Prepare skills data for display
   * @param {Object} context The actor data to prepare
   */
  _prepareSkills(context) {
    const skills = {};
    const systemSkills = context.system.skills || {};

    // Process regular skills
    for (const [key, skillConfig] of Object.entries(CONFIG.ROGUE_TRADER.skills)) {
      const skillData = systemSkills[key] || {};
      const char = context.system.characteristics[skillConfig.char];
      const charTotal = char?.total || 0;

      // Calculate total target number
      const isTrained = skillData.trained || false;
      const isAdvanced = skillConfig.type === "advanced";
      const isBasic = skillData.isBasic || false; // Can override advanced to basic
      const effectivelyBasic = !isAdvanced || isBasic;

      // If trained: full char value
      // If untrained basic: half char value
      // If untrained advanced (not made basic): cannot use (0)
      let baseValue = isTrained ? charTotal : (effectivelyBasic ? Math.floor(charTotal / 2) : 0);

      let total = baseValue;
      if (skillData.plus10) total += 10;
      if (skillData.plus20) total += 20;
      total += Number(skillData.modifier) || 0;

      // Can use if trained, or if effectively basic (even untrained)
      const canUse = isTrained || effectivelyBasic;

      skills[key] = {
        ...skillData,
        label: game.i18n.localize(skillConfig.label),
        charLabel: skillConfig.char.toUpperCase(),
        isAdvanced: isAdvanced,
        isBasic: isBasic,
        total: canUse ? total : "—"
      };
    }
    context.skills = skills;

    // Process specialization skills
    const specializations = {};
    const systemSpecs = context.system.specializations || {};

    for (const [key, specConfig] of Object.entries(CONFIG.ROGUE_TRADER.specializations)) {
      const entries = systemSpecs[key] || [];
      const char = context.system.characteristics[specConfig.char];
      const charTotal = char?.total || 0;

      const processedEntries = entries.map((entry, idx) => {
        const isTrained = entry.trained || false;
        const isBasic = entry.isBasic || false; // Can override advanced to basic

        // If trained: full char value
        // If marked basic but untrained: half char value
        // If advanced and untrained (not made basic): cannot use
        let baseValue = isTrained ? charTotal : (isBasic ? Math.floor(charTotal / 2) : 0);

        let total = baseValue;
        if (entry.plus10) total += 10;
        if (entry.plus20) total += 20;
        total += Number(entry.modifier) || 0;

        // Can use if trained, or if marked as basic
        const canUse = isTrained || isBasic;

        return {
          ...entry,
          isBasic: isBasic,
          total: canUse ? total : "—"
        };
      });

      specializations[key] = {
        label: game.i18n.localize(specConfig.label),
        charLabel: specConfig.char.toUpperCase(),
        entries: processedEntries
      };
    }
    context.specializations = specializations;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Render the item sheet for viewing/editing prior to the editable check
    html.on("click", ".item-edit", (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.sheet.render(true);
    });

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Add Inventory Item
    html.on("click", ".item-create", this._onItemCreate.bind(this));

    // Delete Inventory Item
    html.on("click", ".item-delete", (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.delete();
      li.slideUp(200, () => this.render(false));
    });

    // Rollable abilities
    html.on("click", ".rollable", this._onRoll.bind(this));

    // Characteristic rolls
    html.on("click", ".characteristic-roll", this._onCharacteristicRoll.bind(this));

    // Initiative roll
    html.on("click", ".initiative-roll", this._onInitiativeRoll.bind(this));

    // Weapon attack roll
    html.on("click", ".weapon-attack", this._onWeaponAttack.bind(this));

    // Weapon damage roll
    html.on("click", ".weapon-damage", this._onWeaponDamage.bind(this));

    // Skill rolls
    html.on("click", ".skill-roll", this._onSkillRoll.bind(this));

    // Specialization rolls
    html.on("click", ".spec-roll", this._onSpecializationRoll.bind(this));

    // Add specialization
    html.on("click", ".spec-add", this._onAddSpecialization.bind(this));

    // Delete specialization
    html.on("click", ".spec-delete", this._onDeleteSpecialization.bind(this));

    // Power roll
    html.on("click", ".power-roll", this._onPowerRoll.bind(this));

    // Power damage roll
    html.on("click", ".power-damage", this._onPowerDamage.bind(this));

    // Drag events for macros
    if (this.actor.isOwner) {
      let handler = (ev) => this._onDragStart(ev);
      html.find("li.item").each((i, li) => {
        if (li.classList.contains("inventory-header")) return;
        li.setAttribute("draggable", true);
        li.addEventListener("dragstart", handler, false);
      });
    }
  }

  /**
   * Handle creating a new Owned Item for the actor
   * @param {Event} event The originating click event
   * @private
   */
  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    const type = header.dataset.type;

    const name = `New ${type.charAt(0).toUpperCase() + type.slice(1)}`;
    const itemData = {
      name: name,
      type: type,
      system: {}
    };

    // Create the item
    return await Item.create(itemData, { parent: this.actor });
  }

  /**
   * Handle clickable rolls
   * @param {Event} event The originating click event
   * @private
   */
  _onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    // Handle item rolls
    if (dataset.rollType) {
      if (dataset.rollType === "item") {
        const itemId = element.closest(".item").dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (item) return item.roll();
      }
    }

    // Handle rolls that supply the formula directly
    if (dataset.roll) {
      let label = dataset.label ? `Rolling ${dataset.label}` : "";
      let roll = new Roll(dataset.roll, this.actor.getRollData());
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label,
        rollMode: game.settings.get("core", "rollMode")
      });
      return roll;
    }
  }

  /**
   * Handle characteristic roll
   * @param {Event} event The originating click event
   * @private
   */
  async _onCharacteristicRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const charKey = element.dataset.characteristic;

    if (!charKey) return;

    // Check for shift-click for quick roll
    if (event.shiftKey) {
      return this.actor.rollCharacteristic(charKey, { modifier: 0 });
    }

    // Otherwise show dialog
    return rollCharacteristicDialog(this.actor, charKey);
  }

  /**
   * Handle initiative roll
   * @param {Event} event The originating click event
   * @private
   */
  async _onInitiativeRoll(event) {
    event.preventDefault();
    return this.actor.rollInitiativeManual();
  }

  /**
   * Handle weapon attack roll
   * @param {Event} event The originating click event
   * @private
   */
  async _onWeaponAttack(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);

    if (!item) return;

    const attackType = item.system.attackType;
    const charKey = attackType === "melee" ? "ws" : "bs";

    // Check for shift-click for quick roll
    if (event.shiftKey) {
      return this.actor.rollCharacteristic(charKey, {
        modifier: 0,
        isAttack: true,
        weaponName: item.name
      });
    }

    // Otherwise show dialog with combat actions
    return rollCharacteristicDialog(this.actor, charKey, {
      weaponName: item.name,
      attackType: attackType
    });
  }

  /**
   * Handle weapon damage roll
   * @param {Event} event The originating click event
   * @private
   */
  async _onWeaponDamage(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);

    if (!item) return;

    return item.rollDamage();
  }

  /**
   * Handle skill roll
   * @param {Event} event The originating click event
   * @private
   */
  async _onSkillRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const skillKey = element.dataset.skill;

    if (!skillKey) return;

    // Check for shift-click for quick roll
    if (event.shiftKey) {
      return this.actor.rollSkill(skillKey, { modifier: 0 });
    }

    // Show dialog for modifier
    return this._showSkillRollDialog(skillKey, false);
  }

  /**
   * Handle specialization roll
   * @param {Event} event The originating click event
   * @private
   */
  async _onSpecializationRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const specKey = element.dataset.spec;
    const specIndex = parseInt(element.dataset.index);

    if (!specKey || isNaN(specIndex)) return;

    // Check for shift-click for quick roll
    if (event.shiftKey) {
      return this.actor.rollSkill(specKey, { modifier: 0, isSpecialization: true, specIndex });
    }

    // Show dialog for modifier
    return this._showSkillRollDialog(specKey, true, specIndex);
  }

  /**
   * Show skill roll dialog
   * @param {string} skillKey The skill key
   * @param {boolean} isSpec Whether this is a specialization
   * @param {number} specIndex The specialization index (if applicable)
   * @private
   */
  async _showSkillRollDialog(skillKey, isSpec, specIndex) {
    const skillConfig = isSpec
      ? CONFIG.ROGUE_TRADER.specializations[skillKey]
      : CONFIG.ROGUE_TRADER.skills[skillKey];

    let skillName;
    if (isSpec) {
      const entries = this.actor.system.specializations?.[skillKey] || [];
      const entry = entries[specIndex];
      skillName = `${game.i18n.localize(skillConfig.label)} (${entry?.name || "Unknown"})`;
    } else {
      skillName = game.i18n.localize(skillConfig.label);
    }

    // Build difficulty options
    let difficultyOptions = "";
    for (const [key, diff] of Object.entries(CONFIG.ROGUE_TRADER.testDifficulty)) {
      const selected = key === "challenging" ? "selected" : "";
      difficultyOptions += `<option value="${diff.modifier}" ${selected}>${game.i18n.localize(diff.label)}</option>`;
    }

    const content = `
      <form class="roll-dialog">
        <div class="form-group">
          <label>${game.i18n.localize("ROGUE_TRADER.Difficulty")}</label>
          <select name="difficulty">${difficultyOptions}</select>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("ROGUE_TRADER.ExtraModifier")}</label>
          <input type="number" name="modifier" value="0" />
        </div>
      </form>
    `;

    return new Promise((resolve) => {
      new Dialog({
        title: `${skillName} Test`,
        content: content,
        buttons: {
          roll: {
            icon: '<i class="fas fa-dice"></i>',
            label: "Roll",
            callback: async (html) => {
              const difficulty = parseInt(html.find('[name="difficulty"]').val()) || 0;
              const extraMod = parseInt(html.find('[name="modifier"]').val()) || 0;
              const modifier = difficulty + extraMod;
              const result = await this.actor.rollSkill(skillKey, {
                modifier,
                isSpecialization: isSpec,
                specIndex
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
        default: "roll"
      }).render(true);
    });
  }

  /**
   * Handle adding a specialization
   * @param {Event} event The originating click event
   * @private
   */
  async _onAddSpecialization(event) {
    event.preventDefault();
    const specKey = event.currentTarget.dataset.spec;

    if (!specKey) return;

    const specs = foundry.utils.deepClone(this.actor.system.specializations || {});
    if (!specs[specKey]) specs[specKey] = [];

    specs[specKey].push({
      name: "",
      trained: true, // New specializations are trained by default
      plus10: false,
      plus20: false,
      modifier: 0
    });

    await this.actor.update({ "system.specializations": specs });
  }

  /**
   * Handle deleting a specialization
   * @param {Event} event The originating click event
   * @private
   */
  async _onDeleteSpecialization(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const specKey = element.dataset.spec;
    const specIndex = parseInt(element.dataset.index);

    if (!specKey || isNaN(specIndex)) return;

    const specs = foundry.utils.deepClone(this.actor.system.specializations || {});
    if (!specs[specKey]) return;

    // Validate index is within bounds
    if (specIndex < 0 || specIndex >= specs[specKey].length) return;

    specs[specKey].splice(specIndex, 1);

    await this.actor.update({ "system.specializations": specs });
  }

  /**
   * Handle power roll
   * @param {Event} event The originating click event
   * @private
   */
  async _onPowerRoll(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);

    if (!item) return;

    const charKey = item.system.characteristic || "wp";
    const rollType = item.system.rollType || "skill";
    const powerModifier = item.system.modifier || 0;

    // Check for shift-click for quick roll
    if (event.shiftKey) {
      return this.actor.rollCharacteristic(charKey, {
        modifier: powerModifier,
        isPower: true,
        powerName: item.name
      });
    }

    // Show appropriate dialog based on roll type
    return this._showPowerRollDialog(item, charKey, rollType, powerModifier);
  }

  /**
   * Show power roll dialog based on roll type
   * @param {Item} item The power item
   * @param {string} charKey The characteristic key
   * @param {string} rollType The roll type (attack, skill, other)
   * @param {number} powerModifier The power's built-in modifier
   * @private
   */
  async _showPowerRollDialog(item, charKey, rollType, powerModifier) {
    const char = this.actor.system.characteristics[charKey];
    const charLabel = game.i18n.localize(CONFIG.ROGUE_TRADER.characteristics[charKey]);
    const title = `${item.name} (${charLabel})`;

    let situationalOptions = "";
    let selectName = "modifier";

    if (rollType === "attack") {
      // Show combat actions, filtered by attack type (use melee for WS, ranged for BS)
      const attackType = charKey === "ws" ? "melee" : "ranged";
      selectName = "combatAction";
      for (const [key, action] of Object.entries(CONFIG.ROGUE_TRADER.combatActions)) {
        if (action.type === "both" || action.type === attackType) {
          const selected = key === "standard" ? "selected" : "";
          situationalOptions += `<option value="${action.modifier}" ${selected}>${game.i18n.localize(action.label)}</option>`;
        }
      }
    } else if (rollType === "skill") {
      // Show difficulty options
      selectName = "difficulty";
      for (const [key, diff] of Object.entries(CONFIG.ROGUE_TRADER.testDifficulty)) {
        const selected = key === "challenging" ? "selected" : "";
        situationalOptions += `<option value="${diff.modifier}" ${selected}>${game.i18n.localize(diff.label)}</option>`;
      }
    }

    const hasOptions = rollType !== "other";
    const content = `
      <form class="roll-dialog">
        <div class="target-display">
          <span class="label">Target Number:</span>
          <span class="target-number">${char.total + powerModifier}</span>
          ${powerModifier !== 0 ? `<span class="power-mod-note">(includes power modifier ${powerModifier >= 0 ? "+" : ""}${powerModifier})</span>` : ""}
        </div>
        ${hasOptions ? `
        <div class="form-group">
          <label>${rollType === "attack" ? game.i18n.localize("ROGUE_TRADER.CombatAction") : game.i18n.localize("ROGUE_TRADER.Difficulty")}</label>
          <select name="${selectName}">${situationalOptions}</select>
        </div>
        ` : ""}
        <div class="form-group">
          <label>${game.i18n.localize("ROGUE_TRADER.ExtraModifier")}</label>
          <input type="number" name="extraModifier" value="0" />
        </div>
      </form>
    `;

    return new Promise((resolve) => {
      new Dialog({
        title: title,
        content: content,
        buttons: {
          roll: {
            icon: '<i class="fas fa-dice"></i>',
            label: "Roll",
            callback: async (html) => {
              let situationalMod = 0;
              if (hasOptions) {
                situationalMod = parseInt(html.find(`[name="${selectName}"]`).val()) || 0;
              }
              const extraMod = parseInt(html.find('[name="extraModifier"]').val()) || 0;
              const totalModifier = powerModifier + situationalMod + extraMod;

              const result = await this.actor.rollCharacteristic(charKey, {
                modifier: totalModifier,
                isPower: true,
                powerName: item.name,
                isAttack: rollType === "attack"
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
          // Update target number display when modifiers change
          const baseValue = char.total + powerModifier;
          const extraModInput = html.find('[name="extraModifier"]');
          const situationalSelect = html.find(`[name="${selectName}"]`);
          const targetDisplay = html.find(".target-number");

          const updateTarget = () => {
            const situationalMod = hasOptions ? (parseInt(situationalSelect.val()) || 0) : 0;
            const extraMod = parseInt(extraModInput.val()) || 0;
            const target = baseValue + situationalMod + extraMod;
            targetDisplay.text(target);
          };

          extraModInput.on("input", updateTarget);
          if (hasOptions) {
            situationalSelect.on("change", updateTarget);
          }

          extraModInput.focus().select();
        },
        close: () => resolve(null)
      }).render(true);
    });
  }

  /**
   * Handle power damage roll
   * @param {Event} event The originating click event
   * @private
   */
  async _onPowerDamage(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);

    if (!item || !item.system.damage) return;

    return item.rollDamage();
  }
}
