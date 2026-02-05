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

    // Add editor context
    context.owner = this.actor.isOwner;
    context.editable = this.isEditable;

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
    const customSkills = [];

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
      } else if (i.type === "skill") {
        // Add display labels and calculate target number for skill items
        const charKey = i.system.characteristic || "int";
        i.charLabel = CONFIG.ROGUE_TRADER.characteristics[charKey]
          ? charKey.toUpperCase()
          : "INT";

        // Calculate target number
        const char = context.system.characteristics[charKey];
        const charValue = char?.total || char?.value || 0;
        let targetNumber = i.system.trained ? charValue : Math.floor(charValue / 2);
        if (i.system.plus10) targetNumber += 10;
        if (i.system.plus20) targetNumber += 20;
        targetNumber += Number(i.system.modifier) || 0;
        i.targetNumber = targetNumber;

        customSkills.push(i);
      }
    }

    // Assign to context
    context.traits = traits;
    context.weapons = weapons;
    context.powers = powers;
    context.customSkills = customSkills;
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

    // Prepare inventory for display
    this._prepareInventory(context);
  }

  /**
   * Prepare inventory data for display
   * @param {Object} context The actor data to prepare
   */
  _prepareInventory(context) {
    const rawInventory = context.system.inventory || [];
    let totalCarriedWeight = 0;

    const inventory = rawInventory.map((item, idx) => {
      const quantity = Number(item.quantity) || 0;
      const weight = Number(item.weight) || 0;
      const totalWeight = Math.round(quantity * weight * 100) / 100;
      totalCarriedWeight += totalWeight;

      return {
        ...item,
        totalWeight: totalWeight
      };
    });

    context.inventory = inventory;
    context.totalCarriedWeight = Math.round(totalCarriedWeight * 100) / 100;
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

    // Custom skill item rolls
    html.on("click", ".custom-skill-roll", this._onCustomSkillRoll.bind(this));

    // Power roll
    html.on("click", ".power-roll", this._onPowerRoll.bind(this));

    // Power damage roll
    html.on("click", ".power-damage", this._onPowerDamage.bind(this));

    // Inventory controls
    html.on("click", ".inventory-add", this._onInventoryAdd.bind(this));
    html.on("click", ".inventory-delete", this._onInventoryDelete.bind(this));
    html.on("change", ".inventory-item input", this._onInventoryChange.bind(this));

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

    // Build item data with type-specific defaults
    const itemData = {
      name: name,
      type: type,
      system: {}
    };

    // Add default system data based on type
    switch (type) {
      case "weapon":
        itemData.system = {
          description: "",
          attackType: "melee",
          damage: "1d10",
          penetration: 0,
          notes: ""
        };
        break;
      case "power":
        itemData.system = {
          description: "",
          characteristic: "wp",
          rollType: "skill",
          modifier: 0,
          damage: "",
          penetration: 0,
          notes: ""
        };
        break;
      case "trait":
        itemData.system = {
          description: "",
          modifiers: []
        };
        break;
      case "skill":
        itemData.system = {
          description: "",
          characteristic: "int",
          trained: true,
          plus10: false,
          plus20: false,
          modifier: 0
        };
        break;
    }

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
   * Show skill roll dialog
   * @param {string} skillKey The skill key
   * @private
   */
  async _showSkillRollDialog(skillKey) {
    const skillConfig = CONFIG.ROGUE_TRADER.skills[skillKey];
    const skillName = game.i18n.localize(skillConfig.label);

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
              const result = await this.actor.rollSkill(skillKey, { modifier });
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
   * Handle custom skill item roll
   * @param {Event} event The originating click event
   * @private
   */
  async _onCustomSkillRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const itemId = element.dataset.itemId;
    const item = this.actor.items.get(itemId);

    if (!item) return;

    const charKey = item.system.characteristic || "int";
    const char = this.actor.system.characteristics[charKey];
    const charValue = char?.total || char?.value || 0;

    // Calculate base target number
    let baseTarget = item.system.trained ? charValue : Math.floor(charValue / 2);
    if (item.system.plus10) baseTarget += 10;
    if (item.system.plus20) baseTarget += 20;
    baseTarget += Number(item.system.modifier) || 0;

    // Check for shift-click for quick roll
    if (event.shiftKey) {
      return this._rollCustomSkill(item, baseTarget, 0);
    }

    // Show dialog for difficulty/modifier
    return this._showCustomSkillRollDialog(item, baseTarget);
  }

  /**
   * Show custom skill roll dialog
   * @param {Item} item The skill item
   * @param {number} baseTarget The base target number
   * @private
   */
  async _showCustomSkillRollDialog(item, baseTarget) {
    const charKey = item.system.characteristic || "int";
    const charLabel = game.i18n.localize(CONFIG.ROGUE_TRADER.characteristics[charKey]);

    // Build difficulty options
    let difficultyOptions = "";
    for (const [key, diff] of Object.entries(CONFIG.ROGUE_TRADER.testDifficulty)) {
      const selected = key === "challenging" ? "selected" : "";
      difficultyOptions += `<option value="${diff.modifier}" ${selected}>${game.i18n.localize(diff.label)}</option>`;
    }

    const content = `
      <form class="roll-dialog">
        <div class="target-display">
          <span class="label">Target Number:</span>
          <span class="target-number">${baseTarget}</span>
        </div>
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
        title: `${item.name} (${charLabel}) Test`,
        content: content,
        buttons: {
          roll: {
            icon: '<i class="fas fa-dice"></i>',
            label: "Roll",
            callback: async (html) => {
              const difficulty = parseInt(html.find('[name="difficulty"]').val()) || 0;
              const extraMod = parseInt(html.find('[name="modifier"]').val()) || 0;
              const modifier = difficulty + extraMod;
              const result = await this._rollCustomSkill(item, baseTarget, modifier);
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
          const difficultySelect = html.find('[name="difficulty"]');
          const extraModInput = html.find('[name="modifier"]');
          const targetDisplay = html.find(".target-number");

          const updateTarget = () => {
            const difficulty = parseInt(difficultySelect.val()) || 0;
            const extraMod = parseInt(extraModInput.val()) || 0;
            const target = baseTarget + difficulty + extraMod;
            targetDisplay.text(target);
          };

          difficultySelect.on("change", updateTarget);
          extraModInput.on("input", updateTarget);
          extraModInput.focus().select();
        },
        close: () => resolve(null)
      }).render(true);
    });
  }

  /**
   * Roll a custom skill item
   * @param {Item} item The skill item
   * @param {number} baseTarget The base target number
   * @param {number} modifier Additional modifier
   * @private
   */
  async _rollCustomSkill(item, baseTarget, modifier) {
    const target = baseTarget + modifier;
    const charKey = item.system.characteristic || "int";
    const charLabel = game.i18n.localize(CONFIG.ROGUE_TRADER.characteristics[charKey]);

    // Roll d100
    const roll = await new Roll("1d100").evaluate();
    const isSuccess = roll.total <= target;
    const degrees = Math.floor(Math.abs(target - roll.total) / 10);

    // Build chat message (matching the format of other rolls)
    const resultClass = isSuccess ? "success" : "failure";
    const resultText = isSuccess ? "Success" : "Failure";

    const messageContent = `
      <div class="rogue-trader roll-result">
        <h3>${item.name} (${charLabel})</h3>
        <div class="roll-details">
          <span class="target">Target: ${target}</span>
          ${modifier ? `<span class="modifier">(Base ${baseTarget} + Modifier ${modifier >= 0 ? "+" : ""}${modifier})</span>` : ""}
        </div>
        <div class="roll-outcome ${resultClass}">
          <span class="result">${resultText}</span>
          <span class="degrees">${degrees} Degree${degrees !== 1 ? "s" : ""}</span>
        </div>
      </div>
    `;

    // Send to chat using roll.toMessage for consistent display
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: messageContent,
      rollMode: game.settings.get("core", "rollMode")
    });

    return { roll, isSuccess, degrees };
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

  /**
   * Handle adding an inventory item
   * @param {Event} event The originating click event
   * @private
   */
  async _onInventoryAdd(event) {
    event.preventDefault();

    const inventory = foundry.utils.deepClone(this.actor.system.inventory || []);
    inventory.push({
      name: "",
      quantity: 1,
      weight: 0
    });

    await this.actor.update({ "system.inventory": inventory });
  }

  /**
   * Handle deleting an inventory item
   * @param {Event} event The originating click event
   * @private
   */
  async _onInventoryDelete(event) {
    event.preventDefault();
    const index = parseInt(event.currentTarget.dataset.index);

    if (isNaN(index)) return;

    const inventory = foundry.utils.deepClone(this.actor.system.inventory || []);
    if (index < 0 || index >= inventory.length) return;

    inventory.splice(index, 1);
    await this.actor.update({ "system.inventory": inventory });
  }

  /**
   * Handle inventory item field changes
   * @param {Event} event The originating change event
   * @private
   */
  async _onInventoryChange(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const inventoryItem = element.closest(".inventory-item");
    if (!inventoryItem) return;

    const index = parseInt(inventoryItem.dataset.index);
    const field = element.dataset.field;

    if (isNaN(index) || !field) return;

    const inventory = foundry.utils.deepClone(this.actor.system.inventory || []);
    if (index < 0 || index >= inventory.length) return;

    // Get the new value
    let value;
    if (element.type === "number") {
      value = Number(element.value) || 0;
    } else {
      value = element.value;
    }

    inventory[index][field] = value;
    await this.actor.update({ "system.inventory": inventory });
  }
}
