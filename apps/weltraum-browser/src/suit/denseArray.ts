import { failSuitValidation } from "./errors";

export const requireDenseSuitArray = (value: unknown, path: string): readonly unknown[] => {
  if (!Array.isArray(value)) return failSuitValidation("InvalidShape", path, "Value must be an array.");
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) {
      return failSuitValidation("InvalidShape", `${path}/${index}`, "Suit arrays must be dense.");
    }
  }
  return value;
};
