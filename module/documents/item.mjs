/**
 * Extend the base Item document for Rogue Trader
 * @extends {Item}
 */
export class RogueTraderItem extends Item {
  /** @override */
  prepareData() {
    super.prepareData();
  }

  /**
   * Roll the weapon attack
   * @param {object} options - Options for the roll
   * @param {number} options.modifier - Additional modifier to apply
   */
  async rollAttack(options = {}) {
    if (this.type !== "weapon") return;
    if (!this.actor) {
      ui.notifications.warn("This weapon is not owned by an actor.");
      return;
    }

    const attackType = this.system.attackType;
    const charKey = attackType === "melee" ? "ws" : "bs";
    const charLabel = attackType === "melee" ? "Weapon Skill" : "Ballistic Skill";

    // Use the actor's rollCharacteristic method
    return this.actor.rollCharacteristic(charKey, {
      modifier: options.modifier || 0,
      weaponName: this.name
    });
  }

  /**
   * Roll the item damage (works for weapons and powers)
   */
  async rollDamage() {
    if (this.type !== "weapon" && this.type !== "power") return;
    if (!this.system.damage) return;

    let damageFormula = this.system.damage;

    // Replace characteristic bonuses if actor exists
    if (this.actor) {
      const chars = this.actor.system.characteristics;
      // Replace SB (Strength Bonus)
      damageFormula = damageFormula.replace(/SB/gi, chars.s.bonus.toString());
      // Replace WPB (Willpower Bonus)
      damageFormula = damageFormula.replace(/WPB/gi, chars.wp.bonus.toString());
      // Replace TB (Toughness Bonus)
      damageFormula = damageFormula.replace(/TB/gi, chars.t.bonus.toString());
      // Replace AgB (Agility Bonus)
      damageFormula = damageFormula.replace(/AgB/gi, chars.ag.bonus.toString());
      // Replace IntB (Intelligence Bonus)
      damageFormula = damageFormula.replace(/IntB/gi, chars.int.bonus.toString());
      // Replace PerB (Perception Bonus)
      damageFormula = damageFormula.replace(/PerB/gi, chars.per.bonus.toString());
      // Replace FelB (Fellowship Bonus)
      damageFormula = damageFormula.replace(/FelB/gi, chars.fel.bonus.toString());
      // Replace WSB (Weapon Skill Bonus)
      damageFormula = damageFormula.replace(/WSB/gi, chars.ws.bonus.toString());
      // Replace BSB (Ballistic Skill Bonus)
      damageFormula = damageFormula.replace(/BSB/gi, chars.bs.bonus.toString());
    }

    const roll = await new Roll(damageFormula).evaluate();
    const itemType = this.type === "power" ? "Power" : "Weapon";

    const messageContent = `
      <div class="rogue-trader damage-roll">
        <h3>${this.name} - Damage</h3>
        <div class="roll-details">
          <span class="formula">${this.system.damage}</span>
          ${this.system.penetration ? `<span class="penetration">Pen: ${this.system.penetration}</span>` : ""}
          ${this.system.notes ? `<span class="notes">${this.system.notes}</span>` : ""}
        </div>
      </div>
    `;

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: messageContent,
      rollMode: game.settings.get("core", "rollMode")
    });

    return roll;
  }

  /**
   * Get a summary of modifiers for display (for traits)
   */
  getModifierSummary() {
    if (this.type !== "trait" || !this.system.modifiers) return "";

    return this.system.modifiers
      .map(mod => {
        const statLabel = CONFIG.ROGUE_TRADER.characteristics[mod.stat]
          ? game.i18n.localize(CONFIG.ROGUE_TRADER.characteristics[mod.stat])
          : mod.stat;
        const sign = mod.value >= 0 ? "+" : "";
        return `${statLabel} ${sign}${mod.value}`;
      })
      .join(", ");
  }
}
