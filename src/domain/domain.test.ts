import { describe, expect, test } from "bun:test";
import { Attack } from "./Attack.ts";
import { Pokemon } from "./Pokemon.ts";
import { Trainer } from "./Trainer.ts";
import {
  randomChallenge,
  runDeterministicArena,
  runRandomArena,
} from "../services/battles.ts";

const attack = (id: string, name: string, damage = 3, usageLimit = 2) =>
  new Attack({ id, name, damage, usageLimit, usageCount: 0 });

const trainer = (
  id: string,
  name: string,
  pokemonId: string,
  lifePoint: number,
  damage: number,
  usageCount = 0,
) =>
  new Trainer({
    id,
    name,
    level: 1,
    experience: 0,
    pokemons: [
      {
        id: pokemonId,
        name: `${name}mon`,
        lifePoint,
        maxLife: lifePoint,
        attacks: [
          {
            id: `${pokemonId}-attack`,
            name: "Charge",
            damage,
            usageLimit: 1,
            usageCount,
          },
        ],
      },
    ],
  });

describe("classes du jeu", () => {
  test("une attaque respecte sa limite et affiche ses informations", () => {
    const strike = attack("a1", "Éclair", 5, 1);
    expect(strike.use()).toBe(5);
    expect(strike.available).toBe(false);
    expect(strike.getInfo()).toContain("1/1");
    expect(() => strike.use()).toThrow();
  });

  test("un Pokémon ne peut apprendre que quatre attaques distinctes", () => {
    const pokemon = new Pokemon({
      id: "p1",
      name: "Pikachu",
      lifePoint: 20,
      maxLife: 20,
      attacks: [
        { id: "a1", name: "Éclair", damage: 5, usageLimit: 2, usageCount: 0 },
      ],
    });
    expect(() => pokemon.learnAttack(attack("a2", "éCLAIR"))).toThrow();
    pokemon.learnAttack(attack("a2", "Charge"));
    pokemon.learnAttack(attack("a3", "Tonnerre"));
    pokemon.learnAttack(attack("a4", "Vive-Attaque"));
    expect(() => pokemon.learnAttack(attack("a5", "Queue de Fer"))).toThrow();
  });

  test("soigner un Pokémon restaure les PV et les usages", () => {
    const pokemon = new Pokemon({
      id: "p1",
      name: "Pikachu",
      lifePoint: 1,
      maxLife: 20,
      attacks: [
        { id: "a1", name: "Éclair", damage: 5, usageLimit: 2, usageCount: 2 },
      ],
    });
    pokemon.heal();
    expect(pokemon.lifePoint).toBe(20);
    expect(pokemon.attacks[0]?.usageCount).toBe(0);
  });

  test("l'expérience peut faire franchir plusieurs niveaux", () => {
    const trainer = new Trainer({
      id: "t1",
      name: "Sacha",
      level: 1,
      experience: 8,
      pokemons: [],
    });
    trainer.gainExperience(22);
    expect(trainer.level).toBe(4);
    expect(trainer.experience).toBe(0);
  });

  test("le défi aléatoire soigne les équipes avant le combat", () => {
    const first = trainer("t1", "A", "p1", 10, 10, 1);
    const second = trainer("t2", "B", "p2", 10, 3, 1);
    const result = randomChallenge(first, second, () => 0);
    expect(result.winner?.id).toBe("t1");
    expect(first.pokemons[0]?.lifePoint).toBe(10);
    expect(first.pokemons[0]?.attacks[0]?.usageCount).toBe(1);
    expect(second.pokemons[0]?.lifePoint).toBe(0);
  });

  test("l'arène 1 effectue cent défis et classe par niveau puis expérience", () => {
    const first = trainer("t1", "A", "p1", 10, 10);
    const second = trainer("t2", "B", "p2", 10, 3);
    const result = runRandomArena(first, second, () => 0);
    expect(result.battles).toBe(100);
    expect(result.history).toHaveLength(100);
    expect(result.winner?.id).toBe("t1");
    expect(first.level).toBe(11);
  });

  test("l'arène 2 s'arrête quand une équipe n'a plus de Pokémon vivants", () => {
    const first = trainer("t1", "A", "p1", 10, 10);
    const second = trainer("t2", "B", "p2", 10, 3);
    const result = runDeterministicArena(first, second);
    expect(result.battles).toBe(1);
    expect(result.winner?.id).toBe("t1");
    expect(second.pokemons[0]?.isAlive).toBe(false);
  });
});
