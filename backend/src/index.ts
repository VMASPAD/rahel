import cors from "cors";
import express from "express";
import { initDatabase } from "./db/database.js";
import { seedIfEmpty } from "./db/seed.js";
import { healthRoutes } from "./routes/healthRoutes.js";
import { mountStaticWeb } from "./staticWeb.js";

initDatabase();
seedIfEmpty();

const app = express();
const port = Number(process.env.PORT) || 8080;

app.use(cors());
app.use(express.json());
app.use(healthRoutes);
mountStaticWeb(app);

app.listen(port, () => {
  console.log(`RaHel listening on http://localhost:${port}`);
});
