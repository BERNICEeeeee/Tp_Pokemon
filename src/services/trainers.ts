import type { Prisma, PrismaClient } from "../generated/prisma/client.ts";
import { Pokemon } from "../domain/Pokemon.ts";
import { Trainer, type TrainerData } from "../domain/Trainer.ts";

export type TrainerRecord = Prisma.TrainerGetPayload<{
  include: { pokemons: { include: { attacks: true } } };
}>;

export type PokemonRecord = Prisma.PokemonGetPayload<{
  include: { attacks: true };
}>;

type Database = PrismaClient | Prisma.TransactionClient;

export class TrainerNotFoundError extends Error {
  constructor(id: string) {
    super(`Entraîneur introuvable : ${id}`);
  }
}

export function trainerFromRecord(record: TrainerRecord): Trainer {
  const data: TrainerData = {
    id: record.id,
    name: record.name,
    level: record.level,
    experience: record.experience,
    pokemons: record.pokemons.map((pokemon) => ({
      id: pokemon.id,
      name: pokemon.name,
      lifePoint: pokemon.lifePoint,
      maxLife: pokemon.maxLife,
      attacks: pokemon.attacks.map((attack) => ({
        id: attack.id,
        name: attack.name,
        damage: attack.damage,
        usageLimit: attack.usageLimit,
        usageCount: attack.usageCount,
      })),
    })),
  };
  return new Trainer(data);
}

export function pokemonFromRecord(record: PokemonRecord): Pokemon {
  return new Pokemon({
    id: record.id,
    name: record.name,
    lifePoint: record.lifePoint,
    maxLife: record.maxLife,
    attacks: record.attacks.map((attack) => ({
      id: attack.id,
      name: attack.name,
      damage: attack.damage,
      usageLimit: attack.usageLimit,
      usageCount: attack.usageCount,
    })),
  });
}

export async function getTrainer(database: Database, id: string): Promise<TrainerRecord> {
  const trainer = await database.trainer.findUnique({
    where: { id },
    include: { pokemons: { include: { attacks: true } } },
  });
  if (!trainer) throw new TrainerNotFoundError(id);
  return trainer;
}

export async function persistTrainer(
  database: Prisma.TransactionClient,
  trainer: Trainer,
): Promise<void> {
  await database.trainer.update({
    where: { id: trainer.id },
    data: { level: trainer.level, experience: trainer.experience },
  });

  for (const pokemon of trainer.pokemons) {
    await database.pokemon.update({
      where: { id: pokemon.id },
      data: { lifePoint: pokemon.lifePoint },
    });
    for (const attack of pokemon.attacks) {
      await database.attack.update({
        where: { id: attack.id },
        data: { usageCount: attack.usageCount },
      });
    }
  }
}
