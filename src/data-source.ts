import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { OAuth2Client } from "google-auth-library";

dotenv.config();

//Supabase
const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_KEY as string;
export const supabase = createClient(supabaseUrl, supabaseKey);

//Google
export const clienteGoogleId = process.env.CLIENT_GOOGLE_ID as string;
export const clienteGoogle = new OAuth2Client(clienteGoogleId);
