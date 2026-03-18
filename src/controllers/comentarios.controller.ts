import type { Response } from "express";
import type AuthRequest from "../interfaces/iAuthRequest.js";
import { supabase } from "../data-source.js";

export async function Comentar(req: AuthRequest, res: Response) {
  const { id_lugar, puntuacion, contenido } = req.body;

  const id_usuario = req.session?.id_usuario;

  try {
    if (!id_usuario) {
      return res
        .status(403)
        .json({ mensaje: "Debe autenticarse para comentar" });
    }

    const { data, error } = await supabase
      .from("comentarios")
      .insert([{ id_lugar, id_usuario, contenido, puntuacion }])
      .select(`id_comentario, contenido, puntuacion, fecha_creacion, usuarios(email, nombre, imagenurl, id_usuario)`)
      .single();

    console.log(data);

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ mensaje: "upps ocurrio algo" });
  }
}

export async function getComentarios(req: AuthRequest, res: Response) {
  const id_lugar = Number(req.params.id_lugar);
  console.log(id_lugar);

  try {
    if (!id_lugar) {
      return res.status(400).json({ mensaje: "Incluya el id del lugar" });
    }

    const { data, error } = await supabase
      .from("comentarios")
      .select(
        `
    id_comentario,
    contenido,
    puntuacion,
    fecha_creacion,
    usuarios(id_usuario, nombre, imagenurl)
  `
      )
      .eq("id_lugar", id_lugar)
      .order("fecha_creacion", { ascending: false });

    console.log(data);
    if (error) throw new Error("Error al consultar datos");
    res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ mensaje: "Upps intentelo mas tarde" });
  }
}

export async function editarComentario(req: AuthRequest, res: Response) {
  // Solo se implementa la actualizacion del contenido,
  // no la de la puntuacion, por ahora

  const id_usuario = req.session?.id_usuario;
  if (!id_usuario) {
    return res.status(403).json({ mensaje: "Debe autenticarse para comentar" });
  }
  const { id_comentario, contenidoNuevo } = req.body;

  try {
    const { data, error } = await supabase
      .from("comentarios")
      .update({ contenido: contenidoNuevo })
      .eq("id_comentario", id_comentario)
      .eq("id_usuario", id_usuario)
      .select()
      .single();

    if (error) throw new Error("Error al actualizar comentario");

    return res.status(200).json({ mensaje: "Comentario actualizado" });
  } catch (error) {
    return res.status(500).json({ mensaje: "Error al actualizar comentario" });
  }
}

export async function deleteComentario(req: AuthRequest, res: Response) {
  console.log("En eliminar Comentario");
  const id_usuario = req.session?.id_usuario;
  if (!id_usuario) {
    return res.status(403).json({ mensaje: "Debe autenticarse para comentar" });
  }

  try {
    const { id_comentario } = req.params;
    const { error } = await supabase
      .from("comentarios")
      .delete()
      .eq("id_comentario", id_comentario)
      .eq("id_usuario", id_usuario);

    if (error) throw new Error("Error al eliminar comentario");
    return res.status(200).json({ mensaje: "Comentario Eliminado" });
  } catch (error) {
    return res.status(500).json({ mensaje: "Error eliminar comentario" });
  }
}
