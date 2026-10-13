/** HVP-01 coast prototype is opt-in only through one exact, non-duplicated query value. */
export const isHvpQuery = (search: string | URLSearchParams): boolean => {
  const parameters = typeof search === "string" ? new URLSearchParams(search) : search;
  const values = parameters.getAll("hestiaPrototype");
  return values.length === 1 && values[0] === "1";
};
