import { EventBusService } from "@medusajs/medusa"
import { Resend } from 'resend';

type PasswordResetData = {
  id: string
  email: string
  token: string
  first_name: string
}

class PasswordResetSubscriber {
  eventBus_: EventBusService
  resend_: Resend

  constructor(container) {
    this.eventBus_ = container.eventBusService
    // Inicializamos Resend con la clave de entorno
    this.resend_ = new Resend(process.env.RESEND_API_KEY);

    this.eventBus_.subscribe(
      "customer.password_reset",
      this.handlePasswordReset
    )
  }

  handlePasswordReset = async (data: PasswordResetData) => {
    // 1. Construimos el link exacto a tu página de Next.js
    // Usamos STORE_URL de las variables de entorno o un fallback local
    const frontendUrl = process.env.STORE_URL || "http://localhost:3000";
    const resetLink = `${frontendUrl}/account/reset-password?token=${data.token}&email=${data.email}`;

    console.log(`📨 Enviando correo de recuperación a: ${data.email}`);

    try {
      // 2. Enviamos el email usando Resend (HTML simple y directo)
      await this.resend_.emails.send({
        from: process.env.RESEND_FROM || 'onboarding@resend.dev',
        to: data.email,
        subject: 'Recupera tu acceso a Nebula',
        html: `
          <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #000;">Recuperación de Contraseña</h1>
            <p>Hola,</p>
            <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en Nebula Digital.</p>
            <p>Haz clic en el siguiente botón para crear una nueva contraseña:</p>
            <br/>
            <a href="${resetLink}" style="background-color: #00e5ff; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Restablecer Contraseña
            </a>
            <br/><br/>
            <p style="font-size: 12px; color: #666;">
              Si no has solicitado este cambio, puedes ignorar este correo. El enlace expirará en 24 horas.
            </p>
            <p style="font-size: 12px; color: #666;">
              O copia y pega este enlace: <br/> ${resetLink}
            </p>
          </div>
        `
      });
      console.log("✅ Correo enviado correctamente via Resend");
    } catch (error) {
      console.error("❌ Error enviando email con Resend:", error);
    }
  }
}

export default PasswordResetSubscriber