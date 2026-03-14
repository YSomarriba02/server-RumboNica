import dotenv from "dotenv";
const urlServer = "https://server-hackathon-991o.onrender.com";

dotenv.config();




/* eslint-disable @typescript-eslint/no-explicit-any */

import { BrevoClient, Brevo } from '@getbrevo/brevo';

export type envioEmailType = {
  toEmail: string,
  token: string
}

const brevo = new BrevoClient({
  apiKey: process.env.BREVO_KEY!,
});

export async function enviarCorreo({
  toEmail,
  token
}: envioEmailType): Promise<boolean> {
  try {
    const request: Brevo.SendTransacEmailRequest = {
      subject: "Bienvenido a RumboNica",
      htmlContent: `<p>Haz click en el link para verificar tu cuenta:</p>
                   <a href="${urlServer}/auth/verificartoken?tokenVerificacion=${token}">Verificar correo</a>`,
      sender: {
        name: process.env.SENDER_NAME!,
        email: process.env.SENDER_EMAIL!,
      },
      to: [
        {
          email: toEmail,
        },
      ],
    };

    const response = await brevo.transactionalEmails.sendTransacEmail(request)

    console.log('Email enviado! Message ID:', response.messageId);
    return true;
  } catch (error: any) {
    console.error('Error enviando email:', error.message);
    if (error.body) {
      console.error('Detalles de Brevo:', error.body);
    }
    return false;
  }
}