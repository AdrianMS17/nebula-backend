import { 
  type SubscriberConfig, 
  type SubscriberArgs,
} from "@medusajs/medusa"
import { Resend } from 'resend';

export default async function handleOrderShipped({ 
  data, 
  eventName, 
  container, 
  pluginOptions, 
}: SubscriberArgs<Record<string, any>>) {
  
  const orderService = container.resolve("orderService")
  
  // 1. Recuperamos el pedido y sus datos
  const order = await orderService.retrieve(data.order_id, {
    relations: ["items", "shipping_address", "fulfillments"],
  })

  // 2. Buscamos el tracking específico de este envío
  // data.id es el ID del Fulfillment que se acaba de crear/actualizar
  const fulfillment = order.fulfillments.find(f => f.id === data.id);
  const trackingNumbers = fulfillment?.tracking_numbers || [];
  const trackingDisplay = trackingNumbers.length > 0 ? trackingNumbers.join(", ") : "Pendiente";

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    console.log(`🚚 Enviando email de tracking para pedido #${order.display_id}...`);

    await resend.emails.send({
      from: 'Nebula Store <hola@nebuladigital.es>', 
      to: [order.email],
      subject: `🚀 Tu pedido #${order.display_id} ha sido enviado`,
      html: `
        <div style="background-color: #0f172a; color: white; padding: 40px; font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #22d3ee; margin: 0; font-size: 28px;">NEBULA</h1>
            <p style="color: #94a3b8; font-size: 12px; text-transform: uppercase; margin-top: 5px;">Logistics Department</p>
          </div>

          <h2 style="color: white; text-align: center;">¡Despegue Confirmado!</h2>
          <p style="text-align: center; color: #cbd5e1; font-size: 16px;">Tu equipo está en camino hacia las coordenadas indicadas.</p>
          
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #1e293b; border-radius: 8px; margin: 30px 0; border: 1px solid #334155;">
            <tr>
              <td align="center" style="padding: 25px;">
                <p style="color: #94a3b8; font-size: 12px; text-transform: uppercase; margin: 0 0 10px 0;">Número de Seguimiento</p>
                <p style="color: #22d3ee; font-size: 24px; font-weight: bold; margin: 0; letter-spacing: 2px;">
                  ${trackingDisplay}
                </p>
              </td>
            </tr>
          </table>

          <div style="margin-bottom: 40px; font-size: 14px; color: #cbd5e1; text-align: center;">
            <p>El transportista actualizará el estado en las próximas 24 horas.</p>
          </div>

          <div style="border-top: 1px solid #334155; padding-top: 20px; font-size: 12px; color: #64748b; text-align: center;">
            <p>Nebula Digital Store &copy; 2026</p>
          </div>
        </div>
      `,
    });

    console.log(`✅ Email de ENVÍO mandado a ${order.email} con tracking: ${trackingDisplay}`);

  } catch (err) {
    console.error("❌ Fallo enviando email de envío:", err);
  }
}

// CONFIGURACIÓN DEL LISTENER
export const config: SubscriberConfig = {
  event: "order.shipment_created", // <--- ESTE ES EL GATILLO CLAVE
  context: {
    subscriberId: "order-shipped-handler",
  },
}