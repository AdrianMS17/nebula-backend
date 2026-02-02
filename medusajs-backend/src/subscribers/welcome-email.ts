import { EventBusService, CustomerService } from "@medusajs/medusa"
import { Resend } from 'resend';
import jwt from "jsonwebtoken";

class WelcomeEmailSubscriber {
  eventBus_: EventBusService
  resend_: Resend
  customerService_: CustomerService

  constructor(container) {
    this.eventBus_ = container.eventBusService
    this.customerService_ = container.customerService
    this.resend_ = new Resend(process.env.RESEND_API_KEY);

    this.eventBus_.subscribe(
      "customer.created",
      this.handleWelcomeEmail
    )
  }

  handleWelcomeEmail = async (data) => {
    const email = data.email;
    const id = data.id;
    const jwtSecret = process.env.JWT_SECRET || process.env.COOKIE_SECRET || "supersecret";
    
    // 1. Marcar usuario como NO verificado al nacer
    // (Esto es opcional si asumimos que false es el defecto, pero es buena práctica)
    try {
        await this.customerService_.update(id, {
            metadata: { verified: false }
        });
    } catch (e) {
        console.log("Error actualizando metadata inicial", e);
    }

    // 2. Generar Token de Verificación (expira en 24h)
    const token = jwt.sign({ email: email, id: id }, jwtSecret, { expiresIn: '24h' });

    // 3. Crear Enlace Mágico
    const storeUrl = process.env.STORE_URL || "https://nebuladigital.es";
    // Apuntamos a una página del frontend que crearemos ahora
    const verificationLink = `${storeUrl}/account/verify?token=${token}`;

    console.log(`🔒 Enviando verificación a: ${email}`);

    try {
      await this.resend_.emails.send({
        from: process.env.RESEND_FROM || 'onboarding@resend.dev',
        to: email,
        subject: 'Verifica tu cuenta en Nebula',
        html: `
          <div style="font-family: sans-serif; padding: 40px; background: #0f172a; color: white;">
            <h1 style="color: #00e5ff;">Verificación de Seguridad</h1>
            <p>Hola,</p>
            <p>Para activar tus credenciales y acceder a la plataforma, confirma tu email:</p>
            <br/>
            <a href="${verificationLink}" style="background-color: #00e5ff; color: #000; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display:inline-block;">
              VERIFICAR CUENTA
            </a>
            <br/><br/>
            <p style="font-size: 12px; color: #64748b;">Este enlace expira en 24 horas.</p>
          </div>
        `
      });
    } catch (error) {
      console.error("❌ Error enviando email:", error);
    }
  }
}

export default WelcomeEmailSubscriber