import { Router } from "express"
import { CustomerService } from "@medusajs/medusa"
import jwt from "jsonwebtoken"
import bodyParser from "body-parser"
import cors from "cors"
import { getConfigFile } from "medusa-core-utils"

export default (rootDirectory) => {
  const router = Router()
  
  // Cargamos la configuración
  const { configModule } = getConfigFile(rootDirectory, "medusa-config")
  
  // 👇 IMPORTANTE: El "as any" es vital para que no falle el build
  const { projectConfig } = configModule as any
  
  const corsOptions = {
    origin: projectConfig.store_cors.split(","),
    credentials: true,
  }

  router.use(cors(corsOptions))
  router.use(bodyParser.json())

  // Ruta de verificación
  router.post("/store/verify-email", async (req, res) => {
    const { token } = req.body
    const jwtSecret = process.env.JWT_SECRET || process.env.COOKIE_SECRET || "supersecret"

    try {
      const decoded: any = jwt.verify(token, jwtSecret)
      const email = decoded.email

      const customerService: CustomerService = req.scope.resolve("customerService")
      const customer = await customerService.retrieveByEmail(email)

      if (!customer) {
        return res.status(404).json({ message: "Usuario no encontrado" })
      }

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