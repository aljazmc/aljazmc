import { readdir } from "node:fs/promises";

export default async function readIt(dir: string) {
    const result = await readdir(dir);
    return result;
}
