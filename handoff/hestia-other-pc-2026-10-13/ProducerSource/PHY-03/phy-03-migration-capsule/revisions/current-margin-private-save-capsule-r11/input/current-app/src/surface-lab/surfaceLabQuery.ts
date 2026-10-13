/** Surface Lab is opt-in only through one exact, non-duplicated query value. */
export const isSurfaceLabQuery = (search: string | URLSearchParams): boolean => {
  const parameters = typeof search === "string" ? new URLSearchParams(search) : search;
  const values = parameters.getAll("surfaceLab");
  return values.length === 1 && values[0] === "1";
};
