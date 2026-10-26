export interface AttackData {
  id: string;
  name: string;
  damage: number;
  usageLimit: number;
  usageCount: number;
}

export class Attack {
  readonly id: string;
  readonly name: string;
  readonly damage: number;
  readonly usageLimit: number;
  usageCount: number;

  constructor(data: AttackData) {
    this.id = data.id;
    this.name = data.name;
    this.damage = data.damage;
    this.usageLimit = data.usageLimit;
    this.usageCount = data.usageCount;
  }

  get available(): boolean {
    return this.usageCount < this.usageLimit;
  }

  use(): number {
    if (!this.available) {
      throw new Error(`L'attaque ${this.name} a atteint sa limite d'utilisation.`);
    }
    this.usageCount += 1;
    return this.damage;
  }

  reset(): void {
    this.usageCount = 0;
  }

  getInfo(): string {
    return `${this.name} — dégâts : ${this.damage}, utilisations : ${this.usageCount}/${this.usageLimit}`;
  }
}
