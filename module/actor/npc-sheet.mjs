import { rollCharacteristicDialog } from "../helpers/dice.mjs";

/**
 * Extend the basic ActorSheet for Rogue Trader NPCs
 * A compact, streamlined sheet for quick NPC/mob entry
 * @extends {ActorSheet}
 */
export class RogueTraderNPCSheet extends ActorSheet {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["rogue-trader", "sheet", "actor", "npc"],
      template: "systems/rogue-trader/templates/actor/npc-sheet.hbs",
      width: 500,
      height: 450,
      dragDrop: [{ dragSelector: ".item-list .item", dropSelector: null }]
    });
  }

  /** @override */
  get template() {
    return `systems/rogue-trader/templates/actor/npc-sheet.hbs`;
  }

  /* -------------------------------------------- */

  /** @override */
  async getData() {
    const context = super.getData();
    const actorData = this.document.toObject(false);

    context.system = actorData.system;
    context.flags = actorData.flags;
    context.config = CONFIG.ROGUE_TRADER;

    // Prepare items
    this._prepareItems(context);

    // Format characteristics for display
    const characteristics = {};
    for (const [key, char] of Object.entries(context.system.characteristics)) {
      characteristics[key] = {
        ...char,
        label: game.i18n.localize(CONFIG.ROGUE_TRADER.characteristics[key]),
        shortLabel: key.toUpperCase()
      };
    }
    context.characteristics = characteristics;

    context.rollData = context.actor.getRollData();

    return context;
  }

  /**
   * Organize items for NPC sheet
   * @param {Object} context The actor data to prepare
   */
  _prepareItems(context) {
    const traits = [];
    const weapons = [];

    for (let i of context.items) {
      i.img = i.img || Item.DEFAULT_ICON;
      if (i.type === "trait") {
        const item = this.actor.items.get(i._id);
        i.modifierSummary = item?.getModifierSummary() || "";
        traits.push(i);
      } else if (i.type === "weapon") {
        weapons.push(i);
      }
    }

    context.traits = traits;
    context.weapons = weapons;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // View/Edit item
    html.on("click", ".item-edit", (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.sheet.render(true);
    });

    if (!this.isEditable) return;

    // Add Item
    html.on("click", ".item-create", this._onItemCreate.bind(this));

    // Delete Item
    html.on("click", ".item-delete", (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.delete();
      li.slideUp(200, () => this.render(false));
    });

    // Characteristic rolls
    html.on("click", ".characteristic-roll", this._onCharacteristicRoll.bind(this));

    // Initiative roll
    html.on("click", ".initiative-roll", this._onInitiativeRoll.bind(this));

    // Weapon attack roll
    html.on("click", ".weapon-attack", this._onWeaponAttack.bind(this));

    // Weapon damage roll
    html.on("click", ".weapon-damage", this._onWeaponDamage.bind(this));

    // Drag events
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
   * Handle creating a new Owned Item
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

    return await Item.create(itemData, { parent: this.actor });
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

    if (event.shiftKey) {
      return this.actor.rollCharacteristic(charKey, { modifier: 0 });
    }

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

    if (event.shiftKey) {
      return this.actor.rollCharacteristic(charKey, { modifier: 0 });
    }

    return rollCharacteristicDialog(this.actor, charKey, { weaponName: item.name });
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
}
