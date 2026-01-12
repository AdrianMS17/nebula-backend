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
  
  // Recuperamos el pedido y sus envíos (fulfillments)
  const order = await orderService.retrieve(data.order_id, {
    relations: ["items", "shipping_address", "fulfillments"],
  })

  // Buscamos el tracking del envío que acaba de ocurrir
  const fulfillment = order.fulfillments.find(f => f.id === data.id);
  const trackingNumbers = fulfillment?.tracking_numbers || [];
  const trackingDisplay = trackingNumbers.length > 0 ? trackingNumbers.join(", ") : "Pendiente de actualización";

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    await resend.emails.send({
      // 👇 AQUÍ ESTÁ EL CAMBIO OFICIAL
      from: 'Nebula Store <hola@nebuladigital.es>', 
      to: [order.email],
      subject: `🚀 Tu pedido #${order.display_id} ha sido enviado`,
      html: `
        <div style="background-color: #0f172a; color: white; padding: 40px; font-family: 'Helvetica', sans-serif; max-width: 600px; margin: 0 auto;">
          
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #22d3ee; margin: 0;">NEBULA</h1>
            <p style="color: #94a3b8; letter-spacing: 2px; font-size: 12px; text-transform: uppercase; margin-top: 10px;">Logistics Department</p>
          </div>

          <h2 style="color: white; text-align: center;">¡Despegue Confirmado!</h2>
          <p style="text-align: center; color: #cbd5e1;">Tu equipo está en camino.</p>
          
          <div style="background-color: #1e293b; padding: 25px; border-radius: 8px; margin: 30px 0; border: 1px solid #334155; text-align: center;">
            <p style="color: #94a3b8; font-size: 12px; text-transform: uppercase; margin-bottom: 5px;">Número de Seguimiento</p>
            <p style="color: #22d3ee; font-size: 24px; font-weight: bold; margin: 0; letter-spacing: 1px;">
              ${trackingDisplay}
            </p>
          </div>

          <div style="margin-bottom: 40px; font-size: 14px; color: #cbd5e1; text-align: center;">
            <p>El transportista actualizará el estado en las próximas 24 horas.</p>
          </div>

          <div style="border-top: 1px solid #334155; padding-top: 20px; font-size: 12px; color: #64748b; text-align: center;">
            <p>Nebula Digital Store &copy; 2026</p>
          </div>
        </div>
      `,
    });

    console.log(`✅ Email de ENVÍO mandado a ${order.email} desde hola@nebuladigital.es`);

  } catch (err) {
    console.error("❌ Fallo enviando email de envío:", err);
  }
}

export const config: SubscriberConfig = {
  event: "order.shipment_created",
  context: {
    subscriberId: "order-shipped-handler",
  },
}