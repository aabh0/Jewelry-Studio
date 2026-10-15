import { customAlphabet } from "nanoid";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const gen = customAlphabet(alphabet, 16);

export function newId(): string {
  return gen();
}

export function newUuid(): string {
  return crypto.randomUUID();
}
