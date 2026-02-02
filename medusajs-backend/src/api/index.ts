import { Router } from "express"
import { CustomerService } from "@medusajs/medusa"
import jwt from "jsonwebtoken"
import bodyParser from "body-parser"
import cors from "cors"
import { getConfigFile } from "medusa-core-utils"

export default (rootDirectory) => {
  const router = Router()
  
  // Configuración básica para permitir que tu frontend hable con esta ruta
  const { configModule } = getConfigFile(rootDirectory, "medusa-config")
  const { projectConfig } = configModule
  
  const corsOptions = {
    origin: projectConfig.store_cors.split(","),
    credentials: true,
  }

  router.use(cors(corsOptions))
  router.use(bodyParser.json())

  // 👇 ESTA ES LA RUTA MÁGICA
  router.post("/store/verify-email", async (req, res) => {
    const { token } = req.body
    
    // El secreto debe ser el mismo que usaremos para firmar (usamos el cookie_secret por defecto)
    const jwtSecret = process.env.JWT_SECRET || process.env.COOKIE_SECRET || "supersecret"

    try {
      // 1. Desciframos el token
      const decoded: any = jwt.verify(token, jwtSecret)
      const email = decoded.email

      // 2. Buscamos al cliente
      const customerService: CustomerService = req.scope.resolve("customerService")
      const customer = await customerService.retrieveByEmail(email)

      if (!customer) {
        return res.status(404).json({ message: "Usuario no encontrado" })
      }

      // 3. ¡Lo verificamos! (Actualizamos sus metadatos)
      await customerService.update(customer.id, {
        metadata: {
          ...customer.metadata,
          verified: true
        }
      })

      return res.json({ success: true, message: "Email verificado correctamente" })

    } catch (error) {
      console.error(error)
      return res.status(400).json({ success: false, message: "Token inválido o expirado" })
    }
  })

  return router
}