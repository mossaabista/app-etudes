/** Same keys in both languages, checked by the compiler: `en` must mirror `fr` exactly. */
export type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };

export function defineNs<const F>(fr: F, en: Shape<F>): { fr: Shape<F>; en: Shape<F> } {
  return { fr: fr as Shape<F>, en };
}
