import "lib/__mocks__/configMock";

import Decimal from "decimal.js-light";
import { INITIAL_BUMPKIN, TEST_FARM } from "features/game/lib/constants";
import { FRUIT_SEEDS } from "features/game/types/fruits";
import { GameState, CropPlot } from "features/game/types/game";
import { harvestFruit } from "./fruitHarvested";

const GAME_STATE: GameState = {
  ...TEST_FARM,
  bumpkin: INITIAL_BUMPKIN,
  fruitPatches: {
    0: {
      fruit: {
        name: "Apple",
        amount: 1,
        plantedAt: 123,
        harvestedAt: 0,
        harvestsLeft: 0,
      },
      x: -2,
      y: 0,
      height: 1,
      width: 1,
    },
    1: {
      x: -2,
      y: 0,
      height: 1,
      width: 1,
    },
  },
};

describe("fruitHarvested", () => {
  const dateNow = Date.now();
  it("throws an error if the player doesn't have a bumpkin", () => {
    expect(() =>
      harvestFruit({
        state: {
          ...GAME_STATE,
          bumpkin: undefined,
        },
        action: {
          type: "fruit.harvested",
          index: "0",
        },
        createdAt: dateNow,
      })
    ).toThrow("You do not have a Bumpkin");
  });

  it("does not harvest on non-existent fruit patch", () => {
    expect(() =>
      harvestFruit({
        state: GAME_STATE,
        action: {
          type: "fruit.harvested",
          index: "-1",
        },
        createdAt: dateNow,
      })
    ).toThrow("Fruit patch does not exist");
  });

  it("does not harvest empty air", () => {
    expect(() =>
      harvestFruit({
        state: GAME_STATE,
        action: {
          type: "fruit.harvested",
          index: "1",
        },
        createdAt: dateNow,
      })
    ).toThrow("Nothing was planted");
  });

  it("does not harvest if the fruit is not ripe", () => {
    const { fruitPatches } = GAME_STATE;
    const fruitPatch = (fruitPatches as Record<number, CropPlot>)[0];

    expect(() =>
      harvestFruit({
        state: {
          ...GAME_STATE,
          fruitPatches: {
            0: {
              ...fruitPatch,
              fruit: {
                name: "Apple",
                plantedAt: Date.now() - 100,
                amount: 1,
                harvestsLeft: 1,
                harvestedAt: 0,
              },
            },
          },
        },
        action: {
          type: "fruit.harvested",
          index: "0",
        },
        createdAt: dateNow,
      })
    ).toThrow("Not ready");
  });

  it("does not harvest if the fruit is still replenishing", () => {
    const { fruitPatches } = GAME_STATE;
    const fruitPatch = (fruitPatches as Record<number, CropPlot>)[0];

    expect(() =>
      harvestFruit({
        state: {
          ...GAME_STATE,
          fruitPatches: {
            0: {
              ...fruitPatch,
              fruit: {
                name: "Apple",
                plantedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
                amount: 1,
                harvestsLeft: 1,
                harvestedAt: Date.now() - 100,
              },
            },
          },
        },
        action: {
          type: "fruit.harvested",
          index: "0",
        },
        createdAt: dateNow,
      })
    ).toThrow("Fruit is still replenishing");
  });

  it("does not harvest if no harvest left", () => {
    const { fruitPatches } = GAME_STATE;
    const fruitPatch = (fruitPatches as Record<number, CropPlot>)[0];

    expect(() =>
      harvestFruit({
        state: {
          ...GAME_STATE,
          fruitPatches: {
            0: {
              ...fruitPatch,
              fruit: {
                name: "Apple",
                plantedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
                amount: 1,
                harvestsLeft: 0,
                harvestedAt: 0,
              },
            },
          },
        },
        action: {
          type: "fruit.harvested",
          index: "0",
        },
        createdAt: dateNow,
      })
    ).toThrow("No harvest left");
  });

  it("harvests the fruit when more than one harvest left", () => {
    const { fruitPatches } = GAME_STATE;
    const fruitPatch = (fruitPatches as Record<number, CropPlot>)[0];
    const initialHarvest = 2;

    const state = harvestFruit({
      state: {
        ...GAME_STATE,
        inventory: {
          Apple: new Decimal(1),
        },
        fruitPatches: {
          0: {
            ...fruitPatch,
            fruit: {
              name: "Apple",
              plantedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
              amount: 1,
              harvestsLeft: initialHarvest,
              harvestedAt: 0,
            },
          },
        },
      },
      action: {
        type: "fruit.harvested",
        index: "0",
      },
      createdAt: dateNow,
    });

    expect(state.inventory).toEqual({
      ...state.inventory,
      Apple: new Decimal(2),
    });

    const { fruitPatches: fruitPatchesAfterHarvest } = state;
    const fruit = fruitPatchesAfterHarvest?.[0].fruit;
    expect(fruit?.harvestsLeft).toEqual(initialHarvest - 1);
    expect(fruit?.harvestedAt).toEqual(dateNow);
  });

  it("harvests the fruit which has a boost applied", () => {
    const { fruitPatches } = GAME_STATE;
    const fruitPatch = (fruitPatches as Record<number, CropPlot>)[0];
    const initialHarvest = 1;
    const boostedAmount = 77;

    const state = harvestFruit({
      state: {
        ...GAME_STATE,
        inventory: {},
        fruitPatches: {
          0: {
            ...fruitPatch,
            fruit: {
              name: "Apple",
              plantedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
              amount: boostedAmount,
              harvestsLeft: initialHarvest,
              harvestedAt: 0,
            },
          },
        },
      },
      action: {
        type: "fruit.harvested",
        index: "0",
      },
      createdAt: dateNow,
    });

    expect(state.inventory).toEqual({
      ...state.inventory,
      Apple: new Decimal(boostedAmount),
    });

    const { fruitPatches: fruitPatchesAfterHarvest } = state;
    const fruit = fruitPatchesAfterHarvest?.[0].fruit;
    expect(fruit?.harvestsLeft).toEqual(initialHarvest - 1);
    expect(fruit?.harvestedAt).toEqual(dateNow);
  });

  it("applies Lady Bug Boost", () => {
    const { fruitPatches } = GAME_STATE;
    const fruitPatch = (fruitPatches as Record<number, CropPlot>)[0];
    const initialHarvest = 2;

    const state = harvestFruit({
      state: {
        ...GAME_STATE,
        inventory: {
          Apple: new Decimal(1),
          "Lady Bug": new Decimal(1),
        },
        collectibles: {
          "Lady Bug": [
            {
              coordinates: { x: 0, y: 0 },
              createdAt: 0,
              id: "1",
              readyAt: 0,
            },
          ],
        },
        fruitPatches: {
          0: {
            ...fruitPatch,
            fruit: {
              name: "Apple",
              plantedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
              amount: 1,
              harvestsLeft: initialHarvest,
              harvestedAt: 2,
            },
          },
        },
      },
      action: {
        type: "fruit.harvested",
        index: "0",
      },
      createdAt: dateNow,
    });

    const { fruitPatches: fruitPatchesAfterHarvest } = state;
    const fruit = fruitPatchesAfterHarvest?.[0].fruit;
    expect(fruit?.amount).toEqual(1.25);
  });

  it("applies the Black Bearry Boost", () => {
    const { fruitPatches } = GAME_STATE;
    const fruitPatch = (fruitPatches as Record<number, CropPlot>)[0];
    const initialHarvest = 2;

    const state = harvestFruit({
      state: {
        ...GAME_STATE,
        inventory: {
          "Black Bearry": new Decimal(1),
        },
        collectibles: {
          "Black Bearry": [
            {
              coordinates: { x: 0, y: 0 },
              createdAt: 0,
              id: "1",
              readyAt: 0,
            },
          ],
        },
        fruitPatches: {
          0: {
            ...fruitPatch,
            fruit: {
              name: "Blueberry",
              plantedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
              amount: 1,
              harvestsLeft: initialHarvest,
              harvestedAt: 2,
            },
          },
        },
      },
      action: {
        type: "fruit.harvested",
        index: "0",
      },
      createdAt: dateNow,
    });

    const { fruitPatches: fruitPatchesAfterHarvest } = state;
    const fruit = fruitPatchesAfterHarvest?.[0].fruit;
    expect(fruit?.amount).toEqual(2);
  });

  it("includes Squirrel Monkey bonus on Oranges", () => {
    const { fruitPatches } = GAME_STATE;
    const fruitPatch = (fruitPatches as Record<number, CropPlot>)[0];
    const initialHarvest = 2;

    const state = harvestFruit({
      state: {
        ...GAME_STATE,
        inventory: {
          "Squirrel Monkey": new Decimal(1),
        },
        collectibles: {
          "Squirrel Monkey": [
            {
              coordinates: { x: 0, y: 0 },
              createdAt: 0,
              id: "1",
              readyAt: 0,
            },
          ],
        },
        fruitPatches: {
          0: {
            ...fruitPatch,
            fruit: {
              name: "Orange",
              plantedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
              amount: 1,
              harvestsLeft: initialHarvest,
              harvestedAt: 2,
            },
          },
        },
      },
      action: {
        type: "fruit.harvested",
        index: "0",
      },
      createdAt: dateNow,
    });

    const { fruitPatches: fruitPatchesAfterHarvest } = state;
    const fruit = fruitPatchesAfterHarvest?.[0].fruit;

    expect(fruit?.amount).toEqual(1);
    expect(fruit?.harvestedAt).toEqual(
      dateNow - (FRUIT_SEEDS()["Orange Seed"].plantSeconds * 1000) / 2
    );
  });

  it("harvests the fruit when one harvest is left", () => {
    const { fruitPatches } = GAME_STATE;
    const fruitPatch = (fruitPatches as Record<number, CropPlot>)[0];
    const initialHarvest = 1;

    const state = harvestFruit({
      state: {
        ...GAME_STATE,

        fruitPatches: {
          0: {
            ...fruitPatch,
            fruit: {
              name: "Apple",
              plantedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
              amount: 1,
              harvestsLeft: initialHarvest,
              harvestedAt: 0,
            },
          },
        },
      },
      action: {
        type: "fruit.harvested",
        index: "0",
      },
      createdAt: dateNow,
    });

    expect(state.inventory).toEqual({
      ...state.inventory,
      Apple: new Decimal(1),
    });

    const fruitAfterHarvest = state.fruitPatches?.[0].fruit;

    expect(fruitAfterHarvest?.harvestsLeft).toEqual(0);
  });

  it("increments Apple Harvested activity by 1", () => {
    const { fruitPatches } = GAME_STATE;
    const fruitPatch = (fruitPatches as Record<number, CropPlot>)[0];
    const initialHarvest = 1;

    const state = harvestFruit({
      state: {
        ...GAME_STATE,
        fruitPatches: {
          0: {
            ...fruitPatch,
            fruit: {
              name: "Apple",
              plantedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
              amount: 1,
              harvestsLeft: initialHarvest,
              harvestedAt: 0,
            },
          },
        },
      },
      action: {
        type: "fruit.harvested",
        index: "0",
      },
      createdAt: dateNow,
    });

    expect(state.bumpkin?.activity?.["Apple Harvested"]).toEqual(1);
  });

  it("applies a buds boost", () => {
    const { fruitPatches } = GAME_STATE;
    const fruitPatch = (fruitPatches as Record<number, CropPlot>)[0];
    const initialHarvest = 2;

    const state = harvestFruit({
      state: {
        ...GAME_STATE,
        buds: {
          1: {
            aura: "No Aura",
            colour: "Green",
            ears: "No Ears",
            stem: "Hibiscus",
            type: "Beach",
            coordinates: { x: 0, y: 0 },
          },
        },
        fruitPatches: {
          0: {
            ...fruitPatch,
            fruit: {
              name: "Blueberry",
              plantedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
              amount: 1,
              harvestsLeft: initialHarvest,
              harvestedAt: 2,
            },
          },
        },
      },
      action: {
        type: "fruit.harvested",

        index: "0",
      },
      createdAt: dateNow,
    });

    const { fruitPatches: fruitPatchesAfterHarvest } = state;
    const fruit = fruitPatchesAfterHarvest?.[0].fruit;
    expect(fruit?.amount).toEqual(1.2);
  });
});
