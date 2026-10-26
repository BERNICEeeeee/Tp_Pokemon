import { Trainer } from "../domain/Trainer.ts";
import { Pokemon } from "../domain/Pokemon.ts";

export interface BattleMove {
  trainer: string;
  pokemon: string;
  attack: string;
  target: string;
  damage: number;
  targetLifePoint: number;
}

export interface BattleResult {
  winner: Trainer | null;
  draw: boolean;
  moves: BattleMove[];
}

export interface ArenaResult {
  winner: Trainer | null;
  draw: boolean;
  battles: number;
  trainer1: { id: string; name: string; level: number; experience: number };
  trainer2: { id: string; name: string; level: number; experience: number };
  history: Array<{ battle: number; winner: string | null }>;
}

function randomItem<T>(items: T[], random: () => number): T | undefined {
  if (items.length === 0) return undefined;
  const index = Math.min(Math.floor(random() * items.length), items.length - 1);
  return items[index];
}

function fight(
  first: Trainer,
  firstPokemon: Pokemon,
  second: Trainer,
  secondPokemon: Pokemon,
  random: () => number,
): BattleResult {
  const moves: BattleMove[] = [];
  let attacker = first;
  let attackingPokemon = firstPokemon;
  let defender = second;
  let defendingPokemon = secondPokemon;

  if (!firstPokemon.isAlive || !secondPokemon.isAlive) {
    if (!firstPokemon.isAlive && !secondPokemon.isAlive) {
      return { winner: null, draw: true, moves };
    }
    return { winner: firstPokemon.isAlive ? first : second, draw: false, moves };
  }

  while (firstPokemon.isAlive && secondPokemon.isAlive) {
    const outcome = attackingPokemon.attackRandomly(defendingPokemon, random);
    if (!outcome) {
      const winner = defendingPokemon.attacks.some((attack) => attack.available) ? defender : null;
      return { winner, draw: winner === null, moves };
    }
    moves.push({
      trainer: attacker.name,
      pokemon: attackingPokemon.name,
      attack: outcome.attack.name,
      target: defendingPokemon.name,
      damage: outcome.damage,
      targetLifePoint: defendingPokemon.lifePoint,
    });
    [attacker, defender] = [defender, attacker];
    [attackingPokemon, defendingPokemon] = [defendingPokemon, attackingPokemon];
  }

  return {
    winner: firstPokemon.isAlive ? first : second,
    draw: false,
    moves,
  };
}

export function randomChallenge(
  first: Trainer,
  second: Trainer,
  random: () => number = Math.random,
): BattleResult {
  first.healAtTavern();
  second.healAtTavern();
  const firstPokemon = randomItem(first.pokemons, random);
  const secondPokemon = randomItem(second.pokemons, random);
  if (!firstPokemon || !secondPokemon) {
    throw new Error("Chaque entraîneur doit posséder au moins un Pokémon pour combattre.");
  }
  return fight(first, firstPokemon, second, secondPokemon, random);
}

export function runDeterministicDuel(first: Trainer, second: Trainer): BattleResult {
  const firstPokemon = [...first.pokemons].sort(
    (a, b) => b.lifePoint - a.lifePoint || a.id.localeCompare(b.id),
  )[0];
  const secondPokemon = [...second.pokemons].sort(
    (a, b) => b.lifePoint - a.lifePoint || a.id.localeCompare(b.id),
  )[0];
  if (!firstPokemon || !secondPokemon) {
    throw new Error("Chaque entraîneur doit posséder au moins un Pokémon pour combattre.");
  }
  return fight(first, firstPokemon, second, secondPokemon, () => 0);
}

function summary(trainer: Trainer): ArenaResult["trainer1"] {
  return {
    id: trainer.id,
    name: trainer.name,
    level: trainer.level,
    experience: trainer.experience,
  };
}

function arenaResult(
  first: Trainer,
  second: Trainer,
  winner: Trainer | null,
  battles: number,
  history: ArenaResult["history"],
): ArenaResult {
  return {
    winner,
    draw: winner === null,
    battles,
    trainer1: summary(first),
    trainer2: summary(second),
    history,
  };
}

export function runRandomArena(
  first: Trainer,
  second: Trainer,
  random: () => number = Math.random,
): ArenaResult {
  if (first.pokemons.length === 0 || second.pokemons.length === 0) {
    throw new Error("Chaque entraîneur doit posséder au moins un Pokémon pour combattre.");
  }
  const history: ArenaResult["history"] = [];
  for (let battle = 1; battle <= 100; battle += 1) {
    const result = randomChallenge(first, second, random);
    if (result.winner) result.winner.gainExperience(1);
    history.push({ battle, winner: result.winner?.name ?? null });
  }

  const winner =
    first.level > second.level
      ? first
      : second.level > first.level
        ? second
        : first.experience > second.experience
          ? first
          : second.experience > first.experience
            ? second
            : null;
  return arenaResult(first, second, winner, 100, history);
}

export function runDeterministicArena(
  first: Trainer,
  second: Trainer,
): ArenaResult {
  if (first.pokemons.length === 0 || second.pokemons.length === 0) {
    throw new Error("Chaque entraîneur doit posséder au moins un Pokémon pour combattre.");
  }
  const history: ArenaResult["history"] = [];

  for (let battle = 1; battle <= 100; battle += 1) {
    const firstPokemon = first.pokemons
      .filter((pokemon) => pokemon.isAlive)
      .sort((a, b) => b.lifePoint - a.lifePoint || a.id.localeCompare(b.id))[0];
    const secondPokemon = second.pokemons
      .filter((pokemon) => pokemon.isAlive)
      .sort((a, b) => b.lifePoint - a.lifePoint || a.id.localeCompare(b.id))[0];
    if (!firstPokemon || !secondPokemon) break;

    const result = fight(first, firstPokemon, second, secondPokemon, () => 0);
    if (result.winner) result.winner.gainExperience(1);
    history.push({ battle, winner: result.winner?.name ?? null });
    if (result.draw) break;
  }

  const firstAlive = first.pokemons.some((pokemon) => pokemon.isAlive);
  const secondAlive = second.pokemons.some((pokemon) => pokemon.isAlive);
  const winner = firstAlive === secondAlive ? null : firstAlive ? first : second;
  return arenaResult(first, second, winner, history.length, history);
}
