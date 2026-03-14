import { clienteGoogle, clienteGoogleId } from "../data-source.js";
import { supabase } from "../data-source.js";

import { webUrl } from "../index.js";
import { generarToken } from "../utils/auth/crearToken.js";

import { enviarCorreo } from "../service/auth/enviarCorreoSendGrid.js";

import type { Request, Response } from "express";
import type reqRegistrar from "../interfaces/iReqRegistrar.js";
import validarEmail from "../utils/auth/validarEmail.js";
import compararPassword from "../utils/auth/compararPassword.js";
import cifrarPassword from "../utils/auth/cifrarPassword.js";
import type AuthRequest from "../interfaces/iAuthRequest.js";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import tokenExpirado from "../utils/auth/tokenExpirado.js";

dotenv.config();
const SECRET_KEY_JWT = process.env.SECRET_KEY_JWT as string;

export const iniciarSesion = async (req: Request, res: Response) => {
  try {
    console.log("Se entro en iniciarSesion");
    //Desde frontend el input email se llama asi propiamente
    //pero a uso practico permito que al usuario ingresar con su
    //nombre o email en el mismo inputS
    const { email: identificacion, password } = req.body;

    if (!identificacion)
      return res.status(400).json({ mensaje: "Campo es obligatorio" });
    if (!password)
      return res.status(400).json({ mensaje: "Password no puede estar vacia" });

    const campo = validarEmail(identificacion) ? "email" : "nombre";
    const { data, error } = await supabase
      .from("usuarios")
      .select("email, nombre, password, auth_provider, imagenurl, id_usuario")
      .eq(campo, identificacion)
      .eq("verificado", true)
      .maybeSingle();

    if (error)
      return res.status(500).json({ mensaje: "Error al iniciar sesion" });
    if (!data)
      return res.status(404).json({ mensaje: "Usuario no encontrado" });
    if (data.auth_provider == "google") {
      return res.status(400).json({
        mensaje:
          "Esta dirección ya está vinculada a una cuenta Google. Por favor, inicia sesión con Google",
      });
    }

    if (data.password && (await compararPassword(data.password, password))) {
      const token = jwt.sign(
        {
          id_usuario: data.id_usuario,
          name: data.nombre,
          email: data.email,
          picture: data.imagenurl,
        },
        SECRET_KEY_JWT,
        { expiresIn: "1h" }
      );
      res.cookie("access_token", token, {
        httpOnly: true,
        sameSite: "none",
        secure: true,
        maxAge: 1000 * 60 * 60,
      });
      return res.status(200).json({
        name: data.nombre,
        email: data.email,
        picture: data.imagenurl,
        id_usuario: data.id_usuario,
      });
    }

    return res.status(401).json({ mensaje: "Contrasena no valida" });
  } catch (error) {
    return res
      .status(500)
      .json({ mensaje: "Upss algo salio mal, intentalo mas tarde" });
  }
};

import validarSeguridadPassword from "../utils/auth/validarSeguridadPassword.js";

//Registrar usuario
export const registrarUsuario = async (
  req: Request<{}, {}, reqRegistrar, {}>,
  res: Response
) => {
  try {
    console.log("se entro en Registrar usuario");
    const { nombre, email, password } = req.body;

    if (!nombre)
      return res.status(400).json({ mensaje: "Nombre no puede estar vacio" });
    if (!email)
      return res.status(400).json({ mensaje: "email no puede estar vacio" });
    if (!password)
      return res.status(400).json({ mensaje: "Password no puede estar vacio" });

    const mensaje = validarSeguridadPassword(password);

    if (mensaje) {
      return res.status(400).json({ mensaje });
    }

    const token = generarToken();

    const { data: data1, error: error1 } = await supabase
      .from("usuarios")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (error1)
      return res.status(500).json({
        mensaje:
          "Ocurrio un error al consultar los datos, intenta nuevamente mas tarde",
      });

    if (data1) {
      if (!data1.verificado) {
        if (tokenExpirado(data1.fechaexpiracion)) {
          const { data: dataUpdate, error: errorUpdate } = await supabase
            .from("usuarios")
            .update({
              token_verificacion: token,
              fechaexpiracion: new Date(Date.now() + 24 * 60 * 60 * 1000),
            })
            .eq("email", email);

          if (errorUpdate) {
            return res
              .status(500)
              .json({ mensaje: "Error al actualizar token de verificacion" });
          }
        }
        await enviarCorreo({ toEmail: email, token });
        console.log("Se reenvio el link");
        return res.status(200).json({
          mensaje: "Usuario creado. Revisa tu correo para verificar tu cuenta.",
        });
      }
      console.log("Este email ya esta vinculado a otro perfil");
      return res
        .status(400)
        .json({ mensaje: "Este email ya esta vinculado a otro perfil" });
    }

    const hashPassword: string = await cifrarPassword(password);
    const { data: data2, error: error2 } = await supabase
      .from("usuarios")
      .insert([
        {
          email: email,
          password: hashPassword,
          nombre: nombre,
          imagenurl: null,
          verificado: false,
          token_verificacion: token,
        },
      ]);

    if (error2)
      return res.status(500).json({ mensaje: "Error al insertar usuario" });

    console.log("se envio email");
    await enviarCorreo({ toEmail: email, token });
    return res.status(200).json({
      mensaje: "Revisa tu correo para verificar tu cuenta.",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ mensaje: "Upss algo salio mal, intentalo mas tarde" });
  }
};

//Verificacion del token traido desde el email del usuario cuando se
//intenta registrar
export const verificarToken = async (req: Request, res: Response) => {
  console.log("Se entro en verificar Tokeeeenn");

  const { tokenVerificacion } = req.query;

  if (!tokenVerificacion || typeof tokenVerificacion !== "string") {
    return res.redirect(
      `${webUrl}/verificaciontoken?estado=false&mensaje=No hay token`
    );
  }

  try {
    const { data: usuario, error } = await supabase
      .from("usuarios")
      .select(
        "id_usuario, fechaexpiracion, verificado, nombre, email, imagenurl"
      )
      .eq("token_verificacion", tokenVerificacion)
      .maybeSingle();

    if (error) {
      return res.redirect(
        `${webUrl}verificaciontoken?estado=false&mensaje=${encodeURIComponent(
          "Error al validar token"
        )}`
      );
    }

    if (!usuario) {
      return res.redirect(
        `${webUrl}/verificaciontoken?estado=false&mensaje=${encodeURIComponent(
          "Token invalido, ya fue usado"
        )}`
      );
    }

    // Validar si ya expiró
    if (usuario.fechaexpiracion && tokenExpirado(usuario.fechaexpiracion)) {
      return res.redirect(
        `${webUrl}/verificaciontoken?estado=false&mensaje=${encodeURIComponent(
          "token ya expiro"
        )}`
      );
    }

    // Marcar usuario como verificado y limpiar token
    const { error: errorUpdate } = await supabase
      .from("usuarios")
      .update({
        verificado: true,
        token_verificacion: null,
        fechaexpiracion: null,
      })
      .eq("id_usuario", usuario.id_usuario);

    if (errorUpdate) {
      return res.redirect(
        `${webUrl}/verificaciontoken?estado=false?mensaje=${encodeURIComponent(
          "Error al actualizar token"
        )}`
      );
    }

    const token = jwt.sign(
      {
        id_usuario: usuario.id_usuario,
        name: usuario.nombre,
        email: usuario.email,
        piture: usuario.imagenurl,
      },
      SECRET_KEY_JWT,
      {
        expiresIn: "1h",
      }
    );
    const userData = {
      name: usuario.nombre,
      email: usuario.email,
      picture: usuario.imagenurl,
    };
    const query = encodeURIComponent(JSON.stringify(userData));

    return res
      .cookie("access_token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 1000 * 60 * 60,
      })
      .redirect(`${webUrl}`);
  } catch (err: any) {
    console.error(err);
    return res.redirect(
      `${webUrl}/verificaciontoken?estado=false?mensaje=${encodeURIComponent(
        "Error con el token"
      )}`
    );
  }
};

//Registrar usuario cuando el usuario usa la autenticacion de google
export const authGoogleCallback = async (req: Request, res: Response) => {
  console.log("Autenticación con Google");

  const accion = req.query.accion as string;
  if (!accion)
    return res.status(400).json({ mensaje: "No se envió la acción" });

  const { credential } = req.body;
  if (!credential)
    return res.status(400).json({ mensaje: "No hay credencial" });

  try {
    // Verificar token de Google
    const ticket = await clienteGoogle.verifyIdToken({
      idToken: credential,
      audience: clienteGoogleId,
    });
    const payload = ticket.getPayload();
    if (!payload) return res.status(500).json({ mensaje: "No hay payload" });

    const { email, name, picture, email_verified } = payload;

    if (!email_verified) {
      return res
        .status(400)
        .json({ mensaje: "Correo no verificado por Google" });
    }

    // Buscar usuario en Supabase
    const { data, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (error)
      return res.status(500).json({ mensaje: "Error en base de datos" });

    // Registro
    if (accion === "registro") {
      if (!data) {
        const { data: insertData, error: insertError } = await supabase
          .from("usuarios")
          .insert([
            {
              email,
              nombre: name,
              password: null,
              imagenurl: picture,
              verificado: true,
              auth_provider: "google",
              token_verificacion: null,
            },
          ])
          .select("id_usuario")
          .single();
        if (insertError) {
          return res.status(500).json({
            mensaje: "Error al registrar usuario -auht_provider_google",
          });
        }

        const token = jwt.sign(
          { id_usuario: insertData.id_usuario, name, email, picture },
          SECRET_KEY_JWT,
          {
            expiresIn: "1h",
          }
        );
        res.cookie("access_token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          maxAge: 1000 * 60 * 60,
        });
        return res
          .status(200)
          .json({ name, email, picture, id_usuario: insertData.id_usuario });
      } else {
        return res
          .status(409)
          .json({ mensaje: "Este correo ya está vinculado a una cuenta" });
      }
    }

    // Inicio de sesión
    if (accion === "iniciosesion") {
      if (!data) {
        return res.status(404).json({ mensaje: "Usuario no encontrado" });
      }

      if (data.auth_provider !== "google") {
        return res.status(401).json({
          mensaje:
            "Este correo está registrado sin Google. Usa el inicio de sesión tradicional.",
        });
      }

      const token = jwt.sign(
        { id_usuario: data.id_usuario, email, name, picture },
        SECRET_KEY_JWT,
        {
          expiresIn: "1h",
        }
      );
      res.cookie("access_token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 1000 * 60 * 60,
      });
      return res
        .status(200)
        .json({ name, email, picture, id_usuario: data.id_usuario });
    }

    return res.status(400).json({ mensaje: "Acción no válida" });
  } catch (err) {
    console.error(err)
    console.log(err);
    return res
      .status(400)
      .json({ mensaje: "Token inválido o error en autenticación" });
  }
};

export const verificarsesion = (req: AuthRequest, res: Response) => {
  console.log("verificar sesion");

  const session = req.session;
  console.log(session);
  if (!session?.name) return res.status(403).json({ data: "Token no valido" });

  try {
    console.log("si es valido");
    const { name, email, picture, id_usuario } = session;
    return res.status(200).json({ name, email, picture, id_usuario });
  } catch (error) {
    console.log("no es valido");
    return res.status(500).json({ data: "No se pudo verificar el token" });
  }
};

export const cerrarsesion = (req: Request, res: Response) => {
  console.log("Clear cookie");
  res.clearCookie("access_token", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  });
  res
    .status(200)
    .json({ message: "Sesión cerrada correctamente", isclearCookie: true });
};
