import { createDemoProject } from "../src/lib/server/demo";

createDemoProject()
  .then((p) => console.log(p.id))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
