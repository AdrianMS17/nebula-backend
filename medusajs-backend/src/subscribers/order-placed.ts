import { 
  type SubscriberConfig, 
  type SubscriberArgs,
} from "@medusajs/medusa"
import { Resend } from 'resend';

// Tu email personal para recibir las alertas
const MY_ADMIN_EMAIL = "adrianms17@gmail.com"; 

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

  // --- CÁLCULOS MATEMÁTICOS ---
  let finalTotal = order.total;
  if (!finalTotal && order.payments?.length) {
      finalTotal = order.payments[0].amount;
  }
  
  const totalEuro = finalTotal / 100;
  
  // Desglose: Base = Total / 1.21
  const baseImponible = totalEuro / 1.21;
  const ivaTotal = totalEuro - baseImponible;
  const totalDisplay = totalEuro.toFixed(2);

  // --- HTML PRODUCTOS (ESTILO TABLA PARA GMAIL) ---
  const itemsHtml = order.items.map(item => {
    const priceUnit = item.unit_price / 100; 
    // USAMOS UNA TABLA para que Gmail NO junte los números
    return `
      <li style="margin-bottom: 10px; border-bottom: 1px dashed #334155; padding-bottom: 10px; list-style: none;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="left" style="color: #e2e8f0; font-family: sans-serif;">
              <strong>${item.title}</strong> <span style="color: #94a3b8; font-size: 12px;">(x${item.quantity})</span>
            </td>
            <td align="right" style="color: #ffffff; font-weight: bold; font-family: sans-serif;">
              ${priceUnit.toFixed(2)} €
            </td>
          </tr>
        </table>
      </li>`;
  }).join("");

  try {
    // 1. EMAIL AL CLIENTE
    await resend.emails.send({
      from: 'Nebula Store <hola@nebuladigital.es>', 
      to: [order.email],
      subject: `Confirmación de pedido #${order.display_id}`,
      html: `
        <div style="background-color: #0f172a; color: white; padding: 40px; font-family: 'Helvetica', sans-serif; max-width: 600px; margin: 0 auto;">
          
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #22d3ee; margin: 0; font-size: 28px;">NEBULA</h1>
          </div>

          <p style="font-size: 16px;">Hola.</p>
          <p style="font-size: 16px;">Tu misión <strong>#${order.display_id}</strong> ha sido confirmada. Estamos preparando los propulsores.</p>
          
          <div style="background-color: #1e293b; padding: 25px; border-radius: 8px; margin: 30px 0; border: 1px solid #334155;">
            <h3 style="margin-top: 0; color: #22d3ee; border-bottom: 1px solid #334155; padding-bottom: 10px; margin-bottom: 20px;">Resumen</h3>
            
            <ul style="padding: 0; margin: 0;">
              ${itemsHtml}
            </ul>

            <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #334155;">
               <table width="100%" cellpadding="5" cellspacing="0" style="color: #94a3b8; font-size: 14px;">
                 <tr>
                   <td align="right">Base Imponible:</td>
                   <td align="right" width="80">${baseImponible.toFixed(2)} €</td>
                 </tr>
                 <tr>
                   <td align="right">IVA (21%):</td>
                   <td align="right">${ivaTotal.toFixed(2)} €</td>
                 </tr>
                 <tr>
                   <td align="right" style="padding-top: 10px; color: white; font-weight: bold; font-size: 18px;">TOTAL:</td>
                   <td align="right" style="padding-top: 10px; color: #22d3ee; font-weight: bold; font-size: 18px;">${totalDisplay} €</td>
                 </tr>
               </table>
            </div>
          </div>

          <div style="text-align: center; font-size: 12px; color: #64748b; margin-top: 40px;">
            <p>Nebula Digital Store &copy; 2026</p>
          </div>
        </div>
      `,
    });

    // 2. EMAIL AL ADMINISTRADOR
    await resend.emails.send({
      from: 'Nebula Bot <hola@nebuladigital.es>',
      to: [MY_ADMIN_EMAIL], 
      subject: `🤑 NUEVA VENTA: ${totalDisplay}€ (Pedido #${order.display_id})`,
      html: `
        <div style="font-family: sans-serif; border: 1px solid #ccc; padding: 20px;">
          <h2 style="color: green;">¡Caja! 💰 Nueva Venta Confirmada</h2>
          <p><strong>Pedido:</strong> #${order.display_id}</p>
          <p><strong>Cliente:</strong> ${order.email}</p>
          <p><strong>Total:</strong> ${totalDisplay} €</p>
        </div>
      `,
    });

    console.log(`✅ Emails enviados (versión TABLA)`);

  } catch (err) {
    console.error("❌ Fallo crítico enviando emails:", err);
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
  context: {
    subscriberId: "order-placed-handler",
  },
}