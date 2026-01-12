import { 
  type SubscriberConfig, 
  type SubscriberArgs,
} from "@medusajs/medusa"
import { Resend } from 'resend';

export default async function handleOrderPlaced({ 
  data, 
  eventName, 
  container, 
  pluginOptions, 
}: SubscriberArgs<Record<string, any>>) {
  
  const orderService = container.resolve("orderService")
  const order = await orderService.retrieve(data.id, {
    relations: ["items", "shipping_address", "payments"],
  })

  const resend = new Resend(process.env.RESEND_API_KEY);

  // Matemáticas para el desglose visual
  let finalTotal = order.total;
  if (!finalTotal && order.payments?.length) {
      finalTotal = order.payments[0].amount;
  }
  
  const totalEuro = finalTotal / 100;
  const baseImponible = totalEuro / 1.21;
  const ivaTotal = totalEuro - baseImponible;

  const itemsHtml = order.items.map(item => {
    const priceWithTax = (item.unit_price * 1.21) / 100; 
    return `<li style="margin-bottom: 10px; border-bottom: 1px dashed #334155; padding-bottom: 10px;">
       <div style="display: flex; justify-content: space-between;">
         <span><strong>${item.title}</strong> x ${item.quantity}</span>
         <span>${priceWithTax.toFixed(2)} €</span>
       </div>
     </li>`;
  }).join("");

  const totalDisplay = totalEuro.toFixed(2);

  try {
    const response = await resend.emails.send({
      from: 'Nebula Store <onboarding@resend.dev>', // Recuerda: En producción cambiarás esto por tu dominio
      to: [order.email],
      subject: `Confirmación de pedido #${order.display_id}`,
      html: `
        <div style="background-color: #0f172a; color: white; padding: 40px; font-family: 'Helvetica', sans-serif; max-width: 600px; margin: 0 auto;">
          
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #22d3ee; margin: 0;">NEBULA</h1>
          </div>

          <p>Hola.</p>
          <p>Tu misión <strong>#${order.display_id}</strong> ha sido confirmada. Estamos preparando los propulsores.</p>
          
          <div style="background-color: #1e293b; padding: 25px; border-radius: 8px; margin: 30px 0; border: 1px solid #334155;">
            <h3 style="margin-top: 0; color: #e2e8f0; border-bottom: 1px solid #22d3ee; padding-bottom: 10px; display: inline-block;">Resumen</h3>
            
            <ul style="list-style: none; padding: 0; margin-top: 20px;">
              ${itemsHtml}
            </ul>

            <div style="margin-top: 20px; padding-top: 15px; text-align: right;">
               <table style="width: 100%; color: #94a3b8; font-size: 14px;">
                 <tr>
                   <td style="text-align: right;">Base:</td>
                   <td style="text-align: right; width: 80px;">${baseImponible.toFixed(2)} €</td>
                 </tr>
                 <tr>
                   <td style="text-align: right;">IVA (21%):</td>
                   <td style="text-align: right;">${ivaTotal.toFixed(2)} €</td>
                 </tr>
                 <tr>
                   <td style="text-align: right; font-size: 18px; color: white; font-weight: bold; padding-top: 10px;">TOTAL:</td>
                   <td style="text-align: right; font-size: 18px; color: #22d3ee; font-weight: bold; padding-top: 10px;">${totalDisplay} €</td>
                 </tr>
               </table>
            </div>
          </div>

          <div style="margin-bottom: 40px; font-size: 14px; color: #cbd5e1;">
            <strong>Enviado a:</strong><br>
            ${order.shipping_address?.address_1 || ''}<br>
            ${order.shipping_address?.postal_code || ''} ${order.shipping_address?.city || ''}<br>
            ${order.shipping_address?.country_code?.toUpperCase() || ''}
          </div>

          <div style="border-top: 1px solid #334155; padding-top: 20px; margin-top: 40px; font-size: 12px; color: #64748b; text-align: center;">
            <p>Nebula Digital Store &copy; 2026</p>
            <p style="margin-top: 10px;">
              Este documento sirve como comprobante de pedido.<br>
              <strong>¿Necesitas una factura detallada con validez fiscal?</strong><br>
              Simplemente responde a este correo solicitándola y te la enviaremos en PDF.
            </p>
          </div>

        </div>
      `,
    }) as any;

    console.log("Email enviado con éxito a:", order.email);

  } catch (err) {
    console.error("Fallo crítico enviando email:", err);
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
  context: {
    subscriberId: "order-placed-handler",
  },
}