export interface Persona {
  name: string;
  icon: string;
  desc: string;
  demo: string;
  purchase: string;
  brands: string;
  cta: string;
  color: string;
  traits: string[];
}

/** Nested: genre → subMode (or 'default') → Persona[] */
export type GenrePersonas = Record<string, Record<string, Persona[]>>;
