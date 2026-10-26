import { Pokemon, type PokemonData } from "./Pokemon.ts";

export interface TrainerData {
  id: string;
  name: string;
  level: number;
  experience: number;
  pokemons: PokemonData[];
}

export class Trainer {
  readonly id: string;
  readonly name: string;
  level: number;
  experience: number;
  readonly pokemons: Pokemon[];

  constructor(data: TrainerData) {
    this.id = data.id;
    this.name = data.name;
    this.level = data.level;
    this.experience = data.experience;
    this.pokemons = data.pokemons.map((pokemon) => new Pokemon(pokemon));
  }

  addPokemon(pokemon: Pokemon): void {
    this.pokemons.push(pokemon);
  }

  healAtTavern(): void {
    for (const pokemon of this.pokemons) pokemon.heal();
  }

  gainExperience(amount = 1): void {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error("L'expérience gagnée doit être un entier positif.");
    }
    this.experience += amount;
    while (this.experience >= 10) {
      this.experience -= 10;
      this.level += 1;
    }
  }
}
