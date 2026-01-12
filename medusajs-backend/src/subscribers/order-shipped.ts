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
  const fulfillmentService = container.resolve("fulfillmentService") // <--- NUEVO: Necesitamos esto
  
  try {
    // 1. PRIMERO: Buscamos el Fulfillment (Envío) usando el ID que nos da el evento
    // (Porque el evento a veces no nos da el order_id directamente)
    const fulfillment = await fulfillmentService.retrieve(data.id);

    if (!fulfillment) {
      console.error("❌ No se encontró el fulfillment con ID:", data.id);
      return;
    }

    // 2. AHORA SÍ: Usamos el order_id que viene dentro del fulfillment para sacar el pedido
    const order = await orderService.retrieve(fulfillment.order_id, {
      relations: ["items", "shipping_address", "fulfillments"],
    })

    // 3. Sacamos los trackings directamente del fulfillment que ya hemos buscado
    const trackingNumbers = fulfillment.tracking_numbers || [];
    const trackingDisplay = trackingNumbers.length > 0 ? trackingNumbers.join(", ") : "Pendiente";

    const resend = new Resend(process.env.RESEND_API_KEY);

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

export const config: SubscriberConfig = {
  event: "order.shipment_created",
  context: {
    subscriberId: "order-shipped-handler",
  },
}