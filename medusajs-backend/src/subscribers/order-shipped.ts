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
  const fulfillmentService = container.resolve("fulfillmentService")
  const resend = new Resend(process.env.RESEND_API_KEY);

  const id = data.id;
  let order;
  let trackingDisplay = "Pendiente";

  console.log(`🔍 PROCESANDO ENVÍO. ID recibido: ${id}`);

  try {
    // --- LÓGICA HÍBRIDA MEJORADA ---
    
    // CASO A: ID de PEDIDO (order_...)
    if (id.startsWith("order_")) {
        console.log(`👉 Es un Order ID. Buscando fulfillment más reciente...`);
        order = await orderService.retrieve(id, {
            // AÑADIDO: "fulfillments.tracking_links" para asegurar que traemos todo
            relations: ["items", "shipping_address", "fulfillments", "fulfillments.tracking_links"],
        });

        if (order.fulfillments && order.fulfillments.length > 0) {
            // Ordenamos por fecha para coger el último creado
            const lastFulfillment = order.fulfillments.sort((a: any, b: any) => 
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0];

            console.log("📦 Fulfillment encontrado:", lastFulfillment.id);
            console.log("🔢 Tracking Numbers:", lastFulfillment.tracking_numbers);
            console.log("🔗 Tracking Links:", lastFulfillment.tracking_links);

            // 1. Intentamos leer tracking_numbers (Array simple)
            if (lastFulfillment.tracking_numbers?.length > 0) {
                trackingDisplay = lastFulfillment.tracking_numbers.join(", ");
            } 
            // 2. Si falla, intentamos leer tracking_links (Objetos)
            else if (lastFulfillment.tracking_links?.length > 0) {
                trackingDisplay = lastFulfillment.tracking_links.map((t: any) => t.tracking_number).join(", ");
            }
        }
    } 
    // CASO B: ID de FULFILLMENT (ful_...)
    else if (id.startsWith("ful_")) {
        console.log(`👉 Es un Fulfillment ID. Buscando directo...`);
        // Recuperamos el fulfillment con sus enlaces
        const fulfillment = await fulfillmentService.retrieve(id, {
            relations: ["tracking_links"]
        });
        
        order = await orderService.retrieve(fulfillment.order_id, {
            relations: ["items", "shipping_address"],
        });

        console.log("🔢 Tracking Numbers:", fulfillment.tracking_numbers);
        console.log("🔗 Tracking Links:", fulfillment.tracking_links);
        
        if (fulfillment.tracking_numbers?.length > 0) {
            trackingDisplay = fulfillment.tracking_numbers.join(", ");
        } else if (fulfillment.tracking_links?.length > 0) {
            trackingDisplay = fulfillment.tracking_links.map((t: any) => t.tracking_number).join(", ");
        }
    } else {
        console.warn(`⚠️ ID desconocido recibido: ${id}`);
        return; // Salimos si no entendemos el ID
    }

    if (!order) {
        console.error("❌ Error: No se pudo recuperar el pedido.");
        return;
    }

    // --- ENVIAR EMAIL ---
    console.log(`🚚 Enviando email a ${order.email} (Tracking Final: ${trackingDisplay})...`);

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

    console.log(`✅ Email ENVIADO correctamente.`);

  } catch (err) {
    console.error("❌ Fallo en el proceso de email:", err);
  }
}

export const config: SubscriberConfig = {
  event: "order.shipment_created",
  context: {
    subscriberId: "order-shipped-handler",
  },
}