// Base44 camelCase function name -> Express mount path. Acronyms need explicit
// entries because a generic camelCase converter cannot infer their word breaks.
const ROUTE_OVERRIDES = new Map([
  ['academicAIChat', '/academic-ai-chat'],
]);

export function functionPath(name) {
  return ROUTE_OVERRIDES.get(name)
    || `/${name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`;
}
