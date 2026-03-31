import { writeFile } from "node:fs/promises";
import path from "node:path";

import { routeCatalog } from "../src/app/routes";

const outputPath = path.resolve(process.cwd(), "../docs/backend_route_catalog_2026-03-28.json");

const main = async () => {
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        routes: routeCatalog
      },
      null,
      2
    )}\n`
  );

  console.log(outputPath);
};

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
