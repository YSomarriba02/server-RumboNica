//MAIN (PUNTO DE ENTRADA)

import express from "express";
import cors from "cors";

import auth from "./routes/auth.routes.js";
import aves from "./routes/aves.routes.js";
import lugares from "./routes/lugares.routes.js";
import comentarios from "./routes/comentarios.routes.js";
import reservasNaturales from "./routes/reservasNaturales.routes.js";
import comercios from "./routes/comercios.routes.js";
import guiaslocales from "./routes/guias.routes.js";
import cookieParser from "cookie-parser";

const PORT = process.env.PORT;

const vercel = "https://rumbo-nica-qmzz.vercel.app";
const local = "http://localhost:5173";
export const webUrl = vercel;

const app = express();
app.use(cors({ origin: webUrl, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Obtener todas las aves
app.use("/aves", aves);

app.use("/auth", auth);

app.use("/lugares", lugares);

app.use("/comentarios", comentarios);

app.use("/reservas", reservasNaturales);

app.use("/comercios", comercios);

app.use("/guiaslocales", guiaslocales);

app.listen(PORT, () => {
  console.log("Servidor corriendo ___");
});

