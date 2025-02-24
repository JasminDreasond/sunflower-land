import Decimal from "decimal.js-light";
import { isCollectibleBuilt } from "features/game/lib/collectibleBuilt";
import { getBudYieldBoosts } from "features/game/lib/getBudYieldBoosts";
import { Equipped } from "features/game/types/bumpkin";
import {
  BumpkinActivityName,
  trackActivity,
} from "features/game/types/bumpkinActivity";
import { FRUIT, FruitName, FRUIT_SEEDS } from "features/game/types/fruits";
import { Collectibles, GameState } from "features/game/types/game";
import cloneDeep from "lodash.clonedeep";

export type HarvestFruitAction = {
  type: "fruit.harvested";
  index: string;
};

type Options = {
  state: Readonly<GameState>;
  action: HarvestFruitAction;
  createdAt?: number;
};

type FruitYield = {
  name: FruitName;
  collectibles: Collectibles;
  buds: NonNullable<GameState["buds"]>;
  wearables: Equipped;
};

export function getFruitYield({
  collectibles,
  buds,
  name,
  wearables,
}: FruitYield) {
  let amount = 1;
  if (name === "Apple" && isCollectibleBuilt("Lady Bug", collectibles)) {
    amount += 0.25;
  }

  if (
    name === "Blueberry" &&
    isCollectibleBuilt("Black Bearry", collectibles)
  ) {
    amount += 1;
  }

  if (
    (name === "Apple" || name === "Orange" || name === "Blueberry") &&
    wearables?.coat === "Fruit Picker Apron"
  ) {
    amount += 0.1;
  }

  amount += getBudYieldBoosts(buds, name);

  return amount;
}

function getPlantedAt(
  fruitName: FruitName,
  collectibles: Collectibles,
  createdAt: number
) {
  if (
    fruitName === "Orange" &&
    isCollectibleBuilt("Squirrel Monkey", collectibles)
  ) {
    const orangeTimeInMilliseconds =
      FRUIT_SEEDS()["Orange Seed"].plantSeconds * 1000;

    const offset = orangeTimeInMilliseconds / 2;

    return createdAt - offset;
  }

  return createdAt;
}

export function harvestFruit({
  state,
  action,
  createdAt = Date.now(),
}: Options): GameState {
  const stateCopy = cloneDeep(state);
  const { fruitPatches, bumpkin, collectibles } = stateCopy;

  if (!bumpkin) {
    throw new Error("You do not have a Bumpkin");
  }

  const patch = fruitPatches[action.index];

  if (!patch) {
    throw new Error("Fruit patch does not exist");
  }

  if (!patch.fruit) {
    throw new Error("Nothing was planted");
  }

  const { name, plantedAt, harvestsLeft, harvestedAt, amount } = patch.fruit;

  const { seed } = FRUIT()[name];
  const { plantSeconds } = FRUIT_SEEDS()[seed];

  if (createdAt - plantedAt < plantSeconds * 1000) {
    throw new Error("Not ready");
  }

  if (createdAt - harvestedAt < plantSeconds * 1000) {
    throw new Error("Fruit is still replenishing");
  }

  if (!harvestsLeft) {
    throw new Error("No harvest left");
  }

  stateCopy.inventory[name] =
    stateCopy.inventory[name]?.add(amount) ?? new Decimal(amount);

  patch.fruit.harvestsLeft = patch.fruit.harvestsLeft - 1;
  patch.fruit.harvestedAt = getPlantedAt(
    name,
    stateCopy.collectibles,
    createdAt
  );

  patch.fruit.amount = getFruitYield({
    name,
    collectibles: collectibles,
    buds: stateCopy.buds ?? {},
    wearables: bumpkin.equipped,
  });

  const activityName: BumpkinActivityName = `${name} Harvested`;

  bumpkin.activity = trackActivity(activityName, bumpkin.activity);

  return stateCopy;
}
