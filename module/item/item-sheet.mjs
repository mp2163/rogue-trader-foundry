/**
 * Extend the basic ItemSheet for Rogue Trader items
 * @extends {ItemSheet}
 */
export class RogueTraderItemSheet extends ItemSheet {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["rogue-trader", "sheet", "item"],
      width: 450,
      height: 400,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "description"
        }
      ]
    });
  }

  /** @override */
  get template() {
    const path = "systems/rogue-trader/templates/item";
    // Return different templates based on item type
    return `${path}/${this.item.type}-sheet.hbs`;
  }

  /* -------------------------------------------- */

  /** @override */
  async getData() {
    const context = super.getData();
    const itemData = this.document.toObject(false);

    context.system = itemData.system;
    context.flags = itemData.flags;
    context.config = CONFIG.ROGUE_TRADER;

    // Prepare type-specific data
    if (this.item.type === "trait") {
      this._prepareTraitData(context);
    } else if (this.item.type === "weapon") {
      this._prepareWeaponData(context);
    } else if (this.item.type === "power") {
      this._preparePowerData(context);
    } else if (this.item.type === "skill") {
      this._prepareSkillData(context);
    }

    // Enrich description for editor
    context.enrichedDescription = await TextEditor.enrichHTML(
      context.system.description,
      { async: true }
    );

    // Add editor context
    context.owner = this.item.isOwner;
    context.editable = this.isEditable;

    return context;
  }

  /**
   * Prepare trait-specific data
   * @param {Object} context The item data
   */
  _prepareTraitData(context) {
    // Ensure modifiers array exists
    if (!context.system.modifiers) {
      context.system.modifiers = [];
    }

    // Add stat options for dropdown (localized)
    context.statOptions = {};
    for (const [key, label] of Object.entries(CONFIG.ROGUE_TRADER.characteristics)) {
      context.statOptions[key] = game.i18n.localize(label);
    }
    // Add non-characteristic stats that traits can modify
    context.statOptions.initiative = game.i18n.localize("ROGUE_TRADER.Initiative");
    context.statOptions.wounds = game.i18n.localize("ROGUE_TRADER.Wounds");
  }

  /**
   * Prepare weapon-specific data
   * @param {Object} context The item data
   */
  _prepareWeaponData(context) {
    // Localized attack type labels
    context.attackTypes = {
      melee: game.i18n.localize("ROGUE_TRADER.AttackTypeMeleeWS"),
      ranged: game.i18n.localize("ROGUE_TRADER.AttackTypeRangedBS")
    };
  }

  /**
   * Prepare power-specific data
   * @param {Object} context The item data
   */
  _preparePowerData(context) {
    // Add characteristics for dropdown (localized)
    context.characteristics = {};
    for (const [key, label] of Object.entries(CONFIG.ROGUE_TRADER.characteristics)) {
      context.characteristics[key] = game.i18n.localize(label);
    }

    // Add roll types for dropdown (localized)
    context.rollTypes = {};
    for (const [key, label] of Object.entries(CONFIG.ROGUE_TRADER.powerRollTypes)) {
      context.rollTypes[key] = game.i18n.localize(label);
    }
  }

  /**
   * Prepare skill-specific data
   * @param {Object} context The item data
   */
  _prepareSkillData(context) {
    // Add characteristics for dropdown (localized)
    context.characteristics = {};
    for (const [key, label] of Object.entries(CONFIG.ROGUE_TRADER.characteristics)) {
      context.characteristics[key] = game.i18n.localize(label);
    }

    // Calculate target number if we have a parent actor
    if (this.item.parent) {
      const charKey = context.system.characteristic || "int";
      const char = this.item.parent.system.characteristics?.[charKey];
      const charValue = char?.total || char?.value || 0;

      let total = context.system.trained ? charValue : Math.floor(charValue / 2);
      if (context.system.plus10) total += 10;
      if (context.system.plus20) total += 20;
      total += Number(context.system.modifier) || 0;

      context.targetNumber = total;
    } else {
      context.targetNumber = "—";
    }
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    if (!this.isEditable) return;

    // Add modifier (for traits)
    html.on("click", ".modifier-add", this._onAddModifier.bind(this));

    // Delete modifier (for traits)
    html.on("click", ".modifier-delete", this._onDeleteModifier.bind(this));

    // Update modifier values
    html.on("change", ".modifier-stat", this._onModifierChange.bind(this));
    html.on("change", ".modifier-value", this._onModifierChange.bind(this));
  }

  /**
   * Handle adding a new modifier to a trait
   * @param {Event} event The originating click event
   * @private
   */
  async _onAddModifier(event) {
    event.preventDefault();
    const modifiers = this.item.system.modifiers || [];
    modifiers.push({ stat: "ws", value: 0 });

    await this.item.update({ "system.modifiers": modifiers });
  }

  /**
   * Handle deleting a modifier from a trait
   * @param {Event} event The originating click event
   * @private
   */
  async _onDeleteModifier(event) {
    event.preventDefault();
    const index = event.currentTarget.dataset.index;
    const modifiers = [...(this.item.system.modifiers || [])];
    modifiers.splice(index, 1);

    await this.item.update({ "system.modifiers": modifiers });
  }

  /**
   * Handle modifier value changes
   * @param {Event} event The originating change event
   * @private
   */
  async _onModifierChange(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const index = element.dataset.index;
    const field = element.dataset.field;
    const value = field === "value" ? Number(element.value) : element.value;

    const modifiers = [...(this.item.system.modifiers || [])];
    modifiers[index][field] = value;

    await this.item.update({ "system.modifiers": modifiers });
  }
}
