import { Attack, type AttackData } from "./Attack.ts";

export interface PokemonData {
  id: string;
  name: string;
  lifePoint: number;
  maxLife: number;
  attacks: AttackData[];
}

export interface AttackOutcome {
  attack: Attack;
  damage: number;
}

export class Pokemon {
  readonly id: string;
  readonly name: string;
  readonly maxLife: number;
  lifePoint: number;
  readonly attacks: Attack[];

  constructor(data: PokemonData) {
    this.id = data.id;
    this.name = data.name;
    this.lifePoint = data.lifePoint;
    this.maxLife = data.maxLife;
    this.attacks = data.attacks.map((attack) => new Attack(attack));
  }

  get isAlive(): boolean {
    return this.lifePoint > 0;
  }

  learnAttack(attack: Attack): void {
    if (this.attacks.length >= 4) {
      throw new Error("Un Pokémon ne peut pas apprendre plus de 4 attaques.");
    }
    if (this.attacks.some((known) => known.name.toLocaleLowerCase() === attack.name.toLocaleLowerCase())) {
      throw new Error("Un Pokémon ne peut pas apprendre deux fois la même attaque.");
    }
    this.attacks.push(attack);
  }

  heal(): void {
    this.lifePoint = this.maxLife;
    for (const attack of this.attacks) attack.reset();
  }

  takeDamage(damage: number): void {
    this.lifePoint = Math.max(0, this.lifePoint - damage);
  }

  attackRandomly(target: Pokemon, random: () => number = Math.random): AttackOutcome | undefined {
    const available = this.attacks
      .filter((attack) => attack.available)
      .sort((a, b) => a.id.localeCompare(b.id));
    if (available.length === 0) return undefined;
    const index = Math.min(Math.floor(random() * available.length), available.length - 1);
    const attack = available[index];
    if (!attack) return undefined;
    const damage = attack.use();
    target.takeDamage(damage);
    return { attack, damage };
  }
}
