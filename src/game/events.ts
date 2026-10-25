import { nightsUntilWinter, retirementHard, retirementReady, seasonKey, yearsSince } from "./calendar";
import { CROPS, HEIRLOOMS } from "./content";
import { eachTile } from "./grid";
import { addMoney, bumpFamily, grantHeirloom, harvestCropTile, memory } from "./mutate";
import {
  CENTURY_END,
  type ChoiceOutcome,
  type GameState,
} from "./types";
import { syncWorld } from "./world";

export interface EventChoice {
  label: string;
  hint: string;
  apply: (s: GameState) => ChoiceOutcome;
}

export interface EventDef {
  id: string;
  title: string;
  priority: number;
  once?: boolean;
  chance: number;
  test: (s: GameState) => boolean;
  body: (s: GameState) => string;
  choices: (s: GameState) => EventChoice[];
}

function say(text: string, extra: Partial<ChoiceOutcome> = {}): ChoiceOutcome {
  return { text, ...extra };
}

function cityKid(s: GameState) {
  return s.children.find(
    (c) => !c.leftForCity && !c.askedCity && s.year - c.bornYear >= 15 && c.traits.restless >= 6,
  );
}

function homeKids(s: GameState) {
  return s.children.filter((c) => !c.leftForCity && s.year - c.bornYear >= 2);
}

function sellEast(s: GameState, pay: number): void {
  eachTile(s, (t, x, y) => {
    if (t.parcel !== "east") return;
    if (t.crop && t.crop.prog >= CROPS[t.crop.id].growDays) harvestCropTile(s, x, y);
    t.crop = null;
    t.tree = null;
    t.tilled = false;
  });
  if (!s.soldParcels.includes("east")) s.soldParcels.push("east");
  addMoney(s, pay);
  syncWorld(s);
}

export const EVENTS: EventDef[] = [
  {
    id: "century",
    title: "The ledger closes",
    priority: 120,
    once: true,
    chance: 1,
    test: (s) => s.year >= CENTURY_END,
    body: (s) =>
      `It is ${s.year}. The county is writing a history, and the Whitaker pages stop here whether the fields do or not. ${
        s.generation < 3
          ? "You did not get three full generations inside the century. The book is honest about that."
          : "Three heads of the household have kept this ground. Someone has to be the last name on the page."
      }`,
    choices: () => [
      {
        label: "Choose who is remembered",
        hint: "Opens the last inheritance, then the town's memory.",
        apply: () => say("You turn the key in the lock one last time.", { succession: true, final: true, forced: true }),
      },
    ],
  },
  {
    id: "retirement",
    title: "The keys on the nail",
    priority: 110,
    chance: 1,
    test: (s) => retirementReady(s),
    body: (s) => {
      const years = s.year - s.stewardStart;
      const heirs = s.children.filter((c) => !c.leftForCity && s.year - c.bornYear >= 15);
      const names = heirs.map((c) => c.name).join(", ") || "no child of age";
      return `You have kept this farm for ${years} years. Your back files a complaint every morning and the town has started to ask, gently, who is next. Ready to take it: ${names}.`;
    },
    choices: (s) => {
      const hard = retirementHard(s);
      const list: EventChoice[] = [
        {
          label: "Pass the farm",
          hint: "Choose an heir and up to three things the box will carry.",
          apply: () => say("You take the keys off the nail.", { succession: true, forced: hard }),
        },
      ];
      if (!hard) {
        list.push({
          label: "One more year",
          hint: "The question comes back next spring.",
          apply: (st) => {
            st.flags.deferRetire = st.year;
            return say("You hang the keys back up. The chair by the stove can wait.");
          },
        });
      }
      return list;
    },
  },
  {
    id: "foreclosure",
    title: "The bank's patience",
    priority: 105,
    chance: 1,
    test: (s) => s.debt >= 420 && s.money < 30 && yearsSince(s, "foreclosure") >= 2,
    body: (s) =>
      `A clerk in a careful coat stands in the lane. The note has swollen to $${s.debt}. He does not enjoy this part of the work. He is here anyway.`,
    choices: (s) => {
      const list: EventChoice[] = [];
      if (!s.soldParcels.includes("east")) {
        list.push({
          label: "Give them the east acre",
          hint: "The debt drops by $220. The field is gone.",
          apply: (st) => {
            sellEast(st, 0);
            st.debt = Math.max(0, st.debt - 220);
            memory(st, `The bank took the east acre in ${st.year}.`);
            bumpFamily(st, "voss", -8);
            return say("The clerk writes the acre into the bank's name and looks sorry about the mud on his shoes.");
          },
        });
      }
      if (s.families.harrow.relation >= 25) {
        list.push({
          label: "Ask the Harrows to stand the gap",
          hint: "They cover $120 of the note. The friendship spends some of itself.",
          apply: (st) => {
            st.debt = Math.max(0, st.debt - 120);
            bumpFamily(st, "harrow", -12);
            memory(st, `The Harrows bought ${st.year} back from the bank.`);
            return say("Ruth says, 'We'll take it out of pie for the next ten years,' and means the money, mostly.");
          },
        });
      }
      list.push({
        label: "Promise a harvest",
        hint: "Nothing is paid today. They will be back.",
        apply: (st) => {
          bumpFamily(st, "voss", -6);
          return say("The clerk tips his hat. Promises do not compound, he says. Interest does.");
        },
      });
      return list;
    },
  },
  {
    id: "welcome-pie",
    title: "Pie at the fence",
    priority: 100,
    once: true,
    chance: 1,
    test: (s) => s.year === 1925 && s.season === "summer",
    body: () =>
      "Ruth Harrow is at the fence with a pie that did not need to be this good. 'Your mother shared water the year the well went chalky,' she says. 'I'm checking whether the habit survived.'",
    choices: () => [
      {
        label: "Take the pie and promise water",
        hint: "Harrows +18. You start tomorrow full of sugar and obligation.",
        apply: (s) => {
          bumpFamily(s, "harrow", 18);
          s.energy = s.maxEnergy;
          memory(s, "Accepted Ruth Harrow's pie and a promise about water.");
          return say("The pie is gone by dusk. The promise is not.");
        },
      },
      {
        label: "Thank her and keep the afternoon for work",
        hint: "A little goodwill, plus seed. You do not owe the creek.",
        apply: (s) => {
          bumpFamily(s, "harrow", 6);
          s.seeds.potato += 2;
          return say("Ruth leaves the pie anyway. 'Pride doesn't keep,' she says.");
        },
      },
      {
        label: "Tell her the ditch is yours",
        hint: "Harrows −12. The fence feels closer.",
        apply: (s) => {
          bumpFamily(s, "harrow", -12);
          memory(s, "Told the Harrows the ditch was not a shared thing.");
          return say("She takes the pie home. The fence is just a fence after that.");
        },
      },
    ],
  },
  {
    id: "depression",
    title: "The price of wheat",
    priority: 100,
    once: true,
    chance: 1,
    test: (s) => s.year === 1930 && s.season === "spring",
    body: () =>
      "Nell pins the new board up before breakfast. Wheat has fallen through the floor. Corn is limping. Potatoes and beans are still food, and food is the only currency anyone trusts this spring.",
    choices: () => [
      {
        label: "Plant what people can eat",
        hint: "Gain potato and bean seed. A survival year.",
        apply: (s) => {
          s.seeds.potato += 8;
          s.seeds.beans += 6;
          s.flags.subsistence = true;
          memory(s, "In 1930 the farm planted food before it planted profit.");
          return say("You buy the cheap sacks. They feel heavier than wheat ever did.");
        },
      },
      {
        label: "Hold out for a wheat rally",
        hint: "No gift. If the papers are wrong, you eat the bet.",
        apply: (s) => {
          s.flags.wheatGamble = true;
          memory(s, "Gambled on wheat in the worst year to do it.");
          return say("Nell shrugs with her whole face. 'It's your field.'");
        },
      },
    ],
  },
  {
    id: "war",
    title: "The radio in the store",
    priority: 100,
    once: true,
    chance: 1,
    test: (s) => s.year === 1942 && s.season === "spring",
    body: () =>
      "The war that was a map in the newspaper is now a voice on Nell's counter. Wheat prices will rise. So will the number of empty chairs. Harlan Pike's nephew has already gone.",
    choices: (s) => {
      const list: EventChoice[] = [];
      if (s.money >= 30) {
        list.push({
          label: "Buy a $30 war bond",
          hint: "The certificate can be passed down. It pays a little every spring.",
          apply: (st) => {
            st.money -= 30;
            grantHeirloom(st, "war-bond");
            bumpFamily(st, "pike", 8);
            bumpFamily(st, "voss", 6);
            memory(st, "Bought a war bond in 1942.");
            return say("The certificate smells like ink and the inside of a drawer.");
          },
        });
      }
      list.push({
        label: "Send blankets, not money",
        hint: "Costs the afternoon. Every family in town notices.",
        apply: (st) => {
          st.energy = Math.max(0, st.energy - 28);
          bumpFamily(st, "harrow", 8);
          bumpFamily(st, "voss", 8);
          bumpFamily(st, "pike", 8);
          memory(st, "Spent the spring drive knitting and hauling, not buying.");
          return say("Your hands ache in a way that feels easier than the radio.");
        },
      });
      list.push({
        label: "Keep the cash in the jar",
        hint: "Pike family −8. The farm stays liquid.",
        apply: (st) => {
          bumpFamily(st, "pike", -8);
          memory(st, "Kept the jar shut when the war drive came through.");
          return say("Harlan hears. He does not shout. He also does not wave from the woodlot.");
        },
      });
      if (s.buffs.hotTempered) {
        list.push({
          label: "Tell the clerk the farm already paid",
          hint: "Hot temper. Voss −6, and you keep every dollar.",
          apply: (st) => {
            bumpFamily(st, "voss", -6);
            return say("You say it too loud. The radio keeps talking anyway.");
          },
        });
      }
      return list;
    },
  },
  {
    id: "tractor-age",
    title: "The tractor age",
    priority: 100,
    once: true,
    chance: 1,
    test: (s) => s.year === 1950 && s.season === "spring",
    body: () =>
      "A red machine is parked outside Voss's like a dare. Fuel, payments, and hybrid seed are suddenly part of farming, not a magazine. The horses are not dead. They are no longer the whole argument. Crop money will move differently from here: wheat is a commodity, specialty apples pay better, and the ground can be asked for more than it wants to give.",
    choices: () => [
      {
        label: "Go look, and take the discount",
        hint: "The tractor's price comes down. It is still a fortune.",
        apply: (s) => {
          s.tractorDiscount = true;
          memory(s, "Met the tractor age with a catalogue and a discount.");
          return say("The salesman slaps the tire. It sounds expensive.");
        },
      },
      {
        label: "The horses are enough",
        hint: "The plow stays cheaper to work. No machine.",
        apply: (s) => {
          s.horseLoyal = true;
          memory(s, "Stayed with horses when the tractor arrived.");
          return say("You walk home the long way. The lane is quiet and still muddy.");
        },
      },
    ],
  },
  {
    id: "contract",
    title: "A contract for corn",
    priority: 92,
    once: true,
    chance: 1,
    test: (s) => s.year === 1958 && s.season === "spring",
    body: () =>
      "A buyer from the highway grocer wants corn and only corn, at a price that makes the west field look like a factory. The catch is in the ground: the yield is real, and so is the tiredness it leaves behind. Apples and mixed rows will not impress him.",
    choices: () => [
      {
        label: "Sign for the corn",
        hint: "Corn sells for much more and drains much more.",
        apply: (s) => {
          s.contract = true;
          memory(s, "Signed the supermarket corn contract.");
          bumpFamily(s, "voss", 10);
          return say("The contract is two pages. The second page is what the soil will think of you.");
        },
      },
      {
        label: "Stay a mixed farm",
        hint: "The buyer shrugs. Apples pay a little better afterward.",
        apply: (s) => {
          s.specialtyApple = true;
          bumpFamily(s, "voss", -4);
          memory(s, "Refused to turn the farm into a corn contract.");
          return say("You keep the rotation. The buyer finds somebody hungrier.");
        },
      },
    ],
  },
  {
    id: "child-city",
    title: "The road out",
    priority: 96,
    chance: 1,
    test: (s) => !!cityKid(s),
    body: (s) => {
      const c = cityKid(s)!;
      return `${c.name} is ${s.year - c.bornYear} and has stopped pretending the farm is the whole map. There's a job in the city, a room with a sink, and a train that does not ask permission. They want an answer before summer work starts.`;
    },
    choices: (s) => {
      const c = cityKid(s)!;
      return [
        {
          label: `Ask ${c.name} to stay`,
          hint: "They remain an heir. Restlessness hardens a little. So does the temper.",
          apply: (st) => {
            const kid = st.children.find((k) => k.id === c.id);
            if (kid) {
              kid.askedCity = true;
              kid.traits.restless = Math.max(0, kid.traits.restless - 1);
              kid.traits.hotTempered += 2;
              kid.attention = Math.max(0, kid.attention - 2);
            }
            memory(st, `Asked ${c.name} to stay when the city offered a room.`);
            return say(`${c.name} stays. The house is louder in the evenings, and not always kindly.`);
          },
        },
        {
          label: `Let ${c.name} go`,
          hint: "They leave the heir list. Letters with a little money can be passed down.",
          apply: (st) => {
            const kid = st.children.find((k) => k.id === c.id);
            if (kid) {
              kid.askedCity = true;
              kid.leftForCity = true;
            }
            st.remittance += 15;
            grantHeirloom(st, "city-letter");
            memory(st, `${c.name} left for the city in ${st.year}.`);
            return say(`The train takes ${c.name}. The room they slept in stays made for a month.`);
          },
        },
      ];
    },
  },
  {
    id: "memory-feud",
    title: "The old spit",
    priority: 94,
    once: true,
    chance: 1,
    test: (s) => s.generation >= 2 && s.season === "spring" && s.families.pike.relation <= -25,
    body: () =>
      "Harlan's people still tell it. Whatever your folks did, or refused to do, has been inherited like a bad fence line. A grandson practices the surname like a curse. The woodlot is posted. The store will sell you seed, but Pike labor will not come cheap, or at all.",
    choices: (s) => {
      const list: EventChoice[] = [
        {
          label: "Bring apples and an apology",
          hint: s.apples >= 4 ? "Costs 4 apples. Pike +32." : "You need 4 apples in the cellar.",
          apply: (st) => {
            if (st.apples < 4) return say("You show up with empty hands. Harlan nods like that proved something.");
            st.apples -= 4;
            bumpFamily(st, "pike", 32);
            grantHeirloom(st, "iou-pike");
            memory(st, "Walked apples up to the Pike woodlot and ate the apology.");
            return say("Harlan takes the basket and says nothing for a long time. Then he says, 'Square enough.'");
          },
        },
        {
          label: "Let them spit",
          hint: "The feud settles in for another generation.",
          apply: (st) => {
            bumpFamily(st, "pike", -10);
            memory(st, "Let the Pike feud stand.");
            return say("The sign stays up. So does the story.");
          },
        },
      ];
      if (s.buffs.hotTempered) {
        list.push({
          label: "Tell them to stay off the lane",
          hint: "Hot temper. Pike −18.",
          apply: (st) => {
            bumpFamily(st, "pike", -18);
            memory(st, "Worsened the Pike feud on purpose.");
            return say("You say it where the town can hear. The town does.");
          },
        });
      }
      return list;
    },
  },
  {
    id: "memory-friend",
    title: "Casserole weather",
    priority: 93,
    once: true,
    chance: 1,
    test: (s) => s.generation >= 2 && s.season === "spring" && s.families.harrow.relation >= 40,
    body: () =>
      "The Harrows arrive before you have boots on. They remember a pie, or a ditch, or a drought — the story has softened into a casserole and six tilled rows. Friendships on this lane outlive the people who started them.",
    choices: () => [
      {
        label: "Thank them and mean it",
        hint: "They till part of the garden. Harrows +8.",
        apply: (s) => {
          let n = 0;
          eachTile(s, (t) => {
            if (n >= 8) return;
            if (t.parcel === "garden" && !t.crop && !t.tree && !t.solid) {
              t.tilled = true;
              n++;
            }
          });
          bumpFamily(s, "harrow", 8);
          memory(s, "The Harrows tilled the garden because their parents had been friends.");
          return say("By noon the garden is opened and the casserole dish is yours to return, which is a kind of contract.");
        },
      },
      {
        label: "Insist on paying",
        hint: "They take $15 and a little of the warmth.",
        apply: (s) => {
          if (s.money >= 15) s.money -= 15;
          bumpFamily(s, "harrow", -4);
          return say("Ruth takes the bills like they are a mild insult she has decided to forgive.");
        },
      },
    ],
  },
  {
    id: "sell-east",
    title: "An offer on the east acre",
    priority: 90,
    once: true,
    chance: 1,
    test: (s) => s.year === 1929 && s.season === "spring" && !s.soldParcels.includes("east"),
    body: (s) =>
      `A man from the county road has a clean hat and a number. $${s.year >= 1950 ? 280 : 180} for the east acre, trees included, no arguments, no coming back. The money would sit in the jar like a second harvest. The field would not.`,
    choices: (s) => [
      {
        label: "Keep the acre",
        hint: "The offer leaves. The ground stays in the family.",
        apply: (st) => {
          st.flags.refusedSale = true;
          memory(st, `Refused to sell the east acre in ${st.year}.`);
          return say("You send him off the lane. The east acre looks the same, which is the point.");
        },
      },
      {
        label: `Sell it for $${s.year >= 1950 ? 280 : 180}`,
        hint: "Permanent. Crops there are cashed out if ripe. Trees go too.",
        apply: (st) => {
          const pay = st.year >= 1950 ? 280 : 180;
          sellEast(st, pay);
          bumpFamily(st, "harrow", -6);
          bumpFamily(st, "pike", -4);
          memory(st, `Sold the east acre in ${st.year}.`);
          return say("The hat gets back in the car. By next week there is a sign where your rows were.");
        },
      },
    ],
  },
  {
    id: "family-time",
    title: "A season with the children",
    priority: 72,
    chance: 1,
    test: (s) =>
      (s.season === "autumn" || s.season === "winter") &&
      homeKids(s).length > 0 &&
      s.familyTimeKey !== seasonKey(s),
    body: (s) => {
      const names = homeKids(s).map((c) => c.name).join(" and ");
      return `${names} ${homeKids(s).length > 1 ? "are" : "is"} watching how a season is spent. Attention is a tool. It shapes who will be fit to hold this place, and who will only inherit the urge to leave it.`;
    },
    choices: () => [
      {
        label: "Work the rows together",
        hint: "Green thumb +2. They feel kept.",
        apply: (s) => {
          for (const c of homeKids(s)) {
            c.traits.greenThumb += 2;
            c.attention += 1;
          }
          s.familyTimeKey = seasonKey(s);
          return say("Dirt under all of your nails, matching. It is a small curriculum.");
        },
      },
      {
        label: "Count the jar at the table",
        hint: "Frugal +2. They learn what things cost.",
        apply: (s) => {
          for (const c of homeKids(s)) {
            c.traits.frugal += 2;
            c.attention += 1;
          }
          s.familyTimeKey = seasonKey(s);
          return say("You show them the debt the way other families show photographs.");
        },
      },
      {
        label: "Let them follow the creek",
        hint: "Restless +2. Freedom, and the road gets nearer.",
        apply: (s) => {
          for (const c of homeKids(s)) {
            c.traits.restless += 2;
          }
          s.familyTimeKey = seasonKey(s);
          return say("They come back at dusk with wet cuffs and a story you are not in.");
        },
      },
      {
        label: "Come home sharp",
        hint: "Hot temper +2. Attention falls.",
        apply: (s) => {
          for (const c of homeKids(s)) {
            c.traits.hotTempered += 2;
            c.attention = Math.max(0, c.attention - 1);
          }
          s.familyTimeKey = seasonKey(s);
          return say("The door slams once. Then everyone pretends it was the wind.");
        },
      },
    ],
  },
  {
    id: "drought",
    title: "A hard sky",
    priority: 64,
    chance: 0.62,
    test: (s) => s.season === "summer" && s.year > 1926 && yearsSince(s, "drought") >= 3,
    body: () =>
      "The rain skips the valley. Leaves go dull. Ruth is at the fence again, not with pie — with a bucket and a question about the ditch you both pretend is only yours.",
    choices: (s) => {
      const list: EventChoice[] = [
        {
          label: "Share the ditch",
          hint: "Your crops miss a watering. Harrows +22. A bouquet for the box, if you haven't one.",
          apply: (st) => {
            st.weather = "drought";
            st.flags.droughtLock = `${st.year}:${st.season}`;
            eachTile(st, (t) => {
              if (t.crop) t.crop.dry += 1;
            });
            bumpFamily(st, "harrow", 22);
            grantHeirloom(st, "dried-bouquet");
            if (st.families.harrow.relation >= 20) grantHeirloom(st, "iou-harrow");
            memory(st, `Shared water in the ${st.year} drought.`);
            return say("The bucket goes over the fence all week. Your rows look thirsty. Ruth's do not.");
          },
        },
        {
          label: "Keep every drop",
          hint: "Your crops are watered. Harrows and Pikes cool sharply.",
          apply: (st) => {
            st.weather = "drought";
            st.flags.droughtLock = `${st.year}:${st.season}`;
            eachTile(st, (t) => {
              if (t.crop) t.crop.watered = true;
            });
            bumpFamily(st, "harrow", -16);
            bumpFamily(st, "pike", -8);
            memory(st, `Kept the water in the ${st.year} drought.`);
            return say("Your rows hold. The lane gets quiet in a new way.");
          },
        },
      ];
      if (s.buffs.hotTempered) {
        list.push({
          label: "Run them off the creek",
          hint: "Hot temper. Harrows −24. Your yields hold.",
          apply: (st) => {
            st.weather = "drought";
            st.flags.droughtLock = `${st.year}:${st.season}`;
            bumpFamily(st, "harrow", -24);
            memory(st, "Drove neighbors off the creek in a drought.");
            return say("You shout. It works, which is the worst part.");
          },
        });
      }
      return list;
    },
  },
  {
    id: "frost",
    title: "Early frost",
    priority: 56,
    chance: 0.5,
    test: (s) => s.season === "autumn" && s.year > 1925 && yearsSince(s, "frost") >= 2,
    body: (s) => {
      const left = nightsUntilWinter(s);
      return `The air smells like iron. A frost is coming before the calendar agreed to it. Anything still soft in the ground is a gamble, and you have about ${left} night${left === 1 ? "" : "s"} of autumn left if the cold is wrong. It might not be wrong.`;
    },
    choices: () => [
      {
        label: "Harvest by lantern",
        hint: "Pull everything that is ripe or nearly ripe. The day is spent.",
        apply: (s) => {
          let n = 0;
          eachTile(s, (t, x, y) => {
            if (!t.crop) return;
            const need = CROPS[t.crop.id].growDays;
            if (t.crop.prog >= need - 1) {
              harvestCropTile(s, x, y, t.crop.prog >= need ? 0 : 1);
              n++;
            }
          });
          s.energy = Math.min(s.energy, 20);
          return say(n ? `You save ${n} plantings under a mean little moon.` : "There was nothing far enough along to save. You walk the rows anyway.");
        },
      },
      {
        label: "Wait for the real date",
        hint: "Immature crops die. Ripe ones stay until you pick them.",
        apply: (s) => {
          let dead = 0;
          eachTile(s, (t) => {
            if (!t.crop) return;
            if (t.crop.prog < CROPS[t.crop.id].growDays) {
              t.crop = null;
              t.soil = Math.max(0, t.soil - 2);
              dead++;
            }
          });
          memory(s, `Lost ${dead} plantings to an early frost in ${s.year}.`);
          return say(dead ? `The frost takes ${dead} plantings and does not apologize.` : "Nothing was young enough to kill. You got lucky, which is a kind of skill.");
        },
      },
    ],
  },
  {
    id: "flood",
    title: "The creek changes its mind",
    priority: 56,
    chance: 0.42,
    test: (s) => s.season === "spring" && s.year > 1926 && yearsSince(s, "flood") >= 3,
    body: () =>
      "Two days of rain upstream and the creek bottom is a brown mirror. Silt is a gift and a thief. It will leave the soil richer and the current crop ruined unless you spend cash and a day on ditches.",
    choices: (s) => {
      const list: EventChoice[] = [
        {
          label: "Let the silt have it",
          hint: "Creek-bottom crops die. Those tiles gain soil.",
          apply: (st) => {
            let n = 0;
            eachTile(st, (t) => {
              if (t.parcel !== "creek") return;
              if (t.crop) {
                t.crop = null;
                n++;
              }
              t.soil = Math.min(100, t.soil + 12);
            });
            memory(st, `The creek flooded in ${st.year} and left silt.`);
            return say(n ? `You lose ${n} plantings and gain a darker, kinder mud.` : "Nothing was planted there. The mud is still a raise in pay.");
          },
        },
      ];
      if (s.money >= 20) {
        list.push({
          label: "Pay $20 to cut a ditch",
          hint: "The crop stays. Less silt, less gift.",
          apply: (st) => {
            st.money -= 20;
            eachTile(st, (t) => {
              if (t.parcel === "creek") t.soil = Math.min(100, t.soil + 4);
            });
            return say("You spend the money and the day. The creek stays in its bed, offended.");
          },
        });
      }
      return list;
    },
  },
  {
    id: "fair",
    title: "County fair",
    priority: 52,
    chance: 0.8,
    test: (s) => s.season === "autumn" && yearsSince(s, "fair") >= 2,
    body: (s) => {
      const best = (["wheat", "potato", "beans", "corn"] as const)
        .map((id) => ({ id, n: s.harvest[id] }))
        .sort((a, b) => b.n - a.n)[0]!;
      const apples = s.apples;
      return `The fair wants a bushel and a story. Your fullest sack is ${best.n} ${CROPS[best.id].name.toLowerCase()}${apples ? `, and you have ${apples} apples` : ""}. Winning is a ribbon, a purse, and the way Nell says your name afterward.`;
    },
    choices: (s) => {
      const best = (["wheat", "potato", "beans", "corn"] as const)
        .map((id) => ({ id, n: s.harvest[id] }))
        .sort((a, b) => b.n - a.n)[0]!;
      const list: EventChoice[] = [];
      if (best.n >= 8 || s.apples >= 6) {
        list.push({
          label: "Enter the best you have",
          hint: "Costs a sack. $28 and a ribbon if the town is feeling generous, which it is.",
          apply: (st) => {
            if (st.apples >= 6 && st.apples >= best.n) st.apples = Math.max(0, st.apples - 6);
            else st.harvest[best.id] = Math.max(0, st.harvest[best.id] - 8);
            addMoney(st, 28);
            bumpFamily(st, "voss", 10);
            grantHeirloom(st, "fair-ribbon");
            memory(st, `Won a ribbon at the ${st.year} fair.`);
            return say("The ribbon is cheap cloth and it still feels like a deed.");
          },
        });
      }
      list.push({
        label: "Walk the midway and go home",
        hint: "No prize. The evening is yours.",
        apply: () => say("You eat something fried and do not enter. The lights are enough."),
      });
      return list;
    },
  },
  {
    id: "loan",
    title: "The bank will lend",
    priority: 58,
    chance: 0.55,
    test: (s) => s.money < 70 && s.debt < 260 && s.year > 1925 && yearsSince(s, "loan") >= 4,
    body: (s) => {
      const rate = Math.round((s.year < 1950 ? 0.1 : 0.07) * 100);
      return `The county bank will put $140 in the jar tonight. Interest is about ${rate}% a year, compounded into the note every spring, and they do not care that the weather is not your fault.`;
    },
    choices: () => [
      {
        label: "Take $140",
        hint: "Debt rises with it. Spring will add interest.",
        apply: (s) => {
          s.money += 140;
          s.debt += 140;
          memory(s, `Took a bank loan in ${s.year}.`);
          return say("The bills are newer than anything else in the kitchen.");
        },
      },
      {
        label: "Do without",
        hint: "The jar stays thin. So does the note.",
        apply: () => say("You shake your head. The clerk has other farms to visit."),
      },
    ],
  },
  {
    id: "medical",
    title: "A fever in the house",
    priority: 57,
    chance: 0.38,
    test: (s) => s.year > 1927 && yearsSince(s, "medical") >= 7,
    body: () =>
      "Someone is hot to the touch and the room smells like vinegar. The doctor will come from the next town if you pay. Waiting it out is free and not free.",
    choices: (s) => [
      {
        label: s.money >= 35 ? "Call the doctor ($35)" : "Call the doctor and owe the rest",
        hint: s.money >= 35 ? "Pay from the jar." : "What you can't pay is added to your burdens.",
        apply: (st) => {
          if (st.money >= 35) st.money -= 35;
          else {
            const pay = st.money;
            st.debt += 35 - pay;
            st.money = 0;
          }
          memory(st, `Paid for a doctor in ${st.year}.`);
          return say("The fever breaks near dawn. The bill is the part that lingers.");
        },
      },
      {
        label: "Wait it out",
        hint: "You tire faster for the rest of this generation. Children feel the worry.",
        apply: (st) => {
          st.maxEnergyPenalty += 12;
          for (const c of st.children) if (!c.leftForCity) c.attention = Math.max(0, c.attention - 1);
          memory(st, `Rode out a fever without the doctor in ${st.year}.`);
          return say("It passes. You do not get all of your strength back, and everyone saw you count the cost.");
        },
      },
    ],
  },
  {
    id: "peddler",
    title: "A peddler on the lane",
    priority: 42,
    chance: 0.48,
    test: (s) => yearsSince(s, "peddler") >= 3 && s.season !== "winter",
    body: () =>
      "A cart with a painted apple on the side. He sells saplings, compost, and the kind of advice you can ignore. The dog does not trust the cart and is correct to be theatrical about it.",
    choices: (s) => {
      const list: EventChoice[] = [];
      const sap = s.year >= 1950 ? 16 : 12;
      if (s.money >= sap) {
        list.push({
          label: `Buy two saplings ($${sap})`,
          hint: "Orchards are a letter to a grandchild.",
          apply: (st) => {
            st.money -= sap;
            st.saplings += 2;
            return say("Two thin sticks with roots in burlap. They do not look like a future. They are.");
          },
        });
      }
      if (s.money >= 10) {
        list.push({
          label: "Buy 3 compost kits ($10)",
          hint: "Spread them on tired ground.",
          apply: (st) => {
            st.money -= 10;
            st.compost += 3;
            return say("The kits smell like a barn that has made its peace with itself.");
          },
        });
      }
      list.push({
        label: "Send him on",
        hint: "The dog wins.",
        apply: () => say("The cart creaks toward town. Your jar stays shut."),
      });
      return list;
    },
  },
  {
    id: "barn",
    title: "A barn to raise",
    priority: 48,
    chance: 0.5,
    test: (s) =>
      (s.season === "spring" || s.season === "summer") &&
      s.families.harrow.relation > -15 &&
      yearsSince(s, "barn") >= 5 &&
      s.year > 1925,
    body: () =>
      "The Harrow barn roof finally means it. Half the lane will be there with hammers. A day of your labor is worth more to them than a dollar, and they will remember which you offered.",
    choices: () => [
      {
        label: "Spend the day on their roof",
        hint: "Energy drops. Harrows +20. A few of your tiles get tilled in thanks.",
        apply: (s) => {
          s.energy = Math.min(s.energy, 25);
          bumpFamily(s, "harrow", 20);
          let n = 0;
          eachTile(s, (t) => {
            if (n >= 5) return;
            if ((t.parcel === "garden" || t.parcel === "west") && !t.crop && !t.tree && !t.solid && isOpen(t)) {
              t.tilled = true;
              n++;
            }
          });
          memory(s, `Raised a beam on the Harrow barn in ${s.year}.`);
          return say("You come home sunburned and unable to lift a kettle. The lane feels shorter.");
        },
      },
      {
        label: "Stay with your own rows",
        hint: "Harrows −8.",
        apply: (s) => {
          bumpFamily(s, "harrow", -8);
          return say("You hear the hammers all afternoon. Each one is a little vote.");
        },
      },
    ],
  },
  {
    id: "hybrid",
    title: "Hybrid seed",
    priority: 80,
    once: true,
    chance: 1,
    test: (s) => s.year === 1952 && s.season === "summer",
    body: () =>
      "The extension agent has a sack that crackles like money. Hybrid wheat and corn yield more and drink the soil faster. He calls it modern. Your catalogue from 1918 would call it a question.",
    choices: (s) => {
      const list: EventChoice[] = [];
      if (s.money >= 24) {
        list.push({
          label: "Buy into the hybrids ($24)",
          hint: "Wheat and corn yield more, cost more, and drain more from now on.",
          apply: (st) => {
            st.money -= 24;
            st.hybrid = true;
            memory(st, "Adopted hybrid seed.");
            return say("The sack is heavier than it looks. So is the habit.");
          },
        });
      }
      list.push({
        label: "Keep the old seed",
        hint: "Yields stay modest. The ground gets a vote.",
        apply: (st) => {
          memory(st, "Turned down hybrid seed.");
          return say("The agent writes something in a notebook and leaves you to the old arithmetic.");
        },
      });
      return list;
    },
  },
];

function isOpen(t: GameState["tiles"][number]): boolean {
  return t.g !== "water" && t.g !== "path" && t.g !== "asphalt" && t.g !== "gravel";
}

export function getEvent(id: string): EventDef | undefined {
  return EVENTS.find((e) => e.id === id);
}

export function heirloomName(id: string): string {
  return HEIRLOOMS[id]?.name ?? id;
}
