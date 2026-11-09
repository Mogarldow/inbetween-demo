// Smaže lokální vestavěnou databázi; při dalším startu se založí znovu s ukázkovými daty.
import { rmSync } from "node:fs";
rmSync(".data/pglite", { recursive: true, force: true });
console.log("Lokální databáze smazána. Při dalším spuštění (npm run local) se založí znovu.");
