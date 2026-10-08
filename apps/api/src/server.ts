import { app, usingDb } from "./app.js";

const port = Number(process.env.PORT ?? 9902);
app.listen(port, () => console.log(`api listening on http://localhost:${port} (db: ${usingDb ? "neon" : "seed file"})`));
