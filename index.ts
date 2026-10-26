import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import { Prisma } from "./src/generated/prisma/client.ts";
import { prisma } from "./src/lib/prisma.ts";
import {
  getTrainer,
  persistTrainer,
  pokemonFromRecord,
  trainerFromRecord,
  TrainerNotFoundError,
} from "./src/services/trainers.ts";
import { Attack } from "./src/domain/Attack.ts";
import { Pokemon } from "./src/domain/Pokemon.ts";
import {
  randomChallenge,
  runDeterministicDuel,
  runRandomArena,
  runDeterministicArena,
} from "./src/services/battles.ts";

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const app = express();
app.use(express.json());

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, `${field} doit être une chaîne non vide.`);
  }
  return value.trim();
}

function positiveInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new HttpError(400, `${field} doit être un entier positif.`);
  }
  return value;
}

function trainerIds(body: unknown): [string, string] {
  if (typeof body !== "object" || body === null) {
    throw new HttpError(400, "Le corps doit contenir trainer1Id et trainer2Id.");
  }
  const values = body as Record<string, unknown>;
  const first = requiredString(values.trainer1Id, "trainer1Id");
  const second = requiredString(values.trainer2Id, "trainer2Id");
  if (first === second) {
    throw new HttpError(400, "Un entraîneur ne peut pas combattre contre lui-même.");
  }
  return [first, second];
}

async function loadTrainerPair(
  tx: Prisma.TransactionClient,
  firstId: string,
  secondId: string,
): Promise<[ReturnType<typeof trainerFromRecord>, ReturnType<typeof trainerFromRecord>]> {
  for (const id of [firstId, secondId].sort()) {
    await tx.$queryRaw`SELECT "id" FROM "Trainer" WHERE "id" = ${id} FOR UPDATE`;
  }
  const [first, second] = await Promise.all([
    getTrainer(tx, firstId),
    getTrainer(tx, secondId),
  ]);
  return [trainerFromRecord(first), trainerFromRecord(second)];
}

function ensureTeamsCanFight(
  first: ReturnType<typeof trainerFromRecord>,
  second: ReturnType<typeof trainerFromRecord>,
): void {
  if (first.pokemons.length === 0 || second.pokemons.length === 0) {
    throw new HttpError(400, "Chaque entraîneur doit posséder au moins un Pokémon.");
  }
}

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.get("/api/trainers", async (_request, response) => {
  const trainers = await prisma.trainer.findMany({
    include: { pokemons: { include: { attacks: true } } },
    orderBy: { name: "asc" },
  });
  response.json(trainers);
});

app.post("/api/trainers", async (request, response) => {
  const name = requiredString(request.body?.name, "name");
  const trainer = await prisma.trainer.create({ data: { name } });
  response.status(201).json(trainer);
});

app.get("/api/trainers/:trainerId", async (request, response) => {
  response.json(await getTrainer(prisma, request.params.trainerId));
});

app.post("/api/trainers/:trainerId/pokemons", async (request, response) => {
  const name = requiredString(request.body?.name, "name");
  const maxLife = positiveInteger(request.body?.maxLife, "maxLife");
  const trainer = trainerFromRecord(await getTrainer(prisma, request.params.trainerId));
  const createdPokemon = new Pokemon({
    id: crypto.randomUUID(),
    name,
    lifePoint: maxLife,
    maxLife,
    attacks: [],
  });
  trainer.addPokemon(createdPokemon);
  const pokemon = await prisma.pokemon.create({
    data: {
      id: createdPokemon.id,
      name: createdPokemon.name,
      maxLife: createdPokemon.maxLife,
      lifePoint: createdPokemon.lifePoint,
      trainerId: trainer.id,
    },
    include: { attacks: true },
  });
  response.status(201).json(pokemon);
});

app.post("/api/pokemons/:pokemonId/attacks", async (request, response) => {
  const name = requiredString(request.body?.name, "name");
  const damage = positiveInteger(request.body?.damage, "damage");
  const usageLimit = positiveInteger(request.body?.usageLimit, "usageLimit");
  const attack = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Pokemon" WHERE "id" = ${request.params.pokemonId} FOR UPDATE`;
    const pokemon = await tx.pokemon.findUnique({
      where: { id: request.params.pokemonId },
      include: { attacks: true },
    });
    if (!pokemon) throw new HttpError(404, "Pokémon introuvable.");
    const domainPokemon = pokemonFromRecord(pokemon);
    const learnedAttack = new Attack({
      id: crypto.randomUUID(),
      name,
      damage,
      usageLimit,
      usageCount: 0,
    });
    try {
      domainPokemon.learnAttack(learnedAttack);
    } catch (error) {
      if (error instanceof Error) throw new HttpError(409, error.message);
      throw error;
    }
    return tx.attack.create({
      data: {
        id: learnedAttack.id,
        name: learnedAttack.name,
        damage: learnedAttack.damage,
        usageLimit: learnedAttack.usageLimit,
        pokemonId: domainPokemon.id,
      },
    });
  });
  response.status(201).json(attack);
});

app.post("/api/pokemons/:pokemonId/heal", async (request, response) => {
  const pokemon = await prisma.pokemon.findUnique({
    where: { id: request.params.pokemonId },
    include: { attacks: true },
  });
  if (!pokemon) throw new HttpError(404, "Pokémon introuvable.");
  const healedPokemon = pokemonFromRecord(pokemon);
  healedPokemon.heal();
  await prisma.$transaction([
    prisma.pokemon.update({
      where: { id: healedPokemon.id },
      data: { lifePoint: healedPokemon.lifePoint },
    }),
    ...healedPokemon.attacks.map((attack) =>
      prisma.attack.update({
        where: { id: attack.id },
        data: { usageCount: attack.usageCount },
      }),
    ),
  ]);
  response.json({ message: `${healedPokemon.name} a été soigné.` });
});

app.post("/api/trainers/:trainerId/tavern", async (request, response) => {
  const trainer = await getTrainer(prisma, request.params.trainerId);
  await prisma.$transaction(async (tx) => {
    const domainTrainer = trainerFromRecord(trainer);
    domainTrainer.healAtTavern();
    await persistTrainer(tx, domainTrainer);
  });
  response.json(await getTrainer(prisma, trainer.id));
});

app.post("/api/trainers/:trainerId/experience", async (request, response) => {
  const amount = positiveInteger(request.body?.amount, "amount");
  const trainer = await getTrainer(prisma, request.params.trainerId);
  const updated = trainerFromRecord(trainer);
  updated.gainExperience(amount);
  const saved = await prisma.trainer.update({
    where: { id: updated.id },
    data: { level: updated.level, experience: updated.experience },
  });
  response.json(saved);
});

app.post("/api/battles/random", async (request, response) => {
  const [firstId, secondId] = trainerIds(request.body);
  const result = await prisma.$transaction(async (tx) => {
    const [first, second] = await loadTrainerPair(tx, firstId, secondId);
    ensureTeamsCanFight(first, second);
    const battle = randomChallenge(first, second);
    if (battle.winner) battle.winner.gainExperience(1);
    await persistTrainer(tx, first);
    await persistTrainer(tx, second);
    return battle;
  });
  response.json(result);
});

app.post("/api/battles/deterministic", async (request, response) => {
  const [firstId, secondId] = trainerIds(request.body);
  const result = await prisma.$transaction(async (tx) => {
    const [first, second] = await loadTrainerPair(tx, firstId, secondId);
    ensureTeamsCanFight(first, second);
    const battle = runDeterministicDuel(first, second);
    if (battle.winner) battle.winner.gainExperience(1);
    await persistTrainer(tx, first);
    await persistTrainer(tx, second);
    return battle;
  });
  response.json(result);
});

app.post("/api/arenas/1", async (request, response) => {
  const [firstId, secondId] = trainerIds(request.body);
  const result = await prisma.$transaction(async (tx) => {
    const [first, second] = await loadTrainerPair(tx, firstId, secondId);
    ensureTeamsCanFight(first, second);
    const arena = runRandomArena(first, second);
    await persistTrainer(tx, first);
    await persistTrainer(tx, second);
    return arena;
  });
  response.json(result);
});

app.post("/api/arenas/2", async (request, response) => {
  const [firstId, secondId] = trainerIds(request.body);
  const result = await prisma.$transaction(async (tx) => {
    const [first, second] = await loadTrainerPair(tx, firstId, secondId);
    ensureTeamsCanFight(first, second);
    const arena = runDeterministicArena(first, second);
    await persistTrainer(tx, first);
    await persistTrainer(tx, second);
    return arena;
  });
  response.json(result);
});

app.use((_request, response) => {
  response.status(404).json({ error: "Route introuvable." });
});

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof HttpError) {
    response.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof TrainerNotFoundError) {
    response.status(404).json({ error: "Entraîneur introuvable." });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    response.status(404).json({ error: "Ressource introuvable." });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    response.status(409).json({ error: "Cette ressource existe déjà." });
    return;
  }
  console.error(error);
  response.status(500).json({ error: "Une erreur interne est survenue." });
});

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT doit être un entier entre 1 et 65535.");
}

app.listen(port, () => {
  console.log(`API Pokémon disponible sur http://localhost:${port}`);
});
