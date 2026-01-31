// Import Modules
import { RogueTraderActorSheet } from "./module/actor/actor-sheet.mjs";
import { RogueTraderNPCSheet } from "./module/actor/npc-sheet.mjs";
import { RogueTraderItemSheet } from "./module/item/item-sheet.mjs";
import { preloadHandlebarsTemplates } from "./module/helpers/templates.mjs";
import { RogueTraderActor } from "./module/documents/actor.mjs";
import { RogueTraderItem } from "./module/documents/item.mjs";

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Hooks.once("init", async function () {
  console.log("Rogue Trader | Initializing Rogue Trader Game System");

  // Add custom constants for configuration
  CONFIG.ROGUE_TRADER = {
    characteristics: {
      ws: "ROGUE_TRADER.CharacteristicWS",
      bs: "ROGUE_TRADER.CharacteristicBS",
      s: "ROGUE_TRADER.CharacteristicS",
      t: "ROGUE_TRADER.CharacteristicT",
      ag: "ROGUE_TRADER.CharacteristicAg",
      int: "ROGUE_TRADER.CharacteristicInt",
      per: "ROGUE_TRADER.CharacteristicPer",
      wp: "ROGUE_TRADER.CharacteristicWP",
      fel: "ROGUE_TRADER.CharacteristicFel"
    },
    attackTypes: {
      melee: "ROGUE_TRADER.AttackTypeMelee",
      ranged: "ROGUE_TRADER.AttackTypeRanged"
    },
    hitLocations: {
      head: { range: [1, 10], label: "ROGUE_TRADER.HitLocationHead" },
      rightArm: { range: [11, 20], label: "ROGUE_TRADER.HitLocationRightArm" },
      leftArm: { range: [21, 30], label: "ROGUE_TRADER.HitLocationLeftArm" },
      body: { range: [31, 70], label: "ROGUE_TRADER.HitLocationBody" },
      rightLeg: { range: [71, 85], label: "ROGUE_TRADER.HitLocationRightLeg" },
      leftLeg: { range: [86, 100], label: "ROGUE_TRADER.HitLocationLeftLeg" }
    },
    armorLocations: ["head", "rightArm", "leftArm", "body", "rightLeg", "leftLeg"],

    // Skills configuration: characteristic they use, type (basic/advanced), label
    skills: {
      acrobatics: { char: "ag", type: "basic", label: "ROGUE_TRADER.SkillAcrobatics" },
      awareness: { char: "per", type: "basic", label: "ROGUE_TRADER.SkillAwareness" },
      barter: { char: "fel", type: "basic", label: "ROGUE_TRADER.SkillBarter" },
      blather: { char: "fel", type: "basic", label: "ROGUE_TRADER.SkillBlather" },
      carouse: { char: "t", type: "basic", label: "ROGUE_TRADER.SkillCarouse" },
      charm: { char: "fel", type: "basic", label: "ROGUE_TRADER.SkillCharm" },
      chemUse: { char: "int", type: "advanced", label: "ROGUE_TRADER.SkillChemUse" },
      climb: { char: "s", type: "basic", label: "ROGUE_TRADER.SkillClimb" },
      command: { char: "fel", type: "basic", label: "ROGUE_TRADER.SkillCommand" },
      concealment: { char: "ag", type: "basic", label: "ROGUE_TRADER.SkillConcealment" },
      contortionist: { char: "ag", type: "basic", label: "ROGUE_TRADER.SkillContortionist" },
      deceive: { char: "fel", type: "basic", label: "ROGUE_TRADER.SkillDeceive" },
      demolition: { char: "int", type: "advanced", label: "ROGUE_TRADER.SkillDemolition" },
      disguise: { char: "fel", type: "basic", label: "ROGUE_TRADER.SkillDisguise" },
      dodge: { char: "ag", type: "basic", label: "ROGUE_TRADER.SkillDodge" },
      evaluate: { char: "int", type: "basic", label: "ROGUE_TRADER.SkillEvaluate" },
      gamble: { char: "int", type: "basic", label: "ROGUE_TRADER.SkillGamble" },
      inquiry: { char: "fel", type: "basic", label: "ROGUE_TRADER.SkillInquiry" },
      interrogation: { char: "wp", type: "advanced", label: "ROGUE_TRADER.SkillInterrogation" },
      intimidate: { char: "s", type: "basic", label: "ROGUE_TRADER.SkillIntimidate" },
      invocation: { char: "wp", type: "advanced", label: "ROGUE_TRADER.SkillInvocation" },
      lipReading: { char: "per", type: "advanced", label: "ROGUE_TRADER.SkillLipReading" },
      literacy: { char: "int", type: "advanced", label: "ROGUE_TRADER.SkillLiteracy" },
      logic: { char: "int", type: "basic", label: "ROGUE_TRADER.SkillLogic" },
      medicae: { char: "int", type: "advanced", label: "ROGUE_TRADER.SkillMedicae" },
      pilot: { char: "ag", type: "advanced", label: "ROGUE_TRADER.SkillPilot" },
      psyniscience: { char: "per", type: "advanced", label: "ROGUE_TRADER.SkillPsyniscience" },
      scrutiny: { char: "per", type: "basic", label: "ROGUE_TRADER.SkillScrutiny" },
      search: { char: "per", type: "basic", label: "ROGUE_TRADER.SkillSearch" },
      security: { char: "int", type: "advanced", label: "ROGUE_TRADER.SkillSecurity" },
      shadowing: { char: "ag", type: "advanced", label: "ROGUE_TRADER.SkillShadowing" },
      silentMove: { char: "ag", type: "basic", label: "ROGUE_TRADER.SkillSilentMove" },
      sleightOfHand: { char: "ag", type: "advanced", label: "ROGUE_TRADER.SkillSleightOfHand" },
      survival: { char: "int", type: "basic", label: "ROGUE_TRADER.SkillSurvival" },
      swim: { char: "s", type: "basic", label: "ROGUE_TRADER.SkillSwim" },
      techUse: { char: "int", type: "advanced", label: "ROGUE_TRADER.SkillTechUse" },
      tracking: { char: "int", type: "advanced", label: "ROGUE_TRADER.SkillTracking" },
      wrangling: { char: "int", type: "advanced", label: "ROGUE_TRADER.SkillWrangling" }
    },

    // Specialization skills (can have multiple entries with names)
    specializations: {
      ciphers: { char: "int", type: "advanced", label: "ROGUE_TRADER.SkillCiphers" },
      commonLore: { char: "int", type: "advanced", label: "ROGUE_TRADER.SkillCommonLore" },
      drive: { char: "ag", type: "advanced", label: "ROGUE_TRADER.SkillDrive" },
      forbiddenLore: { char: "int", type: "advanced", label: "ROGUE_TRADER.SkillForbiddenLore" },
      navigation: { char: "int", type: "advanced", label: "ROGUE_TRADER.SkillNavigation" },
      performer: { char: "fel", type: "advanced", label: "ROGUE_TRADER.SkillPerformer" },
      scholasticLore: { char: "int", type: "advanced", label: "ROGUE_TRADER.SkillScholasticLore" },
      secretTongue: { char: "int", type: "advanced", label: "ROGUE_TRADER.SkillSecretTongue" },
      speakLanguage: { char: "int", type: "advanced", label: "ROGUE_TRADER.SkillSpeakLanguage" },
      trade: { char: "int", type: "advanced", label: "ROGUE_TRADER.SkillTrade" }
    },

    // Test difficulty modifiers (Table 9-3)
    testDifficulty: {
      trivial: { modifier: 60, label: "ROGUE_TRADER.DifficultyTrivial" },
      elementary: { modifier: 50, label: "ROGUE_TRADER.DifficultyElementary" },
      simple: { modifier: 40, label: "ROGUE_TRADER.DifficultySimple" },
      easy: { modifier: 30, label: "ROGUE_TRADER.DifficultyEasy" },
      routine: { modifier: 20, label: "ROGUE_TRADER.DifficultyRoutine" },
      ordinary: { modifier: 10, label: "ROGUE_TRADER.DifficultyOrdinary" },
      challenging: { modifier: 0, label: "ROGUE_TRADER.DifficultyChallenging" },
      difficult: { modifier: -10, label: "ROGUE_TRADER.DifficultyDifficult" },
      hard: { modifier: -20, label: "ROGUE_TRADER.DifficultyHard" },
      veryHard: { modifier: -30, label: "ROGUE_TRADER.DifficultyVeryHard" },
      arduous: { modifier: -40, label: "ROGUE_TRADER.DifficultyArduous" },
      punishing: { modifier: -50, label: "ROGUE_TRADER.DifficultyPunishing" },
      hellish: { modifier: -60, label: "ROGUE_TRADER.DifficultyHellish" }
    },

    // Combat actions with modifiers (Table 9-4)
    combatActions: {
      standard: { modifier: 0, label: "ROGUE_TRADER.ActionStandard", type: "both" },
      aimHalf: { modifier: 10, label: "ROGUE_TRADER.ActionAimHalf", type: "both" },
      aimFull: { modifier: 20, label: "ROGUE_TRADER.ActionAimFull", type: "both" },
      allOutAttack: { modifier: 20, label: "ROGUE_TRADER.ActionAllOutAttack", type: "melee" },
      charge: { modifier: 10, label: "ROGUE_TRADER.ActionCharge", type: "melee" },
      calledShot: { modifier: -20, label: "ROGUE_TRADER.ActionCalledShot", type: "both" },
      guardedAction: { modifier: -10, label: "ROGUE_TRADER.ActionGuardedAction", type: "both" },
      semiAuto: { modifier: 10, label: "ROGUE_TRADER.ActionSemiAuto", type: "ranged" },
      fullAuto: { modifier: 20, label: "ROGUE_TRADER.ActionFullAuto", type: "ranged" },
      suppressingFire: { modifier: -20, label: "ROGUE_TRADER.ActionSuppressingFire", type: "ranged" }
    },

    // Power roll types
    powerRollTypes: {
      attack: "ROGUE_TRADER.PowerRollTypeAttack",
      skill: "ROGUE_TRADER.PowerRollTypeSkill",
      other: "ROGUE_TRADER.PowerRollTypeOther"
    }
  };

  // Define custom Document classes
  CONFIG.Actor.documentClass = RogueTraderActor;
  CONFIG.Item.documentClass = RogueTraderItem;

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("rogue-trader", RogueTraderActorSheet, {
    types: ["character"],
    makeDefault: true,
    label: "ROGUE_TRADER.SheetCharacter"
  });
  Actors.registerSheet("rogue-trader", RogueTraderNPCSheet, {
    types: ["npc"],
    makeDefault: true,
    label: "ROGUE_TRADER.SheetNPC"
  });

  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("rogue-trader", RogueTraderItemSheet, {
    makeDefault: true,
    label: "ROGUE_TRADER.SheetItem"
  });

  // Preload Handlebars templates
  await preloadHandlebarsTemplates();

  // Register Handlebars helpers
  Handlebars.registerHelper("times", function (n, content) {
    let result = "";
    for (let i = 0; i < n; i++) {
      result += content.fn(i);
    }
    return result;
  });

  Handlebars.registerHelper("eq", function (a, b) {
    return a === b;
  });

  Handlebars.registerHelper("add", function (a, b) {
    return Number(a) + Number(b);
  });

  Handlebars.registerHelper("gt", function (a, b) {
    return Number(a) > Number(b);
  });

  Handlebars.registerHelper("gte", function (a, b) {
    return Number(a) >= Number(b);
  });

  Handlebars.registerHelper("lt", function (a, b) {
    return Number(a) < Number(b);
  });

  Handlebars.registerHelper("lte", function (a, b) {
    return Number(a) <= Number(b);
  });
});

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once("ready", async function () {
  console.log("Rogue Trader | System Ready");
});

/* -------------------------------------------- */
/*  Combat Hooks                                */
/* -------------------------------------------- */

// Reset initiative at the start of each round (Rogue Trader rolls initiative every round)
Hooks.on("combatRound", async (combat, updateData, updateOptions) => {
  try {
    // Reset all combatant initiatives to null so they must roll again
    const updates = combat.combatants.map(c => ({
      _id: c.id,
      initiative: null
    }));
    await combat.updateEmbeddedDocuments("Combatant", updates);
    ui.notifications.info("New round! Roll initiative again.");
  } catch (error) {
    console.error("Rogue Trader | Error resetting initiative:", error);
    ui.notifications.error("Failed to reset initiative for new round.");
  }
});
